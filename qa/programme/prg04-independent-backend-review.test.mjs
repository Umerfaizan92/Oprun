// PRG-04 independent backend acceptance (Claude). Candidate e8ee522 (Codex), branch codex/prg04-backend-foundation-20261128.
// Synthetic data only: throwaway SQLite files, real server processes from scripts/test-server.mjs, no provider calls.
// Run explicitly: node --test --test-concurrency=1 qa/programme/prg04-independent-backend-review.test.mjs
// (npm test only runs scripts/*.test.mjs, so this file is NOT covered by npm test.)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { createDb, verifyAuditChain } from '../../src/db.js';
import { installWorkspaceConfiguration } from '../../src/workspace-configuration.js';
import { startServer } from '../../scripts/test-server.mjs';
import { seedOwner } from '../../scripts/visual/session.mjs';

const PATH = '/api/saas/workspace-configuration';
const READY_DEADLINE_MS = 45000, CALL_DEADLINE_MS = 20000;
const deadline = (promise, ms, label) => Promise.race([promise, new Promise((_, no) => setTimeout(() => no(new Error(`${label} exceeded ${ms} ms`)), ms).unref())]);
const boot = (env) => deadline(startServer(env), READY_DEADLINE_MS, 'server readiness');
const CONFIG = {
  packs: [{ key: 'plumbing', label: 'Plumbing', industry: 'custom', provider_references: [{ provider: 'youtube', capability: 'publishing' }] },
    { key: 'gas', label: 'Gas fitting', industry: 'custom', provider_references: [] }],
  activities: [{ key: 'repairs', label: 'Repairs', pack_key: 'plumbing' }, { key: 'installs', label: 'Installs', pack_key: 'gas' }],
};
const exp = (v) => ({ expected_revision: v.revision, expected_context: v.context });

async function world() {
  const server = await boot();
  const db = new Database(server.dbPath);
  db.pragma('busy_timeout = 10000');
  const call = (actor, method, endpoint = '', body, headers = {}, target = server) =>
    deadline(target.call(method, PATH + endpoint, { cookie: actor?.cookie, body, headers: { ...(actor?.as ? { 'X-Organisation-Id': actor.as } : {}), ...headers } }), CALL_DEADLINE_MS, `${method} ${endpoint}`);
  const A = await seedOwner(server, { email: 'owner-a@review.example.test', business: 'Review Tenant A' });
  const B = await seedOwner(server, { email: 'owner-b@review.example.test', business: 'Review Tenant B' });
  const member = async (role, email) => {
    const u = await seedOwner(server, { email, business: 'Own ' + role });
    db.prepare('INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,?,?)').run(A.org, u.uid, role, new Date().toISOString());
    return { ...u, as: A.org };
  };
  const counts = (org = A.org) => ({
    revisions: db.prepare('SELECT COUNT(*) n FROM workspace_configuration_revisions WHERE organisation_id=?').get(org).n,
    audits: db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE organisation_id=? AND action LIKE 'workspace.configuration_%'").get(org).n,
  });
  const head = async (actor = A) => { const r = await call(actor, 'GET'); assert.equal(r.status, 200, r.text); return r.json; };
  const stop = async () => { db.close(); await server.stop(); };
  return { server, db, call, A, B, member, counts, head, stop };
}

