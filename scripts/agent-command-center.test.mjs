// TR-42: Agent Command Center. Acceptance: failure → escalation notification; approvals required for level 3–4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createDb, appendAuditLog } from '../src/db.js';
import { createJobQueue } from '../src/job-queue.js';
import { createAutomationEngine } from '../src/automation/engine.js';
import { ACTIONS } from '../src/automation/catalogue.js';
import { createAgentRegistry } from '../src/agents/registry.js';

const founder = { id: 'founder', name: 'Founder', role: 'founder' };
const base = { scope: 'platform', effect: 'output', triggers: ['manual', 'schedule.hourly'], params: z.object({}).strict(), analyse: () => ({}), schema: z.object({}), preview: () => ({ description: 'Test step', expected_outcome: 'x' }), verify: () => ({ ok: true, detail: 'fine' }) };

function harness() {
  let now = Date.parse('2026-11-24T02:00:00.000Z');
  const clock = () => now;
  const db = createDb(':memory:');
  // Tables other modules own in production (staff, records and assignments), in their minimal form.
  db.exec(`CREATE TABLE platform_users(id TEXT PRIMARY KEY,name TEXT,status TEXT DEFAULT 'active');
    CREATE TABLE platform_records(id TEXT PRIMARY KEY,kind TEXT,title TEXT,body TEXT DEFAULT '',status TEXT,assigned_to TEXT,revision INTEGER DEFAULT 1,created_by TEXT,created_at TEXT,updated_at TEXT,due_on TEXT,priority TEXT,assigned_by TEXT,assigned_at TEXT,work_state TEXT);
    CREATE TABLE platform_assignment_events(id TEXT PRIMARY KEY,record_id TEXT,actor TEXT,action TEXT,note TEXT,created_at TEXT);`);
  db.prepare("INSERT INTO platform_users(id,name) VALUES ('u-tom','Tom Nguyen')").run();
  const notices = [];
  const queue = createJobQueue({ db, clock, log: { error() {}, warn() {} } });
  let registry = null;
  const engine = createAutomationEngine({ db, queue, clock, log: { warn() {} },
    deps: { appendAuditLog, agentGuard: (r) => registry.guard(r), onRunStatus: (r, st) => registry.onRunStatus(r, st), onTick: () => registry.sweepOverdue() } });
  registry = createAgentRegistry({ db, engine, clock, log: (actor, action, section, id) => notices.push({ actor, action, section, id }) });
  return { db, queue, engine, registry, notices, advance: (ms) => { now += ms; } };
}
const settle = async (h) => { await h.engine.idle(); await h.queue.drain(); await new Promise((r) => setTimeout(r, 10)); };

