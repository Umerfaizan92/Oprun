// R-15/R-18 (T-135, T-138): workspace API for the AI receptionist settings (02_SETUP_WIZARD.md §6).
// The organisation is always the signed-in one. Saves are per step, check the updated_at the screen loaded (two
// people editing get a 409 and the latest values), and never change anything outside receptionist_config.
import { z } from 'zod';

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const HOURS = z.object(Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, z.array(z.tuple([HHMM, HHMM]).refine(([a, b]) => a < b, 'closing must be after opening')).max(4).optional()]))).strict();
const E164_AU = z.string().regex(/^\+61[2-478]\d{8}$/, 'Use an Australian number in the form +61…');
const SCHEMAS = {
  settings: z.object({ greeting: z.string().trim().min(10).max(300).optional(), hours: HOURS.optional(), timezone: z.string().max(60).optional(), voicemail_greeting: z.string().trim().max(300).nullable().optional(), recording_notice: z.boolean().optional(), spend_cap_dollars: z.number().min(0).max(100000).nullable().optional(), cap_action: z.enum(['take_message', 'voicemail']).optional() }).strict(),
  voice: z.object({ voice_id: z.string().max(80).nullable().optional(), voice_speed: z.enum(['slower', 'normal', 'quicker']), languages: z.array(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/)).max(5).optional() }).strict(),
  booking: z.object({ booking_mode: z.enum(['approve', 'auto']), services: z.array(z.object({ id: z.string().max(40).optional(), name: z.string().trim().min(2).max(120), aliases: z.array(z.string().trim().min(1).max(60)).max(8).optional(), duration_min: z.number().int().min(15).max(600), price_from_dollars: z.number().min(0).max(100000).nullable().optional(), needs_visit: z.boolean().optional() })).max(30), buffer_min: z.number().int().min(0).max(240), lead_time_hours: z.number().int().min(0).max(336), window_days: z.number().int().min(1).max(90), bookable_hours: HOURS.nullable().optional(), service_area: z.array(z.string().trim().min(2).max(60)).max(60), crews: z.number().int().min(1).max(50) }).strict(),
  approvals: z.object({ approval_level: z.enum(['approve_all', 'auto_confirmations', 'auto_followups']), transfer_when: z.enum(['on_request', 'urgent', 'never']), transfer_targets: z.array(z.object({ name: z.string().trim().min(1).max(80), e164: E164_AU.optional(), role: z.enum(['owner', 'team']).optional(), user_id: z.string().max(80).optional(), after_hours_urgent: z.boolean().optional() })).max(5) }).strict()
};
const STEP_NO = { voice: 3, booking: 4, approvals: 5 };
const mask = (e164) => `•••${String(e164 || '').slice(-3)}`;
const J = (v, d) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };

