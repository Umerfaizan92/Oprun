// T-071 Lead sources: tracked links and QR codes per workspace, visit counting without visitor data, attribution of
// enquiries (website form, manual entry) and the source report. Isolation between workspaces is checked throughout.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

test('tracked links, visits, attribution and the source report stay inside one workspace', async (t) => {
  const s = await startServer();
  t.after(s.stop);
  const a = await seedOwner(s), b = await seedOwner(s, { business: 'Other Co', email: 'other@other.example.test' });
  const get = (o, path) => s.call('GET', path, o ? { cookie: o.cookie } : {});
  const post = (o, path, body = {}) => s.call('POST', path, { cookie: o.cookie, body });
  const link = (o, extra = {}) => post(o, '/api/saas/lead-sources/links', { label: 'Spring offer post', kind: 'link', channel: 'facebook', campaign: 'Spring 2026', area: 'Cockburn 6164', destination: 'https://www.facebook.com/harbourplumbing', ...extra });

  assert.equal((await get(null, '/api/saas/lead-sources')).status, 401);
  const empty = await get(a, '/api/saas/lead-sources');
  assert.equal(empty.status, 200, empty.text);
  assert.deepEqual([empty.json.links.length, empty.json.report.total_leads], [0, 0]);

  // Only the workspace's verified website or a known social/Google service may be a destination.
  for (const bad of ['https://unrelated-site.example/offer', 'http://www.facebook.com/x', 'https://user:pw@facebook.com/x', 'javascript:alert(1)', 'https://facebook.com.unrelated.example/x']) {
    assert.equal((await link(a, { destination: bad })).status, 400, bad);
  }
  const made = await link(a);
  assert.equal(made.status, 201, made.text);
  const L = made.json.link;
  assert.ok(L.short_url.startsWith(s.base + '/l/'));
  assert.match(L.short_url.slice((s.base + '/l/').length), /^[a-z0-9]{8}$/);
  assert.match(L.code, /^[a-z0-9]{8}$/);

  // Another workspace cannot see, archive, print or attribute with it.
  assert.equal((await get(b, '/api/saas/lead-sources')).json.links.length, 0);
  assert.equal((await post(b, `/api/saas/lead-sources/links/${L.id}/archive`)).status, 404);
  assert.equal((await get(b, `/api/saas/lead-sources/links/${L.id}/qr.svg`)).status, 404);
  const qr = await fetch(s.base + `/api/saas/lead-sources/links/${L.id}/qr.svg`, { headers: { cookie: a.cookie } });
  assert.equal(qr.status, 200); assert.match(qr.headers.get('content-type'), /image\/svg\+xml/); assert.match(await qr.text(), /^<svg/);

  // A visit is counted and the code travels on; nothing about the visitor is stored.
  const visit = () => fetch(s.base + '/l/' + L.code, { redirect: 'manual', headers: { 'user-agent': 'Visitor Browser 1.0', 'x-forwarded-for': '203.0.113.9' } });
  const v1 = await visit(); await visit();
  assert.equal(v1.status, 302);
  assert.equal(v1.headers.get('location'), 'https://www.facebook.com/harbourplumbing?sp_src=' + L.code);
  assert.equal((await fetch(s.base + '/l/zzzzzzzz', { redirect: 'manual' })).status, 404);
  assert.equal((await fetch(s.base + '/l/' + encodeURIComponent('../api'), { redirect: 'manual' })).status, 404);
  const db = new Database(s.dbPath);
  assert.equal(db.prepare('SELECT clicks FROM lead_links WHERE id=?').get(L.id).clicks, 2);
  const stored = JSON.stringify([db.prepare('SELECT * FROM lead_links').all(), db.prepare('SELECT * FROM lead_link_days').all()]);
  assert.doesNotMatch(stored, /203\.0\.113\.9|Visitor Browser/);

  // Manual enquiry with the tracked link chosen; another workspace's code is ignored.
  const enquiry = (o, body) => post(o, '/api/saas/pipeline/enquiries', { title: 'Leaking hot water system', channel: 'social', customer: { name: 'Sam Lee', phone: '0400000000' }, ...body });
  const e1 = await enquiry(a, { source_code: L.code });
  assert.equal(e1.status, 201, e1.text);
  const e2 = await enquiry(a, {}), e3 = await enquiry(b, { source_code: L.code });
  assert.equal(e2.status, 201); assert.equal(e3.status, 201);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM lead_attributions WHERE organisation_id=?').get(b.org).n, 0, 'a code from another workspace attributes nothing');
  assert.deepEqual(db.prepare('SELECT link_id,channel,campaign,area FROM lead_attributions WHERE document_id=?').get(e1.json.id), { link_id: L.id, channel: 'facebook', campaign: 'Spring 2026', area: 'Cockburn 6164' });

  // Website form: the code arrives in the form, or in the page address the visitor landed on.
  const slug = db.prepare('SELECT slug FROM organisations WHERE id=?').get(a.org).slug;
  const form = (body, headers = {}) => fetch(s.base + '/api/public/contact/' + slug, { method: 'POST', headers: { 'content-type': 'application/json', origin: s.base, ...headers }, body: JSON.stringify({ name: 'Jo Citizen', email: 'jo@customer.example.test', message: 'Please quote a new tap.', ...body }) });
  assert.equal((await form({ sp_src: L.code })).status, 201);
  assert.equal((await form({ email: 'kim@customer.example.test' }, { referer: s.base + '/sites/' + slug + '/?sp_src=' + L.code })).status, 201);
  assert.equal((await form({ email: 'lee@customer.example.test', sp_src: '<script>' })).status, 201, 'a bad code never blocks the enquiry');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM lead_attributions WHERE organisation_id=? AND link_id=?').get(a.org, L.id).n, 3);

  // Outcome: the first enquiry is quoted, booked and its job is paid.
  const now = new Date().toISOString(), quote = randomUUID(), booking = randomUUID(), job = randomUUID();
  const cust = db.prepare('SELECT customer_id FROM tenant_documents WHERE id=?').get(e1.json.id).customer_id;
  const doc = db.prepare("INSERT INTO tenant_documents (id,organisation_id,kind,customer_id,title,body,amount_cents,source_id,work_order_id,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'',?,?,?,?,?,?,?)");
  db.prepare("INSERT INTO work_orders (id,organisation_id,title,start_at,required_workers,required_level,required_skills,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,1,1,'[]',55000,55000,?,?)").run(job, a.org, 'Hot water', now, now, now);
  doc.run(quote, a.org, 'quote', cust, 'Hot water', 50000, e1.json.id, null, 'accepted', a.uid, now, now);
  doc.run(booking, a.org, 'booking', cust, 'Hot water', 50000, quote, job, 'booked', a.uid, now, now);
  doc.run(randomUUID(), a.org, 'invoice', cust, 'Hot water', 50000, booking, job, 'paid', a.uid, now, now);
  db.close();

  const report = (await get(a, '/api/saas/lead-sources')).json;
  assert.deepEqual([report.report.total_leads, report.report.tracked_leads], [5, 3]);
  const fb = report.report.sources.find((x) => x.key === 'tracked:facebook');
  assert.deepEqual([fb.label, fb.leads, fb.quoted, fb.booked, fb.revenue_cents], ['Facebook', 3, 1, 1, 55000], 'job revenue is counted once');
  assert.deepEqual(report.report.sources.filter((x) => x.key.startsWith('entry:')).map((x) => [x.label, x.leads]).sort(), [['Social media (not tracked)', 1], ['Website form (not tracked)', 1]]);
  assert.deepEqual(report.report.campaigns.map((c) => [c.label, c.leads, c.revenue_cents]), [['Spring 2026', 3, 55000]]);
  assert.deepEqual(report.report.areas.map((c) => [c.label, c.leads]), [['Cockburn 6164', 3]]);
  assert.deepEqual([report.links[0].clicks, report.links[0].leads], [2, 3]);
  const other = (await get(b, '/api/saas/lead-sources')).json;
  assert.deepEqual([other.report.total_leads, other.report.tracked_leads, other.links.length], [1, 0, 0]);
  assert.doesNotMatch(JSON.stringify(other), /Spring 2026|Cockburn|harbourplumbing/);

  // Changing or clearing a source by hand, within the workspace only.
  const set = (o, body) => post(o, '/api/saas/lead-sources/attribute', body);
  assert.equal((await set(b, { enquiry_id: e2.json.id, channel: 'flyer' })).status, 404);
  assert.equal((await set(a, { enquiry_id: e2.json.id, channel: 'flyer', area: 'Success 6164' })).status, 200);
  assert.equal((await get(a, '/api/saas/lead-sources')).json.report.sources.find((x) => x.key === 'tracked:flyer').leads, 1);
  assert.equal((await set(a, { enquiry_id: e2.json.id, channel: null })).status, 200);
  assert.equal((await get(a, '/api/saas/lead-sources')).json.report.tracked_leads, 3);

  // Archiving stops the short address but keeps past results.
  assert.equal((await post(a, `/api/saas/lead-sources/links/${L.id}/archive`)).status, 200);
  assert.equal((await visit()).status, 404);
  const after = (await get(a, '/api/saas/lead-sources')).json;
  assert.equal(after.links.length, 0);
  assert.equal(after.report.sources.find((x) => x.key === 'tracked:facebook').leads, 3);
});
