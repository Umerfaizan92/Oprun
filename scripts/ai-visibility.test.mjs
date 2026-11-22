// W-18 / T-199 (D-W18): llms.txt and the owner's AI-crawler setting, on the free address and on the business's own
// domain, owner-only, isolated per business, and llms.txt contains only what the business told Oprun and published.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { edgeKeyFrom } from '../src/website/edge.js';
import { robotsTxt, llmsTxt, ANSWER_BOTS, TRAINING_BOTS } from '../src/seo/ai-visibility.js';

const SECRET = 'e'.repeat(64);
const ENV = { INTEGRATION_ENCRYPTION_KEY: SECRET, CLOUDFLARE_SAAS_TOKEN: 'test-token', CLOUDFLARE_SAAS_ZONE_ID: 'a'.repeat(32), CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), CLOUDFLARE_SAAS_DOMAIN: 'oprunsites.example' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (s, q, ...a) => { const db = new Database(s.dbPath); try { return /^\s*select/i.test(q) ? db.prepare(q).all(...a) : db.prepare(q).run(...a); } finally { db.close(); } };
function member(s, org, role) {
  const db = new Database(s.dbPath), now = new Date().toISOString(), uid = randomUUID(), token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO users (id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(uid, `${role}-${uid}@example.test`, role, 'x', 'x', now, now);
  db.prepare('INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,?,?)').run(org, uid, role, now);
  db.prepare('INSERT INTO user_sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').run(randomUUID(), uid, createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 3600000).toISOString(), now, now);
  db.close(); return 'fp_session=' + token;
}

test('robots.txt rules: default keeps today\'s behaviour; training and all-AI blocks never touch normal search', () => {
  const base = { allowPath: '/', sitemapUrl: 'https://x.au/sitemap.xml', llmsUrl: 'https://x.au/llms.txt' };
  const all = robotsTxt(base);
  assert.match(all, /^User-agent: \*\nAllow: \/\n/); assert.ok(!/Disallow/.test(all)); assert.match(all, /Sitemap: https:\/\/x\.au\/sitemap\.xml/); assert.match(all, /llms\.txt/);
  const nt = robotsTxt({ ...base, mode: 'no_training' });
  for (const b of TRAINING_BOTS) assert.match(nt, new RegExp(`User-agent: ${b}\\nDisallow: /`));
  for (const b of ANSWER_BOTS) assert.ok(!nt.includes(`User-agent: ${b}\n`), `${b} still allowed`);
  const none = robotsTxt({ ...base, mode: 'none' });
  for (const b of [...ANSWER_BOTS, ...TRAINING_BOTS]) assert.ok(none.includes(`User-agent: ${b}\nDisallow: /`));
  assert.ok(!/Googlebot|Bingbot/.test(none), 'normal search engines are never blocked'); assert.ok(!/llms\.txt/.test(none));
  assert.equal(robotsTxt({ ...base, mode: 'bogus' }), all, 'an unknown value falls back to the default');
});

