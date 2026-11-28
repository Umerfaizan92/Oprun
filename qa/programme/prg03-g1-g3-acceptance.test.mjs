import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createDb, verifyAuditChain } from '../../src/db.js';
import { installPayments } from '../../src/payments.js';
import { createFinance } from '../../src/finance/service.js';

function fixture(t) {
  const db = createDb(':memory:');
  t.after(() => db.close());
  db.exec('ALTER TABLE job_payments ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE TABLE tenant_documents(id TEXT PRIMARY KEY,organisation_id TEXT)');
  const now = new Date().toISOString(), org = 'synthetic-tenant', id = 'synthetic-payment';
  db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(org, 'Synthetic', org, now, now);
  db.prepare("INSERT INTO users(id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES ('owner','owner@example.test','Owner','x','x',?,?)").run(now, now);
  db.prepare("INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES (?,'owner','owner',?)").run(org, now);
  db.prepare('INSERT INTO payment_settings(organisation_id,stripe_secret_enc,stripe_webhook_enc,updated_at) VALUES (?,?,?,?)').run(org, 'original', 'webhook-test-secret', now);
  db.prepare("INSERT INTO work_orders(id,organisation_id,title,start_at,price_cents,paid_cents,created_at,updated_at) VALUES ('job',?,'Synthetic',?,10000,10000,?,?)").run(org, now, now, now);
  db.prepare("INSERT INTO job_payments(id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,'job','stripe','card','paid',10000,'aud','pi_demo',?,?)").run(id, org, now, now);
  const accounts = new Map([
    ['original',{ account: 'acct_Same', live: false }], ['replacement',{ account: 'acct_Same', live: false }],
    ['other',{ account: 'acct_Other', live: false }], ['live',{ account: 'acct_Same', live: true }],
  ]);
  const provider = { posts: 0, receipts: [], lost: false, status: 'succeeded' };
  const reply = (value, status = 200) => ({ ok: status === 200, status, json: async () => value });
  const fetchImpl = async (url, options) => {
    const key = options.headers.authorization.slice(7), identity = accounts.get(key);
    if (!identity) return reply({}, 403);
    const endpoint = new URL(url).pathname;
    if (endpoint === '/v1/account') return reply({ object: 'account', id: identity.account });
    if (endpoint === '/v1/balance') return reply({ object: 'balance', livemode: identity.live });
    if (endpoint === '/v1/payment_intents/pi_demo') return reply({ object: 'payment_intent', id: 'pi_demo', currency: 'aud', livemode: identity.live });
    if (endpoint !== '/v1/refunds') throw new Error('Unexpected synthetic request');
    if (options.method === 'GET') return reply({ data: provider.receipts, has_more: false });
    provider.posts++;
    const params = new URLSearchParams(options.body);
    const receipt = { object: 'refund', id: 're_' + provider.posts, status: provider.status,
      payment_intent: 'pi_demo', amount: Number(params.get('amount')), currency: 'aud',
      metadata: { organisation_id: org, payment_id: id, refund_request_id: params.get('metadata[refund_request_id]') } };
    provider.receipts.push(receipt);
    if (provider.lost) throw new Error('Synthetic network interruption');
    return reply(receipt);
  };
  const routes = new Map();
  const app = Object.fromEntries(['get','post','put','patch','delete'].map(method => [method, (path,...handlers) => routes.set(method + ' ' + path, handlers.at(-1))]));
  const payments = installPayments(app, { db, env: {}, runtime: { decryptBundle: v => ({ v }) }, requireSaasUser() {}, requireSaasRole: () => () => {}, saasAudit() {}, financeRoles: ['owner'], syncJobFinance() {}, fetchImpl });
  const finance = createFinance({ db, payments, engineRef: { current: { startRun: () => ({ id: crypto.randomUUID(), promise: Promise.resolve() }) } } });
  async function hook(eventId, type, object, extra = {}) {
    const body = { id: eventId, type, livemode: false, data: { object }, ...extra };
    const rawBody = JSON.stringify(body), timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHmac('sha256', 'webhook-test-secret').update(timestamp + '.' + rawBody).digest('hex');
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; return this; } };
    await routes.get('post /api/webhooks/payments/stripe/:orgId')({ params: { orgId: org }, body, rawBody, get: () => `t=${timestamp},v1=${signature}` }, res);
    return res;
  }
  const balances = () => [
    db.prepare('SELECT refunded_cents AS n FROM job_payments').get().n,
    db.prepare('SELECT paid_cents AS n FROM work_orders').get().n,
  ];
  return { db, org, id, finance, provider, hook, balances,
    rotate: key => db.prepare('UPDATE payment_settings SET stripe_secret_enc=?').run(key),
    request: amount => finance.requestRefund(org,id,'owner',{ amount_cents: amount, reason: 'Synthetic refund' }),
    exec: refund_id => finance.executeRefund(org,{ refund_id },'owner'),
    reconcile: (refundId, evidence) => finance.reconcileStripeRefund(org,refundId,'owner',evidence),
    state: refundId => db.prepare('SELECT status FROM fin_refunds WHERE id=?').get(refundId).status,
  };
}

