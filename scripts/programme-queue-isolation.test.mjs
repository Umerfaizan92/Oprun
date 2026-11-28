// PRG-02 / AUD-02: an idempotency key collision must never hand one tenant (or job type, or the platform scope)
// a job that belongs to another. Synthetic, throwaway databases only; no network, no providers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDb } from '../src/db.js';
import { createJobQueue } from '../src/job-queue.js';

const quiet = { warn() {}, error() {}, info() {} };
const ORG_A = 'org-a-synthetic', ORG_B = 'org-b-synthetic';

function setup() {
  const db = createDb(':memory:');
  const q = createJobQueue({ db, log: quiet, clock: () => Date.parse('2026-11-28T00:00:00Z') });
  q.register('demo.alpha', () => 'ok');
  q.register('demo.beta', () => 'ok');
  return { db, q };
}
const count = (db) => db.prepare('SELECT COUNT(*) n FROM background_jobs').get().n;
const isConflict = (e) => e?.code === 'IDEMPOTENCY_KEY_CONFLICT';

test('same tenant, same type, same key still deduplicates to the original job', () => {
  const { db, q } = setup();
  const a = q.enqueue('demo.alpha', { n: 1 }, { organisationId: ORG_A, idempotencyKey: 'k1' });
  const b = q.enqueue('demo.alpha', { n: 2 }, { organisationId: ORG_A, idempotencyKey: 'k1' });
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
  assert.equal(b.job.id, a.job.id);
  assert.equal(JSON.parse(b.job.payload_json).n, 1, 'the original payload is kept');
  assert.equal(count(db), 1);
});

test('another tenant reusing a key never receives the first tenant\'s job', () => {
  const { db, q } = setup();
  const a = q.enqueue('demo.alpha', { secret: 'tenant-a-only' }, { organisationId: ORG_A, idempotencyKey: 'shared' });
  let result = null, error = null;
  try { result = q.enqueue('demo.alpha', { n: 2 }, { organisationId: ORG_B, idempotencyKey: 'shared' }); } catch (e) { error = e; }
  assert.equal(result?.job?.id === a.job.id, false, 'tenant B must not be handed tenant A\'s job');
  assert.ok(!result || result.job?.organisation_id === ORG_B, 'any job returned must be tenant B\'s');
  if (error) {
    assert.ok(isConflict(error), 'a refusal must be the explicit conflict error');
    assert.doesNotMatch(String(error.message), /tenant-a-only|org-a-synthetic/, 'the error must not reveal the other job');
    assert.equal(error.job, undefined);
  }
  const rowA = db.prepare('SELECT * FROM background_jobs WHERE id=?').get(a.job.id);
  assert.equal(rowA.organisation_id, ORG_A, 'tenant A\'s job is untouched');
  assert.equal(JSON.parse(rowA.payload_json).secret, 'tenant-a-only');
});

test('the same tenant reusing a key for a different job type never receives the other type\'s job', () => {
  const { q } = setup();
  const a = q.enqueue('demo.alpha', {}, { organisationId: ORG_A, idempotencyKey: 'typed' });
  let result = null, error = null;
  try { result = q.enqueue('demo.beta', {}, { organisationId: ORG_A, idempotencyKey: 'typed' }); } catch (e) { error = e; }
  assert.notEqual(result?.job?.id, a.job.id);
  assert.ok(!result || result.job?.type === 'demo.beta');
  if (error) assert.ok(isConflict(error));
});

test('platform scope (no tenant) and a tenant never share jobs through a key, in either direction', () => {
  const { q } = setup();
  const p = q.enqueue('demo.alpha', {}, { organisationId: null, idempotencyKey: 'scope-1' });
  let r1 = null, e1 = null;
  try { r1 = q.enqueue('demo.alpha', {}, { organisationId: ORG_A, idempotencyKey: 'scope-1' }); } catch (e) { e1 = e; }
  assert.notEqual(r1?.job?.id, p.job.id, 'a tenant must not get a platform job');
  if (e1) assert.ok(isConflict(e1));

  const t = q.enqueue('demo.alpha', {}, { organisationId: ORG_A, idempotencyKey: 'scope-2' });
  let r2 = null, e2 = null;
  try { r2 = q.enqueue('demo.alpha', {}, { idempotencyKey: 'scope-2' }); } catch (e) { e2 = e; }
  assert.notEqual(r2?.job?.id, t.job.id, 'the platform scope must not get a tenant job');
  if (e2) assert.ok(isConflict(e2));
});

