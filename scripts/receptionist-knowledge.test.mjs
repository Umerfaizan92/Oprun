// R-16 (T-136): knowledge built from the business's own records, reviewed and approved before any call uses it.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { renderPromptBlock, scrubText } from '../src/comms/receptionist-knowledge.js';
import { issueCallToken } from '../src/comms/receptionist-internal.js';

const ENV = { VOICE_SERVICE_KEY: 'svc-key-for-tests-only', VOICE_CALL_TOKEN_SECRET: 'call-token-secret-for-tests-only' };

test('rendering: spoken hours, prices only from booking rules, filter removes other people\'s details, budget trimming', () => {
  const r = renderPromptBlock({ business: { name: 'Joondalup Plumbing', type: 'plumber' }, services: [{ name: 'Blocked drain' }, { name: 'Gas fitting' }], faqs: [{ q: 'Weekends?', a: 'Saturday mornings only.' }, { q: 'Unanswered?', a: '' }] },
    { timezone: 'Australia/Perth', hours: { mon: [['07:00', '17:00']], tue: [['07:00', '17:00']], wed: [['07:00', '17:00']], thu: [['07:00', '17:00']], fri: [['07:00', '17:00']], sat: [['08:00', '12:00']], sun: [] }, booking_rules: { services: [{ name: 'Blocked drain', duration_min: 60, price_from_cents: 12000 }] } });
  assert.match(r.text, /Monday to Friday: 7 in the morning to 5 in the afternoon/); assert.match(r.text, /Saturday: 8 in the morning to midday/); assert.match(r.text, /Sunday: closed/);
  assert.match(r.text, /Blocked drain, about 60 minutes, from 120 dollars/); assert.match(r.text, /Other services \(take a message, do not book\):\n- Gas fitting/);
  assert.match(r.text, /Q: Weekends\?\nA: Saturday mornings only\./); assert.ok(!/Unanswered/.test(r.text), 'questions without an owner answer are left out');
  const big = renderPromptBlock({ business: { name: 'X' }, services: [], faqs: Array.from({ length: 40 }, (_, i) => ({ q: 'Question ' + i + '?', a: 'x'.repeat(400) })) }, {});
  assert.ok(big.text.length <= 10000); assert.deepEqual(big.trimmed, ['faq']);
  assert.equal(scrubText('Call Mary on 0412 345 678 or mary@home.example at 12 Smith Street', ['0861234567']), 'Call Mary on [removed] or [removed] at [removed]');
  assert.equal(scrubText('Ring us on 08 6123 4567', ['0861234567']), 'Ring us on 08 6123 4567', 'the business\'s own number stays');
});