// ---------- 1. strict request validation ----------
test('strict validation: every malformed or over-reaching payload is 400 and writes nothing', async (t) => {
  const w = await world(); t.after(w.stop);
  const base = await w.head();
  const ok = { ...exp(base), configuration: CONFIG };
  const long = 'x'.repeat(121);
  const bad = [
    ['missing body', undefined], ['array body', []], ['null configuration', { ...exp(base), configuration: null }],
    ['extra top-level organisation_id', { ...ok, organisation_id: w.B.org }], ['extra approved_by', { ...ok, approved_by: w.B.uid }],
    ['extra revision', { ...ok, revision: 9 }], ['target_revision on approve', { ...ok, target_revision: 1 }],
    ['grants in configuration', { ...ok, configuration: { ...CONFIG, grants: ['payments.approve'] } }],
    ['permission on pack', { ...ok, configuration: { ...CONFIG, packs: [{ ...CONFIG.packs[0], permissions: ['all'] }, CONFIG.packs[1]] } }],
    ['regulated activation on pack', { ...ok, configuration: { ...CONFIG, packs: [{ ...CONFIG.packs[0], regulated_capability: 'enabled' }, CONFIG.packs[1]] } }],
    ['execution hook on activity', { ...ok, configuration: { ...CONFIG, activities: [{ ...CONFIG.activities[0], execute: 'refund' }, CONFIG.activities[1]] } }],
    ['provider approval on reference', { ...ok, configuration: { ...CONFIG, packs: [{ ...CONFIG.packs[0], provider_references: [{ provider: 'youtube', capability: 'publishing', approval: 'approved' }] }, CONFIG.packs[1]] } }],
    ['duplicate pack keys', { ...ok, configuration: { ...CONFIG, packs: [CONFIG.packs[0], { ...CONFIG.packs[1], key: 'plumbing' }] } }],
    ['duplicate activity keys', { ...ok, configuration: { ...CONFIG, activities: [CONFIG.activities[0], { ...CONFIG.activities[1], key: 'repairs' }] } }],
    ['dangling pack reference', { ...ok, configuration: { ...CONFIG, activities: [{ ...CONFIG.activities[0], pack_key: 'electrical' }] } }],
    ['uppercase key', { ...ok, configuration: { ...CONFIG, packs: [{ ...CONFIG.packs[0], key: 'Plumbing' }], activities: [] } }],
    ['key with dot', { ...ok, configuration: { ...CONFIG, packs: [{ ...CONFIG.packs[0], key: 'a.b' }], activities: [] } }],
    ['blank label', { ...ok, configuration: { ...CONFIG, packs: [{ ...CONFIG.packs[0], label: '   ' }], activities: [] } }],
    ['label too long', { ...ok, configuration: { ...CONFIG, packs: [{ ...CONFIG.packs[0], label: long }], activities: [] } }],
    ['25 packs', { ...ok, configuration: { packs: Array.from({ length: 25 }, (_, i) => ({ key: 'p' + i, label: 'P', industry: 'custom' })), activities: [] } }],
    ['49 activities', { ...ok, configuration: { packs: [{ key: 'p', label: 'P', industry: 'custom' }], activities: Array.from({ length: 49 }, (_, i) => ({ key: 'a' + i, label: 'A', pack_key: 'p' })) } }],
    ['17 provider references', { ...ok, configuration: { packs: [{ key: 'p', label: 'P', industry: 'custom', provider_references: Array.from({ length: 17 }, (_, i) => ({ provider: 'x' + i, capability: 'c' })) }], activities: [] } }],
    ['string revision', { ...ok, expected_revision: '0' }], ['negative revision', { ...ok, expected_revision: -1 }],
    ['fractional revision', { ...ok, expected_revision: 0.5 }], ['short context', { ...ok, expected_context: 'abc' }],
    ['uppercase context', { ...ok, expected_context: base.context.toUpperCase() }], ['missing context', { expected_revision: 0, configuration: CONFIG }],
  ];
  for (const [label, body] of bad) {
    const r = await w.call(w.A, 'POST', '/approve', body);
    assert.equal(r.status, 400, `${label}: ${r.status} ${r.text}`);
  }
  // A raw JSON "__proto__" member must not slip through strict parsing.
  const raw = `{"expected_revision":0,"expected_context":"${base.context}","configuration":{"packs":[],"activities":[]},"__proto__":{"approved_by":"x"}}`;
  const r = await deadline(fetch(w.server.base + PATH + '/approve', { method: 'POST', headers: { origin: w.server.base, cookie: w.A.cookie, 'content-type': 'application/json' }, body: raw }), CALL_DEADLINE_MS, 'proto');
  assert.equal(r.status, 400, '__proto__ member rejected');
  for (const [label, body] of [['rollback with configuration', { ...exp(base), target_revision: 1, configuration: CONFIG }], ['rollback without target', exp(base)], ['rollback string target', { ...exp(base), target_revision: '1' }]]) {
    assert.equal((await w.call(w.A, 'POST', '/rollback', body)).status, 400, label);
  }
  assert.deepEqual(w.counts(), { revisions: 0, audits: 0 });
  // An empty configuration is a valid explicit approval.
  assert.equal((await w.call(w.A, 'POST', '/approve', { ...exp(base), configuration: { packs: [], activities: [] } })).status, 201);
});

