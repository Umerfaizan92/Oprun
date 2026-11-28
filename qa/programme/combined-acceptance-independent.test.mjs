// Claude independent combined acceptance (Checkpoint 037). Bounded cross-programme assertions that the
// combined restore drill does not make: a pending refund created through the real approval path survives a
// checksum-verified Litestream file restore, the restored server sends no provider write on start, the pending
// refund settles exactly once afterwards, the queue key stays tenant-bound, workspace rollback history survives,
// staff are refused, and each owner's export contains no other tenant's rows. Synthetic local storage only.
// Run with NODE_ENV and OPRUN_TEST_STRIPE_COMPAT unset (production identity path) and LITESTREAM_BIN set.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { verifyAuditChain } from '../../src/db.js';
import { createJobQueue } from '../../src/job-queue.js';
import { startServer } from '../../scripts/test-server.mjs';
import { seedOwner } from '../../scripts/visual/session.mjs';

const LITESTREAM_SHA256 = 'bbd8b9baa5bd9ae35318bececace384247b71fed4269a3e3cb8a8ac3f6c957bb';
const fake = (p) => p + crypto.randomBytes(12).toString('hex');
const WS = '/api/saas/workspace-configuration';

function provider() {
  const log = [], refunds = [];
  const keyOrg = new Map();
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    const u = new URL(req.url, 'http://x'), auth = String(req.headers.authorization || '');
    const send = (code, v) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(v)); };
    log.push({ method: req.method, path: u.pathname, org: keyOrg.get(auth.replace(/^Bearer /, '')) ?? 'unknown', idem: req.headers['idempotency-key'] });
    if (!keyOrg.has(auth.replace(/^Bearer /, ''))) return send(401, { error: { type: 'invalid_request_error' } });
    const acct = 'acct_' + keyOrg.get(auth.replace(/^Bearer /, '')).replace(/-/g, '').slice(0, 12);
    if (u.pathname === '/v1/account') return send(200, { object: 'account', id: acct });
    if (u.pathname === '/v1/balance') return send(200, { object: 'balance', livemode: false });
    if (u.pathname.startsWith('/v1/payment_intents/')) return send(200, { object: 'payment_intent', id: decodeURIComponent(u.pathname.split('/').pop()), currency: 'aud', livemode: false, status: 'succeeded' });
    if (u.pathname === '/v1/refunds' && req.method === 'GET') {
      const pi = u.searchParams.get('payment_intent');
      return send(200, { object: 'list', has_more: false, data: refunds.filter((r) => !pi || r.payment_intent === pi) });
    }
    if (u.pathname === '/v1/refunds' && req.method === 'POST') {
      const p = new URLSearchParams(body);
      const r = { id: 're_' + crypto.randomUUID().slice(0, 10), object: 'refund', amount: Number(p.get('amount')), currency: 'aud', payment_intent: p.get('payment_intent'), livemode: false, status: 'pending',
        metadata: Object.fromEntries([...p].filter(([k]) => k.startsWith('metadata[')).map(([k, v]) => [k.slice(9, -1), v])) };
      refunds.unshift(r); return send(200, r);
    }
    send(404, { error: { type: 'invalid_request_error', code: 'resource_missing' } });
  });
  return { server, log, refunds, keyOrg, posts: () => log.filter((c) => c.method !== 'GET') };
}

