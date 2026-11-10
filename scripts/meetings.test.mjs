// T-074 Video meetings backend: rooms belong to one workspace, guests need the private link and are let in by a
// member, call messages only travel inside one room, and people who leave or go silent are removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { installMeetings, MAX_PARTICIPANTS } from '../src/meetings.js';

test('meetings: isolation, guest waiting room, signalling and ending', async (t) => {
  const s = await startServer();
  t.after(s.stop);
  const a = await seedOwner(s), b = await seedOwner(s, { business: 'Other Co', email: 'other@other.example.test' });
  const call = (method, path, { cookie, body, headers = {} } = {}) => s.call(method, path, { cookie, body, headers });
  const peer = (secret) => ({ 'x-meeting-peer': secret });

  assert.equal((await call('GET', '/api/saas/meetings')).status, 401);
  assert.equal((await call('POST', '/api/saas/meetings', { cookie: a.cookie, body: { title: 'x' } })).status, 400);
  const made = await call('POST', '/api/saas/meetings', { cookie: a.cookie, body: { title: 'Quote review', mode: 'video', guests_allowed: true } });
  assert.equal(made.status, 201, made.text);
  const m = made.json.meeting;
  assert.match(m.guest_link, new RegExp('/saas/meet\\.html\\?m=' + m.id + '#t=[A-Za-z0-9_-]{32}$'));
  const token = m.guest_link.split('#t=')[1];

  // Another workspace cannot see, join, admit into, relink or end it.
  assert.equal((await call('GET', '/api/saas/meetings', { cookie: b.cookie })).json.meetings.length, 0);
  for (const path of ['join', 'end']) assert.equal((await call('POST', `/api/saas/meetings/${m.id}/${path}`, { cookie: b.cookie, body: {} })).status, 404, path);
  assert.equal((await call('POST', `/api/saas/meetings/${m.id}/guest-link`, { cookie: b.cookie, body: { guests_allowed: false } })).status, 404);

  // Owner joins. Call routes need the participant's own key.
  const host = (await call('POST', `/api/saas/meetings/${m.id}/join`, { cookie: a.cookie, body: {} })).json;
  assert.equal(host.self.host, true); assert.deepEqual(host.peers, []); assert.equal(host.max_participants, MAX_PARTICIPANTS);
  assert.ok(Array.isArray(host.ice_servers));
  for (const [method, path] of [['GET', 'poll'], ['POST', 'signal'], ['POST', 'state'], ['POST', 'leave']]) {
    const body = method === 'POST' ? {} : undefined;
    assert.equal((await call(method, '/api/meetings/call/' + path, { body })).status, 410, path + ' without a key');
    assert.equal((await call(method, '/api/meetings/call/' + path, { body, headers: peer('wrong-key') })).status, 410);
  }

  // Guest: a wrong or missing link gives the same answer as an unknown meeting.
  const lookup = (id, tk) => call('POST', `/api/public/meetings/${id}/lookup`, { body: { token: tk } });
  for (const [id, tk] of [[m.id, 'x'.repeat(32)], [m.id, ''], ['00000000-0000-4000-8000-000000000000', token], ['not-an-id', token]]) {
    const r = await lookup(id, tk); assert.equal(r.status, 404); assert.match(r.text, /invalid_link/);
  }
  const seen = await lookup(m.id, token);
  assert.equal(seen.status, 200);
  assert.deepEqual(Object.keys(seen.json.meeting).sort(), ['business', 'mode', 'starts_at', 'status', 'title']);
  assert.equal((await call('POST', `/api/public/meetings/${m.id}/knock`, { body: { token: 'bad', name: 'Mallory' } })).status, 404);

  const knock = await call('POST', `/api/public/meetings/${m.id}/knock`, { body: { token, name: '  Sam <b>Lee</b>  ' } });
  assert.equal(knock.status, 201); assert.equal(knock.json.host_present, true);
  assert.equal(knock.json.join, undefined, 'a guest gets no call key until let in');
  const hostPoll = (await call('GET', '/api/meetings/call/poll', { headers: peer(host.peer_secret) })).json;
  const waiting = hostPoll.messages.find((x) => x.type === 'waiting').waiting;
  assert.equal(waiting.length, 1); assert.equal(waiting[0].name, 'Sam b Lee /b', 'markup is stripped from names');
  // The other workspace's owner cannot let the guest in.
  assert.equal((await call('POST', `/api/saas/meetings/${m.id}/admit`, { cookie: b.cookie, body: { waiting_id: waiting[0].id, allow: true } })).status, 404);
  assert.equal((await call('POST', `/api/saas/meetings/${m.id}/admit`, { cookie: a.cookie, body: { waiting_id: waiting[0].id, allow: true } })).status, 200);
  const let_in = (await call('GET', '/api/public/meetings/waiting', { headers: { 'x-meeting-waiting': knock.json.waiting_secret } })).json;
  assert.equal(let_in.status, 'admitted');
  const guest = let_in.join;
  assert.equal(guest.self.kind, 'guest'); assert.equal(guest.self.host, false);
  assert.deepEqual(guest.peers.map((p) => p.id), [host.peer_id]);
  assert.equal((await call('GET', '/api/public/meetings/waiting', { headers: { 'x-meeting-waiting': knock.json.waiting_secret } })).status, 410, 'the waiting key works once');

  // Signalling reaches only the addressed participant in the same room.
  const sig = (from, to, data) => call('POST', '/api/meetings/call/signal', { headers: peer(from), body: { to, data } });
  assert.equal((await sig(guest.peer_secret, host.peer_id, { kind: 'offer', sdp: 'v=0 test' })).status, 200);
  assert.equal((await sig(guest.peer_secret, host.peer_id, { kind: 'candidate', candidate: { candidate: 'candidate:1 1 udp 1 192.0.2.1 9 typ host', sdpMid: '0', sdpMLineIndex: 0 } })).status, 200);
  assert.equal((await sig(guest.peer_secret, host.peer_id, { kind: 'run', sdp: 'x' })).status, 400);
  assert.equal((await sig(guest.peer_secret, host.peer_id, { kind: 'offer', sdp: 'x'.repeat(60000) })).status, 400, 'oversized message refused');
  const got = (await call('GET', '/api/meetings/call/poll', { headers: peer(host.peer_secret) })).json.messages;
  assert.deepEqual(got.map((x) => x.type), ['peer-joined', 'waiting', 'signal', 'signal']);
  assert.equal(got[2].from, guest.peer_id); assert.equal(got[2].data.sdp, 'v=0 test');

  // A second room in the other workspace: its participant cannot be reached from this room, and vice versa.
  const m2 = (await call('POST', '/api/saas/meetings', { cookie: b.cookie, body: { title: 'Other room' } })).json.meeting;
  const other = (await call('POST', `/api/saas/meetings/${m2.id}/join`, { cookie: b.cookie, body: {} })).json;
  assert.equal((await sig(guest.peer_secret, other.peer_id, { kind: 'offer', sdp: 'cross' })).status, 404);
  assert.equal((await sig(other.peer_secret, host.peer_id, { kind: 'offer', sdp: 'cross' })).status, 404);

  // State changes are told to the others; the list shows who is live.
  assert.equal((await call('POST', '/api/meetings/call/state', { headers: peer(guest.peer_secret), body: { audio: false, video: true, sharing: false } })).status, 200);
  const st = (await call('GET', '/api/meetings/call/poll', { headers: peer(host.peer_secret) })).json.messages;
  assert.deepEqual([st[0].type, st[0].peer.audio], ['peer-state', false]);
  const live = (await call('GET', '/api/saas/meetings', { cookie: a.cookie })).json.meetings[0].live;
  assert.deepEqual(live.map((p) => p.kind).sort(), ['guest', 'staff']);

  // Replacing the link stops the old one.
  const relinked = await call('POST', `/api/saas/meetings/${m.id}/guest-link`, { cookie: a.cookie, body: { guests_allowed: true } });
  assert.notEqual(relinked.json.meeting.guest_link, m.guest_link);
  assert.equal((await lookup(m.id, token)).status, 404);
  assert.equal((await call('POST', `/api/saas/meetings/${m.id}/guest-link`, { cookie: a.cookie, body: { guests_allowed: false } })).json.meeting.guest_link, null);

  // Leaving tells the others; ending removes everyone and the meeting cannot be joined again.
  assert.equal((await call('POST', '/api/meetings/call/leave', { headers: peer(guest.peer_secret), body: {} })).status, 200);
  assert.equal((await call('GET', '/api/meetings/call/poll', { headers: peer(guest.peer_secret) })).status, 410);
  assert.ok((await call('GET', '/api/meetings/call/poll', { headers: peer(host.peer_secret) })).json.messages.some((x) => x.type === 'peer-left' && x.id === guest.peer_id));
  assert.equal((await call('POST', `/api/saas/meetings/${m.id}/end`, { cookie: a.cookie, body: {} })).status, 200);
  assert.equal((await call('GET', '/api/meetings/call/poll', { headers: peer(host.peer_secret) })).status, 410);
  assert.equal((await call('POST', `/api/saas/meetings/${m.id}/join`, { cookie: a.cookie, body: {} })).status, 409);
  assert.equal((await call('GET', '/api/meetings/call/poll', { headers: peer(other.peer_secret) })).status === 410, false, 'the other workspace room is untouched');

  const db = new Database(s.dbPath, { readonly: true });
  const rows = db.prepare('SELECT kind,display_name,left_at FROM meeting_attendance WHERE meeting_id=? ORDER BY joined_at').all(m.id);
  const stored = JSON.stringify(db.prepare('SELECT * FROM meetings').all());
  db.close();
  assert.deepEqual(rows.map((r) => r.kind), ['staff', 'guest']);
  assert.ok(rows.every((r) => r.left_at), 'attendance is closed for everyone');
  assert.doesNotMatch(stored, new RegExp(token), 'the guest key is never stored');
});

