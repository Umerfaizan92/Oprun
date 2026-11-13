// T-069 Connections safe base: the legacy single-business TikTok routes are Founder only, anonymous callers cannot
// force provider calls, a wrong callback address stops Connect before the subscriber leaves, providers are asked to
// show an account chooser, and one external account serves one workspace only.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { checkOauthRedirect } from '../src/integration-security.js';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

test('callback address check: only this application on a supported route', () => {
  const ok = (provider, uri, extra = {}) => checkOauthRedirect({ provider, uri, allowedHosts: ['app.example'], production: true, ...extra }).ok;
  const base = 'https://app.example/api/saas/integrations/oauth/';
  assert.equal(ok('meta', base + 'meta/callback'), true);
  assert.equal(ok('whatsapp', base + 'meta/callback'), true, 'WhatsApp shares the Meta callback');
  assert.equal(ok('google_business', base + 'youtube/callback'), true, 'Google connectors share one callback');
  assert.equal(ok('google_seo', base + 'google/callback'), true);
  assert.equal(ok('tiktok', 'https://app.example/api/tiktok/callback'), true, 'legacy TikTok callback stays valid');
  assert.equal(ok('x', base + 'x/callback'), true);
  assert.equal(ok('meta', 'https://another-site.example/api/saas/integrations/oauth/meta/callback'), false, 'another website is refused');
  assert.equal(ok('meta', 'https://app.example/connect/facebook'), false, 'unknown route is refused');
  assert.equal(ok('youtube', base + 'google_business/callback'), false, 'sibling segment the callback would reject');
  assert.equal(ok('meta', base + 'whatsapp/callback'), false);
  assert.equal(ok('x', 'https://app.example/api/tiktok/callback'), false);
  assert.equal(ok('meta', 'http://app.example/api/saas/integrations/oauth/meta/callback'), false, 'https is required');
  assert.equal(ok('meta', 'https://user:pw@app.example/api/saas/integrations/oauth/meta/callback'), false);
  assert.equal(ok('meta', 'not a url'), false);
  assert.equal(ok('meta', 'http://localhost/api/saas/integrations/oauth/meta/callback'), false, 'no local address in production');
  assert.equal(ok('meta', 'http://localhost/api/saas/integrations/oauth/meta/callback', { production: false }), true);
});

test('legacy single-business TikTok routes are Founder only and anonymous refresh is ignored', async (t) => {
  const s = await startServer({ TIKTOK_CLIENT_KEY: 'test-client', TIKTOK_CLIENT_SECRET: 'test-secret', TIKTOK_REDIRECT_URI: 'http://localhost/api/tiktok/callback' });
  t.after(s.stop);
  const admin = { 'x-admin-key': s.adminKey };
  const raw = (path, headers = {}) => fetch(s.base + path, { redirect: 'manual', headers });

  const anon = await raw('/api/tiktok/login');
  assert.equal(anon.status, 401, 'anonymous visitors are not sent to TikTok');
  assert.equal(anon.headers.get('location'), null);
  const owner = await seedOwner(s);
  assert.equal((await raw('/api/tiktok/login', { cookie: owner.cookie })).status, 401, 'a subscriber session is not the Founder');
  assert.equal((await raw('/api/tiktok/status')).status, 401);
  assert.equal((await raw('/api/tiktok/status', { cookie: owner.cookie })).status, 401);

  const founder = await raw('/api/tiktok/login', admin);
  assert.equal(founder.status, 302);
  assert.match(founder.headers.get('location'), /^https:\/\/www\.tiktok\.com\/v2\/auth\/authorize/);
  const asJson = await (await raw('/api/tiktok/login?format=json', admin)).json();
  assert.match(asJson.authorize_url, /^https:\/\/www\.tiktok\.com\/v2\/auth\/authorize/);
  const status = await (await raw('/api/tiktok/status', admin)).json();
  assert.equal(status.ok, true);
  assert.equal(status.oauth_configured, true);

  // A callback nobody started through the Founder login is refused: no state, no token saved.
  const forged = await raw('/api/tiktok/callback?code=abc&state=' + 'a'.repeat(64));
  assert.equal(forged.status, 400);
  assert.equal((await (await raw('/api/tiktok/status', admin)).json()).connected, false);

  // Cached figures stay readable; the response is the same shape with or without an anonymous refresh request.
  const plain = await raw('/api/social-stats'), pushed = await raw('/api/social-stats?refresh=1');
  assert.equal(plain.status, pushed.status);
  assert.ok([200, 503].includes(plain.status));
});

