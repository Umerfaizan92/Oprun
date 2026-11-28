// PRG-04 FINAL independent acceptance of the O3/O4 corrections (Claude). Candidate a1e97ad (published 766fa58).
// Mandatory: no todo, no skip. Synthetic data only. The adoption test needs the ORIGINAL e8ee522 tree to create a
// pre-correction database with the original server:
//   git worktree add --detach <dir> e8ee5228575d171c1667ec87c2b542df7e68864e && ln -s <repo>/node_modules <dir>/node_modules
//   PRG04_ORIGINAL_TREE=<dir> node --test --test-concurrency=1 qa/programme/prg04-final-acceptance-independent.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createDb, verifyAuditChain, appendAuditLog } from '../../src/db.js';
import { installWorkspaceConfiguration } from '../../src/workspace-configuration.js';
import { verifyWorkspaceConfigurationSchema } from '../../src/workspace-configuration-schema.js';
import { checkSchema } from '../../src/diagnostics.js';
import { startServer } from '../../scripts/test-server.mjs';
import { seedOwner } from '../../scripts/visual/session.mjs';

const PATH = '/api/saas/workspace-configuration';
const CONFIG = { packs: [{ key: 'plumbing', label: 'Plumbing', industry: 'custom', provider_references: [] }], activities: [{ key: 'repairs', label: 'Repairs', pack_key: 'plumbing' }] };
const OBJECTS = ['workspace_configuration_revisions', 'workspace_configuration_no_update', 'workspace_configuration_no_delete', 'workspace_configuration_no_replace'];
const app = { get() {}, post() {} };
const install = (db) => installWorkspaceConfiguration(app, { db, requireSaasUser() {}, getProviderCapabilities: () => [] });
const prerequisites = (db) => { db.exec('ALTER TABLE organisations ADD COLUMN modules_json TEXT'); db.exec('ALTER TABLE onboarding_profiles ADD COLUMN pipeline_stages_json TEXT'); return db; };
const schema = (db) => db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
const seedTenant = (db) => {
  const now = new Date().toISOString(), org = crypto.randomUUID();
  db.prepare("INSERT INTO organisations (id,name,slug,created_at,updated_at,modules_json,country) VALUES (?,?,?,?,?,?,?)").run(org, 'Subscriber', 's-' + org.slice(0, 6), now, now, '{"modules":{"stock":false},"keep":"x"}', 'AU');
  return org;
};
const rowsOf = (db, org) => ({ org: db.prepare('SELECT * FROM organisations WHERE id=?').get(org), profiles: db.prepare('SELECT * FROM onboarding_profiles').all() });
const approveDirect = (db, org, revision, restored = null) => {
  db.prepare("INSERT INTO workspace_configuration_revisions VALUES (?,?,1,?,?,?,?,?,?)").run(org, revision, JSON.stringify(CONFIG), '{"jurisdiction":{"country":"AU","region":null,"metadata_status":"reference_available","subdivision_status":"unknown","currency":"AUD","country_rules_reviewed_at":null},"packs":[]}', 'h'.repeat(64), 'u', new Date().toISOString(), restored);
  appendAuditLog(db, { organisation_id: org, user_id: null, action: restored ? 'workspace.configuration_rolled_back' : 'workspace.configuration_approved', entity_type: 'workspace_configuration', entity_id: String(revision), metadata: { revision } });
};

// ================= O4 — startup dependencies =================
test('O4: missing prerequisites fail with a clear diagnostic and change nothing', () => {
  const db = createDb(':memory:'), org = seedTenant(createDbColumnsLike(db));
  try {
    const before = schema(db), data = rowsOf(db, org);
    assert.throws(() => install(db), (e) => /requires database bootstrap, module rules and onboarding proposal setup first/.test(e.message) && /onboarding_profiles\.pipeline_stages_json/.test(e.message));
    assert.deepEqual(schema(db), before, 'no partial schema');
    assert.deepEqual(rowsOf(db, org), data, 'no subscriber data change');
    assert.equal(db.inTransaction, false);
  } finally { db.close(); }
});
function createDbColumnsLike(db) { db.exec('ALTER TABLE organisations ADD COLUMN modules_json TEXT'); return db; }

test('O4: foreign keys off fails closed before any write', () => {
  const db = prerequisites(createDb(':memory:'));
  try {
    db.pragma('foreign_keys = OFF');
    const before = schema(db);
    assert.throws(() => install(db), /foreign keys/i);
    assert.deepEqual(schema(db), before);
  } finally { db.close(); }
});

