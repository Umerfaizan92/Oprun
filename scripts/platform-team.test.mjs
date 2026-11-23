// TR-31: Oprun's own staff — departments, teams, availability, time off and workload.
// Acceptance: the data never shares tables or routes with subscriber workspaces (isolation tests below).
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto, { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createDb } from '../src/db.js';
import { createPlatformIdentity } from '../src/platform-identity.js';
import { installPlatformTeam, TEAM_TABLES } from '../src/platform-team.js';

const NOW = new Date('2026-11-23T02:00:00.000Z');
const iso = (d = NOW) => d.toISOString();

function setup() {
  const db = createDb(':memory:');
  db.exec("CREATE TABLE IF NOT EXISTS platform_records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'open',assigned_to TEXT,revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)");
  const app = express(); app.use(express.json());
  const platform = createPlatformIdentity({ db, env: { INTEGRATION_ENCRYPTION_KEY: 'e'.repeat(64) }, validTotp: () => false,
    founderAuthenticate: (req, res, next) => (req.get('x-admin-key') === 'founder-test-only' ? next() : res.status(401).json({ ok: false })) });
  platform.install(app, { limiter: (_q, _s, n) => n() });
  installPlatformTeam(app, { db, platform, now: () => NOW });
  // A subscriber business with an owner and a worker, to prove none of it shows up.
  const org = randomUUID(), user = randomUUID();
  db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(org, 'Harbour Plumbing', 'harbour', iso(), iso());
  db.prepare('INSERT INTO users(id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(user, 'owner@harbour.test', 'Business Owner', 'h', 's', iso(), iso());
  db.prepare("INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES (?,?,'owner',?)").run(org, user, iso());
  return { db, app };
}

function staff(db, name, role, grants) {
  const id = randomUUID(), token = 'tok-' + id;
  db.prepare("INSERT INTO platform_users(id,email,name,password_hash,salt,totp_secret,role,grants_json,status,created_at) VALUES (?,?,?,?,?,?,?,?,'active',?)")
    .run(id, name.split(' ')[0].toLowerCase() + '@oprun.test', name, 'x', 'x', 'x', role, JSON.stringify(grants), iso());
  db.prepare('INSERT INTO platform_sessions VALUES (?,?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'), id, iso(new Date(Date.now() + 3600000)), iso());
  return { id, h: { 'x-platform-session': token } };
}

async function serve(app, fn) {
  const server = app.listen(0); await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body, headers = {}) => {
    const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  try { await fn(call); } finally { server.close(); }
}
const F = { 'x-admin-key': 'founder-test-only' };

