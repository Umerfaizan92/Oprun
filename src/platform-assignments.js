// TR-32: assignment and tracking for Oprun's own staff.
// The founder (or a manager with team edit and edit rights on the item's area) assigns an enquiry, ticket, task,
// incident, team task or project to a staff member with a due date and priority. The assignee sees it under
// "My work", moves it along and completes it with a note and optional evidence link. The assigner then accepts it
// (the record closes) or reopens it with a reason. Every step is kept in platform_assignment_events and the audit log.
// Works only on platform_records (Oprun's own records); subscriber business data is never touched.
import crypto from 'node:crypto';
import { z } from 'zod';

// Record kind → console area (must match the record kinds in operator-console.js).
export const ASSIGNABLE = { prospect: 'marketing', ticket: 'support', task: 'operations', incident: 'operations', staff_task: 'team', project: 'team' };
export const KIND_LABEL = { prospect: 'Enquiry', ticket: 'Support ticket', task: 'Task', incident: 'Incident', staff_task: 'Team task', project: 'Project' };
const ACTIVE = ['assigned', 'in_progress', 'blocked', 'reopened'];
const PRIORITY = ['low', 'normal', 'high', 'urgent'];
const COLUMNS = { due_on: 'TEXT', priority: "TEXT NOT NULL DEFAULT 'normal'", assigned_by: 'TEXT', assigned_at: 'TEXT', work_state: 'TEXT', completed_at: 'TEXT', completion_note: 'TEXT', evidence_url: 'TEXT', reviewed_by: 'TEXT', reviewed_at: 'TEXT' };