// ---------- 2. active owner only, demotion, revocation, cross-tenant ----------
test('authority: only an active owner of the selected tenant can read or change configuration', async (t) => {
  const w = await world(); t.after(w.stop);
  const admin = await w.member('admin', 'admin@review.example.test');
  const manager = await w.member('manager', 'manager@review.example.test');
  const employee = await w.member('employee', 'employee@review.example.test');
  const base = await w.head();
  const first = await w.call(w.A, 'POST', '/approve', { ...exp(base), configuration: CONFIG });
  assert.equal(first.status, 201, first.text);
  const v1 = first.json;
  for (const actor of [admin, manager, employee, { ...w.B, as: w.A.org }]) {
    for (const [m, e, body] of [['GET', ''], ['GET', '/revisions/1'], ['POST', '/approve', { ...exp(v1), configuration: CONFIG }], ['POST', '/rollback', { ...exp(v1), target_revision: 1 }]]) {
      const r = await w.call(actor, m, e, body);
      assert.ok([403].includes(r.status), `${m} ${e}: expected 403, got ${r.status}`);
      assert.doesNotMatch(r.text, /plumbing|Repairs/i, 'no configuration content leaks in a refusal');
    }
  }
  assert.equal((await w.call(null, 'GET')).status, 401);
  assert.equal((await w.call({ cookie: 'fp_session=' + 'f'.repeat(48) }, 'GET')).status, 401);
  // Another tenant's owner sees only their own empty history.
  assert.equal((await w.call(w.B, 'GET', '/revisions/1')).status, 404);
  assert.equal((await w.head(w.B)).revision, 0);
  // Cache headers on success and refusal.
  const g = await deadline(fetch(w.server.base + PATH + '/revisions/1', { headers: { cookie: w.A.cookie } }), CALL_DEADLINE_MS, 'headers');
  assert.equal(g.headers.get('cache-control'), 'no-store');
  // Demotion takes effect on the next request, including a request made with a valid session.
  w.db.prepare("UPDATE memberships SET role='admin' WHERE organisation_id=? AND user_id=?").run(w.A.org, w.A.uid);
  assert.equal((await w.call(w.A, 'POST', '/approve', { ...exp(v1), configuration: CONFIG })).status, 403);
  assert.equal((await w.call(w.A, 'GET', '/revisions/1')).status, 403);
  w.db.prepare("UPDATE memberships SET role='owner' WHERE organisation_id=? AND user_id=?").run(w.A.org, w.A.uid);
  // A second active owner may approve; once revoked, they cannot.
  const coOwner = await w.member('owner', 'co-owner@review.example.test');
  const v2 = await w.call(coOwner, 'POST', '/approve', { ...exp(v1), configuration: { packs: [], activities: [] } });
  assert.equal(v2.status, 201, v2.text);
  assert.equal(v2.json.approved_by, coOwner.uid);
  w.db.prepare("UPDATE memberships SET status='revoked' WHERE organisation_id=? AND user_id=?").run(w.A.org, coOwner.uid);
  const after = await w.call(coOwner, 'POST', '/approve', { ...exp(v2.json), configuration: CONFIG });
  assert.ok([401, 403].includes(after.status), 'revoked owner refused: ' + after.status);
  assert.deepEqual(w.counts(), { revisions: 2, audits: 2 });
  assert.equal(w.counts(w.B.org).revisions, 0);
});

