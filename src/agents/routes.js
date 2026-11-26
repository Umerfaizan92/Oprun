// TR-40: operator routes for the agent registry. Reading needs operations read; creating or changing an agent
// (which changes what automation may do) needs operations approve, or the founder.
import { z } from 'zod';
import { publicCatalogue } from '../automation/catalogue.js';

export function installAgentRoutes(app, { registry, platform, supervisor = null }) {
  const actor = (req) => ({ id: req.platform.id, name: req.platform.name || 'Founder', role: req.platform.role });
  const send = (res, r, ok = 200) => (r.ok ? res.status(ok).json(r) : res.status(r.status || 400).json({ ok: false, error: r.error }));
  const read = [platform.identity, platform.permit('operations', 'read')];
  const approve = [platform.identity, platform.permit('operations', 'approve')];

  app.get('/api/operator/agents', ...read, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const eligible = publicCatalogue('platform').filter((a) => registry.agentEligible(a.key).ok).map((a) => ({ key: a.key, label: a.label, level: a.level, triggers: a.triggers }));
    res.json({ ok: true, agents: registry.list(), eligible_actions: eligible, can_manage: platform.can(req, 'operations', 'approve') });
  });
  app.post('/api/operator/agents', ...approve, (req, res) => {
    const r = registry.create(req.body, actor(req));
    if (r.ok) platform.log(req.platform.id, 'agent.created', 'operations', r.id);
    send(res, r, 201);
  });
  app.put('/api/operator/agents/:id', ...approve, (req, res) => {
    const r = registry.update(req.params.id, req.body, actor(req));
    if (r.ok) platform.log(req.platform.id, 'agent.updated', 'operations', req.params.id);
    send(res, r);
  });
  // TR-42: Agent Command Center data and escalation handling.
  app.get('/api/operator/agents/center', ...read, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, ...registry.center(), supervisor: supervisor ? supervisor.status() : null, can_approve: platform.can(req, 'operations', 'approve'), can_run: platform.can(req, 'operations', 'edit') });
  });
  // MB-13: run the AI Supervisor's checks now (it also runs on every automation tick). It only reads and records.
  app.post('/api/operator/agents/supervisor/check', platform.identity, platform.permit('operations', 'edit'), (req, res) => {
    if (!supervisor) return res.status(404).json({ ok: false, error: 'The AI Supervisor is not available.' });
    const r = supervisor.tick();
    res.json({ ok: true, result: { overdue: r.overdue.length, dead_jobs: r.dead_jobs, failing_agents: r.failing_agents }, supervisor: supervisor.status() });
  });
  app.post('/api/operator/agents/escalations/:id', platform.identity, platform.permit('operations', 'edit'), (req, res) => {
    const p = z.object({ action: z.enum(['acknowledge', 'resolve']), note: z.string().trim().max(1000).default('') }).strict().safeParse(req.body ?? {});
    if (!p.success) return res.status(400).json({ ok: false, error: 'Choose acknowledge or resolve.' });
    if (p.data.action === 'resolve' && p.data.note.length < 5) return res.status(400).json({ ok: false, error: 'Say what was done before resolving.' });
    const r = registry.actOnEscalation(req.params.id, p.data.action, p.data.note, actor(req));
    if (r.ok) platform.log(req.platform.id, 'agent.escalation_' + r.status, 'operations', req.params.id);
    send(res, r);
  });
  const jobSchema = z.object({ name: z.string().trim().max(120).optional(), action: z.string().max(80), params: z.record(z.string(), z.any()).default({}), trigger: z.string().max(40).nullable().default(null), activate: z.boolean().default(true) }).strict();
  app.post('/api/operator/agents/:id/jobs', ...approve, (req, res) => {
    const p = jobSchema.safeParse(req.body ?? {});
    if (!p.success) return res.status(400).json({ ok: false, error: 'Choose an action for the agent.' });
    const r = registry.addJob(req.params.id, p.data, actor(req));
    if (r.ok) platform.log(req.platform.id, 'agent.job_added', 'operations', req.params.id);
    send(res, r, 201);
  });
}
