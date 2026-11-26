// MB-13: the AI Supervisor above the agent registry. It skips duplicate runs, raises and clears findings for
// background jobs that gave up and agents that keep failing, records a heartbeat and one daily summary, and never
// approves or executes anything itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createDb, appendAuditLog } from '../src/db.js';
import { createJobQueue } from '../src/job-queue.js';
import { createAutomationEngine } from '../src/automation/engine.js';
import { ACTIONS } from '../src/automation/catalogue.js';
import { createAgentRegistry } from '../src/agents/registry.js';
import { createSupervisor, STALE_AFTER_MS } from '../src/agents/supervisor.js';

const founder = { id: 'founder', name: 'Founder', role: 'founder' };
const base = { scope: 'platform', effect: 'output', triggers: ['manual', 'schedule.hourly'], params: z.object({}).strict(), analyse: () => ({}), schema: z.object({}), preview: () => ({ description: 'Test step', expected_outcome: 'x' }), verify: () => ({ ok: true }) };

function harness() {
  let now = Date.parse('2026-11-26T02:00:00.000Z');
  const clock = () => now;
  const db = createDb(':memory:');
  db.exec(`CREATE TABLE platform_users(id TEXT PRIMARY KEY,name TEXT,status TEXT DEFAULT 'active');`);
  const queue = createJobQueue({ db, clock, log: { error() {}, warn() {} } });
  let supervisor = null, registry = null;
  const engine = createAutomationEngine({ db, queue, clock, log: { warn() {} },
    deps: { appendAuditLog, agentGuard: (r) => supervisor.guard(r), onRunStatus: (r, st) => registry.onRunStatus(r, st), onTick: () => supervisor.tick() } });
  registry = createAgentRegistry({ db, engine, clock });
  supervisor = createSupervisor({ db, registry, clock });
  return { db, queue, engine, registry, supervisor, advance: (ms) => { now += ms; } };
}
const settle = async (h) => { await h.engine.idle(); await h.queue.drain(); await new Promise((r) => setTimeout(r, 10)); };

test('a second run of an agent job is skipped while the first is still in progress, without an escalation', async () => {
  const h = harness();
  let ran = 0;
  ACTIONS.test_sv_l3 = { ...base, label: 'Important change', level: 3, effect: 'internal_write', execute: () => { ran++; return { summary: 'done' }; } };
  try {
    const a = h.registry.create({ key: 'sv_l3', name: 'Billing', owner_id: 'founder', escalation_contact: 'founder', allowed_actions: ['test_sv_l3'] }, founder);
    const wf = h.engine.workflow(h.registry.addJob(a.id, { action: 'test_sv_l3' }, founder).id, 'platform', null);
    const first = h.engine.startRun(wf, { trigger: 'manual', key: 'one' }); await first.promise; await settle(h);
    assert.equal(h.engine.runRow(first.id).status, 'awaiting_approval', 'the first run waits for a person');
    h.advance(1000);
    const second = h.engine.startRun(wf, { trigger: 'manual', key: 'two' }); await second.promise; await settle(h);
    const row = h.engine.runRow(second.id);
    assert.equal(row.status, 'skipped'); assert.match(row.error, /Skipped by the AI Supervisor: the previous run of this job .* is still in progress/);
    assert.equal(h.db.prepare('SELECT COUNT(*) n FROM platform_agent_escalations').get().n, 0, 'a duplicate is not a failure');
    assert.equal(ran, 0, 'nothing ran: the supervisor cannot approve');
    assert.equal(h.engine.runRow(first.id).status, 'awaiting_approval', 'the first run is untouched');
    assert.deepEqual(Object.keys(h.supervisor).sort(), ['guard', 'status', 'tick'], 'the supervisor has no approve or execute function');
  } finally { delete ACTIONS.test_sv_l3; }
});

