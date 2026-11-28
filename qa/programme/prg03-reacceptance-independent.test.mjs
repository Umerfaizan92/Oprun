// PRG-03 independent financial RE-ACCEPTANCE (Claude). Candidate 09fcd0b (published 3d00fec), Codex's F1–F4 corrections.
// MANDATORY: no todo and no skip. Every test asserts required behaviour; a failure means the requirement is not met.
// Synthetic data only: throwaway SQLite, a programmable in-process Stripe stand-in, a loopback HTTP stand-in for the
// multi-process cases, synthetic signed webhooks. No provider account. Run explicitly:
//   node --test --test-concurrency=1 qa/programme/prg03-reacceptance-independent.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDb } from '../../src/db.js';
import { installPayments } from '../../src/payments.js';
import { createFinance } from '../../src/finance/service.js';

const OWNER = 'synthetic-owner', ADMIN = 'synthetic-admin', REQUESTER = 'synthetic-requester';
const WORKER = fileURLToPath(new URL('./prg03-reacceptance-worker.mjs', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- fixture ----------
function seed(db, { amount, currency, reference }) {
  db.exec('ALTER TABLE job_payments ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE TABLE IF NOT EXISTS tenant_documents(id TEXT PRIMARY KEY,organisation_id TEXT)');
  const now = new Date().toISOString(), tenants = {};
  for (const user of [OWNER, ADMIN]) db.prepare("INSERT INTO users(id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,'x','x',?,?)").run(user, user + '@example.test', user, now, now);
  for (const name of ['A', 'B']) {
    const org = crypto.randomUUID(), job = crypto.randomUUID(), payment = crypto.randomUUID(), secret = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(org, 'Tenant ' + name, org, now, now);
    db.prepare("INSERT INTO payment_settings(organisation_id,stripe_secret_enc,stripe_webhook_enc,updated_at) VALUES (?,?,?,?)").run(org, 'sk-synthetic-' + name, secret, now);
    db.prepare('INSERT INTO work_orders(id,organisation_id,title,start_at,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(job, org, 'Synthetic job', now, amount, amount, now, now);
    db.prepare("INSERT INTO job_payments(id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',?,?,?,?,?)").run(payment, org, job, amount, currency, reference, now, now);
    tenants[name] = { org, job, payment, secret };
  }
  db.prepare("INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES (?,?,'owner',?)").run(tenants.A.org, OWNER, now);
  db.prepare("INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES (?,?,'admin',?)").run(tenants.A.org, ADMIN, now);
  return tenants;
}
function fixture({ currency = 'aud', amount = 10000, reference = 'pi_synthetic', file = ':memory:' } = {}) {
  const db = createDb(file), routes = new Map(), calls = [];
  const { A, B } = seed(db, { amount, currency, reference });
  const app = Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map((m) => [m, (p, ...h) => routes.set(m + ' ' + p, h.at(-1))]));
  const stripe = { posts: [], plan: [], refunds: [], pages: null, listFails: false };
  // Stripe stand-in: POST /v1/refunds follows `plan` (default: succeeded echo, recorded in `refunds`);
  // GET /v1/refunds lists `refunds` newest first, or `pages` when set.
  const fetchImpl = async (url, options) => {
    const u = new URL(url), method = options.method || 'GET';
    calls.push({ method, path: u.pathname, query: u.search, auth: options.headers?.authorization });
    if (method === 'POST' && u.pathname === '/v1/refunds') {
      const p = new URLSearchParams(options.body);
      const post = { idem: options.headers['idempotency-key'], amount: Number(p.get('amount')), request: p.get('metadata[refund_request_id]'), org: p.get('metadata[organisation_id]'), payment: p.get('metadata[payment_id]'), pi: p.get('payment_intent') };
      stripe.posts.push(post);
      const step = stripe.plan.shift() || {};
      const made = { id: step.id || 're_' + crypto.createHash('sha1').update(post.idem).digest('hex').slice(0, 12), object: 'refund', amount: post.amount, currency, payment_intent: post.pi, status: step.status || 'succeeded', metadata: { organisation_id: post.org, payment_id: post.payment, refund_request_id: post.request } };
      if (step.create !== false) stripe.refunds.unshift(made);
      if (step.throws) throw new Error('synthetic socket reset');
      if (step.error) return { ok: false, status: step.error.status, json: async () => ({ error: step.error.body }) };
      return { ok: true, status: 200, json: async () => (step.body ?? made) };
    }
    if (method === 'GET' && u.pathname === '/v1/refunds') {
      if (stripe.listFails) throw new Error('synthetic list outage');
      if (stripe.pages) { const page = stripe.pages.shift(); return { ok: true, status: 200, json: async () => page }; }
      const after = u.searchParams.get('starting_after'), all = stripe.refunds.filter((r) => r.payment_intent === u.searchParams.get('payment_intent'));
      const start = after ? all.findIndex((r) => r.id === after) + 1 : 0, data = all.slice(start, start + 100);
      return { ok: true, status: 200, json: async () => ({ object: 'list', has_more: start + 100 < all.length, data }) };
    }
    return { ok: false, status: 404, json: async () => ({ error: { type: 'invalid_request_error', code: 'resource_missing' } }) };
  };
  const payments = installPayments(app, { db, env: {}, runtime: { decryptBundle: (v) => ({ v }) }, requireSaasUser() {}, requireSaasRole: () => () => {}, saasAudit() {}, financeRoles: ['owner'], syncJobFinance() {}, fetchImpl });
  const finance = createFinance({ db, payments, engineRef: { current: { startRun: () => ({ id: crypto.randomUUID(), promise: Promise.resolve() }) } } });
  const q = (sql, ...a) => db.prepare(sql).get(...a);
  const f = {
    db, A, B, stripe, calls, finance, payments, currency, reference,
    pay: (t = A) => q('SELECT * FROM job_payments WHERE id=?', t.payment),
    paid: (t = A) => q('SELECT paid_cents FROM work_orders WHERE id=?', t.job).paid_cents,
    refund: (id) => q('SELECT * FROM fin_refunds WHERE id=?', id),
    request: (amount, t = A) => { const r = finance.requestRefund(t.org, t.payment, REQUESTER, { amount_cents: amount, reason: 'synthetic' }); return r; },
    exec: (id, t = A, who = OWNER) => finance.executeRefund(t.org, { refund_id: id }, who),
    reconcile: (id, body = {}, who = OWNER, t = A) => finance.reconcileStripeRefund(t.org, id, who, body),
    age: (id) => db.prepare("UPDATE fin_stripe_refund_attempts SET started_at='2000-01-01T00:00:00.000Z' WHERE refund_id=?").run(id),
    audits: (action) => db.prepare('SELECT user_id,entity_id,metadata_json FROM audit_logs WHERE action=? ORDER BY rowid').all(action),
    rotate: (t = A) => db.prepare('UPDATE payment_settings SET stripe_secret_enc=? WHERE organisation_id=?').run('sk-rotated-' + crypto.randomUUID(), t.org),
    hook: async (t, type, object, eventId = 'evt_' + crypto.randomUUID(), extra = {}) => {
      const event = { id: eventId, type, data: { object }, ...extra };
      const rawBody = JSON.stringify(event), ts = Math.floor(Date.now() / 1000), sig = crypto.createHmac('sha256', t.secret).update(`${ts}.${rawBody}`).digest('hex');
      const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.value = v; return this; } };
      await routes.get('post /api/webhooks/payments/stripe/:orgId')({ params: { orgId: t.org }, body: event, rawBody, get: () => `t=${ts},v1=${sig}` }, res);
      return res;
    },
  };
  f.newRefund = (amount, t = A) => { const r = f.request(amount, t); assert.equal(r.ok, true, JSON.stringify(r)); return r.refund_id; };
  f.chargeRefunded = (total, extra = {}) => f.hook(A, 'charge.refunded', { object: 'charge', payment_intent: reference, amount_refunded: total, currency, ...extra });
  f.refundEvent = (type, r, eventId) => f.hook(A, type, { object: 'refund', currency, payment_intent: reference, ...r }, eventId);
  return f;
}
const held = (r) => r.status === 'submitted' && r.provider_ref === null;

