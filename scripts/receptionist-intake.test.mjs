// T-141: a finished AI receptionist call becomes a customer, an enquiry, a linked Unibox thread and an owner alert.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { createReceptionistIntake, toE164AU, displayAU, parseExtraction, heuristicExtraction, normaliseEmail, enquiryBody, customerDrafts, missingDetails } from '../src/comms/receptionist-intake.js';

const ORG = 'org-fleet', OTHER = 'org-other';
function setup({ aiText = null, aiThrows = false, profile = {}, approvals = true } = {}) {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE voice_calls (call_control_id TEXT PRIMARY KEY, organisation_id TEXT, from_number TEXT, transcript TEXT NOT NULL DEFAULT '', voicemail INTEGER NOT NULL DEFAULT 0, transferred_to_human INTEGER NOT NULL DEFAULT 0, inbox_message_id TEXT, updated_at TEXT);
    CREATE TABLE comms_threads (id TEXT PRIMARY KEY, organisation_id TEXT, channel TEXT NOT NULL DEFAULT 'voice', contact_address TEXT NOT NULL DEFAULT '', contact_name TEXT, subject TEXT, status TEXT NOT NULL DEFAULT 'open', last_message_at TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE comms_messages (id TEXT PRIMARY KEY, organisation_id TEXT, thread_id TEXT, direction TEXT, kind TEXT, body TEXT, provider TEXT, status TEXT, ai_generated INTEGER, approval_id TEXT, created_by_user_id TEXT, occurred_at TEXT, created_at TEXT);
    CREATE TABLE comms_message_schedule (message_id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, send_at TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'waiting', error TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE workspace_approvals (id TEXT PRIMARY KEY, organisation_id TEXT, approval_type TEXT, source_module TEXT, title TEXT, status TEXT, draft_payload_json TEXT);
    CREATE TABLE memberships (organisation_id TEXT, user_id TEXT, role TEXT, created_at TEXT);
    INSERT INTO memberships VALUES ('org-fleet','owner-1','owner','2026-01-01');
    CREATE TABLE comms_thread_meta (thread_id TEXT PRIMARY KEY, organisation_id TEXT, customer_id TEXT, enquiry_id TEXT, updated_at TEXT);
    CREATE TABLE tenant_customers (id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'current', source TEXT NOT NULL DEFAULT 'manual', created_by_user_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE tenant_documents (id TEXT PRIMARY KEY, organisation_id TEXT, kind TEXT, customer_id TEXT, title TEXT, body TEXT, status TEXT, channel TEXT, created_by TEXT, created_at TEXT, reference TEXT, updated_at TEXT);`);
  const enquiries = [], links = [], alerts = [];
  const pipeline = { createEnquiry(org, actor, d) { const id = crypto.randomUUID(), reference = `ENQ-${1001 + enquiries.length}`; db.prepare("INSERT INTO tenant_documents VALUES (?,?,'enquiry',?,?,?,'open',?,?,?,?,NULL)").run(id, org, d.customer_id, d.title, d.details, d.channel, actor, new Date().toISOString(), reference); enquiries.push({ org, actor, ...d }); return { id, customer_id: d.customer_id, reference }; } };
  const comms = { link(org, thread, l) { links.push({ org, thread, ...l }); db.prepare('INSERT INTO comms_thread_meta(thread_id,organisation_id,customer_id,enquiry_id) VALUES (?,?,?,?) ON CONFLICT(thread_id) DO UPDATE SET customer_id=COALESCE(customer_id,excluded.customer_id),enquiry_id=COALESCE(enquiry_id,excluded.enquiry_id)').run(thread, org, l.customer_id, l.enquiry_id); return { ok: true }; } };
  const ai = aiThrows ? async () => { throw new Error('AI provider is not configured.'); } : aiText ? async () => ({ text: aiText }) : null;
  const emails = [];
  const createApproval = approvals ? (req, a) => { const id = crypto.randomUUID(); db.prepare("INSERT INTO workspace_approvals VALUES (?,?,?,?,?,'pending',?)").run(id, req.saas.organisation_id, a.approval_type, a.source_module, a.title, JSON.stringify(a.draft_payload)); return { id, reference_code: 'APR-' + id.slice(0, 4) }; } : null;
  const intake = createReceptionistIntake({ db, pipeline, comms, notify: async (org, o) => { alerts.push({ org, ...o }); }, emailOwners: async (org, e) => { emails.push({ org, ...e }); }, createApproval, profileFor: () => ({ business_name: 'Fleet Parlour', ...profile }), ai, log: { warn() {} } });
  const call = (id, { org = ORG, from = '+61404946656', transcript, thread = 'th-1' } = {}) => {
    db.prepare('INSERT OR IGNORE INTO comms_threads(id,organisation_id) VALUES (?,?)').run(thread, org);
    db.prepare('INSERT INTO comms_messages(id,organisation_id,thread_id) VALUES (?,?,?)').run('m-' + id, org, thread);
    db.prepare('INSERT INTO voice_calls(call_control_id,organisation_id,from_number,transcript,inbox_message_id) VALUES (?,?,?,?,?)').run(id, org, from, transcript, 'm-' + id);
    return db.prepare('SELECT * FROM voice_calls WHERE call_control_id=?').get(id);
  };
  return { db, intake, call, enquiries, links, alerts, emails };
}
const T = 'Receptionist: Welcome, how may I help?\nCaller: My name is Faiz, I need to speak to someone urgently.\nReceptionist: What is the best number?\nCaller: 0404 946 656, please call me back as soon as possible.';
const AI = JSON.stringify({ caller_name: 'Faiz', callback_number: '0404 946 656', need: 'Wants an urgent call back from the team', summary: 'Faiz asked for an urgent call back.', urgency: 'urgent', wants_callback: true, is_spam: false });

test('Australian numbers normalise and display', () => {
  assert.equal(toE164AU('0404 946 656'), '+61404946656');
  assert.equal(toE164AU('+61 8 6289 1786'), '+61862891786');
  assert.equal(toE164AU('hello'), null);
  assert.equal(displayAU('+61404946656'), '0404 946 656');
  assert.equal(displayAU('+61862891786'), '08 6289 1786');
});

test('model output is parsed defensively', () => {
  const p = parseExtraction('Sure: ' + AI);
  assert.equal(p.caller_name, 'Faiz'); assert.equal(p.callback_number, '+61404946656'); assert.equal(p.urgency, 'urgent');
  assert.equal(parseExtraction('not json'), null);
  assert.equal(parseExtraction('{"caller_name":"Unknown caller"}').caller_name, null);
});

test('rules fallback reads name, number and urgency from the caller only', () => {
  const h = heuristicExtraction(T);
  assert.equal(h.caller_name, 'Faiz'); assert.equal(h.callback_number, '+61404946656'); assert.equal(h.urgency, 'urgent');
});

test('a new caller becomes a lead, an enquiry, a linked thread and an urgent owner alert', async () => {
  const s = setup({ aiText: AI });
  const r = await s.intake.processCall(s.call('c1', { transcript: T }));
  assert.equal(r.customer_created, true); assert.equal(r.enquiry_created, true); assert.equal(r.method, 'ai');
  const cust = s.db.prepare('SELECT * FROM tenant_customers').get();
  assert.equal(cust.name, 'Faiz'); assert.equal(cust.phone, '+61404946656'); assert.equal(cust.status, 'lead'); assert.equal(cust.source, 'receptionist'); assert.equal(cust.organisation_id, ORG);
  assert.equal(s.enquiries[0].channel, 'receptionist'); assert.match(s.enquiries[0].title, /^URGENT: /); assert.equal(s.enquiries[0].customer_id, cust.id);
  assert.deepEqual(s.links[0], { org: ORG, thread: 'th-1', customer_id: cust.id, enquiry_id: r.enquiry_id });
  assert.equal(s.db.prepare("SELECT status FROM comms_threads WHERE id='th-1'").get().status, 'needs_reply');
  assert.equal(s.alerts.length, 1); assert.equal(s.alerts[0].urgent, true); assert.match(s.alerts[0].title, /URGENT call from Faiz/); assert.match(s.alerts[0].body, /0404 946 656/);
  const vc = s.db.prepare("SELECT * FROM voice_calls WHERE call_control_id='c1'").get();
  assert.equal(vc.customer_id, cust.id); assert.equal(vc.enquiry_id, r.enquiry_id); assert.equal(vc.outcome, 'message_taken');
});

test('processing the same call twice creates nothing new', async () => {
  const s = setup({ aiText: AI });
  const c = s.call('c1', { transcript: T });
  await s.intake.processCall(c);
  const again = await s.intake.processCall(c);
  assert.equal(again.skipped, 'already processed');
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM tenant_customers').get().n, 1); assert.equal(s.enquiries.length, 1); assert.equal(s.alerts.length, 1);
});

test('an existing customer is reused: note appended, open enquiry reused, no duplicate', async () => {
  const s = setup({ aiText: AI });
  s.db.prepare("INSERT INTO tenant_customers VALUES ('cust-1',?, 'Faiz Ahmed', NULL, '+61404946656', NULL, 'Staff note', 'current', 'manual', NULL, 'x', 'x')").run(ORG);
  s.db.prepare("INSERT INTO comms_thread_meta(thread_id,organisation_id,customer_id) VALUES ('th-1',?,'cust-1')").run(ORG);
  s.db.prepare("INSERT INTO tenant_documents VALUES ('enq-1',?,'enquiry','cust-1','Old','', 'open','phone','u','x','ENQ-1000',NULL)").run(ORG);
  const r = await s.intake.processCall(s.call('c2', { transcript: T }));
  assert.equal(r.customer_created, false); assert.equal(r.enquiry_id, 'enq-1'); assert.equal(r.enquiry_created, false);
  const c = s.db.prepare("SELECT * FROM tenant_customers WHERE id='cust-1'").get();
  assert.equal(c.name, 'Faiz Ahmed'); assert.equal(c.status, 'current'); assert.match(c.notes, /^Staff note\n\[\d{4}-\d\d-\d\d AI receptionist\]/);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM tenant_customers').get().n, 1);
});

test('no AI provider: rules still create the records', async () => {
  const s = setup({ aiThrows: true });
  const r = await s.intake.processCall(s.call('c3', { transcript: T }));
  assert.equal(r.method, 'rules'); assert.equal(s.db.prepare('SELECT name FROM tenant_customers').get().name, 'Faiz'); assert.equal(s.alerts.length, 1);
});

test('calls without a business, without a conversation, or flagged as spam create no records', async () => {
  const s = setup({ aiText: JSON.stringify({ is_spam: true }) });
  assert.equal((await s.intake.processCall({ call_control_id: 'x', organisation_id: null })).skipped, 'no business owns this number');
  assert.match((await s.intake.processCall(s.call('c4', { transcript: '' }))).skipped, /no conversation/);
  assert.equal((await s.intake.processCall(s.call('c5', { transcript: T, thread: 'th-5' }))).spam, true);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM tenant_customers').get().n, 0); assert.equal(s.alerts.length, 0);
});

test('a call is only processed inside the business that owns it', async () => {
  const s = setup({ aiText: AI });
  s.call('c6', { org: OTHER, transcript: T, thread: 'th-6' });
  const r = await s.intake.processCall({ call_control_id: 'c6', organisation_id: ORG });
  assert.equal(r.skipped, 'call not found');
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM tenant_customers').get().n, 0);
});

// ---------- T-143: the full enquiry, the customer reply for approval, links and owner email ----------
const T2 = [
  'Receptionist: Thanks for calling Fleet Parlour, how can I help?',
  'Caller: Hi, my name is Faiz Anul. I need my aluminium bull bar polished.',
  'Receptionist: Could you spell your surname?', 'Caller: A-N-U-L.',
  'Receptionist: What vehicle is it on?', 'Caller: A SsangYong Actyon, 2009. S-S-A-N-G-Y-O-N-G.',
  'Receptionist: Email?', 'Caller: faiz dot anul at gmail dot com',
  'Caller: I am in Success. Thursday morning would suit. Can I send photos on WhatsApp?'
].join('\n');
const AI2 = JSON.stringify({ caller_name: 'Faiz Anul', callback_number: null, email: 'faiz dot anul at gmail dot com', address: 'Success WA', service: 'Aluminium bull bar polishing', item: 'SsangYong Actyon 2009', job_details: null, preferred_time: 'Thursday morning', time_required: null, wants_links: true, need: 'Bull bar polishing', summary: 'Faiz wants his aluminium bull bar polished.', urgency: 'normal', wants_callback: true, is_spam: false });

test('emails spoken aloud become real addresses; anything else is refused', () => {
  assert.equal(normaliseEmail('faiz dot anul at gmail dot com'), 'faiz.anul@gmail.com');
  assert.equal(normaliseEmail(' Faiz.Anul@Gmail.com '), 'faiz.anul@gmail.com');
  assert.equal(normaliseEmail('no email'), null);
  assert.equal(heuristicExtraction('Caller: my email is faiz dot anul at gmail dot com').email, 'faiz.anul@gmail.com');
});

test('the enquiry is written field by field with its reference and what is still missing', () => {
  const x = parseExtraction(AI2);
  const b = enquiryBody(x, { reference: 'ENQ-1001', callerId: '+61404946656', takenAt: '2026-11-19T16:11:00Z' });
  for (const want of [/^Enquiry number: ENQ-1001$/m, /^Customer: Faiz Anul$/m, /^Mobile: 0404 946 656$/m, /^Email: faiz.anul@gmail.com$/m, /^Address: Success WA$/m, /^Service: Aluminium bull bar polishing$/m, /^Vehicle or item: SsangYong Actyon 2009$/m, /^Preferred date and time: Thursday morning$/m, /^Time required: to be set when quoting$/m]) assert.match(b, want);
  assert.doesNotMatch(b, /Still needed/);
  assert.deepEqual(missingDetails({ caller_name: 'A' }), ['mobile number', 'email', 'address or suburb', 'service needed', 'preferred date and time']);
});

test('a full call saves email and address, numbers the enquiry, and stages text and email replies for approval', async () => {
  const s = setup({ aiText: AI2, profile: { whatsapp_link: 'https://wa.me/61400000000', upload_link: 'https://fleetparlour.com.au/contact' } });
  const r = await s.intake.processCall(s.call('c10', { transcript: T2 }));
  assert.equal(r.reference, 'ENQ-1001'); assert.equal(r.approvals, 2); assert.equal(r.links_sent, false); assert.deepEqual(r.missing, []);
  const cust = s.db.prepare('SELECT * FROM tenant_customers').get();
  assert.equal(cust.name, 'Faiz Anul'); assert.equal(cust.email, 'faiz.anul@gmail.com'); assert.equal(cust.address, 'Success WA');
  const e = s.db.prepare("SELECT * FROM tenant_documents WHERE kind='enquiry'").get();
  assert.match(e.title, /^ENQ-1001 · Aluminium bull bar polishing — SsangYong Actyon 2009 \(Faiz Anul\)$/); assert.match(e.body, /Vehicle or item: SsangYong Actyon 2009/);
  const msgs = s.db.prepare("SELECT m.*,t.channel,t.contact_address FROM comms_messages m JOIN comms_threads t ON t.id=m.thread_id WHERE m.direction='outbound' ORDER BY t.channel").all();
  assert.deepEqual(msgs.map((m) => [m.channel, m.contact_address, m.status]), [['email', 'faiz.anul@gmail.com', 'pending_approval'], ['sms', '+61404946656', 'pending_approval']]);
  for (const m of msgs) { assert.match(m.body, /ENQ-1001/); assert.ok(m.approval_id); assert.equal(s.db.prepare('SELECT state FROM comms_message_schedule WHERE message_id=?').get(m.id).state, 'waiting'); }
  assert.match(msgs[1].body, /https:\/\/fleetparlour.com.au\/contact/);
  const ap = s.db.prepare('SELECT * FROM workspace_approvals').all();
  assert.equal(ap.length, 2); assert.ok(ap.every((a) => a.approval_type === 'outbound_message' && a.source_module === 'receptionist' && JSON.parse(a.draft_payload_json).reference === 'ENQ-1001'));
  assert.match(s.alerts[0].title, /ENQ-1001/); assert.equal(s.alerts[0].link, '#approvals');
  assert.equal(s.emails.length, 1); assert.match(s.emails[0].text, /Approvals/); assert.match(s.emails[0].text, /SsangYong/);
});

test('a second call on the same enquiry does not stack duplicate replies', async () => {
  const s = setup({ aiText: AI2 });
  await s.intake.processCall(s.call('c11', { transcript: T2 }));
  const r = await s.intake.processCall(s.call('c12', { transcript: T2 }));
  assert.equal(r.enquiry_created, false); assert.equal(r.approvals, 0);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM workspace_approvals').get().n, 2);
  assert.match(s.db.prepare("SELECT body FROM tenant_documents WHERE kind='enquiry'").get().body, /Another call/);
});

test('the owner-written links text goes out after the call only when turned on and the caller asked', async () => {
  const on = { whatsapp_link: 'https://wa.me/61400000000', upload_link: 'https://fleetparlour.com.au/contact', send_links_after_call: 1, links_message: 'Send us photos here:' };
  const s = setup({ aiText: AI2, profile: on });
  const r = await s.intake.processCall(s.call('c13', { transcript: T2 }));
  assert.equal(r.links_sent, true);
  const auto = s.db.prepare("SELECT * FROM comms_messages WHERE status='approved'").all();
  assert.equal(auto.length, 1); assert.match(auto[0].body, /^Send us photos here: Ref ENQ-1001\. Send photos: https:\/\/fleetparlour/); assert.equal(auto[0].approval_id, null);
  const s2 = setup({ aiText: JSON.stringify({ ...JSON.parse(AI2), wants_links: false }), profile: on });
  assert.equal((await s2.intake.processCall(s2.call('c14', { transcript: T2 }))).links_sent, false);
  const s3 = setup({ aiText: AI2, profile: { ...on, send_links_after_call: 0 } });
  assert.equal((await s3.intake.processCall(s3.call('c15', { transcript: T2 }))).links_sent, false);
});

test('customer drafts use only the facts given', () => {
  const d = customerDrafts(parseExtraction(AI2), { business: 'Fleet Parlour', reference: 'ENQ-1001' });
  assert.match(d.sms, /^Hi Faiz, thanks for calling Fleet Parlour\. Your enquiry number is ENQ-1001 \(Aluminium bull bar polishing for your SsangYong Actyon 2009\)/);
  assert.doesNotMatch(d.sms + d.email, /\$\d/);
  assert.equal(d.subject, 'Your enquiry ENQ-1001 with Fleet Parlour');
});

test('customer text never repeats raw transcript words as the service', async () => {
  const { customerDrafts } = await import('../src/comms/receptionist-intake.js');
  const junk = customerDrafts({ caller_name: 'Sam', service: 'created by долетс a blocker and black Thanks for calling Fleet Parlor, your mobile truck and metal polishing specialist in Perth.' }, { business: 'Fleet Parlour', reference: 'ENQ-1001' });
  assert.equal(junk.sms.startsWith('Hi Sam, thanks for calling Fleet Parlour. Your enquiry number is ENQ-1001. We will'), true, junk.sms);
  const good = customerDrafts({ caller_name: 'Sam', service: 'Bull bar polishing', item: 'Kenworth T610' }, { business: 'Fleet Parlour', reference: 'ENQ-1002' });
  assert.match(good.sms, /ENQ-1002 \(Bull bar polishing for your Kenworth T610\)/);
});
