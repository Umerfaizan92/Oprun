import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { verifyAuditChain } from '../src/db.js';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const path = '/api/saas/workspace-configuration';
const configuration = {
  packs: [
    { key: 'operations', label: 'Operations', industry: 'custom', provider_references: [
      { provider: 'youtube', capability: 'publishing' },
      { provider: 'youtube', capability: 'refund' },
      { provider: 'constructor', capability: 'claim' },
    ] },
  ],
  activities: [
    { key: 'advice', label: 'Advisory', pack_key: 'operations' },
    { key: 'service', label: 'On-site service', pack_key: 'operations' },
  ],
};
const expectation = ({ revision, context }) => ({ expected_revision: revision, expected_context: context });
const check = (response, status) => {
  assert.equal(response.status, status, response.text);
  return response.json;
};

test('workspace configuration approval, isolated revisions and rollback through the real server', async t => {
  const server = await startServer();
  t.after(() => server.stop());
  const a = await seedOwner(server);
  const b = await seedOwner(server, { email: 'other@foundation.example.test' });
  const db = new Database(server.dbPath);
  t.after(() => db.close());
  const request = (actor, method, endpoint = '', body, headers) =>
    server.call(method, path + endpoint, { cookie: actor?.cookie, body, headers });
  const get = async (actor, endpoint) => check(await request(actor, 'GET', endpoint), 200);
  const approve = (actor, base, desired = configuration) =>
    request(actor, 'POST', '/approve', { ...expectation(base), configuration: desired });
  const now = new Date().toISOString();
  db.prepare("UPDATE organisations SET country='AU',address_state='WA',modules_json=? WHERE id=?")
    .run('{"modules":{"stock":false,"media":true},"custom_marker":"keep"}', a.org);
  db.prepare('INSERT INTO onboarding_profiles (organisation_id,industry_code,services,pipeline_stages_json,updated_at) VALUES (?,?,?,?,?)')
    .run(a.org, 'custom', '["My customised service"]', '["enquiry","payment"]', now);
  const legacy = () => ({
    modules: db.prepare('SELECT modules_json FROM organisations WHERE id=?').get(a.org),
    profile: db.prepare('SELECT * FROM onboarding_profiles WHERE organisation_id=?').get(a.org),
  });
  const originalLegacy = legacy();

  check(await request(null, 'GET'), 401);
  check(await request(a, 'GET', '', undefined, { 'X-Organisation-Id': b.org }), 403);
  const zero = await get(a);
  assert.equal(zero.revision, 0);
  assert.equal(zero.metadata.jurisdiction.region, 'WA');
  assert.equal(zero.legacy_industry, 'custom');
  assert.deepEqual(zero.configuration, { packs: [], activities: [] });
  assert.equal(db.prepare('SELECT count(*) AS n FROM workspace_configuration_revisions').get().n, 0);

  db.prepare("UPDATE organisations SET address_state='NSW' WHERE id=?").run(a.org);
  check(await approve(a, zero), 409);
  const fresh = await get(a);
  check(await request(a, 'POST', '/approve', { ...expectation(fresh), organisation_id: b.org, configuration }), 400);
  check(await approve(a, fresh, { ...configuration, staff_grants: ['payments.approve'] }), 400);
  check(await approve(a, fresh, { ...configuration,
    packs: [{ ...configuration.packs[0], enable_regulated_capability: true }] }), 400);
  check(await approve(a, fresh, { ...configuration, packs: [] }), 400);
  db.prepare("UPDATE memberships SET role='admin' WHERE organisation_id=? AND user_id=?").run(a.org, a.uid);
  check(await approve(a, fresh), 403);
  db.prepare("UPDATE memberships SET role='owner' WHERE organisation_id=? AND user_id=?").run(a.org, a.uid);

  const peer = await startServer({ DATABASE_PATH: server.dbPath });
  let first;
  try {
    const writes = await Promise.all([
      approve(a, fresh),
      peer.call('POST', path + '/approve', { cookie: a.cookie, body: { ...expectation(fresh), configuration } }),
    ]);
    assert.deepEqual(writes.map(x => x.status).sort(), [201, 409]);
    first = writes.find(x => x.status === 201).json;
  } finally {
    await peer.stop();
  }
  assert.equal(first.revision, 1);
  assert.equal(first.approved_by, a.uid);
  assert.equal(first.configuration.activities.length, 2);
  assert.equal(first.metadata.packs[0].regulated_capability, 'unsupported');
  assert.ok(first.metadata.packs[0].sources.every(source => ['AU', 'NSW'].includes(source.jurisdiction)));
  assert.deepEqual(first.providers.map(({ support, connection, approval }) => [support, connection, approval]), [
    ['catalogued', 'not_connected', 'unknown'],
    ['unsupported', 'unknown', 'not_applicable'],
    ['unknown', 'unknown', 'unknown'],
  ]);
  assert.equal(db.prepare('SELECT count(*) AS n FROM organisation_integrations WHERE organisation_id=?').get(a.org).n, 0);
  assert.deepEqual(legacy(), originalLegacy);
  db.prepare("UPDATE organisations SET country='GB' WHERE id=?").run(b.org);
  const other = await get(b);
  assert.equal(other.revision, 0);
  assert.equal(other.metadata.jurisdiction.metadata_status, 'unsupported');
  assert.equal(other.metadata.jurisdiction.currency, 'GBP');
  check(await request(b, 'GET', '/revisions/1'), 404);
  check(await request(b, 'POST', '/rollback', { ...expectation(await get(b)), target_revision: 1 }), 404);

  const alternate = { ...configuration, activities: [configuration.activities[1]] };
  const second = check(await approve(a, first, alternate), 201);
  assert.equal(second.revision, 2);
  assert.deepEqual((await get(a, '/revisions/1')).configuration, configuration);
  assert.throws(() => db.prepare('UPDATE workspace_configuration_revisions SET approved_by=? WHERE organisation_id=? AND revision=1').run(b.uid, a.org), /immutable/);
  assert.throws(() => db.prepare('DELETE FROM workspace_configuration_revisions WHERE organisation_id=? AND revision=1').run(a.org), /immutable/);

  const thirdUser = await seedOwner(server, { email: 'staff@foundation.example.test' });
  db.prepare("INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,'employee',?)")
    .run(a.org, thirdUser.uid, now);
  const revoke = await server.call('PUT', '/api/saas/team-accounts/members/' + thirdUser.uid + '/permissions', {
    cookie: a.cookie, body: { mode: 'custom', revision: 0, grants: [] },
  });
  check(revoke, 200);
  const policy = () => db.prepare('SELECT * FROM staff_access_policies WHERE organisation_id=? AND user_id=?').get(a.org, thirdUser.uid);
  const revoked = policy();
  const restore = { ...expectation(second), target_revision: 1 };
  check(await request(thirdUser, 'POST', '/rollback', restore, { 'X-Organisation-Id': a.org }), 403);
  check(await request(a, 'POST', '/rollback', { ...restore, expected_revision: 1 }), 409);
  const rolledBack = check(await request(a, 'POST', '/rollback', restore), 201);
  assert.equal(rolledBack.revision, 3);
  assert.equal(rolledBack.restored_from, 1);
  assert.deepEqual(rolledBack.configuration, configuration);
  assert.deepEqual(policy(), revoked);
  assert.deepEqual(legacy(), originalLegacy);
  check(await server.call('GET', '/api/saas/stock', { cookie: a.cookie }), 403);
  assert.equal(verifyAuditChain(db, a.org).ok, true);
  assert.deepEqual(db.prepare(`SELECT action FROM audit_logs WHERE organisation_id=?
    AND action LIKE 'workspace.configuration_%' ORDER BY rowid`).all(a.org).map(row => row.action), [
    'workspace.configuration_approved', 'workspace.configuration_approved', 'workspace.configuration_rolled_back',
  ]);
  db.prepare("UPDATE memberships SET status='revoked' WHERE organisation_id=? AND user_id=?").run(a.org, a.uid);
  check(await approve(a, rolledBack), 401);
});
