// W-07: live pages follow the business's Oprun details. A changed phone number is saved as a new version and goes
// through publishing approval (or publishes alone under the owner's low-risk rule); reviews the owner approved
// appear on the live page without a new version; unpublished edits are never overwritten.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

test('W-07: phone change waits for approval, then goes live; with the low-risk rule it publishes alone', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Harbour Plumbing Pty Ltd', email: 'sync@harbour.example.test' });
  const O = (m, u, b) => s.call(m, u, { cookie: owner.cookie, body: b });
  const profile = (phone) => O('PUT', '/api/saas/seo/profile', { business_name: 'Harbour Plumbing', services: ['Blocked drains'], areas: ['Fremantle'], phone, website_url: '' });
  assert.equal((await profile('0400 111 222')).status, 200);
  const lorem = 'We clear blocked drains for homes and small businesses around Fremantle. You get a written quote before we start, and we leave the site clean. ';
  const content = { title: 'Blocked drains in Fremantle', meta_title: 'Blocked drains in Fremantle | Harbour Plumbing', meta_description: 'Blocked drains in Fremantle from Harbour Plumbing. Written quotes before any work starts.', blocks: [{ type: 'hero', heading: 'Blocked drains in Fremantle', text: lorem, cta_label: 'Get a quote', cta_href: '#contact' }, { type: 'text', heading: 'How it works', text: lorem.repeat(3) }, { type: 'contact', heading: 'Contact', phone: '0400 111 222', email: 'hello@harbour.example.test' }] };
  let r = await O('POST', '/api/saas/seo/sites', { name: 'Harbour Plumbing', slug: 'harbour-sync' }); const site = r.json.site;
  r = await O('POST', `/api/saas/seo/sites/${site.id}/pages`, { title: 'Home', slug: 'home', template: 'home' }); const page = r.json.page;
  assert.equal((await O('PUT', `/api/saas/seo/pages/${page.id}`, { content })).status, 200);
  const approve = async (runId) => { const ap = (await O('GET', '/api/saas/approvals')).json.approvals.find((a) => a.automation_run_id === runId); assert.ok(ap, 'approval waiting'); assert.equal((await O('POST', `/api/saas/approvals/${ap.id}/decision`, { decision: 'approve' })).status, 200); for (let i = 0; i < 80 && !/0400 111 222|0411 999 000|0422 333 444/.test(await live()); i++) await new Promise((x) => setTimeout(x, 25)); };
  const live = async () => (await fetch(`${s.base}/sites/harbour-sync/`)).text();
  r = await O('POST', `/api/saas/seo/pages/${page.id}/publish`, {}); await approve(r.json.run.id);
  assert.match(await live(), /0400 111 222/);

  // Nothing to do while the facts match.
  r = await O('POST', '/api/saas/seo/sites/sync', {}); assert.equal(r.status, 200, r.text); assert.deepEqual(r.json.pages, []);

  // The phone changes in Oprun: a new version is saved and waits for approval; the live page is unchanged until then.
  await profile('0411 999 000');
  r = await O('POST', '/api/saas/seo/sites/sync', {});
  assert.equal(r.json.pages.length, 1); assert.deepEqual(r.json.pages[0].changes, ['phone 0400 111 222 → 0411 999 000']); assert.equal(r.json.pages[0].status, 'awaiting_approval'); const syncRun = r.json.pages[0].run_id;
  assert.match(await live(), /0400 111 222/); assert.doesNotMatch(await live(), /0411 999 000/);
  r = await O('POST', '/api/saas/seo/sites/sync', {}); assert.match(r.json.pages[0].skipped, /not published yet/, 'a second run does not stack up versions');
  await approve(syncRun);
  for (let i = 0; i < 80 && !/0411 999 000/.test(await live()); i++) await new Promise((x) => setTimeout(x, 25));
  const html = await live(); assert.match(html, /href="tel:0411999000"/); assert.match(html, /hello@harbour\.example\.test/, 'the website email is never replaced');

  // With the low-risk rule on, the next phone change publishes alone.
  assert.equal((await O('PUT', '/api/saas/automation/rules/low_risk_site_updates', { enabled: true })).status, 200);
  await profile('0422 333 444');
  r = await O('POST', '/api/saas/seo/sites/sync', {}); assert.equal(r.json.pages[0].status, 'completed', JSON.stringify(r.json));
  assert.match(await live(), /0422 333 444/);

  // Unpublished edits are never overwritten.
  await O('PUT', `/api/saas/seo/pages/${page.id}`, { content: { ...content, blocks: content.blocks.map((b) => (b.type === 'contact' ? { ...b, phone: '0422 333 444' } : b)) }, note: 'Owner draft' });
  await profile('0433 000 111');
  r = await O('POST', '/api/saas/seo/sites/sync', {}); assert.match(r.json.pages[0].skipped, /not published yet/);
});

