import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import http from 'node:http';
import { createDb } from '../../src/db.js';
import { installPayments } from '../../src/payments.js';
import { createFinance } from '../../src/finance/service.js';

function unit({ fetchImpl, nodeEnv = 'production' }) {
  const saved = process.env.NODE_ENV; process.env.NODE_ENV = nodeEnv;
  const db = createDb(':memory:'), routes = new Map(), now = new Date().toISOString();
  db.exec('ALTER TABLE job_payments ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE TABLE tenant_documents(id TEXT PRIMARY KEY,organisation_id TEXT)');
  const org = crypto.randomUUID(), job = crypto.randomUUID(), payment = crypto.randomUUID(), whsec = 'whsec-char';
  db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(org, 'C', org, now, now);
  db.prepare('INSERT INTO payment_settings(organisation_id,stripe_secret_enc,stripe_webhook_enc,updated_at) VALUES (?,?,?,?)').run(org, 'key-a', whsec, now);
  db.prepare('INSERT INTO work_orders(id,organisation_id,title,start_at,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,10000,10000,?,?)').run(job, org, 'J', now, now, now);
  db.prepare("INSERT INTO job_payments(id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',10000,'aud','pi_c',?,?)").run(payment, org, job, now, now);
  const app = Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map((m) => [m, (p, ...h) => routes.set(m + ' ' + p, h.at(-1))]));
  const payments = installPayments(app, { db, env: {}, runtime: { decryptBundle: (v) => ({ v }) }, requireSaasUser() {}, requireSaasRole: () => () => {}, saasAudit() {}, financeRoles: ['owner'], syncJobFinance() {}, fetchImpl });
  const finance = createFinance({ db, payments, engineRef: { current: { startRun: () => ({ id: crypto.randomUUID(), promise: Promise.resolve() }) } } });
  if (saved === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved;
  const hook = async (type, object, { id = 'evt_' + crypto.randomUUID(), created, livemode = false } = {}) => {
    const event = { id, type, created, livemode, data: { object } }, raw = JSON.stringify(event), ts = Math.floor(Date.now() / 1000);
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.value = v; return this; } };
    await routes.get('post /api/webhooks/payments/stripe/:orgId')({ params: { orgId: org }, body: event, rawBody: raw, get: () => `t=${ts},v1=${crypto.createHmac('sha256', whsec).update(`${ts}.${raw}`).digest('hex')}` }, res);
    return res;
  };
  return { db, org, payment, payments, finance, hook, routes };
}
const stand = (accountStatus) => {
  const posts = [];
  const f = async (url, options) => {
    const u = new URL(url), json = (code, v) => ({ ok: code < 300, status: code, json: async () => v });
    if (u.pathname === '/v1/account') return accountStatus === 200 ? json(200, { object: 'account', id: 'acct_one' }) : json(accountStatus, { error: { type: 'invalid_request_error', code: 'permission_denied' } });
    if (u.pathname === '/v1/balance') return json(200, { object: 'balance', livemode: false });
    if (u.pathname.startsWith('/v1/payment_intents/')) return json(200, { object: 'payment_intent', id: 'pi_c', currency: 'aud', livemode: false });
    if (options.method === 'POST' && u.pathname === '/v1/refunds') { const p = new URLSearchParams(options.body); const m = { id: 're_' + posts.length, object: 'refund', amount: Number(p.get('amount')), currency: 'aud', payment_intent: 'pi_c', status: 'pending', livemode: false, metadata: { refund_request_id: p.get('metadata[refund_request_id]') } }; posts.push(m); return json(200, m); }
    return json(200, { object: 'list', has_more: false, data: posts });
  };
  return { f, posts };
};


test('H1: tracing wrappers and a test flag cannot bypass restricted identity in production', async () => {
  const original = process.env.OPRUN_TEST_STRIPE_COMPAT;
  process.env.OPRUN_TEST_STRIPE_COMPAT = '1';
  try {
    for (const status of [401, 403, 500]) {
      const s = stand(status);
      const u = unit({ fetchImpl: (...args) => s.f(...args), nodeEnv: 'production' });
      try {
        assert.equal(await u.payments.refundAccount(u.org), null);
        const id = u.finance.requestRefund(u.org, u.payment, 'r', { amount_cents: 1000, reason: 'synthetic' }).refund_id;
        await assert.rejects(u.finance.executeRefund(u.org, { refund_id: id }, 'owner'), /not available/);
        const payment = u.db.prepare('SELECT * FROM job_payments WHERE id=?').get(u.payment);
        await assert.rejects(u.payments.refundStripe(u.org, payment, 1000, 'synthetic'), /configuration changed/);
        assert.equal(s.posts.length, 0);
      } finally { u.db.close(); }
    }
  } finally {
    if (original === undefined) delete process.env.OPRUN_TEST_STRIPE_COMPAT;
    else process.env.OPRUN_TEST_STRIPE_COMPAT = original;
  }
});

