// T-147: the Website section's server rules (build, transfer, domains, email, growth, activity, isolation).
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { createWebsiteHub, createDnsLookup } from '../src/website/hub.js';

const A = 'org-a', B = 'org-b';
function setup({ aiText = null, dns = {}, crawlResult = null } = {}) {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT, display_name TEXT, abn TEXT, brand_primary_color TEXT);
    CREATE TABLE onboarding_profiles (organisation_id TEXT PRIMARY KEY, business_type TEXT, phone TEXT, website TEXT, service_area TEXT, services TEXT, brand_voice TEXT);
    CREATE TABLE organisation_integrations (organisation_id TEXT, provider TEXT, status TEXT, settings_json TEXT);
    CREATE TABLE seo_sites (id TEXT PRIMARY KEY, owner_key TEXT, slug TEXT UNIQUE, name TEXT, brand_json TEXT, created_at TEXT);
    CREATE TABLE seo_site_pages (id TEXT PRIMARY KEY, site_id TEXT, owner_key TEXT, slug TEXT, title TEXT, content TEXT, published_version INTEGER, UNIQUE(site_id, slug));
    CREATE TABLE audit_logs (organisation_id TEXT, user_name TEXT, action TEXT, module TEXT, entity_type TEXT, entity_id TEXT, metadata_json TEXT, created_at TEXT);
    INSERT INTO organisations VALUES ('${A}','Fleet Parlour',NULL,'12345678901','#123456'), ('${B}','Other Co',NULL,NULL,NULL);
    INSERT INTO onboarding_profiles VALUES ('${A}','Detailing','0404 946 656',NULL,'Success WA, Cockburn','["Bull bar polishing","Paint correction"]','Friendly');`);
  const seo = {
    facts: () => ({ services: [], areas: [], phone: '', email: 'owner@fleet.example' }),
    createSite: (o, { name, slug, brand }) => { const id = crypto.randomUUID(); db.prepare('INSERT INTO seo_sites VALUES (?,?,?,?,?,?)').run(id, o, slug, name, JSON.stringify(brand), new Date().toISOString()); return { ok: true, site: { id, slug, url: `https://www.oprun.ai/sites/${slug}/` } }; },
    createPage: (o, siteId, { title, slug, content }) => { if (db.prepare('SELECT 1 FROM seo_site_pages WHERE site_id=? AND slug=?').get(siteId, slug)) return { ok: false, status: 409 }; const id = crypto.randomUUID(); db.prepare('INSERT INTO seo_site_pages VALUES (?,?,?,?,?,?,NULL)').run(id, siteId, o, slug, title, JSON.stringify(content)); return { ok: true, page: { id, slug } }; },
    sites: (o) => db.prepare('SELECT * FROM seo_sites WHERE owner_key=?').all(o).map((s) => ({ id: s.id, name: s.name, url: `https://www.oprun.ai/sites/${s.slug}/`, pages: db.prepare('SELECT * FROM seo_site_pages WHERE site_id=?').all(s.id) }))
  };
  const lookups = [];
  const lookup = async (name, type) => { lookups.push([name, type]); return dns[`${type} ${name}`] || []; };
  const crawls = [];
  const crawl = async (url, opts) => { crawls.push({ url, ...opts }); return crawlResult || { ok: false, error: 'no crawl' }; };
  const ai = aiText === null ? null : async () => ({ text: aiText });
  const hub = createWebsiteHub({ db, seo, ai, lookup, crawl, log: { warn() {}, error() {} } });
  return { db, hub, lookups, crawls };
}
const BUILD = { name: 'Fleet Parlour', services: ['Bull bar polishing', 'Paint correction'], areas: ['Success WA', 'Cockburn'], pages: ['home', 'services', 'faq', 'contact'] };

