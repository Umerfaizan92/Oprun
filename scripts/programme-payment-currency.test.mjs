import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createDb } from '../src/db.js';
import { installPayments } from '../src/payments.js';
import { majorToLedgerExact, requireStripeUnits, ledgerFromStripeUnits } from '../src/payment-precision.js';
import { createFinance } from '../src/finance/service.js';

function fixture(currency) {
  const db = createDb(':memory:'), routes = new Map(), calls = [];
  // The finance installer adds this column during real server startup.
  db.exec('ALTER TABLE job_payments ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0');
  const app = Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map(method => [method, (path, ...handlers) => routes.set(method + ' ' + path, handlers.at(-1))]));
  const now = new Date().toISOString(), org = crypto.randomUUID(), job = crypto.randomUUID(), id = crypto.randomUUID();
  const secret = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(org, 'Synthetic audit', org, now, now);
  db.prepare('INSERT INTO payment_settings(organisation_id,stripe_secret_enc,stripe_webhook_enc,updated_at) VALUES (?,?,?,?)').run(org, 'synthetic', secret, now);
  db.prepare('INSERT INTO work_orders(id,organisation_id,title,start_at,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(job, org, 'Synthetic paid job', now, 100000, 100000, now, now);
  db.prepare("INSERT INTO job_payments(id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',100000,?,'pi_synthetic',?,?)").run(id, org, job, currency.toLowerCase(), now, now);
  const payments = installPayments(app, { db, env: {}, runtime: { decryptBundle: v => ({ v }) }, requireSaasUser() {}, requireSaasRole: () => () => {}, saasAudit() {}, financeRoles: ['owner'], syncJobFinance() {},
    fetchImpl: async (url, options) => { calls.push({ url, options, params: new URLSearchParams(options.body) }); return { ok: true, json: async () => ({ id: 'refund_synthetic', status: 'succeeded', amount: Number(calls.at(-1).params.get('amount')) }) }; } });
  const payment = () => db.prepare('SELECT * FROM job_payments WHERE id=?').get(id);
  const hook = async (amount, eventId = crypto.randomUUID(), eventCurrency = currency.toLowerCase()) => {
    const body = { id: eventId, type: 'charge.refunded', data: { object: { payment_intent: 'pi_synthetic', amount_refunded: amount, currency: eventCurrency } } };
    const rawBody = JSON.stringify(body), t = Math.floor(Date.now() / 1000), sig = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
    const req = { params: { orgId: org }, body, rawBody, get: () => `t=${t},v1=${sig}` };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; return this; } };
    await routes.get('post /api/webhooks/payments/stripe/:orgId')(req, res);
    return res;
  };
  return { db, org, job, calls, payments, payment, hook, routes };
}

test('exact decimal parsing rejects rounding, unsafe values and unsupported granularity', () => {
  for (const [value, cents] of [[19.99, 1999], [0.29, 29], [1e-2, 1], [1e3, 100000]]) assert.equal(majorToLedgerExact(value), cents);
  for (const value of [50.001, 2.675, NaN, Infinity, -1, 1e20, '50']) assert.throws(() => majorToLedgerExact(value), /precision/i);
  for (const currency of ['JPY', 'ISK', 'UGX']) assert.throws(() => requireStripeUnits(5050, currency), /precision/i);
  assert.equal(requireStripeUnits(1045, 'HUF'), 1045, 'payout restrictions must not change charge units');
  assert.equal(requireStripeUnits(1045, 'TWD'), 1045);
  assert.equal(requireStripeUnits(1045, 'IDR'), 1045);
  for (const amount of [50001, -1, 1.5, NaN, Infinity, '50000']) assert.equal(ledgerFromStripeUnits(amount, 'KWD'), null);
});

test('fractional JPY refund cannot enter the approval queue', () => {
  const f = fixture('JPY');
  try {
    // The SaaS installer creates this table before the finance installer in production.
    f.db.exec('CREATE TABLE tenant_documents(id TEXT PRIMARY KEY,organisation_id TEXT)');
    const finance = createFinance({ db: f.db });
    const result = finance.requestRefund(f.org, f.payment().id, 'synthetic', { amount_cents: 5050, reason: 'Synthetic request' });
    assert.equal(result.ok, false);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM fin_refunds').get().n, 0);
    assert.equal(f.calls.length, 0);
  } finally { f.db.close(); }
});