test('Connect asks for an account choice and refuses a wrong callback address', async (t) => {
  const s = await startServer({
    GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', TIKTOK_CLIENT_KEY: 'test-client', TIKTOK_CLIENT_SECRET: 'test-secret',
    META_APP_ID: '1234567890', META_APP_SECRET: 'test-secret', META_REDIRECT_URI: 'https://another-site.example/connect/facebook'
  });
  t.after(s.stop);
  const owner = await seedOwner(s);
  await s.call('GET', '/api/saas/integrations/self-service', { cookie: owner.cookie });
  const authorise = (provider) => s.call('POST', '/api/saas/integrations/self-service/' + provider + '/authorise', { cookie: owner.cookie, body: {} });
  const urlOf = (r) => new URL(JSON.stringify(r.json).match(/"authorize_url":"([^"]+)"/)[1]);

  const google = await authorise('youtube');
  assert.equal(google.status, 200, google.text);
  assert.equal(urlOf(google).searchParams.get('prompt'), 'select_account consent');
  const tiktok = await authorise('tiktok');
  assert.equal(tiktok.status, 200, tiktok.text);
  assert.equal(urlOf(tiktok).searchParams.get('disable_auto_auth'), '1');

  const meta = await authorise('meta');
  assert.equal(meta.status, 409, meta.text);
  assert.match(meta.text, /redirect_misconfigured/);
  assert.doesNotMatch(meta.text, /another-site\.example|authorize_url/, 'the subscriber is never handed the wrong address');
  const whatsapp = await authorise('whatsapp');
  assert.equal(whatsapp.status, 409);

  const readiness = await s.call('GET', '/api/admin/integration-readiness', { headers: { 'x-admin-key': s.adminKey } });
  const rows = (readiness.json.integrations || readiness.json.data?.integrations);
  const row = (p) => rows.find((x) => x.provider === p);
  assert.equal(row('meta').redirect_ok, false);
  assert.match(row('meta').redirect_problem, /different website/);
  assert.equal(row('youtube').redirect_ok, true);
  assert.equal(row('website').redirect_ok, null);
});