test('building creates draft pages from the business facts only, once', async () => {
  const s = setup();
  assert.equal((await s.hub.buildNew(A, 'u1', { name: 'F', services: [], areas: [] })).status, 400);
  const r = await s.hub.buildNew(A, 'u1', { ...BUILD, difference: 'Mobile service, we come to you.' });
  assert.ok(r.ok); assert.equal(r.pages.length, 4); assert.equal(r.wording, 'plain');
  const home = JSON.parse(s.db.prepare("SELECT content FROM seo_site_pages WHERE slug='home'").get().content);
  assert.equal(home.blocks[0].type, 'hero'); assert.match(home.meta_title, /^Fleet Parlour \| Bull bar polishing in Success WA/);
  assert.ok(home.blocks.some((b) => b.type === 'text' && b.text === 'Mobile service, we come to you.'));
  const faq = JSON.parse(s.db.prepare("SELECT content FROM seo_site_pages WHERE slug='faq'").get().content);
  assert.deepEqual(faq.blocks.find((b) => b.type === 'faq').items, [], 'no invented FAQ without AI facts');
  assert.ok(s.db.prepare('SELECT 1 FROM seo_site_pages WHERE published_version IS NOT NULL').get() === undefined, 'nothing is published');
  assert.equal((await s.hub.buildNew(A, 'u1', BUILD)).status, 409, 'one website per business');
  assert.ok((await s.hub.buildNew(B, 'u2', { ...BUILD, name: 'Fleet Parlour' })).ok, 'another business can use the same name with its own address');
  assert.equal(s.db.prepare('SELECT COUNT(DISTINCT slug) n FROM seo_sites').get().n, 2);
});

test('AI wording is used only for the services asked for, and bad AI output falls back to plain wording', async () => {
  const s = setup({ aiText: JSON.stringify({ tagline: 'Shine that lasts', intro: 'We polish.', about: 'Local.', services: { 'Bull bar polishing': 'Mirror finish.', 'Free cars': 'invented' }, faq: [{ q: 'Do you come to me?', a: 'Yes.' }] }) });
  const r = await s.hub.buildNew(A, 'u1', BUILD);
  assert.equal(r.wording, 'ai');
  const svc = JSON.parse(s.db.prepare("SELECT content FROM seo_site_pages WHERE slug='services'").get().content);
  assert.deepEqual(svc.blocks.filter((b) => b.type === 'text').map((b) => b.heading), ['Bull bar polishing', 'Paint correction']);
  assert.ok(!JSON.stringify(svc).includes('Free cars'));
  const bad = setup({ aiText: 'not json' });
  assert.equal((await bad.hub.buildNew(A, 'u1', BUILD)).wording, 'plain');
});

test('transfer only reads a website the business has verified, and keeps old addresses with redirects', async () => {
  const crawlResult = { ok: true, pages: [
    { url: 'https://fleet.example/', status: 200, title: 'Fleet Parlour', description: 'Detailing', headings: [{ level: 1, text: 'Welcome' }], text: 'We polish bull bars. Mobile service.', words: 6, robots: '' },
    { url: 'https://fleet.example/services/bull-bars/', status: 200, title: 'Bull bars', description: '', headings: [], text: 'Bull bar polishing.', words: 3, robots: '' },
    { url: 'https://fleet.example/private', status: 200, title: 'Hidden', text: 'x', robots: 'noindex' },
    { url: 'https://fleet.example/gone', status: 404, title: 'x', text: '' }] };
  const s = setup({ crawlResult });
  assert.match((await s.hub.transfer(A, 'u1', { url: 'https://fleet.example' })).error, /prove you own/);
  assert.equal(s.crawls.length, 0, 'no crawl before ownership is proved');
  s.db.prepare("INSERT INTO organisation_integrations VALUES (?, 'website', 'connected', ?)").run(A, JSON.stringify({ website: { url: 'https://fleet.example', hostname: 'fleet.example', verified: true } }));
  assert.match((await s.hub.transfer(A, 'u1', { url: 'https://someone-else.example' })).error, /prove you own/);
  assert.match((await s.hub.transfer(B, 'u2', { url: 'https://fleet.example' })).error, /prove you own/, 'another business cannot bring in this site');
  const r = await s.hub.transfer(A, 'u1', { url: 'https://www.fleet.example' });
  assert.ok(r.ok, r.error); assert.equal(r.pages_imported, 2); assert.equal(r.site_created, true);
  assert.equal(s.crawls[0].maxPages, 30);
  const redirects = s.db.prepare('SELECT from_path,to_path FROM website_redirects ORDER BY from_path').all();
  assert.deepEqual(redirects, [{ from_path: '/services/bull-bars', to_path: '/services-bull-bars' }]);
  assert.equal(s.db.prepare("SELECT status FROM website_transfers").get().status, 'imported');
});

