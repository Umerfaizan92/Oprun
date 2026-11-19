// T-145: quote acceptance links and review requests (send, public pages, accept/decline, reviews, safety rules).
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { createCustomerLinks } from '../src/customer-links.js';
import { createOutbound } from '../src/comms/outbound.js';

const ORG = 'org-fleet';
const FUTURE = new Date(Date.now() + 5 * 86400000).toISOString();

function setup({ smsReady = true } = {}) {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT, display_name TEXT, timezone TEXT, brand_primary_color TEXT);
    CREATE TABLE tenant_customers (id TEXT PRIMARY KEY, organisation_id TEXT, name TEXT, email TEXT, phone TEXT, address TEXT);
    CREATE TABLE tenant_documents (id TEXT PRIMARY KEY, organisation_id TEXT, kind TEXT, customer_id TEXT, title TEXT, body TEXT, amount_cents INTEGER, gst_applies INTEGER DEFAULT 1, gst_cents INTEGER DEFAULT 0, start_at TEXT, source_id TEXT, work_order_id TEXT, status TEXT, revision INTEGER DEFAULT 1, acceptance_evidence TEXT, estimated_hours REAL, reference TEXT, updated_at TEXT);
    CREATE TABLE work_orders (id TEXT PRIMARY KEY, organisation_id TEXT, title TEXT, customer_id TEXT, completed_at TEXT);
    CREATE TABLE comms_threads (id TEXT PRIMARY KEY, organisation_id TEXT, channel TEXT, contact_address TEXT, contact_name TEXT, subject TEXT, status TEXT, last_message_at TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE comms_messages (id TEXT PRIMARY KEY, organisation_id TEXT, thread_id TEXT, direction TEXT, kind TEXT, body TEXT, provider TEXT, status TEXT, ai_generated INTEGER, approval_id TEXT, created_by_user_id TEXT, occurred_at TEXT, created_at TEXT);
    CREATE TABLE comms_message_schedule (message_id TEXT PRIMARY KEY, organisation_id TEXT, send_at TEXT, state TEXT, error TEXT, created_by TEXT, created_at TEXT, updated_at TEXT);
    INSERT INTO organisations VALUES ('${ORG}','Fleet Parlour','Fleet Parlour','Australia/Perth','#1f3a5f');
    INSERT INTO organisations VALUES ('org-other','Other Co',NULL,'Australia/Sydney',NULL);
    INSERT INTO tenant_customers VALUES ('cust-1','${ORG}','Faiz <b>Anul</b>','faiz@example.com','0404 946 656','12 Main St, Success WA');
    INSERT INTO tenant_customers VALUES ('cust-2','${ORG}','No Contact',NULL,'(08) 6289 1786',NULL);
    INSERT INTO tenant_documents (id,organisation_id,kind,customer_id,title,status,reference) VALUES ('enq-1','${ORG}','enquiry','cust-1','Bull bar','quoted','ENQ-1001');
    INSERT INTO tenant_documents (id,organisation_id,kind,customer_id,title,body,amount_cents,gst_cents,source_id,status,revision) VALUES ('q-1','${ORG}','quote','cust-1','Aluminium bull bar polishing','SsangYong Actyon 2009',45000,4500,'enq-1','approved',2);
    INSERT INTO tenant_documents (id,organisation_id,kind,customer_id,title,amount_cents,status) VALUES ('q-draft','${ORG}','quote','cust-1','Draft quote',1000,'draft');
    INSERT INTO tenant_documents (id,organisation_id,kind,customer_id,title,amount_cents,status) VALUES ('q-2','${ORG}','quote','cust-2','Landline only',1000,'approved');
    INSERT INTO work_orders VALUES ('job-1','${ORG}','Aluminium bull bar polishing','cust-1','2026-11-19T05:00:00Z');
    INSERT INTO work_orders VALUES ('job-open','${ORG}','Not done yet','cust-1',NULL);
    INSERT INTO tenant_documents (id,organisation_id,kind,customer_id,title,work_order_id,status) VALUES ('b-1','${ORG}','booking','cust-1','Aluminium bull bar polishing','job-1','completed');`);
  const booked = [], alerts = [], events = [], links = [];
  const pipeline = {
    enquiryReference: (org, id) => { let d = db.prepare('SELECT * FROM tenant_documents WHERE id=?').get(id); while (d && d.kind !== 'enquiry' && d.source_id) d = db.prepare('SELECT * FROM tenant_documents WHERE id=?').get(d.source_id); return d?.reference || null; },
    bookQuote: (org, actor, q, opts) => {
      if (db.prepare("UPDATE tenant_documents SET status='booked' WHERE id=? AND status='accepted'").run(q.id).changes !== 1) throw new Error('not accepted');
      booked.push({ org, actor, quote: q.id, ...opts }); return { id: 'booking-x', work_order_id: 'job-x' };
    }
  };
  const comms = { link: (org, thread, l, by) => links.push({ org, thread, ...l, by }) };
  const cl = createCustomerLinks({ db, pipeline, outbound: createOutbound({ db, comms }), notify: async (org, o) => { alerts.push({ org, ...o }); }, emit: (...a) => events.push(a), smsReady: () => smsReady, publicBase: () => 'https://www.oprun.ai', log: { warn() {} } });
  const tokenOf = (r) => r.url.split('/').pop();
  const msgs = () => db.prepare("SELECT m.*,t.channel,t.contact_address,s.state FROM comms_messages m JOIN comms_threads t ON t.id=m.thread_id JOIN comms_message_schedule s ON s.message_id=m.id ORDER BY t.channel").all();
  return { db, cl, booked, alerts, events, links, tokenOf, msgs };
}

test('a quote is sent only when approved, current, and to a channel the customer and business can use', () => {
  const s = setup();
  assert.equal(s.cl.sendQuote(ORG, 'u1', 'q-draft', { revision: 1, channels: ['email'] }).status, 409);
  assert.match(s.cl.sendQuote(ORG, 'u1', 'q-1', { revision: 1, channels: ['email'] }).error, /changed/);
  assert.match(s.cl.sendQuote(ORG, 'u1', 'q-1', { revision: 2, channels: [] }).error, /Choose/);
  assert.match(s.cl.sendQuote(ORG, 'u1', 'q-2', { revision: 1, channels: ['sms'] }).error, /no Australian mobile/);
  assert.match(s.cl.sendQuote(ORG, 'u1', 'q-2', { revision: 1, channels: ['email'] }).error, /no email address/);
  assert.equal(s.cl.sendQuote('org-other', 'u1', 'q-1', { revision: 2, channels: ['email'] }).status, 404, 'another business cannot send this quote');
  assert.match(s.cl.sendQuote(ORG, 'u1', 'q-1', { revision: 2, channels: ['email'], start_at: '2020-01-01T00:00:00Z' }).error, /past/);
  const off = setup({ smsReady: false });
  assert.match(off.cl.sendQuote(ORG, 'u1', 'q-1', { revision: 2, channels: ['sms'] }).error, /Connect your business SMS sender/);
});

test('the preview shows the exact text and changes nothing', () => {
  const s = setup();
  const r = s.cl.sendQuote(ORG, 'u1', 'q-1', { revision: 2, channels: ['sms', 'email'], start_at: FUTURE, estimated_hours: 2, dry_run: true });
  assert.ok(r.ok && r.preview);
  assert.match(r.preview.sms, /^Hi Faiz, your quote ENQ-1001 from Fleet Parlour is ready: \$495\.00 incl\. GST, proposed for .+\. View and accept: https:\/\/www\.oprun\.ai\/q\//);
  assert.match(r.preview.email, /Time required: about 2 hours/);
  assert.equal(r.preview.subject, 'Your quote ENQ-1001 from Fleet Parlour');
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM customer_links').get().n, 0);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM comms_messages').get().n, 0);
  assert.equal(s.db.prepare("SELECT start_at FROM tenant_documents WHERE id='q-1'").get().start_at, null);
});

test('sending queues approved text and email with one private link, and a resend retires the old link', () => {
  const s = setup();
  const r = s.cl.sendQuote(ORG, 'u1', 'q-1', { revision: 2, channels: ['sms', 'email'], start_at: FUTURE, estimated_hours: 2 });
  assert.ok(r.ok); assert.match(s.tokenOf(r), /^[A-Za-z0-9_-]{32}$/);
  const m = s.msgs();
  assert.deepEqual(m.map((x) => [x.channel, x.contact_address, x.status, x.state]), [['email', 'faiz@example.com', 'approved', 'waiting'], ['sms', '+61404946656', 'approved', 'waiting']]);
  assert.ok(m.every((x) => x.body.includes(r.url)));
  const stored = s.db.prepare('SELECT * FROM customer_links').get();
  assert.notEqual(stored.token_hash, s.tokenOf(r), 'only the hash is stored');
  assert.equal(stored.revision, 2);
  assert.equal(s.db.prepare("SELECT estimated_hours FROM tenant_documents WHERE id='q-1'").get().estimated_hours, 2);
  assert.ok(s.links.some((l) => l.customer_id === 'cust-1' && l.enquiry_id === 'enq-1'));
  const again = s.cl.sendQuote(ORG, 'u1', 'q-1', { revision: 2, channels: ['email'] });
  assert.match(s.cl.acceptQuote(s.tokenOf(r), { name: 'Faiz Anul', agree: true }).error, /newer version/);
  assert.ok(s.cl.acceptQuote(s.tokenOf(again), { name: 'Faiz Anul', agree: true }).ok);
});

test('accepting online records evidence, books the proposed time and tells the owner; it cannot happen twice', () => {
  const s = setup();
  const t = s.tokenOf(s.cl.sendQuote(ORG, 'u1', 'q-1', { revision: 2, channels: ['email'], start_at: FUTURE, estimated_hours: 3 }));
  const page = s.cl.quotePage(t);
  assert.equal(page.status, 200); assert.match(page.html, /Accept quote/); assert.match(page.html, /\$495\.00/);
  assert.match(page.html, /Faiz &lt;b&gt;Anul&lt;\/b&gt;/, 'customer text is escaped'); assert.doesNotMatch(page.html, /<script/i);
  assert.match(s.cl.acceptQuote(t, { name: 'F', agree: true }).error, /full name/);
  assert.match(s.cl.acceptQuote(t, { name: 'Faiz Anul', agree: false }).error, /Tick the box/);
  const r = s.cl.acceptQuote(t, { name: 'Faiz Anul', agree: true, ip: '203.0.113.9', agent: 'Phone' });
  assert.ok(r.ok); assert.equal(r.booked, true);
  const q = s.db.prepare("SELECT status,acceptance_evidence FROM tenant_documents WHERE id='q-1'").get();
  assert.equal(q.status, 'booked'); assert.match(q.acceptance_evidence, /Accepted online by "Faiz Anul".*IP 203\.0\.113\.9/);
  assert.deepEqual(s.booked.map((b) => [b.quote, b.estimated_hours, b.address]), [['q-1', 3, '12 Main St, Success WA']]);
  assert.deepEqual(s.events.map((e) => e[1]), ['quote.accepted']);
  assert.equal(s.alerts[0].kind, 'quote_accepted'); assert.equal(s.alerts[0].urgent, true); assert.match(s.alerts[0].body, /Job Allocator/);
  assert.match(s.cl.acceptQuote(t, { name: 'Faiz Anul', agree: true }).error, /already accepted/);
  assert.match(s.cl.quotePage(t).html, /You accepted this quote/);
  assert.equal(s.booked.length, 1);
});

test('without a proposed time, accepting does not book; the owner is asked to choose a time', () => {
  const s = setup();
  const t = s.tokenOf(s.cl.sendQuote(ORG, 'u1', 'q-1', { revision: 2, channels: ['email'] }));
  const r = s.cl.acceptQuote(t, { name: 'Faiz Anul', agree: true });
  assert.ok(r.ok); assert.equal(r.booked, false); assert.equal(s.booked.length, 0);
  assert.equal(s.db.prepare("SELECT status FROM tenant_documents WHERE id='q-1'").get().status, 'accepted');
  assert.match(s.alerts[0].body, /Choose a date/);
});

test('a quote changed after sending, an expired link, a declined quote and a bad token are all refused safely', () => {
  const s = setup();
  const t = s.tokenOf(s.cl.sendQuote(ORG, 'u1', 'q-1', { revision: 2, channels: ['email'] }));
  s.db.prepare("UPDATE tenant_documents SET revision=3 WHERE id='q-1'").run();
  assert.match(s.cl.acceptQuote(t, { name: 'Faiz Anul', agree: true }).error, /changed/);
  assert.equal(s.cl.quotePage(t).status, 410);
  s.db.prepare("UPDATE tenant_documents SET revision=2 WHERE id='q-1'").run();
  s.db.prepare("UPDATE customer_links SET expires_at='2020-01-01T00:00:00Z'").run();
  assert.match(s.cl.acceptQuote(t, { name: 'Faiz Anul', agree: true }).error, /expired/);
  const s2 = setup();
  const t2 = s2.tokenOf(s2.cl.sendQuote(ORG, 'u1', 'q-1', { revision: 2, channels: ['email'] }));
  assert.ok(s2.cl.declineQuote(t2, { reason: 'Too dear' }).ok);
  assert.equal(s2.db.prepare("SELECT status FROM tenant_documents WHERE id='q-1'").get().status, 'declined');
  assert.match(s2.cl.acceptQuote(t2, { name: 'Faiz Anul', agree: true }).error, /already answered/);
  assert.equal(s2.alerts[0].kind, 'quote_declined');
  for (const bad of ['', 'short', 'x'.repeat(40), '../../etc/passwd']) assert.equal(s.cl.quotePage(bad).status, 404);
  assert.equal(s.cl.quotePage(crypto.randomBytes(24).toString('base64url')).status, 404);
});

test('a review request needs a completed job and a reachable customer, and sends one private link', () => {
  const s = setup();
  assert.match(s.cl.requestReview(ORG, 'u1', 'job-open', { channels: ['email'] }).error, /complete/);
  assert.equal(s.cl.requestReview('org-other', 'u1', 'job-1', { channels: ['email'] }).status, 404);
  const p = s.cl.requestReview(ORG, 'u1', 'job-1', { channels: ['sms'], dry_run: true });
  assert.match(p.preview.sms, /^Hi Faiz, thanks for choosing Fleet Parlour\. How did we go\? .*https:\/\/www\.oprun\.ai\/r\//);
  const r = s.cl.requestReview(ORG, 'u1', 'job-1', { channels: ['sms', 'email'] });
  assert.ok(r.ok);
  assert.equal(s.db.prepare("SELECT document_id FROM customer_links WHERE kind='review'").get().document_id, 'b-1', 'the link belongs to the booking card');
  assert.equal(s.msgs().length, 2);
});

test('feedback is stored once, the owner is told (urgently for low ratings), and every customer sees the public review link', () => {
  const s = setup();
  s.db.prepare("INSERT INTO customer_link_settings VALUES (?,?,?,?)").run(ORG, 'https://g.page/r/fleet/review', 'u1', new Date().toISOString());
  const t = s.tokenOf(s.cl.requestReview(ORG, 'u1', 'job-1', { channels: ['email'] }));
  assert.match(s.cl.reviewPage(t).html, /name="rating" value="5"/);
  assert.match(s.cl.submitReview(t, { rating: '0' }).error, /1 to 5/);
  assert.match(s.cl.submitReview(t, { rating: '6' }).error, /1 to 5/);
  const r = s.cl.submitReview(t, { rating: '1', comment: 'Late <b>again</b>' });
  assert.ok(r.ok); assert.equal(r.review_url, 'https://g.page/r/fleet/review', 'no review gating: a 1-star customer also sees the public link');
  const row = s.db.prepare('SELECT * FROM tenant_customer_reviews').get();
  assert.equal(row.rating, 1); assert.equal(row.work_order_id, 'job-1'); assert.equal(row.customer_id, 'cust-1');
  assert.equal(s.alerts[0].urgent, true); assert.match(s.alerts[0].title, /^1 star from/);
  assert.ok(s.cl.submitReview(t, { rating: '5' }).done);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM tenant_customer_reviews').get().n, 1);
  assert.match(s.cl.reviewPage(t).html, /Leave a public review/);
  assert.match(s.cl.requestReview(ORG, 'u1', 'job-1', { channels: ['email'] }).error, /already left a review/);
});
