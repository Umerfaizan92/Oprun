// Mandatory PRG-03 acceptance, adapted from Claude's unchanged independent evidence at 0b86b34.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createDb } from '../../src/db.js';
import { installPayments } from '../../src/payments.js';
import { createFinance } from '../../src/finance/service.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const APPROVER = 'synthetic-approver', REQUESTER = 'synthetic-requester';

// ---------- unit fixture: real installPayments + createFinance, fake Stripe via fetchImpl ----------
function fixture({ currency = 'aud', amount = 10000, reference = 'pi_shared', filename = ':memory:' } = {}) {
  const db = createDb(filename), routes = new Map(), calls = [];
  db.exec('ALTER TABLE job_payments ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE TABLE tenant_documents(id TEXT PRIMARY KEY,organisation_id TEXT)');
  const app = Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map((m) => [m, (p, ...h) => routes.set(m + ' ' + p, h.at(-1))]));
  const now = new Date().toISOString();
  const tenants = {};
  const addTenant = (name) => {
    const org = crypto.randomUUID(), job = crypto.randomUUID(), payment = crypto.randomUUID(), secret = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(org, name, org, now, now);
    db.prepare('INSERT INTO payment_settings(organisation_id,stripe_secret_enc,stripe_webhook_enc,updated_at) VALUES (?,?,?,?)').run(org, 'synthetic', secret, now);
    db.prepare('INSERT INTO work_orders(id,organisation_id,title,start_at,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(job, org, 'Synthetic job', now, amount, amount, now, now);
    db.prepare("INSERT INTO job_payments(id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',?,?,?,?,?)").run(payment, org, job, amount, currency, reference, now, now);
    return (tenants[name] = { org, job, payment, secret });
  };
  const A = addTenant('Tenant A'), B = addTenant('Tenant B');
  db.prepare('INSERT INTO users(id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(APPROVER,'synthetic-owner@example.test','Synthetic owner','x','x',now,now);
  db.prepare("INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES (?,?,'owner',?)").run(A.org,APPROVER,now);
  // Programmable provider: each POST /v1/refunds takes the next behaviour (default: echo a succeeded refund).
  const plan = [];
  const fetchImpl = async (url, options) => {
    const params = new URLSearchParams(options.body || '');
    const call = { url, idem: options.headers?.['idempotency-key'], params };
    calls.push(call);
    const step = plan.shift() || { ok: true, body: (p) => ({ id: 're_' + crypto.createHash('sha1').update(call.idem || '').digest('hex').slice(0, 10), status: 'succeeded', amount: Number(p.get('amount')) }) };
    if (step.delay) await sleep(step.delay);
    if (step.throws) throw new Error('synthetic socket reset');
    const body = typeof step.body === 'function' ? step.body(params) : step.body;
    return { ok: step.ok !== false, status: step.status || 200, json: async () => body };
  };
  const payments = installPayments(app, { db, env: {}, runtime: { decryptBundle: (v) => ({ v }) }, requireSaasUser() {}, requireSaasRole: () => () => {}, saasAudit() {}, financeRoles: ['owner'], syncJobFinance() {}, fetchImpl });
  const engineRef = { current: { startRun: () => ({ id: crypto.randomUUID(), promise: Promise.resolve() }) } };
  const finance = createFinance({ db, payments, engineRef });
  const pay = (t = A) => db.prepare('SELECT * FROM job_payments WHERE id=?').get(t.payment);
  const wo = (t = A) => db.prepare('SELECT paid_cents FROM work_orders WHERE id=?').get(t.job).paid_cents;
  const refund = (id) => db.prepare('SELECT * FROM fin_refunds WHERE id=?').get(id);
  const insertRefund = ({ t = A, id = crypto.randomUUID(), amount: a, status = 'pending_approval', ref = null, error = null }) => {
    db.prepare(`INSERT INTO fin_refunds (id,organisation_id,payment_id,work_order_id,amount_cents,reason,status,provider,provider_ref,error,requested_by,created_at,updated_at)
      VALUES (?,?,?,?,?,'synthetic',?,'stripe',?,?,?,?,?)`).run(id, t.org, t.payment, t.job, a, status, ref, error, REQUESTER, now, now);
    return id;
  };
  const hook = async (t, object, { type = 'charge.refunded', eventId = 'evt_' + crypto.randomUUID() } = {}) => {
    const body = { id: eventId, type, data: { object: { payment_intent: reference, currency, ...object } } };
    const rawBody = JSON.stringify(body), ts = Math.floor(Date.now() / 1000), sig = crypto.createHmac('sha256', t.secret).update(`${ts}.${rawBody}`).digest('hex');
    const req = { params: { orgId: t.org }, body, rawBody, get: () => `t=${ts},v1=${sig}` };
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.value = v; return this; } };
    await routes.get('post /api/webhooks/payments/stripe/:orgId')(req, res);
    return res;
  };
  const exec = (id, t = A) => finance.executeRefund(t.org, { refund_id: id }, APPROVER);
  const refundCalls = () => calls.filter((c) => c.url.endsWith('/v1/refunds'));
  const audits = (action) => db.prepare('SELECT user_id,user_role,entity_id,metadata_json FROM audit_logs WHERE action=? ORDER BY rowid').all(action);
  return { db, A, B, plan, calls, refundCalls, finance, payments, pay, wo, refund, insertRefund, hook, exec, audits };
}
const isReview = (r) => r.status === 'submitted' && r.provider_ref === null && typeof r.error === 'string' && r.error.length > 0;