// ================= F1 — reconciliation =================
test('F1 classification: only the allow-listed structured 400 rejections are definitive; everything else stays held with no second POST', async () => {
  for (const code of ['charge_already_refunded', 'amount_too_large', 'resource_missing', 'parameter_invalid_integer']) {
    const f = fixture();
    try {
      const id = f.newRefund(1000);
      f.stripe.plan.push({ create: false, error: { status: 400, body: { type: 'invalid_request_error', code } } });
      await assert.rejects(f.exec(id), { code: 'REFUND_REJECTED' });
      assert.equal(f.refund(id).status, 'failed', code);
      assert.deepEqual([f.pay().refunded_cents, f.paid()], [0, 10000]);
      assert.equal(f.audits('finance.refund_rejected')[0].user_id, OWNER);
      assert.equal(f.request(10000).ok, true, 'reservation released: the full amount is refundable again');
    } finally { f.db.close(); }
  }
  const uncertain = [
    ['400 without code', 400, { type: 'invalid_request_error' }], ['400 card_error', 400, { type: 'card_error', code: 'charge_already_refunded' }],
    ['400 idempotency_error', 400, { type: 'idempotency_error', code: 'idempotency_key_in_use' }], ['400 other code', 400, { type: 'invalid_request_error', code: 'charge_disputed' }],
    ['402', 402, { type: 'invalid_request_error', code: 'amount_too_large' }], ['404 resource_missing', 404, { type: 'invalid_request_error', code: 'resource_missing' }],
    ['409', 409, { type: 'idempotency_error', code: 'idempotency_key_in_use' }], ['429', 429, { type: 'invalid_request_error', code: 'rate_limit' }],
    ['401', 401, { type: 'invalid_request_error' }], ['500', 500, { type: 'api_error' }],
  ];
  for (const [label, status, body] of uncertain) {
    const f = fixture();
    try {
      const id = f.newRefund(1000), second = f.newRefund(2000);
      f.stripe.plan.push({ create: false, error: { status, body } });
      await assert.rejects(f.exec(id), { code: 'REFUND_RECONCILIATION_REQUIRED' }, label);
      assert.ok(held(f.refund(id)), label + ': held');
      await assert.rejects(f.exec(second), /reconciliation/, label + ': second approved refund blocked');
      assert.equal(f.request(100).status, 409, label + ': new request blocked');
      assert.equal(f.stripe.posts.length, 1, label + ': exactly one financial POST');
      assert.deepEqual([f.pay().refunded_cents, f.paid()], [0, 10000]);
    } finally { f.db.close(); }
  }
});

