// T-188: web phone. Calls go straight from the browser to the number dialled, from the business's own Telnyx number.
// The server makes a SIP credential connection (caller ID always the business number, outbound profile attached) and
// one credential per team member in the business's own account, hands the browser a token (never a password), logs
// the call for Recents and keeps recordings private to the business. A local stand-in answers like Telnyx.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const NUM = '+61862891786', KEY = 'KEY0123456789ABCDEF_tenant_secret_webphone', PUB = Buffer.alloc(32, 9).toString('base64');
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ3ZWIifQ.c2lnbmF0dXJl';

async function mock() {
  const calls = [];
  const server = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
      const body = b ? JSON.parse(b) : null; calls.push({ method: req.method, path: req.url, body, auth: req.headers.authorization });
      const ok = (data) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ data })); };
      const p = req.url.replace(/^\/telnyx/, '');
      if (p.startsWith('/phone_numbers?')) return ok([{ id: 'pn-1', phone_number: NUM }]);
      if (p === '/ai/assistants') return ok({ id: 'assistant-11111111-2222-3333-4444-555555555555' });
      if (p === '/call_control_applications') return ok({ id: 'app-1' });
      if (p === '/call_control_applications/app-1') return ok({ id: 'app-1', outbound: req.method === 'PATCH' ? body.outbound : {} });
      if (p === '/phone_numbers/pn-1') return ok({ id: 'pn-1' });
      if (p.startsWith('/outbound_voice_profiles?')) return ok([]);
      if (p === '/outbound_voice_profiles') return ok({ id: 'ovp-1' });
      if (p === '/credential_connections') return ok({ id: 'cc-1' });
      if (p === '/telephony_credentials') return ok({ id: 'cred-' + calls.filter((c) => c.path.endsWith('/telephony_credentials')).length });
      if (/^\/telephony_credentials\/cred-\d+\/token$/.test(p)) { res.writeHead(201, { 'content-type': 'text/plain' }); return res.end(JWT); }
      res.writeHead(404, { 'content-type': 'application/json' }); res.end('{}');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, calls, close: () => new Promise((r) => server.close(r)) };
}

test('web phone: token from the business account, call log, private recordings', async (t) => {
  const m = await mock();
  const s = await startServer({ TELNYX_API_BASE_URL: m.base + '/telnyx' });
  t.after(async () => { await s.stop(); await m.close(); });
  const owner = await seedOwner(s, { business: 'Fleet Parlour' });
  const O = (meth, u, b) => s.call(meth, u, { cookie: owner.cookie, body: b });

  // Nothing to call from until the business connects its own number.
  let r = await O('POST', '/api/saas/comms/webphone/token', {});
  assert.equal(r.status, 409); assert.match(r.json.error, /Connect your business number/);
  assert.equal((await O('GET', '/api/saas/comms/dial')).json.web_phone, false);

  r = await O('POST', '/api/saas/receptionist/telnyx/connect', { api_key: KEY, public_key: PUB, number: NUM });
  assert.equal(r.status, 200, r.text);
  assert.equal((await O('GET', '/api/saas/comms/dial')).json.web_phone, true);

  r = await O('POST', '/api/saas/comms/webphone/token', {});
  assert.equal(r.status, 200, r.text); assert.equal(r.json.login_token, JWT); assert.equal(r.json.caller_number, NUM);
  const cc = m.calls.find((c) => c.path === '/telnyx/credential_connections');
  assert.equal(cc.auth, 'Bearer ' + KEY, "the business's own key");
  assert.deepEqual(cc.body.outbound, { outbound_voice_profile_id: 'ovp-1', ani_override: NUM, ani_override_type: 'always' }, 'people called always see the business number');
  assert.match(cc.body.user_name, /^oprun[a-z0-9]{14}$/); assert.ok(cc.body.password.length >= 20);
  assert.ok(!r.text.includes(cc.body.password), 'the browser never gets a password');
  assert.equal(m.calls.find((c) => c.path === '/telnyx/telephony_credentials').body.connection_id, 'cc-1');
  // A second token for the same person reuses the connection and credential.
  await O('POST', '/api/saas/comms/webphone/token', {});
  assert.equal(m.calls.filter((c) => c.path === '/telnyx/credential_connections').length, 1);
  assert.equal(m.calls.filter((c) => c.path === '/telnyx/telephony_credentials').length, 1);

  // A call is logged for Recents: placed, answered, ended with its length.
  assert.equal((await O('POST', '/api/saas/comms/webphone/calls', { to: '12' })).status, 400);
  r = await O('POST', '/api/saas/comms/webphone/calls', { to: '0488 669 601' });
  assert.equal(r.status, 201, r.text); assert.equal(r.json.to, '+61488669601'); assert.equal(r.json.from, NUM);
  const id = r.json.id;
  assert.equal((await O('PATCH', `/api/saas/comms/webphone/calls/${id}`, { state: 'answered' })).status, 200);
  assert.equal((await O('PATCH', `/api/saas/comms/webphone/calls/${id}`, { state: 'ended', duration: 73 })).status, 200);
  let recent = (await O('GET', '/api/saas/comms/phonebook')).json.recents.find((x) => x.id === id);
  assert.deepEqual([recent.number, recent.direction, recent.result, recent.duration, recent.recording], ['+61488669601', 'outgoing', 'answered', 73, null]);

  // Recording: audio only, saved privately, played back from Recents.
  const up = (type) => { const fd = new FormData(); fd.append('audio', new Blob([Buffer.alloc(2048, 3)], { type }), 'call.webm'); return fetch(`${s.base}/api/saas/comms/webphone/calls/${id}/recording`, { method: 'POST', headers: { cookie: owner.cookie, origin: s.base }, body: fd }); };
  assert.equal((await up('text/html')).status, 400);
  assert.equal((await up('audio/webm')).status, 201);
  recent = (await O('GET', '/api/saas/comms/phonebook')).json.recents.find((x) => x.id === id);
  assert.equal(recent.recording, `/api/saas/comms/recordings/${id}`);
  const play = await fetch(s.base + recent.recording, { headers: { cookie: owner.cookie, origin: s.base } });
  assert.equal(play.status, 200); assert.equal(play.headers.get('content-type'), 'audio/webm'); assert.equal((await play.arrayBuffer()).byteLength, 2048);

  // Another business sees and touches none of it.
  const other = await seedOwner(s, { business: 'Other Co', email: 'other-webphone@other.example.test' });
  const X = (meth, u, b) => s.call(meth, u, { cookie: other.cookie, body: b });
  assert.equal((await X('POST', '/api/saas/comms/webphone/token', {})).status, 409);
  assert.equal((await X('PATCH', `/api/saas/comms/webphone/calls/${id}`, { state: 'ended' })).status, 404);
  assert.equal((await X('GET', recent.recording)).status, 404);
  assert.ok(!(await X('GET', '/api/saas/comms/phonebook')).json.recents.some((x) => x.id === id));
});
