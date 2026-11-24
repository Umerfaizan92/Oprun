// TR-40: AI agent registry, built on the automation engine (src/automation/) and the job queue (src/job-queue.js).
// An agent is a named, owned bundle of platform automations. Each agent records:
//   owner, responsibilities, allowed catalogue actions (its permissions), schedule, deadline per run,
//   retry limit, timeout and escalation contact.
// Its work runs as ordinary platform automation workflows tagged with the agent. The engine asks guard(run) before
// analysing and again before acting; anything not on the agent's list, or any run while the agent is paused, is
// blocked and audited. Restricted, manual-only and business-scope actions can never be put on an agent's list.
import crypto from 'node:crypto';
import { z } from 'zod';
import { ACTIONS } from '../automation/catalogue.js';

export const SCHEDULES = ['schedule.hourly', 'schedule.daily', 'schedule.weekly', 'schedule.monthly', 'manual'];
const iso = (t = Date.now()) => new Date(t).toISOString();
const safe = (s, f) => { try { return JSON.parse(s); } catch { return f; } };

// Which catalogue actions an agent may be given at all.
export function agentEligible(key) {
  const a = ACTIONS[key];
  if (!a) return { ok: false, reason: `Unknown action "${key}".` };
  if (a.restricted || a.level >= 4) return { ok: false, reason: `"${a.label}" is restricted. No agent may do it.` };
  if ((a.scope || 'business') !== 'platform') return { ok: false, reason: `"${a.label}" belongs to subscriber workspaces, not Oprun's own agents.` };
  if (a.manual) return { ok: false, reason: `"${a.label}" is done by a person. An agent can only remind someone.` };
  return { ok: true, action: a };
}

