import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { Worker } from 'node:worker_threads';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import crypto from 'node:crypto';
import { installStudioEditor } from '../../src/studio-editor.js';

const moduleUrl = process.env.QUEUE_REVIEW_MODULE ? pathToFileURL(process.env.QUEUE_REVIEW_MODULE).href : new URL('../../src/job-queue.js', import.meta.url).href;
const { createJobQueue } = await import(moduleUrl);
function fixture() {
  const db = new Database(':memory:'), warnings = [];
  const q = createJobQueue({ db, log: { warn: (...s) => warnings.push(s.join(' ')) } });
  const first = q.enqueue('review.alpha', { sentinel: 'FOREIGN_PAYLOAD' }, { organisationId: 'foreign-tenant', idempotencyKey: 'collision' });
  db.prepare("UPDATE background_jobs SET result_json=?,last_error=? WHERE id=?").run('FOREIGN_RESULT', 'FOREIGN_ERROR', first.job.id);
  return { db, q, warnings, first, rows: () => db.prepare('SELECT * FROM background_jobs ORDER BY id').all() };
}
function conflict(action, forbidden = []) {
  assert.throws(action, error => {
    assert.equal(error.code, 'IDEMPOTENCY_KEY_CONFLICT');
    assert.equal(error.status, 409);
    assert.equal(error.message, 'This idempotency key is already used by a different job.');
    assert.deepEqual(Object.keys(error).sort(), ['code', 'status']);
    const all = JSON.stringify(Object.fromEntries(Object.getOwnPropertyNames(error).map(key => [key, error[key]])));
    for (const value of forbidden) assert.equal(all.includes(value), false, 'foreign details must not appear anywhere on the error');
    return true;
  });
}

test('cross-tenant refusal is exactly 409, reveals no foreign details and changes no row', () => {
  const f = fixture();
  try {
    const before = f.rows(), denied = [f.first.job.id, 'foreign-tenant', 'FOREIGN_PAYLOAD', 'FOREIGN_RESULT', 'FOREIGN_ERROR'];
    conflict(() => f.q.enqueue('review.alpha', {}, { organisationId: 'requesting-tenant', idempotencyKey: 'collision' }), denied);
    assert.deepEqual(f.rows(), before);
    for (const value of denied) assert.equal(f.warnings.join(' ').includes(value), false);
  } finally { f.db.close(); }
});

test('same-tenant different-type refusal is exactly 409 and changes no row', () => {
  const f = fixture();
  try {
    const before = f.rows();
    conflict(() => f.q.enqueue('review.beta', {}, { organisationId: 'foreign-tenant', idempotencyKey: 'collision' }), [f.first.job.id, 'FOREIGN_PAYLOAD', 'FOREIGN_RESULT', 'FOREIGN_ERROR']);
    assert.deepEqual(f.rows(), before);
  } finally { f.db.close(); }
});

test('platform and tenant scopes reject each other in both directions', () => {
  const f = fixture();
  try {
    let before = f.rows();
    conflict(() => f.q.enqueue('review.alpha', {}, { idempotencyKey: 'collision' }), [f.first.job.id, 'foreign-tenant']);
    assert.deepEqual(f.rows(), before);
    const p = f.q.enqueue('review.alpha', { sentinel: 'PLATFORM_PAYLOAD' }, { idempotencyKey: 'platform-key' });
    before = f.rows();
    conflict(() => f.q.enqueue('review.alpha', {}, { organisationId: 'requesting-tenant', idempotencyKey: 'platform-key' }), [p.job.id, 'PLATFORM_PAYLOAD']);
    assert.deepEqual(f.rows(), before);
    assert.equal(f.q.enqueue('review.alpha', {}, { organisationId: null, idempotencyKey: 'platform-key' }).job.id, p.job.id);
  } finally { f.db.close(); }
});

test('propagated nested conflict rolls back all caller writes', () => {
  const f = fixture();
  try {
    f.db.exec('CREATE TABLE caller_rows(id TEXT PRIMARY KEY)');
    const before = f.rows();
    conflict(() => f.db.transaction(() => {
      f.db.prepare('INSERT INTO caller_rows VALUES (?)').run('must-rollback');
      f.q.enqueue('review.alpha', {}, { organisationId: 'requesting-tenant', idempotencyKey: 'collision' });
    })());
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM caller_rows').get().n, 0);
    assert.deepEqual(f.rows(), before);
    assert.equal(f.db.inTransaction, false);
  } finally { f.db.close(); }
});

test('caught inner conflict preserves outer work; outer failure rolls back a successful enqueue', () => {
  const f = fixture();
  try {
    f.db.exec('CREATE TABLE caller_rows(id TEXT PRIMARY KEY)');
    const before = f.rows();
    f.db.transaction(() => {
      conflict(() => f.q.enqueue('review.alpha', {}, { organisationId: 'requesting-tenant', idempotencyKey: 'collision' }));
      f.db.prepare('INSERT INTO caller_rows VALUES (?)').run('outer-survives');
    })();
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM caller_rows').get().n, 1);
    assert.deepEqual(f.rows(), before);
    assert.throws(() => f.db.transaction(() => {
      f.q.enqueue('review.alpha', {}, { organisationId: 'requesting-tenant', idempotencyKey: 'new-key' });
      throw new Error('outer-rejected');
    })(), /outer-rejected/);
    assert.deepEqual(f.rows(), before);
    assert.equal(f.q.enqueue('review.alpha', {}, { organisationId: 'requesting-tenant', idempotencyKey: 'new-key' }).duplicate, false);
  } finally { f.db.close(); }
});

