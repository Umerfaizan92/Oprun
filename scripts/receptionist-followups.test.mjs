// R-13 (T-133) and R-14 (T-134): the follow-up state machine, message classes, approval levels, consent, quiet hours.
// Runs on a copy of a real server database with a controlled clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { createReceptionistFollowups } from '../src/comms/receptionist-followups.js';

let template, ORG;
test.before(async () => {
  const s = await startServer();
  try {
    ORG = (await seedOwner(s, { business: 'Follow Plumbing' })).org;
    template = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sp-rxf-')), 'db.sqlite');
    const live = new Database(s.dbPath); await live.backup(template); live.close();
  } finally { await s.stop(); }
});

function rig(level = 'approve_all', { start = Date.parse('2026-12-01T01:00:00Z') } = {}) { // 9 am Perth, a Tuesday
  const file = template.replace('db.sqlite', `db-${crypto.randomUUID()}.sqlite`); fs.copyFileSync(template, file);
  const db = new Database(file); db.pragma('foreign_keys = ON');
  let now = start; const clock = () => now, iso = () => new Date(now).toISOString();
  db.prepare("INSERT INTO receptionist_config (organisation_id,status,timezone,approval_level,updated_at) VALUES (?,'live','Australia/Perth',?,?)").run(ORG, level, iso());
  const cust = crypto.randomUUID(), enq = crypto.randomUUID();
  db.prepare("INSERT INTO tenant_customers (id,organisation_id,name,phone,email,status,source,created_at,updated_at) VALUES (?,?,?,?,?,'lead','receptionist',?,?)").run(cust, ORG, 'Mia Chen', '+61412555111', 'mia@example.test', iso(), iso());
  db.prepare("INSERT INTO tenant_documents (id,organisation_id,kind,customer_id,title,body,status,channel,created_by,created_at,updated_at) VALUES (?,?,'enquiry',?,'Blocked drain – Joondalup','Sink\\nUrgency: normal','open','receptionist','ai_receptionist',?,?)").run(enq, ORG, cust, iso(), iso());
  db.prepare("INSERT INTO receptionist_followups (id,organisation_id,enquiry_id,customer_id,state,created_at,updated_at) VALUES (?,?,?,?,'QUALIFYING',?,?)").run(crypto.randomUUID(), ORG, enq, cust, iso(), iso());
  const approvals = [];
  const comms = { link: (org, threadId, { customer_id, enquiry_id }) => db.prepare("INSERT INTO comms_thread_meta (thread_id,organisation_id,folder,customer_id,enquiry_id,updated_at) VALUES (?,?,'inbox',?,?,?) ON CONFLICT(thread_id) DO UPDATE SET customer_id=excluded.customer_id,enquiry_id=excluded.enquiry_id").run(threadId, org, customer_id || null, enquiry_id || null, iso()) };
  const createApproval = (req, o) => { const id = crypto.randomUUID(); approvals.push({ id, ...o }); db.prepare("INSERT INTO workspace_approvals (id,organisation_id,reference_code,approval_type,source_module,title,summary,entity_type,entity_id,risk_level,status,draft_payload_json,required_role,requested_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?)").run(id, req.saas.organisation_id, 'R-' + id.slice(0, 6), o.approval_type, o.source_module, o.title, o.summary, o.entity_type, o.entity_id, o.risk_level, JSON.stringify(o.draft_payload), o.required_role, iso(), iso()); return { id, reference_code: 'R' }; };
  const notes = []; const f = createReceptionistFollowups({ db, comms, createApproval, actorFor: (org) => ({ saas: { organisation_id: org, user_id: null } }), notify: (o, n) => notes.push(n), clock, booking: { offerTimes: () => ['Wednesday the 2nd at 9 am', 'Thursday the 3rd at 2 pm'], label: () => 'Wednesday the 2nd at 9 am' } });
  const consent = (channel, address) => db.prepare("INSERT INTO marketing_consents (owner_key,channel,address,customer_id,status,source,granted_at,updated_at) VALUES (?,?,?,?,'granted','receptionist_call',?,?)").run(ORG, channel, address, cust, iso(), iso());
  const state = () => db.prepare('SELECT * FROM receptionist_followups WHERE enquiry_id=?').get(enq);
  const msgs = () => db.prepare("SELECT m.body,m.status,m.approval_id,t.channel,s.send_at,s.state sstate FROM comms_messages m JOIN comms_threads t ON t.id=m.thread_id JOIN comms_message_schedule s ON s.message_id=m.id WHERE m.organisation_id=? ORDER BY m.created_at,m.rowid").all(ORG);
  const advance = (ms) => { now += ms; }, due = () => { now = Date.parse(state().next_action_at) + 1000; };
  return { db, f, enq, cust, consent, state, msgs, advance, due, approvals, notes, iso, close: () => { db.close(); fs.rmSync(file, { force: true }); } };
}

