// PRG-03 FINAL independent acceptance of G1–G3 (Claude). Candidate 8d7f8df (published fb855ce).
// PRODUCTION PATH: every financial action runs in a separate OS process with NODE_ENV=production and the default
// global fetch, against a loopback Stripe stand-in that models accounts, modes, keys and payment intents. The
// candidate's synthetic compatibility paths therefore cannot be used. Mandatory: no todo, no skip.
//   node --test --test-concurrency=1 qa/programme/prg03-final-acceptance-independent.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDb, verifyAuditChain } from '../../src/db.js';
import { createFinance } from '../../src/finance/service.js';

const WORKER = fileURLToPath(new URL('./prg03-final-worker.mjs', import.meta.url));
const OWNER = 'final-owner', REQUESTER = 'final-requester';
// Synthetic key → account/mode map. Two keys for acct_one model a same-account rotation.
const KEYS = {
  'key-one-a': { account: 'acct_one', live: false }, 'key-one-b': { account: 'acct_one', live: false },
  'key-two': { account: 'acct_two', live: false }, 'key-one-live': { account: 'acct_one', live: true },
  'key-restricted': { status: 403 }, 'key-broken': { status: 500 },
};
const PI = 'pi_final';
const PI_OWNER = { [PI]: 'acct_one' };

