// R-16 (T-136): what the AI receptionist knows, built from the business's own records (07_KNOWLEDGE_AUTOLOAD.md).
// A build makes a draft revision; only an owner/admin approval makes it live. Facts never include another customer's
// details, internal costs, prices from past quotes, private numbers or compliance documents. Prices come only from the
// owner's "from" prices in the booking rules. Template-only (no AI) so a build never stalls and never invents.
import crypto from 'node:crypto';
import { z } from 'zod';

const J = (v, d) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };
const has = (db, t) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t));
const DAY = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const MAX_CHARS = 10000; // about 2,500 tokens

function spokenTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number), h12 = h % 12 || 12, part = h < 12 ? 'in the morning' : h < 18 ? 'in the afternoon' : 'in the evening';
  return `${m ? `${h12}:${String(m).padStart(2, '0')}` : h12} ${h === 12 && !m ? 'midday' : part}`.replace('12 midday', 'midday');
}
const dollars = (c) => { const d = Math.round(c / 100); return `${d} dollars`; };
// Group days with the same hours: "Monday to Friday, 7 in the morning to 5 in the afternoon".
function hoursLines(hours) {
  const lines = []; let i = 0;
  while (i < ORDER.length) {
    const key = JSON.stringify(hours?.[ORDER[i]] || []); let j = i;
    while (j + 1 < ORDER.length && JSON.stringify(hours?.[ORDER[j + 1]] || []) === key) j++;
    const days = i === j ? DAY[ORDER[i]] : `${DAY[ORDER[i]]} to ${DAY[ORDER[j]]}`, ranges = J(key, []);
    lines.push(`${days}: ${ranges.length ? ranges.map(([a, b]) => `${spokenTime(a)} to ${spokenTime(b)}`).join(', and ') : 'closed'}`);
    i = j + 1;
  }
  return lines;
}
// Rule-based filter (07 §3): no phone numbers, emails or street addresses except the business's own public details.
export function scrubText(text, allowed = []) {
  let t = String(text || '');
  const keep = new Set(allowed.filter(Boolean).map((x) => String(x).toLowerCase()));
  t = t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => (keep.has(m.toLowerCase()) ? m : '[removed]'));
  t = t.replace(/(\+?\d[\d\s()-]{7,}\d)/g, (m) => (keep.has(m.replace(/[^\d+]/g, '')) || [...keep].some((k) => k.replace(/\D/g, '').endsWith(m.replace(/\D/g, '').slice(-9))) ? m : '[removed]'));
  t = t.replace(/\b\d{1,5}[a-z]?\s+[A-Z][a-z]+(\s[A-Z][a-z]+)?\s(St|Street|Rd|Road|Ave|Avenue|Dr|Drive|Ct|Court|Pl|Place|Cres|Crescent|Hwy|Highway|Pde|Parade|Tce|Terrace|Way|Lane|Ln)\b\.?/g, '[removed]');
  return t;
}

export function renderPromptBlock(facts, cfg = {}) {
  const sec = [];
  const b = facts.business || {};
  sec.push([`Business: ${b.name || ''}${b.type ? `, ${b.type}` : ''}.${b.area_summary ? ` ${b.area_summary}` : ''}`]);
  const hours = cfg.hours ?? facts.hours_raw;
  sec.push(hours && typeof hours === 'object' && Object.keys(hours).some((k) => ORDER.includes(k)) ? [`Hours (${cfg.timezone || facts.timezone || 'local time'}):`, ...hoursLines(hours), 'Public holidays: take a message.'] : facts.hours_text ? [`Hours: ${facts.hours_text}`] : ['Hours: not set. Offer to take a message.']);
  const rules = cfg.booking_rules || facts.booking_rules || { services: [] };
  const bookable = (rules.services || []).map((s) => `- ${s.name}${s.duration_min ? `, about ${s.duration_min} minutes` : ''}${Number.isFinite(s.price_from_cents) && s.price_from_cents !== null ? `, from ${dollars(s.price_from_cents)}` : ''}`);
  sec.push(bookable.length ? ['Services you can book on this call:', ...bookable] : ['Bookings on calls: none. Take a message for a time.']);
  const bookNames = new Set((rules.services || []).map((s) => s.name.toLowerCase()));
  const others = (facts.services || []).filter((s) => !bookNames.has(String(s.name).toLowerCase()));
  const othersFull = others.length ? ['Other services (take a message, do not book):', ...others.map((s) => `- ${s.name}${s.summary ? `: ${s.summary}` : ''}`)] : [];
  const area = facts.service_area?.suburbs?.length ? [`Service area: ${facts.service_area.suburbs.join(', ')}.${facts.service_area.note ? ' ' + facts.service_area.note : ''}`] : facts.service_area?.note ? [`Service area: ${facts.service_area.note}`] : [];
  const policies = (facts.policies || []).map((p) => `- ${p.topic}: ${p.text}`);
  const faqs = (facts.faqs || []).filter((f) => f.a).map((f) => `Q: ${f.q}\nA: ${f.a}`);
  const transfers = facts.transfers?.available ? [`Transfers: you can try to put the caller through to the team (${facts.transfers.when === 'urgent' ? 'urgent matters only' : 'when they ask'}). Never give out a team member's number.`] : ['Transfers: not available. Take a message.'];
  let parts = { s4: othersFull, s5: area, s6: policies.length ? ['Policies:', ...policies] : [], s7: faqs.length ? ['Common questions:', ...faqs] : [], s8: transfers };
  const trimmed = [];
  const text = () => [...sec, parts.s4, parts.s5, parts.s6, parts.s7, parts.s8].filter((x) => x.length).map((x) => x.join('\n')).join('\n\n');
  // Over budget: trim the FAQs from the end, then other services to names, then the area to its summary (07 §6).
  while (text().length > MAX_CHARS && parts.s7.length > 1) { parts.s7 = parts.s7.slice(0, -1); trimmed.push('faq'); }
  if (text().length > MAX_CHARS && others.length) { parts.s4 = ['Other services (take a message): ' + others.map((s) => s.name).join(', ')]; trimmed.push('services'); }
  if (text().length > MAX_CHARS && facts.service_area?.note) { parts.s5 = [`Service area: ${facts.service_area.note}`]; trimmed.push('area'); }
  return { text: text().slice(0, MAX_CHARS), trimmed: [...new Set(trimmed)] };
}

