// TR-43 hard limits: no production deploy, destructive change or money movement happens through automation or an AI
// agent without a recorded human approval. The restricted ones are refused by name; refunds and permanent deletions
// always wait for a person; no agent may be given any of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb, appendAuditLog } from '../src/db.js';
import { createJobQueue } from '../src/job-queue.js';
import { createAutomationEngine } from '../src/automation/engine.js';
import { ACTIONS } from '../src/automation/catalogue.js';
import { createAgentRegistry, agentEligible } from '../src/agents/registry.js';

const NEVER = ['deploy_to_production', 'reset_or_drop_database', 'make_payment', 'transfer_to_new_payee', 'change_bank_details', 'delete_customer_records', 'disable_audit_or_approvals'];
const PERSON = ['issue_refund', 'platform_data_deletion', 'major_config_change'];

test('every hard limit is a named, restricted action that no agent may hold', () => {
  for (const key of NEVER) {
    assert.ok(ACTIONS[key], `${key} is named in the catalogue`);
    assert.equal(ACTIONS[key].restricted, true, `${key} is restricted`); assert.equal(ACTIONS[key].level, 4);
    assert.equal(agentEligible(key).ok, false); assert.match(agentEligible(key).reason, /restricted|subscriber/i);
  }
  for (const key of PERSON) {
    const a = ACTIONS[key]; assert.ok(a, key);
    assert.ok(a.manual || a.level >= 3, `${key} always needs a person`);
    assert.equal(agentEligible(key).ok, false, `${key} cannot be given to an agent`);
  }
});

test('the engine refuses a hard-limit run by name and records it; a refund waits for approval', async () => {
  const db = createDb(':memory:'), clock = () => Date.parse('2026-11-24T00:00:00Z');
  const queue = createJobQueue({ db, clock, log: { error() {}, warn() {} } });
  let registry = null;
  const engine = createAutomationEngine({ db, queue, clock, deps: { appendAuditLog, agentGuard: (run) => registry.guard(run), finance: { refundProposal: () => null } }, log: { warn() {} } });
  registry = createAgentRegistry({ db, engine, clock });
  for (const [scope, org] of [['platform', null], ['business', 'org-a']]) {
    for (const action of ['deploy_to_production', 'reset_or_drop_database', 'make_payment']) {
      const r = engine.startRun({ id: null, scope, organisation_id: org, current_version: 0 }, { trigger: 'manual', key: `${scope}:${action}`, payload: {}, definition: { trigger: 'manual', action } });
      await r.promise?.catch?.(() => {});
      const row = engine.runRow(r.id);
      assert.equal(row.status, 'blocked', `${scope} ${action} is blocked`);
      assert.match(row.policy_json || '', /Restricted/);
    }
  }
  assert.equal(db.prepare("SELECT COUNT(*) n FROM automation_runs WHERE status IN ('completed','completed_warning','executing')").get().n, 0, 'nothing ran');
  // An agent cannot be created with a hard-limit action.
  const made = registry.create({ key: 'release_bot', name: 'Release bot', owner_id: 'founder', responsibilities: 'Releases', allowed_actions: ['deploy_to_production'], schedule: 'manual', escalation_contact: 'founder' }, { id: 'founder' });
  assert.equal(made.ok, false); assert.match(made.error, /restricted/i, made.error);
});
