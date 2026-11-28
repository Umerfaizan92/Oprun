// PRG-03 re-acceptance CHARACTERISATION (Claude): records the candidate's CURRENT behaviour for each remaining
// finding so it can be reproduced. These tests pass on 09fcd0b and are expected to FAIL once a finding is fixed.
// They are not acceptance evidence. The mandatory requirements live in prg03-reacceptance-independent.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createDb } from '../../src/db.js';
import { installPayments } from '../../src/payments.js';
import { createFinance } from '../../src/finance/service.js';

function world() {
  const db = createDb(':memory:'), routes = new Map(), posts = [], refunds = [], now = new Date().toISOString();
  db.exec('ALTER TABLE job_payments ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE TABLE tenant_documents(id TEXT PRIMARY KEY,organisation_id TEXT)');
  const org = crypto.randomUUID(), job = crypto.randomUUID(), payment = crypto.randomUUID(), secret = 'whsec-synthetic';
  db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(org, 'T', org, now, now);
  db.prepare("INSERT INTO users(id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES ('owner','o@x.test','O','x','x',?,?)").run(now, now);
  db.prepare("INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES (?,'owner','owner',?)").run(org, now);
  db.prepare('INSERT INTO payment_settings(organisation_id,stripe_secret_enc,stripe_webhook_enc,updated_at) VALUES (?,?,?,?)').run(org, 'sk-one', secret, now);
  db.prepare('INSERT INTO work_orders(id,organisation_id,title,start_at,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,10000,10000,?,?)').run(job, org, 'J', now, now, now);
  db.prepare("INSERT INTO job_payments(id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',10000,'aud','pi_c',?,?)").run(payment, org, job, now, now);
  const plan = [];
  const fetchImpl = async (url, options) => {
    const u = new URL(url);
    if (options.method === 'GET') return { ok: true, status: 200, json: async () => ({ has_more: false, data: refunds }) };
    const p = new URLSearchParams(options.body), step = plan.shift() || {};
    const made = { id: 're_' + posts.length, object: 'refund', amount: Number(p.get('amount')), currency: 'aud', payment_intent: 'pi_c', status: step.status || 'succeeded', metadata: { organisation_id: org, payment_id: payment, refund_request_id: p.get('metadata[refund_request_id]') } };
    posts.push(made); refunds.unshift(made);
    if (step.throws) throw new Error('reset');
    void u; return { ok: true, status: 200, json: async () => made };
  };
  const payments = installPayments({ get() {}, put() {}, delete() {}, patch() {}, post: (p, ...h) => routes.set(p, h.at(-1)) }, { db, env: {}, runtime: { decryptBundle: (v) => ({ v }) }, requireSaasUser() {}, requireSaasRole: () => () => {}, saasAudit() {}, financeRoles: ['owner'], syncJobFinance() {}, fetchImpl });
  const finance = createFinance({ db, payments, engineRef: { current: { startRun: () => ({ id: crypto.randomUUID(), promise: Promise.resolve() }) } } });
  const hook = async (type, object) => {
    const event = { id: 'evt_' + crypto.randomUUID(), type, data: { object } }, raw = JSON.stringify(event), ts = Math.floor(Date.now() / 1000);
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.value = v; return this; } };
    await routes.get('/api/webhooks/payments/stripe/:orgId')({ params: { orgId: org }, body: event, rawBody: raw, get: () => `t=${ts},v1=${crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex')}` }, res);
    return res;
  };
  const request = (a) => finance.requestRefund(org, payment, 'req', { amount_cents: a, reason: 's' });
  const state = () => [db.prepare('SELECT refunded_cents n FROM job_payments').get().n, db.prepare('SELECT paid_cents n FROM work_orders').get().n];
  return { db, org, job, payment, plan, posts, refunds, finance, hook, request, state, rotate: () => db.prepare("UPDATE payment_settings SET stripe_secret_enc='sk-two'").run() };
}

test('G1 current behaviour: refund.failed after a succeeded refund is reported as refund_completed and changes nothing', async () => {
  const w = world();
  const id = w.request(4000).refund_id;
  await w.finance.executeRefund(w.org, { refund_id: id }, 'owner');
  const r = await w.hook('refund.failed', { ...w.refunds[0], status: 'failed', failure_reason: 'lost_or_stolen_card' });
  assert.equal(r.value.outcome, 'refund_completed');
  assert.equal(w.db.prepare('SELECT status FROM fin_refunds WHERE id=?').get(id).status, 'completed');
  assert.deepEqual(w.state(), [4000, 6000], 'ledger still shows the customer refunded');
  // A later lower charge total cannot correct it either: the charge floor never decreases.
  await w.hook('charge.refunded', { object: 'charge', payment_intent: 'pi_c', amount_refunded: 0, currency: 'aud' });
  assert.deepEqual(w.state(), [4000, 6000]);
  w.db.close();
});

test('G2 current behaviour: after a same-account key rotation, held and pending refunds cannot be reconciled', async () => {
  const w = world();
  const held = w.request(2500).refund_id;
  w.plan.push({ throws: true });
  await assert.rejects(w.finance.executeRefund(w.org, { refund_id: held }, 'owner'));
  w.rotate();
  const r = await w.finance.reconcileStripeRefund(w.org, held, 'owner', {});
  assert.deepEqual([r.ok, r.status], [false, 409]);
  assert.equal(w.request(100).status, 409, 'payment stays locked for refunds');
  w.db.close();
  const v = world();
  const pending = v.request(4000).refund_id;
  v.plan.push({ status: 'pending' });
  await v.finance.executeRefund(v.org, { refund_id: pending }, 'owner');
  v.rotate();
  await v.hook('refund.updated', { ...v.refunds[0], status: 'succeeded' });
  assert.equal(v.db.prepare('SELECT status FROM fin_refunds WHERE id=?').get(pending).status, 'submitted', 'signed exact event ignored');
  assert.deepEqual(v.state(), [0, 10000]);
  v.db.close();
});

test('G3 current behaviour: a job whose paid amount was lowered by an admin edit makes a valid refund webhook fail with 500 on every delivery', async () => {
  const w = world();
  w.db.prepare('UPDATE work_orders SET paid_cents=1000').run(); // PUT /api/saas/finance/jobs/:id can set this
  for (let i = 0; i < 2; i++) {
    const r = await w.hook('charge.refunded', { object: 'charge', payment_intent: 'pi_c', amount_refunded: 4000, currency: 'aud' });
    assert.equal(r.statusCode, 500, 'Stripe will redeliver and it fails again');
  }
  assert.deepEqual(w.state(), [0, 1000]);
  assert.equal(w.db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='payment.needs_review'").get().n, 0, 'no owner flag is raised');
  w.db.close();
});