test('domains: validated, unique across businesses, verified only by the exact DNS record', async () => {
  const s = setup();
  for (const bad of ['', 'localhost', 'oprun.ai', 'http://', 'no_dots', 'a.b']) assert.equal(s.hub.addDomain(A, 'u1', { hostname: bad }).status, 400, bad);
  const r = s.hub.addDomain(A, 'u1', { hostname: 'https://www.FleetParlour.com.au/' });
  assert.ok(r.ok); assert.equal(r.domain.hostname, 'www.fleetparlour.com.au'); assert.equal(r.domain.is_primary, true);
  const rec = r.domain.records[0];
  assert.equal(rec.name, '_oprun.fleetparlour.com.au'); assert.match(rec.value, /^oprun-verify=[0-9a-f]{32}$/);
  assert.match(s.hub.addDomain(B, 'u2', { hostname: 'www.fleetparlour.com.au' }).error, /another Oprun business/);
  assert.match(s.hub.addDomain(A, 'u1', { hostname: 'www.fleetparlour.com.au' }).error, /already added/);
  let c = await s.hub.checkDomain(A, r.domain.id);
  assert.equal(c.domain.status, 'dns_pending');
  assert.equal((await s.hub.checkDomain(B, r.domain.id)).status, 404, 'another business cannot check it');
  const ok = setup({ dns: { 'TXT _oprun.fleetparlour.com.au': [] } });
  const d = ok.hub.addDomain(A, 'u1', { hostname: 'fleetparlour.com.au' }).domain;
  ok.lookups.length = 0;
  const dns = { [`TXT _oprun.fleetparlour.com.au`]: [d.records[0].value], 'A fleetparlour.com.au': ['1.2.3.4'], 'MX fleetparlour.com.au': ['1 smtp.google.com'] };
  const ok2 = createWebsiteHub({ db: ok.db, seo: {}, lookup: async (n, t) => dns[`${t} ${n}`] || [], log: { warn() {}, error() {} } });
  c = await ok2.checkDomain(A, d.id);
  assert.equal(c.domain.status, 'verified'); assert.equal(c.domain.check.resolves, true); assert.equal(c.domain.check.has_email, true);
  assert.equal(ok2.removeDomain(B, d.id).status, 404);
  assert.ok(ok2.removeDomain(A, d.id).ok);
});

test('email: needs an added domain, merges SPF into one record, and verifies MX, SPF and DMARC', async () => {
  const dns = { 'MX fleettest.com.au': ['1 smtp.google.com'], 'TXT fleettest.com.au': ['v=spf1 include:_spf.google.com include:amazonses.com ~all'], 'TXT _dmarc.fleettest.com.au': ['v=dmarc1; p=none'] };
  const s = setup({ dns });
  assert.match((await s.hub.emailSetup(A, 'u1', { domain: 'fleettest.com.au', provider: 'google' })).error, /Add this domain/);
  s.hub.addDomain(A, 'u1', { hostname: 'www.fleettest.com.au' });
  const r = await s.hub.emailSetup(A, 'u1', { domain: 'fleettest.com.au', provider: 'google' });
  assert.ok(r.ok); assert.equal(r.email.status, 'verified');
  const spf = r.email.records.find((x) => x.type === 'TXT' && x.value.startsWith('v=spf1')).value;
  assert.equal((spf.match(/v=spf1/g) || []).length, 1); assert.match(spf, /include:_spf\.google\.com/); assert.match(spf, /include:amazonses\.com/, 'existing senders are kept');
  assert.equal(r.email.records.find((x) => x.type === 'MX').value, 'smtp.google.com');
  const ms = setup({ dns: {} }); ms.hub.addDomain(A, 'u1', { hostname: 'fleettest.com.au' });
  const m = await ms.hub.emailSetup(A, 'u1', { domain: 'fleettest.com.au', provider: 'microsoft' });
  assert.equal(m.email.status, 'records_ready'); assert.equal(m.email.records[0].value, 'fleettest-com-au.mail.protection.outlook.com');
  assert.equal((await ms.hub.emailCheck(B, 'fleettest.com.au')).status, 404);
});