async function world(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prg03f-')), file = path.join(dir, 'db.sqlite');
  const db = createDb(file), now = new Date().toISOString();
  db.exec('ALTER TABLE job_payments ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE TABLE IF NOT EXISTS tenant_documents(id TEXT PRIMARY KEY,organisation_id TEXT)');
  const org = crypto.randomUUID(), job = crypto.randomUUID(), payment = crypto.randomUUID(), whsec = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(org, 'Final', org, now, now);
  db.prepare("INSERT INTO users(id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,'x','x',?,?)").run(OWNER, 'final@example.test', 'Owner', now, now);
  db.prepare("INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES (?,?,'owner',?)").run(org, OWNER, now);
  db.prepare('INSERT INTO payment_settings(organisation_id,stripe_secret_enc,stripe_webhook_enc,updated_at) VALUES (?,?,?,?)').run(org, 'key-one-a', whsec, now);
  db.prepare('INSERT INTO work_orders(id,organisation_id,title,start_at,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,10000,10000,?,?)').run(job, org, 'Job', now, now, now);
  db.prepare("INSERT INTO job_payments(id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',10000,'aud',?,?,?)").run(payment, org, job, PI, now, now);
  createFinance({ db, payments: null }); // installs the finance and Stripe ledger schema
  const stripe = { posts: [], refunds: {}, plan: [], gets: [] };
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => { body += c; }); req.on('end', async () => {
      const key = String(req.headers.authorization || '').replace(/^Bearer /, ''), who = KEYS[key];
      const u = new URL(req.url, 'http://x'), send = (code, v) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(v)); };
      if (!who) return send(401, { error: { type: 'invalid_request_error', message: 'Invalid API key' } });
      if (req.method === 'GET') stripe.gets.push(u.pathname);
      if (u.pathname === '/v1/account') return who.status ? send(who.status, { error: { type: 'invalid_request_error', code: 'permission_denied' } }) : send(200, { object: 'account', id: who.account });
      if (who.status) return send(who.status, { error: { type: 'api_error' } });
      if (u.pathname === '/v1/balance') return send(200, { object: 'balance', livemode: who.live });
      const list = (stripe.refunds[who.account + who.live] ||= []);
      if (u.pathname.startsWith('/v1/payment_intents/')) {
        const id = decodeURIComponent(u.pathname.split('/').pop());
        return PI_OWNER[id] === who.account ? send(200, { object: 'payment_intent', id, currency: 'aud', livemode: who.live }) : send(404, { error: { type: 'invalid_request_error', code: 'resource_missing' } });
      }
      if (req.method === 'GET' && u.pathname === '/v1/refunds') return send(200, { object: 'list', has_more: false, data: list.filter((r) => r.payment_intent === u.searchParams.get('payment_intent')) });
      if (req.method === 'POST' && u.pathname === '/v1/refunds') {
        const p = new URLSearchParams(body), step = stripe.plan.shift() || {};
        const made = { id: 're_' + crypto.createHash('sha1').update(String(req.headers['idempotency-key'])).digest('hex').slice(0, 12), object: 'refund', amount: Number(p.get('amount')), currency: 'aud', payment_intent: p.get('payment_intent'), livemode: who.live, status: step.status || 'succeeded', metadata: { organisation_id: p.get('metadata[organisation_id]'), payment_id: p.get('metadata[payment_id]'), refund_request_id: p.get('metadata[refund_request_id]') } };
        stripe.posts.push({ key, account: who.account, made });
        list.unshift(made);
        if (step.drop) return req.socket.destroy();
        return send(200, made);
      }
      send(404, { error: { type: 'invalid_request_error', code: 'resource_missing' } });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const provider = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise((r) => server.close(r)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const run = (input, timeoutMs = 25000) => new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [WORKER], { env: { PATH: process.env.PATH, NODE_ENV: 'production', PRG03_FINAL: JSON.stringify({ file, provider, org, approver: OWNER, ...input }) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    proc.stdout.on('data', (d) => { out += d; }); proc.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('worker timeout: ' + err)); }, timeoutMs);
    proc.on('exit', (code) => { clearTimeout(timer); const line = out.trim().split('\n').at(-1); resolve(line ? JSON.parse(line) : { ok: false, error: 'no output (exit ' + code + '): ' + err.slice(-400) }); });
  });
  const fin = createFinance({ db, payments: null, engineRef: { current: { startRun: () => ({ id: crypto.randomUUID(), promise: Promise.resolve() }) } } });
  const q = (sql, ...a) => db.prepare(sql).get(...a);
  const w = {
    db, org, job, payment, stripe, run,
    request: (amount) => { const r = fin.requestRefund(org, payment, REQUESTER, { amount_cents: amount, reason: 'synthetic' }); return r; },
    newRefund: (amount) => { const r = w.request(amount); assert.equal(r.ok, true, JSON.stringify(r)); return r.refund_id; },
    exec: (refund) => run({ action: 'execute', refund }),
    reconcile: (refund, body) => run({ action: 'reconcile', refund, body }),
    resolve: (event) => run({ action: 'resolve', event }),
    identity: () => run({ action: 'identity' }),
    key: (k) => db.prepare('UPDATE payment_settings SET stripe_secret_enc=? WHERE organisation_id=?').run(k, org),
    hook: (type, object, { id = 'evt_' + crypto.randomUUID(), created = Math.floor(Date.now() / 1000), livemode = false } = {}) =>
      run({ action: 'webhook', secret: whsec, event: { id, type, created, livemode, data: { object } } }),
    refund: (id) => q('SELECT * FROM fin_refunds WHERE id=?', id),
    totals: () => [q('SELECT refunded_cents n FROM job_payments WHERE id=?', payment).n, q('SELECT paid_cents n FROM work_orders WHERE id=?', job).n],
    notices: () => db.prepare("SELECT body FROM payment_notices WHERE organisation_id=? AND kind='payment_review' ORDER BY rowid").all(org).map((r) => r.body),
    audits: (action) => db.prepare('SELECT user_id,metadata_json FROM audit_logs WHERE organisation_id=? AND action=? ORDER BY rowid').all(org, action),
    lifecycle: () => db.prepare('SELECT * FROM fin_stripe_refund_lifecycle WHERE organisation_id=? ORDER BY rowid').all(org),
    made: () => w.stripe.posts.at(-1).made,
    age: (id) => db.prepare("UPDATE fin_stripe_refund_attempts SET started_at='2000-01-01T00:00:00.000Z' WHERE refund_id=?").run(id),
  };
  return w;
}
const later = (s = 5) => Math.floor(Date.now() / 1000) + s;

// ============ G2 — identity (production path) ============
test('G2: identity is the verified account and mode; restricted or failing keys give no identity and no fallback', async (t) => {
  const w = await world(t);
  assert.deepEqual((await w.identity()).value?.binding, 'stripe:acct_one:test');
  w.key('key-one-live');
  assert.equal((await w.identity()).value?.binding, 'stripe:acct_one:live');
  for (const k of ['key-restricted', 'key-broken', 'key-unknown']) {
    w.key(k);
    assert.equal((await w.identity()).value, null, k + ': no identity in production (no fingerprint fallback)');
    const id = w.newRefund(1000);
    const r = await w.exec(id);
    assert.equal(r.ok, false, k);
    assert.match(r.error, /not available/);
    assert.equal(w.stripe.posts.length, 0, k + ': no financial POST');
    w.db.prepare("UPDATE fin_refunds SET status='rejected' WHERE id=?").run(id);
  }
});