test('G2: stable identity survives rotation and refuses account, environment and restricted-key substitutions', async t => {
  const f = fixture(t);
  const id = f.request(2500).refund_id;
  f.provider.lost = true;
  await assert.rejects(f.exec(id));
  assert.equal(f.db.prepare('SELECT account_binding FROM fin_stripe_refund_attempts').get().account_binding, 'stripe:acct_Same:test');
  for (const key of ['other','live','revoked']) {
    f.rotate(key);
    assert.equal((await f.reconcile(id)).status, 409);
    assert.deepEqual(f.balances(), [0,10000]);
  }
  f.rotate('replacement');
  assert.equal((await f.hook('evt_wrong_mode','refund.updated',f.provider.receipts[0],{ livemode: true })).statusCode,409);
  assert.deepEqual(await f.reconcile(id), { ok: true, status: 'completed' });
  assert.deepEqual(f.balances(), [2500,7500]);
  assert.equal(f.provider.posts, 1);
});

test('G2: a rotated historic binding requires exact evidence and recorded owner authority', async t => {
  const f = fixture(t);
  const id = f.request(2000).refund_id;
  f.provider.lost = true;
  await assert.rejects(f.exec(id));
  f.db.prepare('UPDATE fin_stripe_refund_attempts SET account_binding=?').run(crypto.createHash('sha256').update('original').digest('hex'));
  f.rotate('replacement');
  assert.equal((await f.reconcile(id)).status,409);
  const evidence = { legacy_refund_id: 're_1', legacy_account_id: 'acct_Same', legacy_livemode: false, evidence_reference: 'verified-historical-case' };
  assert.equal((await f.reconcile(id,{ ...evidence, legacy_livemode: true })).status,409);
  assert.deepEqual(await f.reconcile(id,evidence), { ok: true, status: 'completed' });
  assert.equal(f.db.prepare("SELECT user_id FROM audit_logs WHERE action='finance.refund_account_evidence_verified'").get().user_id,'owner');
  assert.equal(f.provider.posts,1);
});

test('G1: concurrent signed failures compensate once and delayed aggregates cannot reapply them', async t => {
  const f = fixture(t);
  const id = f.request(4000).refund_id;
  await f.exec(id);
  const fail = { ...f.provider.receipts[0], status: 'failed' };
  await Promise.all(['evt_failed1','evt_failed2','evt_failed1'].map(event =>
    f.hook(event,'refund.failed',fail,{ created: Math.floor(Date.now() / 1000) + 1 })));
  assert.equal(f.state(id),'failed');
  assert.deepEqual(f.balances(),[0,10000]);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM fin_stripe_refund_lifecycle WHERE delta_cents<0').get().n,1);
  assert.equal((await f.hook('evt_old_charge','charge.refunded',{ payment_intent: 'pi_demo', amount_refunded: 4000, currency: 'aud' })).value.outcome,'refund_reconciliation_required');
  assert.deepEqual(f.balances(),[0,10000]);
  assert.equal(verifyAuditChain(f.db,f.org).ok,true);
});

test('G1: dated requires-action re-entry compensates, stale success is ignored, and later success settles', async t => {
  const f = fixture(t);
  const id = f.request(3000).refund_id;
  await f.exec(id);
  const receipt = f.provider.receipts[0], future = Math.floor(Date.now() / 1000) + 3;
  await f.hook('evt_action','refund.updated',{ ...receipt,status: 'requires_action',next_action: { type: 'display_details' } },{ created: future });
  assert.equal(f.state(id),'submitted');
  assert.deepEqual(f.balances(),[0,10000]);
  await f.hook('evt_stale','refund.updated',receipt,{ created: future - 1 });
  assert.deepEqual(f.balances(),[0,10000]);
  await f.hook('evt_new','refund.updated',receipt,{ created: future + 1 });
  assert.deepEqual(f.balances(),[3000,7000]);
  assert.equal(f.provider.posts,1);
});

test('G3: a manual adjustment preserves durable evidence, acknowledges duplicates and resolves by read only', async t => {
  const f = fixture(t);
  f.db.exec('UPDATE work_orders SET paid_cents=1000');
  f.provider.receipts.push({ id: 're_external', payment_intent: 'pi_demo', amount: 4000, status: 'succeeded', currency: 'aud' });
  const event = { payment_intent: 'pi_demo', currency: 'aud', amount_refunded: 4000 };
  const results = await Promise.all([f.hook('evt_adjust','charge.refunded',event), f.hook('evt_adjust','charge.refunded',event)]);
  assert.ok(results.every(result => result.statusCode === 200));
  assert.equal((await f.hook('evt_adjust','charge.refunded',event)).value.duplicate,true);
  assert.deepEqual(f.balances(),[0,1000]);
  assert.equal(f.finance.stripeDiscrepancies(f.org).length,1);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM payment_notices WHERE kind='payment_review'").get().n,1);
  assert.equal((await f.finance.resolveStripeDiscrepancy(f.org,'evt_adjust','owner')).status,409);
  f.db.exec('UPDATE work_orders SET paid_cents=10000');
  assert.deepEqual(await f.finance.resolveStripeDiscrepancy(f.org,'evt_adjust','owner'),{ ok: true,status: 'resolved' });
  assert.deepEqual(f.balances(),[4000,6000]);
  assert.equal(f.provider.posts,0);
  assert.equal(verifyAuditChain(f.db,f.org).ok,true);
});