test('growth: listings saved per business; Search Console export imported and compared; nothing sent', () => {
  const s = setup();
  assert.equal(s.hub.saveListing(A, 'u1', 'not-a-listing', { status: 'listed' }).status, 404);
  assert.equal(s.hub.saveListing(A, 'u1', 'yelp', { status: 'listed', url: 'http://insecure' }).status, 400);
  assert.ok(s.hub.saveListing(A, 'u1', 'yelp', { status: 'listed', url: 'https://www.yelp.com.au/biz/fleet' }).ok);
  assert.equal(s.hub.listings(A).find((l) => l.key === 'yelp').status, 'listed');
  assert.equal(s.hub.listings(B).find((l) => l.key === 'yelp').status, 'not_started');
  assert.equal(s.hub.importLinks(A, 'u1', { csv: 'Page,Clicks\n/a,1\n/b,2' }).status, 400);
  const first = s.hub.importLinks(A, 'u1', { csv: 'Site,Linking pages,Target pages\nexample.com.au,"1,204",3\nlocal-news.example,4,1' });
  assert.equal(first.referring_domains, 2); assert.equal(first.links, 1208); assert.deepEqual(first.new_sites, []);
  const second = s.hub.importLinks(A, 'u1', { csv: 'Site,Linking pages\nexample.com.au,1200\nsupplier.example,2' });
  assert.deepEqual(second.new_sites, ['supplier.example']); assert.deepEqual(second.lost_sites, ['local-news.example']);
  assert.equal(s.hub.growth(B).snapshots.length, 0);
});

test('activity shows only this business website and SEO entries', () => {
  const s = setup();
  const add = s.db.prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)');
  add.run(A, 'Faizan', 'website.domain_added', 'website', 'website_domain', 'd1', '{}', '2026-11-20T01:00:00Z');
  add.run(A, 'Faizan', 'seo.audit_run', 'seo', null, null, '{}', '2026-11-20T02:00:00Z');
  add.run(A, 'Faizan', 'invoice.issued', 'invoice', null, null, '{}', '2026-11-20T03:00:00Z');
  add.run(B, 'Other', 'website.domain_added', 'website', null, null, '{}', '2026-11-20T04:00:00Z');
  assert.deepEqual(s.hub.activity(A).map((x) => x.action), ['seo.audit_run', 'website.domain_added']);
});

test('DNS-over-HTTPS lookup reads answers and treats NXDOMAIN as empty', async () => {
  const calls = [];
  const lookup = createDnsLookup({ fetchImpl: async (url, opt) => { calls.push([url, opt.headers.accept]); return Response.json(url.includes('missing') ? { Status: 3 } : { Status: 0, Answer: [{ data: '"oprun-verify=ABC"' }, { data: 'smtp.google.com.' }] }); } });
  assert.deepEqual(await lookup('_oprun.fleet.example', 'TXT'), ['oprun-verify=abc', 'smtp.google.com']);
  assert.deepEqual(await lookup('missing.example', 'TXT'), []);
  assert.match(calls[0][0], /^https:\/\/cloudflare-dns\.com\/dns-query\?name=_oprun\.fleet\.example&type=TXT$/);
  assert.equal(calls[0][1], 'application/dns-json');
});