// ---------- 3. stale revision and every context component ----------
test('stale expectations: an old revision or any legacy context change is 409 and writes nothing', async (t) => {
  const w = await world(); t.after(w.stop);
  const now = new Date().toISOString();
  w.db.prepare("UPDATE organisations SET country='AU',address_state='WA',modules_json='{\"modules\":{\"stock\":false}}' WHERE id=?").run(w.A.org);
  w.db.prepare("INSERT INTO onboarding_profiles (organisation_id,industry_code,services,pipeline_stages_json,updated_at) VALUES (?,'custom','[\"a\"]','[\"enquiry\"]',?)").run(w.A.org, now);
  const changes = [
    ["UPDATE organisations SET country='NZ' WHERE id=?", "UPDATE organisations SET country='AU' WHERE id=?"],
    ["UPDATE organisations SET address_state='VIC' WHERE id=?", "UPDATE organisations SET address_state='WA' WHERE id=?"],
    ["UPDATE organisations SET state='QLD' WHERE id=?", "UPDATE organisations SET state=NULL WHERE id=?"],
    ["UPDATE organisations SET modules_json='{\"modules\":{\"stock\":true}}' WHERE id=?", "UPDATE organisations SET modules_json='{\"modules\":{\"stock\":false}}' WHERE id=?"],
    ["UPDATE onboarding_profiles SET industry_code='electrical' WHERE organisation_id=?", "UPDATE onboarding_profiles SET industry_code='custom' WHERE organisation_id=?"],
    ["UPDATE onboarding_profiles SET services='[\"b\"]' WHERE organisation_id=?", "UPDATE onboarding_profiles SET services='[\"a\"]' WHERE organisation_id=?"],
    ["UPDATE onboarding_profiles SET pipeline_stages_json='[\"quote\"]' WHERE organisation_id=?", "UPDATE onboarding_profiles SET pipeline_stages_json='[\"enquiry\"]' WHERE organisation_id=?"],
  ];
  for (const [change, undo] of changes) {
    const base = await w.head();
    w.db.prepare(change).run(w.A.org);
    const r = await w.call(w.A, 'POST', '/approve', { ...exp(base), configuration: CONFIG });
    assert.equal(r.status, 409, change);
    w.db.prepare(undo).run(w.A.org);
    assert.equal((await w.head()).context, base.context, 'restoring the value restores the context');
  }
  assert.deepEqual(w.counts(), { revisions: 0, audits: 0 });
  const v0 = await w.head();
  const v1 = (await w.call(w.A, 'POST', '/approve', { ...exp(v0), configuration: CONFIG })).json;
  assert.equal((await w.call(w.A, 'POST', '/approve', { ...exp(v0), configuration: CONFIG })).status, 409, 'replay of an old base');
  assert.equal((await w.call(w.A, 'POST', '/approve', { ...exp(v1), expected_revision: 2, configuration: CONFIG })).status, 409, 'future base');
  assert.deepEqual(w.counts(), { revisions: 1, audits: 1 });
  // Observation O1: connection state that GET shows is not part of the context hash.
  const before = (await w.head()).context;
  w.db.prepare("INSERT INTO organisation_integrations (organisation_id,provider,display_name,status,updated_at) VALUES (?,?,?,?,?)").run(w.A.org, 'youtube', 'YouTube', 'connected', now);
  const seen = await w.head();
  assert.equal(seen.context, before, 'O1: provider connection change does not change context');
  assert.equal(seen.providers[0].connection, 'connected');
  // Observation O1 continued: the existing onboarding route changes context, so a stale approval is refused.
  const put = await deadline(w.server.call('PUT', '/api/saas/onboarding', { cookie: w.A.cookie, body: { services: ['Synthetic new service'] } }), CALL_DEADLINE_MS, 'onboarding');
  if (put.status === 200) assert.equal((await w.call(w.A, 'POST', '/approve', { ...exp(seen), configuration: CONFIG })).status, 409, 'onboarding edit invalidates the approval base');
});

