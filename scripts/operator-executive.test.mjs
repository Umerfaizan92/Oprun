// TR-30: Operator Console executive dashboard. Founder-only sections, role filtering, real counts, attention list.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto, { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createDb } from '../src/db.js';
import { createSubscriptionPolicy } from '../src/subscription-policy.js';
import { createPlatformIdentity } from '../src/platform-identity.js';
import { installOperatorExecutive } from '../src/operator-executive.js';

const DAY = 86400000;
const NOW = Date.parse('2026-11-23T10:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

function setup(env = {}) {
  const db = createDb(':memory:');
  const policy = createSubscriptionPolicy({ db });
  db.exec(`CREATE TABLE IF NOT EXISTS platform_records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'open',assigned_to TEXT,revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS support_access_requests(id TEXT PRIMARY KEY,organisation_id TEXT NOT NULL,requested_by TEXT NOT NULL,purpose TEXT NOT NULL,scope_json TEXT NOT NULL,hours INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',approved_by TEXT,expires_at TEXT,revoked_at TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS platform_invoices(id TEXT PRIMARY KEY,organisation_id TEXT NOT NULL,number TEXT NOT NULL,total_cents INTEGER NOT NULL,status TEXT NOT NULL,due_at TEXT,paid_at TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS background_jobs(id TEXT PRIMARY KEY,status TEXT NOT NULL,updated_at TEXT NOT NULL);`);
  const app = express(); app.use(express.json());
  const platform = createPlatformIdentity({ db, env: { INTEGRATION_ENCRYPTION_KEY: 'e'.repeat(64) }, validTotp: () => false,
    founderAuthenticate: (req, res, next) => (req.get('x-admin-key') === 'founder-test-only' ? next() : res.status(401).json({ ok: false })) });
  platform.install(app, { limiter: (_q, _s, n) => n() });
  installOperatorExecutive(app, { db, env, platform, policy, now: () => NOW });
  return { db, app };
}

function org(db, { created, status = 'trialing', plan = 'starter', trialEnds = null }) {
  const id = randomUUID();
  db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(id, 'Biz ' + id.slice(0, 4), 'b' + id.slice(0, 8), iso(created), iso(created));
  db.prepare('INSERT INTO organisation_subscriptions(organisation_id,plan_id,status,payment_status,trial_ends_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(id, plan, status, status === 'active' ? 'paid' : 'unpaid', trialEnds && iso(trialEnds), iso(created), iso(created));
  return id;
}

function staff(db, role, grants) {
  const id = randomUUID(), token = 'tok-' + id;
  db.prepare('INSERT INTO platform_users(id,email,name,password_hash,salt,totp_secret,role,grants_json,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, role + '@example.test', role, 'x', 'x', 'x', role, JSON.stringify(grants), 'active', iso(NOW));
  db.prepare('INSERT INTO platform_sessions VALUES (?,?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'), id, iso(Date.now() + 3600000), iso(NOW));
  return { 'x-platform-session': token };
}

async function withServer(app, fn) {
  const server = app.listen(0); await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(async (headers = {}) => { const r = await fetch(base + '/api/operator/executive', { headers }); return { status: r.status, data: await r.json().catch(() => null) }; }); }
  finally { server.close(); }
}

const founder = { 'x-admin-key': 'founder-test-only' };

test('founder sees every block with figures counted from recorded data', async () => {
  const { db, app } = setup({});
  const a = org(db, { created: NOW - 2 * DAY, trialEnds: NOW + 3 * DAY });
  org(db, { created: NOW - 20 * DAY, trialEnds: NOW + 20 * DAY });
  const paying = org(db, { created: NOW - 60 * DAY, status: 'active', plan: 'operations' });
  const fee = db.prepare("SELECT monthly_fee_cents c FROM subscription_plans WHERE id='operations'").get().c;
  db.prepare('INSERT INTO platform_invoices VALUES (?,?,?,?,?,?,?,?)').run('i1', paying, 'INV-1', 9900, 'sent', iso(NOW - 5 * DAY), null, iso(NOW - 40 * DAY));
  db.prepare('INSERT INTO platform_invoices VALUES (?,?,?,?,?,?,?,?)').run('i2', paying, 'INV-2', 9900, 'sent', iso(NOW + 5 * DAY), null, iso(NOW - 2 * DAY));
  db.prepare('INSERT INTO platform_invoices VALUES (?,?,?,?,?,?,?,?)').run('i3', paying, 'INV-0', 9900, 'paid', iso(NOW - 25 * DAY), iso(NOW - 10 * DAY), iso(NOW - 70 * DAY));
  db.prepare("INSERT INTO platform_records(id,kind,title,status,created_by,created_at,updated_at) VALUES ('r1','incident','Email outage','open','founder',?,?)").run(iso(NOW), iso(NOW));
  db.prepare("INSERT INTO platform_records(id,kind,title,status,created_by,created_at,updated_at) VALUES ('r2','ticket','Login help','open','founder',?,?)").run(iso(NOW), iso(NOW));
  db.prepare("INSERT INTO platform_records(id,kind,title,status,created_by,created_at,updated_at) VALUES ('r3','ticket','Old','closed','founder',?,?)").run(iso(NOW), iso(NOW));
  db.prepare("INSERT INTO support_access_requests(id,organisation_id,requested_by,purpose,scope_json,hours,created_at) VALUES ('s1',?,'founder','help','[]',2,?)").run(a, iso(NOW));
  db.prepare("INSERT INTO background_jobs VALUES ('j1','failed',?),('j2','dead',?),('j3','queued',?),('j4','failed',?)").run(iso(NOW - 3600000), iso(NOW - 3 * DAY), iso(NOW), iso(NOW - 3 * DAY));

  await withServer(app, async (get) => {
    assert.equal((await get()).status, 401, 'no sign-in, no dashboard');
    const { status, data } = await get(founder);
    assert.equal(status, 200);
    const s = data.sections;
    assert.deepEqual(Object.keys(s).sort(), ['operations', 'revenue', 'subscribers', 'support']);
    assert.equal(s.subscribers.total, 3);
    assert.deepEqual({ ...s.subscribers.by_status }, { trialing: 2, active: 1 });
    assert.equal(s.subscribers.new_7_days, 1);
    assert.equal(s.subscribers.new_30_days, 2);
    assert.equal(s.subscribers.trials_ending_7_days, 1);
    assert.equal(s.subscribers.signups_by_week.length, 8);
    assert.equal(s.subscribers.signups_by_week.reduce((n, w) => n + w.count, 0), 2, 'only sign-ups inside the 8 weeks are counted');
    assert.equal(s.subscribers.signups_by_week[7].count, 1, 'this week is the last bar');
    assert.equal(s.revenue.mrr_cents, fee);
    assert.equal(s.revenue.paying_subscribers, 1);
    assert.deepEqual({ ...s.revenue.overdue_invoices }, { count: 1, total_cents: 9900 }, 'only past-due unpaid invoices count');
    assert.equal(s.revenue.paid_last_30_days_cents, 9900);
    assert.equal(s.support.open_tickets, 1);
    assert.equal(s.support.pending_access_requests, 1);
    assert.equal(s.operations.open_incidents, 1);
    assert.deepEqual({ ...s.operations.jobs }, { queued: 1, running: 0, failed_24_hours: 1, dead: 1 });
    assert.equal(s.operations.backups_configured, false);
    const keys = data.attention.map((x) => x.key);
    assert.deepEqual(keys, ['backups', 'incidents', 'jobs-dead', 'overdue', 'access', 'tickets', 'trials'], 'most serious first');
    assert.equal(data.attention[0].level, 'critical');
    for (const i of data.attention) assert.match(i.route, /^f0\d\/[a-z]/, 'every item opens a console page');
    assert.ok(!JSON.stringify(data).match(/Biz |@example|Email outage|Login help/), 'no names, emails or record contents');
  });
});

test('each platform role sees only the blocks it is granted', async () => {
  const { db, app } = setup({ BACKUP_S3_BUCKET: 'backups-test' });
  org(db, { created: NOW - DAY, trialEnds: NOW + DAY });
  const support = staff(db, 'support', ['overview.read', 'support.read']);
  const billing = staff(db, 'billing', ['overview.read', 'subscribers.read', 'billing.read']);
  const maint = staff(db, 'maintenance', ['overview.read', 'operations.read']);
  const marketing = staff(db, 'marketing', ['marketing.read']);
  await withServer(app, async (get) => {
    const sup = (await get(support)).data;
    assert.deepEqual(Object.keys(sup.sections), ['support']);
    assert.ok(sup.attention.every((x) => !['trials', 'backups', 'overdue'].includes(x.key)));
    const bill = (await get(billing)).data;
    assert.deepEqual(Object.keys(bill.sections).sort(), ['revenue', 'subscribers']);
    assert.deepEqual(bill.attention.map((x) => x.key), ['trials']);
    const ops = (await get(maint)).data;
    assert.deepEqual(Object.keys(ops.sections), ['operations']);
    assert.equal(ops.sections.operations.backups_configured, true);
    assert.deepEqual(ops.attention, [], 'nothing to flag when backups are set and no jobs failed');
    assert.equal((await get(marketing)).status, 403, 'a role without the overview cannot open it');
  });
});

test('console loads the dashboard script and keeps its fallback', () => {
  const html = readFileSync(new URL('../office/console.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../office/console.js', import.meta.url), 'utf8');
  assert.ok(html.indexOf('console-executive.js') > -1 && html.indexOf('console-executive.js') < html.indexOf('console.js?v'), 'dashboard script loads before console.js');
  assert.match(js, /\/api\/operator\/executive/);
  assert.match(js, /else for \(const r of d\.counts\)/, 'status panels remain if the dashboard cannot load');
});
