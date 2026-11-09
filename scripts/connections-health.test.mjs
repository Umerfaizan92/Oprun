// T-070 Accounts tab: one health light per connection, honest capability ticks, the account confirm step, the
// background health sweep and Meta's long-lived sign-in exchange.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { connectionHealth, healthCheckDue, providerActions, CONNECT_CHECKLIST } from '../src/integration-health.js';
import { createIntegrationRuntime } from '../src/integration-runtime.js';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const NOW = Date.parse('2026-11-10T00:00:00Z'), iso = (ms) => new Date(NOW + ms).toISOString(), DAY = 86400000;
const health = (provider, settings, status = 'connected') => connectionHealth({ provider, status, settings, now: NOW });
const good = { last_tested_at: iso(-3600000), last_test_status: 'pass', resources: [{ id: 'p1', type: 'facebook_page' }], selected_resources: [{ id: 'p1', type: 'facebook_page' }] };

test('health light: each state has one meaning and one fix', () => {
  assert.equal(health('meta', {}, 'not_connected').level, 'off');
  assert.deepEqual([health('meta', good).level, health('meta', good).fix], ['green', null]);
  assert.deepEqual([health('meta', { ...good, account_confirmed: false }).level, health('meta', { ...good, account_confirmed: false }).fix], ['amber', 'confirm']);
  const revoked = health('meta', { ...good, last_test_status: 'fail', diagnostic: { code: 'reconnect_required', action: 'Reconnect.' } });
  assert.deepEqual([revoked.level, revoked.fix, revoked.title], ['red', 'connect', 'Reconnect needed']);
  assert.equal(health('youtube', { ...good, last_test_status: 'fail', diagnostic: { code: 'permission_required' } }).title, 'Permission needed');
  // A provider outage is never red.
  assert.equal(health('meta', { ...good, last_test_status: 'fail', diagnostic: { code: 'temporarily_unavailable' } }).level, 'amber');
  // Meta has no background renewal: an expired sign-in is red, one expiring within a week is amber.
  assert.equal(health('meta', { ...good, expires_at: iso(-1000) }).level, 'red');
  assert.deepEqual([health('meta', { ...good, expires_at: iso(3 * DAY) }).level, health('meta', { ...good, expires_at: iso(3 * DAY) }).title], ['amber', 'Sign-in expires soon']);
  assert.equal(health('meta', { ...good, expires_at: iso(30 * DAY) }).level, 'green');
  // Google renews in the background: a short access expiry is normal and stays green.
  assert.equal(health('youtube', { ...good, expires_at: iso(-1000) }).level, 'green');
  assert.equal(health('tiktok', { ...good, expires_at: iso(-1000), refresh_expires_at: iso(-1000) }).level, 'red');
  assert.equal(health('tiktok', { ...good, refresh_expires_at: iso(2 * DAY) }).level, 'amber');
  assert.deepEqual([health('meta', { ...good, selected_resources: [] }).fix, health('meta', { ...good, last_tested_at: null }).fix], ['select', 'test']);
  assert.equal(health('meta', { ...good, last_test_status: 'partial' }).title, 'Partly working');
  assert.equal(health('email_sms', { last_tested_at: iso(-1000), last_test_status: 'pass' }).level, 'green');
});

test('background check is due once a day for connected provider sign-ins only', () => {
  const due = (provider, settings, status = 'connected') => healthCheckDue({ provider, status, settings, now: NOW });
  assert.equal(due('meta', { token_bundle: 'x' }), true);
  assert.equal(due('meta', { token_bundle: 'x', health_checked_at: iso(-2 * 3600000) }), false);
  assert.equal(due('meta', { token_bundle: 'x', health_checked_at: iso(-25 * 3600000) }), true);
  assert.equal(due('meta', { token_bundle: 'x' }, 'not_connected'), false);
  assert.equal(due('email_sms', { token_bundle: 'x' }), false);
  assert.equal(due('meta', {}), false);
});

