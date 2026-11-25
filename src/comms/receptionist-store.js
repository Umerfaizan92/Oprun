// R-03 (T-123): AI Receptionist data model, docs/ai-receptionist/00_CONTRACT.md §5. Additive only: new tables, new
// columns on voice_calls and tenant_customers. Legacy tables (voice_settings, tenant_receptionist_profiles) are read,
// never changed, by the copy step below, and stay for rollback.
import crypto from 'node:crypto';

const TABLES = `
  CREATE TABLE IF NOT EXISTS receptionist_config (
    organisation_id TEXT PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','paused')),
    greeting TEXT, hours_json TEXT NOT NULL DEFAULT '{}', timezone TEXT, voice_id TEXT, voice_provider TEXT,
    languages_json TEXT NOT NULL DEFAULT '["en-AU"]',
    booking_mode TEXT NOT NULL DEFAULT 'approve' CHECK (booking_mode IN ('approve','auto')),
    booking_rules_json TEXT NOT NULL DEFAULT '{"services":[],"buffer_min":15,"lead_time_hours":2,"window_days":14,"bookable_hours":null,"service_area":[],"crews":1}',
    approval_level TEXT NOT NULL DEFAULT 'approve_all' CHECK (approval_level IN ('approve_all','auto_confirmations','auto_followups')),
    transfer_targets_json TEXT NOT NULL DEFAULT '[]',
    transfer_when TEXT NOT NULL DEFAULT 'on_request' CHECK (transfer_when IN ('on_request','urgent','never')),
    forward_mode TEXT, recording_notice INTEGER NOT NULL DEFAULT 1, recording_enabled INTEGER NOT NULL DEFAULT 0,
    transcript_retention_days INTEGER NOT NULL DEFAULT 365, recording_retention_days INTEGER NOT NULL DEFAULT 90,
    voicemail_greeting TEXT, voice_speed TEXT NOT NULL DEFAULT 'normal' CHECK (voice_speed IN ('slower','normal','quicker')),
    spend_cap_cents INTEGER, cap_action TEXT NOT NULL DEFAULT 'take_message' CHECK (cap_action IN ('take_message','voicemail')),
    knowledge_revision INTEGER, wizard_step TEXT, updated_by TEXT, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS receptionist_knowledge (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, revision INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','superseded')),
    facts_json TEXT NOT NULL DEFAULT '{}', prompt_block TEXT NOT NULL DEFAULT '', sources_json TEXT NOT NULL DEFAULT '[]',
    approved_by TEXT, approved_at TEXT, created_at TEXT NOT NULL, UNIQUE (organisation_id, revision));
  CREATE TABLE IF NOT EXISTS receptionist_numbers (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, e164 TEXT NOT NULL UNIQUE,
    telnyx_number_id TEXT, number_type TEXT NOT NULL DEFAULT 'local' CHECK (number_type IN ('local','1300','1800','mobile')),
    origin TEXT NOT NULL CHECK (origin IN ('bought','forward_target','ported')),
    status TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning','active','releasing','released')),
    is_primary INTEGER NOT NULL DEFAULT 0, requirement_group_id TEXT, forwarded_from_e164 TEXT, forward_verified_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS receptionist_numbers_org ON receptionist_numbers(organisation_id, status);
  CREATE TABLE IF NOT EXISTS receptionist_port_orders (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, telnyx_port_order_id TEXT,
    numbers_json TEXT NOT NULL DEFAULT '[]', number_kind TEXT, status TEXT NOT NULL DEFAULT 'draft', foc_date TEXT, rejection_reason TEXT,
    loa_document_id TEXT, invoice_document_id TEXT, approval_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS receptionist_followups (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, enquiry_id TEXT NOT NULL UNIQUE,
    customer_id TEXT, thread_id TEXT, state TEXT NOT NULL, step INTEGER NOT NULL DEFAULT 0, next_action_at TEXT, last_channel TEXT,
    attempts INTEGER NOT NULL DEFAULT 0, stop_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS receptionist_followups_due ON receptionist_followups(state, next_action_at);
  CREATE TABLE IF NOT EXISTS receptionist_slot_holds (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, start_at TEXT NOT NULL, end_at TEXT NOT NULL,
    call_control_id TEXT, enquiry_id TEXT, approval_id TEXT, expires_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS receptionist_slot_holds_org ON receptionist_slot_holds(organisation_id, start_at);
  CREATE TABLE IF NOT EXISTS receptionist_blocklist (
    id TEXT PRIMARY KEY, organisation_id TEXT REFERENCES organisations(id) ON DELETE CASCADE, e164 TEXT NOT NULL, reason TEXT,
    added_by TEXT, created_at TEXT NOT NULL);
  CREATE UNIQUE INDEX IF NOT EXISTS receptionist_blocklist_unique ON receptionist_blocklist(COALESCE(organisation_id,''), e164);
  CREATE TABLE IF NOT EXISTS receptionist_tool_calls (
    idempotency_key TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, call_control_id TEXT, tool_name TEXT NOT NULL,
    response_json TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS receptionist_duplicate_candidates (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, customer_id TEXT NOT NULL,
    candidate_customer_id TEXT NOT NULL, reason TEXT, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','merged','dismissed')),
    created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT);
`;
const VOICE_CALL_COLUMNS = [['customer_id', 'TEXT'], ['enquiry_id', 'TEXT'], ['thread_id', 'TEXT'], ['intent', 'TEXT'], ['outcome', 'TEXT'], ['language', 'TEXT'], ['spam_score', 'REAL'], ['billable', 'INTEGER'], ['latency_p50_ms', 'INTEGER'], ['latency_p95_ms', 'INTEGER'], ['barge_in_count', 'INTEGER'], ['summary_json', 'TEXT'], ['worker_session_id', 'TEXT']];
export const CALL_OUTCOMES = ['completed', 'caller_hung_up', 'spam', 'wrong_number', 'transferred', 'silence', 'message_taken', 'voicemail', 'missed', 'test'];

