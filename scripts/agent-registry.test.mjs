// TR-40: agent registry. Acceptance: an agent cannot run an action outside its list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createDb, appendAuditLog } from '../src/db.js';
import { createJobQueue } from '../src/job-queue.js';
import { createAutomationEngine } from '../src/automation/engine.js';
import { ACTIONS } from '../src/automation/catalogue.js';
import { createAgentRegistry, agentEligible } from '../src/agents/registry.js';

function harness() {
  let now = Date.parse('2026-11-24T01:00:00.000Z');
  const clock = () => now;
  const db = createDb(':memory:');
  const queue = createJobQueue({ db, clock, log: { error() {}, warn() {} } });
  let registry = null;
  const engine = createAutomationEngine({ db, queue, clock, deps: { appendAuditLog, agentGuard: (run) => registry.guard(run) }, log: { warn() {} } });
  registry = createAgentRegistry({ db, engine, clock });
  return { db, queue, engine, registry, founder: { id: 'founder', name: 'Founder', role: 'founder' }, advance: (ms) => { now += ms; } };
}
const settle = async (h) => { await h.engine.idle(); await h.queue.drain(); await new Promise((r) => setTimeout(r, 20)); };
const base = { scope: 'platform', level: 1, effect: 'output', triggers: ['manual', 'schedule.hourly'], params: z.object({}).strict(), analyse: () => ({}), schema: z.object({}), preview: () => ({ description: 't', expected_outcome: 'x' }), verify: () => ({ ok: true, detail: 'fine' }) };