export function installReceptionistRoutes(app, { db, env, requireSaasUser, requireSaasRole, audit = () => {}, knowledge, capState = () => null, clock = () => Date.now() }) {
  const senior = [requireSaasUser, requireSaasRole('owner', 'admin', 'manager', 'super_admin', 'director')];
  const owners = [requireSaasUser, requireSaasRole('owner', 'admin', 'super_admin')];
  const iso = () => new Date(clock()).toISOString();
  const org = (req) => req.saas.organisation_id;
  const enabled = () => env.RECEPTIONIST_ENABLED === '1';
  const ensure = (o, by) => db.prepare('INSERT OR IGNORE INTO receptionist_config (organisation_id,timezone,updated_by,updated_at) VALUES (?,(SELECT timezone FROM organisations WHERE id=?),?,?)').run(o, o, by, iso());
  function view(o) {
    const c = db.prepare('SELECT * FROM receptionist_config WHERE organisation_id=?').get(o) || null;
    const numbers = db.prepare('SELECT id,e164,number_type,origin,status,is_primary,forward_verified_at FROM receptionist_numbers WHERE organisation_id=? ORDER BY is_primary DESC,created_at').all(o);
    const rules = J(c?.booking_rules_json, { services: [] });
    const since = new Date(clock() - 86400000).toISOString(), week = new Date(clock() - 7 * 86400000).toISOString();
    const calls = db.prepare("SELECT COUNT(*) n, AVG(latency_p50_ms) p50, MAX(latency_p95_ms) p95 FROM voice_calls WHERE organisation_id=? AND scope='business' AND started_at>=?").get(o, since);
    return {
      enabled: enabled(),
      config: c ? { status: c.status, wizard_step: Number(c.wizard_step || 0), greeting: c.greeting || '', hours: J(c.hours_json, {}), timezone: c.timezone, voice_id: c.voice_id, voice_speed: c.voice_speed, languages: J(c.languages_json, ['en-AU']),
        booking_mode: c.booking_mode, booking_rules: { ...rules, services: (rules.services || []).map((s) => ({ ...s, price_from_dollars: Number.isFinite(s.price_from_cents) && s.price_from_cents !== null ? s.price_from_cents / 100 : null })) },
        approval_level: c.approval_level, transfer_when: c.transfer_when, transfer_targets: J(c.transfer_targets_json, []).map((t) => ({ ...t, e164: undefined, number: mask(t.e164) })),
        voicemail_greeting: c.voicemail_greeting, recording_notice: Boolean(c.recording_notice), spend_cap_dollars: c.spend_cap_cents === null || c.spend_cap_cents === undefined ? null : c.spend_cap_cents / 100, cap_action: c.cap_action, knowledge_revision: c.knowledge_revision, updated_at: c.updated_at } : null,
      numbers, usage: capState(o),
      today: { calls: calls.n || 0, p50_ms: calls.p50 ? Math.round(calls.p50) : null, p95_ms: calls.p95 || null },
      bookings_waiting: db.prepare("SELECT COUNT(*) n FROM workspace_approvals WHERE organisation_id=? AND approval_type='receptionist_booking' AND status='pending'").get(o).n,
      enquiries_this_week: db.prepare("SELECT COUNT(*) n FROM tenant_documents WHERE organisation_id=? AND kind='enquiry' AND channel='receptionist' AND created_at>=?").get(o, week).n,
      followups_running: db.prepare("SELECT COUNT(*) n FROM receptionist_followups WHERE organisation_id=? AND state IN ('AWAITING_CUSTOMER','SLOT_PROPOSED','BOOKING_PENDING_APPROVAL')").get(o).n,
      voices: J(env.RECEPTIONIST_VOICES_JSON, []).filter((v) => v && v.id && v.name).map((v) => ({ id: String(v.id), name: String(v.name), description: String(v.description || '') }))
    };
  }
  app.get('/api/saas/receptionist', ...senior, (req, res) => res.set('cache-control', 'no-store').json({ ok: true, ...view(org(req)) }));

  app.put('/api/saas/receptionist/config', ...senior, (req, res) => {
    const part = String(req.body?.part || ''), schema = SCHEMAS[part];
    if (!schema) return res.status(400).json({ ok: false, error: 'Choose which settings to save.' });
    const p = schema.safeParse(req.body?.values || {});
    if (!p.success) return res.status(400).json({ ok: false, error: p.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ') });
    const o = org(req); ensure(o, req.saas.user_id);
    const cur = db.prepare('SELECT * FROM receptionist_config WHERE organisation_id=?').get(o);
    if (req.body?.updated_at && req.body.updated_at !== cur.updated_at) return res.status(409).json({ ok: false, error: 'Someone else changed this. Here is the latest version.', latest: view(o).config });
    const v = p.data, sets = {};
    if (part === 'settings') {
      if (v.greeting !== undefined) sets.greeting = v.greeting;
      if (v.hours) sets.hours_json = JSON.stringify(v.hours);
      if (v.timezone) { try { new Intl.DateTimeFormat('en-AU', { timeZone: v.timezone }); sets.timezone = v.timezone; } catch { return res.status(400).json({ ok: false, error: 'Unknown time zone.' }); } }
      if (v.voicemail_greeting !== undefined) sets.voicemail_greeting = v.voicemail_greeting;
      if (v.recording_notice !== undefined) sets.recording_notice = v.recording_notice ? 1 : 0;
      if (v.spend_cap_dollars !== undefined) sets.spend_cap_cents = v.spend_cap_dollars === null ? null : Math.round(v.spend_cap_dollars * 100);
      if (v.cap_action) sets.cap_action = v.cap_action;
    }
    if (part === 'voice') {
      const voices = view(o).voices;
      if (v.voice_id && !voices.some((x) => x.id === v.voice_id)) return res.status(400).json({ ok: false, error: 'Choose a voice from the list.' });
      Object.assign(sets, { voice_id: v.voice_id || null, voice_provider: v.voice_id ? 'elevenlabs' : null, voice_speed: v.voice_speed, languages_json: JSON.stringify([...new Set(['en-AU', ...(v.languages || [])])]) });
    }
    if (part === 'booking') {
      if (v.services.length && !(v.bookable_hours ? Object.values(v.bookable_hours).some((x) => x?.length) : Object.values(J(cur.hours_json, {})).some((x) => Array.isArray(x) && x.length))) return res.status(400).json({ ok: false, error: 'Add at least one bookable time block (or opening hours) before allowing bookings.' });
      const rules = { services: v.services.map((s, i) => ({ id: s.id || `svc_${i + 1}`, name: s.name, aliases: s.aliases || [], duration_min: s.duration_min, price_from_cents: s.price_from_dollars === null || s.price_from_dollars === undefined ? null : Math.round(s.price_from_dollars * 100), needs_visit: Boolean(s.needs_visit) })), buffer_min: v.buffer_min, lead_time_hours: v.lead_time_hours, window_days: v.window_days, bookable_hours: v.bookable_hours || null, service_area: v.service_area, crews: v.crews };
      Object.assign(sets, { booking_mode: v.booking_mode, booking_rules_json: JSON.stringify(rules) });
    }
    if (part === 'approvals') {
      // A target sent back with a masked number keeps the number already stored for that name.
      const old = J(cur.transfer_targets_json, []);
      const targets = v.transfer_targets.map((t) => ({ ...t, e164: t.e164 || old.find((x) => x.name === t.name)?.e164 }));
      if (targets.some((t) => !t.e164)) return res.status(400).json({ ok: false, error: 'Add a mobile number for each person on the transfer list.' });
      Object.assign(sets, { approval_level: v.approval_level, transfer_when: v.transfer_when, transfer_targets_json: JSON.stringify(targets) });
    }
    if (STEP_NO[part]) sets.wizard_step = Math.max(Number(cur.wizard_step || 0), STEP_NO[part]);
    sets.updated_by = req.saas.user_id; sets.updated_at = iso();
    db.prepare(`UPDATE receptionist_config SET ${Object.keys(sets).map((k) => `${k}=@${k}`).join(',')} WHERE organisation_id=@o`).run({ ...sets, o });
    audit(req, 'receptionist.settings_changed', 'receptionist_config', o, { part, fields: Object.keys(sets).filter((k) => !['updated_by', 'updated_at'].includes(k)) });
    res.json({ ok: true, ...view(o) });
  });

  app.post('/api/saas/receptionist/go-live', ...owners, (req, res) => {
    const o = org(req), c = db.prepare('SELECT * FROM receptionist_config WHERE organisation_id=?').get(o);
    const missing = [];
    if (!enabled()) missing.push('the AI receptionist service is not switched on for Oprun yet');
    if (!c || Number(c.wizard_step || 0) < 5) missing.push('finish the voice, booking and approval steps');
    if (!db.prepare("SELECT 1 FROM receptionist_numbers WHERE organisation_id=? AND status='active'").get(o) && !db.prepare("SELECT 1 FROM comms_channels WHERE organisation_id=? AND channel='voice' AND status='active'").get(o)) missing.push('an active phone number');
    if (!knowledge?.liveBlock(o)?.revision) missing.push('approve what the receptionist knows');
    if (missing.length) return res.status(409).json({ ok: false, error: `Before going live: ${missing.join('; ')}.`, missing });
    db.prepare("UPDATE receptionist_config SET status='live',wizard_step=6,updated_by=?,updated_at=? WHERE organisation_id=?").run(req.saas.user_id, iso(), o);
    audit(req, 'receptionist.went_live', 'receptionist_config', o, {});
    res.json({ ok: true, ...view(o) });
  });
  for (const [path, from, to] of [['pause', 'live', 'paused'], ['resume', 'paused', 'live']]) app.post(`/api/saas/receptionist/${path}`, ...owners, (req, res) => {
    const o = org(req), r = db.prepare('UPDATE receptionist_config SET status=?,updated_by=?,updated_at=? WHERE organisation_id=? AND status=?').run(to, req.saas.user_id, iso(), o, from);
    if (!r.changes) return res.status(409).json({ ok: false, error: path === 'pause' ? 'The receptionist is not live.' : 'The receptionist is not paused.' });
    audit(req, `receptionist.${to}`, 'receptionist_config', o, {}); res.json({ ok: true, ...view(o) });
  });
  app.get('/api/saas/receptionist/calls', ...senior, (req, res) => {
    const where = ["organisation_id=?", "scope='business'"], args = [org(req)];
    const outcome = String(req.query.outcome || ''); if (/^[a-z_]{3,20}$/.test(outcome)) { where.push('outcome=?'); args.push(outcome); }
    const rows = db.prepare(`SELECT call_control_id id,from_number,started_at,duration_seconds,intent,outcome,language,voicemail,transferred_to_human,spam_score,summary_json,customer_id,enquiry_id,thread_id FROM voice_calls WHERE ${where.join(' AND ')} ORDER BY started_at DESC LIMIT 100`).all(...args);
    res.set('cache-control', 'no-store').json({ ok: true, calls: rows.map((r) => ({ ...r, summary: J(r.summary_json, {}).summary || null, summary_json: undefined })) });
  });
  return { view };
}
