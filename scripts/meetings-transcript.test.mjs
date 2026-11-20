// T-186: meeting transcription. Only a host can turn it on; everyone in the call is told; lines are saved only
// while it is on; captions reach everyone; the transcript is readable by the organiser, managers and staff who
// attended (never another business), downloadable as text, and a host can delete it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

test('meetings: transcription on/off, captions, saved transcript, access and download', async (t) => {
  const s = await startServer();
  t.after(s.stop);
  const a = await seedOwner(s, { business: 'Harbour Plumbing' }), b = await seedOwner(s, { business: 'Other Co', email: 'other-tr@other.example.test' });
  const call = (method, path, { cookie, body, headers = {} } = {}) => s.call(method, path, { cookie, body, headers });
  const peer = (secret) => ({ 'x-meeting-peer': secret });
  const m = (await call('POST', '/api/saas/meetings', { cookie: a.cookie, body: { title: 'Quote review', guests_allowed: true } })).json.meeting;
  const token = m.guest_link.split('#t=')[1];
  const host = (await call('POST', `/api/saas/meetings/${m.id}/join`, { cookie: a.cookie, body: {} })).json;
  assert.equal(host.transcribing, false);
  // A guest joins.
  const knock = (await call('POST', `/api/public/meetings/${m.id}/knock`, { body: { token, name: 'Sam Lee' } })).json;
  const waitingId = (await call('GET', '/api/meetings/call/poll', { headers: peer(host.peer_secret) })).json.messages.find((x) => x.type === 'waiting').waiting[0].id;
  await call('POST', `/api/saas/meetings/${m.id}/admit`, { cookie: a.cookie, body: { waiting_id: waitingId, allow: true } });
  const guest = (await call('GET', '/api/public/meetings/waiting', { headers: { 'x-meeting-waiting': knock.waiting_secret } })).json.join;
  await call('GET', '/api/meetings/call/poll', { headers: peer(guest.peer_secret) }); // clear the joined messages
  await call('GET', '/api/meetings/call/poll', { headers: peer(host.peer_secret) });

  // Nothing is saved while transcription is off; a guest cannot turn it on.
  assert.equal((await call('POST', '/api/meetings/call/transcript', { headers: peer(guest.peer_secret), body: { text: 'hello' } })).status, 409);
  assert.equal((await call('POST', '/api/meetings/call/transcription', { headers: peer(guest.peer_secret), body: { on: true } })).status, 403);
  assert.equal((await call('POST', '/api/meetings/call/transcription', { body: { on: true } })).status, 410);

  // The host turns it on: everyone is told.
  let r = await call('POST', '/api/meetings/call/transcription', { headers: peer(host.peer_secret), body: { on: true } });
  assert.equal(r.status, 200, r.text);
  const told = (await call('GET', '/api/meetings/call/poll', { headers: peer(guest.peer_secret) })).json.messages;
  assert.deepEqual(told.find((x) => x.type === 'transcription'), { type: 'transcription', on: true, by: host.self.name });
  await call('GET', '/api/meetings/call/poll', { headers: peer(host.peer_secret) });

  // Each person's lines are saved with their name and shown to everyone as captions.
  assert.equal((await call('POST', '/api/meetings/call/transcript', { headers: peer(guest.peer_secret), body: { text: '  Can you come on\nTuesday?  ' } })).status, 200);
  assert.equal((await call('POST', '/api/meetings/call/transcript', { headers: peer(host.peer_secret), body: { text: 'Yes, at 10 am.' } })).status, 200);
  assert.equal((await call('POST', '/api/meetings/call/transcript', { headers: peer(host.peer_secret), body: { text: 'x'.repeat(1001) } })).status, 400);
  const caps = (await call('GET', '/api/meetings/call/poll', { headers: peer(host.peer_secret) })).json.messages.filter((x) => x.type === 'caption');
  assert.deepEqual(caps.map((c) => [c.line.speaker, c.line.text]), [['Sam Lee', 'Can you come on Tuesday?'], [host.self.name, 'Yes, at 10 am.']]);

  // Off again: further lines are refused.
  await call('POST', '/api/meetings/call/transcription', { headers: peer(host.peer_secret), body: { on: false } });
  assert.equal((await call('POST', '/api/meetings/call/transcript', { headers: peer(guest.peer_secret), body: { text: 'secret aside' } })).status, 409);

  // Reading and downloading: own business only.
  r = await call('GET', `/api/saas/meetings/${m.id}/transcript`, { cookie: a.cookie });
  assert.equal(r.status, 200); assert.equal(r.json.lines.length, 2); assert.equal(r.json.lines[0].speaker_kind, 'guest');
  assert.equal((await call('GET', `/api/saas/meetings/${m.id}/transcript`, { cookie: b.cookie })).status, 404);
  assert.equal((await call('GET', `/api/saas/meetings/${m.id}/transcript`)).status, 401);
  r = await call('GET', `/api/saas/meetings/${m.id}/transcript?format=txt`, { cookie: a.cookie });
  assert.equal(r.status, 200); assert.match(r.text, /^Quote review\nTranscript/); assert.match(r.text, /Sam Lee \(guest\): Can you come on Tuesday\?/); assert.doesNotMatch(r.text, /secret aside/);
  assert.equal((await call('GET', '/api/saas/meetings', { cookie: a.cookie })).json.meetings[0].transcript_lines, 2);

  // Ending the meeting turns transcription off; the host can delete the transcript; others cannot.
  await call('POST', '/api/meetings/call/transcription', { headers: peer(host.peer_secret), body: { on: true } });
  await call('POST', `/api/saas/meetings/${m.id}/end`, { cookie: a.cookie, body: {} });
  assert.equal((await call('GET', '/api/saas/meetings', { cookie: a.cookie })).json.past[0].transcribing, false);
  assert.equal((await call('DELETE', `/api/saas/meetings/${m.id}/transcript`, { cookie: b.cookie })).status, 404);
  r = await call('DELETE', `/api/saas/meetings/${m.id}/transcript`, { cookie: a.cookie });
  assert.equal(r.json.deleted, 2);
  assert.equal((await call('GET', `/api/saas/meetings/${m.id}/transcript`, { cookie: a.cookie })).json.lines.length, 0);
});
