// MB-13: the AI Supervisor. One overseer above the agent registry (src/agents/registry.js) and the job queue.
// It watches; it never approves, executes or changes business data. On every automation tick it:
//   1. records a heartbeat, so the console can show when supervision itself has stopped;
//   2. runs the registry's overdue sweep (late runs escalate to the agent's contact, as before);
//   3. raises findings for background jobs that failed permanently and for agents that keep failing,
//      and resolves those findings by itself once the cause has gone;
//   4. writes one summary per UTC day.
// Through guard() it also stops duplicate work: a run for an agent workflow that already has an earlier run in
// progress is skipped (not blocked), so overlapping schedules cannot pile up or act twice.
import crypto from 'node:crypto';

export const ACTIVE = ['received', 'queued', 'executing', 'approved', 'held', 'awaiting_approval'];
export const STALE_AFTER_MS = 5 * 60 * 1000;
export const FAILURE_THRESHOLD = 3; // failed or blocked runs of one agent in 24 hours

export function createSupervisor({ db, registry, clock = () => Date.now(), log = () => {} }) {
  db.exec(`CREATE TABLE IF NOT EXISTS platform_supervisor_state(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS platform_supervisor_findings(id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('dead_job','repeated_failures')),
      subject TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
      first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, resolved_at TEXT, UNIQUE(kind, subject));
    CREATE TABLE IF NOT EXISTS platform_supervisor_reports(day TEXT PRIMARY KEY, summary_json TEXT NOT NULL, created_at TEXT NOT NULL);`);
  const iso = (t = clock()) => new Date(t).toISOString();
  const state = (key) => db.prepare('SELECT value FROM platform_supervisor_state WHERE key=?').get(key)?.value || null;
  const setState = (key, value) => db.prepare('INSERT INTO platform_supervisor_state(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(key, value, iso());
  const has = (table) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));

  function guard(run) {
    if (run?.workflow_id && has('automation_workflows')) {
      const owned = db.prepare('SELECT agent_id FROM automation_workflows WHERE id=?').get(run.workflow_id)?.agent_id;
      if (owned) {
        const earlier = db.prepare(`SELECT id FROM automation_runs WHERE workflow_id=? AND id<>? AND dry_run=0 AND status IN (${ACTIVE.map(() => '?').join(',')})
          AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at LIMIT 1`).get(run.workflow_id, run.id, ...ACTIVE, run.created_at, run.created_at, run.id);
        if (earlier) return { ok: false, skip: true, reason: `Skipped by the AI Supervisor: the previous run of this job (${earlier.id}) is still in progress.` };
      }
    }
    return registry.guard(run);
  }

  // A finding stays one row per cause; seeing it again only updates last_seen.
  function raise(kind, subject, title, detail) {
    const t = iso(), cur = db.prepare('SELECT id,status FROM platform_supervisor_findings WHERE kind=? AND subject=?').get(kind, subject);
    if (!cur) { const id = crypto.randomUUID(); db.prepare('INSERT INTO platform_supervisor_findings(id,kind,subject,title,detail,first_seen,last_seen) VALUES (?,?,?,?,?,?,?)').run(id, kind, subject, title, detail, t, t); log('automation', 'supervisor.finding', 'operations', id); return id; }
    db.prepare("UPDATE platform_supervisor_findings SET status='open',title=?,detail=?,last_seen=?,resolved_at=NULL WHERE id=?").run(title, detail, t, cur.id);
    return cur.status === 'resolved' ? cur.id : null;
  }
  function resolveExcept(kind, subjects) {
    const open = db.prepare("SELECT id,subject FROM platform_supervisor_findings WHERE kind=? AND status='open'").all(kind);
    for (const f of open) if (!subjects.has(f.subject)) db.prepare("UPDATE platform_supervisor_findings SET status='resolved',resolved_at=? WHERE id=?").run(iso(), f.id);
  }

  function checkDeadJobs() {
    const seen = new Set();
    if (!has('background_jobs')) return seen;
    for (const j of db.prepare("SELECT id,type,organisation_id,attempts,last_error,updated_at FROM background_jobs WHERE status='dead' AND updated_at>=? ORDER BY updated_at DESC LIMIT 200").all(iso(clock() - 7 * 86400000))) {
      seen.add(j.id);
      raise('dead_job', j.id, `Background job "${j.type}" gave up after ${j.attempts} attempt(s)`, `${String(j.last_error || 'No error recorded.').slice(0, 400)}${j.organisation_id ? ` (business ${j.organisation_id})` : ''}. Retry it from Reliability & backups once the cause is fixed.`);
    }
    resolveExcept('dead_job', seen);
    return seen;
  }

  function checkRepeatedFailures() {
    const seen = new Set();
    if (!has('platform_agents') || !has('automation_runs')) return seen;
    const rows = db.prepare(`SELECT a.id,a.name,COUNT(*) n,MAX(r.updated_at) last FROM automation_runs r JOIN automation_workflows w ON w.id=r.workflow_id JOIN platform_agents a ON a.id=w.agent_id
      WHERE r.dry_run=0 AND r.status IN ('failed','verification_failed','blocked') AND r.updated_at>=? GROUP BY a.id HAVING n>=?`).all(iso(clock() - 86400000), FAILURE_THRESHOLD);
    for (const a of rows) { seen.add(a.id); raise('repeated_failures', a.id, `Agent ${a.name} failed ${a.n} times in 24 hours`, `Last failure ${a.last}. Check its failed runs in the command centre; pause the agent if the cause is not clear.`); }
    resolveExcept('repeated_failures', seen);
    return seen;
  }

  function summary() {
    const c = registry.center().counts;
    const open = db.prepare("SELECT kind,COUNT(*) n FROM platform_supervisor_findings WHERE status='open' GROUP BY kind").all();
    return { runs_7d: c.runs_7d, success_7d: c.success_7d, failed_24h: c.failed_24h, waiting_approval: c.waiting_approval, escalated_open: c.escalated_open, open_findings: Object.fromEntries(open.map((r) => [r.kind, r.n])) };
  }

  function tick() {
    const out = { overdue: [], dead_jobs: 0, failing_agents: 0, report: null };
    setState('last_tick_at', iso());
    try { out.overdue = registry.sweepOverdue() || []; } catch (e) { log('automation', 'supervisor.sweep_failed', 'operations', String(e.message).slice(0, 80)); }
    out.dead_jobs = checkDeadJobs().size;
    out.failing_agents = checkRepeatedFailures().size;
    const day = iso().slice(0, 10);
    if (!db.prepare('SELECT 1 FROM platform_supervisor_reports WHERE day=?').get(day)) {
      const s = summary();
      db.prepare('INSERT OR IGNORE INTO platform_supervisor_reports(day,summary_json,created_at) VALUES (?,?,?)').run(day, JSON.stringify(s), iso());
      out.report = day;
    }
    return out;
  }

  function status() {
    const last = state('last_tick_at'), age = last ? clock() - Date.parse(last) : null;
    const findings = db.prepare("SELECT id,kind,subject,title,detail,status,first_seen,last_seen,resolved_at FROM platform_supervisor_findings WHERE status='open' OR resolved_at>=? ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, last_seen DESC LIMIT 50").all(iso(clock() - 7 * 86400000));
    const report = db.prepare('SELECT day,summary_json FROM platform_supervisor_reports ORDER BY day DESC LIMIT 1').get();
    return {
      last_check_at: last, running: age !== null && age <= STALE_AFTER_MS,
      message: last === null ? 'The supervisor has not run yet.' : age > STALE_AFTER_MS ? `The supervisor last checked ${Math.round(age / 60000)} minutes ago. Background automation may have stopped; check Platform health.` : 'The supervisor is checking every minute.',
      findings, open_findings: findings.filter((f) => f.status === 'open').length,
      daily: report ? { day: report.day, ...JSON.parse(report.summary_json) } : null
    };
  }

  return { guard, tick, status };
}