test('meetings: room size limit, rejoin replaces the earlier place, silent participants are removed', async () => {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, full_name TEXT); CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT);");
  db.prepare("INSERT INTO organisations VALUES ('org','Harbour Plumbing')").run();
  const routes = new Map(); let clock = Date.parse('2026-11-10T00:00:00Z'), current = null;
  const reg = (method) => (path, ...handlers) => routes.set(method + ' ' + path, handlers);
  const app = { get: reg('GET'), post: reg('POST') };
  const meetings = installMeetings(app, { db, env: { SAAS_SESSION_SECRET: 'unit-test-secret', MEETING_STUN_URLS: '', MEETING_TURN_URLS: 'turn:relay.example.test:3478', MEETING_TURN_USERNAME: 'u', MEETING_TURN_CREDENTIAL: 'c' }, requireSaasUser: (req, res, next) => { req.saas = current; next(); }, saasAudit() {}, now: () => clock });
  const run = async (key, { params = {}, body = {}, headers = {} } = {}) => {
    const handlers = routes.get(key).filter((h) => !/Limit/i.test(h.name || '') && h.length !== 0 && !h.resetKey);
    const req = { params, body, headers, query: {}, protocol: 'https', ip: '127.0.0.1', get: (n) => (n === 'host' ? 'app.example.test' : headers[n.toLowerCase()]), on() {} };
    return new Promise((resolve) => {
      const res = { code: 200, headersSent: false, status(c) { this.code = c; return this; }, set() { return this; }, json(d) { this.headersSent = true; resolve({ status: this.code, json: d }); } };
      let i = 0; const next = () => { const h = handlers[i++]; if (h) h(req, res, next); }; next();
    });
  };
  const as = (n) => { db.prepare('INSERT OR IGNORE INTO users VALUES (?,?)').run('user-' + n, 'Person ' + n); current = { organisation_id: 'org', user_id: 'user-' + n, role: n === 0 ? 'owner' : 'employee' }; };
  as(0);
  const m = (await run('POST /api/saas/meetings', { body: { title: 'Team call' } })).json.meeting;
  const joins = [];
  for (let n = 0; n < MAX_PARTICIPANTS; n++) { as(n); const j = await run('POST /api/saas/meetings/:id/join', { params: { id: m.id } }); assert.equal(j.status, 200); joins.push(j.json); }
  assert.deepEqual(joins[0].ice_servers, [{ urls: ['turn:relay.example.test:3478'], username: 'u', credential: 'c' }], 'relay settings are passed on; no default STUN when it is switched off');
  assert.equal(joins[0].relay_configured, true);
  as(9); const full = await run('POST /api/saas/meetings/:id/join', { params: { id: m.id } });
  assert.equal(full.status, 409); assert.equal(full.json.code, 'full');
  // A member who is not the organiser or a manager cannot let guests in or end the meeting.
  as(3);
  assert.equal((await run('POST /api/saas/meetings/:id/end', { params: { id: m.id } })).status, 403);
  assert.equal((await run('POST /api/saas/meetings/:id/admit', { params: { id: m.id }, body: { waiting_id: '00000000-0000-4000-8000-000000000000', allow: true } })).status, 403);
  // The same person joining again takes the place of their earlier connection, so the room does not fill up.
  as(2); const again = await run('POST /api/saas/meetings/:id/join', { params: { id: m.id } });
  assert.equal(again.status, 200); assert.equal(meetings.liveCount(), MAX_PARTICIPANTS);
  assert.equal((await run('GET /api/meetings/call/poll', { headers: { 'x-meeting-peer': joins[2].peer_secret } })).status, 410);
  // Everyone else goes silent; only the one who keeps polling stays.
  clock += 30000; await run('POST /api/meetings/call/state', { headers: { 'x-meeting-peer': again.json.peer_secret }, body: { audio: true, video: true, sharing: false } });
  clock += 30000; meetings.sweep();
  assert.equal(meetings.liveCount(), 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM meeting_attendance WHERE left_at IS NULL').get().n, 1);
  meetings.stop(); db.close();
});