test('llms.txt holds only the business\'s own facts and pages, escaped, one line per value', () => {
  const t = llmsTxt({ name: 'Harbour [Plumbing]', facts: { services: '["Blocked drains","Hot water"]', areas: ['Fremantle'], phone: '0400 111 222\n# injected', abn: '' }, pages: [{ title: 'Home', url: 'https://x.au/', description: 'Line one\nline two' }] });
  assert.match(t, /^# Harbour \\\[Plumbing\\\]\n/);
  assert.match(t, /> Harbour \\\[Plumbing\\\] serving Fremantle: Blocked drains, Hot water\./);
  assert.match(t, /- Phone: 0400 111 222 # injected\n/, 'line breaks cannot start a new markdown heading');
  assert.ok(!/ABN/.test(t), 'empty facts are left out, never invented');
  assert.match(t, /- \[Home\]\(https:\/\/x\.au\/\): Line one line two/);
});

test('live: llms.txt and robots.txt on both addresses, owner-only setting, isolated per business', async (t) => {
  const s = await startServer(ENV); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Harbour Plumbing Pty Ltd' }), other = await seedOwner(s, { email: 'other-ai@example.test', business: 'Other Co' });
  const O = (m, u, b) => s.call(m, u, { cookie: owner.cookie, body: b }), X = (m, u, b) => s.call(m, u, { cookie: other.cookie, body: b });
  assert.equal((await O('PUT', '/api/saas/seo/profile', { business_name: 'Harbour Plumbing', services: ['Blocked drains', 'Hot water repairs'], areas: ['Fremantle', 'Cottesloe'], phone: '0400 111 222', website_url: '' })).status, 200);
  assert.equal((await O('GET', '/api/saas/seo/ai-crawlers')).json.sites.length, 0);
  assert.equal((await O('PUT', '/api/saas/seo/ai-crawlers', { mode: 'no_training' })).status, 404, 'no site yet');
  let r = await O('POST', '/api/saas/seo/sites', { name: 'Harbour Plumbing', slug: 'harbour-ai' }); assert.equal(r.status, 201, r.text);
  r = await O('POST', `/api/saas/seo/sites/${r.json.site.id}/pages`, { title: 'Home', slug: 'home', template: 'home' }); const page = r.json.page;
  assert.equal((await fetch(s.base + '/sites/harbour-ai/llms.txt')).status, 404, 'nothing published, no llms.txt');
  const lorem = 'We clear blocked drains and repair hot water systems for homes and small businesses around Fremantle and Cottesloe. You get a written quote before we start, and we leave the site clean. ';
  r = await O('PUT', `/api/saas/seo/pages/${page.id}`, { content: { title: 'Blocked drains in Fremantle', meta_title: 'Blocked drains | Harbour Plumbing', meta_description: 'Blocked drains and hot water in Fremantle and Cottesloe. Written quotes first.', blocks: [{ type: 'hero', heading: 'Blocked drains in Fremantle', text: lorem, cta_label: 'Get a quote', cta_href: '#contact' }, { type: 'text', heading: 'How it works', text: lorem.repeat(3) }, { type: 'contact', heading: 'Contact us' }], schema: [] } });
  assert.equal(r.status, 200, r.text); assert.equal(r.json.page.checks.blocked, false, JSON.stringify(r.json.page.checks.checks.filter((c) => c.level === 'block')));
  r = await O('POST', `/api/saas/seo/pages/${page.id}/publish`, {});
  const ap = (await O('GET', '/api/saas/approvals')).json.approvals.find((a) => a.automation_run_id === r.json.run.id);
  assert.equal((await O('POST', `/api/saas/approvals/${ap.id}/decision`, { decision: 'approve' })).status, 200);
  for (let i = 0; i < 60; i++) { if ((await fetch(s.base + '/sites/harbour-ai/')).status === 200) break; await sleep(50); }

  let res = await fetch(s.base + '/sites/harbour-ai/llms.txt'); assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /text\/markdown/);
  let txt = await res.text();
  assert.match(txt, /^# Harbour Plumbing\n/); assert.match(txt, /- Blocked drains\n/); assert.match(txt, /- Cottesloe\n/); assert.match(txt, /- Phone: 0400 111 222/);
  assert.match(txt, /\[Blocked drains \| Harbour Plumbing\]\([^)]*\/sites\/harbour-ai\/\): Blocked drains and hot water/);
  let robots = await (await fetch(s.base + '/sites/harbour-ai/robots.txt')).text();
  assert.match(robots, /Allow: \/sites\/harbour-ai\//); assert.ok(!/Disallow/.test(robots), 'default allows all, as before');

  // Only owners and admins can change it; another business cannot touch it.
  const manager = member(s, owner.org, 'manager');
  assert.equal((await s.call('PUT', '/api/saas/seo/ai-crawlers', { cookie: manager, body: { mode: 'none' } })).status, 403);
  assert.equal((await O('PUT', '/api/saas/seo/ai-crawlers', { mode: 'everything' })).status, 400);
  assert.equal((await X('PUT', '/api/saas/seo/ai-crawlers', { mode: 'none' })).status, 404, 'the other business has no site; this one is untouched');
  r = await O('PUT', '/api/saas/seo/ai-crawlers', { mode: 'no_training' }); assert.equal(r.status, 200, r.text); assert.equal(r.json.sites[0].mode, 'no_training');
  robots = await (await fetch(s.base + '/sites/harbour-ai/robots.txt')).text();
  assert.match(robots, /User-agent: GPTBot\nDisallow: \//); assert.ok(!robots.includes('User-agent: OAI-SearchBot'));
  assert.ok(sql(s, "SELECT 1 FROM audit_logs WHERE organisation_id=? AND action='seo.ai_crawlers_set'", owner.org).length, 'the change is in the audit log');

  // The business's own domain serves the same files with its own addresses.
  sql(s, "INSERT INTO website_domains (id,organisation_id,hostname,is_primary,status,verify_token,verified_at,hosting_status,created_at,updated_at) VALUES (?,?,?,1,'verified','t',?,'active',?,?)", randomUUID(), owner.org, 'www.harbour-ai.com.au', new Date().toISOString(), new Date().toISOString(), new Date().toISOString());
  const edge = { 'x-oprun-site-host': 'www.harbour-ai.com.au', 'x-oprun-edge-key': edgeKeyFrom(SECRET) };
  txt = await (await fetch(s.base + '/llms.txt', { headers: edge })).text();
  assert.match(txt, /\]\(https:\/\/www\.harbour-ai\.com\.au\/\)/);
  robots = await (await fetch(s.base + '/robots.txt', { headers: edge })).text();
  assert.match(robots, /^User-agent: \*\nAllow: \/\n/); assert.match(robots, /Sitemap: https:\/\/www\.harbour-ai\.com\.au\/sitemap\.xml/); assert.match(robots, /User-agent: CCBot\nDisallow: \//);

  // Blocking all AI removes llms.txt everywhere.
  assert.equal((await O('PUT', '/api/saas/seo/ai-crawlers', { mode: 'none' })).status, 200);
  assert.equal((await fetch(s.base + '/sites/harbour-ai/llms.txt')).status, 404);
  assert.equal((await fetch(s.base + '/llms.txt', { headers: edge })).status, 404);
  assert.match(await (await fetch(s.base + '/sites/harbour-ai/robots.txt')).text(), /User-agent: PerplexityBot\nDisallow: \//);
  assert.equal((await fetch(s.base + '/sites/no-such-site/robots.txt')).status, 404);
});