test('capability ticks state limits and never claim what is not built', () => {
  const state = (p, key) => providerActions(p).find((a) => a.key === key);
  assert.equal(state('meta', 'post').state, 'partial');
  assert.match(state('meta', 'post').note, /Facebook Page text posts only/);
  for (const [p, key] of [['meta', 'messages'], ['meta', 'comments'], ['youtube', 'video'], ['tiktok', 'post'], ['snapchat', 'post']]) assert.equal(state(p, key).state, 'not_yet', p + ' ' + key);
  assert.equal(state('tiktok', 'messages').state, 'not_offered');
  assert.match(state('whatsapp', 'messages').note, /Meta charges per message/);
  assert.deepEqual(providerActions('website'), []);
  for (const p of ['meta', 'whatsapp', 'tiktok', 'youtube', 'google_business', 'x', 'snapchat']) assert.ok(CONNECT_CHECKLIST[p].length > 0);
  assert.ok(Object.values(CONNECT_CHECKLIST).flat().every((line) => !/password/i.test(line) || /never your password/i.test(line)));
});

test('Meta sign-in is exchanged for the long-lived one; a failed exchange keeps the original', async () => {
  const calls = [];
  const runtime = createIntegrationRuntime({ env: { INTEGRATION_ENCRYPTION_KEY: 'test-encryption-only', META_APP_ID: '123', META_APP_SECRET: 'app-secret', META_GRAPH_VERSION: 'v25.0' }, fetchImpl: async (url) => { calls.push(String(url)); return Response.json({ access_token: 'long-token', token_type: 'bearer', expires_in: 5184000 }); } });
  const short = runtime.normalizeToken({ access_token: 'short-token', expires_in: 3600 });
  const long = await runtime.extendMetaToken(short);
  assert.equal(long.access_token, 'long-token');
  assert.ok(new Date(long.expires_at).getTime() - Date.now() > 59 * DAY, 'about 60 days');
  assert.match(calls[0], /graph\.facebook\.com\/v25\.0\/oauth\/access_token\?grant_type=fb_exchange_token/);
  const noExpiry = createIntegrationRuntime({ env: { INTEGRATION_ENCRYPTION_KEY: 'k', META_APP_ID: '1', META_APP_SECRET: 's' }, fetchImpl: async () => Response.json({ access_token: 'long-token' }) });
  assert.equal((await noExpiry.extendMetaToken(short)).expires_at, undefined, 'no stale short expiry is kept');
  const unconfigured = createIntegrationRuntime({ env: { INTEGRATION_ENCRYPTION_KEY: 'k' }, fetchImpl: async () => { throw new Error('must not be called'); } });
  assert.equal((await unconfigured.extendMetaToken(short)).access_token, 'short-token');
  const failing = createIntegrationRuntime({ env: { INTEGRATION_ENCRYPTION_KEY: 'k', META_APP_ID: '1', META_APP_SECRET: 'app-secret' }, fetchImpl: async () => Response.json({ error: { message: 'bad app-secret', code: 190 } }, { status: 400 }) });
  await assert.rejects(() => failing.extendMetaToken(short), (e) => !/app-secret/.test(e.message));
});

