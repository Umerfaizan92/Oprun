// TR-52: proposed workspace. From the guided-setup answers (src/onboarding-interview.js) Oprun proposes a business
// profile, services, modules, workflow stages and message templates. The proposal is only a suggestion: nothing in
// the workspace changes until the owner (or an admin) reviews it, ticks the consent box and approves. The approval and
// the exact wording agreed to are recorded. Declining changes nothing. A proposal made before the answers changed
// cannot be approved; a fresh one is made instead.
import crypto from 'node:crypto';
import { z } from 'zod';
import { buildQuestions } from './onboarding-questions.js';
import { MODULES, recommendedFor } from './module-rules.js';
import { industryByCode } from './industry-registry.js';

export const CONSENT_VERSION = '2026-11-24';
export const CONSENT_TEXT = 'I have reviewed this proposed setup and approve Oprun applying the parts I have ticked to my workspace. I can change any of it later in Business settings.';
export const STAGES = ['enquiry', 'quotation', 'booking', 'allocation', 'execution', 'completion', 'invoice', 'payment'];

const iso = () => new Date().toISOString();
const safe = (s, f) => { try { const v = JSON.parse(s); return v ?? f; } catch { return f; } };
const hash = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

// "Just me", "only me", "myself", "sole trader", "solo" (and the same idea in Hindi or Urdu) mean nobody to allocate.
const SOLO = /\b(just me|only me|myself|me alone|on my own|by myself|sole trader|solo|one[- ]person)\b|सिर्फ़ मैं|केवल मैं|अकेला|صرف میں|اکیلا/i;
export const isSolo = (text) => SOLO.test(String(text || ''));

// Split a free-text answer into a short list of services ("A, B and C"; one per line; "A; B").
export function splitServices(text, fallback = []) {
  // Split on commas, semicolons, new lines and bullets. "and" splits only the last item of a list ("A, B and C"),
  // or the whole answer when it has no commas, so "scale and clean" in the middle stays one service.
  let raw = String(text || '').split(/\n|;|,|•|·|\s-\s/);
  const last = raw.length - 1;
  raw = raw.flatMap((x, i) => (i === last ? x.split(/\band\b/i) : [x]));
  const parts = raw.map((s) => s.replace(/^[\s\-–•*\d.)]+/, '').replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 3 && s.length <= 80);
  const seen = new Set(), out = [];
  for (const p of parts) { const k = p.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(p[0].toUpperCase() + p.slice(1)); } }
  return (out.length ? out : fallback).slice(0, 12);
}

// Which workflow stages fit the kind of business. Every business keeps enquiry, invoice and payment.
function stagesFor(family, solo) {
  const off = new Set();
  if (family === 'retail') { off.add('quotation'); off.add('allocation'); }
  if (family === 'clinic' || family === 'care') off.add('quotation');
  if (solo) off.add('allocation');
  return STAGES.map((key) => ({ key, on: !off.has(key), reason: off.has(key) ? (key === 'allocation' && solo ? 'solo' : family) : null }));
}

function templatesFor({ business, services, hours, family }) {
  const first = services[0] ? services[0].toLowerCase() : 'your request';
  const job = family === 'retail' ? 'order' : family === 'clinic' || family === 'care' ? 'appointment' : 'job';
  return [
    { key: 'enquiry_ack', channel: 'email', title: 'Thanks for your enquiry', body: `Hi {customer_name},\n\nThanks for contacting ${business}. We have your enquiry about ${first} and will reply soon${hours ? ` (we usually work ${hours.replace(/[.\s]+$/, '')})` : ''}.\n\nRegards,\n${business}` },
    ...(['retail', 'clinic', 'care'].includes(family) ? [] : [{ key: 'quote_follow_up', channel: 'email', title: 'Following up on your quote', body: `Hi {customer_name},\n\nJust checking whether you had any questions about the quote we sent for ${first}. Reply to this message and we will help.\n\nRegards,\n${business}` }]),
    { key: 'reminder', channel: 'sms', title: `${job[0].toUpperCase() + job.slice(1)} reminder`, body: `Hi {customer_name}, a reminder of your ${job} with ${business} on {date} at {time}. Reply if you need to change it.` },
    { key: 'invoice_reminder', channel: 'email', title: 'Invoice reminder', body: `Hi {customer_name},\n\nA friendly reminder that invoice {invoice_number} for {amount} is due on {due_date}. Thank you for your business.\n\n${business}` }
  ];
}