test('F1: an uncertain refund that Stripe completed is recovered by the owner reconcile route from exact evidence; no second POST', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(2500);
    f.stripe.plan.push({ throws: true }); // Stripe made the refund, the response was lost
    await assert.rejects(f.exec(id));
    assert.ok(held(f.refund(id)));
    assert.equal((await f.reconcile(id, {}, ADMIN)).status, 403, 'admin refused');
    assert.equal((await f.reconcile(id, {}, OWNER, f.B)).status, 404, 'other tenant cannot see it');
    const r = await f.reconcile(id);
    assert.deepEqual(r, { ok: true, status: 'completed' });
    assert.equal(f.refund(id).provider_ref, f.stripe.refunds[0].id);
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [2500, 7500]);
    assert.equal(f.stripe.posts.length, 1);
    assert.equal(f.audits('finance.refund_reconciled')[0].user_id, OWNER);
    assert.equal(f.request(7500).ok, true, 'remaining balance refundable');
    assert.deepEqual(await f.reconcile(id), { ok: true, status: 'completed' }, 'repeat reconcile is idempotent');
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [2500, 7500], 'no double accounting');
  } finally { f.db.close(); }
});

test('F1: the same uncertain refund is also recovered automatically by a signed charge aggregate without an embedded list', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(2500);
    f.stripe.plan.push({ throws: true });
    await assert.rejects(f.exec(id));
    assert.equal((await f.chargeRefunded(2500)).statusCode, 200);
    assert.equal(f.refund(id).status, 'completed');
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [2500, 7500]);
    assert.equal(f.stripe.posts.length, 1);
    assert.equal(f.request(7500).ok, true);
  } finally { f.db.close(); }
});

test('F1: an uncertain refund Stripe never made: empty evidence never releases alone; owner attestation does only after the window', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(2500);
    f.stripe.plan.push({ throws: true, create: false });
    await assert.rejects(f.exec(id));
    assert.equal((await f.reconcile(id)).status, 409, 'complete empty list alone keeps the hold');
    assert.equal((await f.reconcile(id, { evidence_reference: 'case-0001-x', confirmed_provider_rejection: true })).status, 409, 'inside the in-flight window');
    f.age(id);
    assert.equal((await f.reconcile(id, { confirmed_provider_rejection: true })).status, 409, 'attestation needs an evidence reference');
    assert.equal((await f.reconcile(id, { evidence_reference: 'case-0001-x', confirmed_provider_rejection: true }, ADMIN)).status, 403);
    assert.deepEqual(await f.reconcile(id, { evidence_reference: 'case-0001-x', confirmed_provider_rejection: true }), { ok: true, status: 'failed' });
    const [a] = f.audits('finance.refund_reconciled_rejection');
    assert.equal(a.user_id, OWNER);
    assert.equal(JSON.parse(a.metadata_json).evidence_reference, 'case-0001-x');
    assert.equal(f.request(10000).ok, true);
    assert.equal(f.stripe.posts.length, 1);
  } finally { f.db.close(); }
});

test('F1: a false owner attestation cannot override provider evidence, and unattributed same-amount evidence blocks it', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(2500);
    f.stripe.plan.push({ throws: true }); // Stripe DID make it
    await assert.rejects(f.exec(id));
    f.age(id);
    const r = await f.reconcile(id, { evidence_reference: 'false-claim-1', confirmed_provider_rejection: true });
    assert.deepEqual(r, { ok: true, status: 'completed' }, 'the exact provider record wins over the attestation');
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [2500, 7500]);
    assert.equal(f.audits('finance.refund_reconciled_rejection').length, 0);
  } finally { f.db.close(); }
  const g = fixture();
  try {
    const id = g.newRefund(2500);
    g.stripe.plan.push({ throws: true, create: false });
    await assert.rejects(g.exec(id));
    g.stripe.refunds.unshift({ id: 're_dashboard', object: 'refund', amount: 2500, currency: 'aud', payment_intent: g.reference, status: 'succeeded', metadata: {} });
    g.age(id);
    assert.equal((await g.reconcile(id, { evidence_reference: 'claim-xyz-1', confirmed_provider_rejection: true })).status, 409, 'same-amount refund without attribution blocks release');
    assert.ok(held(g.refund(id)));
  } finally { g.db.close(); }
});

