// R-04 (T-124) and R-07 (T-127): internal voice API. Service key + call token; the organisation comes only from the
// token; tokens expire and stop at call end; repeats return the first answer; the four core tools follow 04/06.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { issueCallToken, readCallToken } from '../src/comms/receptionist-internal.js';

const ENV = { VOICE_SERVICE_KEY: 'svc-key-for-tests-only', VOICE_CALL_TOKEN_SECRET: 'call-token-secret-for-tests-only' };

test('call tokens: signed, short-lived, tamper-proof', () => {
  const t = issueCallToken(ENV, { org: 'o1', call_control_id: 'c1', ttlSeconds: 99999 });
  const c = readCallToken(ENV, t); assert.equal(c.org, 'o1'); assert.ok(c.exp - Date.now() / 1000 <= 45 * 60 + 1, 'at most 45 minutes');
  assert.equal(readCallToken(ENV, t, Date.now() + 46 * 60000), null, 'expired');
  const [body, sig] = t.split('.'); const forged = Buffer.from(JSON.stringify({ ...c, org: 'o2' })).toString('base64url');
  assert.equal(readCallToken(ENV, `${forged}.${sig}`), null, 'another organisation cannot be named');
  assert.equal(readCallToken({ ...ENV, VOICE_CALL_TOKEN_SECRET: 'other' }, t), null);
  assert.equal(readCallToken(ENV, body), null);
});