// ---------- 1. exact provider receipt matching ----------
test('receipt matching: only an exact succeeded receipt (id, amount, currency, tenant, payment) completes a request', async () => {
  const f = fixture();
  try {
    const a = f.insertRefund({ amount: 1000, status: 'submitted', ref: 're_a' });
    const b = f.insertRefund({ amount: 2000, status: 'submitted', ref: 're_b' });
    const bad = [
      { id: 're_a', status: 'pending', amount: 1000, currency: 'aud' },
      { id: 're_a', status: 'failed', amount: 1000, currency: 'aud' },
      { id: 're_a', status: 'canceled', amount: 1000, currency: 'aud' },
      { id: 're_a', status: 'succeeded', amount: 999, currency: 'aud' },
      { id: 're_a', status: 'succeeded', amount: 1000, currency: 'usd' },
      { id: 're_a', status: 'succeeded', amount: 1000 },
      { id: 're_a', status: 'succeeded', amount: '1000', currency: 'aud' },
      { id: 're_unknown', status: 'succeeded', amount: 1000, currency: 'aud' },
      { id: '', status: 'succeeded', amount: 1000, currency: 'aud' },
      null, 'garbage',
    ];
    const r1 = await f.hook(f.A, { amount_refunded: 3000, refunds: { data: bad } });
    assert.equal(r1.statusCode, 200);
    assert.equal(f.refund(a).status, 'submitted');
    assert.equal(f.refund(b).status, 'submitted');
    assert.equal(f.pay().refunded_cents, 3000, 'the charge total still moves the ledger once');
    const r2 = await f.hook(f.A, { amount_refunded: 3000, refunds: { data: [{ id: 're_a', status: 'succeeded', amount: 1000, currency: 'AUD' }, { id: 're_b', status: 'succeeded', amount: 2000, currency: 'aud' }] } });
    assert.equal(r2.value.outcome, 'refund_already_applied');
    assert.equal(f.refund(a).status, 'completed');
    assert.equal(f.refund(b).status, 'completed');
    assert.equal(f.pay().refunded_cents, 3000);
    assert.equal(f.wo(), 7000);
  } finally { f.db.close(); }
});

// ---------- 2. cross-tenant provider reference collision ----------
test('cross-tenant: the same payment_intent and refund id in two tenants never cross', async () => {
  const f = fixture();
  try {
    const a = f.insertRefund({ t: f.A, amount: 1000, status: 'submitted', ref: 're_same' });
    const b = f.insertRefund({ t: f.B, amount: 1000, status: 'submitted', ref: 're_same' });
    const beforeB = f.pay(f.B);
    await f.hook(f.A, { amount_refunded: 1000, refunds: { data: [{ id: 're_same', status: 'succeeded', amount: 1000, currency: 'aud' }] } });
    assert.equal(f.refund(a).status, 'completed');
    assert.equal(f.refund(b).status, 'submitted');
    assert.deepEqual(f.pay(f.B), beforeB);
    assert.equal(f.wo(f.B), 10000);
    // A webhook for tenant B signed with tenant A's secret is rejected.
    const forged = await f.hook({ ...f.B, secret: f.A.secret }, { amount_refunded: 1000 });
    assert.equal(forged.statusCode, 400);
    assert.deepEqual(f.pay(f.B), beforeB);
    // refundStripe refuses another tenant's payment before any provider call.
    await assert.rejects(f.payments.refundStripe(f.B.org, f.pay(f.A), 1000, 'k'), { status: 404 });
    assert.equal(f.refundCalls().length, 0);
    // executeRefund cannot run tenant A's refund row as tenant B.
    const foreign = f.insertRefund({ t: f.A, amount: 500 });
    await assert.rejects(f.finance.executeRefund(f.B.org, { refund_id: foreign }, APPROVER), /not found/i);
    assert.equal(f.refundCalls().length, 0);
  } finally { f.db.close(); }
});

// ---------- 3. duplicate, replayed, delayed and out-of-order events ----------
test('events: replay is ignored, older totals never reduce, partial and multiple refunds apply each delta once', async () => {
  const f = fixture();
  try {
    const e1 = 'evt_one';
    assert.equal((await f.hook(f.A, { amount_refunded: 1500 }, { eventId: e1 })).value.outcome, 'refunded');
    assert.equal((await f.hook(f.A, { amount_refunded: 1500 }, { eventId: e1 })).value.duplicate, true);
    await f.hook(f.A, { amount_refunded: 4000 });
    await f.hook(f.A, { amount_refunded: 1500 }); // delayed older event
    await f.hook(f.A, { amount_refunded: 0 });
    assert.equal(f.pay().refunded_cents, 4000);
    assert.equal(f.wo(), 6000);
    assert.equal(f.pay().status, 'paid');
    await f.hook(f.A, { amount_refunded: 10000 });
    assert.equal(f.pay().status, 'refunded');
    assert.equal(f.wo(), 0);
    assert.equal(f.audits('payment.refunded').length, 3, 'one audit per real delta');
  } finally { f.db.close(); }
});

