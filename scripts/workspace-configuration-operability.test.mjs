import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createDb, appendAuditLog, verifyAuditChain } from '../src/db.js';
import { initialiseWorkspaceConfigurationSchema as initialise, verifyWorkspaceConfigurationSchema as verify } from '../src/workspace-configuration-schema.js';
import { installWorkspaceConfiguration } from '../src/workspace-configuration.js';
import { checkSchema, runDiagnostics } from '../src/diagnostics.js';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const table = 'workspace_configuration_revisions';
const triggers = ['workspace_configuration_no_update', 'workspace_configuration_no_delete', 'workspace_configuration_no_replace'];
const app = { get() {}, post() {} };
const install = db => installWorkspaceConfiguration(app, { db, requireSaasUser() {}, getProviderCapabilities: () => [] });
const addPrerequisites = db => db.exec('ALTER TABLE organisations ADD COLUMN modules_json TEXT; ALTER TABLE onboarding_profiles ADD COLUMN pipeline_stages_json TEXT');
const sqlFor = (db, name) => db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name).sql;
const putOrg = db => db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run('tenant', 'Preserved', 'tenant', 'initial', 'initial');

test('O4: wrong installer ordering reports both prerequisites and leaves an existing tenant unchanged', () => {
  const db = createDb(':memory:');
  try {
    putOrg(db);
    const before = db.prepare('SELECT * FROM organisations').all();
    assert.throws(() => install(db), /module rules and onboarding proposal setup first.*organisations\.modules_json.*onboarding_profiles\.pipeline_stages_json/);
    assert.deepEqual(db.prepare('SELECT * FROM organisations').all(), before);
    assert.deepEqual(verify(db), { state: 'uninitialised', problems: [] });
    db.exec('ALTER TABLE organisations ADD COLUMN modules_json TEXT');
    db.prepare('UPDATE organisations SET modules_json=?').run('{"custom":"keep"}');
    assert.throws(() => install(db), /Missing: onboarding_profiles\.pipeline_stages_json$/);
    db.exec('ALTER TABLE onboarding_profiles ADD COLUMN pipeline_stages_json TEXT');
    db.prepare('INSERT INTO onboarding_profiles(organisation_id,services,pipeline_stages_json,updated_at) VALUES (?,?,?,?)')
      .run('tenant', '["custom service"]', '["payment"]', 'initial');
    const profile = db.prepare('SELECT * FROM onboarding_profiles').get();
    for (let i = 0; i < 3; i++) install(db);
    assert.equal(verify(db).state, 'verified');
    assert.equal(db.prepare('SELECT modules_json FROM organisations').get().modules_json, '{"custom":"keep"}');
    assert.deepEqual(db.prepare('SELECT * FROM onboarding_profiles').get(), profile);
    assert.equal(db.prepare('SELECT count(*) AS n FROM workspace_configuration_revisions').get().n, 0);
  } finally { db.close(); }
});

