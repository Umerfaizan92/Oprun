// TR-50: guided onboarding interview. The owner answers one question at a time, by typing or speaking, in their own
// language. Every answer is saved on the server as soon as it is given, so closing the browser loses nothing and the
// next visit continues at the first unanswered question. Answers can be corrected at any time; the last five earlier
// versions of each answer are kept. Nothing here changes the workspace: TR-52 turns the answers into a proposal that
// the owner must approve.
import { z } from 'zod';
import { buildQuestions } from './onboarding-questions.js';

// TR-51: the questions come from src/onboarding-questions.js, built from the business's country and industry. These
// four are always asked and required.
export const CORE_QUESTIONS = buildQuestions().questions.filter((q) => q.required);

const iso = () => new Date().toISOString();
const safe = (s, f) => { try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : f; } catch { return f; } };

export function installOnboardingInterview(app, { db, requireSaasUser, requireSaasRole, saasAudit = () => {}, build = buildQuestions }) {
  db.exec(`CREATE TABLE IF NOT EXISTS onboarding_sessions(organisation_id TEXT PRIMARY KEY REFERENCES organisations(id),answers_json TEXT NOT NULL DEFAULT '{}',step INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','answered')),language TEXT,revision INTEGER NOT NULL DEFAULT 1,started_by TEXT,updated_by TEXT,started_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
  const manage = [requireSaasUser, requireSaasRole('owner', 'admin', 'manager', 'super_admin', 'director')];
  const load = (org) => db.prepare('SELECT * FROM onboarding_sessions WHERE organisation_id=?').get(org);
  // Country from the business record, industry from Business settings; both read fresh on every request so the
  // questions follow any change (and the first answer, while no industry is chosen).
  function context(req) {
    const org = req.saas.organisation_id;
    let o = {}; try { o = db.prepare('SELECT * FROM organisations WHERE id=?').get(org) || {}; } catch {}
    let industry = 'custom'; try { industry = db.prepare('SELECT industry_code FROM onboarding_profiles WHERE organisation_id=?').get(org)?.industry_code || 'custom'; } catch {}
    return build({ country: o.country || 'AU', industry, state: o.state || '', answers: safe(load(org)?.answers_json, {}) });
  }
  const qs = (req) => context(req).questions;
  // Every response carries the current questions: the list can change after the first answer.
  const payload = (req) => { const ctx = context(req); return { questions: ctx.questions, context: { country: ctx.country, industry: ctx.industry, family: ctx.family, industry_guessed: ctx.guessed, regulators: ctx.regulators }, session: view(load(req.saas.organisation_id), ctx.questions) }; };
  function ensure(req) {
    const org = req.saas.organisation_id, t = iso();
    db.prepare('INSERT OR IGNORE INTO onboarding_sessions(organisation_id,started_by,updated_by,started_at,updated_at) VALUES (?,?,?,?,?)').run(org, req.saas.user_id, req.saas.user_id, t, t);
    return load(org);
  }
  function view(row, list) {
    const answers = safe(row.answers_json, {});
    const firstOpen = list.findIndex((q) => !answers[q.key]?.value);
    const missing = list.filter((q) => q.required && !answers[q.key]?.value).map((q) => q.key);
    return {
      status: row.status, step: Math.min(row.step, list.length), revision: row.revision, language: row.language,
      answers: Object.fromEntries(Object.entries(answers).map(([k, a]) => [k, { value: a.value, source: a.source, language: a.language, updated_at: a.updated_at, corrections: (a.history || []).length }])),
      answered: list.filter((q) => answers[q.key]?.value).length, total: list.length, first_unanswered: firstOpen === -1 ? list.length : firstOpen,
      missing_required: missing, started_at: row.started_at, updated_at: row.updated_at
    };
  }

  app.get('/api/saas/onboarding/interview', ...manage, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    ensure(req);
    res.json({ ok: true, ...payload(req) });
  });

  const answerSchema = z.object({ value: z.string().max(4000), source: z.enum(['text', 'voice']).default('text'), language: z.string().trim().max(35).nullable().default(null), revision: z.number().int().positive() }).strict();
  app.put('/api/saas/onboarding/interview/answers/:key', ...manage, (req, res) => {
    const list = qs(req), idx = list.findIndex((q) => q.key === req.params.key);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Unknown question.' });
    const p = answerSchema.safeParse(req.body ?? {});
    if (!p.success) return res.status(400).json({ ok: false, error: 'Check your answer and try again.' });
    const q = list[idx], value = p.data.value.trim();
    if (value.length > q.max) return res.status(400).json({ ok: false, error: `Keep this answer under ${q.max} characters.` });
    if (q.required && value.length < 2) return res.status(400).json({ ok: false, error: 'This question needs an answer.' });
    const row = ensure(req), answers = safe(row.answers_json, {}), prev = answers[q.key];
    const history = prev?.value && prev.value !== value ? [...(prev.history || []), { value: prev.value, updated_at: prev.updated_at, source: prev.source }].slice(-5) : prev?.history || [];
    answers[q.key] = { value, source: p.data.source, language: p.data.language, updated_at: iso(), updated_by: req.saas.user_id, history };
    // Move on to the next unanswered question after this one (a correction keeps the owner where they were).
    const correcting = idx < row.step;
    let next = correcting ? row.step : idx + 1;
    while (!correcting && next < list.length && answers[list[next].key]?.value) next++;
    const r = db.prepare('UPDATE onboarding_sessions SET answers_json=?,step=?,language=COALESCE(?,language),status=CASE WHEN status=\'answered\' THEN \'answered\' ELSE \'in_progress\' END,revision=revision+1,updated_by=?,updated_at=? WHERE organisation_id=? AND revision=?')
      .run(JSON.stringify(answers), next, p.data.language, req.saas.user_id, iso(), req.saas.organisation_id, p.data.revision);
    if (!r.changes) return res.status(409).json({ ok: false, error: 'Someone else saved an answer at the same time. Reload to see the latest.', session: view(load(req.saas.organisation_id), list) });
    saasAudit(req, prev?.value ? 'onboarding.answer_corrected' : 'onboarding.answer_saved', 'onboarding_session', req.saas.organisation_id, { question: q.key, source: p.data.source, language: p.data.language });
    res.json({ ok: true, ...payload(req) });
  });

  const stepSchema = z.object({ step: z.number().int().min(0), revision: z.number().int().positive() }).strict();
  app.put('/api/saas/onboarding/interview/step', ...manage, (req, res) => {
    const list = qs(req), p = stepSchema.safeParse(req.body ?? {});
    if (!p.success || p.data.step > list.length) return res.status(400).json({ ok: false, error: 'Choose a question.' });
    ensure(req);
    const r = db.prepare('UPDATE onboarding_sessions SET step=?,revision=revision+1,updated_by=?,updated_at=? WHERE organisation_id=? AND revision=?').run(p.data.step, req.saas.user_id, iso(), req.saas.organisation_id, p.data.revision);
    if (!r.changes) return res.status(409).json({ ok: false, error: 'This changed somewhere else. Reload to continue.', session: view(load(req.saas.organisation_id), list) });
    res.json({ ok: true, ...payload(req) });
  });

  app.post('/api/saas/onboarding/interview/finish', ...manage, (req, res) => {
    const list = qs(req), row = ensure(req), v = view(row, list);
    if (v.missing_required.length) return res.status(400).json({ ok: false, error: 'Answer the required questions first.', missing: v.missing_required });
    db.prepare("UPDATE onboarding_sessions SET status='answered',step=?,revision=revision+1,updated_by=?,updated_at=? WHERE organisation_id=?").run(list.length, req.saas.user_id, iso(), req.saas.organisation_id);
    saasAudit(req, 'onboarding.interview_finished', 'onboarding_session', req.saas.organisation_id, { answered: v.answered });
    res.json({ ok: true, ...payload(req) });
  });

  return { answers: (org) => safe(load(org)?.answers_json, {}), status: (org) => load(org)?.status || null };
}