test('a failing agent job is escalated: console notification, My work assignment, shown in the command center', async () => {
  const h = harness();
  ACTIONS.test_cc_broken = { ...base, label: 'Broken check', level: 1, execute: () => { throw Object.assign(new Error('provider refused the request'), { permanent: true }); } };
  try {
    const a = h.registry.create({ key: 'cc_agent', name: 'Integrations', owner_id: 'founder', escalation_contact: 'u-tom', allowed_actions: ['test_cc_broken'] }, founder);
    const job = h.registry.addJob(a.id, { action: 'test_cc_broken' }, founder);
    const r = h.engine.startRun(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', key: 'k1' }); await r.promise; await settle(h);
    assert.equal(h.engine.runRow(r.id).status, 'failed');
    assert.deepEqual(h.notices.map((n) => [n.action, n.section]), [['agent.escalated', 'operations']], 'operations staff are notified');
    const e = h.db.prepare('SELECT * FROM platform_agent_escalations').get();
    assert.equal(e.kind, 'failed'); assert.equal(e.contact_id, 'u-tom'); assert.match(e.reason, /provider refused/);
    const task = h.db.prepare('SELECT * FROM platform_records WHERE id=?').get(e.assignment_id);
    assert.deepEqual([task.assigned_to, task.priority, task.work_state, task.due_on], ['u-tom', 'high', 'assigned', '2026-11-24'], 'the contact gets it in My work, due today');
    const c = h.registry.center();
    assert.equal(c.counts.escalated_open, 1); assert.equal(c.counts.failed_24h, 1);
    assert.equal(c.escalations[0].contact, 'Tom Nguyen'); assert.equal(c.failed[0].action_label, 'Broken check');
    // The same failure never escalates twice.
    h.registry.onRunStatus(h.engine.runRow(r.id), 'failed');
    assert.equal(h.db.prepare('SELECT COUNT(*) n FROM platform_agent_escalations').get().n, 1);
    // Acknowledge, then resolve.
    assert.equal(h.registry.actOnEscalation(e.id, 'acknowledge', '', founder).status, 'acknowledged');
    assert.equal(h.registry.actOnEscalation(e.id, 'resolve', 'Reconnected the provider.', founder).status, 'resolved');
    assert.equal(h.registry.actOnEscalation(e.id, 'resolve', 'again', founder).status, 409);
    assert.equal(h.registry.center().counts.escalated_open, 0);
  } finally { delete ACTIONS.test_cc_broken; }
});

test('a blocked run and a late run are escalated too; the founder is told through the console', async () => {
  const h = harness();
  ACTIONS.test_cc_ok = { ...base, label: 'OK check', level: 1, execute: () => ({ summary: 'ok' }) };
  ACTIONS.test_cc_other = { ...base, label: 'Other', level: 1, execute: () => ({ summary: 'ok' }) };
  try {
    const a = h.registry.create({ key: 'cc_founder', name: 'Release', owner_id: 'founder', escalation_contact: 'founder', allowed_actions: ['test_cc_ok'], deadline_minutes: 5 }, founder);
    const job = h.registry.addJob(a.id, { action: 'test_cc_ok' }, founder);
    h.engine.saveVersion(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', action: 'test_cc_other' }, founder, 'edit');
    let r = h.engine.startRun(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', key: 'b1' }); await r.promise; await settle(h);
    assert.equal(h.engine.runRow(r.id).status, 'blocked');
    let e = h.db.prepare("SELECT * FROM platform_agent_escalations WHERE kind='blocked'").get();
    assert.ok(e, 'blocked run escalated'); assert.equal(e.assignment_id, null, 'the founder has no My work; the console notice covers it');
    // A run that never finishes is escalated once its deadline passes.
    h.db.prepare("INSERT INTO automation_runs(id,workflow_id,version,scope,trigger_type,idempotency_key,action,definition_json,status,created_at,updated_at) VALUES ('late1',?,1,'platform','manual','late1','test_cc_ok','{}','queued',?,?)").run(job.id, new Date(Date.parse('2026-11-24T02:00:00.000Z')).toISOString(), new Date().toISOString());
    assert.deepEqual(h.registry.sweepOverdue(), [], 'not late yet');
    h.advance(6 * 60000);
    h.engine.tick();
    e = h.db.prepare("SELECT * FROM platform_agent_escalations WHERE kind='overdue'").get();
    assert.equal(e.run_id, 'late1'); assert.match(e.reason, /within 5 minutes/);
    assert.equal(h.notices.filter((n) => n.action === 'agent.escalated').length, 2);
  } finally { delete ACTIONS.test_cc_ok; delete ACTIONS.test_cc_other; }
});

test('level 3 agent actions wait for a person; level 4 never runs', async () => {
  const h = harness();
  let ran = 0;
  ACTIONS.test_cc_level3 = { ...base, label: 'Change something important', level: 3, effect: 'internal_write', execute: () => { ran++; return { summary: 'done' }; } };
  ACTIONS.test_cc_level4 = { ...base, label: 'Forbidden', level: 4, restricted: true, execute: () => { ran++; return {}; } };
  try {
    const a = h.registry.create({ key: 'cc_l3', name: 'Billing', owner_id: 'founder', escalation_contact: 'founder', allowed_actions: ['test_cc_level3'] }, founder);
    assert.match(h.registry.create({ key: 'cc_l4', name: 'Bad', owner_id: 'founder', escalation_contact: 'founder', allowed_actions: ['test_cc_level4'] }, founder).error, /restricted/, 'level 4 cannot even be given to an agent');
    const job = h.registry.addJob(a.id, { action: 'test_cc_level3' }, founder);
    const r = h.engine.startRun(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', key: 'l3' }); await r.promise; await settle(h);
    const run = h.engine.runRow(r.id);
    assert.equal(run.status, 'awaiting_approval'); assert.equal(ran, 0, 'nothing happens without approval');
    const ap = h.db.prepare('SELECT * FROM platform_approvals WHERE id=?').get(run.approval_id);
    assert.equal(ap.status, 'pending'); assert.equal(ap.policy_level, 3);
    const c = h.registry.center();
    assert.equal(c.counts.waiting_approval, 1); assert.equal(c.waiting[0].reference_code, ap.reference_code);
    // A person approves: then it runs.
    h.db.prepare("UPDATE platform_approvals SET status='approved',decided_by='founder' WHERE id=?").run(ap.id);
    h.engine.onDecision(ap, { status: 'approved', actor: founder }); await settle(h);
    assert.equal(ran, 1); assert.equal(h.engine.runRow(r.id).status, 'completed');
    // Even if a level 4 action were somehow put on the list, the engine refuses it.
    h.db.prepare("UPDATE platform_agents SET allowed_actions_json='[\"test_cc_level3\",\"test_cc_level4\"]' WHERE id=?").run(a.id);
    assert.equal(h.engine.saveVersion(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', action: 'test_cc_level4' }, founder, 'x').ok, false, 'a restricted step cannot be saved');
    // A tampered definition that names it anyway is still refused by the engine.
    const r4 = h.engine.startRun(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', key: 'l4', definition: { trigger: 'manual', action: 'test_cc_level4', params: {}, conditions: [] } }); await r4.promise; await settle(h);
    assert.equal(h.engine.runRow(r4.id).status, 'blocked'); assert.equal(ran, 1);
  } finally { delete ACTIONS.test_cc_level3; delete ACTIONS.test_cc_level4; }
});

test('performance shows runs, success rate and last failure per agent', async () => {
  const h = harness();
  let n = 0;
  ACTIONS.test_cc_flip = { ...base, label: 'Flip', level: 1, execute: () => { n++; if (n === 2) throw Object.assign(new Error('nope'), { permanent: true }); return { summary: 'ok' }; } };
  try {
    const a = h.registry.create({ key: 'cc_perf', name: 'Perf', owner_id: 'founder', escalation_contact: 'founder', allowed_actions: ['test_cc_flip'] }, founder);
    const job = h.registry.addJob(a.id, { action: 'test_cc_flip' }, founder);
    for (const k of ['p1', 'p2', 'p3', 'p4']) { const r = h.engine.startRun(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', key: k }); await r.promise; await settle(h); }
    const p = h.registry.center().performance.find((x) => x.key === 'cc_perf');
    assert.deepEqual([p.runs, p.ok, p.bad, p.success_rate], [4, 3, 1, 75]);
    assert.ok(p.last_failure);
  } finally { delete ACTIONS.test_cc_flip; }
});
