// R-10 (T-130) and R-11 (T-131): live times, signed slots, holds that stop double booking, approval or auto booking.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { issueCallToken } from '../src/comms/receptionist-internal.js';
import { zoned, spokenLabel } from '../src/comms/receptionist-booking.js';

const ENV = { VOICE_SERVICE_KEY: 'svc-key-for-tests-only', VOICE_CALL_TOKEN_SECRET: 'call-token-secret-for-tests-only' };
const ALL_WEEK = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [['08:00', '16:00']]]));

test('time zone and spoken labels', () => {
  assert.equal(zoned('2026-12-01', '09:00', 'Australia/Perth').toISOString(), '2026-12-01T01:00:00.000Z');
  assert.equal(zoned('2026-12-01', '09:00', 'Australia/Sydney').toISOString(), '2026-11-30T22:00:00.000Z', 'daylight saving');
  assert.equal(spokenLabel(new Date('2026-12-01T06:30:00Z'), 'Australia/Perth'), 'Tuesday the 1st at half past 2');
  assert.equal(spokenLabel(new Date('2026-12-22T01:00:00Z'), 'Australia/Perth'), 'Tuesday the 22nd at 9 am');
});

async function setup(t, mode = 'approve', crews = 1) {
  const s = await startServer(ENV); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Slot Plumbing' });
  const sql = (q, ...a) => { const d = new Database(s.dbPath); try { return /^\s*select/i.test(q) ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } };
  const now = new Date().toISOString();
  sql("INSERT INTO receptionist_config (organisation_id,status,timezone,hours_json,booking_mode,booking_rules_json,updated_at) VALUES (?,'live','Australia/Perth',?,?,?,?)", owner.org, JSON.stringify(ALL_WEEK), mode,
    JSON.stringify({ services: [{ id: 'svc_1', name: 'Blocked drain', aliases: ['drain'], duration_min: 60, price_from_cents: 12000 }], buffer_min: 0, lead_time_hours: 2, window_days: 14, bookable_hours: null, service_area: ['Joondalup'], crews }), now);
  const mkCall = (id, from) => sql("INSERT INTO voice_calls (call_control_id,organisation_id,scope,from_number,stage,started_at,updated_at) VALUES (?,?,'business',?,'answered',?,?)", id, owner.org, from, now, now);
  const tool = async (callId, name, args, turn) => { const r = await fetch(s.base + '/api/internal/voice/tools/' + name, { method: 'POST', headers: { 'content-type': 'application/json', 'x-voice-service-key': ENV.VOICE_SERVICE_KEY, authorization: 'Bearer ' + issueCallToken(ENV, { org: owner.org, call_control_id: callId }) }, body: JSON.stringify({ args, turn_index: turn, idempotency_key: `${callId}-${name}-${turn}` }) }); return { status: r.status, json: await r.json() }; };
  const lead = async (callId, from, name) => { mkCall(callId, from); await tool(callId, 'create_or_update_customer', { name }, 1); return tool(callId, 'create_enquiry_lead', { service: 'Blocked drain', details: 'Sink', urgency: 'normal', suburb: 'Joondalup' }, 2); };
  const days = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  return { s, owner, sql, tool, lead, days, mkCall };
}

test('availability: service resolved by alias, out of area, three spread slots, signed and bound to the call', async (t) => {
  const { tool, lead, days, sql, owner } = await setup(t);
  await lead('c1', '+61412000001', 'Ana Lee');
  let r = await tool('c1', 'check_availability', { service: 'garden lighting', date_from: days(1), date_to: days(3) }, 3);
  assert.equal(r.json.code, 'ERR_VALIDATION'); assert.deepEqual(r.json.data.services, ['Blocked drain']);
  r = await tool('c1', 'check_availability', { service: 'drain', date_from: days(1), date_to: days(3), suburb: 'Perth' }, 4);
  assert.equal(r.json.data.out_of_area, true); assert.deepEqual(r.json.data.slots, []);
  r = await tool('c1', 'check_availability', { service: 'drain', date_from: days(1), date_to: days(5) }, 5);
  assert.equal(r.status, 200, JSON.stringify(r.json)); const slots = r.json.data.slots;
  assert.equal(slots.length, 3); assert.equal(new Set(slots.map((x) => x.start_at.slice(0, 10))).size, 3, 'on different days');
  assert.ok(!r.json.data.slots.some((x) => /\d{4}/.test(x.label)), 'spoken labels have no year');
  // A slot from another call cannot be used.
  await lead('c2', '+61412000002', 'Ben Hall');
  const other = await tool('c2', 'propose_booking', { slot_id: slots[0].slot_id, service: 'Blocked drain', address: '1 Beach Rd Joondalup' }, 3);
  assert.equal(other.json.code, 'ERR_VALIDATION');
  // Too long a range is refused.
  assert.equal((await tool('c1', 'check_availability', { service: 'drain', date_from: days(1), date_to: days(30) }, 6)).json.code, 'ERR_VALIDATION');
  // Switched off when the receptionist is not live.
  sql("UPDATE receptionist_config SET status='paused' WHERE organisation_id=?", owner.org);
  assert.equal((await tool('c1', 'check_availability', { service: 'drain', date_from: days(1), date_to: days(2) }, 7)).json.code, 'ERR_NOT_ALLOWED');
});