// ---------- 4. malformed and ambiguous provider data on webhooks ----------
test('malformed webhook totals and currencies leave every balance unchanged', async () => {
  const f = fixture();
  try {
    const before = f.pay(), wo = f.wo();
    for (const object of [{ amount_refunded: '1000' }, { amount_refunded: -1 }, { amount_refunded: 1.5 }, { amount_refunded: null },
      { amount_refunded: undefined }, { amount_refunded: 1e20 }, { amount_refunded: 10001 }, { amount_refunded: 1000, currency: 'usd' },
      { amount_refunded: 1000, currency: null }, { amount_refunded: 1000, currency: 7 }]) {
      const r = await f.hook(f.A, object);
      assert.equal(r.statusCode, 200);
      assert.ok(['amount_precision_review', 'currency_mismatch'].includes(r.value.outcome), JSON.stringify(object) + ' -> ' + r.value.outcome);
      assert.deepEqual(f.pay(), before);
      assert.equal(f.wo(), wo);
    }
  } finally { f.db.close(); }
});

// ---------- 5. ambiguous refund responses, timeouts, network errors ----------
const AMBIGUOUS = [
  ['empty body', { body: {} }],
  ['unknown status', { body: (p) => ({ id: 're_x', status: 'unknown', amount: Number(p.get('amount')) }) }],
  ['wrong amount', { body: () => ({ id: 're_x', status: 'succeeded', amount: 999 }) }],
  ['missing id', { body: (p) => ({ status: 'succeeded', amount: Number(p.get('amount')) }) }],
  ['amount as string', { body: (p) => ({ id: 're_x', status: 'succeeded', amount: p.get('amount') }) }],
  ['HTTP 500', { ok: false, status: 500, body: { error: { message: 'synthetic server error' } } }],
  ['unclassified HTTP 400', { ok: false, status: 400, body: { error: { type: 'invalid_request_error' } } }],
  ['HTTP 409', { ok: false, status: 409, body: { error: { type: 'idempotency_error' } } }],
  ['HTTP 429', { ok: false, status: 429, body: { error: { message: 'synthetic rate limit' } } }],
  ['network failure / timeout', { throws: true }],
];
for (const [name, step] of AMBIGUOUS) {
  test(`ambiguous outcome (${name}) marks the request for reconciliation, changes no balance and blocks any second refund call`, async () => {
    const f = fixture();
    try {
      const first = f.insertRefund({ amount: 1000 });
      const queued = f.insertRefund({ amount: 2000 }); // a second request approved after the uncertain one
      f.plan.push(step);
      const before = f.pay(), wo = f.wo();
      await assert.rejects(f.exec(first), (e) => e.code === 'REFUND_RECONCILIATION_REQUIRED' && e.permanent === true && e.status === 502);
      assert.ok(isReview(f.refund(first)), 'marked for provider reconciliation');
      assert.deepEqual(f.pay(), before);
      assert.equal(f.wo(), wo);
      assert.equal(f.refundCalls().length, 1);
      await assert.rejects(f.exec(queued), /reconciliation/);
      assert.equal(f.refundCalls().length, 1, 'no second financial operation before reconciliation');
      assert.equal(f.refund(queued).status, 'pending_approval');
      // Re-running the uncertain request (engine retry) makes no provider call either.
      const again = await f.exec(first);
      assert.match(again.summary, /already submitted/);
      assert.equal(f.refundCalls().length, 1);
      const req = f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 100, reason: 'synthetic' });
      assert.equal(req.status, 409);
      const [mark] = f.audits('finance.refund_needs_review');
      assert.equal(mark.user_id, APPROVER, 'review mark attributed to the approver');
      assert.equal(mark.entity_id, first);
    } finally { f.db.close(); }
  });
}

test('F1: a recognised definitive Stripe rejection releases the reservation', async () => {
  const f = fixture();
  try {
    const id = f.insertRefund({ amount: 1000 });
    f.plan.push({ ok: false, status: 400, body: { error: { type: 'invalid_request_error', code: 'charge_already_refunded' } } });
    await assert.rejects(f.exec(id), { code: 'REFUND_REJECTED' });
    assert.equal(f.refund(id).status, 'failed');
    assert.equal(f.pay().refunded_cents, 0);
    assert.equal(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 100, reason: 'synthetic' }).ok, true);
  } finally { f.db.close(); }
});

// ---------- 6. reconciliation of an ambiguous refund (item 4) ----------
test('F1: an ambiguous refund that Stripe did complete is reconciled by its signed webhook, and refunds resume', async () => {
  const f = fixture();
  try {
    const id = f.insertRefund({ amount: 1000 });
    f.plan.push({ throws: true });
    await assert.rejects(f.exec(id));
    await f.hook(f.A, { amount_refunded: 1000, refunds: { data: [{ id: 're_real', status: 'succeeded', amount: 1000, currency: 'aud', metadata: { payment_id: f.A.payment, organisation_id: f.A.org, refund_request_id: id } }] } });
    assert.equal(f.pay().refunded_cents, 1000, 'ledger moved by the charge total');
    assert.equal(f.refund(id).status, 'completed', 'the uncertain request is reconciled');
    const next = f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 500, reason: 'synthetic' });
    assert.equal(next.ok, true, 'a later legitimate refund can be requested without database changes');
  } finally { f.db.close(); }
});