test('O4: fresh initialisation is additive, marked, idempotent and preserves subscriber data', () => {
  const db = prerequisites(createDb(':memory:'));
  try {
    const org = seedTenant(db), before = schema(db), data = rowsOf(db, org);
    for (let i = 0; i < 3; i++) install(db);
    const added = schema(db).filter((o) => !before.some((b) => b.name === o.name)).map((o) => o.name).sort();
    assert.deepEqual(added, [...OBJECTS, 'workspace_configuration_schema'].sort());
    for (const b of before) assert.equal(schema(db).find((o) => o.name === b.name)?.sql, b.sql, 'unchanged: ' + b.name);
    assert.deepEqual(rowsOf(db, org), data);
    assert.deepEqual(db.prepare('SELECT version FROM workspace_configuration_schema').all(), [{ version: 1 }]);
    assert.equal(verifyWorkspaceConfigurationSchema(db).state, 'verified');
  } finally { db.close(); }
});

test('O4: a failure part-way through initialisation rolls back every created object', () => {
  const real = prerequisites(createDb(':memory:'));
  try {
    const before = schema(real);
    const failing = new Proxy(real, { get(target, prop) {
      if (prop === 'exec') return (sql) => { if (/CREATE TABLE IF NOT EXISTS workspace_configuration_schema/.test(sql)) throw new Error('synthetic marker failure'); return target.exec(sql); };
      const v = target[prop]; return typeof v === 'function' ? v.bind(target) : v;
    } });
    assert.throws(() => install(failing), /synthetic marker failure/);
    assert.deepEqual(schema(real), before, 'revision table and triggers rolled back with the failed marker');
    assert.equal(real.inTransaction, false);
    install(real);
    assert.equal(verifyWorkspaceConfigurationSchema(real).state, 'verified', 'clean retry succeeds');
  } finally { real.close(); }
});

// ================= O3 — schema integrity guard =================
test('O3: every missing or altered object and the marker are detected; startup refuses; nothing is rebuilt silently', () => {
  const triggerSql = (db, name) => db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name).sql;
  const cases = [
    ...OBJECTS.slice(1).map((t) => [`missing ${t}`, (db) => db.exec(`DROP TRIGGER ${t}`), new RegExp('missing ' + t)]),
    ...OBJECTS.slice(1).map((t) => [`altered ${t}`, (db) => { const sql = triggerSql(db, t); db.exec(`DROP TRIGGER ${t}`); db.exec(sql.replace("'Approved workspace revisions are immutable'", "'changed'")); }, new RegExp('altered definition for ' + t)]),
    ['missing table with audit evidence', (db) => { for (const t of OBJECTS.slice(1)) db.exec(`DROP TRIGGER ${t}`); db.exec('DROP TABLE workspace_configuration_revisions'); }, /missing workspace_configuration_revisions/],
    ['altered table', (db) => { for (const t of OBJECTS.slice(1)) db.exec(`DROP TRIGGER ${t}`); db.exec('ALTER TABLE workspace_configuration_revisions ADD COLUMN extra TEXT'); }, /altered definition for workspace_configuration_revisions/],
    ['invalid marker row', (db) => { db.exec('DELETE FROM workspace_configuration_schema'); }, /marker row is invalid/],
    ['missing revision row (history lost)', (db) => { db.exec('DROP TRIGGER workspace_configuration_no_delete'); db.exec("DELETE FROM workspace_configuration_revisions WHERE revision=2"); db.exec(triggerSqlOf.no_delete); }, /approved revision history is missing/],
  ];
  for (const [label, damage, expected] of cases) {
    const db = prerequisites(createDb(':memory:'));
    try {
      install(db);
      const org = seedTenant(db);
      approveDirect(db, org, 1); approveDirect(db, org, 2); approveDirect(db, org, 3, 1);
      triggerSqlOf.no_delete ||= triggerSql(db, 'workspace_configuration_no_delete');
      damage(db);
      const v = verifyWorkspaceConfigurationSchema(db);
      assert.equal(v.state, 'invalid', label);
      assert.ok(v.problems.some((p) => expected.test(p)), `${label}: ${v.problems}`);
      const before = schema(db);
      assert.throws(() => install(db), /integrity failure/, label + ': startup refuses');
      checkSchema(db, { apply: true });
      assert.deepEqual(schema(db).filter((o) => o.name.startsWith('workspace_configuration')), before.filter((o) => o.name.startsWith('workspace_configuration')), label + ': no silent rebuild by installer or generic repair');
      assert.equal(verifyAuditChain(db, org).ok, true, label + ': audit chain intact');
    } finally { db.close(); }
  }
});
const triggerSqlOf = { no_delete: null };