test('F1: evidence must match tenant, payment, request, currency, amount and payment intent exactly', async () => {
  const mutations = [['other tenant', { metadata: { organisation_id: 'other' } }], ['other payment', { metadata: { payment_id: 'other' } }],
    ['other amount', { amount: 2400 }], ['other currency', { currency: 'nzd' }], ['other payment intent', { payment_intent: 'pi_other' }]];
  for (const [label, change] of mutations) {
    const f = fixture();
    try {
      const id = f.newRefund(2500);
      f.stripe.plan.push({ throws: true });
      await assert.rejects(f.exec(id));
      const made = f.stripe.refunds[0];
      Object.assign(made, { ...change, metadata: { ...made.metadata, ...(change.metadata || {}) } });
      // Refusal may be returned (409) or thrown with status 409; the route maps both to HTTP 409.
      const r = await f.reconcile(id).catch((e) => ({ ok: false, status: e.status }));
      assert.deepEqual([r.ok, r.status], [false, 409], label);
      assert.ok(held(f.refund(id)), label + ': still held');
      assert.deepEqual([f.pay().refunded_cents, f.paid()], [0, 10000], label);
      assert.equal(f.stripe.posts.length, 1);
    } finally { f.db.close(); }
  }
});

test('F1: pagination is followed to the end; incomplete, malformed or looping lists never release or apply', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(1000);
    f.stripe.plan.push({ throws: true });
    await assert.rejects(f.exec(id));
    const mine = f.stripe.refunds.shift();
    for (let i = 0; i < 150; i++) f.stripe.refunds.push({ id: 're_old_' + i, object: 'refund', amount: 1, currency: 'aud', payment_intent: f.reference, status: 'failed', metadata: {} });
    f.stripe.refunds.push(mine); // on page 2
    assert.deepEqual(await f.reconcile(id), { ok: true, status: 'completed' });
  } finally { f.db.close(); }
  for (const [label, pages] of [
    ['has_more without data', [{ has_more: true }]], ['missing has_more', [{ data: [] }]],
    ['looping cursor', Array.from({ length: 25 }, () => ({ has_more: true, data: [{ id: 're_loop', object: 'refund', amount: 1, currency: 'aud', payment_intent: 'pi_synthetic', status: 'failed' }] }))],
    ['malformed entry', [{ has_more: false, data: [{ id: 're_x', amount: '1000', currency: 'aud', payment_intent: 'pi_synthetic', status: 'succeeded' }] }]],
    ['unknown status', [{ has_more: false, data: [{ id: 're_x', amount: 1000, currency: 'aud', payment_intent: 'pi_synthetic', status: 'weird' }] }]],
  ]) {
    const g = fixture();
    try {
      const id = g.newRefund(1000);
      g.stripe.plan.push({ throws: true, create: false });
      await assert.rejects(g.exec(id));
      g.age(id);
      g.stripe.pages = pages;
      assert.equal((await g.reconcile(id, { evidence_reference: 'case-0002-y', confirmed_provider_rejection: true })).status, 409, label);
      assert.ok(held(g.refund(id)), label);
    } finally { g.db.close(); }
  }
});

test('F1 credential rotation: a routine key rotation on the same Stripe account must not strand a held refund', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(2500);
    f.stripe.plan.push({ throws: true }); // completed at Stripe, response lost
    await assert.rejects(f.exec(id));
    f.rotate(); // same account, replacement secret key (Stripe "Rotate key")
    const r = await f.reconcile(id);
    assert.deepEqual(r, { ok: true, status: 'completed' }, 'exact evidence from the same account must reconcile after rotation: ' + JSON.stringify(r));
  } finally { f.db.close(); }
});

test('F1 credential rotation: a signed refund.updated for a pending refund still completes after a key rotation', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(4000);
    f.stripe.plan.push({ status: 'pending' });
    await f.exec(id);
    const made = f.stripe.refunds[0];
    f.rotate();
    await f.refundEvent('refund.updated', { ...made, status: 'succeeded' });
    assert.equal(f.refund(id).status, 'completed', 'signed exact event must complete the request after rotation');
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [4000, 6000]);
  } finally { f.db.close(); }
});

test('F1 legacy: a held pre-correction refund is linked only by exact owner-supplied evidence; ambiguous pairs stay held', async () => {
  const f = fixture();
  try {
    const legacy = f.newRefund(1500);
    f.db.prepare("UPDATE fin_refunds SET status='submitted',error='legacy uncertain' WHERE id=?").run(legacy);
    f.stripe.refunds.unshift({ id: 're_legacy1', object: 'refund', amount: 1500, currency: 'aud', payment_intent: f.reference, status: 'succeeded', metadata: { organisation_id: f.A.org, payment_id: f.A.payment } });
    assert.equal(f.request(100).status, 409, 'held');
    assert.equal((await f.reconcile(legacy, { legacy_refund_id: 're_legacy1' })).status, 409, 'evidence reference required');
    assert.equal((await f.reconcile(legacy, { legacy_refund_id: 're_wrong', evidence_reference: 'legacy-case-1' })).status, 409);
    assert.deepEqual(await f.reconcile(legacy, { legacy_refund_id: 're_legacy1', evidence_reference: 'legacy-case-1' }), { ok: true, status: 'completed' });
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [1500, 8500]);
    assert.equal(f.stripe.posts.length, 0);
  } finally { f.db.close(); }
  const g = fixture();
  try {
    const [a, b] = [g.newRefund(1500), g.newRefund(1500)];
    g.db.prepare("UPDATE fin_refunds SET status='submitted',error='legacy uncertain' WHERE id IN (?,?)").run(a, b);
    g.stripe.refunds.unshift({ id: 're_legacy2', object: 'refund', amount: 1500, currency: 'aud', payment_intent: g.reference, status: 'succeeded', metadata: { organisation_id: g.A.org, payment_id: g.A.payment } });
    assert.equal((await g.reconcile(a, { legacy_refund_id: 're_legacy2', evidence_reference: 'legacy-case-2' })).status, 409, 'two plausible local requests: ambiguous');
    assert.deepEqual([g.pay().refunded_cents, g.paid()], [0, 10000]);
  } finally { g.db.close(); }
});