export function buildProposal({ answers, country = 'AU', industry = 'custom', state = '', businessName = 'Your business' }) {
  const ctx = buildQuestions({ country, industry, state, answers });
  const row = industryByCode(ctx.industry.code), solo = isSolo(answers.team?.value);
  const services = splitServices(answers.services?.value, row.services || []);
  const rec = recommendedFor(ctx.industry.code);
  const modules = MODULES.map((m) => {
    let on = rec[m.key], reason = on ? 'recommended' : 'not_for_industry';
    if (solo && (m.key === 'hiring' || m.key === 'offshore')) { on = false; reason = 'solo'; }
    return { key: m.key, label: m.label, on, reason };
  });
  return {
    industry: { code: ctx.industry.code, label: ctx.industry.label, guessed: ctx.guessed },
    country: ctx.country,
    profile: {
      business_type: ctx.industry.code === 'custom' ? String(answers.business?.value || '').split(/[.\n]/)[0].slice(0, 150) || 'Custom business' : ctx.industry.label,
      industry_code: ctx.industry.code,
      team_mode: solo ? 'solo' : 'team',
      service_area: String(answers.service_area?.value || '').slice(0, 300)
    },
    services, modules, stages: stagesFor(ctx.family, solo),
    templates: templatesFor({ business: businessName, services, hours: answers.hours?.value?.slice(0, 80), family: ctx.family })
  };
}