test('O3: lost schema after a prior installation is not mistaken for a clean install', () => {
  const db = prerequisites(createDb(':memory:'));
  try {
    install(db);
    for (const t of OBJECTS.slice(1)) db.exec(`DROP TRIGGER ${t}`);
    db.exec('DROP TABLE workspace_configuration_revisions'); // marker remains, no approvals ever made
    assert.equal(verifyWorkspaceConfigurationSchema(db).state, 'invalid');
    assert.throws(() => install(db), /integrity failure/);
    db.exec('DROP TABLE workspace_configuration_schema'); // nothing left at all and no approval evidence
    assert.equal(verifyWorkspaceConfigurationSchema(db).state, 'uninitialised', 'only a database with no trace of the feature counts as fresh');
  } finally { db.close(); }
});

test('O3: legitimate tenant deletion does not trip the history guard', () => {
  const db = prerequisites(createDb(':memory:'));
  try {
    install(db);
    const keep = seedTenant(db), gone = seedTenant(db);
    approveDirect(db, keep, 1); approveDirect(db, gone, 1);
    db.prepare('DELETE FROM organisations WHERE id=?').run(gone); // audit rows remain (append-only), revisions cascade
    assert.equal(verifyWorkspaceConfigurationSchema(db).state, 'verified');
    install(db);
  } finally { db.close(); }
});

