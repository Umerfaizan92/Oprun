// T-184: appointments, the business calendar, suggested times, clash checks, video links, reminders and team alerts.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { zonedToUtc } from '../src/appointments.js';

test('zonedToUtc converts a local business time to UTC across time zones and daylight saving', () => {
  assert.equal(zonedToUtc('2030-01-10', 9, 0, 'Australia/Perth').toISOString(), '2030-01-10T01:00:00.000Z');
  assert.equal(zonedToUtc('2030-01-10', 9, 0, 'Australia/Sydney').toISOString(), '2030-01-09T22:00:00.000Z');
  assert.equal(zonedToUtc('2030-07-10', 9, 0, 'Australia/Sydney').toISOString(), '2030-07-09T23:00:00.000Z');
});

test('appointments: calendar, free times, clashes, video link, approved reminder sent once, team alert', async (t) => {
  const calls = [];
  const mock = http.createServer((req, res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { calls.push({ path: req.url, body: b ? JSON.parse(b) : null }); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(req.url === '/resend/emails' ? { id: 'em-' + calls.length } : { data: { id: 'sms-' + calls.length } })); }); });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r)); const mb = `http://127.0.0.1:${mock.address().port}`;
  const s = await startServer({ APPOINTMENT_SWEEP_MS: '500', RESEND_API_BASE_URL: mb + '/resend', RESEND_API_KEY: 're_test', SAAS_VERIFY_FROM: 'Harbour <noreply@example.test>', TELNYX_API_BASE_URL: mb + '/telnyx', TELNYX_API_KEY: 'k', TELNYX_FROM_NUMBER: '+61400000000', PLATFORM_SMS_FOR_BUSINESSES: '1' });
  t.after(async () => { await s.stop(); await new Promise((r) => mock.close(r)); });
  const owner = await seedOwner(s, { business: 'Harbour Plumbing' });
  const O = (m, u, b) => s.call(m, u, { cookie: owner.cookie, body: b });
  const db = new Database(s.dbPath); const cust = crypto.randomUUID(), at = new Date().toISOString();
  db.prepare("UPDATE organisations SET timezone='Australia/Perth' WHERE id=?").run(owner.org);
  db.prepare("INSERT INTO tenant_customers(id,organisation_id,name,email,phone,status,source,created_at,updated_at) VALUES (?,?,?,?,?,'current','manual',?,?)").run(cust, owner.org, 'Sam Lee', 'sam@example.test', '0412 345 678', at, at);
  db.close();
  // Suggested free times on a future weekday in the business's hours.
  const day = new Date(Date.now() + 7 * 864e5); while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  const date = day.toISOString().slice(0, 10);
  let r = await O('GET', `/api/saas/appointments/slots?date=${date}&duration=60`);
  assert.equal(r.status, 200, r.text); assert.ok(r.json.slots.length > 0); assert.equal(r.json.slots[0].start, zonedToUtc(date, 8, 0, 'Australia/Perth').toISOString());
  // Video appointment gets a meeting and guest link; the reminder text is previewed and approved by ticking.
  const first = r.json.slots[0].start;
  r = await O('POST', '/api/saas/appointments/preview', { title: 'Quote review', kind: 'video', starts_at: first });
  assert.match(r.json.text, /Reminder from Harbour Plumbing: Quote review on .* Join the video call/);
  r = await O('POST', '/api/saas/appointments', { customer_id: cust, title: 'Quote review', kind: 'video', starts_at: first, duration_min: 60, remind_customer: true, remind_channel: 'email', remind_before_min: 1440, staff_before_min: 30 });
  assert.equal(r.status, 201, r.text); assert.match(r.json.appointment.link, /\/saas\/meet\.html\?m=.+#t=/); assert.equal(r.json.appointment.reminder, 'scheduled');
  const apptId = r.json.appointment.id;
  // The same time now shows as taken, and booking over it needs confirmation.
  r = await O('GET', `/api/saas/appointments/slots?date=${date}&duration=60`); assert.notEqual(r.json.slots[0].start, first);
  r = await O('POST', '/api/saas/appointments', { title: 'Site visit', starts_at: first, duration_min: 30 });
  assert.equal(r.status, 409); assert.match(r.json.error, /overlaps "Quote review"/);
  assert.equal((await O('POST', '/api/saas/appointments', { title: 'Site visit', starts_at: first, duration_min: 30, allow_overlap: true })).status, 201);
  // Reminders need a contact for the channel.
  assert.equal((await O('POST', '/api/saas/appointments', { title: 'Call back', kind: 'phone', starts_at: new Date(Date.now() + 9 * 864e5).toISOString(), remind_customer: true, remind_channel: 'sms' })).status, 400);
  // Calendar shows it; another business sees nothing.
  const from = new Date(Date.now()).toISOString(), to = new Date(Date.now() + 30 * 864e5).toISOString();
  r = await O('GET', `/api/saas/calendar?from=${from}&to=${to}`); assert.equal(r.json.events.filter((e) => e.type === 'appointment').length, 2);
  const other = await seedOwner(s, { business: 'Other Co', email: 'other-cal@other.example.test' });
  assert.equal((await s.call('GET', `/api/saas/calendar?from=${from}&to=${to}`, { cookie: other.cookie })).json.events.length, 0);
  assert.equal((await s.call('PATCH', `/api/saas/appointments/${apptId}`, { cookie: other.cookie, body: { status: 'cancelled' } })).status, 404);
  // Move it to start in 20 minutes: the approved reminder is sent once and the team is alerted.
  const soon = new Date(Date.now() + 20 * 6e4).toISOString();
  assert.equal((await O('PATCH', `/api/saas/appointments/${apptId}`, { starts_at: soon, allow_overlap: true })).status, 200);
  await new Promise((res) => setTimeout(res, 2500));
  const sent = calls.filter((c) => c.path === '/resend/emails');
  assert.equal(sent.length, 1, 'reminder sent once'); assert.deepEqual(sent[0].body.to, ['sam@example.test']); assert.match(sent[0].body.html, /Join the video call/);
  const alerts = (await O('GET', '/api/saas/notifications')).json.notifications.filter((n) => n.kind === 'appointment');
  assert.equal(alerts.length, 1); assert.match(alerts[0].title, /Video call at .*: Quote review/);
  r = await O('GET', `/api/saas/calendar?from=${from}&to=${to}`); assert.equal(r.json.events.find((e) => e.id === apptId).reminder, 'sent');
  // Cancelling closes the video room.
  assert.equal((await O('PATCH', `/api/saas/appointments/${apptId}`, { status: 'cancelled' })).status, 200);
  r = await O('GET', `/api/saas/calendar?from=${from}&to=${to}`); assert.equal(r.json.events.some((e) => e.id === apptId), false);
});