test('G2: same-account rotation preserves recovery of a held refund (response lost) with no second POST', async (t) => {
  const w = await world(t);
  const id = w.newRefund(2500);
  w.stripe.plan.push({ drop: true });
  const first = await w.exec(id);
  assert.equal(first.ok, false);
  assert.equal(w.refund(id).status, 'submitted');
  assert.equal(w.db.prepare('SELECT account_binding b FROM fin_stripe_refund_attempts WHERE refund_id=?').get(id).b, 'stripe:acct_one:test');
  w.key('key-one-b'); // rotated key, same account
  const r = await w.reconcile(id);
  assert.deepEqual(r.value, { ok: true, status: 'completed' }, JSON.stringify(r));
  assert.deepEqual(w.totals(), [2500, 7500]);
  assert.equal(w.stripe.posts.length, 1);
});

test('G2: same-account rotation lets a signed refund.updated complete a pending refund', async (t) => {
  const w = await world(t);
  const id = w.newRefund(4000);
  w.stripe.plan.push({ status: 'pending' });
  assert.equal((await w.exec(id)).ok, true);
  w.key('key-one-b');
  const h = await w.hook('refund.updated', { ...w.made(), status: 'succeeded' }, { created: later() });
  assert.equal(h.status, 200, JSON.stringify(h));
  assert.equal(w.refund(id).status, 'completed');
  assert.deepEqual(w.totals(), [4000, 6000]);
});

test('G2: a different account or a different mode cannot settle, reconcile or extend a bound payment', async (t) => {
  const w = await world(t);
  const id = w.newRefund(4000);
  w.stripe.plan.push({ status: 'pending' });
  await w.exec(id);
  const made = w.made();
  for (const k of ['key-two', 'key-one-live']) {
    w.key(k);
    const h = await w.hook('refund.updated', { ...made, status: 'succeeded' }, { created: later(), livemode: k.endsWith('live') });
    assert.equal(h.status, 409, k + ': event refused');
    assert.notEqual((await w.reconcile(id)).value?.ok, true, k + ': reconcile refused');
    const extra = w.newRefund(1000);
    const e = await w.exec(extra);
    assert.equal(e.ok, false, k + ': new refund on a bound payment refused');
    w.db.prepare("UPDATE fin_refunds SET status='rejected' WHERE id=?").run(extra);
    assert.equal(w.refund(id).status, 'submitted');
    assert.deepEqual(w.totals(), [0, 10000]);
  }
  assert.equal(w.stripe.posts.length, 1, 'no POST to a substituted account');
  w.key('key-one-a');
  assert.equal((await w.hook('refund.updated', { ...made, status: 'succeeded' }, { created: later(), livemode: true })).status, 409, 'live event against a test binding refused');
  assert.equal((await w.hook('refund.updated', { ...made, status: 'succeeded' }, { created: later() })).status, 200);
  assert.equal(w.refund(id).status, 'completed');
});

test('G2: the payment intent must belong to the verified account before any POST', async (t) => {
  const w = await world(t);
  w.db.prepare("UPDATE job_payments SET reference='pi_elsewhere' WHERE id=?").run(w.payment);
  const id = w.newRefund(1000);
  const r = await w.exec(id);
  assert.equal(r.ok, false);
  assert.match(r.error, /payment identity/i);
  assert.equal(w.stripe.posts.length, 0);
});

test('G2: webhook signature is independent of the API key; a forged signature is refused before any provider read', async (t) => {
  const w = await world(t);
  const before = w.stripe.gets.length;
  const forged = await w.run({ action: 'webhook', secret: 'not-the-secret', event: { id: 'evt_forged', type: 'refund.updated', created: later(), livemode: false, data: { object: { object: 'refund', id: 're_x', payment_intent: PI } } } });
  assert.equal(forged.status, 400);
  assert.equal(w.stripe.gets.length, before, 'no provider call for an unauthenticated event');
  w.key('key-one-b'); // API key rotated, webhook secret unchanged
  const ok = await w.hook('refund.updated', { object: 'refund', id: 're_unknown', amount: 1, currency: 'aud', status: 'succeeded', payment_intent: PI, metadata: {} });
  assert.equal(ok.status, 200);
});

