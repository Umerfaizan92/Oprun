// PRG-02 / AUD-02: an idempotency key collision must never hand one tenant (or job type, or the platform scope)
// a job that belongs to another. Synthetic, throwaway databases only; no network, no providers.
// Every collision case requires the exact refusal contract; no assertion accepts silence or another outcome.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { createDb } from '../src/db.js';
import { createJobQueue } from '../src/job-queue.js';

const ORG_A = 'org-a-synthetic', ORG_B = 'org-b-synthetic';
const CONFLICT_MESSAGE = 'This idempotency key is already used by a different job.';
const queueModuleUrl = new URL('../src/job-queue.js', import.meta.url).href;

function capture() { const lines = []; return { lines, log: { warn: (...a) => lines.push(a.join(' ')), error: (...a) => lines.push(a.join(' ')), info() {} } }; }
function setup() {
  const db = createDb(':memory:'), out = capture();
  const q = createJobQueue({ db, log: out.log, clock: () => Date.parse('2026-11-28T00:00:00Z') });
  q.register('demo.alpha', () => 'ok');
  q.register('demo.beta', () => 'ok');
  return { db, q, warnings: out.lines, rows: () => db.prepare('SELECT * FROM background_jobs ORDER BY id').all() };
}
// A job owned by ORG_A whose payload, result and error carry sentinels that must never reach another caller.
function seedForeign(f, key = 'shared', org = ORG_A, type = 'demo.alpha') {
  const { job } = f.q.enqueue(type, { sentinel: 'FOREIGN_PAYLOAD' }, { organisationId: org, idempotencyKey: key });
  f.db.prepare('UPDATE background_jobs SET result_json=?,last_error=? WHERE id=?').run('"FOREIGN_RESULT"', 'FOREIGN_ERROR', job.id);
  return { job, forbidden: [job.id, 'FOREIGN_PAYLOAD', 'FOREIGN_RESULT', 'FOREIGN_ERROR', ...(org ? [org] : [])] };
}
function assertConflictError(error, forbidden = []) {
  assert.ok(error instanceof Error, 'a refusal must be an Error');
  assert.equal(error.code, 'IDEMPOTENCY_KEY_CONFLICT');
  assert.equal(error.status, 409);
  assert.equal(error.message, CONFLICT_MESSAGE);
  assert.deepEqual(Object.keys(error).sort(), ['code', 'status'], 'no job, row or other enumerable detail is attached');
  const everything = JSON.stringify(Object.fromEntries(Object.getOwnPropertyNames(error).map((k) => [k, String(error[k])])));
  for (const value of forbidden) assert.equal(everything.includes(value), false, `the error must not contain ${value}`);
}
// The call must throw exactly the conflict; returning anything (including a duplicate) fails the test.
function expectConflict(f, action, forbidden) {
  const before = f.rows(), warningsBefore = f.warnings.length;
  assert.throws(action, (error) => { assertConflictError(error, forbidden); return true; });
  assert.deepEqual(f.rows(), before, 'no row is created, changed or removed by a refused collision');
  const newWarnings = f.warnings.slice(warningsBefore).join('\n');
  assert.equal(f.warnings.length, warningsBefore + 1, 'exactly one warning is logged for a refusal');
  for (const value of forbidden) assert.equal(newWarnings.includes(value), false, `the log must not contain ${value}`);
}

test('same tenant, same type, same key deduplicates to the original job and keeps its payload', () => {
  const f = setup();
  const a = f.q.enqueue('demo.alpha', { n: 1 }, { organisationId: ORG_A, idempotencyKey: 'k1' });
  const b = f.q.enqueue('demo.alpha', { n: 2 }, { organisationId: ORG_A, idempotencyKey: 'k1' });
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
  assert.equal(b.job.id, a.job.id);
  assert.equal(b.job.organisation_id, ORG_A);
  assert.equal(JSON.parse(b.job.payload_json).n, 1);
  assert.equal(f.rows().length, 1);
  assert.equal(f.warnings.length, 0);
});