function seedStaff(dbPath, org, email) {
  const db = new Database(dbPath), now = new Date().toISOString(), uid = crypto.randomUUID(), token = crypto.randomBytes(24).toString('hex');
  try {
    db.prepare('INSERT INTO users (id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(uid, email, 'Staff Member', 'x', 'x', now, now);
    try { db.prepare('UPDATE users SET email_verified=1,phone_verified=1 WHERE id=?').run(uid); } catch { /* older schema */ }
    db.prepare("INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,'staff',?)").run(org, uid, now);
    db.prepare('INSERT INTO user_sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(), uid, crypto.createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 3600000).toISOString(), now, now);
  } finally { db.close(); }
  return { uid, cookie: 'fp_session=' + token };
}

const TABLES = ['background_jobs', 'fin_refunds', 'fin_stripe_refund_attempts', 'fin_stripe_refund_lifecycle', 'fin_stripe_refund_discrepancies', 'fin_stripe_refund_totals', 'job_payments', 'work_orders', 'workspace_configuration_revisions', 'payment_events'];
function snapshot(dbPath, orgs) {
  const db = new Database(dbPath, { readonly: true });
  try {
    return orgs.map((o) => Object.fromEntries(TABLES.map((t) => [t, db.prepare(`SELECT * FROM ${t} WHERE organisation_id=? ORDER BY rowid`).all(o)])));
  } finally { db.close(); }
}
const rowsOf = (dbPath, sql, ...args) => { const db = new Database(dbPath, { readonly: true }); try { return db.prepare(sql).all(...args); } finally { db.close(); } };

test('combined: real pending refund, workspace rollback history and tenant-bound queue survive restore; no provider write on restart; exactly-once settlement; staff refused; exports tenant-pure', { timeout: 240000 }, async (t) => {
  assert.equal(process.env.NODE_ENV, undefined, 'parent NODE_ENV must be unset');
  assert.equal(process.env.OPRUN_TEST_STRIPE_COMPAT, undefined, 'compatibility opt-in must be unset');
  const bin = process.env.LITESTREAM_BIN;
  assert.ok(bin && fs.existsSync(bin), 'LITESTREAM_BIN must point to the approved binary');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(bin)).digest('hex'), LITESTREAM_SHA256);
  assert.equal(spawnSync(bin, ['version'], { encoding: 'utf8' }).stdout.trim(), 'v0.3.13');

  const p = provider();
  await new Promise((r) => p.server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => p.server.close(r)));
  const STRIPE_API_BASE_URL = `http://127.0.0.1:${p.server.address().port}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-combined-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  // A restore must use the same integration encryption key as the source (stored separately in production).
  const INTEGRATION_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  const live = path.join(dir, 'live.sqlite'), target = path.join(dir, 'restored.sqlite'), replica = path.join(dir, 'replica');

  // ---------- live server: two tenants, staff, revisions, payments, queue, real refund path ----------
  const s = await startServer({ DATABASE_PATH: live, STRIPE_API_BASE_URL, INTEGRATION_ENCRYPTION_KEY });
  const tenants = [];
  let staff, refundId, queueKey;
  try {
    for (const name of ['a', 'b']) {
      const o = await seedOwner({ ...s, dbPath: live }, { email: `cmb-${name}@example.test`, business: 'Combined ' + name.toUpperCase() });
      const key = fake(['sk', 'test', ''].join('_')), whsec = fake('whsec_');
      p.keyOrg.set(key, o.org);
      const put = await s.call('PUT', '/api/saas/payments/settings', { cookie: o.cookie, body: { stripe_secret_key: key, stripe_webhook_secret: whsec, terms_days: 14 } });
      assert.equal(put.status, 200, put.text);
      tenants.push({ ...o, key, whsec });
    }
    const [A, B] = tenants;
    staff = seedStaff(live, A.org, 'cmb-staff@example.test');

    // Workspace revisions: A approves 1 and 2, then rolls back to 1 (revision 3); B approves 1.
    const cfg = (key) => ({ packs: [{ key, label: key, industry: 'custom', provider_references: [] }], activities: [] });
    for (const [o, steps] of [[A, ['repair', 'install', 'rollback']], [B, ['cleaning']]]) {
      for (const step of steps) {
        const head = await s.call('GET', WS, { cookie: o.cookie });
        assert.equal(head.status, 200, head.text);
        const body = step === 'rollback' ? { expected_revision: head.json.revision, expected_context: head.json.context, target_revision: 1 }
          : { expected_revision: head.json.revision, expected_context: head.json.context, configuration: cfg(step) };
        const r = await s.call('POST', WS + (step === 'rollback' ? '/rollback' : '/approve'), { cookie: o.cookie, body });
        assert.equal(r.status, 201, r.text);
      }
    }
    // Staff authority: no workspace read or approval, no export, no refund request.
    const head = await s.call('GET', WS, { cookie: A.cookie });
    assert.equal((await s.call('GET', WS, { cookie: staff.cookie })).status, 403);
    assert.equal((await s.call('POST', WS + '/approve', { cookie: staff.cookie, body: { expected_revision: head.json.revision, expected_context: head.json.context, configuration: cfg('staff') } })).status, 403);
    assert.equal((await s.call('GET', '/api/saas/data-export', { cookie: staff.cookie })).status, 403);

    // Paid card payments for both tenants (synthetic rows, as in the H3 harness).
    const db = new Database(live), now = new Date().toISOString();
    for (const o of tenants) {
      o.job = crypto.randomUUID(); o.pay = crypto.randomUUID(); o.pi = 'pi_cmb_' + o.org.slice(0, 8);
      db.prepare("INSERT INTO work_orders(id,organisation_id,title,start_at,required_skills,status,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,'[]','completed',10000,10000,?,?)").run(o.job, o.org, 'Combined job', now, now, now);
      db.prepare("INSERT INTO job_payments (id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',10000,'aud',?,?,?)").run(o.pay, o.org, o.job, o.pi, now, now);
    }
    // Queue row for A under a key that B must never be able to claim.
    queueKey = 'cmb-' + crypto.randomUUID();
    createJobQueue({ db, log: {} }).enqueue('drill.pending', { note: 'synthetic' }, { organisationId: A.org, idempotencyKey: queueKey, runAt: '2099-01-01T00:00:00.000Z' });
    db.close();

    assert.notEqual((await s.call('POST', `/api/saas/finance/payments/${A.pay}/refund`, { cookie: staff.cookie, body: { amount: 40, reason: 'Staff should not refund' } })).status, 201, 'staff cannot request a refund');
    const req = await s.call('POST', `/api/saas/finance/payments/${A.pay}/refund`, { cookie: A.cookie, body: { amount: 40, reason: 'Combined synthetic refund' } });
    assert.equal(req.status, 201, req.text);
    refundId = req.json.refund_id;
    assert.equal(p.posts().length, 0, 'no money moves before approval');
    await sleep(100);
    const approvals = (await s.call('GET', '/api/saas/approvals', { cookie: A.cookie })).json.approvals;
    const ap = approvals.find((a) => a.automation_run_id === req.json.run_id);
    assert.ok(ap, 'approval exists');
    assert.equal((await s.call('POST', `/api/saas/approvals/${ap.id}/decision`, { cookie: A.cookie, body: { decision: 'approve' } })).status, 200);
    for (let i = 0; i < 40 && !p.posts().length; i++) await sleep(100);
    assert.equal(p.posts().length, 1, 'exactly one provider refund');
    assert.deepEqual([p.posts()[0].path, p.posts()[0].org], ['/v1/refunds', A.org], 'dispatched with A credentials only');
    await sleep(300);
    const row = rowsOf(live, 'SELECT status FROM fin_refunds WHERE id=?', refundId)[0];
    assert.equal(row.status, 'submitted', 'pending refund is held as submitted');
    assert.deepEqual(rowsOf(live, 'SELECT refunded_cents r FROM job_payments WHERE id=?', A.pay)[0].r, 0, 'pending refund does not move the balance');
  } finally { await s.stop(); }

  const [A, B] = tenants;
  const orgs = [A.org, B.org];
  const before = snapshot(live, orgs);
  assert.equal(before[0].fin_stripe_refund_attempts.length, 1);
  assert.deepEqual(before[0].workspace_configuration_revisions.map((r) => [r.revision, r.restored_from]), [[1, null], [2, null], [3, 1]]);
  assert.deepEqual(before[1].workspace_configuration_revisions.map((r) => r.revision), [1]);
  assert.equal(before[1].fin_refunds.length, 0);

  // ---------- checksum-verified Litestream file replica and restore ----------
  { const db = new Database(live); db.pragma('wal_checkpoint(TRUNCATE)'); db.close(); }
  const yml = path.join(dir, 'litestream.yml');
  fs.writeFileSync(yml, `dbs:\n  - path: ${JSON.stringify(live)}\n    replicas:\n      - type: file\n        path: ${JSON.stringify(replica)}\n        sync-interval: 1s\n`);
  const rep = spawn(bin, ['replicate', '-config', yml], { stdio: 'ignore' });
  const repExit = once(rep, 'exit');
  try {
    let r;
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      r = spawnSync(bin, ['restore', '-if-replica-exists', '-o', target, 'file://' + replica], { encoding: 'utf8' });
      if (r.status === 0 && fs.existsSync(target)) break;
    }
    assert.equal(r.status, 0, r.stderr);
  } finally { rep.kill('SIGTERM'); await repExit; }
  {
    const db = new Database(target, { readonly: true });
    try {
      assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
      assert.equal(verifyAuditChain(db).ok, true, 'audit chain intact after restore');
    } finally { db.close(); }
  }
  assert.deepEqual(snapshot(target, orgs), before, 'every financial, queue and revision row restored exactly');

  // ---------- restored server: no provider write on start ----------
  const postsBefore = p.posts().length;
  const r2 = await startServer({ DATABASE_PATH: target, STRIPE_API_BASE_URL, INTEGRATION_ENCRYPTION_KEY });
  try {
    await sleep(5000);
    assert.equal(p.posts().length, postsBefore, 'restart dispatches no refund and replays nothing');
    assert.deepEqual(snapshot(target, orgs), before, 'restart changes no financial, queue or revision row');

    // Queue: A's key is still A's; B cannot claim it after restore.
    {
      const db = new Database(target);
      try {
        const q = createJobQueue({ db, log: {} });
        assert.throws(() => q.enqueue('drill.pending', {}, { organisationId: B.org, idempotencyKey: queueKey }), { code: 'IDEMPOTENCY_KEY_CONFLICT' });
        const again = q.enqueue('drill.pending', { note: 'synthetic' }, { organisationId: A.org, idempotencyKey: queueKey, runAt: '2099-01-01T00:00:00.000Z' });
        assert.deepEqual([again.duplicate, again.job.id], [true, before[0].background_jobs[0].id], 'same tenant and type dedupes to the restored row');
      } finally { db.close(); }
    }

    // Exports after restore: authenticated, owner-only, tenant-pure, revisions with rollback provenance.
    for (const [me, other] of [[A, B], [B, A]]) {
      const ex = await r2.call('GET', '/api/saas/data-export', { cookie: me.cookie });
      assert.equal(ex.status, 200, ex.text);
      const tables = ex.json.data?.tables ?? ex.json.tables;
      assert.ok(tables && typeof tables === 'object', 'export has tables');
      assert.ok(!JSON.stringify(ex.json).includes(other.org), 'export contains no identifier of the other tenant');
      for (const [name, rows] of Object.entries(tables)) {
        if (!Array.isArray(rows)) continue;
        for (const row of rows) if (row && 'organisation_id' in row && row.organisation_id !== null) assert.equal(row.organisation_id, me.org, `${name} row belongs to the exporting tenant`);
      }
      const revs = tables.workspace_configuration_revisions.map((x) => [x.revision, x.restored_from ?? null]);
      assert.deepEqual(revs, me === A ? [[1, null], [2, null], [3, 1]] : [[1, null]]);
    }
    assert.equal((await r2.call('GET', '/api/saas/data-export', { cookie: staff.cookie })).status, 403, 'staff still refused after restore');
    assert.equal((await r2.call('GET', WS, { cookie: staff.cookie })).status, 403);

    // The held refund settles once from a signed provider event after restore.
    const made = p.refunds.find((x) => x.metadata.refund_request_id === refundId) ?? p.refunds[0];
    made.status = 'succeeded';
    const send = async (o, event) => {
      const body = JSON.stringify(event), ts = Math.floor(Date.now() / 1000), sig = crypto.createHmac('sha256', o.whsec).update(`${ts}.${body}`).digest('hex');
      const res = await fetch(`${r2.base}/api/webhooks/payments/stripe/${o.org}`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` }, body, signal: AbortSignal.timeout(15000) });
      return { status: res.status, json: await res.json().catch(() => null) };
    };
    const event = { id: 'evt_cmb_' + crypto.randomUUID().slice(0, 8), type: 'refund.updated', created: Math.floor(Date.now() / 1000), livemode: false, data: { object: { ...made } } };
    const first = await send(A, event);
    assert.equal(first.status, 200, JSON.stringify(first.json) + '\n' + r2.log().slice(-4000));
    const balances = () => [rowsOf(target, 'SELECT refunded_cents r FROM job_payments WHERE id=?', A.pay)[0].r, rowsOf(target, 'SELECT paid_cents p FROM work_orders WHERE id=?', A.job)[0].p,
      rowsOf(target, 'SELECT refunded_cents r FROM job_payments WHERE id=?', B.pay)[0].r, rowsOf(target, 'SELECT paid_cents p FROM work_orders WHERE id=?', B.job)[0].p];
    assert.equal(rowsOf(target, 'SELECT status FROM fin_refunds WHERE id=?', refundId)[0].status, 'completed');
    assert.deepEqual(balances(), [4000, 6000, 0, 10000], 'exact balances; other tenant untouched');
    const dup = await send(A, event);
    assert.equal(dup.status, 200);
    assert.equal(dup.json?.duplicate, true, 'redelivery is a duplicate');
    const charge = { id: 'evt_cmb_c_' + crypto.randomUUID().slice(0, 8), type: 'charge.refunded', created: Math.floor(Date.now() / 1000), livemode: false, data: { object: { object: 'charge', payment_intent: A.pi, amount_refunded: 4000, currency: 'aud' } } };
    assert.equal((await send(A, charge)).status, 200);
    assert.deepEqual(balances(), [4000, 6000, 0, 10000], 'cumulative charge total adds nothing');
    // A's signed event cannot be replayed against B.
    assert.notEqual((await send({ ...B, whsec: A.whsec }, event)).status, 200, 'A-signed event refused for B');
    assert.deepEqual(balances(), [4000, 6000, 0, 10000]);
    assert.equal(p.posts().length, postsBefore, 'no provider write after restore at any point');
    assert.equal(p.log.filter((c) => c.org === 'unknown').length, 0, 'every provider call used a configured tenant key');
    const db = new Database(target, { readonly: true });
    try { assert.equal(verifyAuditChain(db).ok, true); } finally { db.close(); }
  } finally { await r2.stop(); }
});

