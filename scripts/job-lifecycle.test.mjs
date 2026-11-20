// T-164/T-165: appointment reminders and booking confirmations.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { createJobLifecycle, localParts } from '../src/job-lifecycle.js';
import { createOutbound } from '../src/comms/outbound.js';

const ORG = 'org-fleet';
// 2026-11-20 00:30 UTC = 08:30 in Perth (UTC+8).
const NOW = new Date('2026-11-20T00:30:00Z');

function setup({ smsReady = true, mode = null, clock = NOW } = {}) {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT, display_name TEXT, timezone TEXT);
    CREATE TABLE memberships (organisation_id TEXT, user_id TEXT, role TEXT, created_at TEXT);
    CREATE TABLE tenant_customers (id TEXT PRIMARY KEY, organisation_id TEXT, name TEXT, email TEXT, phone TEXT);
    CREATE TABLE tenant_documents (id TEXT PRIMARY KEY, organisation_id TEXT, kind TEXT, work_order_id TEXT);
    CREATE TABLE work_orders (id TEXT PRIMARY KEY, organisation_id TEXT, title TEXT, address TEXT, start_at TEXT, customer_id TEXT, status TEXT, completed_at TEXT, required_workers INTEGER DEFAULT 1);
    CREATE TABLE workers (id TEXT PRIMARY KEY, organisation_id TEXT, user_id TEXT, full_name TEXT);
    CREATE TABLE job_offers (id TEXT PRIMARY KEY, organisation_id TEXT, work_order_id TEXT, worker_id TEXT, status TEXT);
    CREATE TABLE comms_threads (id TEXT PRIMARY KEY, organisation_id TEXT, channel TEXT, contact_address TEXT, contact_name TEXT, subject TEXT, status TEXT, last_message_at TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE comms_messages (id TEXT PRIMARY KEY, organisation_id TEXT, thread_id TEXT, direction TEXT, kind TEXT, body TEXT, provider TEXT, status TEXT, ai_generated INTEGER, approval_id TEXT, created_by_user_id TEXT, occurred_at TEXT, created_at TEXT);
    CREATE TABLE comms_message_schedule (message_id TEXT PRIMARY KEY, organisation_id TEXT, send_at TEXT, state TEXT, error TEXT, created_by TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE automation_marks (organisation_id TEXT NOT NULL, mark TEXT NOT NULL, ref TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (organisation_id, mark, ref));
    INSERT INTO organisations VALUES ('${ORG}','Fleet Parlour',NULL,'Australia/Perth');
    INSERT INTO memberships VALUES ('${ORG}','owner-1','owner','2026-01-01');
    INSERT INTO tenant_customers VALUES ('cust-1','${ORG}','Faiz Anul','faiz@example.com','0404 946 656');
    INSERT INTO tenant_customers VALUES ('cust-2','${ORG}','No Mobile','x@example.com','(08) 6289 1786');
    INSERT INTO workers VALUES ('w-1','${ORG}','user-w1','Sam Worker'), ('w-2','${ORG}',NULL,'No Account');`);
  const notes = [], approvals = [];
  const notify = { notifyUser: async (org, user, o) => { notes.push({ to: user, ...o }); }, notifyRoles: async (org, roles, o) => { notes.push({ to: roles.join('+'), ...o }); } };
  const createApproval = (req, a) => { const id = crypto.randomUUID(); approvals.push({ id, org: req.saas.organisation_id, ...a }); return { id }; };
  let t = clock;
  const lc = createJobLifecycle({ db, outbound: createOutbound({ db }), notify, createApproval, smsReady: () => smsReady, enquiryReference: () => 'ENQ-1001', now: () => t, log: { warn() {} } });
  if (mode) lc.saveSettings(ORG, 'owner-1', { customer_mode: mode, day_before: true, day_of: true, workers: true, owner_summary: true, confirmations: true });
  const job = (id, startAt, extra = {}) => { db.prepare('INSERT INTO work_orders (id,organisation_id,title,address,start_at,customer_id,status,completed_at) VALUES (?,?,?,?,?,?,?,?)').run(id, ORG, extra.title || 'Bull bar polishing', '12 Main St', startAt, extra.customer || 'cust-1', extra.status || 'allocated', extra.completed || null); db.prepare("INSERT INTO tenant_documents VALUES (?,?, 'booking', ?)").run('b-' + id, ORG, id); };
  const msgs = () => db.prepare('SELECT m.status,m.body,m.approval_id,t.channel,t.contact_address FROM comms_messages m JOIN comms_threads t ON t.id=m.thread_id ORDER BY t.channel, m.created_at').all();
  return { db, lc, notes, approvals, job, msgs, setNow: (d) => { t = d; } };
}

test('local time helper uses the business time zone', () => {
  assert.deepEqual(localParts(NOW, 'Australia/Perth'), { date: '2026-11-20', hour: 8 });
  assert.deepEqual(localParts(NOW, 'Australia/Sydney'), { date: '2026-11-20', hour: 11 });
});

test('default: the day-before reminder waits in Approvals, by text and email, once', async () => {
  const s = setup();
  s.job('j1', '2026-11-21T01:00:00Z'); // tomorrow 9 am Perth
  const r = await s.lc.runReminders();
  assert.equal(r.customer, 2);
  const m = s.msgs();
  assert.deepEqual(m.map((x) => [x.channel, x.contact_address, x.status]), [['email', 'faiz@example.com', 'pending_approval'], ['sms', '+61404946656', 'pending_approval']]);
  assert.ok(m.every((x) => x.approval_id));
  assert.match(m[1].body, /^Hi Faiz, a reminder from Fleet Parlour: Bull bar polishing is booked for tomorrow, Saturday 21 November at 9:00 am at 12 Main St\. Ref ENQ-1001\./);
  assert.equal(s.approvals.length, 2); assert.ok(s.approvals.every((a) => a.approval_type === 'outbound_message' && a.source_module === 'reminders'));
  await s.lc.runReminders(); await s.lc.runReminders();
  assert.equal(s.msgs().length, 2, 'never sent twice');
  assert.ok(s.db.prepare("SELECT 1 FROM automation_marks WHERE mark='reminded' AND ref='j1'").get(), 'the older automation will skip this job');
});

test('auto mode sends the fixed wording without approval; off sends nothing to customers', async () => {
  const a = setup({ mode: 'auto' }); a.job('j1', '2026-11-21T01:00:00Z');
  await a.lc.runReminders();
  assert.deepEqual(a.msgs().map((x) => x.status), ['approved', 'approved']); assert.equal(a.approvals.length, 0);
  const o = setup({ mode: 'off' }); o.job('j1', '2026-11-21T01:00:00Z');
  await o.lc.runReminders();
  assert.equal(o.msgs().length, 0);
});

test('no text without the business SMS sender or a mobile; email still goes', async () => {
  const s = setup({ smsReady: false }); s.job('j1', '2026-11-21T01:00:00Z');
  await s.lc.runReminders();
  assert.deepEqual(s.msgs().map((x) => x.channel), ['email']);
  const l = setup(); l.job('j2', '2026-11-21T01:00:00Z', { customer: 'cust-2' });
  await l.lc.runReminders();
  assert.deepEqual(l.msgs().map((x) => x.channel), ['email'], 'a landline gets no text');
});

test('no reminders at night, for finished or cancelled jobs, or for a job the old automation already reminded', async () => {
  const night = setup({ clock: new Date('2026-11-20T14:00:00Z') }); // 10 pm Perth
  night.job('j1', '2026-11-21T03:00:00Z');
  await night.lc.runReminders();
  assert.equal(night.msgs().length, 0);
  const s = setup();
  s.job('done', '2026-11-21T01:00:00Z', { completed: '2026-11-19T00:00:00Z' });
  s.job('cxl', '2026-11-21T02:00:00Z', { status: 'cancelled' });
  s.job('old', '2026-11-21T03:00:00Z');
  s.db.prepare("INSERT INTO automation_marks VALUES (?, 'reminded', 'old', 'x')").run(ORG);
  await s.lc.runReminders();
  assert.equal(s.msgs().length, 0);
});

test('on the day: customer reminder, assigned workers alerted, owners get one summary', async () => {
  const s = setup({ mode: 'auto' });
  s.job('today', '2026-11-20T03:00:00Z'); // 11 am Perth today
  s.db.prepare("INSERT INTO job_offers VALUES ('o1',?, 'today','w-1','accepted'), ('o2',?, 'today','w-2','accepted')").run(ORG, ORG);
  await s.lc.runReminders();
  assert.match(s.msgs().find((x) => x.channel === 'sms').body, /^Hi Faiz, Fleet Parlour here: see you today at 11:00 am at 12 Main St/);
  const w = s.notes.filter((n) => n.kind === 'job_today');
  assert.deepEqual(w.map((n) => [n.to, n.urgent]), [['user-w1', true]], 'only workers with an account; urgent so a text goes too');
  assert.equal(s.notes.filter((n) => n.kind === 'jobs_today').length, 1);
  await s.lc.runReminders();
  assert.equal(s.notes.filter((n) => n.kind === 'jobs_today').length, 1, 'one summary a day');
  assert.equal(s.notes.filter((n) => n.kind === 'job_today').length, 1);
});

test('a job filled by workers is confirmed to the team and the customer confirmation is staged', async () => {
  const s = setup();
  s.job('j1', '2026-11-25T01:00:00Z');
  s.db.prepare("INSERT INTO job_offers VALUES ('o1',?, 'j1','w-1','accepted')").run(ORG);
  const r = await s.lc.onAllocated(ORG, 'j1');
  assert.deepEqual(r.workers, ['Sam Worker']);
  assert.equal(s.notes[0].kind, 'job_confirmed'); assert.match(s.notes[0].body, /Workers: Sam Worker/);
  assert.match(s.msgs()[0].body, /your booking with Fleet Parlour is confirmed|Your booking with Fleet Parlour is confirmed/);
  assert.equal(s.approvals.length, 2);
  await s.lc.onAllocated(ORG, 'j1');
  assert.equal(s.approvals.length, 2); assert.equal(s.notes.filter((n) => n.kind === 'job_confirmed').length, 1);
  assert.equal((await s.lc.onAllocated('other-org', 'j1')).skipped, true, 'another business cannot trigger it');
});

test('settings are validated', () => {
  const s = setup();
  assert.equal(s.lc.saveSettings(ORG, 'u', { customer_mode: 'spam' }).status, 400);
  assert.equal(s.lc.settings(ORG).customer_mode, 'approve');
});
