// D-R12: each business connects its own Telnyx account; its calls use only its own key, assistant and signature key.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createReceptionistTelnyx } from '../src/comms/receptionist-telnyx.js';
import { createVoice } from '../src/comms/voice.js';

const ORG = 'org-fleet', OTHER = 'org-other', NUM = '+61862891786';
const PUB = Buffer.alloc(32, 7).toString('base64');
const KEY = 'KEY0123456789ABCDEF_tenant_secret';
const runtime = { encryptBundle: (b) => 'enc:' + Buffer.from(JSON.stringify(b)).toString('base64'), decryptBundle: (t) => JSON.parse(Buffer.from(String(t).slice(4), 'base64').toString()) };

function db() {
  const d = new Database(':memory:');
  d.exec(`CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT, display_name TEXT);
    INSERT INTO organisations VALUES ('${ORG}','Fleet Parlour',NULL),('${OTHER}','Other Co',NULL);
    CREATE TABLE comms_channels (organisation_id TEXT NOT NULL, channel TEXT NOT NULL, address TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', requested_by_user_id TEXT, activated_at TEXT, created_at TEXT NOT NULL, PRIMARY KEY(organisation_id,channel), UNIQUE(channel,address));`);
  return d;
}
function telnyxFake({ owns = true, assistantFails = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, opt) => {
    const path = url.replace('https://api.telnyx.com/v2', ''), body = opt.body ? JSON.parse(opt.body) : null;
    calls.push({ method: opt.method, path, body, auth: opt.headers.authorization });
    const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
    if (path.startsWith('/phone_numbers?')) return ok(owns ? [{ id: 'pn-1', phone_number: NUM }] : []);
    if (path === '/ai/assistants') return assistantFails ? { ok: false, status: 422, json: async () => ({ errors: [{ detail: 'model required' }] }) } : ok({ id: 'assistant-11111111-2222-3333-4444-555555555555' });
    if (path === '/call_control_applications') return ok({ id: 'app-9' });
    if (path === '/phone_numbers/pn-1') return ok({ id: 'pn-1', connection_id: body.connection_id });
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchImpl, calls };
}
const quiet = { log() {}, warn() {} };

test('connect checks ownership, creates assistant and app in the business account, assigns the number and routes it', async () => {
  const d = db(), t = telnyxFake();
  const rx = createReceptionistTelnyx({ db: d, runtime, env: { PUBLIC_BASE_URL: 'https://www.oprun.ai' }, fetchImpl: t.fetchImpl, log: quiet });
  const s = await rx.connect(ORG, { api_key: KEY, public_key: PUB, number: '08 6289 1786' }, 'user-1');
  assert.equal(s.status, 'connected'); assert.equal(s.number, NUM); assert.equal(s.problem, null);
  assert.ok(t.calls.every((c) => c.auth === 'Bearer ' + KEY), 'only the business key is used');
  const app = t.calls.find((c) => c.path === '/call_control_applications');
  assert.equal(app.body.webhook_event_url, `https://www.oprun.ai/api/webhooks/communications/telnyx-voice/${ORG}`); assert.equal(app.body.webhook_api_version, '2');
  assert.equal(t.calls.find((c) => c.path === '/phone_numbers/pn-1').body.connection_id, 'app-9');
  assert.deepEqual(d.prepare("SELECT organisation_id,status FROM comms_channels WHERE channel='voice' AND address=?").get(NUM), { organisation_id: ORG, status: 'active' });
  assert.equal(JSON.stringify(s).includes(KEY), false, 'the key never reaches the browser');
  assert.equal(rx.credentialsFor(ORG).api_key, KEY); assert.equal(rx.credentialsFor(OTHER), null);
});

test('a number that is not in the business account is refused and nothing is routed', async () => {
  const d = db(), t = telnyxFake({ owns: false });
  const rx = createReceptionistTelnyx({ db: d, runtime, fetchImpl: t.fetchImpl, log: quiet });
  await assert.rejects(rx.connect(ORG, { api_key: KEY, public_key: PUB, number: NUM }), /not in the Telnyx account/);
  assert.equal(d.prepare('SELECT COUNT(*) n FROM comms_channels').get().n, 0);
  assert.equal(rx.publicStatus(ORG).status, 'needs_attention');
});

test('a number already used by another business cannot be taken', async () => {
  const d = db(); d.prepare("INSERT INTO comms_channels VALUES (?, 'voice', ?, 'active', NULL, 'x', 'x')").run(OTHER, NUM);
  const rx = createReceptionistTelnyx({ db: d, runtime, fetchImpl: telnyxFake().fetchImpl, log: quiet });
  await assert.rejects(rx.connect(ORG, { api_key: KEY, public_key: PUB, number: NUM }), /another Oprun business/);
});