// Existing subscriber upgrade: a database written by the current production baseline (main 234f56d) is opened by the
// combined server. Set OPRUN_MAIN_TREE to a detached checkout of 234f56d that shares the same installed dependencies.
test('combined: a subscriber database from the main baseline upgrades with data, payment configuration, queue rows and legacy industry preserved', { timeout: 180000 }, async (t) => {
  assert.equal(process.env.NODE_ENV, undefined, 'parent NODE_ENV must be unset');
  assert.equal(process.env.OPRUN_TEST_STRIPE_COMPAT, undefined, 'compatibility opt-in must be unset');
  const mainTree = process.env.OPRUN_MAIN_TREE;
  assert.ok(mainTree && fs.existsSync(path.join(mainTree, 'src', 'server.js')), 'OPRUN_MAIN_TREE must point to the main baseline checkout');
  assert.equal(spawnSync('git', ['-C', mainTree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), '234f56d9818da0590d5dabf1a4fa7b7a8139a7dd');
  const mainServer = await import(path.join(mainTree, 'scripts', 'test-server.mjs'));
  const mainSession = await import(path.join(mainTree, 'scripts', 'visual', 'session.mjs'));

  const p = provider();
  await new Promise((r) => p.server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => p.server.close(r)));
  const STRIPE_API_BASE_URL = `http://127.0.0.1:${p.server.address().port}`;
  const INTEGRATION_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-upgrade-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const dbPath = path.join(dir, 'subscriber.sqlite');

  // ---------- baseline server writes the subscriber's data ----------
  const m = await mainServer.startServer({ DATABASE_PATH: dbPath, STRIPE_API_BASE_URL, INTEGRATION_ENCRYPTION_KEY });
  const tenants = [];
  try {
    for (const name of ['a', 'b']) {
      const o = await mainSession.seedOwner({ ...m, dbPath }, { email: `up-${name}@example.test`, business: 'Upgrade ' + name.toUpperCase() });
      const key = fake(['sk', 'test', ''].join('_')), whsec = fake('whsec_');
      p.keyOrg.set(key, o.org);
      const put = await m.call('PUT', '/api/saas/payments/settings', { cookie: o.cookie, body: { stripe_secret_key: key, stripe_webhook_secret: whsec, terms_days: 14 } });
      assert.equal(put.status, 200, put.text);
      tenants.push({ ...o, key, whsec });
    }
  } finally { await m.stop(); }
  const [A, B] = tenants;
  {
    const db = new Database(dbPath), now = new Date().toISOString();
    try {
      db.prepare("UPDATE onboarding_profiles SET industry_code='plumbing' WHERE organisation_id=?").run(A.org);
      if (!db.prepare('SELECT 1 FROM onboarding_profiles WHERE organisation_id=?').get(A.org)) {
        const cols = db.prepare('PRAGMA table_info(onboarding_profiles)').all().map((c) => c.name);
        const fields = { organisation_id: A.org, industry_code: 'plumbing', created_at: now, updated_at: now };
        const use = Object.keys(fields).filter((k) => cols.includes(k));
        db.prepare(`INSERT INTO onboarding_profiles (${use.join(',')}) VALUES (${use.map(() => '?').join(',')})`).run(...use.map((k) => fields[k]));
      }
      for (const o of tenants) {
        o.job = crypto.randomUUID(); o.pay = crypto.randomUUID();
        db.prepare("INSERT INTO work_orders(id,organisation_id,title,start_at,required_skills,status,price_cents,paid_cents,created_at,updated_at) VALUES (?,?,?,?,'[]','completed',10000,10000,?,?)").run(o.job, o.org, 'Legacy job', now, now, now);
        db.prepare("INSERT INTO job_payments (id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at) VALUES (?,?,?,'stripe','card','paid',10000,'aud',?,?,?)").run(o.pay, o.org, o.job, 'pi_up_' + o.org.slice(0, 8), now, now);
        db.prepare("INSERT INTO background_jobs (id,type,organisation_id,payload_json,idempotency_key,max_attempts,run_at,created_at,updated_at) VALUES (?,?,?,?,?,5,?,?,?)").run(crypto.randomUUID(), 'legacy.pending', o.org, '{}', 'legacy-' + o.org, '2099-01-01T00:00:00.000Z', now, now);
      }
    } finally { db.close(); }
  }
  const legacyRows = (file) => rowsOf(file, `SELECT 'org' t, id, name, slug FROM organisations UNION ALL SELECT 'member', organisation_id, user_id, role FROM memberships
    UNION ALL SELECT 'job', id, organisation_id, paid_cents FROM work_orders UNION ALL SELECT 'pay', id, organisation_id, status || ':' || amount_cents FROM job_payments
    UNION ALL SELECT 'queue', id, organisation_id, idempotency_key || ':' || status FROM background_jobs WHERE type='legacy.pending'
    UNION ALL SELECT 'settings', organisation_id, stripe_secret_enc, stripe_webhook_enc FROM payment_settings ORDER BY 1,2,3`);
  const before = legacyRows(dbPath);
  const auditBefore = rowsOf(dbPath, 'SELECT COUNT(*) n FROM audit_logs')[0].n;

  // ---------- the combined server opens the same database ----------
  const c = await startServer({ DATABASE_PATH: dbPath, STRIPE_API_BASE_URL, INTEGRATION_ENCRYPTION_KEY });
  try {
    assert.doesNotMatch(c.log(), /FAIL|integrity failure/i, 'startup checks raise no failure');
    assert.deepEqual(legacyRows(dbPath), before, 'every legacy row and stored credential is unchanged by schema installation');
    const db = new Database(dbPath, { readonly: true });
    try {
      assert.equal(verifyAuditChain(db).ok, true, 'audit chain still verifies after upgrade');
      assert.ok(db.prepare('SELECT COUNT(*) n FROM audit_logs').get().n >= auditBefore);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM workspace_configuration_revisions').get().n, 0, 'no revision is invented for existing subscribers');
      assert.deepEqual(db.prepare('SELECT refunded_cents r FROM job_payments ORDER BY organisation_id').all().map((x) => x.r), [0, 0], 'refund total column added with zero');
    } finally { db.close(); }
    // Revision zero is the live legacy projection; the stored industry survives.
    const wsA = await c.call('GET', WS, { cookie: A.cookie });
    assert.equal(wsA.status, 200, wsA.text);
    assert.deepEqual([wsA.json.revision, wsA.json.legacy_industry], [0, 'plumbing']);
    // Payment configuration written by the baseline is still usable and now verifies stable account identity.
    for (const o of tenants) {
      const settings = await c.call('GET', '/api/saas/payments/settings', { cookie: o.cookie });
      assert.equal(settings.status, 200, settings.text);
      const check = await c.call('POST', '/api/saas/payments/settings/test', { cookie: o.cookie, body: { provider: 'stripe' } });
      assert.equal(check.status, 200, check.text);
      assert.equal(check.json.checks.account, 'verified');
      assert.equal(check.json.checks.refund_write, 'not_checked');
    }
    assert.equal(p.posts().length, 0, 'upgrade and checks send no provider write');
    // Legacy queue keys stay tenant-bound under the combined queue.
    {
      const db = new Database(dbPath);
      try {
        const q = createJobQueue({ db, log: {} });
        assert.throws(() => q.enqueue('legacy.pending', {}, { organisationId: B.org, idempotencyKey: 'legacy-' + A.org }), { code: 'IDEMPOTENCY_KEY_CONFLICT' });
        assert.equal(q.enqueue('legacy.pending', {}, { organisationId: A.org, idempotencyKey: 'legacy-' + A.org }).duplicate, true);
      } finally { db.close(); }
    }
    // A first owner approval on the upgraded database creates revision 1 and is exported; the other tenant has none.
    const ap = await c.call('POST', WS + '/approve', { cookie: A.cookie, body: { expected_revision: 0, expected_context: wsA.json.context, configuration: { packs: [{ key: 'plumbing', label: 'Plumbing', industry: 'custom', provider_references: [] }], activities: [] } } });
    assert.equal(ap.status, 201, ap.text);
    const exA = await c.call('GET', '/api/saas/data-export', { cookie: A.cookie }), exB = await c.call('GET', '/api/saas/data-export', { cookie: B.cookie });
    assert.equal(exA.status, 200, exA.text); assert.equal(exB.status, 200, exB.text);
    const tables = (ex) => ex.json.data?.tables ?? ex.json.tables;
    assert.deepEqual(tables(exA).workspace_configuration_revisions.map((x) => x.revision), [1]);
    assert.deepEqual(tables(exB).workspace_configuration_revisions, []);
    assert.ok(!JSON.stringify(exA.json).includes(B.org) && !JSON.stringify(exB.json).includes(A.org), 'exports are tenant-pure');
  } finally { await c.stop(); }
});