test('O3: drift guard refuses missing or altered protections and preserves revision data during verified recovery', () => {
  const db = createDb(':memory:');
  try {
    addPrerequisites(db);
    initialise(db);
    putOrg(db);
    db.prepare("INSERT INTO workspace_configuration_revisions VALUES ('tenant',1,1,'{}','{}','hash','owner','initial',NULL)").run();
    const before = db.prepare('SELECT * FROM workspace_configuration_revisions').all();
    for (const name of triggers) {
      const definition = sqlFor(db, name);
      db.exec('DROP TRIGGER ' + name);
      assert.ok(verify(db).problems.includes('missing ' + name));
      assert.throws(() => initialise(db), /schema integrity failure/);
      const diagnostics = runDiagnostics({ db, env: {}, repair: true });
      assert.equal(diagnostics.checks.find(check => check.id === 'database.workspace_configuration').status, 'fail');
      assert.ok(verify(db).problems.includes('missing ' + name));
      db.exec(definition);
      initialise(db);
      assert.deepEqual(db.prepare('SELECT * FROM workspace_configuration_revisions').all(), before);
    }
    const definition = sqlFor(db, triggers[0]);
    db.exec('DROP TRIGGER ' + triggers[0] + '; ' + definition.replace("RAISE(ABORT, 'Approved workspace revisions are immutable')", '1'));
    assert.ok(verify(db).problems.includes('altered definition for ' + triggers[0]));
    assert.throws(() => initialise(db), /altered definition/);
    db.exec('DROP TRIGGER ' + triggers[0] + '; ' + definition);
    assert.throws(() => db.exec("UPDATE workspace_configuration_revisions SET approved_by='other'"), /immutable/);
    db.exec('SAVEPOINT drift; ALTER TABLE workspace_configuration_revisions ADD COLUMN extra TEXT');
    assert.ok(verify(db).problems.includes('altered definition for ' + table));
    assert.throws(() => initialise(db), /altered definition/);
    db.exec('ROLLBACK TO drift; RELEASE drift');
    initialise(db);
    assert.deepEqual(db.prepare('SELECT * FROM workspace_configuration_revisions').all(), before);
    db.exec('DROP TABLE workspace_configuration_schema');
    initialise(db); // adopt the original installation layout without rewriting its history
    assert.equal(db.prepare('SELECT version FROM workspace_configuration_schema').get().version, 1);
    assert.deepEqual(db.prepare('SELECT * FROM workspace_configuration_revisions').all(), before);
  } finally { db.close(); }
});

test('O3: missing history stays missing after diagnostics repair and installer failure', () => {
  const db = createDb(':memory:');
  try {
    addPrerequisites(db);
    initialise(db);
    putOrg(db);
    const definitions = [table, ...triggers].map(name => sqlFor(db, name));
    db.exec('DROP TABLE workspace_configuration_revisions');
    assert.throws(() => initialise(db), /missing workspace_configuration_revisions/);
    checkSchema(db, { apply: true });
    assert.equal(db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table), undefined);

    db.exec(definitions.join(';\n'));
    appendAuditLog(db, { organisation_id: 'tenant', action: 'workspace.configuration_approved', entity_id: '1' });
    assert.throws(() => initialise(db), /approved revision history is missing/);
    db.exec('DROP TABLE workspace_configuration_revisions; DROP TABLE workspace_configuration_schema');
    assert.throws(() => initialise(db), /missing workspace_configuration_revisions/);
    assert.equal(db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table), undefined);
  } finally { db.close(); }
});

test('O4: real server fails closed on drift and restarts after restoring the verified trigger', async t => {
  const server = await startServer();
  t.after(() => server.stop());
  const owner = await seedOwner(server, { email: 'restart@workspace.example.test' });
  const db = new Database(server.dbPath);
  t.after(() => db.close());
  const routes = '/api/saas/workspace-configuration';
  const options = { cookie: owner.cookie };
  const head = (await server.call('GET', routes, options)).json;
  assert.equal((await server.call('POST', routes + '/approve', { ...options, body: {
    expected_revision: head.revision, expected_context: head.context, configuration: { packs: [], activities: [] },
  } })).status, 201);
  const initial = db.prepare('SELECT * FROM workspace_configuration_revisions').all();
  const definition = sqlFor(db, triggers[0]);
  db.exec('DROP TRIGGER ' + triggers[0]);
  await assert.rejects(startServer({ DATABASE_PATH: server.dbPath }), /schema integrity failure.*missing workspace_configuration_no_update/s);
  assert.deepEqual(db.prepare('SELECT * FROM workspace_configuration_revisions').all(), initial);
  db.exec(definition);
  const restarted = await startServer({ DATABASE_PATH: server.dbPath });
  t.after(() => restarted.stop());
  const resumed = await restarted.call('GET', routes, options);
  assert.equal(resumed.status, 200);
  assert.equal(resumed.json.revision, 1);
  assert.deepEqual(db.prepare('SELECT * FROM workspace_configuration_revisions').all(), initial);
  assert.equal(verifyAuditChain(db, owner.org).ok, true);
});

