import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { appendAuditLog, verifyAuditChain } from '../../src/db.js';
import { createJobQueue } from '../../src/job-queue.js';
import { startServer } from '../../scripts/test-server.mjs';
import { seedOwner } from '../../scripts/visual/session.mjs';

const workspace = '/api/saas/workspace-configuration';

function snapshot(db, tenants) {
  const tables = {
    background_jobs: 'id',
    fin_refunds: 'id',
    fin_stripe_refund_attempts: 'refund_id',
    fin_stripe_refund_lifecycle: 'event_id',
    job_payments: 'id',
    work_orders: 'id',
    workspace_configuration_revisions: 'revision',
    audit_logs: 'rowid',
  };
  return tenants.map(tenant => Object.fromEntries(Object.entries(tables).map(([table, order]) =>
    [table, db.prepare(`SELECT * FROM ${table} WHERE organisation_id=? ORDER BY ${order}`).all(tenant)])));
}

async function seedFixture(server, dbPath, owner) {
  const call = (method, url, body) => server.call(method, url, { cookie: owner.cookie, body });
  const initial = await call('GET', workspace);
  assert.equal(initial.status, 200, initial.text);
  const config = { packs: [{ key: 'repair', label: 'Repair', industry: 'custom', provider_references: [] }], activities: [] };
  const approval = await call('POST', workspace + '/approve', {
    expected_revision: 0, expected_context: initial.json.context, configuration: config,
  });
  assert.equal(approval.status, 201, approval.text);

  const db = new Database(dbPath);
  try {
    const now = new Date().toISOString(), job = randomUUID(), payment = randomUUID(), refund = randomUUID();
    db.transaction(() => {
      db.prepare(`INSERT INTO work_orders(id,organisation_id,title,start_at,price_cents,paid_cents,created_at,updated_at)
        VALUES (?,?,?,?,10000,10000,?,?)`).run(job, owner.org, 'Synthetic work order', now, now, now);
      db.prepare(`INSERT INTO job_payments(id,organisation_id,work_order_id,provider,method,status,amount_cents,currency,reference,created_at,updated_at)
        VALUES (?,?,?,'stripe','card','paid',10000,'aud',?,?,?)`).run(payment, owner.org, job, 'pi_' + payment, now, now);
      db.prepare(`INSERT INTO fin_refunds(id,organisation_id,payment_id,work_order_id,amount_cents,reason,status,provider,provider_ref,created_at,updated_at)
        VALUES (?,?,?,?,1000,'Synthetic held refund','submitted','stripe',?,?,?)`).run(refund, owner.org, payment, job, 're_' + refund, now, now);
      db.prepare(`INSERT INTO fin_stripe_refund_attempts(organisation_id,refund_id,payment_id,account_binding,started_at)
        VALUES (?,?,?,'stripe:acct_RestoreFixture:test',?)`).run(owner.org, refund, payment, now);
      db.prepare(`INSERT INTO fin_stripe_refund_lifecycle(organisation_id,payment_id,refund_id,event_id,provider_status,delta_cents)
        VALUES (?,?,?,?,'pending',0)`).run(owner.org, payment, refund, 'evt_' + refund);
      createJobQueue({ db }).enqueue('drill.pending', { refund }, {
        organisationId: owner.org, idempotencyKey: refund, runAt: '2099-01-01T00:00:00.000Z',
      });
      appendAuditLog(db, { organisation_id: owner.org, action: 'finance.refund_submitted', entity_id: refund, metadata: { amount_cents: 1000 } });
    })();
    db.pragma('wal_checkpoint(TRUNCATE)');
    return refund;
  } finally {
    db.close();
  }
}

test('combined synthetic file replica preserves two tenants, queued jobs, pending refunds and workspace audit history', { timeout: 60000 }, async (t) => {
  const bin = process.env.LITESTREAM_BIN;
  assert.ok(bin, 'set LITESTREAM_BIN to the approved local binary');
  assert.equal(createHash('sha256').update(fs.readFileSync(bin)).digest('hex'), 'bbd8b9baa5bd9ae35318bececace384247b71fed4269a3e3cb8a8ac3f6c957bb');
  assert.equal(spawnSync(bin, ['version'], { encoding: 'utf8' }).stdout.trim(), 'v0.3.13');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oprun-combined-restore-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const live = path.join(dir, 'live.sqlite'), target = path.join(dir, 'restored.sqlite'), replica = path.join(dir, 'replica');
  const server = await startServer({ DATABASE_PATH: live });
  let first, second, key;
  try {
    first = await seedOwner({ ...server, dbPath: live }, { email: 'restore-a@example.test' });
    second = await seedOwner({ ...server, dbPath: live }, { email: 'restore-b@example.test' });
    key = await seedFixture(server, live, first);
    await seedFixture(server, live, second);
  } finally {
    await server.stop();
  }
  const tenants = [first.org, second.org];
  const source = new Database(live, { readonly: true });
  const before = snapshot(source, tenants);
  source.close();
  for (const state of before) {
    assert.equal(state.background_jobs[0].status, 'queued');
    assert.equal(state.fin_refunds[0].status, 'submitted');
    assert.equal(state.fin_stripe_refund_lifecycle[0].provider_status, 'pending');
    assert.equal(state.workspace_configuration_revisions.length, 1);
  }

  const cfg = path.join(dir, 'litestream.yml');
  fs.writeFileSync(cfg, `dbs:\n  - path: ${JSON.stringify(live)}\n    replicas:\n      - type: file\n        path: ${JSON.stringify(replica)}\n        sync-interval: 1s\n`);
  const copy = spawn(bin, ['replicate', '-config', cfg], { stdio: 'ignore' });
  const exit = once(copy, 'exit');
  try {
    let result;
    for (let attempt = 0; attempt < 40; attempt++) {
      await delay(250);
      result = spawnSync(bin, ['restore', '-if-replica-exists', '-o', target, 'file://' + replica], { encoding: 'utf8' });
      if (result.status === 0 && fs.existsSync(target)) break;
    }
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(target), 'replica produced a SQLite database');
  } finally {
    copy.kill('SIGTERM');
    await exit;
  }
  const restored = new Database(target);
  try {
    assert.equal(restored.pragma('integrity_check', { simple: true }), 'ok');
    assert.deepEqual(restored.pragma('foreign_key_check'), []);
    assert.equal(verifyAuditChain(restored).ok, true);
    assert.deepEqual(snapshot(restored, tenants), before);
    const queue = createJobQueue({ db: restored, log: {} });
    assert.throws(() => queue.enqueue('drill.pending', {}, { organisationId: second.org, idempotencyKey: key }),
      { code: 'IDEMPOTENCY_KEY_CONFLICT' });
    assert.deepEqual(snapshot(restored, tenants), before);
  } finally {
    restored.close();
  }

  const reopened = await startServer({ DATABASE_PATH: target });
  try {
    for (const owner of [first, second]) {
      const response = await reopened.call('GET', '/api/saas/data-export', { cookie: owner.cookie });
      assert.equal(response.status, 200, response.text);
      const revisions = response.json.data?.tables.workspace_configuration_revisions ?? response.json.tables.workspace_configuration_revisions;
      assert.deepEqual(revisions.map(row => [row.approved_by, row.revision]), [[owner.uid, 1]]);
    }
    const check = new Database(target, { readonly: true });
    try {
      assert.deepEqual(snapshot(check, tenants).map(({ audit_logs, ...data }) => data),
        before.map(({ audit_logs, ...data }) => data));
      assert.equal(verifyAuditChain(check).ok, true);
    } finally {
      check.close();
    }
  } finally {
    await reopened.stop();
  }
});