test('an agent cannot run an action outside its list', async () => {
  const h = harness();
  let allowedRan = 0, otherRan = 0;
  ACTIONS.test_agent_allowed = { ...base, label: 'Allowed check', execute: () => { allowedRan++; return { summary: 'ok' }; } };
  ACTIONS.test_agent_other = { ...base, label: 'Other check', execute: () => { otherRan++; return { summary: 'ok' }; } };
  try {
    const a = h.registry.create({ key: 'health_agent', name: 'Platform health agent', owner_id: 'founder', escalation_contact: 'founder', responsibilities: 'Keeps an eye on health.', allowed_actions: ['test_agent_allowed'], schedule: 'schedule.hourly', max_attempts: 2, timeout_seconds: 30 }, h.founder);
    assert.ok(a.ok, a.error);

    // 1. It cannot be given a job outside its list.
    const refused = h.registry.addJob(a.id, { action: 'test_agent_other' }, h.founder);
    assert.equal(refused.status, 403); assert.match(refused.error, /not allowed to run "Other check"/);

    // 2. Its allowed job runs normally, on its schedule.
    const job = h.registry.addJob(a.id, { action: 'test_agent_allowed' }, h.founder);
    assert.ok(job.ok); assert.equal(job.trigger, 'schedule.hourly');
    const w = h.engine.workflow(job.id, 'platform', null);
    let r = h.engine.startRun(w, { trigger: 'manual', key: 'run-1' }); await r.promise; await settle(h);
    assert.equal(h.engine.runRow(r.id).status, 'completed'); assert.equal(allowedRan, 1);

    // 3. If the job is later edited to another action, the engine blocks the run and does nothing.
    h.engine.saveVersion(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', action: 'test_agent_other' }, h.founder, 'sneaky edit');
    r = h.engine.startRun(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', key: 'run-2' }); await r.promise; await settle(h);
    let run = h.engine.runRow(r.id);
    assert.equal(run.status, 'blocked'); assert.equal(run.level, 4);
    assert.match(run.error, /Platform health agent" is not allowed to run "Other check"/);
    assert.equal(otherRan, 0, 'the forbidden action never ran');
    assert.equal(h.db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='automation.agent.denied'").get().n, 1, 'refusal audited');

    // 4. Checked again just before acting: an action removed while a run waited is refused.
    h.engine.saveVersion(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', action: 'test_agent_allowed' }, h.founder, 'back');
    const wf = h.engine.workflow(job.id, 'platform', null);
    r = h.engine.startRun(wf, { trigger: 'manual', key: 'run-3' }); await r.promise;
    assert.equal(h.engine.runRow(r.id).status, 'queued');
    h.db.prepare("UPDATE platform_agents SET allowed_actions_json='[]' WHERE id=?").run(a.id);
    await settle(h);
    run = h.engine.runRow(r.id);
    assert.equal(run.status, 'blocked'); assert.equal(allowedRan, 1, 'nothing ran after the permission was removed');

    // 5. A paused agent runs nothing.
    h.db.prepare("UPDATE platform_agents SET allowed_actions_json='[\"test_agent_allowed\"]',status='paused' WHERE id=?").run(a.id);
    r = h.engine.startRun(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', key: 'run-4' }); await r.promise; await settle(h);
    assert.match(h.engine.runRow(r.id).error, /is paused/);

    // 6. Automations without an agent are not affected.
    const plain = h.engine.createWorkflow({ scope: 'platform', name: 'Plain', definition: { trigger: 'manual', action: 'test_agent_other' }, actor: h.founder });
    r = h.engine.startRun(h.engine.workflow(plain.id, 'platform', null), { trigger: 'manual', key: 'run-5' }); await r.promise; await settle(h);
    assert.equal(h.engine.runRow(r.id).status, 'completed'); assert.equal(otherRan, 1);
  } finally { delete ACTIONS.test_agent_allowed; delete ACTIONS.test_agent_other; }
});

test('agent retry limit and timeout come from the agent', async () => {
  const h = harness();
  let calls = 0;
  ACTIONS.test_agent_flaky = { ...base, label: 'Flaky', execute: () => { calls++; throw new Error('provider down'); } };
  ACTIONS.test_agent_slow = { ...base, label: 'Slow', async_execute: true, executeAsync: () => new Promise((ok) => setTimeout(() => ok({ summary: 'late' }), 8000)) };
  try {
    const a = h.registry.create({ key: 'retry_agent', name: 'Retry agent', owner_id: 'founder', escalation_contact: 'founder', allowed_actions: ['test_agent_flaky', 'test_agent_slow'], max_attempts: 1, timeout_seconds: 5 }, h.founder);
    const job = h.registry.addJob(a.id, { action: 'test_agent_flaky' }, h.founder);
    const r = h.engine.startRun(h.engine.workflow(job.id, 'platform', null), { trigger: 'manual', key: 'f1' }); await r.promise; await settle(h);
    assert.equal(h.engine.runRow(r.id).status, 'failed'); assert.equal(calls, 1, 'max_attempts 1 means no retry');
    const slow = h.registry.addJob(a.id, { action: 'test_agent_slow' }, h.founder);
    const t0 = Date.now();
    const s = h.engine.startRun(h.engine.workflow(slow.id, 'platform', null), { trigger: 'manual', key: 's1' }); await s.promise; await settle(h);
    const run = h.engine.runRow(s.id);
    assert.equal(run.status, 'failed'); assert.match(run.error, /Timed out after 5 seconds/); assert.ok(Date.now() - t0 < 7900);
  } finally { delete ACTIONS.test_agent_flaky; delete ACTIONS.test_agent_slow; }
});

test('restricted, manual and business actions can never be on an agent list; registry validation', () => {
  const h = harness();
  assert.match(agentEligible('production_deployment').reason, /done by a person/);
  assert.match(agentEligible('draft_quote').reason, /subscriber workspaces/);
  assert.match(agentEligible('no_such_action').reason, /Unknown/);
  assert.equal(agentEligible('monitor_health').ok, true);
  for (const bad of ['production_deployment', 'restore_database', 'platform_data_deletion', 'draft_quote'])
    assert.equal(h.registry.create({ key: 'bad_' + bad.slice(0, 10), name: 'Bad', owner_id: 'founder', escalation_contact: 'founder', allowed_actions: [bad] }, h.founder).ok, false, bad);
  assert.match(h.registry.create({ key: 'who_agent', name: 'Who', owner_id: 'nobody', escalation_contact: 'founder' }, h.founder).error, /owner/);
  assert.match(h.registry.create({ key: 'esc_agent', name: 'Esc', owner_id: 'founder', escalation_contact: 'ghost' }, h.founder).error, /escalation/);
  const ok = h.registry.create({ key: 'ops_agent', name: 'Ops', owner_id: 'founder', escalation_contact: 'founder', allowed_actions: ['monitor_health', 'verify_backups'] }, h.founder);
  assert.ok(ok.ok);
  assert.equal(h.registry.create({ key: 'ops_agent', name: 'Ops 2', owner_id: 'founder', escalation_contact: 'founder' }, h.founder).status, 409);
  const job = h.registry.addJob(ok.id, { action: 'monitor_health' }, h.founder);
  assert.equal(h.registry.update(ok.id, { allowed_actions: ['verify_backups'], revision: 1 }, h.founder).status, 409, 'cannot remove an action a live job uses');
  assert.equal(h.registry.update(ok.id, { status: 'paused', revision: 1 }, h.founder).ok, true);
  assert.equal(h.registry.update(ok.id, { status: 'active', revision: 1 }, h.founder).status, 409, 'stale revision');
  const listed = h.registry.list().find((x) => x.key === 'ops_agent');
  assert.deepEqual(listed.allowed_actions, ['monitor_health', 'verify_backups']);
  assert.equal(listed.jobs[0].id, job.id);
  assert.equal(listed.status, 'paused');
});