export function installPlatformAssignments(app, { db, platform, now = () => new Date() }) {
  const have = new Set(db.prepare('PRAGMA table_info(platform_records)').all().map((c) => c.name));
  for (const [c, t] of Object.entries(COLUMNS)) if (!have.has(c)) db.exec(`ALTER TABLE platform_records ADD COLUMN ${c} ${t}`);
  db.exec(`CREATE TABLE IF NOT EXISTS platform_assignment_events(id TEXT PRIMARY KEY,record_id TEXT NOT NULL REFERENCES platform_records(id),actor TEXT NOT NULL,action TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS platform_assignment_events_record ON platform_assignment_events(record_id,created_at);
 CREATE INDEX IF NOT EXISTS platform_records_assignee ON platform_records(assigned_to,work_state);`);

  const iso = () => now().toISOString();
  const today = () => iso().slice(0, 10);
  const bad = (res, error, status = 400) => res.status(status).json({ ok: false, error });
  const names = () => new Map([['founder', 'Founder'], ...db.prepare('SELECT id,name FROM platform_users').all().map((u) => [u.id, u.name])]);
  const staff = (id) => db.prepare("SELECT id,name,grants_json FROM platform_users WHERE id=? AND status='active'").get(id);
  const grantsOf = (u) => { try { return JSON.parse(u.grants_json || '[]'); } catch { return []; } };
  const staffCanRead = (u, section) => grantsOf(u).includes(section + '.read');
  const canManage = (req, kind) => platform.can(req, ASSIGNABLE[kind], 'edit') && platform.can(req, 'team', 'edit');
  const event = (recordId, actor, action, note = '') => db.prepare('INSERT INTO platform_assignment_events(id,record_id,actor,action,note,created_at) VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(), recordId, actor, action, note, iso());
  const get = (id) => db.prepare('SELECT * FROM platform_records WHERE id=?').get(id);

  function view(r, who = names()) {
    const overdue = !!(r.due_on && r.due_on < today() && ACTIVE.includes(r.work_state));
    return { id: r.id, kind: r.kind, kind_label: KIND_LABEL[r.kind] || r.kind, title: r.title, body: r.body, status: r.status, revision: r.revision,
      assigned_to: r.assigned_to, assignee: who.get(r.assigned_to) || null, assigned_by: r.assigned_by, assigner: who.get(r.assigned_by) || null, assigned_at: r.assigned_at,
      due_on: r.due_on, priority: r.priority || 'normal', state: r.work_state, overdue,
      completed_at: r.completed_at, completion_note: r.completion_note, evidence_url: r.evidence_url, reviewed_by: who.get(r.reviewed_by) || null, reviewed_at: r.reviewed_at };
  }
  const order = "ORDER BY CASE work_state WHEN 'done' THEN 0 WHEN 'blocked' THEN 1 WHEN 'reopened' THEN 2 WHEN 'assigned' THEN 3 WHEN 'in_progress' THEN 4 ELSE 5 END, CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, COALESCE(due_on,'9999') , assigned_at DESC";

  // ---- managers: everything assigned in the areas they can read ----
  app.get('/api/operator/assignments', platform.identity, platform.permit('team', 'read'), (req, res) => {
    const kinds = Object.keys(ASSIGNABLE).filter((k) => platform.can(req, ASSIGNABLE[k], 'read'));
    const state = String(req.query.state || 'open');
    const where = state === 'all' ? '' : state === 'review' ? " AND work_state='done'" : state === 'closed' ? " AND work_state='accepted'" : ` AND work_state IN (${ACTIVE.map(() => '?').join(',')},'done')`;
    const args = state === 'open' ? ACTIVE : [];
    const rows = kinds.length ? db.prepare(`SELECT * FROM platform_records WHERE work_state IS NOT NULL AND kind IN (${kinds.map(() => '?').join(',')})${where} ${order} LIMIT 300`).all(...kinds, ...args) : [];
    const who = names();
    const items = rows.map((r) => view(r, who));
    const assignees = platform.can(req, 'team', 'edit')
      ? db.prepare("SELECT id,name,grants_json FROM platform_users WHERE status='active' ORDER BY name COLLATE NOCASE").all().map((u) => ({ id: u.id, name: u.name, areas: Object.values(ASSIGNABLE).filter((s, i, a) => a.indexOf(s) === i && staffCanRead(u, s)) }))
      : [];
    const all = kinds.length ? db.prepare(`SELECT work_state,due_on FROM platform_records WHERE work_state IS NOT NULL AND kind IN (${kinds.map(() => '?').join(',')})`).all(...kinds) : [];
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, me: req.platform.id, items, assignees,
      kinds: kinds.map((k) => ({ kind: k, label: KIND_LABEL[k], area: ASSIGNABLE[k], can_create: platform.can(req, ASSIGNABLE[k], 'create') && canManage(req, k), can_assign: canManage(req, k) })),
      counts: { open: all.filter((r) => ACTIVE.includes(r.work_state)).length, review: all.filter((r) => r.work_state === 'done').length, overdue: all.filter((r) => r.due_on && r.due_on < today() && ACTIVE.includes(r.work_state)).length, blocked: all.filter((r) => r.work_state === 'blocked').length } });
  });

  // ---- staff: my work (any signed-in Oprun staff member) ----
  app.get('/api/operator/assignments/mine', platform.identity, (req, res) => {
    const rows = db.prepare(`SELECT * FROM platform_records WHERE assigned_to=? AND work_state IS NOT NULL AND (work_state<>'accepted' OR reviewed_at>=?) ${order} LIMIT 200`).all(req.platform.id, new Date(now().getTime() - 14 * 86400000).toISOString());
    const who = names();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, items: rows.map((r) => view(r, who)) });
  });

  const canSee = (req, r) => r.assigned_to === req.platform.id || platform.can(req, ASSIGNABLE[r.kind], 'read') && platform.can(req, 'team', 'read');
  app.get('/api/operator/assignments/:id', platform.identity, (req, res) => {
    const r = get(req.params.id);
    if (!r || !ASSIGNABLE[r.kind] || !r.work_state || !canSee(req, r)) return bad(res, 'Assignment not found.', 404);
    const who = names();
    res.json({ ok: true, item: view(r, who), history: db.prepare('SELECT actor,action,note,created_at FROM platform_assignment_events WHERE record_id=? ORDER BY created_at,rowid').all(r.id).map((e) => ({ ...e, actor: who.get(e.actor) || 'Former staff member' })) });
  });

  // ---- assign: a new item, or an existing record ----
  const assignFields = { assignee_id: z.string().min(1).max(80), due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null), priority: z.enum(PRIORITY).default('normal'), note: z.string().trim().max(1000).default('') };
  function checkAssignee(kind, id) {
    const u = staff(id);
    if (!u) return 'Choose an active Oprun staff member.';
    if (!staffCanRead(u, ASSIGNABLE[kind])) return `${u.name} cannot open ${KIND_LABEL[kind].toLowerCase()}s. Give them access first in Founder controls → Operator staff & roles.`;
    return null;
  }
  const dueOk = (d) => !d || d >= today();

  const createSchema = z.object({ kind: z.enum(Object.keys(ASSIGNABLE)), title: z.string().trim().min(2).max(200), body: z.string().max(15000).default(''), ...assignFields }).strict();
  app.post('/api/operator/assignments', platform.identity, (req, res) => {
    const p = createSchema.safeParse(req.body ?? {});
    if (!p.success) return bad(res, 'Give a title, choose who does it and a valid due date.');
    const { kind } = p.data;
    if (!platform.can(req, ASSIGNABLE[kind], 'create') || !canManage(req, kind)) return bad(res, 'You cannot create and assign this type of work.', 403);
    const problem = checkAssignee(kind, p.data.assignee_id); if (problem) return bad(res, problem);
    if (!dueOk(p.data.due_on)) return bad(res, 'The due date is in the past.');
    const id = crypto.randomUUID(), t = iso();
    db.transaction(() => {
      db.prepare("INSERT INTO platform_records(id,kind,title,body,status,assigned_to,created_by,created_at,updated_at,due_on,priority,assigned_by,assigned_at,work_state) VALUES (?,?,?,?,'open',?,?,?,?,?,?,?,?,'assigned')")
        .run(id, kind, p.data.title, p.data.body, p.data.assignee_id, req.platform.id, t, t, p.data.due_on, p.data.priority, req.platform.id, t);
      event(id, req.platform.id, 'assigned', p.data.note);
    })();
    platform.log(req.platform.id, 'assignment.created', ASSIGNABLE[kind], id);
    res.status(201).json({ ok: true, id });
  });

  const assignSchema = z.object({ ...assignFields, revision: z.number().int().positive() }).strict();
  app.post('/api/operator/assignments/:id/assign', platform.identity, (req, res) => {
    const r = get(req.params.id);
    if (!r || !ASSIGNABLE[r.kind]) return bad(res, 'Record not found or cannot be assigned.', 404);
    if (!canManage(req, r.kind)) return bad(res, 'You cannot assign this type of work.', 403);
    const p = assignSchema.safeParse(req.body ?? {});
    if (!p.success) return bad(res, 'Choose who does it and a valid due date.');
    const problem = checkAssignee(r.kind, p.data.assignee_id); if (problem) return bad(res, problem);
    if (!dueOk(p.data.due_on)) return bad(res, 'The due date is in the past.');
    const action = !r.work_state ? 'assigned' : r.assigned_to === p.data.assignee_id ? 'updated' : 'reassigned';
    const changes = db.transaction(() => {
      const c = db.prepare("UPDATE platform_records SET assigned_to=?,due_on=?,priority=?,assigned_by=?,assigned_at=?,work_state=CASE WHEN work_state IS NULL OR work_state='accepted' THEN 'assigned' ELSE work_state END,status=CASE WHEN status='closed' THEN 'open' ELSE status END,revision=revision+1,updated_at=? WHERE id=? AND revision=?")
        .run(p.data.assignee_id, p.data.due_on, p.data.priority, req.platform.id, iso(), iso(), r.id, p.data.revision).changes;
      if (c) event(r.id, req.platform.id, action, p.data.note);
      return c;
    })();
    if (!changes) return bad(res, 'Someone else changed this item. Reload and try again.', 409);
    platform.log(req.platform.id, 'assignment.' + action, ASSIGNABLE[r.kind], r.id);
    res.json({ ok: true });
  });

  // ---- assignee moves the work along ----
  const stepSchema = z.object({ state: z.enum(['in_progress', 'blocked']), note: z.string().trim().max(1000).default(''), revision: z.number().int().positive() }).strict();
  app.post('/api/operator/assignments/:id/progress', platform.identity, (req, res) => {
    const r = get(req.params.id);
    if (!r || !r.work_state || r.assigned_to !== req.platform.id) return bad(res, 'Assignment not found in your work.', 404);
    const p = stepSchema.safeParse(req.body ?? {});
    if (!p.success) return bad(res, 'Choose started or blocked.');
    if (!ACTIVE.includes(r.work_state)) return bad(res, 'This item is not open.', 409);
    if (p.data.state === 'blocked' && p.data.note.length < 5) return bad(res, 'Say what is blocking you so the owner can help.');
    const c = db.transaction(() => {
      const n = db.prepare('UPDATE platform_records SET work_state=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(p.data.state, iso(), r.id, p.data.revision).changes;
      if (n) event(r.id, req.platform.id, p.data.state === 'blocked' ? 'blocked' : 'started', p.data.note);
      return n;
    })();
    if (!c) return bad(res, 'This item changed. Reload and try again.', 409);
    platform.log(req.platform.id, 'assignment.' + p.data.state, ASSIGNABLE[r.kind], r.id);
    res.json({ ok: true });
  });

  const doneSchema = z.object({ note: z.string().trim().min(10).max(4000), evidence_url: z.string().trim().max(500).url().refine((u) => /^https:\/\//i.test(u)).nullable().default(null), revision: z.number().int().positive() }).strict();
  app.post('/api/operator/assignments/:id/complete', platform.identity, (req, res) => {
    const r = get(req.params.id);
    if (!r || !r.work_state || r.assigned_to !== req.platform.id) return bad(res, 'Assignment not found in your work.', 404);
    if (!ACTIVE.includes(r.work_state)) return bad(res, 'This item is not open.', 409);
    const p = doneSchema.safeParse({ ...req.body, evidence_url: req.body?.evidence_url || null });
    if (!p.success) return bad(res, 'Describe what you did (at least 10 characters). An evidence link must start with https://.');
    const t = iso();
    const c = db.transaction(() => {
      const n = db.prepare("UPDATE platform_records SET work_state='done',completed_at=?,completion_note=?,evidence_url=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?").run(t, p.data.note, p.data.evidence_url, t, r.id, p.data.revision).changes;
      if (n) event(r.id, req.platform.id, 'completed', p.data.note);
      return n;
    })();
    if (!c) return bad(res, 'This item changed. Reload and try again.', 409);
    platform.log(req.platform.id, 'assignment.completed', ASSIGNABLE[r.kind], r.id);
    res.json({ ok: true });
  });

  // ---- owner reviews completed work ----
  const reviewSchema = z.object({ decision: z.enum(['accept', 'reopen']), note: z.string().trim().max(1000).default(''), revision: z.number().int().positive() }).strict();
  app.post('/api/operator/assignments/:id/review', platform.identity, (req, res) => {
    const r = get(req.params.id);
    if (!r || !ASSIGNABLE[r.kind] || r.work_state !== 'done') return bad(res, 'Nothing waiting for review here.', 404);
    if (!(r.assigned_by === req.platform.id || canManage(req, r.kind))) return bad(res, 'Only the person who assigned it or a team manager can review it.', 403);
    if (r.assigned_to === req.platform.id && req.platform.role !== 'founder') return bad(res, 'Someone else must review your own work.', 403);
    const p = reviewSchema.safeParse(req.body ?? {});
    if (!p.success) return bad(res, 'Choose accept or reopen.');
    if (p.data.decision === 'reopen' && p.data.note.length < 5) return bad(res, 'Say what still needs doing.');
    const accept = p.data.decision === 'accept', t = iso();
    const c = db.transaction(() => {
      const n = db.prepare(`UPDATE platform_records SET work_state=?,status=?,reviewed_by=?,reviewed_at=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?`)
        .run(accept ? 'accepted' : 'reopened', accept ? 'closed' : 'open', req.platform.id, t, t, r.id, p.data.revision).changes;
      if (n) event(r.id, req.platform.id, accept ? 'accepted' : 'reopened', p.data.note);
      return n;
    })();
    if (!c) return bad(res, 'This item changed. Reload and try again.', 409);
    platform.log(req.platform.id, 'assignment.' + (accept ? 'accepted' : 'reopened'), ASSIGNABLE[r.kind], r.id);
    res.json({ ok: true });
  });
}
