// Phase 04 Founder Console data: founder-only, read-only, honest about what is not recorded, never leaks secret values.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const SECRET = 're_live_' + 'Zx9QpLm2Vb7Tn4Rk8Wd1';
const ROUTES = ['revenue', 'backups', 'ai-usage', 'compliance', 'configuration'];

test('founder console platform data', async (t) => {
  const s = await startServer({ RESEND_API_KEY: SECRET, BACKUP_S3_BUCKET: 'sp-backup-test', BACKUP_S3_SSE: 'aws:kms' });
  t.after(() => s.stop());
  const owner = await seedOwner(s);
  const F = (url) => s.call('GET', url, { headers: { 'x-admin-key': s.adminKey } });

  // Some activity to count: an AI request and a paying subscription on a priced plan.
  const db = new Database(s.dbPath), now = new Date().toISOString();
  db.prepare("INSERT INTO usage_events (id,organisation_id,kind,created_at) VALUES (?,?,'ai',?)").run(randomUUID(), owner.org, now);
  const plan = db.prepare('SELECT id,monthly_fee_cents FROM subscription_plans WHERE monthly_fee_cents>0 ORDER BY monthly_fee_cents LIMIT 1').get();
  if (plan) db.prepare("UPDATE organisation_subscriptions SET plan_id=?,status='active' WHERE organisation_id=?").run(plan.id, owner.org);
  db.close();

  for (const r of ROUTES) {
    const res = await F('/api/operator/platform/' + r);
    assert.equal(res.status, 200, `${r}: ${res.text}`);
    assert.equal(res.json.ok, true);
    assert.ok(!res.text.includes(SECRET), `${r} must never include a secret value`);
    assert.equal((await s.call('GET', '/api/operator/platform/' + r)).status, 401, `${r} needs the founder`);
    assert.ok([401, 403].includes((await s.call('GET', '/api/operator/platform/' + r, { cookie: owner.cookie })).status), `${r} is not for business owners`);
  }

  const rev = (await F('/api/operator/platform/revenue')).json;
  if (plan) { assert.equal(rev.mrr_cents, plan.monthly_fee_cents); assert.equal(rev.subscriptions.active_paying, 1); }
  assert.match(rev.note, /Stripe/);
  const ai = (await F('/api/operator/platform/ai-usage')).json;
  assert.equal(ai.ai_requests_30_days, 1);
  assert.equal(ai.cost_recorded, false, 'AI cost is reported as not recorded, never estimated');
  const bk = (await F('/api/operator/platform/backups')).json;
  assert.equal(bk.database_backup.configured, true);
  assert.equal(bk.database_backup.encryption, 'aws:kms');
  assert.equal(bk.restore_drill.recorded, false);
  assert.match(bk.restore_drill.how, /--record/);
  // T-045: a recorded Litestream drill and a failed snapshot test appear, newest first, with the last pass kept.
  { const d = new Database(s.dbPath);
    d.prepare("INSERT INTO reliability_restore_tests (id,started_at,finished_at,status,backup_key,seconds,integrity,audit_ok,tables,gaps_json,error,trigger) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(randomUUID(), '2026-11-20T01:00:00.000Z', '2026-11-20T01:00:09.000Z', 'passed', 's3://bucket/db', 9.1, 'ok', 1, 120, '[]', null, 'litestream_drill');
    d.prepare("INSERT INTO reliability_restore_tests (id,started_at,finished_at,status,seconds,error,trigger) VALUES (?,?,?,?,?,?,?)").run(randomUUID(), '2026-11-21T01:00:00.000Z', '2026-11-21T01:00:03.000Z', 'failed', 3, 'checksum mismatch', 'schedule');
    d.close(); }
  const bk2 = (await F('/api/operator/platform/backups')).json.restore_drill;
  assert.equal(bk2.recorded, true); assert.equal(bk2.last.status, 'failed'); assert.equal(bk2.last.kind, 'Snapshot restore test');
  assert.equal(bk2.last_passed.kind, 'Litestream drill'); assert.equal(bk2.last_passed.tables, 120); assert.equal(bk2.last_passed.audit_chain_ok, true);
  assert.equal(bk2.last_litestream_drill.status, 'passed'); assert.equal(bk2.history.length, 2);
  assert.ok(!JSON.stringify(bk2).includes('AKIA'), 'no keys in the result');
  const cfg = (await F('/api/operator/platform/configuration')).json;
  assert.equal(cfg.providers.email, true);
  assert.ok(Array.isArray(cfg.feature_access.plans) && cfg.feature_access.plans.length > 0);
  const comp = (await F('/api/operator/platform/compliance')).json;
  assert.equal(comp.legal.accepted_current_version, 1, 'the seeded owner accepted the current terms');

  // Infrastructure reuses the Phase 02 routes.
  const sys = await F('/api/operator/system');
  assert.equal(sys.status, 200); assert.ok(!sys.text.includes(SECRET));
  assert.equal((await F('/api/operator/jobs')).status, 200);
});

test('business and platform email stay separate', async (t) => {
  const s = await startServer();
  t.after(() => s.stop());
  const owner = await seedOwner(s);
  // A business owner cannot reach the platform mailbox, and the founder key does not open a business mailbox.
  assert.equal((await s.call('GET', '/api/saas/mail', { cookie: owner.cookie })).status, 200, 'the owner opens the business mailbox');
  assert.equal((await s.call('GET', '/api/operator/mail', { headers: { 'x-admin-key': s.adminKey } })).status, 200, 'the founder opens the platform mailbox');
  assert.ok([401, 403].includes((await s.call('GET', '/api/operator/mail', { cookie: owner.cookie })).status));
  const founderOnBusiness = await s.call('GET', '/api/saas/mail', { headers: { 'x-admin-key': s.adminKey } });
  assert.ok([401, 403].includes(founderOnBusiness.status), 'the founder key is not a business session');
});