const hasTable = (db, t) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t));
const cols = (db, t) => new Set(db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name));

export function migrateReceptionist(db) {
  db.exec(TABLES);
  if (hasTable(db, 'voice_calls')) { const have = cols(db, 'voice_calls'); for (const [c, type] of VOICE_CALL_COLUMNS) if (!have.has(c)) db.exec(`ALTER TABLE voice_calls ADD COLUMN ${c} ${type}`); }
  if (hasTable(db, 'tenant_customers') && !cols(db, 'tenant_customers').has('caller_note')) db.exec('ALTER TABLE tenant_customers ADD COLUMN caller_note TEXT');
}

// Copy step (merge plan §3 steps 2 and 3). Dry run by default: returns what would be written and writes nothing.
// Existing receptionist rows are never overwritten, so it can run again safely.
export function copyLegacyReceptionist(db, { apply = false, now = new Date().toISOString() } = {}) {
  migrateReceptionist(db);
  const report = { config: [], knowledge: [], numbers: [], skipped: [] };
  const orgs = new Set();
  const profiles = hasTable(db, 'tenant_receptionist_profiles') ? db.prepare('SELECT * FROM tenant_receptionist_profiles').all() : [];
  const voice = hasTable(db, 'voice_settings') ? Object.fromEntries(db.prepare('SELECT * FROM voice_settings').all().map((v) => [v.owner_key, v])) : {};
  for (const p of profiles) orgs.add(p.organisation_id);
  for (const k of Object.keys(voice)) if (db.prepare('SELECT 1 FROM organisations WHERE id=?').get(k)) orgs.add(k);
  const write = (fn) => { if (apply) fn(); };
  db.transaction(() => {
    for (const org of orgs) {
      if (db.prepare('SELECT 1 FROM receptionist_config WHERE organisation_id=?').get(org)) { report.skipped.push({ organisation_id: org, reason: 'config already exists' }); continue; }
      const p = profiles.find((x) => x.organisation_id === org) || {}, v = voice[org] || {};
      const transfer = p.transfer_destination || v.transfer_number || null;
      const cfg = { organisation_id: org, greeting: p.greeting || null, hours_json: JSON.stringify(p.hours ? { text: p.hours } : {}), timezone: p.timezone || null,
        transfer_targets_json: JSON.stringify(transfer ? [{ name: 'Main contact', e164: transfer }] : []), transfer_when: ['on_request', 'urgent', 'never'].includes(v.transfer_when) ? v.transfer_when : 'on_request',
        recording_notice: v.recording_notice === undefined ? 1 : v.recording_notice ? 1 : 0, voicemail_greeting: v.voicemail_greeting || null, updated_by: 'migration', updated_at: now };
      report.config.push(cfg);
      write(() => db.prepare('INSERT INTO receptionist_config (organisation_id,status,greeting,hours_json,timezone,transfer_targets_json,transfer_when,recording_notice,voicemail_greeting,updated_by,updated_at) VALUES (@organisation_id,\'draft\',@greeting,@hours_json,@timezone,@transfer_targets_json,@transfer_when,@recording_notice,@voicemail_greeting,@updated_by,@updated_at)').run(cfg));
      if (p.knowledge && !db.prepare('SELECT 1 FROM receptionist_knowledge WHERE organisation_id=?').get(org)) {
        const k = { id: crypto.randomUUID(), organisation_id: org, revision: 1, facts_json: JSON.stringify({ legacy_text: p.knowledge }), prompt_block: String(p.knowledge).slice(0, 8000), sources_json: JSON.stringify([{ source: 'tenant_receptionist_profiles', revision: p.revision || 1 }]), created_at: now };
        report.knowledge.push({ organisation_id: org, revision: 1, status: 'draft', chars: k.prompt_block.length });
        write(() => db.prepare("INSERT INTO receptionist_knowledge (id,organisation_id,revision,status,facts_json,prompt_block,sources_json,created_at) VALUES (@id,@organisation_id,@revision,'draft',@facts_json,@prompt_block,@sources_json,@created_at)").run(k));
      }
    }
    if (hasTable(db, 'comms_channels')) for (const c of db.prepare("SELECT organisation_id,address FROM comms_channels WHERE channel='voice' AND status='active' AND address IS NOT NULL").all()) {
      if (db.prepare('SELECT 1 FROM receptionist_numbers WHERE e164=?').get(c.address)) { report.skipped.push({ organisation_id: c.organisation_id, reason: 'number already listed' }); continue; }
      const n = { id: crypto.randomUUID(), organisation_id: c.organisation_id, e164: c.address, created_at: now, updated_at: now };
      report.numbers.push({ organisation_id: c.organisation_id, e164: c.address, origin: 'bought', is_primary: 1 });
      write(() => db.prepare("INSERT INTO receptionist_numbers (id,organisation_id,e164,origin,status,is_primary,created_at,updated_at) VALUES (@id,@organisation_id,@e164,'bought','active',1,@created_at,@updated_at)").run(n));
    }
  })();
  return { applied: apply, ...report };
}