test('O3: owner export adds ordered tenant-local approval and rollback history in JSON and CSV', async t => {
  const server = await startServer();
  t.after(() => server.stop());
  const a = await seedOwner(server, { email: 'export-a@workspace.example.test' });
  const b = await seedOwner(server, { email: 'export-b@workspace.example.test' });
  const staff = await seedOwner(server, { email: 'export-staff@workspace.example.test' });
  const db = new Database(server.dbPath);
  t.after(() => db.close());
  db.prepare("INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,'admin',?)")
    .run(a.org, staff.uid, new Date().toISOString());
  db.prepare('INSERT INTO payment_settings(organisation_id,stripe_secret_enc,updated_at) VALUES (?,?,?)')
    .run(a.org, 'synthetic-credential-exclusion', new Date().toISOString());
  const call = (owner, method, path, body) => server.call(method, path, { cookie: owner.cookie, body });
  const config = '/api/saas/workspace-configuration';
  const route = '/api/saas/data-export';
  const approve = async (owner, label) => {
    const { json: head } = await call(owner, 'GET', config);
    const out = await call(owner, 'POST', config + '/approve', {
      expected_revision: head.revision, expected_context: head.context,
      configuration: { packs: [{ key: 'p', label, industry: 'custom' }], activities: [{ key: 'a', label, pack_key: 'p' }] },
    });
    assert.equal(out.status, 201, out.text);
    return out.json;
  };
  await approve(a, 'Owner A original');
  const head = await approve(a, 'Owner A update');
  await approve(b, 'Owner B private');
  assert.equal((await call(a, 'POST', config + '/rollback', {
    expected_revision: head.revision, expected_context: head.context, target_revision: 1,
  })).status, 201);
  const only = '?table=' + table;
  const out = await call(a, 'GET', route + only + '&organisation_id=' + b.org);
  assert.equal(out.status, 200, out.text);
  const rows = out.json.tables[table];
  assert.deepEqual(rows.map(r => [r.revision, r.restored_from, r.approved_by]), [[1,null,a.uid],[2,null,a.uid],[3,1,a.uid]]);
  assert.deepEqual(rows.map(r => r.configuration.packs[0].label), ['Owner A original', 'Owner A update', 'Owner A original']);
  assert.ok(rows.every(row => typeof row.approved_at === 'string' && row.schema_version === 1 && !Object.hasOwn(row, 'context_hash')));
  const csv = await call(a, 'GET', route + only + '&format=csv');
  assert.equal(csv.status, 200);
  assert.deepEqual(csv.text.trim().split('\r\n').map(line => line.split(',')[0]), ['revision','1','2','3']);
  const full = await call(a, 'GET', route);
  assert.equal(full.status, 200);
  assert.equal(full.json.format_version, 1);
  assert.equal(full.json.tables.organisation[0].id, a.org);
  assert.deepEqual(full.json.tables[table], rows);
  assert.doesNotMatch(out.text + csv.text + full.text, /synthetic-credential-exclusion|Owner B private/);
  assert.doesNotMatch(out.text + csv.text, /context_hash/);
  const forbidden = await server.call('GET', route + only, {
    cookie: staff.cookie, headers: { 'X-Organisation-Id': a.org },
  });
  assert.equal(forbidden.status, 403);
  assert.doesNotMatch(forbidden.text, /Owner A original/);
  assert.equal((await server.call('GET', route + only)).status, 401);
  const foreign = await server.call('GET', route + only, {
    cookie: b.cookie, headers: { 'X-Organisation-Id': a.org },
  });
  assert.equal(foreign.status, 403);
  assert.equal((await call(b, 'GET', route + only)).json.tables[table][0].configuration.packs[0].label, 'Owner B private');
  const audit = db.prepare("SELECT user_id,entity_id,metadata_json FROM audit_logs WHERE organisation_id=? AND action='privacy.data_exported'").all(a.org);
  assert.equal(audit.length, 3);
  assert.ok(audit.every(row => row.user_id === a.uid && row.entity_id === a.org));
  assert.equal(verifyAuditChain(db, a.org).ok, true);
});
