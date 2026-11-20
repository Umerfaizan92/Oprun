// T-180: Zoom (each business's own Server-to-Server OAuth app) and meeting invites, through the real server with a
// local stand-in for Zoom, Resend and Telnyx (the real providers cannot be reached from the test machine).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

async function mock() {
  const calls = [];
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => {
      calls.push({ path: req.url, method: req.method, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
      const send = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url.startsWith('/oauth')) return req.headers.authorization === 'Basic ' + Buffer.from('client-good:secret-good-123').toString('base64') ? send(200, { access_token: 'zoom-token', expires_in: 3600 }) : send(400, { reason: 'Invalid client_id or client_secret' });
      if (req.url === '/zoom/users/me') return send(200, { email: 'owner@harbour.example.test' });
      if (req.url === '/zoom/users/me/meetings') return send(201, { id: 987654321, join_url: 'https://zoom.us/j/987654321?pwd=abc', start_url: 'https://zoom.us/s/987654321?zak=host', password: 'abc123' });
      if (req.url.startsWith('/zoom/meetings/') && req.method === 'DELETE') { res.writeHead(204); return res.end(); }
      if (req.url === '/resend/emails') return send(200, { id: 'em-1' });
      if (req.url === '/telnyx/messages') return send(200, { data: { id: 'sms-1' } });
      send(404, { message: 'unknown' });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, calls, close: () => new Promise((r) => server.close(r)) };
}

test('Zoom: a business connects its own account, creates and cancels meetings; invites go by email and SMS from its own senders', async (t) => {
  const m = await mock();
  const s = await startServer({ ZOOM_OAUTH_URL: m.base + '/oauth', ZOOM_API_BASE_URL: m.base + '/zoom', RESEND_API_BASE_URL: m.base + '/resend', RESEND_API_KEY: 're_test', SAAS_VERIFY_FROM: 'Harbour <noreply@example.test>', TELNYX_API_BASE_URL: m.base + '/telnyx', TELNYX_API_KEY: 'k', TELNYX_FROM_NUMBER: '+61400000000', PLATFORM_SMS_FOR_BUSINESSES: '1' });
  t.after(async () => { await s.stop(); await m.close(); });
  const owner = await seedOwner(s, { business: 'Harbour Plumbing' });
  const O = (meth, u, b) => s.call(meth, u, { cookie: owner.cookie, body: b });
  assert.equal((await O('GET', '/api/saas/zoom')).json.connected, false);
  // Wrong details are refused and nothing is stored.
  let r = await O('POST', '/api/saas/zoom/connect', { account_id: 'acct-12345', client_id: 'client-bad', client_secret: 'secret-bad-123' });
  assert.equal(r.status, 400); assert.match(r.json.error, /Zoom did not accept/);
  r = await O('POST', '/api/saas/zoom/connect', { account_id: 'acct-12345', client_id: 'client-good', client_secret: 'secret-good-123' });
  assert.equal(r.status, 200, r.text); assert.equal(r.json.connected, true); assert.equal(r.json.account, 'owner@harbour.example.test');
  assert.ok(!JSON.stringify(r.json).includes('secret-good-123'), 'the secret is never sent back');
  const raw = new Database(s.dbPath).prepare('SELECT secret_bundle FROM zoom_accounts').get().secret_bundle;
  assert.ok(!raw.includes('secret-good-123'), 'the secret is stored encrypted');
  r = await O('POST', '/api/saas/zoom/meetings', { topic: 'Quote review with Sam', start_time: '2030-01-10T01:00:00.000Z', duration: 45 });
  assert.equal(r.status, 201, r.text); assert.equal(r.json.meeting.join_url, 'https://zoom.us/j/987654321?pwd=abc');
  const zm = r.json.meeting.id;
  const create = m.calls.find((c) => c.path === '/zoom/users/me/meetings');
  assert.equal(create.auth, 'Bearer zoom-token'); assert.equal(create.body.type, 2); assert.equal(create.body.settings.waiting_room, true);
  // Another business sees nothing and cannot invite to it.
  const other = await seedOwner(s, { business: 'Other Co', email: 'other-zoom@other.example.test' });
  assert.equal((await s.call('GET', '/api/saas/zoom', { cookie: other.cookie })).json.meetings.length, 0);
  assert.equal((await s.call('POST', '/api/saas/meetings/invite', { cookie: other.cookie, body: { zoom_meeting_id: zm, channel: 'email', to: 'sam@example.test' } })).status, 404);
  // Invites.
  assert.equal((await O('POST', '/api/saas/meetings/invite', { zoom_meeting_id: zm, channel: 'email', to: 'not-an-email' })).status, 400);
  r = await O('POST', '/api/saas/meetings/invite', { zoom_meeting_id: zm, channel: 'email', to: 'sam@example.test', message: 'Hi Sam, as discussed.' });
  assert.equal(r.status, 200, r.text);
  const email = m.calls.find((c) => c.path === '/resend/emails');
  assert.deepEqual(email.body.to, ['sam@example.test']); assert.match(email.body.subject, /Quote review with Sam/); assert.match(email.body.html, /zoom\.us\/j\/987654321/);
  r = await O('POST', '/api/saas/meetings/invite', { zoom_meeting_id: zm, channel: 'sms', to: '0412 345 678' });
  assert.equal(r.status, 200, r.text);
  const sms = m.calls.find((c) => c.path === '/telnyx/messages');
  assert.equal(sms.body.to, '+61412345678'); assert.match(sms.body.text, /Join here: https:\/\/zoom\.us\/j\/987654321/);
  // A built-in meeting's guest link can be sent too.
  const meeting = (await O('POST', '/api/saas/meetings', { title: 'Site walk-through', mode: 'video', guests_allowed: true })).json.meeting;
  r = await O('POST', '/api/saas/meetings/invite', { meeting_id: meeting.id, channel: 'email', to: 'kim@example.test' });
  assert.equal(r.status, 200, r.text);
  assert.match(m.calls.filter((c) => c.path === '/resend/emails').pop().body.html, /meet\.html\?m=/);
  // Cancel, then disconnect.
  assert.equal((await O('DELETE', `/api/saas/zoom/meetings/${zm}`)).status, 200);
  assert.equal((await O('GET', '/api/saas/zoom')).json.meetings.length, 0);
  assert.equal((await O('DELETE', '/api/saas/zoom')).json.connected, false);
  assert.equal((await O('POST', '/api/saas/zoom/meetings', { topic: 'After disconnect' })).status, 409);
  // The keypad needs the member's own mobile and the business number.
  r = await O('GET', '/api/saas/comms/dial'); assert.equal(r.status, 200); assert.equal(r.json.ready, false);
  assert.equal((await O('POST', '/api/saas/comms/dial', { to: 'abc' })).status, 400);
});