test('platform scope deduplicates against itself, with null or omitted organisation alike', () => {
  const { db, q } = setup();
  const a = q.enqueue('demo.alpha', {}, { idempotencyKey: 'daily:2026-11-28' });
  const b = q.enqueue('demo.alpha', {}, { organisationId: null, idempotencyKey: 'daily:2026-11-28' });
  const c = q.enqueue('demo.alpha', {}, { organisationId: undefined, idempotencyKey: 'daily:2026-11-28' });
  assert.equal(b.duplicate, true); assert.equal(b.job.id, a.job.id);
  assert.equal(c.duplicate, true); assert.equal(c.job.id, a.job.id);
  assert.equal(count(db), 1);
});

test('jobs without a key are never deduplicated and never collide', () => {
  const { db, q } = setup();
  q.enqueue('demo.alpha', {}, { organisationId: ORG_A });
  q.enqueue('demo.alpha', {}, { organisationId: ORG_B });
  q.enqueue('demo.alpha', {});
  assert.equal(count(db), 3);
});

test('a refused collision creates no row and leaves the queue usable', () => {
  const { db, q } = setup();
  q.enqueue('demo.alpha', {}, { organisationId: ORG_A, idempotencyKey: 'x' });
  try { q.enqueue('demo.alpha', {}, { organisationId: ORG_B, idempotencyKey: 'x' }); } catch (e) { if (!isConflict(e)) throw e; }
  assert.equal(count(db), 1);
  const fresh = q.enqueue('demo.alpha', {}, { organisationId: ORG_B, idempotencyKey: 'y' });
  assert.equal(fresh.duplicate, false);
  assert.equal(fresh.job.organisation_id, ORG_B);
});

test('rows written before the fix are preserved and still deduplicate for their own tenant and type', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prg02-'));
  const file = path.join(dir, 'legacy.db');
  try {
    // Simulate a production database created by the earlier queue version, with a legacy row inserted directly.
    let db = createDb(file);
    createJobQueue({ db, log: quiet });
    const t = '2026-11-01T00:00:00.000Z';
    db.prepare("INSERT INTO background_jobs(id,type,organisation_id,payload_json,idempotency_key,status,attempts,max_attempts,run_at,created_at,updated_at) VALUES ('legacy-1','demo.alpha',?,'{\"v\":1}','legacy:key','queued',0,5,?,?,?)").run(ORG_A, t, t, t);
    db.prepare("INSERT INTO background_jobs(id,type,organisation_id,payload_json,idempotency_key,status,attempts,max_attempts,run_at,created_at,updated_at) VALUES ('legacy-2','demo.alpha',NULL,'{}','legacy:platform','succeeded',1,5,?,?,?)").run(t, t, t);
    db.close();

    db = createDb(file);
    const q = createJobQueue({ db, log: quiet });
    q.register('demo.alpha', () => 'ok');
    const rows = db.prepare('SELECT id,organisation_id,idempotency_key,status,payload_json FROM background_jobs ORDER BY id').all();
    assert.deepEqual(rows.map((r) => [r.id, r.organisation_id, r.idempotency_key, r.status]), [
      ['legacy-1', ORG_A, 'legacy:key', 'queued'], ['legacy-2', null, 'legacy:platform', 'succeeded']]);
    assert.equal(q.enqueue('demo.alpha', {}, { organisationId: ORG_A, idempotencyKey: 'legacy:key' }).job.id, 'legacy-1');
    assert.equal(q.enqueue('demo.alpha', {}, { idempotencyKey: 'legacy:platform' }).job.id, 'legacy-2');
    let r = null; try { r = q.enqueue('demo.alpha', {}, { organisationId: ORG_B, idempotencyKey: 'legacy:key' }); } catch (e) { if (!isConflict(e)) throw e; }
    assert.notEqual(r?.job?.id, 'legacy-1');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM background_jobs').get().n, 2);
    db.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('two queue instances on one database file (concurrent writers) still deduplicate and stay isolated', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prg02-'));
  const file = path.join(dir, 'shared.db');
  try {
    const db1 = createDb(file), db2 = createDb(file);
    const q1 = createJobQueue({ db: db1, log: quiet }), q2 = createJobQueue({ db: db2, log: quiet });
    const a = q1.enqueue('demo.alpha', {}, { organisationId: ORG_A, idempotencyKey: 'race' });
    const b = q2.enqueue('demo.alpha', {}, { organisationId: ORG_A, idempotencyKey: 'race' });
    assert.equal(b.duplicate, true); assert.equal(b.job.id, a.job.id);
    let r = null; try { r = q2.enqueue('demo.alpha', {}, { organisationId: ORG_B, idempotencyKey: 'race' }); } catch (e) { if (!isConflict(e)) throw e; }
    assert.notEqual(r?.job?.id, a.job.id);
    assert.equal(db1.prepare('SELECT COUNT(*) n FROM background_jobs').get().n, 1);
    db1.close(); db2.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