test('fractional JPY saved-card charge is refused before creating a payment', async () => {
  const f = fixture('JPY');
  try {
    const customer = crypto.randomUUID(), card = crypto.randomUUID(), now = new Date().toISOString();
    f.db.prepare('INSERT INTO tenant_customers(id,organisation_id,name,created_at,updated_at) VALUES (?,?,?,?,?)').run(customer, f.org, 'Synthetic customer', now, now);
    f.db.prepare('UPDATE work_orders SET paid_cents=0,customer_id=? WHERE id=?').run(customer, f.job);
    f.db.exec('CREATE TABLE fin_settings(organisation_id TEXT PRIMARY KEY,currency TEXT)');
    f.db.prepare('INSERT INTO fin_settings VALUES (?,?)').run(f.org, 'JPY');
    f.db.prepare('INSERT INTO saved_cards(id,organisation_id,customer_id,stripe_customer_id,stripe_payment_method_id,authorised_at,created_at) VALUES (?,?,?,?,?,?,?)').run(card, f.org, customer, 'cus_synthetic', 'pm_synthetic', now, now);
    const req = { params: { id: card }, body: { work_order_id: f.job, amount: 50.50 }, saas: { organisation_id: f.org, user_id: 'synthetic' } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; return this; } };
    await f.routes.get('post /api/saas/payments/saved-cards/:id/charge')(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(f.calls.length, 0);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM job_payments').get().n, 1);
  } finally { f.db.close(); }
});

for (const [currency, providerAmount] of [['AUD', 5000], ['JPY', 50], ['KWD', 50000], ['ISK', 5000], ['UGX', 5000]]) {
  test(`${currency}: approved refund sends the currency's minor units`, async () => {
    const f = fixture(currency);
    try { await f.payments.refundStripe(f.org, f.payment(), 5000, 'synthetic-refund'); assert.equal(f.calls[0].params.get('amount'), String(providerAmount)); }
    finally { f.db.close(); }
  });
  test(`${currency}: signed cumulative refund updates hundredths once`, async () => {
    const f = fixture(currency);
    try {
      const event = crypto.randomUUID();
      assert.equal((await f.hook(providerAmount, event)).statusCode, 200);
      assert.equal(f.payment().refunded_cents, 5000);
      assert.equal(f.db.prepare('SELECT paid_cents FROM work_orders WHERE id=?').get(f.job).paid_cents, 95000);
      await f.hook(providerAmount, event);
      await f.hook(providerAmount);
      assert.equal(f.payment().refunded_cents, 5000);
      await f.hook(providerAmount * 2);
      assert.equal(f.payment().refunded_cents, 10000, 'later cumulative partial refund adds only its delta');
      await f.hook(providerAmount);
      assert.equal(f.payment().refunded_cents, 10000, 'older cumulative event cannot undo a refund');
      await f.hook(providerAmount * 20);
      assert.equal(f.payment().status, 'refunded');
      assert.equal(f.payment().refunded_cents, 100000);
      assert.equal(f.db.prepare('SELECT paid_cents FROM work_orders WHERE id=?').get(f.job).paid_cents, 0);
    } finally { f.db.close(); }
  });
}

test('fractional JPY refund is rejected before any provider request', async () => {
  const f = fixture('JPY');
  try {
    await assert.rejects(f.payments.refundStripe(f.org, f.payment(), 5050, 'synthetic-fraction'), /precision|whole/i);
    assert.equal(f.calls.length, 0);
  } finally { f.db.close(); }
});

test('unrepresentable signed refund is flagged once without changing balances', async () => {
  const f = fixture('KWD');
  try {
    const event = crypto.randomUUID(), res = await f.hook(50001, event);
    assert.equal(res.value.outcome, 'amount_precision_review');
    assert.equal(f.payment().refunded_cents, 0);
    assert.equal(f.db.prepare('SELECT paid_cents FROM work_orders WHERE id=?').get(f.job).paid_cents, 100000);
    assert.equal((await f.hook(50001, event)).value.duplicate, true);
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM payment_events WHERE event_id=?").get(event).n, 1);
  } finally { f.db.close(); }
});

for (const [currency, amount] of [['JPY', 50.50], ['AUD', 50.001]]) {
  test(`${currency}: checkout cannot round requested precision or issue an invoice`, async () => {
    const f = fixture(currency);
    try {
      f.db.prepare('UPDATE work_orders SET paid_cents=0 WHERE id=?').run(f.job);
      f.db.prepare('CREATE TABLE fin_settings(organisation_id TEXT PRIMARY KEY,currency TEXT)').run();
      f.db.prepare('INSERT INTO fin_settings VALUES (?,?)').run(f.org, currency);
      await assert.rejects(f.payments.createRequest(f.org, { user_id: 'synthetic' }, { work_order_id: f.job, provider: 'stripe', amount }), /precision|whole/i);
      assert.equal(f.calls.length, 0);
      assert.equal(f.db.prepare('SELECT invoice_issued_at FROM work_orders WHERE id=?').get(f.job).invoice_issued_at, null);
    } finally { f.db.close(); }
  });
}

test('signed refund with a different currency leaves the ledger unchanged', async () => {
  const f = fixture('AUD');
  try {
    const res = await f.hook(5000, crypto.randomUUID(), 'jpy');
    assert.equal(res.value.outcome, 'currency_mismatch');
    assert.equal(f.payment().refunded_cents, 0);
    assert.equal(f.db.prepare('SELECT paid_cents FROM work_orders WHERE id=?').get(f.job).paid_cents, 100000);
  } finally { f.db.close(); }
});