export function installOnboardingProposal(app, { db, requireSaasUser, requireSaasRole, saasAudit = () => {}, interview }) {
  db.exec(`CREATE TABLE IF NOT EXISTS onboarding_proposals(id TEXT PRIMARY KEY,organisation_id TEXT NOT NULL REFERENCES organisations(id),proposal_json TEXT NOT NULL,answers_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','approved','declined','superseded')),choices_json TEXT,created_by TEXT,created_at TEXT NOT NULL,decided_by TEXT,decided_at TEXT);
 CREATE INDEX IF NOT EXISTS onboarding_proposals_org ON onboarding_proposals(organisation_id,created_at);
 CREATE TABLE IF NOT EXISTS onboarding_consents(id TEXT PRIMARY KEY,organisation_id TEXT NOT NULL,proposal_id TEXT NOT NULL REFERENCES onboarding_proposals(id),user_id TEXT NOT NULL,consent_version TEXT NOT NULL,consent_text TEXT NOT NULL,choices_json TEXT NOT NULL,ip_hash TEXT,user_agent TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS workspace_templates(id TEXT PRIMARY KEY,organisation_id TEXT NOT NULL REFERENCES organisations(id),template_key TEXT NOT NULL,channel TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'proposal',created_by TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(organisation_id,template_key));`);
  const pcols = new Set(db.prepare('PRAGMA table_info(onboarding_profiles)').all().map((c) => c.name));
  if (!pcols.has('pipeline_stages_json')) db.exec('ALTER TABLE onboarding_profiles ADD COLUMN pipeline_stages_json TEXT');

  const read = [requireSaasUser, requireSaasRole('owner', 'admin', 'manager', 'super_admin', 'director')];
  // Approving changes the whole workspace, so only the owner or an admin may do it.
  const decide = [requireSaasUser, requireSaasRole('owner', 'admin', 'super_admin')];
  const org = (req) => req.saas.organisation_id;
  const latest = (o) => db.prepare("SELECT * FROM onboarding_proposals WHERE organisation_id=? AND status<>'superseded' ORDER BY created_at DESC,rowid DESC LIMIT 1").get(o);
  const answersHash = (o) => hash(Object.fromEntries(Object.entries(interview.answers(o)).map(([k, a]) => [k, a.value])));
  const view = (p, o) => p && { id: p.id, status: p.status, proposal: safe(p.proposal_json, null), choices: safe(p.choices_json, null), created_at: p.created_at, decided_at: p.decided_at,
    decided_by: p.decided_by ? db.prepare('SELECT full_name FROM users WHERE id=?').get(p.decided_by)?.full_name || null : null, stale: p.status === 'proposed' && p.answers_hash !== answersHash(o) };

  function make(req) {
    const o = org(req), answers = interview.answers(o);
    let orgRow = {}; try { orgRow = db.prepare('SELECT * FROM organisations WHERE id=?').get(o) || {}; } catch {}
    let industry = 'custom'; try { industry = db.prepare('SELECT industry_code FROM onboarding_profiles WHERE organisation_id=?').get(o)?.industry_code || 'custom'; } catch {}
    const proposal = buildProposal({ answers, country: orgRow.country || 'AU', industry, state: orgRow.address_state || orgRow.state || '', businessName: orgRow.display_name || orgRow.name || 'Your business' });
    const id = crypto.randomUUID();
    db.transaction(() => {
      db.prepare("UPDATE onboarding_proposals SET status='superseded' WHERE organisation_id=? AND status='proposed'").run(o);
      db.prepare('INSERT INTO onboarding_proposals(id,organisation_id,proposal_json,answers_hash,created_by,created_at) VALUES (?,?,?,?,?,?)').run(id, o, JSON.stringify(proposal), answersHash(o), req.saas.user_id, iso());
    })();
    saasAudit(req, 'onboarding.proposal_created', 'onboarding_proposal', id, { industry: proposal.industry.code });
    return latest(o);
  }

  app.get('/api/saas/onboarding/proposal', ...read, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, proposal: view(latest(org(req)), org(req)), consent: { version: CONSENT_VERSION, text: CONSENT_TEXT }, can_approve: ['owner', 'admin', 'super_admin'].includes(req.saas.role) });
  });

  app.post('/api/saas/onboarding/proposal', ...read, (req, res) => {
    if (interview.status(org(req)) !== 'answered') return res.status(409).json({ ok: false, error: 'Finish the guided setup questions first.' });
    res.status(201).json({ ok: true, proposal: view(make(req), org(req)) });
  });

  const decisionSchema = z.object({
    consent: z.literal(true),
    consent_version: z.literal(CONSENT_VERSION),
    choices: z.object({
      profile: z.boolean().default(true),
      services: z.array(z.string().trim().min(2).max(80)).max(30),
      modules: z.record(z.string(), z.boolean()),
      stages: z.array(z.enum(STAGES)).min(1),
      templates: z.array(z.string().max(40)).max(10)
    }).strict()
  }).strict();

  app.post('/api/saas/onboarding/proposal/:id/approve', ...decide, (req, res) => {
    const o = org(req), p = db.prepare('SELECT * FROM onboarding_proposals WHERE id=? AND organisation_id=?').get(req.params.id, o);
    if (!p) return res.status(404).json({ ok: false, error: 'Proposal not found.' });
    if (p.status !== 'proposed') return res.status(409).json({ ok: false, error: `This proposal was already ${p.status}.` });
    if (p.answers_hash !== answersHash(o)) return res.status(409).json({ ok: false, error: 'Your answers changed after this proposal was made. Make a new proposal and review it again.', stale: true });
    const d = decisionSchema.safeParse(req.body ?? {});
    if (!d.success) return res.status(400).json({ ok: false, error: req.body?.consent !== true ? 'Tick the box to confirm you approve this setup.' : 'Check your choices and try again.' });
    const prop = safe(p.proposal_json, {}), c = d.data.choices;
    if (!c.stages.includes('enquiry') || !c.stages.includes('payment')) return res.status(400).json({ ok: false, error: 'Keep the Enquiry and Payment stages.' });
    const modules = Object.fromEntries(MODULES.map((m) => [m.key, c.modules[m.key] ?? prop.modules?.find((x) => x.key === m.key)?.on ?? true]));
    const templates = (prop.templates || []).filter((t) => c.templates.includes(t.key));
    const t = iso();
    db.transaction(() => {
      const exists = db.prepare('SELECT 1 FROM onboarding_profiles WHERE organisation_id=?').get(o);
      if (!exists) db.prepare('INSERT INTO onboarding_profiles(organisation_id,business_type,services,updated_at) VALUES (?,?,?,?)').run(o, prop.profile.business_type, '[]', t);
      if (c.profile) db.prepare('UPDATE onboarding_profiles SET business_type=?,industry_code=?,team_mode=?,service_area=CASE WHEN ?<>\'\' THEN ? ELSE service_area END,updated_at=? WHERE organisation_id=?')
        .run(prop.profile.business_type, prop.profile.industry_code, prop.profile.team_mode, prop.profile.service_area, prop.profile.service_area, t, o);
      db.prepare('UPDATE onboarding_profiles SET services=?,pipeline_stages_json=?,completed_at=COALESCE(completed_at,?),updated_at=? WHERE organisation_id=?').run(JSON.stringify(c.services), JSON.stringify(STAGES.filter((s) => c.stages.includes(s))), t, t, o);
      db.prepare('UPDATE organisations SET modules_json=?,updated_at=? WHERE id=?').run(JSON.stringify({ modules }), t, o);
      const put = db.prepare('INSERT INTO workspace_templates(id,organisation_id,template_key,channel,title,body,source,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,\'proposal\',?,?,?) ON CONFLICT(organisation_id,template_key) DO NOTHING');
      for (const tp of templates) put.run(crypto.randomUUID(), o, tp.key, tp.channel, tp.title, tp.body, req.saas.user_id, t, t);
      db.prepare("UPDATE onboarding_proposals SET status='approved',choices_json=?,decided_by=?,decided_at=? WHERE id=?").run(JSON.stringify(c), req.saas.user_id, t, p.id);
      db.prepare('INSERT INTO onboarding_consents(id,organisation_id,proposal_id,user_id,consent_version,consent_text,choices_json,ip_hash,user_agent,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(crypto.randomUUID(), o, p.id, req.saas.user_id, CONSENT_VERSION, CONSENT_TEXT, JSON.stringify(c), req.ip ? crypto.createHash('sha256').update(String(req.ip)).digest('hex').slice(0, 32) : null, String(req.get?.('user-agent') || '').slice(0, 200), t);
    })();
    saasAudit(req, 'onboarding.proposal_approved', 'onboarding_proposal', p.id, { consent_version: CONSENT_VERSION, modules, stages: c.stages, services: c.services.length, templates: templates.map((x) => x.key) });
    res.json({ ok: true, proposal: view(db.prepare('SELECT * FROM onboarding_proposals WHERE id=?').get(p.id), o) });
  });

  app.post('/api/saas/onboarding/proposal/:id/decline', ...decide, (req, res) => {
    const o = org(req), r = db.prepare("UPDATE onboarding_proposals SET status='declined',decided_by=?,decided_at=? WHERE id=? AND organisation_id=? AND status='proposed'").run(req.saas.user_id, iso(), req.params.id, o);
    if (!r.changes) return res.status(409).json({ ok: false, error: 'This proposal is no longer waiting for a decision.' });
    saasAudit(req, 'onboarding.proposal_declined', 'onboarding_proposal', req.params.id, {});
    res.json({ ok: true });
  });

  app.get('/api/saas/workspace-templates', ...read, (req, res) => res.json({ ok: true, templates: db.prepare('SELECT template_key key,channel,title,body,source,updated_at FROM workspace_templates WHERE organisation_id=? ORDER BY created_at').all(org(req)) }));

  return { pipelineStages: (o) => { try { return safe(db.prepare('SELECT pipeline_stages_json FROM onboarding_profiles WHERE organisation_id=?').get(o)?.pipeline_stages_json, null); } catch { return null; } } };
}
