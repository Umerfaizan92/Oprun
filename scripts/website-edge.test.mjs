// T-155 (W-09): business websites on their own domains, through Cloudflare for SaaS and the Oprun Worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { createEdge, edgeConfig, edgeHandler, edgeKeyFrom, WORKER_SOURCE } from '../src/website/edge.js';
import { createWebsiteHub } from '../src/website/hub.js';

const ENV = { CLOUDFLARE_SAAS_TOKEN: 'tok', CLOUDFLARE_SAAS_ZONE_ID: 'a'.repeat(32), CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), CLOUDFLARE_SAAS_DOMAIN: 'oprunsites.com', INTEGRATION_ENCRYPTION_KEY: 'server-secret', PUBLIC_BASE_URL: 'https://www.oprun.ai' };
const KEY = edgeKeyFrom('server-secret');

function fakeCloudflare() {
  const calls = [], hostnames = new Map();
  const fetchImpl = async (url, opts = {}) => {
    const path = url.replace('https://api.cloudflare.com/client/v4', ''), method = opts.method || 'GET';
    calls.push(`${method} ${path.split('?')[0]}`);
    const ok = (result) => ({ ok: true, status: 200, json: async () => ({ success: true, result }) });
    if (path.includes('/dns_records') || path.endsWith('/workers/routes')) return ok(method === 'GET' ? [] : {});
    if (path.includes('/custom_hostnames/fallback_origin') || path.includes('/workers/scripts/')) return ok({});
    if (method === 'POST' && path.endsWith('/custom_hostnames')) { const b = JSON.parse(opts.body); const h = { id: crypto.randomUUID(), hostname: b.hostname, status: 'pending', ssl: { status: 'pending_validation', validation_records: [{ txt_name: `_acme-challenge.${b.hostname}`, txt_value: 'abc' }] }, ownership_verification: { type: 'txt', name: `_cf-custom-hostname.${b.hostname}`, value: 'xyz' } }; hostnames.set(h.id, h); return ok(h); }
    const m = /custom_hostnames\/([^/?]+)$/.exec(path);
    if (m && method === 'GET') return ok(hostnames.get(decodeURIComponent(m[1])));
    if (m && method === 'DELETE') { hostnames.delete(decodeURIComponent(m[1])); return ok({ id: m[1] }); }
    return { ok: false, status: 404, json: async () => ({ success: false, errors: [{ message: 'unknown' }] }) };
  };
  return { calls, hostnames, fetchImpl };
}