// ---------- 4. rollback, history, metadata and no authority grants ----------
test('rollback appends, uses current jurisdiction, never restores revoked permissions or provider state', async (t) => {
  const w = await world(); t.after(w.stop);
  const employee = await w.member('employee', 'employee2@review.example.test');
  w.db.prepare("UPDATE organisations SET country='AU',address_state='WA' WHERE id=?").run(w.A.org);
  const snapshot = () => ({
    staff: w.db.prepare('SELECT * FROM staff_access_policies WHERE organisation_id=? ORDER BY user_id').all(w.A.org),
    members: w.db.prepare('SELECT * FROM memberships WHERE organisation_id=? ORDER BY user_id').all(w.A.org),
    integrations: w.db.prepare('SELECT * FROM organisation_integrations WHERE organisation_id=?').all(w.A.org),
    modules: w.db.prepare('SELECT modules_json FROM organisations WHERE id=?').get(w.A.org),
    subscription: w.db.prepare('SELECT plan_id,status FROM organisation_subscriptions WHERE organisation_id=?').get(w.A.org),
  });
  const v0 = await w.head();
  const v1 = (await w.call(w.A, 'POST', '/approve', { ...exp(v0), configuration: CONFIG })).json;
  assert.equal(v1.revision, 1);
  assert.equal(v1.metadata.jurisdiction.region, 'WA');
  assert.ok(v1.providers.every((p) => p.approval !== 'approved'), 'provider approval never asserted');
  assert.equal(v1.providers[0].approval, 'unknown');
  assert.ok(v1.metadata.packs.every((p) => p.regulated_capability === 'unsupported'));
  const v2 = (await w.call(w.A, 'POST', '/approve', { ...exp(v1), configuration: { packs: [CONFIG.packs[1]], activities: [CONFIG.activities[1]] } })).json;
  // Revoke the employee's grants after revision 1, then roll back to revision 1.
  const revoke = await deadline(w.server.call('PUT', `/api/saas/team-accounts/members/${employee.uid}/permissions`, { cookie: w.A.cookie, body: { mode: 'custom', revision: 0, grants: [] } }), CALL_DEADLINE_MS, 'revoke');
  assert.equal(revoke.status, 200, revoke.text);
  w.db.prepare("UPDATE organisations SET address_state='VIC' WHERE id=?").run(w.A.org);
  const base = await w.head();
  const before = snapshot();
  for (const [target, status] of [[0, 404], [99, 404], [2, 409], [3, 404]]) {
    assert.equal((await w.call(w.A, 'POST', '/rollback', { ...exp(base), target_revision: target })).status, status, 'target ' + target);
  }
  const v3 = await w.call(w.A, 'POST', '/rollback', { ...exp(base), target_revision: 1 });
  assert.equal(v3.status, 201, v3.text);
  assert.equal(v3.json.revision, 3);
  assert.equal(v3.json.restored_from, 1);
  assert.deepEqual(v3.json.configuration, CONFIG);
  assert.equal(v3.json.metadata.jurisdiction.region, 'VIC', 'metadata recomputed for the current jurisdiction');
  assert.deepEqual(snapshot(), before, 'no permission, membership, integration, module or subscription change');
  // History is unchanged and readable only within the tenant.
  assert.deepEqual((await w.call(w.A, 'GET', '/revisions/1')).json.configuration, CONFIG);
  assert.equal((await w.call(w.A, 'GET', '/revisions/1')).json.metadata.jurisdiction.region, 'WA', 'historical metadata preserved');
  assert.deepEqual((await w.call(w.A, 'GET', '/revisions/2')).json.configuration, v2.configuration);
  for (const bad of ['0', '01', '-1', '1.0', '1e0', 'abc', '9007199254740993']) assert.equal((await w.call(w.A, 'GET', '/revisions/' + bad)).status, 404, bad);
  // Audit attribution and chain integrity.
  const audits = w.db.prepare("SELECT action,user_id,user_role,entity_id,metadata_json FROM audit_logs WHERE organisation_id=? AND action LIKE 'workspace.configuration_%' ORDER BY rowid").all(w.A.org);
  assert.deepEqual(audits.map((a) => [a.action, a.user_id, a.user_role, a.entity_id]), [
    ['workspace.configuration_approved', w.A.uid, 'owner', '1'], ['workspace.configuration_approved', w.A.uid, 'owner', '2'],
    ['workspace.configuration_rolled_back', w.A.uid, 'owner', '3']]);
  assert.equal(JSON.parse(audits[2].metadata_json).restored_from, 1);
  assert.equal(verifyAuditChain(w.db, w.A.org).ok, true);
  // Jurisdiction metadata for unsupported and unknown locations.
  for (const [country, region, status, sub, currency] of [['', null, 'unknown', 'unknown', null], ['NZ', null, 'unsupported', 'unknown', 'NZD'], ['au', 'xx', 'reference_available', 'unsupported', 'AUD'], ['AU', 'nsw', 'reference_available', 'reference_available', 'AUD']]) {
    w.db.prepare('UPDATE organisations SET country=?,address_state=?,state=NULL WHERE id=?').run(country, region, w.B.org);
    const j = (await w.head(w.B)).metadata.jurisdiction;
    assert.deepEqual([j.metadata_status, j.subdivision_status, j.currency], [status, sub, currency], `${country}/${region}`);
  }
});