test('F1 Connect: events carrying an account (Connect) are ignored and change nothing', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(1000);
    f.stripe.plan.push({ status: 'pending' });
    await f.exec(id);
    const r = await f.hook(f.A, 'refund.updated', { ...f.stripe.refunds[0], status: 'succeeded' }, undefined, { account: 'acct_connected' });
    assert.equal(r.value.outcome, 'ignored');
    assert.equal(f.refund(id).status, 'submitted');
    assert.equal((await f.hook(f.A, 'charge.refunded', { object: 'charge', payment_intent: f.reference, amount_refunded: 1000, currency: 'aud' }, undefined, { account: 'acct_connected' })).value.outcome, 'ignored');
    assert.equal(f.pay().refunded_cents, 0);
  } finally { f.db.close(); }
});

// ================= F2 — lifecycle =================
test('F2: pending → requires_action → pending → succeeded; duplicates and delayed events never double-count or regress', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(4000);
    f.stripe.plan.push({ status: 'pending' });
    await f.exec(id);
    const made = f.stripe.refunds[0];
    await f.refundEvent('refund.created', { ...made, status: 'pending' });
    await f.refundEvent('refund.updated', { ...made, status: 'requires_action' });
    assert.equal(f.refund(id).status, 'submitted');
    assert.equal(f.request(6001).status, 400, 'pending amount stays reserved');
    await f.refundEvent('refund.updated', { ...made, status: 'succeeded' }, 'evt_done');
    assert.equal((await f.refundEvent('refund.updated', { ...made, status: 'succeeded' }, 'evt_done')).value.duplicate, true);
    await f.refundEvent('refund.updated', { ...made, status: 'pending' }); // delayed older event
    await f.chargeRefunded(4000);
    await f.chargeRefunded(4000);
    assert.equal(f.refund(id).status, 'completed');
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [4000, 6000]);
    assert.equal(f.request(6000).ok, true, 'exactly the remaining 60.00 is refundable');
  } finally { f.db.close(); }
});

for (const status of ['failed', 'canceled']) {
  test(`F2: a pending refund that becomes ${status} releases its reservation without moving money`, async () => {
    const f = fixture();
    try {
      const id = f.newRefund(4000);
      f.stripe.plan.push({ status: 'pending' });
      await f.exec(id);
      await f.refundEvent(status === 'failed' ? 'refund.failed' : 'refund.updated', { ...f.stripe.refunds[0], status });
      assert.equal(f.refund(id).status, status);
      assert.deepEqual([f.pay().refunded_cents, f.paid()], [0, 10000]);
      assert.equal(f.request(10000).ok, true);
    } finally { f.db.close(); }
  });
}

test('F2: a charge aggregate overlapping a local reservation and a dashboard refund is allocated exactly from the list', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(4000);
    f.stripe.plan.push({ status: 'pending' });
    await f.exec(id);
    f.stripe.refunds[0].status = 'succeeded';
    f.stripe.refunds.unshift({ id: 're_dash', object: 'refund', amount: 3000, currency: 'aud', payment_intent: f.reference, status: 'succeeded', metadata: {} });
    await f.chargeRefunded(7000);
    assert.equal(f.refund(id).status, 'completed');
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [7000, 3000]);
    assert.equal(f.request(3001).status, 400);
    assert.equal(f.request(3000).ok, true);
  } finally { f.db.close(); }
});

test('F2: with the list unavailable the aggregate holds the payment; a later owner reconcile allocates exactly', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(4000);
    f.stripe.plan.push({ status: 'pending' });
    await f.exec(id);
    f.stripe.refunds[0].status = 'succeeded';
    f.stripe.listFails = true;
    await f.chargeRefunded(4000);
    assert.equal(f.pay().refunded_cents, 4000, 'signed total is a floor');
    assert.equal(f.request(100).status, 409, 'held for allocation');
    f.stripe.listFails = false;
    assert.deepEqual(await f.reconcile(id), { ok: true, status: 'completed' });
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [4000, 6000]);
    assert.equal(f.request(6000).ok, true);
  } finally { f.db.close(); }
});