test('H1: test NODE_ENV without the explicit opt-in cannot use fingerprint compatibility', async () => {
  const original = process.env.OPRUN_TEST_STRIPE_COMPAT;
  delete process.env.OPRUN_TEST_STRIPE_COMPAT;
  const s = stand(403);
  const u = unit({ fetchImpl: s.f, nodeEnv: 'test' });
  try {
    assert.equal(await u.payments.refundAccount(u.org), null);
    assert.equal(s.posts.length, 0);
  } finally {
    u.db.close();
    if (original !== undefined) process.env.OPRUN_TEST_STRIPE_COMPAT = original;
  }
});

test('Stripe settings check verifies read capabilities without a refund write', async () => {
  const s = stand(200);
  const u = unit({ fetchImpl: s.f });
  try {
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(v) { this.value = v; return this; } };
    await u.routes.get('post /api/saas/payments/settings/test')({
      body: { provider: 'stripe', payment_id: u.payment }, saas: { organisation_id: u.org },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.value.checks, { account: 'verified', balance_mode: 'test', payment_intent_read: 'verified', refund_read: 'verified', refund_write: 'not_checked' });
    assert.equal(s.posts.length, 0);
  } finally { u.db.close(); }
});

test('H2: distinct same-second status changes use current Stripe evidence, and duplicate or delayed events do not change balances', async () => {
  const s = stand(200);
  const u = unit({ fetchImpl: s.f });
  try {
    const id = u.finance.requestRefund(u.org, u.payment, 'r', { amount_cents: 4000, reason: 'synthetic' }).refund_id;
    await u.finance.executeRefund(u.org, { refund_id: id }, 'owner');
    const made = s.posts[0], t0 = Math.floor(Date.now() / 1000) + 5;
    await u.hook('refund.updated', { ...made, status: 'requires_action', next_action: { type: 'display_details' } }, { id: 'evt_z', created: t0 });
    s.posts[0] = { ...made, status: 'succeeded' };
    const send = id => u.hook('refund.updated', s.posts[0], { id, created: t0 });
    const results = await Promise.all([send('evt_a'), send('evt_a')]);
    assert.ok(results.every(result => result.statusCode === 200));
    assert.ok(results.some(result => result.value.outcome === 'refund_completed'));
    await u.hook('refund.updated', { ...made, status: 'requires_action' }, { id: 'evt_old', created: t0 - 1 });
    assert.equal(u.db.prepare('SELECT status FROM fin_refunds WHERE id=?').get(id).status, 'completed');
    assert.equal(u.db.prepare('SELECT refunded_cents FROM job_payments WHERE id=?').get(u.payment).refunded_cents, 4000);
    assert.equal(u.db.prepare('SELECT paid_cents FROM work_orders').get().paid_cents, 6000);
    assert.equal(u.db.prepare('SELECT COUNT(*) n FROM fin_stripe_refund_lifecycle WHERE event_created=?').get(t0).n, 2);
    assert.equal(s.posts.length, 1);
  } finally { u.db.close(); }
});

test('H2: a same-second conflict with unavailable current evidence is durable and owner-visible', async () => {
  const s = stand(200);
  let unavailable = false;
  const u = unit({ fetchImpl: (url, options) => {
    if (unavailable && options.method === 'GET' && new URL(url).pathname === '/v1/refunds') throw new Error('Synthetic read outage');
    return s.f(url, options);
  } });
  try {
    const id = u.finance.requestRefund(u.org, u.payment, 'r', { amount_cents: 4000, reason: 'synthetic' }).refund_id;
    await u.finance.executeRefund(u.org, { refund_id: id }, 'owner');
    const made = s.posts[0], t0 = Math.floor(Date.now() / 1000) + 5;
    await u.hook('refund.updated', { ...made, status: 'pending' }, { created: t0 });
    unavailable = true;
    const event = { ...made, status: 'failed' };
    assert.equal((await u.hook('refund.failed', event, { id: 'evt_uncertain', created: t0 })).value.outcome, 'refund_reconciliation_required');
    assert.equal((await u.hook('refund.failed', event, { id: 'evt_uncertain', created: t0 })).value.duplicate, true);
    assert.equal(u.db.prepare('SELECT status FROM fin_refunds WHERE id=?').get(id).status, 'submitted');
    assert.equal(u.finance.stripeDiscrepancies(u.org)[0].reason, 'event_order_conflict');
    assert.equal(u.db.prepare("SELECT COUNT(*) n FROM payment_notices WHERE kind='payment_review'").get().n, 1);
  } finally { u.db.close(); }
});

