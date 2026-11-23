// TR-32: assignment and tracking. Acceptance: assign → staff sees it → completes → owner sees completion.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto, { randomUUID } from 'node:crypto';
import { createDb } from '../src/db.js';
import { createPlatformIdentity } from '../src/platform-identity.js';
import { installPlatformAssignments } from '../src/platform-assignments.js';

let clock = new Date('2026-11-24T01:00:00.000Z');
const iso = (d = clock) => d.toISOString();

function setup() {
  const db = createDb(':memory:');
  db.exec("CREATE TABLE IF NOT EXISTS platform_records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'open',assigned_to TEXT,revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)");
  const app = express(); app.use(express.json());
  const platform = createPlatformIdentity({ db, env: { INTEGRATION_ENCRYPTION_KEY: 'e'.repeat(64) }, validTotp: () => false,
    founderAuthenticate: (req, res, next) => (req.get('x-admin-key') === 'founder-test-only' ? next() : res.status(401).json({ ok: false })) });
  platform.install(app, { limiter: (_q, _s, n) => n() });
  installPlatformAssignments(app, { db, platform, now: () => clock });
  return { db, app };
}
function staff(db, name, grants) {
  const id = randomUUID(), token = 'tok-' + id;
  db.prepare("INSERT INTO platform_users(id,email,name,password_hash,salt,totp_secret,role,grants_json,status,created_at) VALUES (?,?,?,?,?,?,'custom',?,'active',?)")
    .run(id, name.split(' ')[0].toLowerCase() + '@oprun.test', name, 'x', 'x', 'x', JSON.stringify(grants), iso());
  db.prepare('INSERT INTO platform_sessions VALUES (?,?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'), id, iso(new Date(Date.now() + 3600000)), iso());
  return { id, h: { 'x-platform-session': token } };
}
async function serve(app, fn) {
  const server = app.listen(0); await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body, headers = {}) => {
    const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  try { await fn(call); } finally { server.close(); }
}
const F = { 'x-admin-key': 'founder-test-only' };

test('end to end: assign, staff sees it, completes with evidence, owner reviews', async () => {
  const { db, app } = setup();
  const priya = staff(db, 'Priya Shah', ['support.read', 'support.edit', 'team.read']);
  const tom = staff(db, 'Tom Nguyen', ['operations.read', 'team.read']);
  await serve(app, async (call) => {
    const bad = await call('POST', '/api/operator/assignments', { kind: 'ticket', title: 'Refund question', assignee_id: tom.id }, F);
    assert.equal(bad.status, 400); assert.match(bad.data.error, /cannot open support tickets/, 'assignee must be able to open the work');
    assert.equal((await call('POST', '/api/operator/assignments', { kind: 'ticket', title: 'Refund question', assignee_id: priya.id, due_on: '2026-11-01' }, F)).status, 400, 'no past due dates');
    const made = await call('POST', '/api/operator/assignments', { kind: 'ticket', title: 'Refund question from Harbour Plumbing', body: 'Customer asks about a double charge.', assignee_id: priya.id, due_on: '2026-11-27', priority: 'high', note: 'Please reply today.' }, F);
    assert.equal(made.status, 201);
    const id = made.data.id;

    // Staff sees it.
    let mine = (await call('GET', '/api/operator/assignments/mine', null, priya.h)).data.items;
    assert.equal(mine.length, 1);
    assert.deepEqual([mine[0].title, mine[0].state, mine[0].priority, mine[0].due_on, mine[0].assigner], ['Refund question from Harbour Plumbing', 'assigned', 'high', '2026-11-27', 'Founder']);
    assert.equal((await call('GET', '/api/operator/assignments/mine', null, tom.h)).data.items.length, 0, 'others do not see it');
    assert.equal((await call('GET', `/api/operator/assignments/${id}`, null, tom.h)).status, 404, 'others cannot open it');
    assert.equal((await call('POST', `/api/operator/assignments/${id}/complete`, { note: 'Done by someone else', revision: 1 }, tom.h)).status, 404, 'only the assignee completes');

    // Staff works on it.
    let rev = mine[0].revision;
    assert.equal((await call('POST', `/api/operator/assignments/${id}/progress`, { state: 'in_progress', revision: rev }, priya.h)).status, 200); rev++;
    assert.equal((await call('POST', `/api/operator/assignments/${id}/progress`, { state: 'blocked', note: '', revision: rev }, priya.h)).status, 400, 'a blocker needs a reason');
    assert.equal((await call('POST', `/api/operator/assignments/${id}/progress`, { state: 'blocked', note: 'Waiting on Stripe', revision: rev }, priya.h)).status, 200); rev++;
    assert.equal((await call('POST', `/api/operator/assignments/${id}/complete`, { note: 'short', revision: rev }, priya.h)).status, 400, 'a real completion note is required');
    assert.equal((await call('POST', `/api/operator/assignments/${id}/complete`, { note: 'Refunded the duplicate charge.', evidence_url: 'http://example.test', revision: rev }, priya.h)).status, 400, 'evidence must be https');
    assert.equal((await call('POST', `/api/operator/assignments/${id}/complete`, { note: 'Refunded the duplicate charge.', revision: rev - 1 }, priya.h)).status, 409, 'stale revision refused');
    assert.equal((await call('POST', `/api/operator/assignments/${id}/complete`, { note: 'Refunded the duplicate charge and emailed the owner.', evidence_url: 'https://dashboard.stripe.com/refunds/re_test', revision: rev }, priya.h)).status, 200); rev++;
    assert.equal((await call('POST', `/api/operator/assignments/${id}/review`, { decision: 'accept', revision: rev }, priya.h)).status, 403, 'nobody reviews their own work');

    // Owner sees the completion.
    const review = (await call('GET', '/api/operator/assignments?state=review', null, F)).data;
    assert.equal(review.counts.review, 1);
    assert.equal(review.items[0].state, 'done');
    assert.equal(review.items[0].completion_note, 'Refunded the duplicate charge and emailed the owner.');
    assert.equal(review.items[0].evidence_url, 'https://dashboard.stripe.com/refunds/re_test');
    const det = (await call('GET', `/api/operator/assignments/${id}`, null, F)).data;
    assert.deepEqual(det.history.map((h) => h.action), ['assigned', 'started', 'blocked', 'completed']);
    assert.equal(det.history[0].note, 'Please reply today.');
    assert.equal(det.history[2].actor, 'Priya Shah');

    // Reopen, finish again, accept.
    assert.equal((await call('POST', `/api/operator/assignments/${id}/review`, { decision: 'reopen', note: '', revision: rev }, F)).status, 400, 'reopening needs a reason');
    assert.equal((await call('POST', `/api/operator/assignments/${id}/review`, { decision: 'reopen', note: 'Please attach the email too.', revision: rev }, F)).status, 200); rev++;
    mine = (await call('GET', '/api/operator/assignments/mine', null, priya.h)).data.items;
    assert.equal(mine[0].state, 'reopened');
    assert.equal((await call('POST', `/api/operator/assignments/${id}/complete`, { note: 'Email attached to the ticket thread.', evidence_url: 'https://mail.example.test/thread/1', revision: rev }, priya.h)).status, 200); rev++;
    assert.equal((await call('POST', `/api/operator/assignments/${id}/review`, { decision: 'accept', revision: rev }, F)).status, 200);
    const rec = db.prepare('SELECT status,work_state,reviewed_by FROM platform_records WHERE id=?').get(id);
    assert.deepEqual({ ...rec }, { status: 'closed', work_state: 'accepted', reviewed_by: 'founder' }, 'accepting closes the record');
    mine = (await call('GET', '/api/operator/assignments/mine', null, priya.h)).data.items;
    assert.equal(mine[0].state, 'accepted', 'staff sees it was accepted');
    assert.equal(db.prepare("SELECT COUNT(*) n FROM platform_audit WHERE action LIKE 'assignment.%'").get().n, 7, 'every step audited');
  });
});