export function createAgentRegistry({ db, engine, clock = () => Date.now(), log = () => {} }) {
  db.exec(`CREATE TABLE IF NOT EXISTS platform_agents(id TEXT PRIMARY KEY,agent_key TEXT NOT NULL UNIQUE,name TEXT NOT NULL,owner_id TEXT NOT NULL,responsibilities TEXT NOT NULL DEFAULT '',allowed_actions_json TEXT NOT NULL DEFAULT '[]',schedule TEXT NOT NULL DEFAULT 'manual',deadline_minutes INTEGER NOT NULL DEFAULT 60,max_attempts INTEGER NOT NULL DEFAULT 3,timeout_seconds INTEGER NOT NULL DEFAULT 120,escalation_contact TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
  const cols = new Set(db.prepare('PRAGMA table_info(automation_workflows)').all().map((c) => c.name));
  if (!cols.has('agent_id')) db.exec('ALTER TABLE automation_workflows ADD COLUMN agent_id TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS automation_workflows_agent ON automation_workflows(agent_id)');
  // TR-42: escalations. One per run and kind; the escalation contact is told through the console notifications and,
  // for staff, an assignment in their My work.
  db.exec(`CREATE TABLE IF NOT EXISTS platform_agent_escalations(id TEXT PRIMARY KEY,agent_id TEXT NOT NULL REFERENCES platform_agents(id),run_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('failed','blocked','overdue')),reason TEXT NOT NULL,contact_id TEXT NOT NULL,assignment_id TEXT,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved')),note TEXT NOT NULL DEFAULT '',acted_by TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(run_id,kind));
 CREATE INDEX IF NOT EXISTS platform_agent_escalations_status ON platform_agent_escalations(status,created_at);`);

  const row = (id) => db.prepare('SELECT * FROM platform_agents WHERE id=?').get(id);
  const view = (a) => a && { id: a.id, key: a.agent_key, name: a.name, owner_id: a.owner_id, responsibilities: a.responsibilities, allowed_actions: safe(a.allowed_actions_json, []),
    schedule: a.schedule, deadline_minutes: a.deadline_minutes, max_attempts: a.max_attempts, timeout_seconds: a.timeout_seconds, escalation_contact: a.escalation_contact, status: a.status, revision: a.revision, created_at: a.created_at, updated_at: a.updated_at };

  // Called by the engine. Runs that do not belong to an agent are not affected.
  function guard(run) {
    if (!run?.workflow_id) return { ok: true };
    const w = db.prepare('SELECT agent_id FROM automation_workflows WHERE id=?').get(run.workflow_id);
    if (!w?.agent_id) return { ok: true };
    const a = row(w.agent_id);
    if (!a) return { ok: false, reason: 'The agent that owned this automation no longer exists.' };
    const base = { agent: a.agent_key, max_attempts: a.max_attempts, timeout_seconds: a.timeout_seconds };
    if (a.status !== 'active') return { ...base, ok: false, reason: `Agent "${a.name}" is paused.` };
    const allowed = safe(a.allowed_actions_json, []);
    if (!allowed.includes(run.action)) return { ...base, ok: false, reason: `Agent "${a.name}" is not allowed to run "${ACTIONS[run.action]?.label || run.action}".` };
    if (!agentEligible(run.action).ok) return { ...base, ok: false, reason: agentEligible(run.action).reason };
    return { ...base, ok: true };
  }

  const people = (id) => { if (id === 'founder') return true; try { return !!db.prepare("SELECT 1 FROM platform_users WHERE id=? AND status='active'").get(id); } catch { return false; } };
  const fields = {
    name: z.string().trim().min(2).max(80),
    owner_id: z.string().min(1).max(80),
    responsibilities: z.string().trim().max(2000),
    allowed_actions: z.array(z.string().max(80)).max(30),
    schedule: z.enum(SCHEDULES),
    deadline_minutes: z.number().int().min(1).max(10080),
    max_attempts: z.number().int().min(1).max(5),
    timeout_seconds: z.number().int().min(5).max(3600),
    escalation_contact: z.string().min(1).max(80)
  };
  const createSchema = z.object({ key: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/), ...fields, responsibilities: fields.responsibilities.default(''), allowed_actions: fields.allowed_actions.default([]), schedule: fields.schedule.default('manual'),
    deadline_minutes: fields.deadline_minutes.default(60), max_attempts: fields.max_attempts.default(3), timeout_seconds: fields.timeout_seconds.default(120) }).strict();
  const updateSchema = z.object({ ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])), status: z.enum(['active', 'paused']).optional(), revision: z.number().int().positive() }).strict();

  function checkFields(d) {
    if (d.owner_id !== undefined && !people(d.owner_id)) return 'The owner must be the founder or an active Oprun staff member.';
    if (d.escalation_contact !== undefined && !people(d.escalation_contact)) return 'The escalation contact must be the founder or an active Oprun staff member.';
    for (const k of d.allowed_actions || []) { const e = agentEligible(k); if (!e.ok) return e.reason; }
    return null;
  }

  function create(body, actor) {
    const p = createSchema.safeParse(body ?? {});
    if (!p.success) return { ok: false, status: 400, error: 'Check the agent details: ' + p.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ') };
    const problem = checkFields(p.data); if (problem) return { ok: false, status: 400, error: problem };
    if (db.prepare('SELECT 1 FROM platform_agents WHERE agent_key=?').get(p.data.key)) return { ok: false, status: 409, error: 'An agent with this key already exists.' };
    const id = crypto.randomUUID(), t = iso(clock()), d = p.data;
    db.prepare('INSERT INTO platform_agents(id,agent_key,name,owner_id,responsibilities,allowed_actions_json,schedule,deadline_minutes,max_attempts,timeout_seconds,escalation_contact,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, d.key, d.name, d.owner_id, d.responsibilities, JSON.stringify([...new Set(d.allowed_actions)]), d.schedule, d.deadline_minutes, d.max_attempts, d.timeout_seconds, d.escalation_contact, actor.id, t, t);
    return { ok: true, id };
  }

  function update(id, body, actor) {
    const a = row(id); if (!a) return { ok: false, status: 404, error: 'Agent not found.' };
    const p = updateSchema.safeParse(body ?? {});
    if (!p.success) return { ok: false, status: 400, error: 'Check the agent details.' };
    const problem = checkFields(p.data); if (problem) return { ok: false, status: 400, error: problem };
    const d = p.data, cur = view(a);
    if (d.allowed_actions) {
      // Removing an action the agent's live automations use would leave them blocked; say which ones instead.
      const used = db.prepare("SELECT name,action FROM automation_workflows WHERE agent_id=? AND status='active'").all(id).filter((w) => !d.allowed_actions.includes(w.action));
      if (used.length) return { ok: false, status: 409, error: `Pause or archive these automations first: ${used.map((w) => w.name).join(', ')}.` };
    }
    const r = db.prepare('UPDATE platform_agents SET name=?,owner_id=?,responsibilities=?,allowed_actions_json=?,schedule=?,deadline_minutes=?,max_attempts=?,timeout_seconds=?,escalation_contact=?,status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
      .run(d.name ?? cur.name, d.owner_id ?? cur.owner_id, d.responsibilities ?? cur.responsibilities, JSON.stringify(d.allowed_actions ? [...new Set(d.allowed_actions)] : cur.allowed_actions), d.schedule ?? cur.schedule,
        d.deadline_minutes ?? cur.deadline_minutes, d.max_attempts ?? cur.max_attempts, d.timeout_seconds ?? cur.timeout_seconds, d.escalation_contact ?? cur.escalation_contact, d.status ?? cur.status, iso(clock()), id, d.revision);
    if (!r.changes) return { ok: false, status: 409, error: 'Someone else changed this agent. Reload and try again.' };
    return { ok: true };
  }

  // Give an agent a job: a platform automation with one of its allowed actions, on the agent's schedule.
  function addJob(id, { name, action, params = {}, trigger = null, activate = true }, actor) {
    const a = row(id); if (!a) return { ok: false, status: 404, error: 'Agent not found.' };
    if (!safe(a.allowed_actions_json, []).includes(action)) return { ok: false, status: 403, error: `Agent "${a.name}" is not allowed to run "${ACTIONS[action]?.label || action}". Add it to the agent's actions first.` };
    const t = trigger || (ACTIONS[action].triggers.includes(a.schedule) ? a.schedule : ACTIONS[action].triggers.find((x) => x.startsWith('schedule.')) || 'manual');
    const w = engine.createWorkflow({ scope: 'platform', org: null, name: String(name || `${a.name}: ${ACTIONS[action].label}`).slice(0, 120), definition: { trigger: t, action, params }, actor, note: `Agent ${a.agent_key}` });
    if (!w.ok) return w;
    db.prepare('UPDATE automation_workflows SET agent_id=? WHERE id=?').run(id, w.id);
    if (activate) engine.setWorkflowStatus(engine.workflow(w.id, 'platform', null), 'active', actor);
    return { ok: true, id: w.id, trigger: t };
  }

  function list() {
    const agents = db.prepare('SELECT * FROM platform_agents ORDER BY name COLLATE NOCASE').all().map(view);
    const jobs = db.prepare("SELECT id,agent_id,name,action,trigger_type,status,last_run_at,last_status FROM automation_workflows WHERE agent_id IS NOT NULL AND status<>'archived' ORDER BY created_at").all();
    const now = clock();
    for (const a of agents) {
      // Each job shows its own latest result: the report it wrote, or why it did nothing.
      const lastOf = (wid) => {
        const r = db.prepare('SELECT id,action,status,error,created_at,updated_at FROM automation_runs WHERE workflow_id=? AND dry_run=0 ORDER BY created_at DESC LIMIT 1').get(wid);
        if (r) r.output = db.prepare('SELECT kind,title,body FROM automation_outputs WHERE run_id=? ORDER BY created_at DESC LIMIT 1').get(r.id) || null;
        return r || null;
      };
      a.jobs = jobs.filter((j) => j.agent_id === a.id).map(({ agent_id, ...j }) => ({ ...j, action_label: ACTIONS[j.action]?.label || j.action, last_run: lastOf(j.id) }));
      const last = db.prepare('SELECT r.id,r.action,r.status,r.error,r.created_at,r.updated_at FROM automation_runs r JOIN automation_workflows w ON w.id=r.workflow_id WHERE w.agent_id=? AND r.dry_run=0 ORDER BY r.created_at DESC LIMIT 1').get(a.id);
      if (last) {
        const out = db.prepare('SELECT kind,title,body FROM automation_outputs WHERE run_id=? ORDER BY created_at DESC LIMIT 1').get(last.id);
        last.output = out || null;
      }
      a.last_run = last || null;
      // Past its deadline: a run that is still not finished after deadline_minutes.
      a.overdue_runs = db.prepare("SELECT COUNT(*) n FROM automation_runs r JOIN automation_workflows w ON w.id=r.workflow_id WHERE w.agent_id=? AND r.status IN ('received','queued','executing','approved') AND r.created_at<?").get(a.id, iso(now - a.deadline_minutes * 60000)).n;
    }
    return agents;
  }

  // ---------------- TR-42: escalation and the command centre ----------------
  const agentOfWorkflow = (wid) => { const w = wid ? db.prepare('SELECT agent_id FROM automation_workflows WHERE id=?').get(wid) : null; return w?.agent_id ? row(w.agent_id) : null; };
  function escalate(run, kind, reason) {
    const a = agentOfWorkflow(run.workflow_id); if (!a) return null;
    const id = crypto.randomUUID(), t = iso(clock());
    const ins = db.prepare('INSERT OR IGNORE INTO platform_agent_escalations(id,agent_id,run_id,kind,reason,contact_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id, a.id, run.id, kind, String(reason || 'No detail given.').slice(0, 1000), a.escalation_contact, t, t);
    if (!ins.changes) return null;
    // Staff contacts get it as high-priority work due today (TR-32 assignments), when that module is installed.
    if (a.escalation_contact !== 'founder') {
      try {
        const rid = crypto.randomUUID(), label = ACTIONS[run.action]?.label || run.action;
        db.transaction(() => {
          db.prepare("INSERT INTO platform_records(id,kind,title,body,status,assigned_to,created_by,created_at,updated_at,due_on,priority,assigned_by,assigned_at,work_state) VALUES (?,'task',?,?,'open',?,'automation',?,?,?,'high','automation',?,'assigned')")
            .run(rid, `Agent ${a.name}: ${label} ${kind === 'overdue' ? 'is late' : kind}`.slice(0, 200), `${reason}\n\nOpen Operations → AI agents → Command center for details.`, a.escalation_contact, t, t, t.slice(0, 10), t);
          db.prepare("INSERT INTO platform_assignment_events(id,record_id,actor,action,note,created_at) VALUES (?,?,'automation','assigned',?,?)").run(crypto.randomUUID(), rid, 'Raised by the agent manager.', t);
          db.prepare('UPDATE platform_agent_escalations SET assignment_id=? WHERE id=?').run(rid, id);
        })();
      } catch { /* assignments not installed: the console notification still goes out */ }
    }
    log('automation', 'agent.escalated', 'operations', id);
    return id;
  }
  function onRunStatus(run, status) {
    if (!run) return;
    if (status === 'failed' || status === 'verification_failed') escalate(run, 'failed', run.error || 'The run failed.');
    else if (status === 'blocked') escalate(run, 'blocked', run.error || 'The run was blocked.');
  }
  function sweepOverdue() {
    const t = clock(), raised = [];
    for (const a of db.prepare("SELECT * FROM platform_agents WHERE status='active'").all()) {
      const late = db.prepare("SELECT r.* FROM automation_runs r JOIN automation_workflows w ON w.id=r.workflow_id WHERE w.agent_id=? AND r.dry_run=0 AND r.status IN ('received','queued','executing','approved') AND r.created_at<?").all(a.id, iso(t - a.deadline_minutes * 60000));
      for (const r of late) { const id = escalate(r, 'overdue', `Not finished within ${a.deadline_minutes} minutes (status: ${r.status}).`); if (id) raised.push(id); }
    }
    return raised;
  }
  function actOnEscalation(id, action, note, actor) {
    const e = db.prepare('SELECT * FROM platform_agent_escalations WHERE id=?').get(id);
    if (!e) return { ok: false, status: 404, error: 'Escalation not found.' };
    const next = action === 'resolve' ? 'resolved' : 'acknowledged';
    if (e.status === 'resolved' || (e.status === next)) return { ok: false, status: 409, error: 'Already ' + e.status + '.' };
    db.prepare('UPDATE platform_agent_escalations SET status=?,note=?,acted_by=?,updated_at=? WHERE id=?').run(next, String(note || '').slice(0, 1000), actor.id, iso(clock()), id);
    return { ok: true, status: next };
  }
  function center() {
    const t = clock(), day = iso(t - 86400000), week = iso(t - 7 * 86400000);
    const agentRuns = "FROM automation_runs r JOIN automation_workflows w ON w.id=r.workflow_id JOIN platform_agents a ON a.id=w.agent_id WHERE r.dry_run=0";
    const pick = 'r.id,r.action,r.status,r.error,r.level,r.approval_id,r.created_at,r.updated_at,a.name agent,a.agent_key agent_key';
    const label = (x) => ({ ...x, action_label: ACTIONS[x.action]?.label || x.action });
    const queue = db.prepare(`SELECT ${pick} ${agentRuns} AND r.status IN ('received','queued','executing','approved','held') ORDER BY r.created_at`).all().map(label);
    const waiting = db.prepare(`SELECT ${pick},p.title,p.summary,p.risk_level,p.policy_level,p.expires_at,p.reference_code ${agentRuns.replace('WHERE', 'JOIN platform_approvals p ON p.id=r.approval_id WHERE')} AND r.status='awaiting_approval' AND p.status IN ('pending','clarification_requested') ORDER BY r.created_at`).all().map(label);
    const failed = db.prepare(`SELECT ${pick} ${agentRuns} AND r.status IN ('failed','verification_failed','blocked') AND r.updated_at>=? ORDER BY r.updated_at DESC LIMIT 50`).all(week).map(label);
    const names = new Map([['founder', 'Founder'], ...(() => { try { return db.prepare('SELECT id,name FROM platform_users').all().map((u) => [u.id, u.name]); } catch { return []; } })()]);
    const escalations = db.prepare("SELECT e.*,a.name agent FROM platform_agent_escalations e JOIN platform_agents a ON a.id=e.agent_id WHERE e.status<>'resolved' OR e.updated_at>=? ORDER BY CASE e.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END, e.created_at DESC LIMIT 100").all(week)
      .map((e) => ({ id: e.id, agent: e.agent, run_id: e.run_id, kind: e.kind, reason: e.reason, contact: names.get(e.contact_id) || 'Former staff member', status: e.status, note: e.note, created_at: e.created_at, assigned: !!e.assignment_id }));
    const performance = db.prepare(`SELECT a.id,a.name,a.agent_key key,a.status,
        SUM(CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) runs,
        SUM(CASE WHEN r.status IN ('completed','completed_warning','skipped') THEN 1 ELSE 0 END) ok,
        SUM(CASE WHEN r.status IN ('failed','verification_failed','blocked') THEN 1 ELSE 0 END) bad,
        AVG(CASE WHEN r.executed_at IS NOT NULL THEN (julianday(r.updated_at)-julianday(r.created_at))*86400 END) avg_seconds,
        MAX(CASE WHEN r.status IN ('failed','verification_failed','blocked') THEN r.updated_at END) last_failure
      FROM platform_agents a LEFT JOIN automation_workflows w ON w.agent_id=a.id LEFT JOIN automation_runs r ON r.workflow_id=w.id AND r.dry_run=0 AND r.created_at>=?
      GROUP BY a.id ORDER BY a.name COLLATE NOCASE`).all(week).map((p) => ({ ...p, success_rate: p.runs ? Math.round(((p.ok || 0) / p.runs) * 100) : null, avg_seconds: p.avg_seconds == null ? null : Math.round(p.avg_seconds * 10) / 10 }));
    const counts = {
      queued: queue.filter((r) => r.status !== 'executing').length, running: queue.filter((r) => r.status === 'executing').length,
      waiting_approval: waiting.length, failed_24h: failed.filter((r) => r.updated_at >= day).length,
      escalated_open: escalations.filter((e) => e.status === 'open').length,
      runs_7d: performance.reduce((n, p) => n + (p.runs || 0), 0), success_7d: performance.reduce((n, p) => n + (p.ok || 0), 0)
    };
    return { counts, queue, waiting, failed, escalations, performance };
  }

  // TR-41: create any standard agent that does not exist yet, with its jobs switched on. Existing agents are left alone.
  function ensureDefaults(defaults, actor = { id: 'founder', name: 'Founder', role: 'founder' }) {
    const created = [];
    for (const d of defaults) {
      if (db.prepare('SELECT 1 FROM platform_agents WHERE agent_key=?').get(d.key)) continue;
      const r = create({ key: d.key, name: d.name, owner_id: 'founder', escalation_contact: 'founder', responsibilities: d.responsibilities, allowed_actions: d.jobs, schedule: d.schedule }, actor);
      if (!r.ok) throw new Error(`Agent ${d.key}: ${r.error}`);
      for (const action of d.jobs) { const j = addJob(r.id, { action }, actor); if (!j.ok) throw new Error(`Agent ${d.key} job ${action}: ${j.error}`); }
      created.push(d.key);
    }
    return created;
  }

  return { ensureDefaults, guard, escalate, onRunStatus, sweepOverdue, actOnEscalation, center, create, update, addJob, list, get: (id) => view(row(id)), byKey: (key) => view(db.prepare('SELECT * FROM platform_agents WHERE agent_key=?').get(key)), agentEligible };
}