test('F1: empty read-only results alone keep a hold, an owner-recorded provider rejection resolves it', async () => {
  const f = fixture();
  try {
    const id = f.insertRefund({ amount: 1000 });
    f.plan.push({ throws: true });
    await assert.rejects(f.exec(id));
    f.db.prepare("UPDATE fin_stripe_refund_attempts SET started_at='2000-01-01' WHERE refund_id=?").run(id);
    assert.equal((await f.finance.reconcileStripeRefund(f.A.org, id, REQUESTER)).status, 403);
    f.plan.push({ body: { data: [], has_more: false } });
    assert.equal((await f.finance.reconcileStripeRefund(f.A.org, id, APPROVER)).status, 409);
    assert.ok(isReview(f.refund(id)));
    f.plan.push({ body: { data: [], has_more: false } });
    assert.deepEqual(await f.finance.reconcileStripeRefund(f.A.org, id, APPROVER, {
      evidence_reference: 'support-case-123', confirmed_provider_rejection: true,
    }), { ok: true, status: 'failed' });
    assert.equal(f.refundCalls().length, 1);
    assert.equal(f.audits('finance.refund_reconciled_rejection')[0].user_id, APPROVER);
    assert.equal(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 1000, reason: 'synthetic' }).ok, true);
  } finally { f.db.close(); }
});

test('characterisation of F1: after the provider confirms the refund the request stays locked and the amount stays reserved', async () => {
  const f = fixture();
  try {
    const id = f.insertRefund({ amount: 1000 });
    f.plan.push({ throws: true });
    await assert.rejects(f.exec(id));
    await f.hook(f.A, { amount_refunded: 1000, refunds: { data: [{ id: 're_real', status: 'succeeded', amount: 1000, currency: 'aud' }] } });
    assert.equal(f.pay().refunded_cents, 1000);
    assert.ok(isReview(f.refund(id)), 'still marked for review; provider_ref is never learned');
    assert.equal(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 500, reason: 'synthetic' }).status, 409);
    assert.equal(f.finance.completeManualRefund(f.A.org, id, APPROVER, 'manual').status, 409, 'the manual completion route does not accept it');
  } finally { f.db.close(); }
});

// ---------- 7. pending, succeeded, failed and cancelled refunds ----------
test('pending refund: submitted with its provider id, no balance change, completed by its exact receipt', async () => {
  const f = fixture();
  try {
    const id = f.insertRefund({ amount: 4000 });
    f.plan.push({ body: (p) => ({ id: 're_pending', status: 'pending', amount: Number(p.get('amount')) }) });
    const out = await f.exec(id);
    assert.match(out.summary, /submitted/);
    assert.equal(f.refund(id).status, 'submitted');
    assert.equal(f.refund(id).provider_ref, 're_pending');
    assert.equal(f.pay().refunded_cents, 0);
    await f.hook(f.A, { amount_refunded: 4000, refunds: { data: [{ id: 're_pending', status: 'succeeded', amount: 4000, currency: 'aud' }] } });
    assert.equal(f.refund(id).status, 'completed');
    assert.equal(f.pay().refunded_cents, 4000);
    assert.equal(f.wo(), 6000);
    // The remaining 60.00 can be refunded.
    assert.equal(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 6000, reason: 'synthetic' }).ok, true);
  } finally { f.db.close(); }
});

test('F2: independent refund event disambiguates a charge total without an embedded refund list', async () => {
  const f = fixture();
  try {
    const id = f.insertRefund({ amount: 4000 });
    f.plan.push({ body: (p) => ({ id: 're_pending', status: 'pending', amount: Number(p.get('amount')) }) });
    await f.exec(id);
    f.plan.push({ body: { has_more: false, data: [
      { id: 're_pending', payment_intent: 'pi_shared', status: 'succeeded', currency: 'aud', amount: 4000 },
    ] } });
    await f.hook(f.A, { amount_refunded: 4000 }); // no embedded list in this API version
    assert.ok(f.calls.some(call => call.url.includes('/v1/refunds?payment_intent=')));
    assert.equal(f.pay().refunded_cents, 4000);
    const receipt = { id: 're_pending', object: 'refund', status: 'succeeded', amount: 4000 };
    const delivery = { type: 'refund.updated', eventId: 'evt_exact' };
    assert.equal((await f.hook(f.A, receipt, delivery)).value.outcome, 'refund_completed');
    assert.equal((await f.hook(f.A, receipt, delivery)).value.duplicate, true);
    await f.hook(f.A, { ...receipt, status: 'pending' }, { type: 'refund.updated' });
    assert.equal(f.refund(id).status, 'completed');
    assert.equal(f.wo(), 6000);
    const r = f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 6000, reason: 'synthetic' });
    assert.equal(r.ok, true, 'the remaining 60.00 must be refundable; the 40.00 must not be counted both as refunded and as waiting');
  } finally { f.db.close(); }
});

test('F2: a pending refund that later fails at Stripe releases its reservation', async () => {
  const f = fixture();
  try {
    const id = f.insertRefund({ amount: 4000 });
    f.plan.push({ body: (p) => ({ id: 're_pending', status: 'pending', amount: Number(p.get('amount')) }) });
    await f.exec(id);
    const r = await f.hook(f.A, { id: 're_pending', object: 'refund', status: 'failed', amount: 4000, failure_reason: 'synthetic' }, { type: 'charge.refund.updated' });
    assert.equal(r.statusCode, 200);
    assert.notEqual(f.refund(id).status, 'submitted', 'the failed refund is no longer treated as waiting');
    assert.equal(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 10000, reason: 'synthetic' }).ok, true);
  } finally { f.db.close(); }
});