test('the registry rules still apply under the supervisor (a paused agent is blocked, not skipped)', async () => {
  const h = harness();
  ACTIONS.test_sv_ok = { ...base, label: 'Report', level: 1, execute: () => ({ summary: 'ok' }) };
  try {
    const a = h.registry.create({ key: 'sv_ok', name: 'Reports', owner_id: 'founder', escalation_contact: 'founder', allowed_actions: ['test_sv_ok'] }, founder);
    const wf = h.engine.workflow(h.registry.addJob(a.id, { action: 'test_sv_ok' }, founder).id, 'platform', null);
    let r = h.engine.startRun(wf, { trigger: 'manual', key: 'a' }); await r.promise; await settle(h);
    assert.equal(h.engine.runRow(r.id).status, 'completed');
    assert.equal(h.registry.update(a.id, { status: 'paused', revision: h.registry.get(a.id).revision }, founder).ok, true);
    r = h.engine.startRun(wf, { trigger: 'manual', key: 'b' }); await r.promise; await settle(h);
    assert.equal(h.engine.runRow(r.id).status, 'blocked');
  } finally { delete ACTIONS.test_sv_ok; }
});

test('findings: a background job that gave up and an agent failing 3 times in 24 hours; both clear by themselves', async () => {
  const h = harness();
  ACTIONS.test_sv_broken = { ...base, label: 'Broken check', level: 1, execute: () => { throw Object.assign(new Error('provider refused'), { permanent: true }); } };
  try {
    const t = new Date(Date.parse('2026-11-26T01:00:00.000Z')).toISOString();
    h.db.prepare("INSERT INTO background_jobs(id,type,payload_json,idempotency_key,status,attempts,max_attempts,run_at,last_error,created_at,updated_at) VALUES ('job-1','email.send','{}','k-job-1','dead',5,5,?,?,?,?)").run(t, 'SMTP 550 mailbox unavailable', t, t);
    const a = h.registry.create({ key: 'sv_broken', name: 'Integrations', owner_id: 'founder', escalation_contact: 'founder', allowed_actions: ['test_sv_broken'] }, founder);
    const wf = h.engine.workflow(h.registry.addJob(a.id, { action: 'test_sv_broken' }, founder).id, 'platform', null);
    for (const k of ['f1', 'f2', 'f3']) { const r = h.engine.startRun(wf, { trigger: 'manual', key: k }); await r.promise; await settle(h); h.advance(1000); }
    const out = h.supervisor.tick();
    assert.equal(out.dead_jobs, 1); assert.equal(out.failing_agents, 1);
    let s = h.supervisor.status();
    assert.equal(s.open_findings, 2);
    assert.ok(s.findings.some((f) => f.kind === 'dead_job' && /email\.send" gave up after 5 attempt/.test(f.title) && /SMTP 550/.test(f.detail)));
    assert.ok(s.findings.some((f) => f.kind === 'repeated_failures' && /Integrations failed 3 times in 24 hours/.test(f.title)));
    h.supervisor.tick(); assert.equal(h.db.prepare('SELECT COUNT(*) n FROM platform_supervisor_findings').get().n, 2, 'seeing a cause again does not duplicate it');
    // The job is retried and the failures age out: both findings resolve on the next check.
    h.db.prepare("UPDATE background_jobs SET status='succeeded' WHERE id='job-1'").run();
    h.advance(25 * 3600 * 1000);
    h.supervisor.tick(); s = h.supervisor.status();
    assert.equal(s.open_findings, 0); assert.equal(s.findings.filter((f) => f.status === 'resolved').length, 2);
  } finally { delete ACTIONS.test_sv_broken; }
});

test('heartbeat: the console can tell when supervision has stopped; one summary per day', () => {
  const h = harness();
  assert.equal(h.supervisor.status().running, false); assert.match(h.supervisor.status().message, /not run yet/);
  const first = h.supervisor.tick();
  assert.equal(first.report, '2026-11-26'); assert.equal(h.supervisor.status().running, true);
  assert.deepEqual(Object.keys(h.supervisor.status().daily).sort(), ['day', 'escalated_open', 'failed_24h', 'open_findings', 'runs_7d', 'success_7d', 'waiting_approval']);
  h.advance(60000); assert.equal(h.supervisor.tick().report, null, 'one summary per day');
  h.advance(STALE_AFTER_MS + 60000);
  const s = h.supervisor.status(); assert.equal(s.running, false); assert.match(s.message, /last checked 6 minutes ago/);
  h.advance(24 * 3600 * 1000); assert.equal(h.supervisor.tick().report, '2026-11-27');
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM platform_supervisor_reports').get().n, 2);
});
