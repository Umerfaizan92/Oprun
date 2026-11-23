// TR-41: the thirteen standard agents. Acceptance: each has at least one real scheduled job and a visible last-run result.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb, appendAuditLog } from '../src/db.js';
import { createJobQueue } from '../src/job-queue.js';
import { createAutomationEngine } from '../src/automation/engine.js';
import { ACTIONS } from '../src/automation/catalogue.js';
import { AGENT_ACTIONS } from '../src/automation/agent-actions.js';
import { createAgentRegistry } from '../src/agents/registry.js';
import { DEFAULT_AGENTS } from '../src/agents/defaults.js';

const BRIEF = ['Platform health', 'Security', 'Customer enquiries', 'Subscriber onboarding', 'Staff allocation', 'Customer support', 'Communications', 'UI and UX quality', 'Automated testing', 'Media and content', 'Integrations', 'Billing monitoring', 'Release coordination'];

function harness(extra = {}) {
  let now = Date.parse('2026-11-23T00:05:00.000Z'); // Monday 8:05 am in Perth: hourly, daily and weekly jobs are all due
  const clock = () => now;
  const db = createDb(':memory:');
  const queue = createJobQueue({ db, clock, log: { error() {}, warn() {} } });
  let registry = null;
  const deps = {
    appendAuditLog, agentGuard: (run) => registry.guard(run),
    health: () => ({ problems: [], facts: ['Database answering'] }),
    backups: () => ({ problems: ['BACKUP_S3_BUCKET is not set.'], facts: [] }),
    diagnostics: () => ({ checks: [{ id: 'security.session_ttl', status: 'warn', detail: 'Business sessions renew for 365 days.' }, { id: 'database.integrity', status: 'pass', detail: 'SQLite quick_check passed.' }, { id: 'audit.chain', status: 'pass', detail: '12 audit rows verified.' }] }),
    qaReport: (name) => (name === 'accessibility.json' ? { standard: 'WCAG 2.2 AA', results: [{ page: 'home', width: 390, theme: 'dark', violations: [] }, { page: 'pricing', width: 390, theme: 'light', violations: [{ id: 'color-contrast' }] }] } : { budget: { lcp: 2500, cls: 0.1, tbt: 200 }, results: [{ page: 'home', mode: 'mobile', lcp: 900, cls: 0, tbt: 0 }] }),
    mail: { providerReady: () => true },
    ...extra
  };
  const engine = createAutomationEngine({ db, queue, clock, deps, log: { warn() {} } });
  registry = createAgentRegistry({ db, engine, clock });
  return { db, queue, engine, registry, advance: (ms) => { now += ms; } };
}