test('no consent: nothing is sent; the state still advances to the end of the cadence', async () => {
  const r = rig('auto_followups');
  try {
    r.f.onCallEnded(ORG, r.enq);
    assert.equal(r.state().state, 'AWAITING_CUSTOMER'); assert.equal(r.msgs().length, 0, 'no consent, no message');
    for (let i = 0; i < 4; i++) { r.due(); await r.f.sweep(); }
    assert.equal(r.state().state, 'CLOSED_NO_RESPONSE'); assert.equal(r.msgs().length, 0);
    assert.ok(r.notes.some((n) => /no reply/i.test(n.title)));
    assert.equal(r.db.prepare('SELECT status FROM tenant_documents WHERE id=?').get(r.enq).status, 'open', 'the enquiry itself stays open for staff');
  } finally { r.close(); }
});

test('auto_followups with SMS consent: thank-you, nudges with times, opt-out wording, cadence, quiet hours', async () => {
  const r = rig('auto_followups');
  try {
    r.consent('sms', '+61412555111');
    r.f.onCallEnded(ORG, r.enq);
    let m = r.msgs(); assert.equal(m.length, 1); assert.equal(m[0].channel, 'sms'); assert.equal(m[0].status, 'approved', 'post_call_ack is automatic at this level');
    assert.match(m[0].body, /^Hi Mia, thanks for calling Follow Plumbing\. We've got your request for Blocked drain/); assert.match(m[0].body, /Reply STOP to opt out\.$/);
    const thread = r.db.prepare("SELECT t.id FROM comms_threads t WHERE organisation_id=? AND channel='sms'").get(ORG).id;
    assert.equal(r.db.prepare('SELECT enquiry_id FROM comms_thread_meta WHERE thread_id=?').get(thread).enquiry_id, r.enq, 'linked to the enquiry');
    // Attempt 2: four hours later, inside business hours, with two open times.
    const t1 = Date.parse(r.state().next_action_at); assert.ok(t1 - Date.parse('2026-12-01T01:00:00Z') >= 4 * 3600000 - 60000);
    r.due(); await r.f.sweep();
    m = r.msgs(); assert.equal(m.length, 2); assert.match(m[1].body, /We have Wednesday the 2nd at 9 am or Thursday the 3rd at 2 pm/); assert.equal(r.state().state, 'SLOT_PROPOSED'); assert.equal(r.state().attempts, 2);
    // Attempt 3 is next business day at 10 am Perth (02:00 UTC).
    assert.match(r.state().next_action_at, /T02:00:00\.000Z$/);
    // Quiet hours: a message created at 11 pm local is scheduled for 8 am.
    r.advance(0); const late = Date.parse('2026-12-02T15:00:00Z'); // 11 pm Perth
    const g = createReceptionistFollowups({ db: r.db, comms: { link() {} }, createApproval: () => ({ id: 'x' }), actorFor: () => ({}), clock: () => late });
    const res = g.sendOrDraft(ORG, r.state(), 'followup_nudge', { attempt: 3, times: [] });
    assert.equal(res.send_at, '2026-12-03T00:00:00.000Z', '8 am Perth');
  } finally { r.close(); }
});

test('approve_all: every message is a draft with an approval; a newer nudge replaces an unapproved one', async () => {
  const r = rig('approve_all');
  try {
    r.consent('sms', '+61412555111');
    r.f.onCallEnded(ORG, r.enq);
    assert.equal(r.msgs()[0].status, 'pending_approval'); assert.equal(r.approvals[0].approval_type, 'outbound_message'); assert.equal(r.approvals[0].source_module, 'receptionist');
    r.due(); await r.f.sweep();
    const m = r.msgs(); assert.equal(m.length, 2); assert.equal(m[0].status, 'rejected', 'old draft replaced'); assert.equal(m[0].sstate, 'cancelled'); assert.equal(m[1].status, 'pending_approval');
    assert.equal(r.db.prepare('SELECT status FROM workspace_approvals WHERE id=?').get(m[0].approval_id).status, 'cancelled', 'the approver never sees two nudges');
    // A price in a free-text request always becomes a draft, whatever the level.
    const res = r.f.sendOrDraft(ORG, r.state(), 'post_call_ack', { text: 'The price is $120' });
    assert.equal(res.auto, false);
  } finally { r.close(); }
});

test('replies, STOP, staff takeover, resume, booking and closing stop the cadence correctly', async () => {
  const r = rig('auto_followups');
  try {
    r.consent('sms', '+61412555111');
    r.f.onCallEnded(ORG, r.enq);
    r.f.onCustomerReplied(ORG, r.enq);
    assert.equal(r.state().next_action_at, null, 'a reply pauses the cadence'); assert.equal(r.state().state, 'AWAITING_CUSTOMER');
    r.f.onStaffResumed(ORG, r.enq); assert.equal(r.state().state, 'AWAITING_CUSTOMER');
    r.f.onStaffTookOver(ORG, r.enq); assert.equal(r.state().state, 'HANDED_TO_STAFF');
    r.f.onStaffResumed(ORG, r.enq); assert.equal(r.state().state, 'AWAITING_CUSTOMER'); assert.ok(r.state().next_action_at);
    // A person replies by hand: the next scheduled attempt hands it to staff instead of nudging.
    r.advance(1000); const thread = r.db.prepare("SELECT id FROM comms_threads WHERE organisation_id=? AND channel='sms'").get(ORG).id;
    const owner = r.db.prepare("SELECT user_id FROM memberships WHERE organisation_id=? AND role='owner'").get(ORG).user_id;
    r.db.prepare("INSERT INTO comms_messages (id,organisation_id,thread_id,direction,kind,body,provider,status,created_by_user_id,occurred_at,created_at) VALUES (?,?,?,'outbound','message','On my way','super_pro','sent',?,?,?)").run(crypto.randomUUID(), ORG, thread, owner, r.iso(), new Date(Date.parse(r.iso()) + 5000).toISOString());
    r.due(); await r.f.sweep(); assert.equal(r.state().state, 'HANDED_TO_STAFF');
    r.f.onStaffResumed(ORG, r.enq);
    // Staff booked it through a quote: BOOKED, no automatic confirmation.
    const before = r.msgs().length; r.f.onBooked(ORG, r.enq, { via: 'staff' });
    assert.equal(r.state().state, 'BOOKED'); assert.equal(r.msgs().length, before);
    r.f.onCustomerReplied(ORG, r.enq, { stop: true }); assert.equal(r.state().state, 'BOOKED', 'terminal states stay');
  } finally { r.close(); }
  const r2 = rig('auto_confirmations');
  try {
    r2.consent('sms', '+61412555111');
    r2.f.onCallEnded(ORG, r2.enq);
    r2.f.onCustomerReplied(ORG, r2.enq, { stop: true });
    assert.equal(r2.state().state, 'OPTED_OUT'); assert.ok(r2.msgs().every((m) => m.sstate !== 'waiting'), 'queued messages cancelled');
  } finally { r2.close(); }
  const r3 = rig('auto_confirmations');
  try {
    r3.consent('sms', '+61412555111');
    r3.f.onCallEnded(ORG, r3.enq);
    r3.f.onBooked(ORG, r3.enq, { via: 'receptionist', label: 'Wednesday the 2nd at 9 am', address: '1 Beach Rd' });
    const last = r3.msgs().at(-1); assert.equal(last.status, 'approved', 'confirmation is automatic at this level'); assert.match(last.body, /Mia, you're booked for Blocked drain on Wednesday the 2nd at 9 am at 1 Beach Rd/);
    // Emergency calls go straight to staff.
  } finally { r3.close(); }
  const r4 = rig('auto_followups');
  try { r4.consent('sms', '+61412555111'); r4.f.onCallEnded(ORG, r4.enq, { emergency: true }); assert.equal(r4.state().state, 'HANDED_TO_STAFF'); assert.equal(r4.msgs().length, 0); } finally { r4.close(); }
  const r5 = rig('auto_followups');
  try { r5.f.onCallEnded(ORG, r5.enq); r5.db.prepare("UPDATE tenant_documents SET status='closed' WHERE id=?").run(r5.enq); r5.due(); await r5.f.sweep(); assert.equal(r5.state().state, 'CLOSED_LOST'); } finally { r5.close(); }
});