test('isolation: own tables with no business link, operator-only routes, no subscriber data', async () => {
  const { db, app } = setup();
  for (const t of TEAM_TABLES) {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
    assert.ok(cols.length, `${t} exists`);
    assert.ok(!cols.includes('organisation_id'), `${t} has no business column`);
    const fks = db.prepare(`PRAGMA foreign_key_list(${t})`).all().map((f) => f.table);
    assert.ok(fks.every((x) => x.startsWith('platform_')), `${t} only links to platform tables (${fks})`);
  }
  const src = readFileSync(new URL('../src/platform-team.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const table of ['organisations', 'memberships', 'workers', 'users', 'organisation_subscriptions'])
    assert.doesNotMatch(src, new RegExp(`(FROM|JOIN|INTO|UPDATE)\\s+${table}\\b`, 'i'), `module never touches ${table}`);
  assert.deepEqual([...new Set([...src.matchAll(/app\.(?:get|post|put|delete)\('([^']+)'/g)].map((m) => m[1].split('/').slice(0, 4).join('/')))], ['/api/operator/team'], 'every route is under /api/operator/team');
  for (const file of readdirSync(new URL('../src/', import.meta.url))) {
    if (file === 'platform-team.js' || !file.endsWith('.js')) continue;
    const other = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
    for (const t of TEAM_TABLES) assert.ok(!other.includes(t), `${file} must not use ${t}`);
  }
  await serve(app, async (call) => {
    for (const [m, u] of [['GET', '/api/operator/team'], ['POST', '/api/operator/team/departments'], ['PUT', '/api/operator/team/people/me/availability']])
      assert.equal((await call(m, u, m === 'GET' ? null : {}, { cookie: 'sp_session=business-session' })).status, 401, `${m} ${u} refuses a business session`);
    const d = (await call('GET', '/api/operator/team', null, F)).data;
    assert.doesNotMatch(JSON.stringify(d), /Harbour|owner@harbour|Business Owner/, 'subscriber people never listed');
    assert.deepEqual(d.people, []);
  });
});

test('permissions, departments, teams and conflicts', async () => {
  const { db, app } = setup();
  const lead = staff(db, 'Leah Brooks', 'admin', ['team.read', 'team.create', 'team.edit']);
  const viewer = staff(db, 'Priya Shah', 'support', ['support.read', 'team.read']);
  const outsider = staff(db, 'Mo Ali', 'marketing', ['marketing.read']);
  await serve(app, async (call) => {
    assert.equal((await call('GET', '/api/operator/team', null, outsider.h)).status, 403, 'no team grant, no access');
    assert.equal((await call('GET', '/api/operator/team', null, viewer.h)).status, 200);
    assert.equal((await call('POST', '/api/operator/team/departments', { name: 'Support' }, viewer.h)).status, 403, 'read only cannot create');
    assert.equal((await call('POST', '/api/operator/team/departments', { name: 'Support', lead_id: 'nobody' }, lead.h)).status, 400, 'lead must be staff');
    const dep = await call('POST', '/api/operator/team/departments', { name: 'Customer success', lead_id: lead.id }, lead.h);
    assert.equal(dep.status, 201);
    assert.equal((await call('POST', '/api/operator/team/departments', { name: 'customer SUCCESS' }, lead.h)).status, 409, 'no duplicate names');
    assert.equal((await call('POST', '/api/operator/team/teams', { department_id: dep.data.id, name: 'Desk', members: ['ghost'] }, lead.h)).status, 400, 'members must be staff');
    const team = await call('POST', '/api/operator/team/teams', { department_id: dep.data.id, name: 'Support desk', lead_id: viewer.id, members: [viewer.id, lead.id, viewer.id] }, lead.h);
    assert.equal(team.status, 201);
    let d = (await call('GET', '/api/operator/team', null, viewer.h)).data;
    assert.deepEqual(d.teams[0].members.sort(), [viewer.id, lead.id].sort(), 'duplicates removed');
    assert.deepEqual(d.people.find((p) => p.id === viewer.id).team_ids, [team.data.id]);
    assert.equal((await call('PUT', `/api/operator/team/teams/${team.data.id}`, { members: [viewer.id], revision: 1 }, lead.h)).status, 200);
    assert.equal((await call('PUT', `/api/operator/team/teams/${team.data.id}`, { name: 'Old copy', revision: 1 }, lead.h)).status, 409, 'stale revision refused');
    assert.equal((await call('PUT', `/api/operator/team/departments/${dep.data.id}`, { archived: true, revision: 1 }, lead.h)).status, 200, 'archive, never delete');
    d = (await call('GET', '/api/operator/team', null, lead.h)).data;
    assert.equal(d.departments[0].archived, 1);
    assert.equal(d.teams[0].name, 'Support desk', 'description kept when not sent');
    assert.equal((await call('POST', '/api/operator/team/teams', { department_id: dep.data.id, name: 'New' }, lead.h)).status, 400, 'no new teams in an archived department');
    const w = await call('PUT', `/api/operator/team/people/${viewer.id}`, { job_title: 'Support lead', weekly_capacity_hours: 38, work_days: [5, 1, 3], work_start: '08:00', work_end: '16:00', revision: 0 }, lead.h);
    assert.equal(w.status, 200);
    assert.equal((await call('PUT', `/api/operator/team/people/${viewer.id}`, { job_title: 'x', revision: 0 }, lead.h)).status, 409);
    assert.equal((await call('PUT', `/api/operator/team/people/${viewer.id}`, { work_start: '17:00', work_end: '09:00', revision: 2 }, lead.h)).status, 400);
    const p = (await call('GET', '/api/operator/team', null, lead.h)).data.people.find((x) => x.id === viewer.id);
    assert.deepEqual([p.job_title, p.weekly_capacity_hours, p.work_days, p.work_start], ['Support lead', 38, [1, 3, 5], '08:00']);
  });
});

test('availability, time off and workload', async () => {
  const { db, app } = setup();
  const lead = staff(db, 'Leah Brooks', 'admin', ['team.read', 'team.create', 'team.edit']);
  const me = staff(db, 'Priya Shah', 'support', ['support.read', 'team.read']);
  const other = staff(db, 'Tom Nguyen', 'maintenance', ['team.read']);
  const rec = db.prepare("INSERT INTO platform_records(id,kind,title,status,assigned_to,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'founder',?,?)");
  rec.run('a', 'ticket', 'T1', 'open', me.id, iso(), iso()); rec.run('b', 'ticket', 'T2', 'waiting', me.id, iso(), iso());
  rec.run('c', 'incident', 'I1', 'open', me.id, iso(), iso()); rec.run('d', 'ticket', 'T3', 'closed', me.id, iso(), iso());
  rec.run('e', 'task', 'X', 'open', null, iso(), iso());
  await serve(app, async (call) => {
    assert.equal((await call('PUT', '/api/operator/team/people/me/availability', { availability: 'busy', note: 'On calls' }, me.h)).status, 200, 'anyone sets their own');
    assert.equal((await call('PUT', `/api/operator/team/people/${other.id}/availability`, { availability: 'off' }, me.h)).status, 403, 'not someone else without team edit');
    assert.equal((await call('PUT', `/api/operator/team/people/${other.id}/availability`, { availability: 'away', away_until: '2026-11-20' }, lead.h)).status, 400, 'return date in the past');
    assert.equal((await call('PUT', `/api/operator/team/people/${other.id}/availability`, { availability: 'away', away_until: '2026-12-01' }, lead.h)).status, 200, 'a team manager can');
    assert.equal((await call('PUT', '/api/operator/team/people/me/availability', { availability: 'busy' }, F)).status, 400, 'founder key has no staff profile');
    assert.equal((await call('POST', '/api/operator/team/people/me/time-off', { starts_on: '2026-11-25', ends_on: '2026-11-24' }, me.h)).status, 400);
    const off = await call('POST', `/api/operator/team/people/${lead.id}/time-off`, { starts_on: '2026-11-22', ends_on: '2026-11-24', reason: 'Leave' }, lead.h);
    assert.equal(off.status, 201);
    const d = (await call('GET', '/api/operator/team', null, me.h)).data;
    const by = Object.fromEntries(d.people.map((p) => [p.name, p]));
    assert.deepEqual(by['Priya Shah'].availability, { status: 'busy', until: null, note: 'On calls' });
    assert.deepEqual(by['Tom Nguyen'].availability, { status: 'away', until: '2026-12-01', note: '' });
    assert.equal(by['Leah Brooks'].availability.status, 'off', 'time off today wins');
    assert.deepEqual(by['Priya Shah'].workload, { open: 2, waiting: 1, by_kind: { ticket: 2, incident: 1 } }, 'closed work not counted');
    assert.equal(d.unassigned_open_items, 1);
    assert.equal((await call('DELETE', `/api/operator/team/time-off/${off.data.id}`, null, me.h)).status, 403, 'cannot cancel someone else\'s leave');
    assert.equal((await call('DELETE', `/api/operator/team/time-off/${off.data.id}`, null, lead.h)).status, 200, 'own leave can be cancelled');
    db.prepare("UPDATE platform_staff_profiles SET away_until='2026-11-01' WHERE user_id=?").run(other.id);
    const after = (await call('GET', '/api/operator/team', null, me.h)).data.people;
    assert.equal(after.find((p) => p.id === other.id).availability.status, 'available', 'away ends after the return date');
    assert.equal(after.find((p) => p.id === lead.id).availability.status, 'available');
  });
});