test('W-07: a review the owner approved appears on the live page without a new version', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Review Co', email: 'rev@review.example.test' });
  const O = (m, u, b) => s.call(m, u, { cookie: owner.cookie, body: b });
  await O('PUT', '/api/saas/seo/profile', { business_name: 'Review Co', services: ['Painting'], areas: ['Perth'], phone: '0400 000 001', website_url: '' });
  const lorem = 'We paint homes around Perth. You get a written quote before we start, and we leave the site clean. ';
  let r = await O('POST', '/api/saas/seo/sites', { name: 'Review Co', slug: 'review-co' });
  const page = (await O('POST', `/api/saas/seo/sites/${r.json.site.id}/pages`, { title: 'Home', slug: 'home', template: 'home' })).json.page;
  await O('PUT', `/api/saas/seo/pages/${page.id}`, { content: { title: 'Painter in Perth', meta_title: 'Painter in Perth | Review Co', meta_description: 'House painting in Perth from Review Co. Written quotes before any work starts.', blocks: [{ type: 'hero', heading: 'Painter in Perth', text: lorem, cta_label: 'Get a quote', cta_href: '#contact' }, { type: 'text', heading: 'How it works', text: lorem.repeat(3) }, { type: 'reviews', heading: 'What customers say' }, { type: 'contact', phone: '0400 000 001' }] } });
  r = await O('POST', `/api/saas/seo/pages/${page.id}/publish`, {});
  const ap = (await O('GET', '/api/saas/approvals')).json.approvals.find((a) => a.automation_run_id === r.json.run.id); await O('POST', `/api/saas/approvals/${ap.id}/decision`, { decision: 'approve' });
  const live = async () => (await fetch(`${s.base}/sites/review-co/`)).text();
  for (let i = 0; i < 80 && (await fetch(`${s.base}/sites/review-co/`)).status !== 200; i++) await new Promise((x) => setTimeout(x, 25));
  assert.doesNotMatch(await live(), /Lovely tidy job/);
  const d = new Database(s.dbPath); t.after(() => d.close());
  const cols = d.prepare('PRAGMA table_info(seo_reviews)').all().map((c) => c.name);
  const row = { owner_key: owner.org, review_id: 'r-1', reviewer: 'Sam K', rating: 5, comment: 'Lovely tidy job, on time.', create_time: new Date().toISOString(), show_on_site: 1, fetched_at: new Date().toISOString(), source: 'Google', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), id: 'rv-1', approved: 1, status: 'approved' };
  const use = cols.filter((c) => c in row);
  d.prepare(`INSERT INTO seo_reviews (${use.join(',')}) VALUES (${use.map(() => '?').join(',')})`).run(...use.map((c) => row[c]));
  const before = (await O('GET', `/api/saas/seo/pages/${page.id}`)).json.page.published_version;
  assert.match(await live(), /Lovely tidy job, on time\./, 'the approved review shows on the live page');
  assert.equal((await O('GET', `/api/saas/seo/pages/${page.id}`)).json.page.published_version, before, 'no new version was needed');
});