test('another tenant reusing a key is refused exactly, learns nothing and changes nothing', () => {
  const f = setup(), { job, forbidden } = seedForeign(f);
  expectConflict(f, () => f.q.enqueue('demo.alpha', { n: 2 }, { organisationId: ORG_B, idempotencyKey: 'shared' }), forbidden);
  const rowA = f.db.prepare('SELECT * FROM background_jobs WHERE id=?').get(job.id);
  assert.equal(rowA.organisation_id, ORG_A);
  assert.equal(JSON.parse(rowA.payload_json).sentinel, 'FOREIGN_PAYLOAD');
});

test('the same tenant reusing a key for a different job type is refused exactly', () => {
  const f = setup(), { job } = seedForeign(f, 'typed');
  expectConflict(f, () => f.q.enqueue('demo.beta', {}, { organisationId: ORG_A, idempotencyKey: 'typed' }),
    [job.id, 'FOREIGN_PAYLOAD', 'FOREIGN_RESULT', 'FOREIGN_ERROR']);
});

test('a tenant is refused a platform job\'s key, exactly', () => {
  const f = setup(), { forbidden } = seedForeign(f, 'scope-1', null);
  expectConflict(f, () => f.q.enqueue('demo.alpha', {}, { organisationId: ORG_A, idempotencyKey: 'scope-1' }), forbidden);
});

test('the platform scope (null and omitted organisation) is refused a tenant job\'s key, exactly', () => {
  const f = setup(), { forbidden } = seedForeign(f, 'scope-2', ORG_A);
  expectConflict(f, () => f.q.enqueue('demo.alpha', {}, { idempotencyKey: 'scope-2' }), forbidden);
  expectConflict(f, () => f.q.enqueue('demo.alpha', {}, { organisationId: null, idempotencyKey: 'scope-2' }), forbidden);
});

test('platform scope deduplicates against itself, with null, omitted or undefined organisation alike', () => {
  const f = setup();
  const a = f.q.enqueue('demo.alpha', {}, { idempotencyKey: 'daily:2026-11-28' });
  const b = f.q.enqueue('demo.alpha', {}, { organisationId: null, idempotencyKey: 'daily:2026-11-28' });
  const c = f.q.enqueue('demo.alpha', {}, { organisationId: undefined, idempotencyKey: 'daily:2026-11-28' });
  assert.equal(a.duplicate, false);
  assert.equal(a.job.organisation_id, null);
  for (const r of [b, c]) { assert.equal(r.duplicate, true); assert.equal(r.job.id, a.job.id); }
  assert.equal(f.rows().length, 1);
});

test('jobs without a key are never deduplicated and never collide', () => {
  const f = setup();
  const results = [f.q.enqueue('demo.alpha', {}, { organisationId: ORG_A }), f.q.enqueue('demo.alpha', {}, { organisationId: ORG_B }), f.q.enqueue('demo.alpha', {})];
  assert.deepEqual(results.map((r) => r.duplicate), [false, false, false]);
  assert.equal(new Set(results.map((r) => r.job.id)).size, 3);
  assert.equal(f.rows().length, 3);
});

test('after a refused collision the refused tenant can still enqueue its own new key', () => {
  const f = setup(), { forbidden } = seedForeign(f, 'x');
  expectConflict(f, () => f.q.enqueue('demo.alpha', {}, { organisationId: ORG_B, idempotencyKey: 'x' }), forbidden);
  const fresh = f.q.enqueue('demo.alpha', {}, { organisationId: ORG_B, idempotencyKey: 'y' });
  assert.equal(fresh.duplicate, false);
  assert.equal(fresh.job.organisation_id, ORG_B);
  assert.equal(fresh.job.idempotency_key, 'y');
  assert.equal(f.rows().length, 2);
});