for (const status of ['failed', 'canceled']) test('F2: authoritative ' + status + ' releases an exact reservation without moving money', async () => {
  const f = fixture();
  try {
    const id = f.insertRefund({ amount: 4000 });
    f.plan.push({ body: { id: 're_terminal', status, amount: 4000 } });
    await f.exec(id);
    assert.equal(f.refund(id).status, status);
    assert.equal(f.pay().refunded_cents, 0);
    assert.equal(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 10000, reason: 'synthetic' }).ok, true);
  } finally { f.db.close(); }
});

// ---------- 8. ordering between the synchronous result and the webhook ----------
for (const order of ['webhook first', 'response first']) {
  test(`succeeded refund applies exactly once (${order})`, async () => {
    const f = fixture();
    try {
      const id = f.insertRefund({ amount: 2500 });
      if (order === 'webhook first') {
        f.plan.push({ delay: 30, body: (p) => ({ id: 're_ok', status: 'succeeded', amount: Number(p.get('amount')) }) });
        const running = f.exec(id);
        await sleep(5);
        await f.hook(f.A, { amount_refunded: 2500, refunds: { data: [{ id: 're_ok', status: 'succeeded', amount: 2500, currency: 'aud' }] } });
        await running;
      } else {
        f.plan.push({ body: (p) => ({ id: 're_ok', status: 'succeeded', amount: Number(p.get('amount')) }) });
        await f.exec(id);
        await f.hook(f.A, { amount_refunded: 2500, refunds: { data: [{ id: 're_ok', status: 'succeeded', amount: 2500, currency: 'aud' }] } });
      }
      assert.equal(f.pay().refunded_cents, 2500);
      assert.equal(f.wo(), 7500);
      assert.equal(f.refund(id).status, 'completed');
      const [sub] = f.audits('finance.refund_submitted');
      assert.equal(sub.user_id, APPROVER);
      assert.equal(JSON.parse(sub.metadata_json).provider_ref, 're_ok');
    } finally { f.db.close(); }
  });
}

// ---------- 9. concurrency ----------
test('the same refund executed twice concurrently sends one idempotency key and applies once', async () => {
  const f = fixture();
  try {
    const id = f.insertRefund({ amount: 3000 });
    f.plan.push({ delay: 30, body: (p) => ({ id: 're_same', status: 'succeeded', amount: Number(p.get('amount')) }) },
      { delay: 30, body: (p) => ({ id: 're_same', status: 'succeeded', amount: Number(p.get('amount')) }) });
    await Promise.all([f.exec(id), f.exec(id)]);
    assert.equal(f.refundCalls().length, 1);
    const keys = new Set(f.refundCalls().map((c) => c.idem));
    assert.deepEqual([...keys], [`sp-refund-${id}`], 'every provider call for one request carries the same idempotency key');
    assert.equal(f.pay().refunded_cents, 3000);
    assert.equal(f.wo(), 7000);
  } finally { f.db.close(); }
});

test('F3: two different refunds executing concurrently are both counted', async () => {
  const f = fixture();
  try {
    const a = f.insertRefund({ amount: 3000 }), b = f.insertRefund({ amount: 2000 });
    f.plan.push({ delay: 30, body: (p) => ({ id: 're_a', status: 'succeeded', amount: Number(p.get('amount')) }) },
      { delay: 60, body: (p) => ({ id: 're_b', status: 'succeeded', amount: Number(p.get('amount')) }) });
    await Promise.all([f.exec(a), f.exec(b)]);
    assert.equal(f.pay().refunded_cents, 5000);
    assert.equal(f.wo(), 5000);
  } finally { f.db.close(); }
});

test('F3: a charge total after two exact receipts never applies them twice', async () => {
  const f = fixture();
  try {
    const a = f.insertRefund({ amount: 3000 }), b = f.insertRefund({ amount: 2000 });
    f.plan.push({ delay: 30, body: (p) => ({ id: 're_a', status: 'succeeded', amount: Number(p.get('amount')) }) },
      { delay: 60, body: (p) => ({ id: 're_b', status: 'succeeded', amount: Number(p.get('amount')) }) });
    await Promise.all([f.exec(a), f.exec(b)]);
    assert.equal(f.pay().refunded_cents, 5000);
    await f.hook(f.A, { amount_refunded: 5000 });
    assert.equal(f.pay().refunded_cents, 5000);
    assert.equal(f.wo(), 5000);
  } finally { f.db.close(); }
});

test('over-refund is refused: requests cannot exceed paid minus refunded minus waiting', async () => {
  const f = fixture();
  try {
    assert.equal(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 6000, reason: 's' }).ok, true);
    assert.equal(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 4001, reason: 's' }).status, 400);
    assert.equal(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 4000, reason: 's' }).ok, true);
    assert.equal(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 1, reason: 's' }).status, 400);
    for (const bad of [0, -1, 1.5, NaN]) assert.notEqual(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: bad, reason: 's' }).ok, true);
    assert.equal(f.finance.requestRefund(f.B.org, f.A.payment, REQUESTER, { amount_cents: 1, reason: 's' }).status, 404, 'another tenant cannot request it');
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM fin_refunds').get().n, 2);
  } finally { f.db.close(); }
});