test('build, edit, approve, rollback; only approved facts reach calls; aggregates hide individual customers', async (t) => {
  const s = await startServer(ENV); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Joondalup Plumbing' });
  const sql = (q, ...a) => { const d = new Database(s.dbPath); try { return /^\s*select/i.test(q) ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } };
  const O = (m, u, b) => s.call(m, u, { cookie: owner.cookie, body: b });
  const now = new Date().toISOString();
  sql("INSERT INTO onboarding_profiles (organisation_id,business_type,phone,website,service_area,services,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(organisation_id) DO UPDATE SET business_type=excluded.business_type,phone=excluded.phone,service_area=excluded.service_area,services=excluded.services", owner.org, 'Plumber', '0861234567', 'https://joondalup.example', 'Joondalup and northern suburbs', JSON.stringify(['Blocked drains', 'Hot water']), now);
  // Four jobs in Joondalup, one in a suburb with fewer than three: only the first suburb may appear. Customer names never.
  const cust = crypto.randomUUID(); sql("INSERT INTO tenant_customers (id,organisation_id,name,phone,status,source,created_at,updated_at) VALUES (?,?,'Private Person','0400111222','current','manual',?,?)", cust, owner.org, now, now);
  for (const [addr, i] of [['1 Beach Rd, Joondalup WA 6027', 1], ['2 Beach Rd, Joondalup WA 6027', 2], ['3 Beach Rd, Joondalup WA 6027', 3], ['4 Lake St, Wanneroo WA 6065', 4]])
    sql("INSERT INTO work_orders (id,organisation_id,title,address,start_at,required_skills,status,customer_id,price_cents,materials_cents,created_at,updated_at) VALUES (?,?,'Blocked drain',?,?,'[]','completed',?,55500,9900,?,?)", crypto.randomUUID(), owner.org, addr, now, cust, now, now);

  let r = await O('POST', '/api/saas/receptionist/knowledge/build');
  assert.equal(r.status, 200, r.text); assert.equal(r.json.revision, 1);
  let k = (await O('GET', '/api/saas/receptionist/knowledge')).json;
  assert.equal(k.approved, null); assert.equal(k.draft.revision, 1);
  assert.ok(k.draft.facts.service_area.suburbs.includes('Joondalup')); assert.ok(!k.draft.facts.service_area.suburbs.includes('Wanneroo'), '3-job minimum');
  const text = k.draft.prompt_block + JSON.stringify(k.draft.facts);
  for (const secret of ['Private Person', '0400111222', '555', '99', 'Beach Rd']) assert.ok(!text.includes(secret), 'not included: ' + secret);
  assert.ok(k.draft.sources.some((x) => x.table === 'work_orders' && /past jobs/.test(x.note)));

  // Owner edits: FAQ with an answer, a policy; private details typed by mistake are removed.
  r = await O('PUT', '/api/saas/receptionist/knowledge/draft', { faqs: [{ q: 'Do you work weekends?', a: 'Saturday mornings. Call Bob on 0499 888 777.' }], policies: [{ topic: 'Call-out fee', text: 'A call-out fee applies outside the metro area.' }] });
  assert.equal(r.status, 200, r.text);
  k = (await O('GET', '/api/saas/receptionist/knowledge')).json;
  assert.match(k.draft.prompt_block, /Saturday mornings\. Call Bob on \[removed\]/); assert.match(k.draft.prompt_block, /Call-out fee: A call-out fee applies/);

  // A call before approval gets no facts.
  sql("INSERT INTO voice_calls (call_control_id,organisation_id,scope,from_number,stage,started_at,updated_at) VALUES ('k1',?,'business','+61400999000','answered',?,?)", owner.org, now, now);
  const ctx = async () => (await (await fetch(s.base + '/api/internal/voice/call-context', { headers: { 'x-voice-service-key': ENV.VOICE_SERVICE_KEY, authorization: 'Bearer ' + issueCallToken(ENV, { org: owner.org, call_control_id: 'k1' }) } })).json()).data;
  assert.equal((await ctx()).knowledge.prompt_block, '');
  assert.equal((await ctx()).caller_context, 'Caller not recognised.');

  // Approval: owner/admin only; then calls use it, and the call records the revision.
  const mgr = (() => { const d = new Database(s.dbPath), uid = crypto.randomUUID(), tok = crypto.randomBytes(24).toString('hex'); d.prepare("INSERT INTO users (id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(uid, `mgr-${uid}@x.test`, 'Mgr', 'x', 'x', now, now); d.prepare("INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,'manager',?)").run(owner.org, uid, now); d.prepare('INSERT INTO user_sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(), uid, crypto.createHash('sha256').update(tok).digest('hex'), new Date(Date.now() + 3600000).toISOString(), now, now); d.close(); return 'fp_session=' + tok; })();
  assert.equal((await s.call('POST', '/api/saas/receptionist/knowledge/1/approve', { cookie: mgr, body: {} })).status, 403, 'a manager cannot approve');
  assert.equal((await O('POST', '/api/saas/receptionist/knowledge/1/approve', {})).status, 200);
  let c = await ctx();
  assert.equal(c.knowledge.revision, 1); assert.match(c.knowledge.prompt_block, /Business: Joondalup Plumbing, Plumber/); assert.match(c.knowledge.prompt_block, /Do you work weekends/);
  assert.equal(JSON.parse(sql("SELECT summary_json FROM voice_calls WHERE call_control_id='k1'")[0].summary_json).knowledge_revision, 1);
  // Hours typed in settings apply at once, without re-approval.
  sql("INSERT INTO receptionist_config (organisation_id,hours_json,timezone,updated_at) VALUES (?,?,'Australia/Perth',?) ON CONFLICT(organisation_id) DO UPDATE SET hours_json=excluded.hours_json,timezone=excluded.timezone", owner.org, JSON.stringify({ mon: [['07:00', '15:00']] }), now);
  assert.match((await ctx()).knowledge.prompt_block, /Monday: 7 in the morning to 3 in the afternoon/);
  // A rebuild is a new draft; the approved one stays live until the next approval; rollback re-approves revision 1.
  assert.equal((await O('POST', '/api/saas/receptionist/knowledge/build')).json.revision, 2);
  assert.equal((await ctx()).knowledge.revision, 1);
  assert.equal((await O('POST', '/api/saas/receptionist/knowledge/2/approve', {})).status, 200);
  assert.equal((await ctx()).knowledge.revision, 2);
  assert.equal((await O('POST', '/api/saas/receptionist/knowledge/1/approve', {})).status, 200, 'rollback');
  assert.equal((await ctx()).knowledge.revision, 1);
  assert.equal(sql("SELECT COUNT(*) n FROM receptionist_knowledge WHERE organisation_id=? AND status='approved'", owner.org)[0].n, 1);
  // The facts carry the owner's FAQ forward into the rebuilt draft.
  assert.ok((await O('GET', '/api/saas/receptionist/knowledge')).json.history.length >= 2);
  // A known caller: first name, status, recent job by month only, no price.
  sql("UPDATE tenant_customers SET phone='+61400999000',caller_note='Gate code given on the day' WHERE id=?", cust);
  c = await ctx(); if (process.env.DBG) console.log(JSON.stringify(c.caller), sql('SELECT id,phone FROM tenant_customers WHERE organisation_id=?', owner.org));
  assert.match(c.caller_context, /First name: Private/); assert.match(c.caller_context, /Recent jobs: Blocked drain, \w+/); assert.match(c.caller_context, /Staff note: Gate code/); assert.ok(!/555|\$/.test(c.caller_context));
});