// ================= O4 — real servers: original-database adoption, fail-closed start, restart =================
test('O4/O3: a database created by the original e8ee522 server is adopted unchanged; drift fails closed; verified restore restarts', { timeout: 240000 }, async () => {
  const original = process.env.PRG04_ORIGINAL_TREE;
  assert.ok(original && fs.existsSync(path.join(original, 'scripts/test-server.mjs')), 'PRG04_ORIGINAL_TREE must point at an e8ee522 checkout (see header)');
  const head = fs.existsSync(path.join(original, '.git')) ? fs.readFileSync(path.join(original, '.git'), 'utf8') : '';
  void head;
  const { startServer: startOriginal } = await import(path.join(original, 'scripts/test-server.mjs'));
  const s0 = await startOriginal();
  const dir = fs.mkdtempSync(path.join(path.dirname(s0.dbPath), '..', 'prg04f-keep-')), file = path.join(dir, 'db.sqlite');
  let owner;
  try {
    owner = await seedOwner(s0, { email: 'adopt@example.test', business: 'Adopt' });
    const g = await s0.call('GET', PATH, { cookie: owner.cookie });
    assert.equal(g.status, 200, g.text);
    const v1 = await s0.call('POST', PATH + '/approve', { cookie: owner.cookie, body: { expected_revision: 0, expected_context: g.json.context, configuration: CONFIG } });
    assert.equal(v1.status, 201, v1.text);
    const v2 = await s0.call('POST', PATH + '/approve', { cookie: owner.cookie, body: { expected_revision: 1, expected_context: v1.json.context, configuration: { packs: CONFIG.packs, activities: [] } } });
    const v3 = await s0.call('POST', PATH + '/rollback', { cookie: owner.cookie, body: { expected_revision: 2, expected_context: v2.json.context, target_revision: 1 } });
    assert.equal(v3.status, 201, v3.text);
    const check = new Database(s0.dbPath); check.pragma('wal_checkpoint(TRUNCATE)'); check.close();
    fs.copyFileSync(s0.dbPath, file);
  } finally { await s0.stop(); }
  const snapshot = () => { const d = new Database(file, { readonly: true }); try { return { revisions: d.prepare('SELECT * FROM workspace_configuration_revisions ORDER BY organisation_id,revision').all(), audit: d.prepare("SELECT id,action,entity_id,event_hash FROM audit_logs WHERE action LIKE 'workspace.configuration_%' ORDER BY rowid").all(), marker: d.prepare("SELECT 1 FROM sqlite_master WHERE name='workspace_configuration_schema'").get() }; } finally { d.close(); } };
  const before = snapshot();
  assert.equal(before.revisions.length, 3);
  assert.equal(before.marker, undefined, 'original database has no marker');
  // Two candidate servers start on the original database at the same time.
  const [a, b] = await Promise.all([startServer({ DATABASE_PATH: file }), startServer({ DATABASE_PATH: file })]);
  try {
    const exp = await a.call('GET', '/api/saas/data-export', { cookie: owner.cookie });
    assert.equal(exp.status, 200, exp.text);
    assert.deepEqual(exp.json.data?.tables?.workspace_configuration_revisions?.map((r) => [r.revision, r.restored_from]) ?? exp.json.tables.workspace_configuration_revisions.map((r) => [r.revision, r.restored_from]), [[1, null], [2, null], [3, 1]]);
  } finally { await a.stop(); await b.stop(); }
  const after = snapshot();
  assert.deepEqual(after.revisions, before.revisions, 'history byte-identical after adoption');
  assert.deepEqual(after.audit, before.audit);
  assert.ok(after.marker, 'marker added on adoption');
  // Drift: drop a trigger. The candidate refuses to start and says why.
  const d = new Database(file); const sql = d.prepare("SELECT sql FROM sqlite_master WHERE name='workspace_configuration_no_update'").get().sql; d.exec('DROP TRIGGER workspace_configuration_no_update'); d.close();
  await assert.rejects(startServer({ DATABASE_PATH: file }), /integrity failure.*missing workspace_configuration_no_update/s);
  assert.deepEqual(snapshot().revisions, before.revisions);
  const r = new Database(file); r.exec(sql); r.close(); // verified restore of the exact definition
  const c = await startServer({ DATABASE_PATH: file });
  try {
    const head = await c.call('GET', PATH, { cookie: owner.cookie });
    assert.equal(head.status, 200, head.text);
    assert.equal(head.json.revision, 3);
  } finally { await c.stop(); }
  assert.deepEqual(snapshot().revisions, before.revisions);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ================= O3 — configuration revision export =================
test('O3 export: owner-only JSON and CSV, tenant-local, chronological, ancestry and attribution, no hashes or credentials; existing tables kept', { timeout: 120000 }, async (t) => {
  const s = await startServer();
  t.after(() => s.stop());
  const A = await seedOwner(s, { email: 'exp-a@example.test', business: 'Export A' });
  const B = await seedOwner(s, { email: 'exp-b@example.test', business: 'Export B' });
  const admin = await seedOwner(s, { email: 'exp-admin@example.test', business: 'Admin own' });
  const db = new Database(s.dbPath); t.after(() => db.close());
  db.prepare("INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,'admin',?)").run(A.org, admin.uid, new Date().toISOString());
  const before = (await s.call('GET', '/api/saas/data-export', { cookie: A.cookie })).json;
  let base = (await s.call('GET', PATH, { cookie: A.cookie })).json;
  for (const body of [{ configuration: CONFIG }, { configuration: { packs: CONFIG.packs, activities: [] } }, { target_revision: 1 }]) {
    const r = await s.call('POST', PATH + (body.target_revision ? '/rollback' : '/approve'), { cookie: A.cookie, body: { expected_revision: base.revision, expected_context: base.context, ...body } });
    assert.equal(r.status, 201, r.text); base = r.json;
  }
  const json = await s.call('GET', '/api/saas/data-export', { cookie: A.cookie });
  assert.equal(json.status, 200);
  const rows = json.json.tables.workspace_configuration_revisions;
  assert.deepEqual(rows.map((r) => [r.revision, r.restored_from, r.approved_by]), [[1, null, A.uid], [2, null, A.uid], [3, 1, A.uid]]);
  assert.deepEqual(rows[2].configuration, CONFIG);
  assert.ok(rows.every((r) => r.approved_at && r.metadata?.jurisdiction && r.schema_version === 1));
  const text = JSON.stringify(rows);
  assert.doesNotMatch(text, /context_hash|"context"|[a-f0-9]{64}|organisation_id|password|secret|token/i, 'no internal hash, tenant id or credential');
  for (const k of Object.keys(before.tables)) assert.ok(Object.hasOwn(json.json.tables, k), 'existing export table kept: ' + k);
  assert.deepEqual(Object.keys(json.json.tables).filter((k) => !Object.hasOwn(before.tables, k)), [], 'table list unchanged (revisions table already listed when empty)');
  const csv = await s.call('GET', '/api/saas/data-export?format=csv&table=workspace_configuration_revisions', { cookie: A.cookie });
  assert.equal(csv.status, 200);
  const lines = csv.text.trim().split(/\r\n/);
  assert.equal(lines[0], 'revision,schema_version,approved_by,approved_at,restored_from,configuration,metadata');
  assert.equal(lines.length, 4);
  assert.match(lines[3], /^3,1,/);
  assert.doesNotMatch(csv.text, /context_hash|[a-f0-9]{64}/);
  const other = await s.call('GET', '/api/saas/data-export', { cookie: B.cookie });
  assert.deepEqual(other.json.tables.workspace_configuration_revisions, [], 'other tenant sees none');
  assert.equal((await s.call('GET', '/api/saas/data-export', { cookie: admin.cookie, headers: { 'X-Organisation-Id': A.org } })).status, 403, 'non-owner refused');
  assert.equal((await s.call('GET', '/api/saas/data-export?format=csv&table=workspace_configuration_revisions', { cookie: admin.cookie, headers: { 'X-Organisation-Id': A.org } })).status, 403);
  assert.equal((await s.call('GET', '/api/saas/data-export')).status, 401);
  const audit = db.prepare("SELECT user_id,metadata_json FROM audit_logs WHERE organisation_id=? AND action='privacy.data_exported' ORDER BY rowid").all(A.org);
  assert.ok(audit.length >= 3 && audit.every((a) => a.user_id === A.uid), 'exports audited to the owner');
});