test('a malformed Meta App ID is treated as not set up; the subscriber is never sent to Facebook with it', async (t) => {
  const s = await startServer({ META_APP_ID: 'fleet-parlour-business', META_APP_SECRET: 'test-secret' });
  t.after(s.stop);
  const owner = await seedOwner(s);
  const list = await s.call('GET', '/api/saas/integrations/self-service', { cookie: owner.cookie });
  const rows = list.json.integrations || list.json.data.integrations;
  for (const p of ['meta', 'whatsapp']) {
    assert.equal(rows.find((x) => x.provider === p).provider_ready, false, p + ' shows as needing platform setup');
    const r = await s.call('POST', '/api/saas/integrations/self-service/' + p + '/authorise', { cookie: owner.cookie, body: {} });
    assert.equal(r.status, 409, r.text);
    assert.doesNotMatch(r.text, /authorize_url|facebook\.com/);
    assert.match(r.text, /META_APP_ID \(must be the App ID number/);
  }
  const readiness = await s.call('GET', '/api/admin/integration-readiness', { headers: { 'x-admin-key': s.adminKey } });
  const meta = (readiness.json.integrations || readiness.json.data?.integrations).find((x) => x.provider === 'meta');
  assert.equal(meta.ready, false);
  assert.match(meta.missing.join(' '), /must be the App ID number/);
  assert.doesNotMatch(JSON.stringify(readiness.json), /fleet-parlour-business|test-secret/, 'the wrong value itself is never echoed');
});

test('a Meta App ID with stray spaces still works', async (t) => {
  const s = await startServer({ META_APP_ID: ' 1234567890123456 ', META_APP_SECRET: 'test-secret' });
  t.after(s.stop);
  const owner = await seedOwner(s);
  await s.call('GET', '/api/saas/integrations/self-service', { cookie: owner.cookie });
  const r = await s.call('POST', '/api/saas/integrations/self-service/meta/authorise', { cookie: owner.cookie, body: {} });
  assert.equal(r.status, 200, r.text);
  assert.equal(new URL(JSON.stringify(r.json).match(/"authorize_url":"([^"]+)"/)[1]).searchParams.get('client_id'), '1234567890123456');
});

test('one external account serves one workspace only', async (t) => {
  const s = await startServer();
  t.after(s.stop);
  const a = await seedOwner(s), b = await seedOwner(s, { business: 'Other Co', email: 'other@other.example.test' });
  for (const o of [a, b]) await s.call('GET', '/api/saas/integrations/self-service', { cookie: o.cookie });
  const page = { id: 'page-111', type: 'facebook_page', label: 'Harbour Plumbing', usable: true };
  const other = { id: 'page-222', type: 'facebook_page', label: 'Second Page', usable: true };
  const db = new Database(s.dbPath);
  const give = (org, provider, resources) => {
    const changed = db.prepare("UPDATE organisation_integrations SET status='connected',settings_json=? WHERE organisation_id=? AND provider=?")
      .run(JSON.stringify({ resources, selected_resources: [] }), org, provider).changes;
    assert.equal(changed, 1, 'integration row exists for ' + provider);
  };
  give(a.org, 'meta', [page]); give(b.org, 'meta', [page, other]);
  db.close();
  const choose = (o, ids, provider = 'meta') => s.call('POST', '/api/saas/integrations/self-service/' + provider + '/resources', { cookie: o.cookie, body: { resource_ids: ids } });

  assert.equal((await choose(a, ['page-111'])).status, 200, 'first workspace takes the Page');
  const refused = await choose(b, ['page-111']);
  assert.equal(refused.status, 409, refused.text);
  assert.match(refused.text, /resource_in_use/);
  assert.match(refused.text, /already connected to another Oprun business/);
  assert.doesNotMatch(refused.text, new RegExp(a.org), 'the other workspace is never identified');
  assert.equal((await choose(b, ['page-222'])).status, 200, 'a different Page is fine');
  assert.equal((await choose(a, ['page-111'])).status, 200, 'the holder can save its own selection again');

  // Releasing the Page frees it for the other workspace.
  assert.equal((await choose(a, [])).status, 200);
  assert.equal((await choose(b, ['page-111', 'page-222'])).status, 200);
  const check = new Database(s.dbPath, { readonly: true });
  const saved = (org) => JSON.parse(check.prepare("SELECT settings_json FROM organisation_integrations WHERE organisation_id=? AND provider='meta'").get(org).settings_json).selected_resources.map((r) => r.id);
  assert.deepEqual(saved(a.org), []);
  assert.deepEqual(saved(b.org), ['page-111', 'page-222']);
  check.close();
});

test('a business can use its own developer app keys: write-only, isolated, used for sign-in, and changes sign out (owner request)', async (t) => {
  const s = await startServer({ GOOGLE_CLIENT_ID: 'platform-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'platform-secret-value' });
  t.after(s.stop);
  const owner = await seedOwner(s), other = await seedOwner(s, { business: 'Second Co', email: 'second@second.example.test' });
  const O = (m, u, body) => s.call(m, u, { cookie: owner.cookie, body });
  const list = async (who = owner) => (await s.call('GET', '/api/saas/integrations/self-service', { cookie: who.cookie })).json.integrations;
  const ready = async (p, who) => (await list(who)).find((x) => x.provider === p).provider_ready;
  assert.equal(await ready('meta'), false, 'no platform Meta app and no own app');
  let keys = (await O('GET', '/api/saas/integrations/self-service/meta/app-keys')).json;
  assert.equal(keys.in_use, 'none'); assert.equal(keys.family, 'meta'); assert.match(keys.callback_url || '', /\/api\/saas\/integrations\/oauth\/meta\/callback$/);
  assert.equal((await O('PUT', '/api/saas/integrations/self-service/meta/app-keys', { client_id: 'not-a-number', client_secret: 'abcdefghijklmnopqrstuvwxyz' })).status, 400);
  const sql = (q, ...a) => { const d = new Database(s.dbPath); try { return /^\s*select/i.test(q) ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } };
  sql("UPDATE organisation_integrations SET status='connected',account_label='Old account',settings_json='{}' WHERE organisation_id=? AND provider='meta'", owner.org);
  const saved = await O('PUT', '/api/saas/integrations/self-service/meta/app-keys', { client_id: '987654321012345', client_secret: 'own-meta-secret-value-123' });
  assert.equal(saved.status, 200); assert.equal(saved.json.in_use, 'own'); assert.deepEqual(saved.json.signed_out, ['meta']);
  assert.ok(!JSON.stringify(saved.json).includes('own-meta-secret-value-123'), 'the secret is never returned');
  assert.ok(!JSON.stringify(sql('SELECT * FROM organisation_oauth_apps')).includes('own-meta-secret-value-123'), 'the secret is stored encrypted');
  assert.equal(sql("SELECT status FROM organisation_integrations WHERE organisation_id=? AND provider='meta'", owner.org)[0].status, 'not_connected');
  assert.equal(await ready('meta'), true); assert.equal(await ready('whatsapp'), true, 'WhatsApp shares the Meta app');
  const auth = await O('POST', '/api/saas/integrations/self-service/meta/authorise', { switch_account: true });
  assert.equal(auth.status, 200, JSON.stringify(auth.json));
  const url = new URL(auth.json.authorize_url);
  assert.equal(url.searchParams.get('client_id'), '987654321012345'); assert.equal(url.searchParams.get('auth_type'), 'reauthenticate');
  assert.equal(await ready('meta', other), false, 'another business does not get these keys');
  assert.equal((await s.call('GET', '/api/saas/integrations/self-service/meta/app-keys', { cookie: other.cookie })).json.in_use, 'none');
  const g = await O('POST', '/api/saas/integrations/self-service/youtube/authorise', {});
  assert.equal(new URL(g.json.authorize_url).searchParams.get('client_id'), 'platform-client.apps.googleusercontent.com', 'Oprun app still used where no own keys exist');
  const removed = await O('DELETE', '/api/saas/integrations/self-service/meta/app-keys');
  assert.equal(removed.json.in_use, 'none'); assert.equal(await ready('meta'), false);
  assert.equal((await O('GET', '/api/saas/integrations/self-service/website/app-keys')).status, 404);
});