test('F2 conflicting: a succeeded refund that Stripe later fails is not silently left as refunded', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(4000);
    await f.exec(id); // succeeded synchronously
    assert.deepEqual([f.refund(id).status, f.pay().refunded_cents], ['completed', 4000]);
    const made = f.stripe.refunds[0];
    const r = await f.refundEvent('refund.failed', { ...made, status: 'failed', failure_reason: 'lost_or_stolen_card' });
    assert.equal(r.statusCode, 200);
    const reverted = f.refund(id).status === 'failed' && f.pay().refunded_cents === 0 && f.paid() === 10000;
    const flagged = f.db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action IN ('payment.needs_review','finance.refund_failed_after_success','payment.refund_receipt') AND metadata_json LIKE '%failed%'").get().n > 0;
    assert.ok(reverted || flagged, `failure after success must reverse the ledger or flag the owner (status ${f.refund(id).status}, refunded ${f.pay().refunded_cents}, outcome ${r.value.outcome})`);
  } finally { f.db.close(); }
});

// ================= F3 — concurrency (in-process) =================
test('F3: overlapping different refunds, duplicate approvals and over-capacity requests keep exact totals', async () => {
  const f = fixture();
  try {
    const a = f.newRefund(3000), b = f.newRefund(2000);
    const slow = (ms) => ({ id: undefined, status: 'succeeded' });
    f.stripe.plan.push(slow(), slow());
    await Promise.all([f.exec(a), f.exec(b), f.exec(a), f.exec(b)]);
    assert.equal(f.stripe.posts.length, 2, 'duplicate approvals send nothing extra');
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [5000, 5000]);
    const c = f.newRefund(5000);
    assert.equal(f.request(1).status, 400, 'no capacity left once reserved');
    await f.exec(c);
    assert.deepEqual([f.pay().status, f.pay().refunded_cents, f.paid()], ['refunded', 10000, 0]);
  } finally { f.db.close(); }
});

// ================= F3/F4 — separate OS processes =================
async function processWorld(t, onPost) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prg03r-')), file = path.join(dir, 'db.sqlite');
  const db = createDb(file);
  const { A } = seed(db, { amount: 10000, currency: 'aud', reference: 'pi_proc' });
  const fin = createFinance({ db, payments: null, engineRef: { current: { startRun: () => ({ id: crypto.randomUUID(), promise: Promise.resolve() }) } } });
  void fin;
  const posts = [], refunds = [], children = [];
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => { body += c; }); req.on('end', async () => {
      const u = new URL(req.url, 'http://x');
      if (req.method === 'GET' && u.pathname === '/v1/refunds') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ object: 'list', has_more: false, data: refunds })); }
      const p = new URLSearchParams(body);
      const made = { id: 're_' + crypto.createHash('sha1').update(req.headers['idempotency-key']).digest('hex').slice(0, 12), object: 'refund', amount: Number(p.get('amount')), currency: 'aud', payment_intent: p.get('payment_intent'), status: 'succeeded', metadata: { organisation_id: p.get('metadata[organisation_id]'), payment_id: p.get('metadata[payment_id]'), refund_request_id: p.get('metadata[refund_request_id]') } };
      posts.push({ idem: req.headers['idempotency-key'], at: Date.now(), made });
      refunds.unshift(made);
      await onPost(posts, res, made);
      if (!res.destroyed && !res.writableEnded) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(made)); }
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const provider = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    for (const c of children) c.proc.kill('SIGKILL');
    server.closeAllConnections(); await new Promise((r) => server.close(r));
    db.close(); fs.rmSync(dir, { recursive: true, force: true });
  });
  const run = (input, timeoutMs = 20000) => {
    const proc = spawn(process.execPath, [WORKER], { env: { ...process.env, PRG03_WORKER: JSON.stringify({ file, provider, org: A.org, approver: OWNER, ...input }) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    proc.stdout.on('data', (d) => { out += d; }); proc.stderr.on('data', (d) => { err += d; });
    const result = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('worker exceeded ' + timeoutMs + ' ms: ' + err)); }, timeoutMs);
      proc.on('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal, out: out.trim() ? JSON.parse(out.trim().split('\n').at(-1)) : null, err }); });
    });
    const child = { proc, result }; children.push(child); return child;
  };
  const request = (amount) => { const r = createFinance({ db, payments: null, engineRef: { current: { startRun: () => ({ id: crypto.randomUUID(), promise: Promise.resolve() }) } } }).requestRefund(A.org, A.payment, REQUESTER, { amount_cents: amount, reason: 'synthetic' }); assert.equal(r.ok, true); return r.refund_id; };
  const state = () => ({ refunded: db.prepare('SELECT refunded_cents n FROM job_payments WHERE id=?').get(A.payment).n, paid: db.prepare('SELECT paid_cents n FROM work_orders WHERE id=?').get(A.job).n });
  return { db, A, posts, refunds, run, request, state, file };
}

test('F3 processes: two different refunds overlap in flight from separate processes; duplicates send nothing; totals exact', { timeout: 60000 }, async (t) => {
  let release; const both = new Promise((r) => { release = r; });
  const w = await processWorld(t, async (posts) => { if (posts.length === 2) release(); await Promise.race([both, sleep(8000)]); });
  const a = w.request(3000), b = w.request(2000);
  const results = await Promise.all([w.run({ action: 'execute', refund: a }), w.run({ action: 'execute', refund: b }), w.run({ action: 'execute', refund: a }), w.run({ action: 'execute', refund: b })].map((c) => c.result));
  for (const r of results) assert.equal(r.code, 0, r.err);
  assert.equal(w.posts.length, 2, 'one POST per approved request');
  assert.equal(new Set(w.posts.map((p) => p.idem)).size, 2);
  assert.ok(Math.abs(w.posts[0].at - w.posts[1].at) < 8000, 'both POSTs were in flight together (barrier released by the second)');
  assert.deepEqual(w.state(), { refunded: 5000, paid: 5000 });
});