test('real studio route propagates generic HTTP 409 and rolls back its export on injected collision', async () => {
  const f = fixture(), app = express(), mediaId = crypto.randomUUID();
  let server;
  try {
    f.db.exec('CREATE TABLE tenant_media(id TEXT,organisation_id TEXT,kind TEXT)');
    f.db.prepare('INSERT INTO tenant_media VALUES (?,?,?)').run(mediaId, 'requesting-tenant', 'video');
    const before = f.rows();
    app.set('env', 'production'); app.use(express.json());
    installStudioEditor(app, { db: f.db, uploadRoot: os.tmpdir(), queue: { register() {}, enqueue(type,payload,options) { return f.q.enqueue(type,payload,{ ...options, idempotencyKey:'collision' }); } },
      requireSaasUser(req,res,next) { req.saas={organisation_id:'requesting-tenant',user_id:'synthetic-reviewer'}; next(); }, requireSaasRole: () => (req,res,next) => next(), saasAudit() {} });
    server = await new Promise(resolve => { const s = app.listen(0,'127.0.0.1',() => resolve(s)); });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/saas/studio-exports`, { method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idempotency_key:crypto.randomUUID(),composition:{title:'Synthetic review',clips:[{media_id:mediaId,start:0,end:1}],aspect_ratio:'16:9'}}) });
    const body = await response.text();
    assert.equal(response.status,409);
    for(const forbidden of [f.first.job.id,'foreign-tenant','FOREIGN_PAYLOAD','FOREIGN_RESULT','FOREIGN_ERROR']) assert.equal(body.includes(forbidden),false);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM studio_exports').get().n,0);
    assert.deepEqual(f.rows(),before);
  } finally { if(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } f.db.close(); }
});

async function race(orgs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oprun-queue-race-')), file = path.join(dir, 'queue.sqlite');
  const db = new Database(file), barrier = new SharedArrayBuffer(4), workers = [];
  db.pragma('journal_mode=WAL');
  createJobQueue({ db });
  const code = `
    const { parentPort, workerData: d } = require('node:worker_threads');
    const { createRequire } = require('node:module');
    const Database = createRequire(d.requireBase)('better-sqlite3');
    (async () => {
      const { createJobQueue } = await import(d.moduleUrl);
      const db = new Database(d.file); db.pragma('busy_timeout=5000');
      const q = createJobQueue({ db, log: { warn() {} } });
      parentPort.postMessage({ ready: true });
      Atomics.wait(new Int32Array(d.barrier), 0, 0);
      try { const r = q.enqueue('review.race', { sentinel: d.org }, { organisationId: d.org, idempotencyKey: 'simultaneous' }); parentPort.postMessage({ ok: true, duplicate: r.duplicate, id: r.job.id, org: r.job.organisation_id }); }
      catch (e) { parentPort.postMessage({ ok: false, code: e.code, status: e.status, message: e.message, details: Object.fromEntries(Object.getOwnPropertyNames(e).map(k => [k, e[k]])) }); }
      finally { db.close(); }
    })().catch(e => { parentPort.postMessage({ fatal: e.message }); process.exitCode = 1; });
  `;
  try {
    const states = orgs.map(org => {
      const worker = new Worker(code, { eval: true, workerData: { file, org, barrier, moduleUrl, requireBase: import.meta.url } }); workers.push(worker);
      let readyResolve, readyReject, doneResolve, doneReject;
      const ready = new Promise((a,b) => { readyResolve=a; readyReject=b; });
      const done = new Promise((a,b) => { doneResolve=a; doneReject=b; });
      worker.on('message', m => { if(m.ready) readyResolve(); else if(m.fatal) { readyReject(new Error(m.fatal)); doneReject(new Error(m.fatal)); } else doneResolve(m); });
      worker.on('error', e => { readyReject(e); doneReject(e); });
      return { ready, done };
    });
    await Promise.all(states.map(s => s.ready));
    Atomics.store(new Int32Array(barrier), 0, 1); Atomics.notify(new Int32Array(barrier), 0, 2);
    const results = await Promise.all(states.map(s => s.done));
    return { results, rows: db.prepare('SELECT * FROM background_jobs').all() };
  } finally { await Promise.all(workers.map(w => w.terminate())); db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('barrier-released independent worker writers: same-scope retries deduplicate', { timeout: 20000 }, async () => {
  for(let round=0;round<3;round++) {
    const r = await race(['same-tenant', 'same-tenant']);
    assert.equal(r.rows.length, 1);
    assert.equal(r.results.every(v => v.ok), true);
    assert.deepEqual(r.results.map(v => v.duplicate).sort(), [false, true]);
    assert.equal(r.results[0].id, r.results[1].id);
  }
});

test('barrier-released independent worker writers: foreign scope gets exact conflict', { timeout: 20000 }, async () => {
  for(let round=0;round<3;round++) {
    const r = await race(['tenant-one', 'tenant-two']);
    assert.equal(r.rows.length, 1);
    assert.equal(r.results.filter(v => v.ok).length, 1);
    const refused = r.results.find(v => !v.ok), accepted = r.results.find(v => v.ok);
    assert.equal(refused.code, 'IDEMPOTENCY_KEY_CONFLICT'); assert.equal(refused.status, 409);
    assert.equal(refused.message, 'This idempotency key is already used by a different job.');
    assert.equal(JSON.stringify(refused.details).includes(accepted.id), false);
    assert.equal(JSON.stringify(refused.details).includes(accepted.org), false);
    assert.equal(r.rows[0].organisation_id, accepted.org);
  }
});