test('internal voice API: auth, isolation, idempotency, and the customer, enquiry, message and end tools', async (t) => {
  const s = await startServer(ENV); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Joondalup Plumbing' });
  const other = await seedOwner(s, { business: 'Other Trades', email: 'other-voice@other.example.test' });
  const sql = (q, ...a) => { const d = new Database(s.dbPath); try { return /^\s*select/i.test(q) ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } };
  const now = new Date().toISOString();
  const call = (org, id, from) => sql("INSERT INTO voice_calls (call_control_id,organisation_id,scope,from_number,to_number,stage,started_at,updated_at) VALUES (?,?,'business',?,'+61862891786','answered',?,?)", id, org, from, now, now);
  call(owner.org, 'cc-1', '+61412345678'); call(other.org, 'cc-other', '+61499999999');
  sql("INSERT INTO receptionist_config (organisation_id,status,greeting,transfer_targets_json,updated_at) VALUES (?,'live','Thanks for calling Joondalup Plumbing',?,?)", owner.org, JSON.stringify([{ name: 'Sam', e164: '+61400555666' }]), now);
  sql("INSERT INTO receptionist_knowledge (id,organisation_id,revision,status,prompt_block,created_at) VALUES (?,?,1,'superseded','OLD',?),(?,?,2,'approved','We clear drains in Joondalup.',?),(?,?,3,'draft','DRAFT NOT APPROVED',?)", crypto.randomUUID(), owner.org, now, crypto.randomUUID(), owner.org, now, crypto.randomUUID(), owner.org, now);
  const tok = (org, id) => issueCallToken(ENV, { org, call_control_id: id });
  const T = tok(owner.org, 'cc-1');
  const api = async (method, path, { token = T, key = ENV.VOICE_SERVICE_KEY, body } = {}) => { const r = await fetch(s.base + '/api/internal/voice/' + path, { method, headers: { 'content-type': 'application/json', ...(key ? { 'x-voice-service-key': key } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json() }; };
  const tool = (name, args, turn, token = T) => api('POST', 'tools/' + name, { token, body: { args, turn_index: turn, idempotency_key: crypto.createHash('sha256').update(`cc-1${name}${turn}`).digest('hex') } });

  // Authentication.
  assert.equal((await api('GET', 'call-context', { key: 'wrong' })).status, 401);
  assert.equal((await api('GET', 'call-context', { token: null })).status, 401);
  assert.equal((await api('GET', 'call-context', { token: tok(owner.org, 'cc-other') })).status, 401, 'a token for a call of another business is refused');
  assert.equal((await api('GET', 'call-context', { token: issueCallToken({ VOICE_CALL_TOKEN_SECRET: 'x' }, { org: owner.org, call_control_id: 'cc-1' }) })).status, 401);

  // Call context: approved knowledge only, team phone numbers never included.
  let r = await api('GET', 'call-context');
  assert.equal(r.status, 200); const ctx = r.json.data;
  assert.equal(ctx.business.name, 'Joondalup Plumbing'); assert.equal(ctx.knowledge.revision, 2); assert.equal(ctx.knowledge.prompt_block, 'We clear drains in Joondalup.');
  assert.ok(!JSON.stringify(ctx).includes('+61400555666'), 'transfer numbers stay private'); assert.equal(ctx.config.transfer_targets[0].name, 'Sam');
  assert.equal(ctx.caller.known, false);

  // Enquiry before a name: precondition.
  r = await tool('create_enquiry_lead', { service: 'Blocked drain', details: 'Kitchen sink', urgency: 'normal' }, 1);
  assert.equal(r.status, 409); assert.equal(r.json.code, 'ERR_PRECONDITION');
  // Validation names the missing field; an organisation in args is rejected as unknown.
  r = await tool('create_or_update_customer', { email: 'x@y.z' }, 2); assert.equal(r.json.code, 'ERR_VALIDATION'); assert.deepEqual(r.json.data.missing, ['name']);
  r = await tool('create_or_update_customer', { name: 'Raj Patel', organisation_id: other.org }, 3); assert.equal(r.json.code, 'ERR_VALIDATION');

  // New caller: customer lead, consent stored, linked to the call.
  r = await tool('create_or_update_customer', { name: 'Raj Patel', email: 'Raj@Example.test', notes: 'Kitchen sink blocked', sms_consent: true }, 4);
  assert.equal(r.status, 200, JSON.stringify(r.json)); assert.equal(r.json.data.known_customer, false);
  const cust = sql("SELECT * FROM tenant_customers WHERE organisation_id=? AND name='Raj Patel'", owner.org)[0];
  assert.equal(cust.status, 'lead'); assert.equal(cust.source, 'receptionist'); assert.equal(cust.phone, '+61412345678'); assert.equal(cust.email, 'raj@example.test'); assert.match(cust.notes, /AI call\] Kitchen sink blocked/);
  assert.equal(sql("SELECT customer_id FROM voice_calls WHERE call_control_id='cc-1'")[0].customer_id, cust.id);
  assert.equal(sql("SELECT COUNT(*) n FROM marketing_consents WHERE owner_key=? AND channel='sms' AND status='granted'", owner.org)[0].n, 1);
  // The same turn again returns the first answer and writes nothing new.
  const again = await tool('create_or_update_customer', { name: 'Someone Else' }, 4);
  assert.deepEqual(again.json, r.json); assert.equal(sql("SELECT COUNT(*) n FROM tenant_customers WHERE organisation_id=?", owner.org)[0].n, 1);

  // Enquiry: one per call; a second call within the call appends.
  r = await tool('create_enquiry_lead', { service: 'Blocked drain', details: 'Kitchen sink, water not draining', urgency: 'soon', suburb: 'Joondalup', preferred_times: 'weekday mornings' }, 5);
  assert.equal(r.status, 200, JSON.stringify(r.json)); assert.equal(r.json.data.reused_existing, false);
  r = await tool('create_enquiry_lead', { service: 'Blocked drain', details: 'Also the laundry', urgency: 'soon' }, 6);
  assert.equal(r.json.data.reused_existing, true);
  const enq = sql("SELECT * FROM tenant_documents WHERE organisation_id=? AND kind='enquiry'", owner.org);
  assert.equal(enq.length, 1); assert.equal(enq[0].title, 'Blocked drain – Joondalup'); assert.equal(enq[0].channel, 'receptionist'); assert.equal(enq[0].created_by, 'ai_receptionist'); assert.match(enq[0].body, /Also the laundry/);
  assert.equal(sql("SELECT state FROM receptionist_followups WHERE enquiry_id=?", enq[0].id)[0].state, 'QUALIFYING');

  // Message and end.
  r = await tool('take_message', { message: 'Please call before 3', callback_window: 'before 3 today' }, 7); assert.equal(r.status, 200);
  assert.equal(sql("SELECT outcome FROM voice_calls WHERE call_control_id='cc-1'")[0].outcome, 'message_taken');
  assert.equal(sql("SELECT COUNT(*) n FROM user_notifications WHERE organisation_id=? AND kind='receptionist_message'", owner.org)[0].n, 1);
  r = await tool('end_call', { reason: 'completed' }, 8); assert.equal(r.status, 200);
  r = await tool('warm_transfer', {}, 9); assert.equal(r.json.code, 'ERR_NOT_ALLOWED', 'later tools say no honestly');

  // A returning caller from the same number is recognised by name only; staff notes stay private.
  sql("UPDATE tenant_customers SET caller_note='Prefers mornings' WHERE id=?", cust.id);
  call(owner.org, 'cc-2', '0412 345 678');
  const ctx2 = (await api('GET', 'call-context', { token: tok(owner.org, 'cc-2') })).json.data.caller;
  assert.deepEqual(ctx2, { withheld: false, known: true, first_name: 'Raj', caller_note: 'Prefers mornings' });

  // Events and call end; afterwards the token stops working for tools.
  assert.equal((await api('POST', 'events', { body: { latency_p50_ms: 640, latency_p95_ms: 980, barge_in_count: 2 } })).status, 200);
  sql("UPDATE voice_calls SET ended_at=? WHERE call_control_id='cc-1'", new Date().toISOString());
  r = await api('POST', 'call-ended', { body: { idempotency_key: 'end-cc-1', transcript: [{ speaker: 'caller', text: 'Hi' }, { speaker: 'agent', text: 'Hello' }] } });
  assert.equal(r.status, 200);
  const vc = sql("SELECT * FROM voice_calls WHERE call_control_id='cc-1'")[0];
  assert.equal(vc.latency_p50_ms, 640); assert.match(vc.transcript, /Caller: Hi\nReceptionist: Hello/); assert.equal(vc.outcome, 'message_taken');
  assert.equal((await tool('take_message', { message: 'late' }, 99)).status, 401, 'tools stop at call end');
  // R-08: the call is filed once in the Unibox on the caller's voice thread, linked to the customer and enquiry.
  let filed; for (let i = 0; i < 40 && !(filed = sql("SELECT thread_id,summary_json FROM voice_calls WHERE call_control_id='cc-1'")[0]).thread_id; i++) await new Promise((res) => setTimeout(res, 100));
  assert.ok(filed.thread_id, 'thread recorded'); assert.equal(JSON.parse(filed.summary_json).filed, true); assert.equal(JSON.parse(filed.summary_json).message.text, 'Please call before 3');
  const logs = sql("SELECT m.kind,m.body,t.channel,t.contact_address FROM comms_messages m JOIN comms_threads t ON t.id=m.thread_id WHERE m.organisation_id=? AND m.kind='call_log'", owner.org);
  assert.equal(logs.length, 1); assert.equal(logs[0].channel, 'voice'); assert.equal(logs[0].contact_address, '+61412345678'); assert.match(logs[0].body, /Message: Please call before 3/);
  const meta = sql('SELECT customer_id,enquiry_id FROM comms_thread_meta WHERE thread_id=?', filed.thread_id)[0];
  assert.equal(meta.customer_id, cust.id); assert.equal(meta.enquiry_id, enq[0].id);
  assert.equal(sql("SELECT thread_id FROM receptionist_followups WHERE enquiry_id=?", enq[0].id)[0].thread_id, filed.thread_id);
  assert.equal(sql("SELECT COUNT(*) n FROM user_notifications WHERE organisation_id=? AND kind='receptionist_call'", owner.org)[0].n, 1);
  // Reporting the end again changes nothing.
  assert.equal((await api('POST', 'call-ended', { body: { idempotency_key: 'end-cc-1b' } })).status, 200); await new Promise((res) => setTimeout(res, 300));
  assert.equal(sql("SELECT COUNT(*) n FROM comms_messages WHERE organisation_id=? AND kind='call_log'", owner.org)[0].n, 1);
  // Nothing reached the other business.
  assert.equal(sql('SELECT COUNT(*) n FROM tenant_customers WHERE organisation_id=?', other.org)[0].n, 0);
});

test('without the service settings the internal API is switched off', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const r = await fetch(s.base + '/api/internal/voice/call-context');
  assert.equal(r.status, 503);
});

test('spam and metering: block list, short and silent calls are free, one usage row per billable call, cap alerts at 80 and 100 per cent (T-129)', async (t) => {
  const s = await startServer({ ...ENV, RECEPTIONIST_CALL_PRICE_CENTS: '100' }); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Cap Plumbing' });
  const sql = (q, ...a) => { const d = new Database(s.dbPath); try { return /^\s*select/i.test(q) ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } };
  const iso = (ms = 0) => new Date(Date.now() + ms).toISOString();
  sql("INSERT INTO receptionist_config (organisation_id,status,spend_cap_cents,cap_action,updated_at) VALUES (?,'live',500,'voicemail',?)", owner.org, iso());
  const end = async (id, from, secs, transcript) => {
    sql("INSERT INTO voice_calls (call_control_id,call_session_id,organisation_id,scope,from_number,to_number,stage,started_at,answered_at,duration_seconds,transcript,updated_at) VALUES (?,?,?,'business',?,'+61862891786','answered',?,?,?,?,?)", id, 's-' + id, owner.org, from, iso(-60000), iso(-60000), secs, transcript, iso());
    const token = issueCallToken(ENV, { org: owner.org, call_control_id: id });
    sql('UPDATE voice_calls SET ended_at=? WHERE call_control_id=?', iso(), id);
    const r = await fetch(s.base + '/api/internal/voice/call-ended', { method: 'POST', headers: { 'content-type': 'application/json', 'x-voice-service-key': ENV.VOICE_SERVICE_KEY, authorization: 'Bearer ' + token }, body: JSON.stringify({ idempotency_key: 'end-' + id }) });
    assert.equal(r.status, 200);
    for (let i = 0; i < 40; i++) { const row = sql('SELECT billable FROM voice_calls WHERE call_control_id=?', id)[0]; if (row.billable !== null) return row; await new Promise((res) => setTimeout(res, 75)); }
    throw new Error('call not finished');
  };
  const talk = 'Caller: Hi, I need a plumber for a leaking tap please\nReceptionist: Sure, I can help.';
  // A blocked number: spam, free, filed in the spam folder, no owner alert.
  sql("INSERT INTO receptionist_blocklist (id,organisation_id,e164,created_at) VALUES (?,?,?,?)", crypto.randomUUID(), owner.org, '+61411000111', iso());
  await end('c-spam', '+61411000111', 40, talk);
  let v = sql("SELECT outcome,billable,spam_score,thread_id FROM voice_calls WHERE call_control_id='c-spam'")[0];
  assert.equal(v.outcome, 'spam'); assert.equal(v.billable, 0); assert.ok(v.spam_score >= 70);
  for (let i = 0; i < 20 && !(v = sql("SELECT thread_id FROM voice_calls WHERE call_control_id='c-spam'")[0]).thread_id; i++) await new Promise((res) => setTimeout(res, 75));
  assert.equal(sql('SELECT folder FROM comms_thread_meta WHERE thread_id=?', v.thread_id)[0]?.folder, 'spam');
  assert.equal(sql("SELECT COUNT(*) n FROM user_notifications WHERE organisation_id=? AND kind='receptionist_call'", owner.org)[0].n, 0, 'no alert for spam');
  // Short call: free. Long real call: billable, counted once even if reported twice.
  assert.equal((await end('c-short', '+61422000222', 9, talk)).billable, 0);
  assert.equal((await end('c-real-1', '+61433000333', 75, talk)).billable, 1);
  assert.equal(sql("SELECT COUNT(*) n FROM usage_events WHERE organisation_id=? AND kind='receptionist_call'", owner.org)[0].n, 1);
  // Four more billable calls: 5 x A$1 = the A$5 cap. 80% alert at the 4th, 100% at the 5th; calls keep being answered.
  for (const n of [2, 3, 4, 5]) await end(`c-real-${n}`, `+6144400044${n}`, 60, talk);
  const alerts = sql("SELECT title,urgent FROM user_notifications WHERE organisation_id=? AND kind='receptionist_cap' ORDER BY created_at", owner.org);
  assert.ok(alerts.some((a) => /80%/.test(a.title))); assert.ok(alerts.some((a) => /cap reached/.test(a.title) && a.urgent === 1));
  const ctx = await fetch(s.base + '/api/internal/voice/call-context', { headers: { 'x-voice-service-key': ENV.VOICE_SERVICE_KEY, authorization: 'Bearer ' + issueCallToken(ENV, { org: owner.org, call_control_id: 'c-new' }) } });
  assert.equal(ctx.status, 401, 'unknown call');
  sql("INSERT INTO voice_calls (call_control_id,organisation_id,scope,from_number,stage,started_at,updated_at) VALUES ('c-new',?,'business','+61411000111','answered',?,?)", owner.org, iso(), iso());
  const data = (await (await fetch(s.base + '/api/internal/voice/call-context', { headers: { 'x-voice-service-key': ENV.VOICE_SERVICE_KEY, authorization: 'Bearer ' + issueCallToken(ENV, { org: owner.org, call_control_id: 'c-new' }) } })).json()).data;
  assert.equal(data.usage.cap_reached, true); assert.equal(data.usage.cap_action, 'voicemail'); assert.equal(data.usage.billable_calls_this_month, 5);
  assert.equal(data.spam.close_politely, true, 'a blocked caller is closed politely at answer');
});