test('rows written before the fix are preserved exactly, dedupe for their own scope and are refused to others', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prg02-'));
  const file = path.join(dir, 'legacy.db');
  try {
    let db = createDb(file);
    createJobQueue({ db, log: capture().log });
    const t = '2026-11-01T00:00:00.000Z';
    db.prepare("INSERT INTO background_jobs(id,type,organisation_id,payload_json,idempotency_key,status,attempts,max_attempts,run_at,result_json,last_error,created_at,updated_at) VALUES ('legacy-1','demo.alpha',?,'{\"v\":\"LEGACY_PAYLOAD\"}','legacy:key','queued',0,5,?,'\"LEGACY_RESULT\"','LEGACY_ERROR',?,?)").run(ORG_A, t, t, t);
    db.prepare("INSERT INTO background_jobs(id,type,organisation_id,payload_json,idempotency_key,status,attempts,max_attempts,run_at,created_at,updated_at) VALUES ('legacy-2','demo.alpha',NULL,'{}','legacy:platform','succeeded',1,5,?,?,?)").run(t, t, t);
    const original = db.prepare('SELECT * FROM background_jobs ORDER BY id').all();
    db.close();

    db = createDb(file);
    const out = capture(), q = createJobQueue({ db, log: out.log });
    q.register('demo.alpha', () => 'ok');
    const f = { db, q, warnings: out.lines, rows: () => db.prepare('SELECT * FROM background_jobs ORDER BY id').all() };
    assert.deepEqual(f.rows(), original, 'reopening with the fixed queue leaves every legacy row byte-for-byte unchanged');
    const own = q.enqueue('demo.alpha', {}, { organisationId: ORG_A, idempotencyKey: 'legacy:key' });
    assert.equal(own.duplicate, true); assert.equal(own.job.id, 'legacy-1');
    const plat = q.enqueue('demo.alpha', {}, { idempotencyKey: 'legacy:platform' });
    assert.equal(plat.duplicate, true); assert.equal(plat.job.id, 'legacy-2');
    expectConflict(f, () => q.enqueue('demo.alpha', {}, { organisationId: ORG_B, idempotencyKey: 'legacy:key' }),
      ['legacy-1', ORG_A, 'LEGACY_PAYLOAD', 'LEGACY_RESULT', 'LEGACY_ERROR']);
    assert.deepEqual(f.rows(), original);
    db.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('two connections to one database file, called one after the other (sequential, not concurrent)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prg02-'));
  const file = path.join(dir, 'shared.db');
  try {
    const db1 = createDb(file), db2 = createDb(file), out2 = capture();
    const q1 = createJobQueue({ db: db1, log: capture().log }), q2 = createJobQueue({ db: db2, log: out2.log });
    const a = q1.enqueue('demo.alpha', { sentinel: 'FOREIGN_PAYLOAD' }, { organisationId: ORG_A, idempotencyKey: 'seq' });
    const b = q2.enqueue('demo.alpha', {}, { organisationId: ORG_A, idempotencyKey: 'seq' });
    assert.equal(a.duplicate, false);
    assert.equal(b.duplicate, true); assert.equal(b.job.id, a.job.id);
    const f2 = { q: q2, warnings: out2.lines, rows: () => db2.prepare('SELECT * FROM background_jobs ORDER BY id').all() };
    expectConflict(f2, () => q2.enqueue('demo.alpha', {}, { organisationId: ORG_B, idempotencyKey: 'seq' }), [a.job.id, ORG_A, 'FOREIGN_PAYLOAD']);
    assert.equal(db1.prepare('SELECT COUNT(*) n FROM background_jobs').get().n, 1);
    db1.close(); db2.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Genuine overlapping writers: separate worker threads, separate WAL connections to one file, released together
// by an Atomics barrier. This is single-host, bounded contention evidence; it is not multi-host or load certification.
const WORKER = `
  const { parentPort, workerData: d } = require('node:worker_threads');
  const Database = require('node:module').createRequire(d.requireBase)('better-sqlite3');
  (async () => {
    const { createJobQueue } = await import(d.moduleUrl);
    const db = new Database(d.file); db.pragma('journal_mode = WAL'); db.pragma('busy_timeout = 10000');
    const q = createJobQueue({ db, log: { warn() {}, error() {} } });
    parentPort.postMessage({ ready: true });
    Atomics.wait(new Int32Array(d.barrier), 0, 0);
    try {
      const r = q.enqueue('demo.race', { sentinel: 'PAYLOAD_' + d.org }, { organisationId: d.org, idempotencyKey: 'simultaneous' });
      parentPort.postMessage({ ok: true, duplicate: r.duplicate, id: r.job.id, org: r.job.organisation_id, payload: r.job.payload_json });
    } catch (e) {
      parentPort.postMessage({ ok: false, code: e.code, status: e.status, message: e.message, keys: Object.keys(e).sort(),
        all: JSON.stringify(Object.fromEntries(Object.getOwnPropertyNames(e).map((k) => [k, String(e[k])]))) });
    } finally { db.close(); }
  })().catch((e) => parentPort.postMessage({ fatal: String(e && e.stack || e) }));
`;
async function race(orgs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prg02-race-')), file = path.join(dir, 'race.db');
  const setupDb = createDb(file); createJobQueue({ db: setupDb, log: capture().log }); setupDb.close();
  const barrier = new SharedArrayBuffer(4), workers = [];
  try {
    const runs = orgs.map((org) => {
      const w = new Worker(WORKER, { eval: true, workerData: { file, org, barrier, moduleUrl: queueModuleUrl, requireBase: import.meta.url } });
      workers.push(w);
      let ready, done, fail;
      const readyP = new Promise((res, rej) => { ready = res; fail = rej; });
      const doneP = new Promise((res, rej) => { done = res; w.on('error', rej); w.on('message', (m) => { if (m.fatal) rej(new Error(m.fatal)); }); });
      w.on('message', (m) => { if (m.ready) ready(); else if (!m.fatal) done({ ...m, requested: org }); });
      w.on('error', fail);
      return { readyP, doneP };
    });
    await Promise.all(runs.map((r) => r.readyP));
    const flag = new Int32Array(barrier); Atomics.store(flag, 0, 1); Atomics.notify(flag, 0);
    const results = await Promise.all(runs.map((r) => r.doneP));
    const check = createDb(file), rows = check.prepare('SELECT * FROM background_jobs').all(); check.close();
    return { results, rows };
  } finally {
    await Promise.all(workers.map((w) => w.terminate()));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('concurrent same-scope writers (4 threads, 3 rounds) create exactly one job and all others receive it', async () => {
  for (let round = 0; round < 3; round++) {
    const { results, rows } = await race([ORG_A, ORG_A, ORG_A, ORG_A]);
    assert.equal(rows.length, 1, `round ${round}: exactly one row`);
    assert.ok(results.every((r) => r.ok), `round ${round}: no same-scope writer is refused`);
    assert.equal(results.filter((r) => r.duplicate === false).length, 1, `round ${round}: exactly one insert wins`);
    assert.equal(results.filter((r) => r.duplicate === true).length, 3);
    assert.ok(results.every((r) => r.id === rows[0].id && r.org === ORG_A));
  }
});

test('concurrent cross-tenant writers (4 tenants, 3 rounds): one wins, every other is refused exactly and sees nothing foreign', async () => {
  const orgs = ['org-race-1', 'org-race-2', 'org-race-3', 'org-race-4'];
  for (let round = 0; round < 3; round++) {
    const { results, rows } = await race(orgs);
    assert.equal(rows.length, 1, `round ${round}: exactly one row`);
    const winners = results.filter((r) => r.ok), losers = results.filter((r) => !r.ok);
    assert.equal(winners.length, 1, `round ${round}: exactly one writer succeeds`);
    assert.equal(winners[0].duplicate, false);
    assert.equal(winners[0].org, winners[0].requested, 'the winner receives only its own job');
    assert.equal(rows[0].organisation_id, winners[0].requested);
    assert.equal(rows[0].id, winners[0].id);
    assert.equal(losers.length, 3);
    for (const l of losers) {
      assert.equal(l.code, 'IDEMPOTENCY_KEY_CONFLICT');
      assert.equal(l.status, 409);
      assert.equal(l.message, CONFLICT_MESSAGE);
      assert.deepEqual(l.keys, ['code', 'status']);
      for (const value of [rows[0].id, rows[0].organisation_id, rows[0].payload_json, 'PAYLOAD_' + winners[0].requested]) assert.equal(l.all.includes(value), false);
    }
  }
});