test('the thirteen agents in the brief exist, each with a scheduled job, and every job runs and leaves a visible result', async () => {
  const h = harness();
  const made = h.registry.ensureDefaults(DEFAULT_AGENTS);
  assert.equal(made.length, 13);
  const agents = h.registry.list();
  assert.deepEqual(agents.map((a) => a.name).sort(), [...BRIEF].sort(), 'one agent for each area in the brief');
  for (const a of agents) {
    assert.ok(a.jobs.length >= 1, `${a.name} has a job`);
    for (const j of a.jobs) {
      assert.equal(j.status, 'active', `${a.name}: ${j.action} is switched on`);
      assert.match(j.trigger_type, /^schedule\./, `${a.name}: ${j.action} runs on a schedule`);
      assert.ok(a.allowed_actions.includes(j.action));
      assert.equal(ACTIONS[j.action].level, 1, 'report jobs only');
      assert.equal(ACTIONS[j.action].effect, 'output', 'agents only write reports');
    }
  }
  // The scheduler starts every job on its own.
  const started = h.engine.tick();
  assert.ok(started.length >= 13, `the scheduler started ${started.length} runs`);
  await h.engine.idle(); await h.queue.drain(); await h.queue.drain();
  const failedRuns = h.db.prepare("SELECT action,status,error FROM automation_runs WHERE status NOT IN ('completed','skipped')").all();
  assert.deepEqual(failedRuns, [], 'no agent run failed');
  for (const a of h.registry.list()) {
    assert.ok(a.last_run, `${a.name} has run`);
    for (const j of a.jobs) {
      const r = j.last_run;
      assert.ok(r, `${a.name}: ${j.action} has a result`);
      // A finished run shows its report; a check with nothing to report says so.
      if (r.status === 'skipped') assert.match(r.error, /Nothing to do/, `${a.name}: ${j.action}`);
      else { assert.equal(r.status, 'completed', `${a.name} ${j.action}: ${r.error || ''}`); assert.ok(r.output?.title, `${a.name}: ${j.action} result is visible`); }
    }
    assert.ok(a.jobs.some((j) => j.last_run.output), `${a.name} has at least one written report`);
    assert.equal(a.overdue_runs, 0);
  }
  // Problems become alerts; quiet areas say all clear.
  const by = Object.fromEntries(h.registry.list().map((a) => [a.key, a.jobs.find((j) => j.last_run.output).last_run.output]));
  assert.equal(by.security.kind, 'alert'); assert.match(by.security.body, /365 days/);
  assert.equal(by.ui_quality.kind, 'alert'); assert.match(by.ui_quality.body, /pricing at 390px \(light\) has 1 issue: color-contrast/);
  assert.equal(by.customer_enquiries.kind, 'report'); assert.match(by.customer_enquiries.title, /all clear/);
  assert.match(by.automated_testing.body, /quick_check passed/);
  assert.match(by.release_coordination.title + by.release_coordination.body, /Release|backup/i);
  // Second start of the server does not duplicate anything or undo the owner's changes.
  h.db.prepare("UPDATE platform_agents SET status='paused' WHERE agent_key='media_content'").run();
  assert.deepEqual(h.registry.ensureDefaults(DEFAULT_AGENTS), []);
  assert.equal(h.registry.list().find((a) => a.key === 'media_content').status, 'paused');
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM automation_workflows WHERE agent_id IS NOT NULL').get().n, 15);
});

test('reports count real records and never copy names or emails', async () => {
  const h = harness();
  const t = '2026-11-20T00:00:00.000Z';
  h.db.exec("CREATE TABLE IF NOT EXISTS platform_records(id TEXT PRIMARY KEY,kind TEXT,title TEXT,body TEXT DEFAULT '',status TEXT,assigned_to TEXT,revision INTEGER DEFAULT 1,created_by TEXT,created_at TEXT,updated_at TEXT,work_state TEXT,due_on TEXT)");
  h.db.prepare("INSERT INTO platform_records(id,kind,title,status,created_by,created_at,updated_at) VALUES ('p1','prospect','Jane Citizen jane@example.test','open','founder',?,?)").run(t, t);
  h.registry.ensureDefaults(DEFAULT_AGENTS.filter((d) => d.key === 'customer_enquiries'));
  h.engine.tick(); await h.engine.idle(); await h.queue.drain();
  const out = h.registry.list()[0].jobs[0].last_run.output;
  assert.equal(out.kind, 'alert');
  assert.match(out.body, /1 open enquiry has nobody assigned/);
  assert.match(out.body, /1 open enquiry has not been touched for 2 days/);
  assert.doesNotMatch(out.title + out.body, /Jane|example\.test/);
});

test('every agent report action is platform-only, read-only and handles missing tables', () => {
  const h = harness();
  for (const [key, a] of Object.entries(AGENT_ACTIONS)) {
    assert.equal(a.scope, 'platform', key); assert.equal(a.level, 1, key); assert.equal(a.effect, 'output', key);
    assert.ok(a.triggers.some((t) => t.startsWith('schedule.')), key);
    const ctx = { db: h.db, deps: { clock: () => Date.now(), outputs: { add: () => ({ ref: 'x' }) } }, run: {} };
    const r = a.analyse(ctx); // tables such as platform_records are missing in this database
    assert.ok(a.schema.safeParse(r).success, `${key} result shape`);
  }
});
