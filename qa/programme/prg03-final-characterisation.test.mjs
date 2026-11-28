// PRG-03 final acceptance CHARACTERISATION (Claude): reproduces the candidate's CURRENT behaviour for the remaining
// limitations H1–H3. Each test passes on 8d7f8df and is expected to FAIL once the limitation is fixed.
// Not acceptance evidence; the mandatory checks are in prg03-final-acceptance-independent.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
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
  process.env.NODE_ENV = saved;
  const hook = async (type, object, { id = 'evt_' + crypto.randomUUID(), created, livemode = false } = {}) => {
    const event = { id, type, created, livemode, data: { object } }, raw = JSON.stringify(event), ts = Math.floor(Date.now() / 1000);
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.value = v; return this; } };
    await routes.get('post /api/webhooks/payments/stripe/:orgId')({ params: { orgId: org }, body: event, rawBody: raw, get: () => `t=${ts},v1=${crypto.createHmac('sha256', whsec).update(`${ts}.${raw}`).digest('hex')}` }, res);
    return res;
  };
  return { db, org, payment, payments, finance, hook };
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

test('H1 current behaviour: under NODE_ENV=production, any non-global fetchImpl turns account-identity failure into fingerprint fallback', async () => {
  const s = stand(403); // e.g. a restricted key without account read
  const wrapped = (...a) => s.f(...a); // a tracing/proxy wrapper would look like this
  const u = unit({ fetchImpl: wrapped, nodeEnv: 'production' });
  const identity = await u.payments.refundAccount(u.org);
  assert.ok(identity && !identity.binding.startsWith('stripe:acct_'), 'fingerprint binding returned in production mode');
  const id = u.finance.requestRefund(u.org, u.payment, 'r', { amount_cents: 1000, reason: 's' }).refund_id;
  await u.finance.executeRefund(u.org, { refund_id: id }, 'owner');
  assert.equal(s.posts.length, 1, 'a financial POST is sent without a verified account identity');
  u.db.close();
});

test('H2 current behaviour: a second refund event with the same Stripe created second as the previous one is dropped', async () => {
  const s = stand(200);
  const u = unit({ fetchImpl: s.f });
  const id = u.finance.requestRefund(u.org, u.payment, 'r', { amount_cents: 4000, reason: 's' }).refund_id;
  await u.finance.executeRefund(u.org, { refund_id: id }, 'owner');
  const made = s.posts[0], t0 = Math.floor(Date.now() / 1000) + 5;
  await u.hook('refund.updated', { ...made, status: 'requires_action', next_action: { type: 'display_details' } }, { created: t0 });
  const second = await u.hook('refund.updated', { ...made, status: 'succeeded' }, { created: t0 });
  assert.equal(second.value.outcome, 'ignored', 'same-second success ignored and acknowledged');
  assert.equal(u.db.prepare('SELECT status FROM fin_refunds WHERE id=?').get(id).status, 'submitted', 'stays reserved until an owner reconciles');
  u.db.close();
});

test('H3 current behaviour: a storage failure while recording a G3 discrepancy terminates the real server process', { timeout: 90000 }, async (t) => {
  const { startServer } = await import('../../scripts/test-server.mjs');
  const { seedOwner } = await import('../../scripts/visual/session.mjs');
  const fake = (p) => p + crypto.randomBytes(12).toString('hex');
  const WHSEC = fake('whsec_'), KEY = fake(['sk', 'test', ''].join('_'));
  const s = await startServer({ STRIPE_API_BASE_URL: 'http://127.0.0.1:9' });
  t.after(() => s.stop());
  const owner = await seedOwner(s, { email: 'h3@example.test', business: 'H3' });
  const put = await s.call('PUT', '/api/saas/payments/settings', { cookie: owner.cookie, body: { stripe_secret_key: KEY, stripe_webhook_secret: WHSEC, terms_days: 14 } });
  assert.equal(put.status, 200, put.text);
  const db = new Database(s.dbPath), now = new Date().toISOString(), job = crypto.randomUUID(), pay = crypto.randomUUID();
  db.prepare("INSERT INTO work_orders(id,organisation_id,title,start_at,required_skills,status,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,'[]','completed',10000,1000,?,?)").run(job, owner.org, 'J', now, now, now);
  db.prepare("INSERT INTO job_payments (id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',10000,'aud','pi_h3',?,?)").run(pay, owner.org, job, now, now);
  db.exec("CREATE TRIGGER fail_disc BEFORE INSERT ON fin_stripe_refund_discrepancies BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END");
  db.close();
  const event = { id: 'evt_h3', type: 'charge.refunded', created: Math.floor(Date.now() / 1000), livemode: false, data: { object: { object: 'charge', payment_intent: 'pi_h3', amount_refunded: 4000, currency: 'aud' } } };
  const body = JSON.stringify(event), ts = Math.floor(Date.now() / 1000), sig = crypto.createHmac('sha256', WHSEC).update(`${ts}.${body}`).digest('hex');
  const r = await fetch(`${s.base}/api/webhooks/payments/stripe/${owner.org}`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` }, body, signal: AbortSignal.timeout(10000) }).then((x) => x.status, (e) => 'no response: ' + e.name);
  await new Promise((res) => setTimeout(res, 1500));
  const alive = await fetch(s.base + '/healthz', { signal: AbortSignal.timeout(3000) }).then((x) => x.ok, () => false);
  assert.equal(alive, false, `server process no longer serves requests (webhook result: ${r})`);
  assert.match(s.log(), /synthetic storage failure/);
});
