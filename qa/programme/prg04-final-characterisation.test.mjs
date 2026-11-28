// PRG-04 final acceptance CHARACTERISATION (Claude): current behaviour for limitations L1–L2 on a1e97ad.
// Passes now; expected to fail once a limitation is addressed. Not acceptance evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createDb, appendAuditLog } from '../../src/db.js';
import { installWorkspaceConfiguration, exportWorkspaceConfiguration } from '../../src/workspace-configuration.js';
import { verifyWorkspaceConfigurationSchema } from '../../src/workspace-configuration-schema.js';

function world() {
  const db = createDb(':memory:');
  db.exec('ALTER TABLE organisations ADD COLUMN modules_json TEXT'); db.exec('ALTER TABLE onboarding_profiles ADD COLUMN pipeline_stages_json TEXT');
  installWorkspaceConfiguration({ get() {}, post() {} }, { db, requireSaasUser() {}, getProviderCapabilities: () => [] });
  const org = crypto.randomUUID(), now = new Date().toISOString();
  db.prepare('INSERT INTO organisations (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(org, 'C', 'c-' + org.slice(0, 6), now, now);
  db.prepare("INSERT INTO workspace_configuration_revisions VALUES (?,1,1,?,?,?,?,?,NULL)").run(org, '{"packs":[],"activities":[]}', '{"jurisdiction":{"country":null,"region":null,"metadata_status":"unknown","subdivision_status":"unknown","currency":null,"country_rules_reviewed_at":null},"packs":[]}', 'h'.repeat(64), 'u', now);
  appendAuditLog(db, { organisation_id: org, action: 'workspace.configuration_approved', entity_type: 'workspace_configuration', entity_id: '1', metadata: {} });
  return { db, org };
}
const bypass = (db, fn) => { const t = db.prepare("SELECT sql FROM sqlite_master WHERE name='workspace_configuration_no_update'").get().sql; db.exec('DROP TRIGGER workspace_configuration_no_update'); fn(); db.exec(t); };

test('L1 current behaviour: revision CONTENT altered with the update trigger bypassed and restored is not detected', () => {
  const { db, org } = world();
  bypass(db, () => db.prepare("UPDATE workspace_configuration_revisions SET configuration_json='{\"packs\":[],\"activities\":[]}',approved_by='someone-else' WHERE organisation_id=?").run(org));
  assert.equal(verifyWorkspaceConfigurationSchema(db).state, 'verified', 'guard checks presence and definitions, not content');
  db.close();
});

test('L2 current behaviour: one malformed stored revision makes the whole revision export throw', () => {
  const { db, org } = world();
  bypass(db, () => db.prepare("UPDATE workspace_configuration_revisions SET metadata_json='{}' WHERE organisation_id=?").run(org));
  assert.throws(() => exportWorkspaceConfiguration(db, org));
  db.close();
});