// ---------- 10. historical inexact ledger totals ----------
test('historical inexact totals: no provider call, no balance change', async () => {
  const f = fixture({ currency: 'jpy', amount: 10000 });
  try {
    f.db.prepare('UPDATE job_payments SET refunded_cents=5050 WHERE id=?').run(f.A.payment);
    const id = f.insertRefund({ amount: 1000 });
    const before = f.pay();
    await assert.rejects(f.exec(id), /precision|whole/i);
    assert.equal(f.refundCalls().length, 0);
    assert.deepEqual(f.pay(), before);
    assert.equal((await f.hook(f.A, { amount_refunded: 60 })).value.outcome, 'amount_precision_review');
    assert.deepEqual(f.pay(), before);
  } finally { f.db.close(); }
});

// ---------- 11. transaction atomicity and safe recovery ----------
test('webhook ledger update is atomic: a failed write changes nothing and the same event can be replayed', async () => {
  const f = fixture();
  try {
    f.db.exec("CREATE TRIGGER fail_wo BEFORE UPDATE ON work_orders BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
    const before = f.pay();
    const r = await f.hook(f.A, { amount_refunded: 2000 }, { eventId: 'evt_retry' });
    assert.equal(r.statusCode, 500);
    assert.deepEqual(f.pay(), before, 'payment unchanged: the work-order failure rolled it back');
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM payment_events WHERE event_id='evt_retry'").get().n, 0, 'event released for redelivery');
    f.db.exec('DROP TRIGGER fail_wo');
    assert.equal((await f.hook(f.A, { amount_refunded: 2000 }, { eventId: 'evt_retry' })).value.outcome, 'refunded');
    assert.equal(f.pay().refunded_cents, 2000);
    assert.equal(f.wo(), 8000);
  } finally { f.db.close(); }
});

test('F4: an injected work-order failure rolls back both balances and status, then recovers without another POST', async () => {
  const f = fixture();
  try {
    const id = f.insertRefund({ amount: 2000 });
    f.db.exec("CREATE TRIGGER fail_job BEFORE UPDATE OF paid_cents ON work_orders BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
    await assert.rejects(f.exec(id), /synthetic failure/);
    assert.equal(f.refund(id).status, 'submitted');
    assert.equal(f.pay().refunded_cents, 0);
    assert.equal(f.wo(), 10000);
    assert.ok(f.db.prepare('SELECT receipt_json FROM fin_stripe_refund_attempts WHERE refund_id=?').get(id).receipt_json);
    f.db.exec('DROP TRIGGER fail_job');
    await f.exec(id);
    assert.equal(f.refund(id).status, 'completed');
    assert.equal(f.pay().refunded_cents, 2000);
    assert.equal(f.wo(), 8000);
    assert.equal(f.refundCalls().length, 1);
  } finally { f.db.close(); }
});

// ---------- 12. end to end through the real server and approval engine ----------
test('end to end: network failure on an approved refund holds the payment; no second provider call; an exact signed receipt releases it (F1)', async (t) => {
  const { startServer } = await import('../../scripts/test-server.mjs');
  const { seedOwner } = await import('../../scripts/visual/session.mjs');
  const fake = (prefix) => prefix + crypto.randomBytes(12).toString('hex');
  const BIZ_KEY = fake(['sk', 'test', ''].join('_')), WHSEC = fake('whsec_');
  const calls = [];
  const stripe = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => {
      calls.push({ path: req.url, idem: req.headers['idempotency-key'] });
      if (req.method === 'POST' && req.url === '/v1/refunds') return req.socket.destroy();
      if (req.method === 'GET' && req.url.startsWith('/v1/refunds?')) {
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ data: [], has_more: false }));
      }
      res.writeHead(404); res.end('{}');
    });
  });
  await new Promise((r) => stripe.listen(0, '127.0.0.1', r));
  const s = await startServer({ STRIPE_API_BASE_URL: `http://127.0.0.1:${stripe.address().port}` });
  t.after(async () => { await s.stop(); await new Promise((r) => stripe.close(r)); });
  const owner = await seedOwner(s, { business: 'Synthetic Refund Review Pty Ltd' });
  const O = (m, u, b) => s.call(m, u, { cookie: owner.cookie, body: b });
  const sql = (q, ...a) => { const d = new Database(s.dbPath); try { return /^\s*select/i.test(q) ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } };
  let r = await O('PUT', '/api/saas/payments/settings', { stripe_secret_key: BIZ_KEY, stripe_webhook_secret: WHSEC, terms_days: 14 });
  assert.equal(r.status, 200, r.text);
  for (const pr of (await O('GET', '/api/saas/billing/setup')).json.providers.filter((x) => x.id === 'stripe')) {
    const a = await O('POST', '/api/saas/billing/authorise', { provider: pr.id, confirmed: pr.statements.map((x) => x.key || x.id || x[0]) });
    assert.equal(a.status, 200, a.text);
  }
  const at = new Date().toISOString(), jobId = crypto.randomUUID(), payment = crypto.randomUUID();
  sql("INSERT INTO work_orders(id,organisation_id,title,start_at,required_skills,status,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,'[]','completed',10000,10000,?,?)", jobId, owner.org, 'Synthetic job', at, at, at);
  sql("INSERT INTO job_payments (id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',10000,'aud','pi_e2e',?,?)", payment, owner.org, jobId, at, at);
  const approve = async (runId) => {
    await sleep(50);
    const ap = (await O('GET', '/api/saas/approvals')).json.approvals.find((a) => a.automation_run_id === runId);
    assert.ok(ap);
    const d = await O('POST', `/api/saas/approvals/${ap.id}/decision`, { decision: 'approve' });
    assert.equal(d.status, 200, d.text);
    await sleep(600);
  };
  const route = `/api/saas/finance/payments/${payment}/refund`;
  const first = await O('POST', route, { amount: 10, reason: 'Synthetic network failure' });
  assert.equal(first.status, 201, first.text);
  const second = await O('POST', route, { amount: 20, reason: 'Synthetic second request queued before the outcome is known' });
  assert.equal(second.status, 201, second.text);
  await approve(first.json.run_id);
  const [held] = sql('SELECT status,provider_ref,error FROM fin_refunds WHERE id=?', first.json.refund_id);
  assert.equal(held.status, 'submitted');
  assert.equal(held.provider_ref, null);
  assert.match(held.error, /Reconcile/);
  await approve(second.json.run_id);
  assert.equal(calls.filter((c) => c.path === '/v1/refunds').length, 1, 'the queued second refund made no provider call');
  assert.equal(sql('SELECT status FROM fin_refunds WHERE id=?', second.json.refund_id)[0].status, 'pending_approval');
  assert.equal((await O('POST', route, { amount: 5, reason: 'Synthetic third' })).status, 409);
  assert.equal(sql('SELECT refunded_cents FROM job_payments WHERE id=?', payment)[0].refunded_cents, 0);
  assert.equal(sql('SELECT paid_cents FROM work_orders WHERE id=?', jobId)[0].paid_cents, 10000);
  for (const runId of [first.json.run_id, second.json.run_id]) {
    const [run] = sql('SELECT status,approver_id FROM automation_runs WHERE id=?', runId);
    assert.equal(run.status, 'failed', 'a held refund run ends failed, not completed');
    assert.ok(run.approver_id, 'the run records who approved it');
    const [mark] = sql("SELECT user_id FROM audit_logs WHERE action IN ('finance.refund_needs_review') AND entity_id=?", first.json.refund_id);
    assert.equal(mark?.user_id, run.approver_id, 'the review mark is attributed to the approving person');
  }
  const reconcileRoute = `/api/saas/finance/refunds/${first.json.refund_id}/reconcile`;
  assert.equal((await s.call('POST', reconcileRoute, { body: {} })).status, 401);
  assert.equal((await O('POST', reconcileRoute, {})).status, 409);
  assert.equal(calls.filter(call => call.path === '/v1/refunds').length, 1);
  // The signed exact receipt now resolves the otherwise held request.
  const event = { id: 'evt_' + crypto.randomUUID(), type: 'charge.refunded', data: { object: { payment_intent: 'pi_e2e', amount_refunded: 1000, currency: 'aud', refunds: { data: [{ id: 're_e2e', status: 'succeeded', amount: 1000, currency: 'aud', metadata: { refund_request_id: first.json.refund_id, payment_id: payment, organisation_id: owner.org } }] } } } };
  const body = JSON.stringify(event), ts = Math.floor(Date.now() / 1000), sig = crypto.createHmac('sha256', WHSEC).update(`${ts}.${body}`).digest('hex');
  const hookRes = await fetch(`${s.base}/api/webhooks/payments/stripe/${owner.org}`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` }, body });
  assert.equal(hookRes.status, 200);
  assert.equal(sql('SELECT refunded_cents FROM job_payments WHERE id=?', payment)[0].refunded_cents, 1000);
  assert.equal(sql('SELECT paid_cents FROM work_orders WHERE id=?', jobId)[0].paid_cents, 9000);
  assert.equal(sql('SELECT status FROM fin_refunds WHERE id=?', first.json.refund_id)[0].status, 'completed');
  assert.equal((await O('POST', route, { amount: 5, reason: 'Synthetic after receipt' })).status, 201);
});

const workerSource = `
  import Database from 'better-sqlite3';
  import { installPayments } from './src/payments.js';
  import { createFinance } from './src/finance/service.js';
  const [file, base, org, id, actor] = process.argv.slice(1);
  const db = new Database(file);
  const app = { get() {}, post() {}, put() {}, patch() {}, delete() {} };
  const payments = installPayments(app, {
    db, env: { STRIPE_API_BASE_URL: base }, runtime: { decryptBundle: v => ({ v }) },
    requireSaasUser() {}, requireSaasRole: () => () => {}, saasAudit() {}, financeRoles: ['owner'], syncJobFinance() {},
  });
  const finance = createFinance({ db, payments });
  try {
    await finance.executeRefund(org, { refund_id: id }, actor);
  } finally { db.close(); }
`;

function worker(file, base, org, id) {
  const processHandle = spawn(process.execPath, ['--input-type=module', '-e', workerSource, file, base, org, id, APPROVER],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  processHandle.stderr.on('data', data => { stderr += data; });
  const result = new Promise((resolve, reject) => {
    processHandle.once('error', reject);
    processHandle.once('close', (code, signal) => resolve({ code, signal, stderr }));
  });
  return { processHandle, result };
}

async function processFixture(t, onPost) {
  const dir = mkdtempSync(join(tmpdir(), 'oprun-refund-process-'));
  const file = join(dir, 'synthetic.sqlite');
  const f = fixture({ filename: file });
  const children = [];
  const posts = [];
  const provider = http.createServer(async (req, res) => {
    const parts = [];
    for await (const chunk of req) parts.push(chunk);
    if (req.method !== 'POST' || req.url !== '/v1/refunds') { res.writeHead(404).end(); return; }
    const params = new URLSearchParams(Buffer.concat(parts).toString());
    const request = {
      id: 're_' + (posts.length + 1), status: 'succeeded', amount: Number(params.get('amount')),
      currency: 'aud', payment_intent: params.get('payment_intent'),
      metadata: {
        payment_id: params.get('metadata[payment_id]'), organisation_id: params.get('metadata[organisation_id]'),
        refund_request_id: params.get('metadata[refund_request_id]'),
      },
    };
    posts.push(request);
    await onPost(posts, res);
    if (!res.destroyed) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(request));
    }
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    for (const child of children) child.processHandle.kill('SIGKILL');
    await Promise.allSettled(children.map(child => child.result));
    provider.closeAllConnections();
    await new Promise(resolve => provider.close(resolve));
    f.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    ...f, posts,
    run(id) {
      const child = worker(file, `http://127.0.0.1:${provider.address().port}`, f.A.org, id);
      children.push(child);
      return child;
    },
  };
}