export function createReceptionistKnowledge({ db, audit = () => {}, clock = () => Date.now() }) {
  const iso = () => new Date(clock()).toISOString();
  function collect(org) {
    const o = db.prepare('SELECT COALESCE(display_name,name) name,timezone,state,postcode FROM organisations WHERE id=?').get(org) || {};
    const ob = has(db, 'onboarding_profiles') ? db.prepare('SELECT business_type,phone,website,service_area,services FROM onboarding_profiles WHERE organisation_id=?').get(org) || {} : {};
    const seo = has(db, 'seo_profiles') ? db.prepare('SELECT services_json,areas_json,phone FROM seo_profiles WHERE organisation_id=?').get(org) || {} : {};
    const legacy = has(db, 'tenant_receptionist_profiles') ? db.prepare("SELECT knowledge,hours FROM tenant_receptionist_profiles WHERE organisation_id=? AND status<>'draft'").get(org) : null;
    const cfg = db.prepare('SELECT * FROM receptionist_config WHERE organisation_id=?').get(org) || {};
    const since = new Date(clock() - 365 * 86400000).toISOString();
    const jobs = db.prepare("SELECT title,address,estimated_hours FROM work_orders WHERE organisation_id=? AND created_at>=? AND status<>'cancelled'").all(org, since);
    const count = (list) => { const m = new Map(); for (const x of list) if (x) m.set(x, (m.get(x) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
    const titles = count(jobs.map((j) => String(j.title || '').trim())).filter(([, n]) => n >= 3).slice(0, 10);
    // Suburb only, from the part of the address before the state: "1 Beach Rd, Fremantle WA 6160" -> "Fremantle".
    const suburbOf = (a) => { const m = String(a || '').match(/,\s*([A-Za-z][A-Za-z\s'-]{1,40}?)\s+(WA|NSW|VIC|QLD|SA|TAS|ACT|NT)\b/); return m ? m[1].trim() : null; };
    const suburbs = count(jobs.map((j) => suburbOf(j.address))).filter(([, n]) => n >= 3).slice(0, 15);
    const names = [...new Set([...J(ob.services, []), ...J(seo.services_json, []), ...titles.map(([t]) => t)].map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean).map((x) => x.trim()))];
    const sources = [{ table: 'organisations' }, ob.business_type || ob.services ? { table: 'onboarding_profiles' } : null, seo.services_json ? { table: 'seo_profiles' } : null, legacy ? { table: 'tenant_receptionist_profiles' } : null, titles.length ? { table: 'work_orders', count: jobs.length, note: `From ${jobs.length} past jobs` } : null, cfg.organisation_id ? { table: 'receptionist_config' } : null].filter(Boolean);
    const allowed = [ob.phone, seo.phone, ob.website].filter(Boolean);
    const facts = {
      business: { name: o.name || '', type: ob.business_type || '', area_summary: ob.service_area ? `Works in ${ob.service_area}.` : '', website: ob.website || '' },
      timezone: cfg.timezone || o.timezone || 'Australia/Perth', hours_text: legacy?.hours || '',
      services: names.map((n) => ({ name: n, summary: '' })),
      service_area: { suburbs: [...new Set([...J(seo.areas_json, []), ...suburbs.map(([s]) => s)])].slice(0, 20), note: ob.service_area || '' },
      faqs: [], policies: legacy?.knowledge ? [{ topic: 'Notes from the old receptionist settings', text: scrubText(legacy.knowledge, allowed).slice(0, 1500) }] : [],
      transfers: { available: J(cfg.transfer_targets_json, []).length > 0 && cfg.transfer_when !== 'never', when: cfg.transfer_when || 'on_request' }
    };
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify([o, ob, seo, legacy, titles, suburbs])).digest('hex').slice(0, 16);
    return { facts, sources, allowed, fingerprint };
  }
  const cfgFor = (org) => { const c = db.prepare('SELECT * FROM receptionist_config WHERE organisation_id=?').get(org) || {}; return { hours: J(c.hours_json, null), timezone: c.timezone, booking_rules: J(c.booking_rules_json, { services: [] }) }; };
  function nextRevision(org) { return (db.prepare('SELECT MAX(revision) n FROM receptionist_knowledge WHERE organisation_id=?').get(org).n || 0) + 1; }
  function build(org, actor) {
    const c = collect(org), revision = nextRevision(org), id = crypto.randomUUID();
    // Owner-written FAQs and policies carry over from the latest revision (drafts first).
    const prev = db.prepare("SELECT facts_json FROM receptionist_knowledge WHERE organisation_id=? ORDER BY CASE status WHEN 'draft' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, revision DESC LIMIT 1").get(org);
    const pf = J(prev?.facts_json, {});
    if (Array.isArray(pf.faqs)) c.facts.faqs = pf.faqs;
    if (Array.isArray(pf.policies) && pf.policies.some((p) => p.owner)) c.facts.policies = [...pf.policies.filter((p) => p.owner), ...c.facts.policies];
    const r = renderPromptBlock(c.facts, cfgFor(org));
    db.transaction(() => {
      db.prepare("UPDATE receptionist_knowledge SET status='superseded' WHERE organisation_id=? AND status='draft'").run(org);
      db.prepare("INSERT INTO receptionist_knowledge (id,organisation_id,revision,status,facts_json,prompt_block,sources_json,created_at) VALUES (?,?,?,'draft',?,?,?,?)").run(id, org, revision, JSON.stringify({ ...c.facts, fingerprint: c.fingerprint }), r.text, JSON.stringify(c.sources), iso());
    })();
    audit(actor, 'receptionist.knowledge_built', 'receptionist_knowledge', id, { revision });
    return { revision, trimmed: r.trimmed };
  }
  const editSchema = z.object({
    business: z.object({ name: z.string().max(160), type: z.string().max(160), area_summary: z.string().max(300), website: z.string().max(200) }).partial().optional(),
    services: z.array(z.object({ name: z.string().trim().min(1).max(120), summary: z.string().max(300).optional() })).max(60).optional(),
    service_area: z.object({ suburbs: z.array(z.string().trim().min(1).max(60)).max(40), note: z.string().max(300) }).partial().optional(),
    faqs: z.array(z.object({ q: z.string().trim().min(3).max(300), a: z.string().max(800) })).max(40).optional(),
    policies: z.array(z.object({ topic: z.string().trim().min(2).max(80), text: z.string().trim().min(2).max(800) })).max(20).optional()
  }).strict();
  function editDraft(org, actor, patch) {
    const p = editSchema.safeParse(patch || {}); if (!p.success) return { ok: false, status: 400, error: 'Check the facts: ' + p.error.issues.slice(0, 2).map((i) => i.path.join('.')).join(', ') };
    const d = db.prepare("SELECT * FROM receptionist_knowledge WHERE organisation_id=? AND status='draft' ORDER BY revision DESC LIMIT 1").get(org);
    if (!d) return { ok: false, status: 409, error: 'Build the knowledge first.' };
    const facts = { ...J(d.facts_json, {}), ...p.data };
    if (p.data.business) facts.business = { ...J(d.facts_json, {}).business, ...p.data.business };
    if (p.data.policies) facts.policies = p.data.policies.map((x) => ({ ...x, owner: true }));
    const allowed = collect(org).allowed;
    for (const f of facts.faqs || []) { f.a = scrubText(f.a, allowed); }
    for (const x of facts.policies || []) { x.text = scrubText(x.text, allowed); }
    const r = renderPromptBlock(facts, cfgFor(org));
    db.prepare('UPDATE receptionist_knowledge SET facts_json=?,prompt_block=? WHERE id=?').run(JSON.stringify(facts), r.text, d.id);
    audit(actor, 'receptionist.knowledge_edited', 'receptionist_knowledge', d.id, { revision: d.revision, fields: Object.keys(p.data) });
    return { ok: true, revision: d.revision, trimmed: r.trimmed };
  }
  // Approve a draft, or re-approve a superseded revision (rollback). Only one approved revision at a time.
  function approve(org, actor, revision) {
    const k = db.prepare("SELECT * FROM receptionist_knowledge WHERE organisation_id=? AND revision=? AND status IN ('draft','superseded')").get(org, Number(revision));
    if (!k) return { ok: false, status: 404, error: 'That revision cannot be approved.' };
    const facts = J(k.facts_json, {});
    if (!facts.business?.name || !(facts.services || []).length) return { ok: false, status: 400, error: 'Add the business name and at least one service before approving.' };
    const now = iso();
    db.transaction(() => {
      db.prepare("UPDATE receptionist_knowledge SET status='superseded' WHERE organisation_id=? AND status='approved'").run(org);
      db.prepare("UPDATE receptionist_knowledge SET status='approved',approved_by=?,approved_at=?,prompt_block=? WHERE id=?").run(actor?.saas?.user_id || null, now, renderPromptBlock(facts, cfgFor(org)).text, k.id);
      db.prepare('INSERT INTO receptionist_config (organisation_id,knowledge_revision,updated_by,updated_at) VALUES (?,?,?,?) ON CONFLICT(organisation_id) DO UPDATE SET knowledge_revision=excluded.knowledge_revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at').run(org, k.revision, actor?.saas?.user_id || null, now);
    })();
    audit(actor, 'receptionist.knowledge_approved', 'receptionist_knowledge', k.id, { revision: k.revision });
    return { ok: true, revision: k.revision };
  }
  function overview(org) {
    const list = db.prepare('SELECT revision,status,approved_at,created_at,prompt_block,facts_json,sources_json FROM receptionist_knowledge WHERE organisation_id=? ORDER BY revision DESC LIMIT 20').all(org);
    const approved = list.find((x) => x.status === 'approved'), draft = list.find((x) => x.status === 'draft');
    const stale = approved ? J(approved.facts_json, {}).fingerprint !== collect(org).fingerprint : false;
    const shape = (x) => (x ? { revision: x.revision, status: x.status, approved_at: x.approved_at, created_at: x.created_at, facts: J(x.facts_json, {}), sources: J(x.sources_json, []), prompt_block: x.prompt_block } : null);
    return { approved: shape(approved), draft: shape(draft), stale, history: list.map((x) => ({ revision: x.revision, status: x.status, approved_at: x.approved_at, created_at: x.created_at })) };
  }
  // The live text: approved facts, re-rendered with the current hours and booking rules (owner-typed, no re-approval).
  function liveBlock(org) {
    const c = db.prepare('SELECT knowledge_revision FROM receptionist_config WHERE organisation_id=?').get(org);
    const k = (c?.knowledge_revision ? db.prepare("SELECT revision,facts_json,prompt_block FROM receptionist_knowledge WHERE organisation_id=? AND revision=? AND status='approved'").get(org, c.knowledge_revision) : null) || db.prepare("SELECT revision,facts_json,prompt_block FROM receptionist_knowledge WHERE organisation_id=? AND status='approved' ORDER BY revision DESC LIMIT 1").get(org);
    if (!k) return { revision: null, prompt_block: '' };
    const facts = J(k.facts_json, {});
    // A revision without structured facts (copied from the old settings) is used exactly as approved.
    return { revision: k.revision, prompt_block: facts.business?.name ? renderPromptBlock(facts, cfgFor(org)).text : k.prompt_block };
  }
  return { collect, build, editDraft, approve, overview, liveBlock };
}

// Workspace API (02_SETUP_WIZARD.md): read for senior staff; build and edit for owner, admin and manager; approve for
// owner and admin only. The organisation is always the signed-in one.
export function installReceptionistKnowledgeRoutes(app, { knowledge, requireSaasUser, requireSaasRole, audit }) {
  const senior = [requireSaasUser, requireSaasRole('owner', 'admin', 'manager', 'super_admin', 'director')];
  const approvers = [requireSaasUser, requireSaasRole('owner', 'admin', 'super_admin')];
  const org = (req) => req.saas.organisation_id;
  const send = (res, r) => res.status(r.ok === false ? r.status || 400 : 200).json(r.ok === false ? { ok: false, error: r.error } : { ok: true, ...r });
  app.get('/api/saas/receptionist/knowledge', ...senior, (req, res) => res.json({ ok: true, ...knowledge.overview(org(req)) }));
  app.post('/api/saas/receptionist/knowledge/build', ...senior, (req, res) => send(res, { ok: true, ...knowledge.build(org(req), req) }));
  app.put('/api/saas/receptionist/knowledge/draft', ...senior, (req, res) => send(res, knowledge.editDraft(org(req), req, req.body)));
  app.post('/api/saas/receptionist/knowledge/:revision/approve', ...approvers, (req, res) => send(res, knowledge.approve(org(req), req, req.params.revision)));
}