test('managers, areas, existing records and overdue counts', async () => {
  const { db, app } = setup();
  const manager = staff(db, 'Leah Brooks', ['team.read', 'team.edit', 'operations.read', 'operations.edit', 'operations.create']);
  const reader = staff(db, 'Mo Ali', ['team.read', 'marketing.read']);
  const tom = staff(db, 'Tom Nguyen', ['operations.read']);
  const t = iso();
  db.prepare("INSERT INTO platform_records(id,kind,title,status,created_by,created_at,updated_at) VALUES ('inc1','incident','Email delays','open','founder',?,?)").run(t, t);
  await serve(app, async (call) => {
    assert.equal((await call('POST', '/api/operator/assignments', { kind: 'ticket', title: 'X ticket', assignee_id: tom.id }, manager.h)).status, 403, 'no support rights, cannot assign tickets');
    assert.equal((await call('POST', '/api/operator/assignments/inc1/assign', { assignee_id: tom.id, revision: 1 }, reader.h)).status, 403, 'team read alone cannot assign');
    assert.equal((await call('POST', '/api/operator/assignments/inc1/assign', { assignee_id: tom.id, due_on: '2026-11-25', revision: 1 }, manager.h)).status, 200, 'assign an existing record');
    const list = (await call('GET', '/api/operator/assignments', null, manager.h)).data;
    assert.equal(list.items[0].id, 'inc1');
    assert.deepEqual(list.assignees.find((a) => a.id === tom.id).areas, ['operations']);
    assert.ok(list.kinds.find((k) => k.kind === 'task').can_create);
    assert.equal(list.kinds.find((k) => k.kind === 'ticket'), undefined, 'only areas the viewer can open');
    const other = (await call('GET', '/api/operator/assignments', null, reader.h)).data;
    assert.equal(other.items.length, 0, 'a marketing reader does not see operations work');
    assert.deepEqual(other.assignees, [], 'no staff list without team edit');
    clock = new Date('2026-11-27T01:00:00.000Z');
    const late = (await call('GET', '/api/operator/assignments', null, manager.h)).data;
    assert.equal(late.counts.overdue, 1);
    assert.equal(late.items[0].overdue, true);
    assert.equal((await call('POST', '/api/operator/assignments/inc1/assign', { assignee_id: manager.id, revision: 1 }, manager.h)).status, 409, 'stale revision refused');
    assert.equal((await call('POST', '/api/operator/assignments/inc1/assign', { assignee_id: manager.id, revision: 2 }, manager.h)).status, 200, 'reassign');
    const det = (await call('GET', '/api/operator/assignments/inc1', null, manager.h)).data;
    assert.deepEqual(det.history.map((h) => h.action), ['assigned', 'reassigned']);
    assert.equal((await call('GET', '/api/operator/assignments', null, {})).status, 401);
    assert.equal((await call('GET', '/api/operator/assignments/mine', null, { cookie: 'sp_session=business' })).status, 401, 'business sign-in has no access');
  });
});