// ---------- 5. immutability through unintended database paths; legitimate tenant deletion ----------
test('history cannot be altered through SQL; legitimate tenant deletion removes only that tenant', async (t) => {
  const w = await world(); t.after(w.stop);
  for (const who of [w.A, w.B]) {
    const v0 = await w.head(who);
    assert.equal((await w.call(who, 'POST', '/approve', { ...exp(v0), configuration: CONFIG })).status, 201);
  }
  const row = () => w.db.prepare('SELECT * FROM workspace_configuration_revisions WHERE organisation_id=? AND revision=1').get(w.A.org);
  const original = row();
  const attempts = [
    ['UPDATE', "UPDATE workspace_configuration_revisions SET configuration_json='{}' WHERE organisation_id=?"],
    ['UPDATE OR REPLACE', "UPDATE OR REPLACE workspace_configuration_revisions SET approved_by='x' WHERE organisation_id=?"],
    ['UPDATE organisation_id', "UPDATE workspace_configuration_revisions SET organisation_id='other' WHERE organisation_id=?"],
    ['DELETE', 'DELETE FROM workspace_configuration_revisions WHERE organisation_id=?'],
    ['INSERT OR REPLACE', "INSERT OR REPLACE INTO workspace_configuration_revisions VALUES (?,1,1,'{}','{}','h','x','t',NULL)"],
    ['REPLACE', "REPLACE INTO workspace_configuration_revisions VALUES (?,1,1,'{}','{}','h','x','t',NULL)"],
    ['INSERT duplicate', "INSERT INTO workspace_configuration_revisions VALUES (?,1,1,'{}','{}','h','x','t',NULL)"],
    ['UPSERT', "INSERT INTO workspace_configuration_revisions VALUES (?,1,1,'{}','{}','h','x','t',NULL) ON CONFLICT DO UPDATE SET approved_by='x'"],
  ];
  for (const [label, sql] of attempts) {
    assert.throws(() => w.db.prepare(sql).run(w.A.org), /immutable|constraint/i, label);
    assert.deepEqual(row(), original, label + ' left the row unchanged');
  }
  // INSERT OR IGNORE is refused too: the BEFORE INSERT trigger aborts before the IGNORE conflict rule applies.
  assert.throws(() => w.db.prepare("INSERT OR IGNORE INTO workspace_configuration_revisions VALUES (?,1,1,'{}','{}','h','x','t',NULL)").run(w.A.org), /immutable/);
  assert.deepEqual(row(), original);
  // Legitimate tenant deletion, part 1: the account-deletion job's statement on a real server database. It is blocked by
  // the PRE-EXISTING governance_ledger trigger (finding P1, outside PRG-04), and the failed transaction changes nothing.
  const B = w.B.org;
  w.db.pragma('foreign_keys = ON');
  assert.ok(w.db.prepare('SELECT COUNT(*) n FROM governance_ledger WHERE organisation_id=?').get(B).n > 0, 'seeded tenant has governance ledger rows');
  assert.throws(() => w.db.transaction(() => { w.db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(w.B.uid); w.db.prepare('DELETE FROM organisations WHERE id=?').run(B); })(), /governance ledger is append-only/);
  assert.equal(w.counts(B).revisions, 1, 'P1: tenant and its history remain; nothing partially deleted');
  assert.ok(w.db.prepare('SELECT 1 FROM organisations WHERE id=?').get(B));
  assert.deepEqual(row(), original, 'other tenant history intact');
  // Observation O2: with foreign keys off, deleting a tenant leaves its revisions orphaned and then deletable.
  const C = await seedOwner(w.server, { email: 'owner-c@review.example.test', business: 'Review Tenant C' });
  assert.equal((await w.call(C, 'POST', '/approve', { ...exp(await w.head(C)), configuration: CONFIG })).status, 201);
  w.db.pragma('foreign_keys = OFF');
  w.db.prepare('DELETE FROM organisations WHERE id=?').run(C.org);
  assert.equal(w.counts(C.org).revisions, 1, 'O2: orphaned revision remains');
  w.db.prepare('DELETE FROM workspace_configuration_revisions WHERE organisation_id=?').run(C.org);
  assert.equal(w.counts(C.org).revisions, 0, 'O2: an orphaned revision can be deleted');
  w.db.pragma('foreign_keys = ON');
});

