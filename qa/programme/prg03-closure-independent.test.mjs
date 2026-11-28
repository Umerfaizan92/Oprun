// PRG-03 closure: strict independent replacements for H1–H3 (Claude). Candidate e247fef (published 40fbc4e).
// Mandatory: no todo, no skip. Run with NODE_ENV and OPRUN_TEST_STRIPE_COMPAT UNSET in the parent:
//   env -u NODE_ENV -u OPRUN_TEST_STRIPE_COMPAT node --test --test-concurrency=1 qa/programme/prg03-closure-independent.test.mjs
// The H1 test sets the process environment itself before each install to probe every combination.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import Database from 'better-sqlite3';
import { createDb } from '../../src/db.js';
import { installPayments } from '../../src/payments.js';
import { createFinance } from '../../src/finance/service.js';

const PI = 'pi_closure';
function stand(mode = {}) {
  const posts = [], gets = [], refunds = [];
  const f = async (url, options = {}) => {
    const u = new URL(url), j = (code, v) => ({ ok: code < 300, status: code, json: async () => v });
    const method = options.method || 'GET';
    if (method === 'GET') gets.push(u.pathname);
    if (u.pathname === '/v1/account') return mode.account ? mode.account() : j(200, { object: 'account', id: 'acct_closure' });
    if (u.pathname === '/v1/balance') return mode.balance ? mode.balance() : j(200, { object: 'balance', livemode: false });
    if (u.pathname.startsWith('/v1/payment_intents/')) return j(200, { object: 'payment_intent', id: PI, currency: 'aud', livemode: false });
    if (method === 'GET' && u.pathname === '/v1/refunds') { if (mode.list) return mode.list(); return j(200, { object: 'list', has_more: false, data: refunds }); }
    if (method === 'POST' && u.pathname === '/v1/refunds') {
      const p = new URLSearchParams(options.body), m = { id: 're_' + crypto.randomUUID().slice(0, 8), object: 'refund', amount: Number(p.get('amount')), currency: 'aud', payment_intent: PI, livemode: false, status: mode.status || 'succeeded', metadata: { organisation_id: p.get('metadata[organisation_id]'), payment_id: p.get('metadata[payment_id]'), refund_request_id: p.get('metadata[refund_request_id]') } };
      posts.push(m); refunds.unshift(m); return j(200, m);
    }
    return j(404, { error: { type: 'invalid_request_error', code: 'resource_missing' } });
  };
  return { f, posts, gets, refunds };
}
function world({ fetchImpl, appEnv = {}, processEnv = {} }) {
  const saved = { NODE_ENV: process.env.NODE_ENV, OPRUN_TEST_STRIPE_COMPAT: process.env.OPRUN_TEST_STRIPE_COMPAT };
  for (const [k, v] of Object.entries(processEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  const db = createDb(':memory:'), routes = new Map(), now = new Date().toISOString();
  db.exec('ALTER TABLE job_payments ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE TABLE tenant_documents(id TEXT PRIMARY KEY,organisation_id TEXT)');
  const org = crypto.randomUUID(), job = crypto.randomUUID(), payment = crypto.randomUUID(), whsec = 'whsec-closure';
  db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(org, 'C', org, now, now);
  db.prepare("INSERT INTO users(id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES ('owner','o@x.test','O','x','x',?,?)").run(now, now);
  db.prepare("INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES (?,'owner','owner',?)").run(org, now);
  db.prepare('INSERT INTO payment_settings(organisation_id,stripe_secret_enc,stripe_webhook_enc,updated_at) VALUES (?,?,?,?)').run(org, 'key-closure', whsec, now);
  db.prepare('INSERT INTO work_orders(id,organisation_id,title,start_at,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,10000,10000,?,?)').run(job, org, 'J', now, now, now);
  db.prepare("INSERT INTO job_payments(id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',10000,'aud',?,?,?)").run(payment, org, job, PI, now, now);
  const app = Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map((m) => [m, (p, ...h) => routes.set(m + ' ' + p, h.at(-1))]));
  const payments = installPayments(app, { db, env: appEnv, runtime: { decryptBundle: (v) => ({ v }) }, requireSaasUser() {}, requireSaasRole: () => () => {}, saasAudit() {}, financeRoles: ['owner'], syncJobFinance() {}, ...(fetchImpl ? { fetchImpl } : {}) });
  const finance = createFinance({ db, payments, engineRef: { current: { startRun: () => ({ id: crypto.randomUUID(), promise: Promise.resolve() }) } } });
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  const hook = (type, object, { id = 'evt_' + crypto.randomUUID(), created, livemode = false } = {}) => new Promise((resolve) => {
    const event = { id, type, created, livemode, data: { object } }, raw = JSON.stringify(event), ts = Math.floor(Date.now() / 1000);
    const res = { statusCode: 200, headersSent: false, status(c) { this.statusCode = c; return this; }, json(v) { this.value = v; resolve(this); return this; } };
    routes.get('post /api/webhooks/payments/stripe/:orgId')({ params: { orgId: org }, body: event, rawBody: raw, get: () => `t=${ts},v1=${crypto.createHmac('sha256', whsec).update(`${ts}.${raw}`).digest('hex')}` }, res, (e) => resolve({ statusCode: 'next', error: e }));
  });
  const request = (a) => finance.requestRefund(org, payment, 'req', { amount_cents: a, reason: 's' });
  const totals = () => [db.prepare('SELECT refunded_cents n FROM job_payments').get().n, db.prepare('SELECT paid_cents n FROM work_orders').get().n];
  return { db, org, payment, payments, finance, hook, request, totals, refundRow: (id) => db.prepare('SELECT * FROM fin_refunds WHERE id=?').get(id) };
}

// ================= H1 =================
test('H1: fingerprint compatibility only with process NODE_ENV=test, OPRUN_TEST_STRIPE_COMPAT=1 and a test-compatible app env; otherwise no identity and no POST', async () => {
  const restricted = { account: () => ({ ok: false, status: 403, json: async () => ({ error: { type: 'invalid_request_error', code: 'permission_denied' } }) }) };
  const combos = [];
  for (const NODE_ENV of ['production', 'test', undefined]) for (const COMPAT of [undefined, '1', '0', 'true']) for (const appNode of [undefined, 'production', 'test']) combos.push({ NODE_ENV, COMPAT, appNode });
  for (const c of combos) {
    const s = stand(restricted), wrapper = (...a) => s.f(...a);
    const w = world({ fetchImpl: wrapper, appEnv: c.appNode ? { NODE_ENV: c.appNode } : {}, processEnv: { NODE_ENV: c.NODE_ENV, OPRUN_TEST_STRIPE_COMPAT: c.COMPAT } });
    try {
      const expectCompat = c.NODE_ENV === 'test' && c.COMPAT === '1' && (c.appNode === undefined || c.appNode === 'test');
      const identity = await w.payments.refundAccount(w.org);
      const label = JSON.stringify(c);
      if (expectCompat) assert.ok(identity && !identity.binding.startsWith('stripe:acct_'), label + ': synthetic compatibility active only here');
      else {
        assert.equal(identity, null, label + ': no identity, no fallback');
        const id = w.request(1000).refund_id;
        await assert.rejects(w.finance.executeRefund(w.org, { refund_id: id }, 'owner'), /not available/, label);
        await assert.rejects(w.payments.refundStripe(w.org, w.db.prepare('SELECT * FROM job_payments').get(), 1000, 'k', id, undefined), /configuration changed/, label + ': direct submission without binding refused');
        assert.equal(s.posts.length, 0, label + ': zero financial POSTs');
      }
    } finally { w.db.close(); }
  }
});

test('H1: malformed, invalid or unavailable identity responses in production give no identity and zero POSTs', async () => {
  const j = (code, v) => () => ({ ok: code < 300, status: code, json: async () => v });
  const cases = {
    'account wrong object': { account: j(200, { object: 'customer', id: 'acct_x' }) }, 'account id malformed': { account: j(200, { object: 'account', id: 'cus_1' }) },
    'account empty': { account: j(200, {}) }, 'account 401': { account: j(401, { error: { type: 'invalid_request_error' } }) },
    'account 500': { account: j(500, { error: { type: 'api_error' } }) }, 'account throws': { account: () => { throw new Error('reset'); } },
    'balance no livemode': { balance: j(200, { object: 'balance' }) }, 'balance livemode string': { balance: j(200, { object: 'balance', livemode: 'false' }) },
    'balance 403': { balance: j(403, { error: { type: 'invalid_request_error' } }) },
  };
  for (const [label, mode] of Object.entries(cases)) {
    const s = stand(mode);
    const w = world({ fetchImpl: (...a) => s.f(...a), processEnv: { NODE_ENV: 'production', OPRUN_TEST_STRIPE_COMPAT: '1' } });
    try {
      assert.equal(await w.payments.refundAccount(w.org), null, label);
      const id = w.request(1000).refund_id;
      await assert.rejects(w.finance.executeRefund(w.org, { refund_id: id }, 'owner'), label);
      assert.equal(s.posts.length, 0, label);
    } finally { w.db.close(); }
  }
});

// ================= H2 =================
async function pendingRefund(w, s, amount = 4000) {
  const id = w.request(amount).refund_id;
  await w.finance.executeRefund(w.org, { refund_id: id }, 'owner');
  return { id, made: s.posts.at(-1) };
}
test('H2: distinct same-second events are settled from current provider evidence, recorded, and never double-counted', async () => {
  const s = stand({ status: 'pending' });
  const w = world({ fetchImpl: s.f, processEnv: { NODE_ENV: 'production' } });
  try {
    const { id, made } = await pendingRefund(w, s);
    const t0 = Math.floor(Date.now() / 1000) + 5;
    assert.equal((await w.hook('refund.updated', { ...made, status: 'requires_action', next_action: { type: 'display_details' } }, { id: 'evt_a', created: t0 })).statusCode, 200);
    s.refunds[0].status = 'succeeded'; // the provider's current state
    const b = await w.hook('refund.updated', { ...made, status: 'succeeded' }, { id: 'evt_b', created: t0 });
    assert.equal(b.statusCode, 200, JSON.stringify(b.value));
    assert.equal(w.refundRow(id).status, 'completed', 'settled from the authoritative list');
    assert.deepEqual(w.totals(), [4000, 6000]);
    const rec = w.db.prepare("SELECT reason,resolved_at FROM fin_stripe_refund_discrepancies WHERE event_id='evt_b'").get();
    assert.deepEqual([rec.reason, Boolean(rec.resolved_at)], ['event_order_verified', true], 'signed evidence archived as verified');
    assert.equal((await w.hook('refund.updated', { ...made, status: 'succeeded' }, { id: 'evt_b', created: t0 })).value.duplicate, true);
    await w.hook('refund.updated', { ...made, status: 'requires_action', next_action: { type: 'display_details' } }, { created: t0 - 3 }); // delayed
    await w.hook('charge.refunded', { object: 'charge', payment_intent: PI, amount_refunded: 4000, currency: 'aud' });
    assert.equal(w.refundRow(id).status, 'completed');
    assert.deepEqual(w.totals(), [4000, 6000], 'no stale restoration or duplicate effect');
  } finally { w.db.close(); }
});

test('H2: with current evidence unavailable, the conflict is durable and owner-visible, then resolved once by the owner', async () => {
  let listDown = true;
  const s = stand({ status: 'pending', list: () => { if (listDown) throw new Error('list outage'); return { ok: true, status: 200, json: async () => ({ object: 'list', has_more: false, data: s.refunds }) }; } });
  const w = world({ fetchImpl: s.f, processEnv: { NODE_ENV: 'production' } });
  try {
    const { id, made } = await pendingRefund(w, s);
    const t0 = Math.floor(Date.now() / 1000) + 5;
    await w.hook('refund.updated', { ...made, status: 'requires_action', next_action: { type: 'display_details' } }, { id: 'evt_c', created: t0 });
    const d = await w.hook('refund.updated', { ...made, status: 'succeeded' }, { id: 'evt_d', created: t0 });
    assert.deepEqual([d.statusCode, d.value.outcome], [200, 'refund_reconciliation_required']);
    assert.equal(w.refundRow(id).status, 'submitted', 'no invented chronology');
    assert.deepEqual(w.totals(), [0, 10000]);
    const open = w.db.prepare("SELECT reason,resolved_at FROM fin_stripe_refund_discrepancies WHERE event_id='evt_d'").get();
    assert.deepEqual([open.reason, open.resolved_at], ['event_order_conflict', null]);
    assert.ok(w.db.prepare("SELECT 1 FROM payment_notices WHERE kind='payment_review' AND body LIKE '%current provider check%'").get(), 'owner notice');
    assert.equal(w.request(100).status, 409, 'refunds held while unresolved');
    assert.equal((await w.finance.resolveStripeDiscrepancy(w.org, 'evt_d', 'owner')).status, 409, 'still unavailable');
    listDown = false; s.refunds[0].status = 'succeeded';
    assert.deepEqual(await w.finance.resolveStripeDiscrepancy(w.org, 'evt_d', 'owner'), { ok: true, status: 'resolved' });
    assert.deepEqual(w.totals(), [4000, 6000]);
    assert.deepEqual(await w.finance.resolveStripeDiscrepancy(w.org, 'evt_d', 'owner'), { ok: true, status: 'resolved' });
    assert.deepEqual(w.totals(), [4000, 6000], 'resolving twice changes nothing');
  } finally { w.db.close(); }
});

test('H2: evidence superseded by a concurrent event during the provider check is not applied over it', async () => {
  let w, made, during = null;
  const s = stand({ status: 'pending', list: () => {
    // While Oprun checks, a newer signed event lands first.
    during = w.hook('refund.updated', { ...made, status: 'failed', failure_reason: 'declined' }, { id: 'evt_newer', created: Math.floor(Date.now() / 1000) + 30 });
    return { ok: true, status: 200, json: async () => { await during; return { object: 'list', has_more: false, data: [{ ...made, status: 'succeeded' }] }; } };
  } });
  w = world({ fetchImpl: s.f, processEnv: { NODE_ENV: 'production' } });
  try {
    const r = await pendingRefund(w, s); made = r.made;
    const t0 = Math.floor(Date.now() / 1000) + 5;
    await w.hook('refund.updated', { ...made, status: 'requires_action', next_action: { type: 'display_details' } }, { id: 'evt_e', created: t0 });
    const res = await w.hook('refund.updated', { ...made, status: 'succeeded' }, { id: 'evt_f', created: t0 });
    await during;
    assert.equal(res.statusCode, 200);
    assert.equal(w.refundRow(r.id).status, 'failed', 'the newer committed decision stands');
    assert.deepEqual(w.totals(), [0, 10000], 'the superseded success was not applied over it');
    const rec = w.db.prepare("SELECT reason,resolved_at FROM fin_stripe_refund_discrepancies WHERE event_id='evt_f'").get();
    assert.deepEqual([rec?.reason, rec?.resolved_at ?? null], ['event_order_conflict', null], 'kept for the owner');
  } finally { w.db.close(); }
});

// ================= H3 (real server, production identity path) =================
test('H3: the real server survives admission, discrepancy and completion failures; other tenants stay available; redelivery is exact; logs are sanitised', { timeout: 120000 }, async (t) => {
  const { startServer } = await import('../../scripts/test-server.mjs');
  const { seedOwner } = await import('../../scripts/visual/session.mjs');
  const fake = (p) => p + crypto.randomBytes(12).toString('hex');
  const KEY = fake(['sk', 'test', ''].join('_')), RKEY = fake(['rk', 'test', ''].join('_'));
  const provider = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), send = (c, v) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(v)); };
    const restricted = String(req.headers.authorization).includes(RKEY);
    if (u.pathname === '/v1/account') return restricted ? send(403, { error: { type: 'invalid_request_error', code: 'permission_denied' } }) : send(200, { object: 'account', id: 'acct_h3' });
    if (u.pathname === '/v1/balance') return send(200, { object: 'balance', livemode: false });
    if (u.pathname.startsWith('/v1/payment_intents/')) return send(200, { object: 'payment_intent', id: decodeURIComponent(u.pathname.split('/').pop()), currency: 'aud', livemode: false });
    if (u.pathname === '/v1/refunds' && req.method === 'GET') return send(200, { object: 'list', has_more: false, data: [] });
    send(404, { error: { type: 'invalid_request_error', code: 'resource_missing' } });
  });
  await new Promise((r) => provider.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => provider.close(r)));
  const s = await startServer({ STRIPE_API_BASE_URL: `http://127.0.0.1:${provider.address().port}` }); // NODE_ENV=test, opt-in absent: production identity path
  t.after(() => s.stop());
  const tenants = [];
  for (const name of ['a', 'b']) {
    const o = await seedOwner(s, { email: `h3-${name}@example.test`, business: 'H3 ' + name });
    const whsec = fake('whsec_');
    const put = await s.call('PUT', '/api/saas/payments/settings', { cookie: o.cookie, body: { stripe_secret_key: KEY, stripe_webhook_secret: whsec, terms_days: 14 } });
    assert.equal(put.status, 200, put.text);
    tenants.push({ ...o, whsec });
  }
  const [A, B] = tenants;
  // Restricted-key read checks (no write performed).
  const chk = await s.call('POST', '/api/saas/payments/settings/test', { cookie: A.cookie, body: { provider: 'stripe' } });
  assert.equal(chk.status, 200, chk.text);
  assert.deepEqual(chk.json.checks, { account: 'verified', balance_mode: 'test', payment_intent_read: 'not_checked', refund_read: 'verified', refund_write: 'not_checked' });
  const db = new Database(s.dbPath); t.after(() => db.close());
  const now = new Date().toISOString();
  const pay = {};
  for (const o of tenants) {
    const job = crypto.randomUUID(), id = crypto.randomUUID();
    db.prepare("INSERT INTO work_orders(id,organisation_id,title,start_at,required_skills,status,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,'[]','completed',10000,10000,?,?)").run(job, o.org, 'J', now, now, now);
    db.prepare("INSERT INTO job_payments (id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',10000,'aud',?,?,?)").run(id, o.org, job, 'pi_h3_' + o.org.slice(0, 6), now, now);
    pay[o.org] = { id, job, pi: 'pi_h3_' + o.org.slice(0, 6) };
  }
  const withSample = await s.call('POST', '/api/saas/payments/settings/test', { cookie: A.cookie, body: { provider: 'stripe', payment_id: pay[A.org].id } });
  assert.equal(withSample.json.checks.payment_intent_read, 'verified');
  assert.equal(withSample.json.checks.refund_write, 'not_checked');
  const send = async (o, event) => {
    const body = JSON.stringify(event), ts = Math.floor(Date.now() / 1000), sig = crypto.createHmac('sha256', o.whsec).update(`${ts}.${body}`).digest('hex');
    const r = await fetch(`${s.base}/api/webhooks/payments/stripe/${o.org}`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` }, body, signal: AbortSignal.timeout(15000) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const charge = (o, total, id) => ({ id, type: 'charge.refunded', created: Math.floor(Date.now() / 1000), livemode: false, data: { object: { object: 'charge', payment_intent: pay[o.org].pi, amount_refunded: total, currency: 'aud' } } });
  const totals = (o) => [db.prepare('SELECT refunded_cents n FROM job_payments WHERE id=?').get(pay[o.org].id).n, db.prepare('SELECT paid_cents n FROM work_orders WHERE id=?').get(pay[o.org].job).n];
  const alive = async () => (await fetch(s.base + '/healthz', { signal: AbortSignal.timeout(3000) })).ok;
  const otherTenantWorks = async (eventId, total) => {
    assert.equal((await s.call('GET', '/api/saas/payments/settings', { cookie: B.cookie })).status, 200, 'B authenticated request');
    assert.equal((await send(B, charge(B, total, eventId))).status, 200, 'B signed webhook');
  };
  const MARK = 'SYNTHETIC_FAULT_' + crypto.randomUUID().slice(0, 8);
  // 1. Admission failure.
  db.exec(`CREATE TRIGGER f1 BEFORE INSERT ON payment_events WHEN NEW.organisation_id='${A.org}' BEGIN SELECT RAISE(ABORT,'${MARK}'); END`);
  assert.equal((await send(A, charge(A, 1000, 'evt_adm'))).status, 500);
  assert.ok(await alive()); await otherTenantWorks('evt_b1', 500);
  db.exec('DROP TRIGGER f1');
  assert.equal((await send(A, charge(A, 1000, 'evt_adm'))).status, 200, 'redelivery admitted');
  assert.deepEqual(totals(A), [1000, 9000]);
  // 2. Completion (outcome) write failure after the financial effect committed.
  db.exec(`CREATE TRIGGER f2 BEFORE UPDATE OF outcome ON payment_events WHEN NEW.organisation_id='${A.org}' BEGIN SELECT RAISE(ABORT,'${MARK}'); END`);
  assert.equal((await send(A, charge(A, 3000, 'evt_out'))).status, 500);
  assert.ok(await alive()); await otherTenantWorks('evt_b2', 800);
  db.exec('DROP TRIGGER f2');
  const again = await send(A, charge(A, 3000, 'evt_out'));
  assert.equal(again.status, 200, JSON.stringify(again.json));
  assert.deepEqual(totals(A), [3000, 7000], 'redelivery applies no duplicate effect');
  assert.equal(db.prepare("SELECT outcome FROM payment_events WHERE event_id='evt_out'").get().outcome !== null, true);
  assert.equal((await send(A, charge(A, 3000, 'evt_out'))).json.duplicate, true);
  // 3. Discrepancy storage failure on a local balance conflict.
  db.prepare('UPDATE work_orders SET paid_cents=1000 WHERE id=?').run(pay[A.org].job);
  db.exec(`CREATE TRIGGER f3 BEFORE INSERT ON fin_stripe_refund_discrepancies BEGIN SELECT RAISE(ABORT,'${MARK}'); END`);
  assert.equal((await send(A, charge(A, 6000, 'evt_disc'))).status, 500, 'not acknowledged');
  assert.ok(await alive()); await otherTenantWorks('evt_b3', 900);
  db.exec('DROP TRIGGER f3');
  const rec = await send(A, charge(A, 6000, 'evt_disc'));
  assert.deepEqual([rec.status, rec.json.outcome], [200, 'refund_reconciliation_required']);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM fin_stripe_refund_discrepancies WHERE event_id='evt_disc'").get().n, 1);
  assert.equal((await send(A, charge(A, 6000, 'evt_disc'))).json.duplicate, true);
  assert.deepEqual(totals(A), [3000, 1000], 'conflicting event changed no balance');
  assert.deepEqual(totals(B), [900, 9100], 'other tenant exact');
  assert.doesNotMatch(s.log(), new RegExp(MARK), 'injected storage error text never logged');
  assert.match(s.log(), /Stripe webhook could not be committed; retry required/);
});