test('F3 processes: approvals whose combined amount exceeds the payment dispatch only what fits', { timeout: 60000 }, async (t) => {
  const w = await processWorld(t, async () => { await sleep(200); });
  const a = w.request(6000);
  w.db.prepare("INSERT INTO fin_refunds (id,organisation_id,payment_id,work_order_id,amount_cents,reason,status,provider,requested_by,created_at,updated_at) SELECT ?,organisation_id,payment_id,work_order_id,6000,'synthetic','pending_approval','stripe',requested_by,created_at,updated_at FROM fin_refunds WHERE id=?").run(crypto.randomUUID(), a);
  const b = w.db.prepare('SELECT id FROM fin_refunds WHERE id<>? ORDER BY rowid DESC LIMIT 1').get(a).id;
  const results = await Promise.all([w.run({ action: 'execute', refund: a }), w.run({ action: 'execute', refund: b })].map((c) => c.result));
  assert.equal(w.posts.length, 1, 'over-capacity approval sends no POST');
  assert.equal(results.filter((r) => r.out?.ok).length, 1);
  assert.deepEqual(w.state(), { refunded: 6000, paid: 4000 });
});

test('F3 processes: a webhook and the local settlement of the same refund in separate processes apply it once', { timeout: 60000 }, async (t) => {
  let made; let go; const gate = new Promise((r) => { go = r; });
  const w = await processWorld(t, async (posts, res, m) => { made = m; go(); await sleep(300); });
  const id = w.request(2500);
  const exec = w.run({ action: 'execute', refund: id });
  await gate;
  const secret = w.db.prepare('SELECT stripe_webhook_enc s FROM payment_settings WHERE organisation_id=?').get(w.A.org).s;
  const hooks = [w.run({ action: 'webhook', secret, event: { id: 'evt_p1', type: 'refund.updated', data: { object: made } } }),
    w.run({ action: 'webhook', secret, event: { id: 'evt_p2', type: 'charge.refunded', data: { object: { object: 'charge', payment_intent: 'pi_proc', amount_refunded: 2500, currency: 'aud' } } } })];
  const results = await Promise.all([exec, ...hooks].map((c) => c.result));
  for (const r of results) assert.equal(r.code, 0, r.err);
  assert.deepEqual(w.state(), { refunded: 2500, paid: 7500 });
  assert.equal(w.db.prepare("SELECT status FROM fin_refunds WHERE id=?").get(id).status, 'completed');
  assert.equal(w.posts.length, 1);
});

test('F4 processes: a process killed after Stripe accepted the refund recovers on restart with no second POST', { timeout: 60000 }, async (t) => {
  let accepted; const got = new Promise((r) => { accepted = r; });
  const w = await processWorld(t, async (posts, res) => { accepted(); await sleep(5000); });
  const id = w.request(2500);
  const victim = w.run({ action: 'execute', refund: id });
  await got;
  victim.proc.kill('SIGKILL');
  const killed = await victim.result;
  assert.equal(killed.signal, 'SIGKILL');
  assert.deepEqual(w.state(), { refunded: 0, paid: 10000 }, 'nothing applied by the killed process');
  const retry = await w.run({ action: 'execute', refund: id }).result;
  assert.equal(retry.out.ok, true);
  assert.match(retry.out.summary, /already submitted/);
  assert.equal(w.posts.length, 1, 'restart does not POST again');
  const rec = await w.run({ action: 'reconcile', refund: id }).result;
  assert.deepEqual(rec.out.value, { ok: true, status: 'completed' });
  assert.deepEqual(w.state(), { refunded: 2500, paid: 7500 });
  assert.equal(w.posts.length, 1);
});

// ================= F4 — local failure injection =================
test('F4: failure during local settlement rolls back status and both balances together, then recovers with no POST', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(2000);
    f.db.exec("CREATE TRIGGER fail_wo BEFORE UPDATE OF paid_cents ON work_orders BEGIN SELECT RAISE(ABORT, 'synthetic settlement failure'); END");
    await assert.rejects(f.exec(id), /synthetic settlement failure/);
    assert.equal(f.refund(id).status, 'submitted');
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [0, 10000], 'payment and job unchanged together');
    f.db.exec('DROP TRIGGER fail_wo');
    assert.match((await f.exec(id)).summary, /recovered as completed/);
    assert.deepEqual([f.refund(id).status, f.pay().refunded_cents, f.paid()], ['completed', 2000, 8000]);
    assert.equal(f.stripe.posts.length, 1);
  } finally { f.db.close(); }
});