function setup({ ready = true } = {}) {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT, display_name TEXT, abn TEXT, brand_primary_color TEXT);
    CREATE TABLE onboarding_profiles (organisation_id TEXT PRIMARY KEY, business_type TEXT, phone TEXT, website TEXT, service_area TEXT, services TEXT, brand_voice TEXT);
    CREATE TABLE organisation_integrations (organisation_id TEXT, provider TEXT, status TEXT, settings_json TEXT);
    CREATE TABLE seo_sites (id TEXT PRIMARY KEY, owner_key TEXT, slug TEXT UNIQUE, name TEXT, brand_json TEXT, created_at TEXT);
    CREATE TABLE audit_logs (organisation_id TEXT, user_name TEXT, action TEXT, module TEXT, entity_type TEXT, entity_id TEXT, metadata_json TEXT, created_at TEXT);
    INSERT INTO organisations VALUES ('org-a','Fleet Parlour',NULL,NULL,NULL), ('org-b','Other',NULL,NULL,NULL);
    INSERT INTO seo_sites VALUES ('site-a','org-a','fleet-parlour','Fleet Parlour','{}','2026-01-01'), ('site-b','org-b','other','Other','{}','2026-01-01');`);
  const cf = fakeCloudflare();
  const edge = createEdge({ env: ready ? ENV : {}, fetchImpl: cf.fetchImpl, log: { warn() {}, log() {} } });
  const dns = {};
  const hub = createWebsiteHub({ db, seo: { facts: () => ({}), sites: () => [] }, edge, lookup: async (n, t) => dns[`${t} ${n}`] || [], log: { warn() {}, error() {} } });
  const rendered = [];
  const seo = { renderPublic: (slug, page, prev, form, mount) => { rendered.push({ slug, page, prev, form, mount }); return page === 'missing' ? null : { status: 200, html: `<h1>${slug}/${page}</h1>` }; }, siteSitemap: (slug, mount) => `<urlset>${mount.base}/</urlset>` };
  const handle = edgeHandler({ edge, hub: () => hub, seo });
  return { db, edge, hub, cf, dns, seo, rendered, handle };
}

async function liveDomain(s, org = 'org-a', host = 'www.fleetparlour.com.au') {
  const d = s.hub.addDomain(org, 'u1', { hostname: host }).domain;
  s.dns[`TXT _oprun.${host.replace(/^www\./, '')}`] = [d.records[0].value];
  const r = await s.hub.checkDomain(org, d.id);
  const row = s.db.prepare('SELECT * FROM website_domains WHERE id=?').get(d.id);
  return { d: r.domain, row };
}

function call(handle, { method = 'GET', url = '/', headers = {} } = {}) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const path = url.split('?')[0], query = Object.fromEntries(new URLSearchParams(url.split('?')[1] || ''));
  const req = { method, path, originalUrl: url, query, headers: h, get: (k) => h[k.toLowerCase()] };
  const out = { status: 200, headers: {}, body: null, redirect: null, next: false };
  const res = { status(c) { out.status = c; return res; }, set(k, v) { if (typeof k === 'object') Object.assign(out.headers, k); else out.headers[k] = v; return res; }, type() { return res; }, send(b) { out.body = b; return res; }, redirect(c, to) { out.status = c; out.redirect = to; return res; } };
  handle(req, res, () => { out.next = true; });
  return { out, req };
}
const EDGE = (host, key = KEY) => ({ 'x-oprun-site-host': host, 'x-oprun-edge-key': key });

test('edge config is off until every Cloudflare setting is present, and the Worker never forwards cookies', () => {
  assert.equal(edgeConfig({}).ready, false);
  assert.equal(edgeConfig({ ...ENV, CLOUDFLARE_SAAS_ZONE_ID: 'short' }).ready, false);
  const c = edgeConfig(ENV); assert.equal(c.ready, true); assert.equal(c.target, 'sites.oprunsites.com');
  assert.notEqual(c.key, 'server-secret', 'the shared key is derived, not the server secret itself');
  assert.match(WORKER_SOURCE, /headers\.delete\('cookie'\)/); assert.match(WORKER_SOURCE, /delete\('set-cookie'\)/);
});

test('setup creates the record, Worker, route and fallback origin, and can run again', async () => {
  const s = setup();
  const r = await s.edge.setup(); assert.deepEqual(r.steps, ['dns', 'worker', 'route', 'fallback_origin']);
  assert.ok(s.cf.calls.includes(`POST /zones/${'a'.repeat(32)}/dns_records`));
  assert.ok(s.cf.calls.includes(`PUT /accounts/${'b'.repeat(32)}/workers/scripts/oprun-sites-edge`));
  assert.ok((await s.edge.setup()).ok);
  assert.equal((await setup({ ready: false }).edge.setup()).ok, false);
});

test('a verified domain gets a Cloudflare hostname, its records, and is polled until live; removing deletes it', async () => {
  const s = setup();
  const unverified = s.hub.addDomain('org-a', 'u1', { hostname: 'www.notyet.com.au' }).domain;
  assert.equal(unverified.records.find((r) => r.type === 'CNAME').value, 'sites.oprunsites.com');
  await s.hub.checkDomain('org-a', unverified.id);
  assert.equal(s.cf.hostnames.size, 0, 'nothing is created at Cloudflare before ownership is proved');
  const { d, row } = await liveDomain(s);
  assert.equal(d.status, 'verified'); assert.equal(d.hosting_status, 'ssl_pending'); assert.ok(row.cf_hostname_id);
  assert.ok(d.records.some((r) => r.name === '_cf-custom-hostname.www.fleetparlour.com.au'));
  assert.equal(d.live_url, null);
  const h = s.cf.hostnames.get(row.cf_hostname_id); h.status = 'active'; h.ssl.status = 'active';
  assert.equal(await s.hub.pollHosting(), 1);
  const after = s.hub.overview('org-a').domains.find((x) => x.id === d.id);
  assert.equal(after.hosting_status, 'active'); assert.equal(after.live_url, 'https://www.fleetparlour.com.au/');
  assert.equal(s.hub.hostSite('WWW.FleetParlour.com.au.').slug, 'fleet-parlour');
  assert.ok((await s.hub.removeDomain('org-a', d.id)).ok);
  assert.equal(s.cf.hostnames.size, 0); assert.equal(s.hub.hostSite('www.fleetparlour.com.au'), null);
});

test('requests without the edge header are untouched; a wrong key or unknown host is refused', async () => {
  const s = setup(); await liveDomain(s);
  assert.equal(call(s.handle, { url: '/saas/workspace.html' }).out.next, true);
  assert.equal(call(s.handle, { headers: EDGE('www.fleetparlour.com.au', 'f'.repeat(64)) }).out.status, 403);
  assert.equal(call(s.handle, { headers: EDGE('www.fleetparlour.com.au', 'short') }).out.status, 403);
  assert.equal(call(s.handle, { headers: EDGE('www.unknown.com.au') }).out.status, 404);
  assert.equal(call(s.handle, { headers: EDGE('www.oprun.ai') }).out.status, 404);
  const off = setup({ ready: false });
  assert.equal(call(off.handle, { headers: EDGE('www.fleetparlour.com.au') }).out.status, 403, 'edge requests are refused while hosting is off');
});

test('a live domain shows only its own published pages at the root, with sitemap, robots and redirects', async () => {
  const s = setup(); await liveDomain(s);
  const H = EDGE('www.fleetparlour.com.au');
  let r = call(s.handle, { url: '/', headers: H }).out;
  assert.equal(r.status, 200); assert.match(r.body, /fleet-parlour\/home/); assert.match(r.headers['Content-Security-Policy'], /default-src 'none'/);
  assert.deepEqual(s.rendered.at(-1).mount, { base: 'https://www.fleetparlour.com.au', prefix: '' });
  call(s.handle, { url: '/services?preview=abc', headers: H }); assert.equal(s.rendered.at(-1).prev, null, 'previews are never shown on a custom domain');
  assert.equal(call(s.handle, { url: '/missing', headers: H }).out.status, 404);
  assert.equal(call(s.handle, { url: '/../etc/passwd', headers: H }).out.status, 404);
  assert.equal(call(s.handle, { url: '/sites/other/', headers: H }).out.status, 404, 'another business site is not reachable');
  r = call(s.handle, { url: '/sites/fleet-parlour/services?form=sent', headers: H }).out; assert.equal(r.status, 301); assert.equal(r.redirect, '/services?form=sent');
  assert.match(call(s.handle, { url: '/robots.txt', headers: H }).out.body, /Sitemap: https:\/\/www\.fleetparlour\.com\.au\/sitemap\.xml/);
  // W-06: the cinematic hero files come from the business's own domain; nothing else under /_site/ is served.
  r = call(s.handle, { url: '/_site/cinematic-loader.js?v=1', headers: H }).out; assert.equal(r.status, 200); assert.match(String(r.body), /data-cinematic/); assert.equal(r.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(call(s.handle, { url: '/_site/cinematic.js', headers: H }).out.status, 200);
  assert.equal(call(s.handle, { url: '/_site/hero-3d.js', headers: H }).out.status, 404);
  assert.match(call(s.handle, { url: '/sitemap.xml', headers: H }).out.body, /fleetparlour/);
  s.db.prepare("INSERT INTO website_redirects VALUES ('site-a','org-a','/old-page','/services',301,'transfer','now')").run();
  r = call(s.handle, { url: '/old-page/', headers: H }).out; assert.equal(r.status, 301); assert.equal(r.redirect, '/services');
  assert.equal(call(s.handle, { method: 'POST', url: '/api/saas/website/domains', headers: H }).out.status, 405, 'the app API is never reachable through a business domain');
  assert.equal(call(s.handle, { method: 'POST', url: '/api/public/contact/other', headers: H }).out.status, 405);
});

test('the contact form on the business domain reaches its own business only', async () => {
  const s = setup(); await liveDomain(s);
  const { out, req } = call(s.handle, { method: 'POST', url: '/api/public/contact/fleet-parlour', headers: { ...EDGE('www.fleetparlour.com.au'), origin: 'https://www.fleetparlour.com.au' } });
  assert.equal(out.next, true); assert.equal(req.headers.origin, undefined); assert.equal(req.edgeSite.organisation_id, 'org-a');
});
