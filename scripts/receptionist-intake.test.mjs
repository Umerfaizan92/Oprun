// T-141: a finished AI receptionist call becomes a customer, an enquiry, a linked Unibox thread and an owner alert.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { createReceptionistIntake, toE164AU, displayAU, parseExtraction, heuristicExtraction } from '../src/comms/receptionist-intake.js';

const ORG = 'org-fleet', OTHER = 'org-other';
function setup({ aiText = null, aiThrows = false } = {}) {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE voice_calls (call_control_id TEXT PRIMARY KEY, organisation_id TEXT, from_number TEXT, transcript TEXT NOT NULL DEFAULT '', voicemail INTEGER NOT NULL DEFAULT 0, transferred_to_human INTEGER NOT NULL DEFAULT 0, inbox_message_id TEXT, updated_at TEXT);
    CREATE TABLE comms_threads (id TEXT PRIMARY KEY, organisation_id TEXT, contact_name TEXT, status TEXT NOT NULL DEFAULT 'open', updated_at TEXT);
    CREATE TABLE comms_messages (id TEXT PRIMARY KEY, organisation_id TEXT, thread_id TEXT);
    CREATE TABLE comms_thread_meta (thread_id TEXT PRIMARY KEY, organisation_id TEXT, customer_id TEXT, enquiry_id TEXT, updated_at TEXT);
    CREATE TABLE tenant_customers (id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'current', source TEXT NOT NULL DEFAULT 'manual', created_by_user_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE tenant_documents (id TEXT PRIMARY KEY, organisation_id TEXT, kind TEXT, customer_id TEXT, title TEXT, body TEXT, status TEXT, channel TEXT, created_by TEXT, created_at TEXT);`);
  const enquiries = [], links = [], alerts = [];
  const pipeline = { createEnquiry(org, actor, d) { const id = crypto.randomUUID(); db.prepare("INSERT INTO tenant_documents VALUES (?,?,'enquiry',?,?,?,'open',?,?,?)").run(id, org, d.customer_id, d.title, d.details, d.channel, actor, new Date().toISOString()); enquiries.push({ org, actor, ...d }); return { id, customer_id: d.customer_id }; } };
  const comms = { link(org, thread, l) { links.push({ org, thread, ...l }); db.prepare('INSERT INTO comms_thread_meta(thread_id,organisation_id,customer_id,enquiry_id) VALUES (?,?,?,?) ON CONFLICT(thread_id) DO UPDATE SET customer_id=COALESCE(customer_id,excluded.customer_id),enquiry_id=COALESCE(enquiry_id,excluded.enquiry_id)').run(thread, org, l.customer_id, l.enquiry_id); return { ok: true }; } };
  const ai = aiThrows ? async () => { throw new Error('AI provider is not configured.'); } : aiText ? async () => ({ text: aiText }) : null;
  const intake = createReceptionistIntake({ db, pipeline, comms, notify: async (org, o) => { alerts.push({ org, ...o }); }, ai, log: { warn() {} } });
  const call = (id, { org = ORG, from = '+61404946656', transcript, thread = 'th-1' } = {}) => {
    db.prepare('INSERT OR IGNORE INTO comms_threads(id,organisation_id) VALUES (?,?)').run(thread, org);
    db.prepare('INSERT INTO comms_messages VALUES (?,?,?)').run('m-' + id, org, thread);
    db.prepare('INSERT INTO voice_calls(call_control_id,organisation_id,from_number,transcript,inbox_message_id) VALUES (?,?,?,?,?)').run(id, org, from, transcript, 'm-' + id);
    return db.prepare('SELECT * FROM voice_calls WHERE call_control_id=?').get(id);
  };
  return { db, intake, call, enquiries, links, alerts };
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
  s.db.prepare("INSERT INTO tenant_documents VALUES ('enq-1',?,'enquiry','cust-1','Old','', 'open','phone','u','x')").run(ORG);
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