// ---------- 6. concurrency across three server processes ----------
test('concurrency: three server processes, independent connections, exactly one approval per base, no 5xx', async (t) => {
  const w = await world();
  const peers = [];
  t.after(async () => { await Promise.allSettled(peers.map((p) => p.stop())); await w.stop(); });
  for (let i = 0; i < 2; i++) peers.push(await boot({ DATABASE_PATH: w.server.dbPath }));
  const servers = [w.server, ...peers];
  for (const s of servers) assert.equal((await w.call(w.A, 'GET', '', undefined, {}, s)).status, 200, 'each process authenticates the same session');
  const ROUNDS = 6, PER_SERVER = 2;
  for (let round = 0; round < ROUNDS; round++) {
    const base = await w.head();
    const rollbackRound = round >= 2 && round % 2 === 0;
    const body = rollbackRound ? { ...exp(base), target_revision: 1 } : { ...exp(base), configuration: { ...CONFIG, activities: [{ key: 'r' + round, label: 'Round ' + round, pack_key: 'plumbing' }] } };
    const endpoint = rollbackRound ? '/rollback' : '/approve';
    const results = await Promise.all(servers.flatMap((s) => Array.from({ length: PER_SERVER }, () => w.call(w.A, 'POST', endpoint, body, {}, s))));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, ...Array(servers.length * PER_SERVER - 1).fill(409)], `round ${round}: ${statuses}`);
    const won = results.find((r) => r.status === 201).json;
    assert.equal(won.revision, base.revision + 1);
  }
  const revs = w.db.prepare('SELECT revision FROM workspace_configuration_revisions WHERE organisation_id=? ORDER BY revision').all(w.A.org).map((r) => r.revision);
  assert.deepEqual(revs, Array.from({ length: ROUNDS }, (_, i) => i + 1), 'contiguous history, no gaps or duplicates');
  assert.deepEqual(w.counts(), { revisions: ROUNDS, audits: ROUNDS }, 'one audit row per revision');
  assert.equal(verifyAuditChain(w.db, w.A.org).ok, true);
  for (const s of servers) assert.doesNotMatch(s.log(), /SQLITE_BUSY|database is locked|UnhandledPromise/i);
});

// ---------- 7. failure injection on the real installer ----------
// The installer prepares statements that need columns added by installModuleRules and installOnboardingProposal, which
// server.js installs first (observation O4). Reproduce exactly those two additive columns.
function prepareSchema(db) {
  db.exec('ALTER TABLE organisations ADD COLUMN modules_json TEXT');
  db.exec('ALTER TABLE onboarding_profiles ADD COLUMN pipeline_stages_json TEXT');
  return db;
}
function unit({ capabilities = () => ['publishing'] } = {}) {
  const db = prepareSchema(createDb(':memory:')), routes = new Map(), now = new Date().toISOString();
  const org = crypto.randomUUID(), uid = crypto.randomUUID();
  db.prepare('INSERT INTO organisations (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(org, 'Unit', 'unit-' + org.slice(0, 6), now, now);
  db.prepare("INSERT INTO users (id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,'x','x',?,?)").run(uid, uid + '@unit.test', 'Unit Owner', now, now);
  db.prepare("INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,'owner',?)").run(org, uid, now);
  const app = Object.fromEntries(['get', 'post'].map((m) => [m, (p, ...h) => routes.set(m + ' ' + p, h)]));
  const provider = { fn: capabilities };
  installWorkspaceConfiguration(app, { db, requireSaasUser: (req, res, next) => next(), getProviderCapabilities: (p) => provider.fn(p) });
  const run = (method, endpoint, body) => {
    const handlers = routes.get(method + ' ' + PATH + endpoint);
    const req = { body, params: {}, saas: { organisation_id: org, user_id: uid, role: 'owner', full_name: 'Unit Owner' } };
    const res = { statusCode: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } };
    let i = 0; const next = () => { const h = handlers[++i]; if (h) h(req, res, next); };
    handlers[0](req, res, next);
    return res;
  };
  const state = () => ({
    revisions: db.prepare('SELECT * FROM workspace_configuration_revisions ORDER BY revision').all(),
    audits: db.prepare("SELECT action,entity_id FROM audit_logs WHERE action LIKE 'workspace.configuration_%' ORDER BY rowid").all(),
  });
  return { db, run, state, provider, org };
}