// ============ G1 — failure after success (production path) ============
test('G1: refund.failed after success compensates both balances atomically, once, with an owner notice and append-only journal', async (t) => {
  const w = await world(t);
  const id = w.newRefund(4000);
  await w.exec(id);
  assert.deepEqual([w.refund(id).status, ...w.totals()], ['completed', 4000, 6000]);
  const made = w.made(), failedAt = later(10);
  const results = await Promise.all([
    w.hook('refund.failed', { ...made, status: 'failed', failure_reason: 'lost_or_stolen_card' }, { id: 'evt_f1', created: failedAt }),
    w.hook('refund.updated', { ...made, status: 'failed', failure_reason: 'lost_or_stolen_card' }, { id: 'evt_f2', created: failedAt }),
  ]);
  for (const r of results) assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(w.refund(id).status, 'failed');
  assert.deepEqual(w.totals(), [0, 10000], 'compensated exactly once across two concurrent failure events');
  assert.equal((await w.hook('refund.failed', { ...made, status: 'failed' }, { id: 'evt_f1', created: failedAt })).value.duplicate, true);
  assert.deepEqual(w.totals(), [0, 10000]);
  assert.equal(w.lifecycle().filter((l) => l.delta_cents < 0).length, 1);
  assert.ok(w.notices().some((n) => /reversed a previously successful refund/i.test(n)), 'owner notice recorded');
  assert.equal(w.audits('finance.refund_failed_after_success').length, 1);
  // Delayed older success and a later conflicting success cannot undo the decision.
  await w.hook('refund.updated', { ...made, status: 'succeeded' }, { created: failedAt - 5 });
  await w.hook('refund.updated', { ...made, status: 'succeeded' }, { created: failedAt + 5 });
  assert.equal(w.refund(id).status, 'failed');
  assert.deepEqual(w.totals(), [0, 10000]);
  assert.ok(w.notices().some((n) => /conflicting success/i.test(n)));
  // A lower charge total never reverses by itself.
  await w.hook('charge.refunded', { object: 'charge', payment_intent: PI, amount_refunded: 0, currency: 'aud' });
  assert.deepEqual(w.totals(), [0, 10000]);
  // Historical records preserved and append-only.
  assert.ok(w.refund(id), 'request row retained');
  assert.throws(() => w.db.prepare('UPDATE fin_stripe_refund_lifecycle SET delta_cents=0').run(), /append-only/);
  assert.throws(() => w.db.prepare('DELETE FROM fin_stripe_refund_lifecycle').run(), /append-only/);
  assert.equal(verifyAuditChain(w.db, w.org).ok, true);
  assert.equal(w.request(10000).ok, true, 'the full amount is refundable again');
  assert.equal(w.stripe.posts.length, 1, 'compensation sends no financial POST');
});

test('G1: requires_action re-entry with a next action reopens the reservation; a later success settles it once', async (t) => {
  const w = await world(t);
  const id = w.newRefund(3000);
  await w.exec(id);
  const made = w.made();
  await w.hook('refund.updated', { ...made, status: 'requires_action' }, { created: later(5) }); // no next_action
  assert.equal(w.refund(id).status, 'completed', 'without a next action it is not treated as a reversal');
  assert.ok(w.notices().some((n) => /chronology needs review/i.test(n)));
  await w.hook('refund.updated', { ...made, status: 'requires_action', next_action: { type: 'display_details' } }, { created: later(10) });
  assert.equal(w.refund(id).status, 'submitted');
  assert.deepEqual(w.totals(), [0, 10000]);
  assert.equal(w.request(7001).status, 400, 'reservation reopened');
  await w.hook('refund.updated', { ...made, status: 'succeeded' }, { created: later(20) });
  assert.equal(w.refund(id).status, 'completed');
  assert.deepEqual(w.totals(), [3000, 7000]);
  await w.hook('charge.refunded', { object: 'charge', payment_intent: PI, amount_refunded: 3000, currency: 'aud' });
  assert.deepEqual(w.totals(), [3000, 7000], 'no double accounting');
});

test('G1: an undated failure is held for the owner, who reconciles it from the authoritative provider record', async (t) => {
  const w = await world(t);
  const id = w.newRefund(2000);
  await w.exec(id);
  const made = w.made();
  const h = await w.run({ action: 'webhook', secret: w.db.prepare('SELECT stripe_webhook_enc s FROM payment_settings').get().s, event: { id: 'evt_undated', type: 'refund.failed', livemode: false, data: { object: { ...made, status: 'failed' } } } });
  assert.equal(h.status, 200);
  assert.equal(w.refund(id).status, 'completed', 'undated failure does not move money by itself');
  made.status = 'failed';
  w.stripe.refunds.acct_onefalse[0].status = 'failed';
  const r = await w.reconcile(id);
  assert.deepEqual(r.value, { ok: true, status: 'failed' }, JSON.stringify(r));
  assert.deepEqual(w.totals(), [0, 10000]);
  assert.equal(w.stripe.posts.length, 1);
});