test('F4: failure before the receipt is persisted holds the request and recovers from provider evidence with no POST', async () => {
  const f = fixture();
  try {
    const id = f.newRefund(2000);
    f.db.exec("CREATE TRIGGER fail_receipt BEFORE UPDATE OF receipt_json ON fin_stripe_refund_attempts BEGIN SELECT RAISE(ABORT, 'synthetic receipt failure'); END");
    await assert.rejects(f.exec(id), /synthetic receipt failure/);
    f.db.exec('DROP TRIGGER fail_receipt');
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [0, 10000]);
    assert.match((await f.exec(id)).summary, /already submitted/, 'retry makes no POST');
    f.age(id);
    assert.equal(f.request(100).status, 409, 'held after the in-flight window');
    assert.deepEqual(await f.reconcile(id), { ok: true, status: 'completed' });
    assert.deepEqual([f.pay().refunded_cents, f.paid()], [2000, 8000]);
    assert.equal(f.stripe.posts.length, 1);
  } finally { f.db.close(); }
});

// ================= route boundary (real server) =================
test('reconcile route: owner only, strict body, tenant scoped, generic refusals (real server)', { timeout: 90000 }, async (t) => {
  const { startServer } = await import('../../scripts/test-server.mjs');
  const { seedOwner } = await import('../../scripts/visual/session.mjs');
  const Database = (await import('better-sqlite3')).default;
  const s = await startServer();
  t.after(() => s.stop());
  const A = await seedOwner(s, { email: 'recon-a@example.test', business: 'Recon A' });
  const B = await seedOwner(s, { email: 'recon-b@example.test', business: 'Recon B' });
  const admin = await seedOwner(s, { email: 'recon-admin@example.test', business: 'Admin own' });
  const db = new Database(s.dbPath);
  t.after(() => db.close());
  const now = new Date().toISOString(), job = crypto.randomUUID(), pay = crypto.randomUUID(), id = crypto.randomUUID();
  db.prepare("INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,'admin',?)").run(A.org, admin.uid, now);
  db.prepare("INSERT INTO work_orders(id,organisation_id,title,start_at,required_skills,status,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,'[]','completed',10000,10000,?,?)").run(job, A.org, 'J', now, now, now);
  db.prepare("INSERT INTO job_payments (id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',10000,'aud','pi_route',?,?)").run(pay, A.org, job, now, now);
  db.prepare("INSERT INTO fin_refunds (id,organisation_id,payment_id,work_order_id,amount_cents,reason,status,provider,error,requested_by,created_at,updated_at) VALUES (?,?,?,?,1000,'s','submitted','stripe','uncertain',?,?,?)").run(id, A.org, pay, job, A.uid, now, now);
  const before = JSON.stringify(db.prepare('SELECT * FROM fin_refunds WHERE id=?').get(id));
  const route = `/api/saas/finance/refunds/${id}/reconcile`;
  const call = (actor, body, headers = {}) => s.call('POST', route, { cookie: actor?.cookie, body, headers });
  assert.equal((await call(null, {})).status, 401);
  assert.equal((await call({ ...admin }, {}, { 'X-Organisation-Id': A.org })).status, 403, 'admin of the tenant refused');
  assert.equal((await call(B, {})).status, 404, 'another tenant owner cannot see it');
  for (const body of [{ evidence_reference: 'short' }, { confirmed_provider_rejection: 'yes' }, { confirmed_provider_rejection: false },
    { legacy_refund_id: 'ch_123' }, { legacy_refund_id: 're_' + 'x'.repeat(121) }, { amount_cents: 1000 }, { status: 'completed' }, { provider_ref: 're_x' }]) {
    const r = await call(A, body);
    assert.equal(r.status, 400, JSON.stringify(body) + ' -> ' + r.status);
  }
  const r = await call(A, {});
  assert.equal(r.status, 409, 'owner without verifiable provider evidence is refused: ' + r.text);
  assert.doesNotMatch(r.text, /sk_|secret|stack/i);
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM fin_refunds WHERE id=?').get(id)), before, 'no refusal changes the request');
});

test('F2: a well-formed synchronous failed or canceled refund response is authoritative; a mismatched one stays held', async () => {
  for (const status of ['failed', 'canceled']) {
    const f = fixture();
    try {
      const id = f.newRefund(4000);
      f.stripe.plan.push({ status });
      await f.exec(id);
      assert.equal(f.refund(id).status, status);
      assert.deepEqual([f.pay().refunded_cents, f.paid()], [0, 10000]);
      assert.equal(f.request(10000).ok, true, 'reservation released');
      assert.equal(f.stripe.posts.length, 1);
    } finally { f.db.close(); }
    for (const bad of [{ currency: 'nzd' }, { payment_intent: 'pi_other' }, { metadata: { refund_request_id: 'other' } }, { object: 'charge' }]) {
      const g = fixture();
      try {
        const id = g.newRefund(4000);
        g.stripe.plan.push({ status, body: { id: 're_x', object: 'refund', amount: 4000, currency: 'aud', payment_intent: g.reference, status, ...bad } });
        await assert.rejects(g.exec(id), { code: 'REFUND_RECONCILIATION_REQUIRED' }, JSON.stringify(bad));
        assert.ok(held(g.refund(id)));
      } finally { g.db.close(); }
    }
  }
});