test('booking with approval: hold stops a second caller, approval creates booking and job, rejection releases the hold', async (t) => {
  const { s, owner, sql, tool, lead, days } = await setup(t, 'approve');
  await lead('a1', '+61412000011', 'Cara Diaz'); await lead('a2', '+61412000012', 'Dev Rao');
  const s1 = (await tool('a1', 'check_availability', { service: 'drain', date_from: days(2), date_to: days(2) }, 3)).json.data.slots[0];
  const s2 = (await tool('a2', 'check_availability', { service: 'drain', date_from: days(2), date_to: days(2) }, 3)).json.data.slots.find((x) => x.start_at === s1.start_at);
  assert.ok(s2, 'both callers were offered the same time');
  let r = await tool('a1', 'propose_booking', { slot_id: s1.slot_id, service: 'Blocked drain', address: '1 Beach Rd Joondalup' }, 4);
  assert.equal(r.status, 200, JSON.stringify(r.json)); assert.equal(r.json.data.status, 'pending_approval');
  r = await tool('a2', 'propose_booking', { slot_id: s2.slot_id, service: 'Blocked drain', address: '2 Beach Rd Joondalup' }, 4);
  assert.equal(r.json.code, 'ERR_CONFLICT', 'the held time cannot be taken'); assert.ok(r.json.data.alternatives.length >= 1);
  assert.equal(sql("SELECT COUNT(*) n FROM tenant_documents WHERE organisation_id=? AND kind='booking'", owner.org)[0].n, 0, 'nothing booked before approval');
  const ap = (await s.call('GET', '/api/saas/approvals', { cookie: owner.cookie })).json.approvals.find((x) => x.approval_type === 'receptionist_booking');
  assert.ok(ap); assert.match(ap.title, /Book Blocked drain for Cara Diaz/);
  r = await s.call('POST', `/api/saas/approvals/${ap.id}/decision`, { cookie: owner.cookie, body: { decision: 'approve' } });
  assert.equal(r.status, 200, r.text);
  const b = sql("SELECT * FROM tenant_documents WHERE organisation_id=? AND kind='booking'", owner.org);
  assert.equal(b.length, 1); assert.equal(b[0].start_at, new Date(s1.start_at).toISOString()); assert.ok(b[0].work_order_id);
  assert.equal(sql('SELECT address FROM work_orders WHERE id=?', b[0].work_order_id)[0].address, '1 Beach Rd Joondalup');
  assert.equal(sql("SELECT status FROM tenant_customers WHERE organisation_id=? AND name='Cara Diaz'", owner.org)[0].status, 'current');
  assert.equal(sql("SELECT COUNT(*) n FROM receptionist_slot_holds WHERE organisation_id=?", owner.org)[0].n, 0, 'hold released once booked');
  assert.equal(sql("SELECT f.state FROM receptionist_followups f JOIN voice_calls v ON v.enquiry_id=f.enquiry_id WHERE v.call_control_id='a1'")[0].state, 'BOOKED');
  // The booked job now blocks that time for everyone.
  const after = (await tool('a2', 'check_availability', { service: 'drain', date_from: days(2), date_to: days(2) }, 5)).json.data.slots;
  assert.ok(!after.some((x) => x.start_at === s1.start_at));
  // Rejection: the hold goes and the follow-up returns to waiting for the customer.
  const s3 = after[0]; r = await tool('a2', 'propose_booking', { slot_id: s3.slot_id, service: 'Blocked drain', address: '2 Beach Rd Joondalup' }, 6);
  assert.equal(r.json.data.status, 'pending_approval');
  const ap2 = (await s.call('GET', '/api/saas/approvals', { cookie: owner.cookie })).json.approvals.find((x) => x.approval_type === 'receptionist_booking');
  assert.equal((await s.call('POST', `/api/saas/approvals/${ap2.id}/decision`, { cookie: owner.cookie, body: { decision: 'reject' } })).status, 200);
  assert.equal(sql("SELECT COUNT(*) n FROM receptionist_slot_holds WHERE organisation_id=?", owner.org)[0].n, 0);
  assert.equal(sql("SELECT f.state FROM receptionist_followups f JOIN voice_calls v ON v.enquiry_id=f.enquiry_id WHERE v.call_control_id='a2'")[0].state, 'AWAITING_CUSTOMER');
  assert.equal(sql("SELECT COUNT(*) n FROM tenant_documents WHERE organisation_id=? AND kind='booking'", owner.org)[0].n, 1);
});

test('auto booking mode books at once; two crews allow two bookings at the same time', async (t) => {
  const { owner, sql, tool, lead, days } = await setup(t, 'auto', 2);
  await lead('b1', '+61412000021', 'Eve Ng'); await lead('b2', '+61412000022', 'Finn Ko'); await lead('b3', '+61412000023', 'Gus Ma');
  const slot = (id, turn) => tool(id, 'check_availability', { service: 'drain', date_from: days(3), date_to: days(3) }, turn).then((r) => r.json.data.slots[0]);
  const x1 = await slot('b1', 3), x2 = await slot('b2', 3);
  assert.equal(x1.start_at, x2.start_at);
  assert.equal((await tool('b1', 'propose_booking', { slot_id: x1.slot_id, service: 'Blocked drain', address: '3 Sea St' }, 4)).json.data.status, 'booked');
  assert.equal((await tool('b2', 'propose_booking', { slot_id: x2.slot_id, service: 'Blocked drain', address: '4 Sea St' }, 4)).json.data.status, 'booked', 'second crew');
  const x3 = await slot('b3', 3);
  assert.notEqual(x3.start_at, x1.start_at, 'full at that time now');
  assert.equal(sql("SELECT COUNT(*) n FROM tenant_documents WHERE organisation_id=? AND kind='booking' AND channel='receptionist'", owner.org)[0].n, 2);
  assert.equal(sql("SELECT COUNT(*) n FROM workspace_approvals WHERE organisation_id=? AND approval_type='receptionist_booking'", owner.org)[0].n, 0);
});