// ============ G3 — local balance conflict (production path) ============
test('G3: a local balance conflict is recorded durably, acknowledged once, blocks refunds and is resolved by the owner with no POST', async (t) => {
  const w = await world(t);
  const id = w.newRefund(4000);
  w.stripe.plan.push({ status: 'pending' });
  await w.exec(id);
  w.db.prepare('UPDATE work_orders SET paid_cents=1000 WHERE id=?').run(w.job); // admin edit via PUT /api/saas/finance/jobs/:id
  const made = w.made();
  const h = await w.hook('refund.updated', { ...made, status: 'succeeded' }, { id: 'evt_conflict', created: later() });
  assert.deepEqual([h.status, h.value.outcome], [200, 'refund_reconciliation_required']);
  assert.deepEqual(w.totals(), [0, 1000], 'payment and job unchanged');
  assert.equal(w.refund(id).status, 'submitted');
  const rows = () => w.db.prepare('SELECT * FROM fin_stripe_refund_discrepancies WHERE organisation_id=?').all(w.org);
  assert.equal(rows().length, 1);
  assert.equal(JSON.parse(rows()[0].evidence_json).receipt.id, made.id, 'provider evidence stored');
  assert.ok(w.notices().some((n) => /reconciliation with local balances/i.test(n)));
  assert.equal((await w.hook('refund.updated', { ...made, status: 'succeeded' }, { id: 'evt_conflict', created: later() })).value.duplicate, true);
  assert.equal(rows().length, 1, 'duplicate delivery adds nothing');
  assert.equal(w.request(100).status, 409, 'refunds blocked while unresolved');
  const early = await w.resolve('evt_conflict');
  assert.equal(early.value.status, 409, 'cannot resolve while balances still conflict');
  assert.equal(rows()[0].resolved_at, null);
  w.db.prepare('UPDATE work_orders SET paid_cents=10000 WHERE id=?').run(w.job); // authorised local correction
  w.stripe.refunds.acct_onefalse[0].status = 'succeeded';
  const done = await w.resolve('evt_conflict');
  assert.deepEqual(done.value, { ok: true, status: 'resolved' }, JSON.stringify(done));
  assert.equal(w.refund(id).status, 'completed');
  assert.deepEqual(w.totals(), [4000, 6000]);
  assert.equal(w.audits('finance.stripe_discrepancy_resolved')[0].user_id, OWNER);
  assert.equal(w.stripe.posts.length, 1, 'no additional financial POST');
  assert.equal(w.request(6000).ok, true);
});

test('G3: a storage failure while recording the conflict is never acknowledged; redelivery records it once', async (t) => {
  const w = await world(t);
  w.db.prepare('UPDATE work_orders SET paid_cents=1000 WHERE id=?').run(w.job);
  w.db.exec("CREATE TRIGGER fail_disc BEFORE INSERT ON fin_stripe_refund_discrepancies BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END");
  const charge = { object: 'charge', payment_intent: PI, amount_refunded: 4000, currency: 'aud' };
  const first = await w.hook('charge.refunded', charge, { id: 'evt_store' });
  assert.notEqual(first.status, 200, 'not acknowledged: ' + JSON.stringify(first));
  assert.equal(w.db.prepare("SELECT COUNT(*) n FROM fin_stripe_refund_discrepancies").get().n, 0);
  w.db.exec('DROP TRIGGER fail_disc');
  const again = await w.hook('charge.refunded', charge, { id: 'evt_store' });
  assert.deepEqual([again.status, again.value.outcome], [200, 'refund_reconciliation_required'], JSON.stringify(again));
  assert.equal(w.db.prepare("SELECT COUNT(*) n FROM fin_stripe_refund_discrepancies").get().n, 1);
  assert.deepEqual(w.totals(), [0, 1000]);
});

// ============ F1–F4 still intact on the production path ============
test('F3/F4 production path: overlapping refunds from separate processes post once each and settle exactly', async (t) => {
  const w = await world(t);
  const a = w.newRefund(3000), b = w.newRefund(2000);
  const res = await Promise.all([w.exec(a), w.exec(b), w.exec(a)]);
  assert.ok(res.every((r) => r.ok), JSON.stringify(res));
  assert.equal(w.stripe.posts.length, 2);
  assert.deepEqual(w.totals(), [5000, 5000]);
});