test('confirm step gates use of a new connection; the sweep flags an expired sign-in and tells the owner once', async (t) => {
  const key = 'a'.repeat(64);
  const s = await startServer({ INTEGRATION_ENCRYPTION_KEY: key });
  t.after(s.stop);
  const a = await seedOwner(s), b = await seedOwner(s, { business: 'Other Co', email: 'other@other.example.test' });
  for (const o of [a, b]) await s.call('GET', '/api/saas/integrations/self-service', { cookie: o.cookie });
  const runtime = createIntegrationRuntime({ env: { INTEGRATION_ENCRYPTION_KEY: key } });
  const page = { id: 'page-1', type: 'facebook_page', label: 'Harbour Plumbing', usable: true };
  const db = new Database(s.dbPath);
  const set = (org, settings) => assert.equal(db.prepare("UPDATE organisation_integrations SET status='connected',account_label='Alex Morgan',connected_at=?,settings_json=? WHERE organisation_id=? AND provider='meta'").run(new Date().toISOString(), JSON.stringify(settings), org).changes, 1);
  // Workspace A: a fresh sign-in, not yet confirmed, whose provider token has already expired.
  set(a.org, { token_bundle: runtime.encryptBundle({ access_token: 'expired-token', expires_at: new Date(Date.now() - 60000).toISOString() }), expires_at: new Date(Date.now() - 60000).toISOString(), resources: [page], selected_resources: [], account_confirmed: false });
  db.close();
  const list = async (o) => { const r = await s.call('GET', '/api/saas/integrations/self-service', { cookie: o.cookie }); return (r.json.integrations || r.json.data.integrations).find((x) => x.provider === 'meta'); };
  const post = (o, path, body = {}) => s.call('POST', '/api/saas/integrations/self-service/meta/' + path, { cookie: o.cookie, body });

  let row = await list(a);
  assert.equal(row.needs_confirmation, true);
  assert.deepEqual([row.health.level, row.health.fix], ['amber', 'confirm']);
  assert.ok(row.checklist.length && row.actions.length);
  assert.doesNotMatch(JSON.stringify(row), /expired-token|token_bundle/, 'no token material reaches the page');
  const early = await post(a, 'resources', { resource_ids: ['page-1'] });
  assert.equal(early.status, 409); assert.match(early.text, /confirmation_required/);
  assert.equal((await post(b, 'confirm')).status, 409, 'another workspace cannot confirm it');
  assert.equal((await post(a, 'confirm')).status, 200);
  row = await list(a);
  assert.equal(row.needs_confirmation, false);
  assert.equal(row.health.level, 'red', 'expired Meta sign-in shows as reconnect');
  assert.equal((await post(a, 'resources', { resource_ids: ['page-1'] })).status, 200);

  // Founder-only sweep: flags the expired sign-in without any network call and notifies the owner.
  assert.equal((await s.call('POST', '/api/admin/integrations/health-sweep')).status, 401);
  assert.equal((await s.call('POST', '/api/admin/integrations/health-sweep', { cookie: a.cookie })).status, 401);
  const sweep = await s.call('POST', '/api/admin/integrations/health-sweep', { headers: { 'x-admin-key': s.adminKey } });
  assert.equal(sweep.status, 200, sweep.text);
  assert.deepEqual([sweep.json.checked, sweep.json.attention, sweep.json.healthy], [1, 1, 0]);
  row = await list(a);
  assert.deepEqual([row.health.level, row.health.title, row.last_test_status], ['red', 'Reconnect needed', 'fail']);
  assert.ok(row.health.checked_at);
  assert.equal((await list(b)).status, 'not_connected', 'the other workspace is untouched');
  const again = await s.call('POST', '/api/admin/integrations/health-sweep', { headers: { 'x-admin-key': s.adminKey } });
  assert.equal(again.json.checked, 0, 'not checked again within a day');
  const check = new Database(s.dbPath, { readonly: true });
  const notes = check.prepare("SELECT organisation_id,title,link FROM user_notifications WHERE kind='connection_attention'").all();
  check.close();
  assert.equal(notes.length, 0, 'already red before the sweep, so no repeat alert');
});

test('the sweep alerts the owner when a working connection stops working', async (t) => {
  const key = 'b'.repeat(64);
  const s = await startServer({ INTEGRATION_ENCRYPTION_KEY: key });
  t.after(s.stop);
  const a = await seedOwner(s);
  await s.call('GET', '/api/saas/integrations/self-service', { cookie: a.cookie });
  const runtime = createIntegrationRuntime({ env: { INTEGRATION_ENCRYPTION_KEY: key } });
  const db = new Database(s.dbPath);
  // Looked healthy at the last check two days ago; the stored sign-in has no usable token any more.
  const old = new Date(Date.now() - 2 * DAY).toISOString();
  db.prepare("UPDATE organisation_integrations SET status='connected',account_label='Alex',settings_json=? WHERE organisation_id=? AND provider='meta'")
    .run(JSON.stringify({ token_bundle: runtime.encryptBundle({ access_token: '' }), last_tested_at: old, last_test_status: 'pass', resources: [{ id: 'p', type: 'facebook_page' }], selected_resources: [{ id: 'p', type: 'facebook_page' }] }), a.org);
  db.close();
  const sweep = await s.call('POST', '/api/admin/integrations/health-sweep', { headers: { 'x-admin-key': s.adminKey } });
  assert.deepEqual([sweep.json.checked, sweep.json.attention], [1, 1], sweep.text);
  const check = new Database(s.dbPath, { readonly: true });
  const notes = check.prepare("SELECT organisation_id,title,link FROM user_notifications WHERE kind='connection_attention'").all();
  check.close();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].organisation_id, a.org);
  assert.match(notes[0].title, /needs reconnecting/);
  assert.equal(notes[0].link, '#b08/connections');
});