test('failure injection: an audit failure or a late failure inside the transaction leaves no revision and no audit row', () => {
  const u = unit();
  try {
    const head = () => u.run('get', '').body;
    const empty = u.state();
    u.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs WHEN NEW.action LIKE 'workspace.configuration_%' BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END");
    assert.throws(() => u.run('post', '/approve', { ...exp(head()), configuration: CONFIG }), /synthetic audit failure/);
    assert.deepEqual(u.state(), empty, 'no revision survives an audit failure');
    assert.equal(u.db.inTransaction, false);
    u.db.exec('DROP TRIGGER fail_audit');
    u.provider.fn = () => { throw new Error('synthetic provider catalogue failure'); };
    assert.throws(() => u.run('post', '/approve', { ...exp(head()), configuration: CONFIG }), /synthetic provider catalogue failure/);
    assert.deepEqual(u.state(), empty, 'a failure after insert and audit rolls both back');
    u.provider.fn = () => ['publishing'];
    const v1 = u.run('post', '/approve', { ...exp(head()), configuration: CONFIG });
    assert.equal(v1.statusCode, 201);
    assert.equal(v1.body.revision, 1, 'no gap left by failed attempts');
    const v2 = u.run('post', '/approve', { ...exp(v1.body), configuration: { packs: [], activities: [] } });
    assert.equal(v2.statusCode, 201);
    const afterTwo = u.state();
    u.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs WHEN NEW.action LIKE 'workspace.configuration_%' BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END");
    assert.throws(() => u.run('post', '/rollback', { ...exp(v2.body), target_revision: 1 }), /synthetic audit failure/);
    assert.deepEqual(u.state(), afterTwo, 'failed rollback leaves history and audit unchanged');
    u.db.exec('DROP TRIGGER fail_audit');
    const v3 = u.run('post', '/rollback', { ...exp(v2.body), target_revision: 1 });
    assert.equal(v3.statusCode, 201);
    assert.equal(v3.body.revision, 3);
    assert.equal(verifyAuditChain(u.db, u.org).ok, true);
  } finally { u.db.close(); }
});

test('existing database compatibility: install on a pre-PRG-04 database is additive, idempotent and creates no rows', () => {
  const bare = createDb(':memory:');
  assert.throws(() => installWorkspaceConfiguration({ get() {}, post() {} }, { db: bare, requireSaasUser() {}, getProviderCapabilities: () => [] }), /no such column/, 'O4: installer depends on columns added by other installers');
  bare.close();
  const db = prepareSchema(createDb(':memory:'));
  try {
    const before = db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    const app = { get() {}, post() {} };
    for (let i = 0; i < 3; i++) installWorkspaceConfiguration(app, { db, requireSaasUser() {}, getProviderCapabilities: () => [] });
    const after = db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    const added = after.filter((o) => !before.some((b) => b.name === o.name)).map((o) => o.type + ':' + o.name).sort();
    assert.deepEqual(added, ['table:workspace_configuration_revisions', 'trigger:workspace_configuration_no_delete', 'trigger:workspace_configuration_no_replace', 'trigger:workspace_configuration_no_update']);
    for (const b of before) assert.equal(after.find((o) => o.name === b.name)?.sql, b.sql, 'existing object unchanged: ' + b.name);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM workspace_configuration_revisions').get().n, 0);
  } finally { db.close(); }
});

test('legitimate tenant deletion, part 2: with only the PRG-04 trigger, the cascade removes that tenant\'s history and nothing else', () => {
  const db = prepareSchema(createDb(':memory:'));
  try {
    installWorkspaceConfiguration({ get() {}, post() {} }, { db, requireSaasUser() {}, getProviderCapabilities: () => [] });
    const now = new Date().toISOString();
    for (const id of ['org-del', 'org-keep']) {
      db.prepare('INSERT INTO organisations (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(id, id, id, now, now);
      db.prepare("INSERT INTO workspace_configuration_revisions VALUES (?,1,1,'{}','{}','h','u',?,NULL)").run(id, now);
    }
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    assert.throws(() => db.prepare("DELETE FROM workspace_configuration_revisions WHERE organisation_id='org-del'").run(), /immutable/, 'direct delete refused while the tenant exists');
    db.prepare("DELETE FROM organisations WHERE id='org-del'").run();
    assert.equal(db.prepare("SELECT COUNT(*) n FROM workspace_configuration_revisions WHERE organisation_id='org-del'").get().n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM workspace_configuration_revisions WHERE organisation_id='org-keep'").get().n, 1);
  } finally { db.close(); }
});

test('observation O3: schema-drift diagnostics and the tenant data export do not know the new table', async () => {
  const { referenceSchema } = await import('../../src/diagnostics.js');
  const ref = referenceSchema();
  assert.equal(Object.hasOwn(ref.tables, 'workspace_configuration_revisions'), false, 'O3: not in the db.js reference schema');
  assert.equal(ref.triggers.some((x) => x.name.startsWith('workspace_configuration_')), false, 'O3: immutability triggers not checked by diagnostics');
  const src = (await import('node:fs')).readFileSync(new URL('../../src/saas-platform.js', import.meta.url), 'utf8');
  assert.equal(/workspace_configuration_revisions/.test(src), false, 'O3: data export has no entry for configuration revisions');
});