test('if the assistant cannot be created, the business is told how to finish by hand and can paste an ID', async () => {
  const d = db(), rx = createReceptionistTelnyx({ db: d, runtime, fetchImpl: telnyxFake({ assistantFails: true }).fetchImpl, log: quiet });
  const s = await rx.connect(ORG, { api_key: KEY, public_key: PUB, number: NUM });
  assert.equal(s.status, 'needs_attention'); assert.match(s.problem, /paste its ID/);
  const fixed = rx.setAssistant(ORG, 'assistant-11111111-2222-3333-4444-555555555555');
  assert.equal(fixed.status, 'connected');
});

test('bad input is refused before Telnyx is called', async () => {
  const t = telnyxFake(), rx = createReceptionistTelnyx({ db: db(), runtime, fetchImpl: t.fetchImpl, log: quiet });
  await assert.rejects(rx.connect(ORG, { api_key: 'short', public_key: PUB, number: NUM }), /API key/);
  await assert.rejects(rx.connect(ORG, { api_key: KEY, public_key: 'abc', number: NUM }), /public key/);
  await assert.rejects(rx.connect(ORG, { api_key: KEY, public_key: PUB, number: '12' }), /number/);
  assert.equal(t.calls.length, 0);
});

test('disconnect stops routing and forgets the keys', async () => {
  const d = db(), rx = createReceptionistTelnyx({ db: d, runtime, fetchImpl: telnyxFake().fetchImpl, log: quiet });
  await rx.connect(ORG, { api_key: KEY, public_key: PUB, number: NUM });
  const s = rx.disconnect(ORG);
  assert.equal(s.status, 'disconnected'); assert.equal(rx.credentialsFor(ORG), null);
  assert.equal(d.prepare("SELECT status FROM comms_channels WHERE organisation_id=? AND channel='voice'").get(ORG).status, 'disabled');
});

// ---- the call flow on a business's own account ----
function voiceSetup() {
  const d = db();
  d.prepare("INSERT INTO comms_channels VALUES (?, 'voice', ?, 'active', NULL, 'x', 'x')").run(ORG, NUM);
  const sent = [];
  const fetchImpl = async (url, opt) => { sent.push({ path: url.replace('https://api.telnyx.com/v2', ''), auth: opt.headers.authorization, body: JSON.parse(opt.body || '{}') }); return { ok: true, status: 200, json: async () => ({ data: {} }) }; };
  const creds = { [ORG]: { api_key: KEY, public_key: PUB, assistant_id: 'assistant-tenant' } };
  const voice = createVoice({ db: d, env: { TELNYX_API_KEY: 'KEY_PLATFORM', TELNYX_AI_ASSISTANT_ID: 'assistant-platform' }, fetchImpl, recordInbound: () => ({ id: 'm1' }), orgForNumber: (to) => d.prepare("SELECT organisation_id FROM comms_channels WHERE channel='voice' AND status='active' AND address=?").get(to)?.organisation_id || null, profileFor: () => ({ business_name: 'Fleet Parlour', hours: '', timezone: 'Australia/Perth' }), credentialsFor: (o) => creds[o] || null, log: quiet });
  return { d, voice, sent };
}

test('a call on the business account is answered and run with that business key and assistant only', async () => {
  const { voice, sent } = voiceSetup();
  await voice.handle({ id: 'e1', event_type: 'call.initiated', payload: { call_control_id: 'cc1', direction: 'incoming', to: NUM, from: '+61404946656' } }, { tenantOrg: ORG });
  await voice.handle({ id: 'e2', event_type: 'call.answered', payload: { call_control_id: 'cc1' } }, { tenantOrg: ORG });
  assert.ok(sent.length >= 2);
  assert.ok(sent.every((x) => x.auth === 'Bearer ' + KEY), 'never the platform key');
  assert.equal(sent.find((x) => x.path.endsWith('/ai_assistant_start')).body.assistant.id, 'assistant-tenant');
  assert.equal(voice.call('cc1').organisation_id, ORG);
});

test('a business webhook cannot route a number that belongs to another business', async () => {
  const { voice, sent } = voiceSetup();
  const r = await voice.handle({ id: 'e3', event_type: 'call.initiated', payload: { call_control_id: 'cc2', direction: 'incoming', to: NUM, from: '+61400000000' } }, { tenantOrg: OTHER });
  assert.equal(r.rejected, true);
  assert.ok(sent.every((x) => x.auth !== 'Bearer KEY_PLATFORM'));
});

test('events for a platform call are ignored when they arrive on a business webhook', async () => {
  const { voice } = voiceSetup();
  await voice.handle({ id: 'e4', event_type: 'call.initiated', payload: { call_control_id: 'cc3', direction: 'incoming', to: NUM, from: '+61400000001' } });
  const r = await voice.handle({ id: 'e5', event_type: 'call.hangup', payload: { call_control_id: 'cc3' } }, { tenantOrg: ORG });
  assert.equal(r.ignored, 'call belongs to another account');
});