test('H3: real server survives admission, discrepancy and completion write failures, with tenant isolation and redelivery', { timeout: 45000 }, async t => {
  const { startServer } = await import('../../scripts/test-server.mjs');
  const { seedOwner } = await import('../../scripts/visual/session.mjs');
  const provider = http.createServer((req, res) => {
    const body = req.url === '/v1/account' ? { object: 'account', id: 'acct_fixture' }
      : { object: 'balance', livemode: false };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  t.after(async () => { provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)); });
  const server = await startServer({ STRIPE_API_BASE_URL: `http://127.0.0.1:${provider.address().port}`, OPRUN_TEST_STRIPE_COMPAT: '0' });
  t.after(() => server.stop());
  const db = new Database(server.dbPath);
  t.after(() => db.close());
  const a = await seed('a', 1000), b = await seed('b', 10000);
  async function seed(tag, paid) {
    const owner = await seedOwner(server, { email: `closure-${tag}@example.test` });
    const key = ['sk','test',crypto.randomBytes(16).toString('hex')].join('_');
    const secret = 'whsec_' + crypto.randomBytes(16).toString('hex');
    const put = await server.call('PUT', '/api/saas/payments/settings', { cookie: owner.cookie, body: { stripe_secret_key: key, stripe_webhook_secret: secret } });
    assert.equal(put.status, 200, put.text);
    const now = new Date().toISOString(), job = crypto.randomUUID(), pay = crypto.randomUUID();
    db.prepare("INSERT INTO work_orders(id,organisation_id,title,start_at,required_skills,status,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,'[]','completed',10000,?,?,?)")
      .run(job, owner.org, 'Synthetic', now, paid, now, now);
    db.prepare("INSERT INTO job_payments(id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',10000,'aud',?,?,?)")
      .run(pay, owner.org, job, 'pi_' + tag, now, now);
    return { ...owner, secret, job, pay, tag };
  }
  async function send(tenant, id) {
    const object = { object: 'charge', payment_intent: 'pi_' + tenant.tag, amount_refunded: 4000, currency: 'aud' };
    const body = JSON.stringify({ id, type: 'charge.refunded', livemode: false, data: { object } });
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', tenant.secret).update(`${ts}.${body}`).digest('hex');
    const r = await fetch(`${server.base}/api/webhooks/payments/stripe/${tenant.org}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` }, body, signal: AbortSignal.timeout(8000),
    });
    return [r.status, await r.json()];
  }
  const outcome = id => db.prepare('SELECT outcome FROM payment_events WHERE event_id=?').get(id)?.outcome;
  db.exec("CREATE TRIGGER fail_admission BEFORE INSERT ON payment_events WHEN NEW.event_id='evt_admission' BEGIN SELECT RAISE(ABORT,'synthetic fault text'); END");
  assert.deepEqual(await send(a, 'evt_admission'), [500, { ok: false }]);
  assert.equal(outcome('evt_admission'), undefined);
  db.exec('DROP TRIGGER fail_admission');
  db.exec("CREATE TRIGGER fail_disc BEFORE INSERT ON fin_stripe_refund_discrepancies WHEN NEW.event_id='evt_conflict' BEGIN SELECT RAISE(ABORT,'synthetic fault text'); END");
  assert.deepEqual(await send(a, 'evt_conflict'), [500, { ok: false }]);
  assert.equal(outcome('evt_conflict'), null);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM fin_stripe_refund_discrepancies').get().n, 0);
  assert.equal((await server.call('GET', '/api/saas/me', { cookie: b.cookie })).status, 200);
  assert.equal((await send(b, 'evt_other_tenant'))[0], 200);
  db.exec('DROP TRIGGER fail_disc');
  assert.deepEqual(await send(a, 'evt_conflict'), [200, { ok: true, outcome: 'refund_reconciliation_required' }]);
  assert.equal((await send(a, 'evt_conflict'))[1].duplicate, true);
  db.exec("CREATE TRIGGER fail_finish BEFORE UPDATE OF outcome ON payment_events WHEN NEW.event_id='evt_finish' BEGIN SELECT RAISE(ABORT,'synthetic fault text'); END");
  assert.deepEqual(await send(b, 'evt_finish'), [500, { ok: false }]);
  assert.equal(outcome('evt_finish'), null);
  db.exec('DROP TRIGGER fail_finish');
  assert.equal((await send(b, 'evt_finish'))[0], 200);
  assert.equal(db.prepare('SELECT refunded_cents FROM job_payments WHERE id=?').get(b.pay).refunded_cents, 4000);
  assert.equal(db.prepare('SELECT paid_cents FROM work_orders WHERE id=?').get(b.job).paid_cents, 6000);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM fin_stripe_refund_discrepancies').get().n, 1);
  assert.match(server.log(), /Stripe webhook could not be committed/);
  assert.doesNotMatch(server.log(), /synthetic fault text/);
});
