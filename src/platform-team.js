// TR-31: departments, teams, roles, availability and workload for Oprun's OWN staff (platform_users).
// Isolation rule: these tables have no organisation_id and are only reachable under /api/operator/team with a
// platform identity. Nothing here reads or writes subscriber tables (organisations, memberships, workers, users).
// Sign-in roles and permissions stay in Founder controls → Operator staff & roles; this module does not change them.
import crypto from 'node:crypto';
import { z } from 'zod';

export const TEAM_TABLES = ['platform_departments', 'platform_teams', 'platform_team_members', 'platform_staff_profiles', 'platform_time_off'];
const AVAILABILITY = ['available', 'busy', 'away', 'off'];
const DAYS = [0, 1, 2, 3, 4, 5, 6];

export function installPlatformTeam(app, { db, platform, now = () => new Date() }) {
  db.exec(`CREATE TABLE IF NOT EXISTS platform_departments(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',lead_id TEXT,archived INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS platform_teams(id TEXT PRIMARY KEY,department_id TEXT NOT NULL REFERENCES platform_departments(id),name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',lead_id TEXT,archived INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS platform_team_members(team_id TEXT NOT NULL REFERENCES platform_teams(id),user_id TEXT NOT NULL REFERENCES platform_users(id),added_at TEXT NOT NULL,PRIMARY KEY(team_id,user_id));
 CREATE TABLE IF NOT EXISTS platform_staff_profiles(user_id TEXT PRIMARY KEY REFERENCES platform_users(id),job_title TEXT NOT NULL DEFAULT '',department_id TEXT REFERENCES platform_departments(id),weekly_capacity_hours INTEGER,work_days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',work_start TEXT NOT NULL DEFAULT '09:00',work_end TEXT NOT NULL DEFAULT '17:00',timezone TEXT NOT NULL DEFAULT 'Australia/Perth',availability TEXT NOT NULL DEFAULT 'available',availability_note TEXT NOT NULL DEFAULT '',away_until TEXT,revision INTEGER NOT NULL DEFAULT 1,updated_by TEXT,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS platform_time_off(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES platform_users(id),starts_on TEXT NOT NULL,ends_on TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS platform_time_off_user ON platform_time_off(user_id,ends_on);`);

  const iso = () => now().toISOString();
  const today = () => iso().slice(0, 10);
  const guard = (action = 'read') => [platform.identity, platform.permit('team', action)];
  const bad = (res, error, status = 400) => res.status(status).json({ ok: false, error });
  const staffExists = (id) => !!db.prepare("SELECT 1 FROM platform_users WHERE id=? AND status='active'").get(id);
  const leadOk = (id) => id == null || id === '' || staffExists(id);
  const parse = (schema, body) => schema.strict().safeParse(body ?? {});
  const text = (max) => z.string().trim().max(max);
  const name = z.string().trim().min(2).max(80);
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
  const ensureProfile = (userId) => db.prepare('INSERT OR IGNORE INTO platform_staff_profiles(user_id,updated_at) VALUES (?,?)').run(userId, iso());

  // Effective availability: recorded time off today wins, then an "away until" date that has passed resets.
  function effective(p, off) {
    const d = today();
    const current = off.find((t) => t.starts_on <= d && t.ends_on >= d);
    if (current) return { status: 'off', until: current.ends_on, note: current.reason || 'Time off' };
    if (p.availability === 'away' && p.away_until && p.away_until < d) return { status: 'available', until: null, note: '' };
    return { status: p.availability, until: p.availability === 'away' ? p.away_until : null, note: p.availability_note };
  }

  function snapshot() {
    const departments = db.prepare('SELECT id,name,description,lead_id,archived,revision FROM platform_departments ORDER BY archived,name COLLATE NOCASE').all();
    const teams = db.prepare('SELECT id,department_id,name,description,lead_id,archived,revision FROM platform_teams ORDER BY archived,name COLLATE NOCASE').all();
    const members = db.prepare('SELECT team_id,user_id FROM platform_team_members').all();
    for (const t of teams) t.members = members.filter((m) => m.team_id === t.id).map((m) => m.user_id);
    const users = db.prepare("SELECT id,name,email,role,status FROM platform_users ORDER BY status='active' DESC,name COLLATE NOCASE").all();
    const profiles = new Map(db.prepare('SELECT * FROM platform_staff_profiles').all().map((p) => [p.user_id, p]));
    const off = db.prepare('SELECT id,user_id,starts_on,ends_on,reason FROM platform_time_off WHERE ends_on>=? ORDER BY starts_on').all(today());
    // Workload: open and waiting platform records assigned to the person (support tickets, tasks, incidents and so on).
    const work = db.prepare("SELECT assigned_to,kind,status,COUNT(*) n FROM platform_records WHERE assigned_to IS NOT NULL AND status IN ('open','waiting') GROUP BY assigned_to,kind,status").all();
    const people = users.map((u) => {
      const p = profiles.get(u.id) || { job_title: '', department_id: null, weekly_capacity_hours: null, work_days: '[1,2,3,4,5]', work_start: '09:00', work_end: '17:00', timezone: 'Australia/Perth', availability: 'available', availability_note: '', away_until: null, revision: 0 };
      const mine = work.filter((w) => w.assigned_to === u.id), byKind = {};
      for (const w of mine) byKind[w.kind] = (byKind[w.kind] || 0) + w.n;
      let days = [1, 2, 3, 4, 5]; try { days = JSON.parse(p.work_days); } catch {}
      return {
        id: u.id, name: u.name, email: u.email, role: u.role, account: u.status,
        job_title: p.job_title, department_id: p.department_id, team_ids: members.filter((m) => m.user_id === u.id).map((m) => m.team_id),
        weekly_capacity_hours: p.weekly_capacity_hours, work_days: days, work_start: p.work_start, work_end: p.work_end, timezone: p.timezone,
        availability: effective(p, off.filter((t) => t.user_id === u.id)), set_availability: p.availability, away_until: p.away_until, availability_note: p.availability_note,
        time_off: off.filter((t) => t.user_id === u.id).map(({ user_id, ...t }) => t),
        workload: { open: mine.filter((w) => w.status === 'open').reduce((s, w) => s + w.n, 0), waiting: mine.filter((w) => w.status === 'waiting').reduce((s, w) => s + w.n, 0), by_kind: byKind },
        revision: p.revision
      };
    });
    const unassigned = db.prepare("SELECT COUNT(*) n FROM platform_records WHERE assigned_to IS NULL AND status IN ('open','waiting')").get().n;
    return { departments, teams, people, unassigned_open_items: unassigned };
  }

  app.get('/api/operator/team', ...guard('read'), (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, me: req.platform.id, ...snapshot(), note: 'Sign-in roles and permissions are managed in Founder controls → Operator staff & roles.' });
  });

  // ---- departments ----
  const deptSchema = z.object({ name, description: text(500).default(''), lead_id: z.string().max(80).nullable().default(null) });
  app.post('/api/operator/team/departments', ...guard('create'), (req, res) => {
    const p = parse(deptSchema, req.body); if (!p.success) return bad(res, 'Give the department a name (2 to 80 characters).');
    if (!leadOk(p.data.lead_id)) return bad(res, 'The lead must be an active Oprun staff member.');
    if (db.prepare('SELECT 1 FROM platform_departments WHERE name=? COLLATE NOCASE AND archived=0').get(p.data.name)) return bad(res, 'A department with this name already exists.', 409);
    const id = crypto.randomUUID(), t = iso();
    db.prepare('INSERT INTO platform_departments(id,name,description,lead_id,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(id, p.data.name, p.data.description, p.data.lead_id || null, req.platform.id, t, t);
    platform.log(req.platform.id, 'team.department.created', 'team', id);
    res.status(201).json({ ok: true, id });
  });
  const deptUpdate = z.object({ name: name.optional(), description: text(500).optional(), lead_id: z.string().max(80).nullable().optional(), archived: z.boolean().optional(), revision: z.number().int().positive() });
  app.put('/api/operator/team/departments/:id', ...guard('edit'), (req, res) => {
    const p = parse(deptUpdate, req.body); if (!p.success) return bad(res, 'Check the department details and try again.');
    const d = db.prepare('SELECT * FROM platform_departments WHERE id=?').get(req.params.id); if (!d) return bad(res, 'Department not found.', 404);
    if (p.data.lead_id !== undefined && !leadOk(p.data.lead_id)) return bad(res, 'The lead must be an active Oprun staff member.');
    const r = db.prepare('UPDATE platform_departments SET name=?,description=?,lead_id=?,archived=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
      .run(p.data.name ?? d.name, p.data.description ?? d.description, p.data.lead_id === undefined ? d.lead_id : p.data.lead_id || null, p.data.archived === undefined ? d.archived : p.data.archived ? 1 : 0, iso(), d.id, p.data.revision);
    if (!r.changes) return bad(res, 'Someone else changed this department. Reload and try again.', 409);
    platform.log(req.platform.id, 'team.department.updated', 'team', d.id);
    res.json({ ok: true });
  });

  // ---- teams ----
  const teamSchema = z.object({ department_id: z.string().max(80), name, description: text(500).default(''), lead_id: z.string().max(80).nullable().default(null), members: z.array(z.string().max(80)).max(100).default([]) });
  const membersOk = (ids) => ids.every(staffExists);
  const setMembers = (teamId, ids) => {
    db.prepare('DELETE FROM platform_team_members WHERE team_id=?').run(teamId);
    const add = db.prepare('INSERT OR IGNORE INTO platform_team_members(team_id,user_id,added_at) VALUES (?,?,?)');
    for (const u of new Set(ids)) add.run(teamId, u, iso());
  };
  app.post('/api/operator/team/teams', ...guard('create'), (req, res) => {
    const p = parse(teamSchema, req.body); if (!p.success) return bad(res, 'Give the team a name and choose its department.');
    if (!db.prepare('SELECT 1 FROM platform_departments WHERE id=? AND archived=0').get(p.data.department_id)) return bad(res, 'Choose an existing department.');
    if (!leadOk(p.data.lead_id) || !membersOk(p.data.members)) return bad(res, 'Leads and members must be active Oprun staff members.');
    const id = crypto.randomUUID(), t = iso();
    db.transaction(() => {
      db.prepare('INSERT INTO platform_teams(id,department_id,name,description,lead_id,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id, p.data.department_id, p.data.name, p.data.description, p.data.lead_id || null, req.platform.id, t, t);
      setMembers(id, p.data.members);
    })();
    platform.log(req.platform.id, 'team.team.created', 'team', id);
    res.status(201).json({ ok: true, id });
  });
  const teamUpdate = z.object({ department_id: z.string().max(80).optional(), name: name.optional(), description: text(500).optional(), lead_id: z.string().max(80).nullable().optional(), members: z.array(z.string().max(80)).max(100).optional(), archived: z.boolean().optional(), revision: z.number().int().positive() });
  app.put('/api/operator/team/teams/:id', ...guard('edit'), (req, res) => {
    const p = parse(teamUpdate, req.body); if (!p.success) return bad(res, 'Check the team details and try again.');
    const t0 = db.prepare('SELECT * FROM platform_teams WHERE id=?').get(req.params.id); if (!t0) return bad(res, 'Team not found.', 404);
    if (p.data.department_id && !db.prepare('SELECT 1 FROM platform_departments WHERE id=? AND archived=0').get(p.data.department_id)) return bad(res, 'Choose an existing department.');
    if ((p.data.lead_id !== undefined && !leadOk(p.data.lead_id)) || (p.data.members && !membersOk(p.data.members))) return bad(res, 'Leads and members must be active Oprun staff members.');
    let changed = 0;
    db.transaction(() => {
      changed = db.prepare('UPDATE platform_teams SET department_id=?,name=?,description=?,lead_id=?,archived=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
        .run(p.data.department_id ?? t0.department_id, p.data.name ?? t0.name, p.data.description ?? t0.description, p.data.lead_id === undefined ? t0.lead_id : p.data.lead_id || null, p.data.archived === undefined ? t0.archived : p.data.archived ? 1 : 0, iso(), t0.id, p.data.revision).changes;
      if (changed && p.data.members) setMembers(t0.id, p.data.members);
    })();
    if (!changed) return bad(res, 'Someone else changed this team. Reload and try again.', 409);
    platform.log(req.platform.id, 'team.team.updated', 'team', t0.id);
    res.json({ ok: true });
  });

  // ---- people: work details (team managers) and availability (the person themselves or a team manager) ----
  const workSchema = z.object({ job_title: text(80).optional(), department_id: z.string().max(80).nullable().optional(), weekly_capacity_hours: z.number().int().min(0).max(80).nullable().optional(),
    work_days: z.array(z.number().int().refine((d) => DAYS.includes(d))).max(7).optional(), work_start: time.optional(), work_end: time.optional(), timezone: text(60).optional(), revision: z.number().int().min(0) });
  app.put('/api/operator/team/people/:id', ...guard('edit'), (req, res) => {
    const p = parse(workSchema, req.body); if (!p.success) return bad(res, 'Check the work details and try again.');
    if (!staffExists(req.params.id)) return bad(res, 'Staff member not found.', 404);
    if (p.data.department_id && !db.prepare('SELECT 1 FROM platform_departments WHERE id=?').get(p.data.department_id)) return bad(res, 'Choose an existing department.');
    if (p.data.work_start && p.data.work_end && p.data.work_start >= p.data.work_end) return bad(res, 'The end of the working day must be after the start.');
    ensureProfile(req.params.id);
    const cur = db.prepare('SELECT * FROM platform_staff_profiles WHERE user_id=?').get(req.params.id);
    if (cur.revision !== Math.max(1, p.data.revision)) return bad(res, 'Someone else changed these details. Reload and try again.', 409);
    db.prepare('UPDATE platform_staff_profiles SET job_title=?,department_id=?,weekly_capacity_hours=?,work_days=?,work_start=?,work_end=?,timezone=?,revision=revision+1,updated_by=?,updated_at=? WHERE user_id=?')
      .run(p.data.job_title ?? cur.job_title, p.data.department_id === undefined ? cur.department_id : p.data.department_id, p.data.weekly_capacity_hours === undefined ? cur.weekly_capacity_hours : p.data.weekly_capacity_hours,
        p.data.work_days ? JSON.stringify([...new Set(p.data.work_days)].sort()) : cur.work_days, p.data.work_start ?? cur.work_start, p.data.work_end ?? cur.work_end, p.data.timezone ?? cur.timezone, req.platform.id, iso(), req.params.id);
    platform.log(req.platform.id, 'team.person.updated', 'team', req.params.id);
    res.json({ ok: true });
  });

  const self = (req) => req.params.id === 'me' ? req.platform.id : req.params.id;
  // Anyone may set their own availability; changing someone else's needs team edit permission.
  const selfOrTeam = (req, res, next) => (self(req) === req.platform.id ? next() : platform.permit('team', 'edit')(req, res, next));
  const availSchema = z.object({ availability: z.enum(AVAILABILITY), note: text(140).default(''), away_until: date.nullable().default(null) });
  app.put('/api/operator/team/people/:id/availability', platform.identity, selfOrTeam, (req, res) => {
    const id = self(req);
    if (id === 'founder') return bad(res, 'The founder sign-in is not an Oprun staff profile. Create a staff account to track availability.');
    if (!staffExists(id)) return bad(res, 'Staff member not found.', 404);
    const p = parse(availSchema, req.body); if (!p.success) return bad(res, 'Choose available, busy, away or off.');
    if (p.data.availability === 'away' && p.data.away_until && p.data.away_until < today()) return bad(res, 'The return date is in the past.');
    ensureProfile(id);
    db.prepare('UPDATE platform_staff_profiles SET availability=?,availability_note=?,away_until=?,revision=revision+1,updated_by=?,updated_at=? WHERE user_id=?')
      .run(p.data.availability, p.data.note, p.data.availability === 'away' ? p.data.away_until : null, req.platform.id, iso(), id);
    platform.log(req.platform.id, 'team.availability.updated', 'team', id);
    res.json({ ok: true });
  });

  const offSchema = z.object({ starts_on: date, ends_on: date, reason: text(140).default('') });
  app.post('/api/operator/team/people/:id/time-off', platform.identity, selfOrTeam, (req, res) => {
    const id = self(req);
    if (!staffExists(id)) return bad(res, 'Staff member not found.', 404);
    const p = parse(offSchema, req.body); if (!p.success) return bad(res, 'Give a start and end date.');
    if (p.data.ends_on < p.data.starts_on) return bad(res, 'The last day must be on or after the first day.');
    if (p.data.ends_on < today()) return bad(res, 'This time off is already over.');
    const oid = crypto.randomUUID();
    db.prepare('INSERT INTO platform_time_off(id,user_id,starts_on,ends_on,reason,created_by,created_at) VALUES (?,?,?,?,?,?,?)').run(oid, id, p.data.starts_on, p.data.ends_on, p.data.reason, req.platform.id, iso());
    platform.log(req.platform.id, 'team.time_off.created', 'team', id);
    res.status(201).json({ ok: true, id: oid });
  });
  // Cancelling planned time off removes the plan only; nothing else is affected.
  app.delete('/api/operator/team/time-off/:id', platform.identity, (req, res) => {
    const rowId = req.params.id, t = db.prepare('SELECT user_id FROM platform_time_off WHERE id=?').get(rowId);
    if (!t) return bad(res, 'Time off not found.', 404);
    const go = () => { db.prepare('DELETE FROM platform_time_off WHERE id=?').run(rowId); platform.log(req.platform.id, 'team.time_off.cancelled', 'team', t.user_id); res.json({ ok: true }); };
    if (t.user_id === req.platform.id) return go();
    platform.permit('team', 'edit')(req, res, go);
  });
}
