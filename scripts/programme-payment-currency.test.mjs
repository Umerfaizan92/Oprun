import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createDb } from '../src/db.js';
import { installPayments } from '../src/payments.js';

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
  return { db, org, job, calls, payments, payment, hook };
}

for (const [currency, providerAmount] of [['AUD', 5000], ['JPY', 50], ['KWD', 50000]]) {
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

test('signed refund with a different currency leaves the ledger unchanged', async () => {
  const f = fixture('AUD');
  try {
    const res = await f.hook(5000, crypto.randomUUID(), 'jpy');
    assert.equal(res.value.outcome, 'currency_mismatch');
    assert.equal(f.payment().refunded_cents, 0);
    assert.equal(f.db.prepare('SELECT paid_cents FROM work_orders WHERE id=?').get(f.job).paid_cents, 100000);
  } finally { f.db.close(); }
});