test('F3: independent processes overlap two refunds and send one POST per approved request', { timeout: 15000 }, async t => {
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const f = await processFixture(t, async posts => {
    if (posts.length === 2) release();
    await barrier;
  });
  const a = f.insertRefund({ amount: 3000 }), b = f.insertRefund({ amount: 2000 });
  const runs = [f.run(a), f.run(b), f.run(a)];
  const results = await Promise.all(runs.map(run => run.result));
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  assert.equal(f.posts.length, 2);
  assert.deepEqual(f.posts.map(item => item.metadata.refund_request_id).sort(), [a, b].sort());
  assert.equal(f.pay().refunded_cents, 5000);
  assert.equal(f.wo(), 5000);
  assert.equal(f.refund(a).status, 'completed');
  assert.equal(f.refund(b).status, 'completed');
  assert.equal(f.finance.requestRefund(f.A.org, f.A.payment, REQUESTER, { amount_cents: 5001, reason: 'synthetic' }).ok, false);
});

test('F4: process interruption after provider acceptance recovers by read-only reconciliation', { timeout: 15000 }, async t => {
  let observed;
  const accepted = new Promise(resolve => { observed = resolve; });
  const f = await processFixture(t, async (posts, response) => {
    observed(posts[0]);
    await new Promise(resolve => response.once('close', resolve));
  });
  const id = f.insertRefund({ amount: 2500 });
  const child = f.run(id);
  const receipt = await accepted;
  child.processHandle.kill('SIGKILL');
  assert.equal((await child.result).signal, 'SIGKILL');
  assert.equal(f.refund(id).status, 'submitted');
  assert.equal(f.pay().refunded_cents, 0);
  assert.equal(f.wo(), 10000);
  assert.equal((await f.run(id).result).code, 0);
  assert.equal(f.posts.length, 1);
  assert.equal((await f.finance.reconcileStripeRefund(f.B.org, id, APPROVER)).status, 404);
  f.plan.push({ body: { data: [{ ...receipt, metadata: { ...receipt.metadata, payment_id: f.B.payment } }], has_more: false } });
  await assert.rejects(f.finance.reconcileStripeRefund(f.A.org, id, APPROVER), /does not match/);
  assert.equal(f.refund(id).status, 'submitted');
  f.plan.push({ body: { data: [receipt], has_more: false } });
  assert.deepEqual(await f.finance.reconcileStripeRefund(f.A.org, id, APPROVER), { ok: true, status: 'completed' });
  assert.equal(f.posts.length, 1);
  assert.equal(f.pay().refunded_cents, 2500);
  assert.equal(f.wo(), 7500);
});

