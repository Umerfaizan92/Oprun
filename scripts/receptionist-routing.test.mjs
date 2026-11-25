// R-05 (T-125): a business with a live AI receptionist is answered by the voice worker; any failure falls back down the
// existing chain so a caller is never left in silence. Uses createVoice with a fake Telnyx API.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createVoice } from '../src/comms/voice.js';
import { migrateReceptionist } from '../src/comms/receptionist-store.js';

function rig({ live = true, env = {}, failStream = false } = {}) {
  const db = new Database(':memory:');
  const calls = [];
  const fetchImpl = async (url, opt) => {
    const path = new URL(url).pathname.replace('/v2', ''), body = JSON.parse(opt.body || '{}');
    calls.push({ path, body });
    if (failStream && path.endsWith('/streaming_start')) return new Response(JSON.stringify({ errors: [{ detail: 'not available' }] }), { status: 422 });
    return new Response('{"data":{}}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const v = createVoice({ db, env: { TELNYX_API_KEY: 'k', TELNYX_API_BASE_URL: 'https://api.telnyx.test/v2', RECEPTIONIST_ENABLED: '1', VOICE_WORKER_WSS_URL: 'wss://voice.example.test/stream', TELNYX_AI_ASSISTANT_ID: 'assistant-1', VOICE_WORKER_CONNECT_MS: '150', ...env },
    fetchImpl, recordInbound: () => ({ id: 'm1', thread_id: 't1' }), orgForNumber: () => 'org-1', profileFor: () => ({ business_name: 'Test Plumbing' }),
    receptionist: { live: () => live, token: (org, id) => `tok-${org}-${id}` }, log: { warn() {}, error() {}, log() {} } });
  migrateReceptionist(db);
  const ev = (event_type, payload = {}) => v.handle({ event_type, payload: { call_control_id: 'cc-1', call_session_id: 's-1', from: '+61412000000', to: '+61862891786', ...payload } });
  const stage = () => db.prepare("SELECT stage,route,failures_json FROM voice_calls WHERE call_control_id='cc-1'").get();
  return { db, calls, ev, stage };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('live receptionist: the call is streamed to the worker with a call token; no Telnyx assistant is started', async () => {
  const r = rig();
  await r.ev('call.initiated'); await r.ev('call.answered');
  const start = r.calls.find((c) => c.path.endsWith('/streaming_start'));
  assert.ok(start, 'stream started'); assert.equal(start.body.stream_url, 'wss://voice.example.test/stream?token=tok-org-1-cc-1');
  assert.equal(start.body.stream_bidirectional_codec, 'PCMU');
  assert.equal(r.stage().stage, 'streaming');
  // The worker loads the call in time (call-context marks it live): no fallback.
  r.db.prepare("UPDATE voice_calls SET stage='streaming_live' WHERE call_control_id='cc-1'").run();
  await wait(250);
  assert.ok(!r.calls.some((c) => c.path.endsWith('/ai_assistant_start')));
});

test('worker does not load the call in time: the Telnyx assistant takes over', async () => {
  const r = rig();
  await r.ev('call.initiated'); await r.ev('call.answered');
  await wait(300);
  assert.ok(r.calls.some((c) => c.path.endsWith('/ai_assistant_start')), 'fallback assistant');
  assert.match(r.stage().failures_json, /worker_timeout/);
});

test('stream cannot start, or drops mid-call: fallback; without an assistant: transfer or voicemail', async () => {
  const a = rig({ failStream: true });
  await a.ev('call.initiated'); await a.ev('call.answered');
  assert.ok(a.calls.some((c) => c.path.endsWith('/ai_assistant_start'))); assert.match(a.stage().failures_json, /streaming_start/);
  const b = rig();
  await b.ev('call.initiated'); await b.ev('call.answered');
  b.db.prepare("UPDATE voice_calls SET stage='streaming_live' WHERE call_control_id='cc-1'").run();
  await b.ev('streaming.failed', { failure_reason: 'worker closed' });
  assert.ok(b.calls.some((c) => c.path.endsWith('/ai_assistant_start')), 'dropped worker -> assistant'); assert.match(b.stage().failures_json, /stream_ended/);
  const c = rig({ env: { TELNYX_AI_ASSISTANT_ID: '' } });
  await c.ev('call.initiated'); await c.ev('call.answered'); await wait(300);
  assert.ok(c.calls.some((x) => x.path.endsWith('/speak')), 'voicemail greeting when no assistant and no transfer');
  assert.equal(c.stage().stage, 'voicemail_greeting');
});

test('not live, or the feature switch off: the existing path is used unchanged', async () => {
  for (const r of [rig({ live: false }), rig({ env: { RECEPTIONIST_ENABLED: '0' } }), rig({ env: { VOICE_WORKER_WSS_URL: 'http://insecure.example' } })]) {
    await r.ev('call.initiated'); await r.ev('call.answered');
    assert.ok(!r.calls.some((c) => c.path.endsWith('/streaming_start')));
    assert.ok(r.calls.some((c) => c.path.endsWith('/ai_assistant_start')));
  }
});

test('warm transfer: dial, whisper, press 1 bridges; no answer tries the next person, then reports failure (T-132)', async () => {
  const r = rig({ env: { TELNYX_CONNECTION_ID: 'conn-1' } });
  let n = 0; const realFetch = r.calls; // calls are recorded by the rig's fetch
  await r.ev('call.initiated'); await r.ev('call.answered');
  r.db.prepare("UPDATE voice_calls SET stage='streaming_live' WHERE call_control_id='cc-1'").run();
  // The fake API returns no call id for POST /calls, so patch the rows directly for the legs it would create.
  const v = createVoice({ db: r.db, env: { TELNYX_API_KEY: 'k', TELNYX_API_BASE_URL: 'https://api.telnyx.test/v2', TELNYX_CONNECTION_ID: 'conn-1' },
    fetchImpl: async (url, opt) => { const path = new URL(url).pathname.replace('/v2', ''); realFetch.push({ path, body: JSON.parse(opt.body || '{}') }); if (path === '/calls') { n++; return new Response(JSON.stringify({ data: { call_control_id: 'leg-' + n, call_session_id: 'ls-' + n } }), { status: 200 }); } return new Response('{"data":{}}', { status: 200 }); },
    recordInbound: () => ({}), orgForNumber: () => 'org-1', profileFor: () => ({}), log: { warn() {}, error() {}, log() {} } });
  const start = v.warmTransfer('cc-1', { targets: ['+61400000001', '+61400000002'], whisper: 'AI receptionist: Raj about a burst pipe. Press 1 to take the call, or hang up to let me take a message.' });
  assert.equal(start.ok, true); await wait(20);
  const dial1 = realFetch.filter((c) => c.path === '/calls'); assert.equal(dial1.length, 1); assert.equal(dial1[0].body.to, '+61400000001'); assert.equal(dial1[0].body.from, '+61862891786'); assert.equal(dial1[0].body.timeout_secs, 25);
  assert.equal(v.transferStatus('cc-1').status, 'ringing');
  const cs = dial1[0].body.client_state;
  // First person does not answer: the leg hangs up, the next person is dialled.
  await v.handle({ event_type: 'call.hangup', payload: { call_control_id: 'leg-1', client_state: cs, hangup_cause: 'timeout' } }); await wait(20);
  assert.equal(realFetch.filter((c) => c.path === '/calls').at(-1).body.to, '+61400000002');
  // Second answers, hears the whisper, presses 1: the caller's stream stops and the two legs are bridged.
  await v.handle({ event_type: 'call.answered', payload: { call_control_id: 'leg-2', client_state: cs } });
  const gather = realFetch.find((c) => c.path === '/calls/leg-2/actions/gather_using_speak'); assert.ok(gather); assert.match(gather.body.payload, /Raj about a burst pipe/); assert.equal(gather.body.valid_digits, '1');
  await v.handle({ event_type: 'call.gather.ended', payload: { call_control_id: 'leg-2', client_state: cs, digits: '1' } });
  assert.ok(realFetch.some((c) => c.path === '/calls/cc-1/actions/streaming_stop'));
  assert.deepEqual(realFetch.find((c) => c.path === '/calls/cc-1/actions/bridge').body.call_control_id, 'leg-2');
  assert.equal(v.transferStatus('cc-1').status, 'connected');
  assert.equal(r.db.prepare("SELECT transferred_to_human FROM voice_calls WHERE call_control_id='cc-1'").get().transferred_to_human, 1);
  // Team numbers are never in the parent call's stored status.
  assert.ok(!JSON.stringify(v.transferStatus('cc-1')).includes('+6140000000'));
});

test('warm transfer: nobody takes it (any other digit or no answer) -> failed; tenant lines and missing setup are refused', async () => {
  const r = rig();
  await r.ev('call.initiated'); await r.ev('call.answered');
  let n = 0; const seen = [];
  const v = createVoice({ db: r.db, env: { TELNYX_API_KEY: 'k', TELNYX_API_BASE_URL: 'https://api.telnyx.test/v2', TELNYX_CONNECTION_ID: 'conn-1' },
    fetchImpl: async (url, opt) => { const path = new URL(url).pathname.replace('/v2', ''); seen.push({ path, body: JSON.parse(opt.body || '{}') }); if (path === '/calls') { n++; return new Response(JSON.stringify({ data: { call_control_id: 'leg-' + n } }), { status: 200 }); } return new Response('{"data":{}}', { status: 200 }); },
    recordInbound: () => ({}), orgForNumber: () => 'org-1', profileFor: () => ({}), log: { warn() {}, error() {}, log() {} } });
  v.warmTransfer('cc-1', { targets: ['+61400000009'], whisper: 'x' }); await wait(20);
  const cs = seen.find((c) => c.path === '/calls').body.client_state;
  await v.handle({ event_type: 'call.answered', payload: { call_control_id: 'leg-1', client_state: cs } });
  await v.handle({ event_type: 'call.gather.ended', payload: { call_control_id: 'leg-1', client_state: cs, digits: '2' } });
  assert.ok(seen.some((c) => c.path === '/calls/leg-1/actions/hangup'));
  await v.handle({ event_type: 'call.hangup', payload: { call_control_id: 'leg-1', client_state: cs } }); await wait(20);
  assert.equal(v.transferStatus('cc-1').status, 'failed');
  r.db.prepare("UPDATE voice_calls SET account='tenant' WHERE call_control_id='cc-1'").run();
  assert.equal(v.warmTransfer('cc-1', { targets: ['+61400000009'] }).ok, false);
  const plain = createVoice({ db: r.db, env: { TELNYX_API_KEY: 'k' }, fetchImpl: async () => new Response('{}'), recordInbound: () => ({}), orgForNumber: () => null, profileFor: () => ({}), log: { warn() {} } });
  r.db.prepare("UPDATE voice_calls SET account='platform' WHERE call_control_id='cc-1'").run();
  assert.equal(plain.warmTransfer('cc-1', { targets: ['+61400000009'] }).ok, false, 'no connection id configured');
});