test('F1: an already held legacy refund can be linked with exact provider and owner evidence', async () => {
  const f = fixture();
  try {
    const id = f.insertRefund({ amount: 2000, status: 'submitted', error: 'Historical uncertainty' });
    const receipt = { id: 're_legacy', payment_intent: 'pi_shared', amount: 2000, currency: 'aud', status: 'succeeded',
      metadata: { organisation_id: f.A.org, payment_id: f.A.payment } };
    const evidence = { evidence_reference: 'verified-case-123', legacy_refund_id: receipt.id };
    f.plan.push({ body: { data: [{ ...receipt, amount: 1999 }], has_more: false } });
    assert.equal((await f.finance.reconcileStripeRefund(f.A.org, id, APPROVER, evidence)).status, 409);
    assert.ok(isReview(f.refund(id)));
    f.plan.push({ body: { data: [receipt], has_more: false } });
    assert.deepEqual(await f.finance.reconcileStripeRefund(f.A.org, id, APPROVER, evidence), { ok: true, status: 'completed' });
    assert.equal(f.refund(id).provider_ref, receipt.id);
    assert.equal(f.pay().refunded_cents, 2000);
    assert.equal(f.wo(), 8000);
    assert.equal(f.refundCalls().length, 0);
  } finally { f.db.close(); }
});

test('F3: separate processes cannot dispatch approvals whose combined amount exceeds the payment', { timeout: 15000 }, async t => {
  const f = await processFixture(t, async () => sleep(150));
  const a = f.insertRefund({ amount: 6000 }), b = f.insertRefund({ amount: 6000 });
  const results = await Promise.all([f.run(a).result, f.run(b).result]);
  assert.deepEqual(results.map(result => result.code).sort(), [0, 1]);
  assert.match(results.find(result => result.code === 1).stderr, /exceeds the available payment balance/);
  assert.equal(f.posts.length, 1);
  assert.equal(f.pay().refunded_cents, 6000);
  assert.equal(f.wo(), 4000);
});
