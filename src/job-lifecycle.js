// Job lifecycle messages (T-164, T-165): appointment reminders and booking confirmations.
//
// Each business chooses how customer messages go out (Bookings > Reminders):
//   'approve' (default) every customer message waits in Approvals and is sent after a person approves it;
//   'auto'    the fixed wording below is sent without asking (the owner chose this; nothing is AI-written);
//   'off'     no customer reminders.
// Reminders: the day before (sent between 8 am and 8 pm local time) and on the morning of the job (from 7 am).
// The team: assigned workers get an in-app alert and a text on the day; owners and admins get one morning summary.
// Every message is sent once (reminder_log), customer texts go only through the business's own SMS sender, and
// nothing is sent for completed or cancelled jobs.
import crypto from 'node:crypto';
import { z } from 'zod';

const HOUR = 3600000;
const iso = (d = new Date()) => d.toISOString();
const first = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const mobile = (p) => { const d = String(p || '').replace(/[^\d+]/g, '').replace(/^04/, '+614').replace(/^614/, '+614'); return /^\+614\d{8}$/.test(d) ? d : null; };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Local date (YYYY-MM-DD) and hour in a time zone. */
export function localParts(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Australia/Perth', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
export const whenText = (at, tz) => { try { return new Date(at).toLocaleString('en-AU', { timeZone: tz || 'Australia/Perth', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }); } catch { return new Date(at).toUTCString(); } };
export const timeText = (at, tz) => { try { return new Date(at).toLocaleTimeString('en-AU', { timeZone: tz || 'Australia/Perth', hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };

export function createJobLifecycle({ db, outbound, notify, createApproval = null, smsReady = () => false, enquiryReference = () => null, log = console, now = () => new Date() }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_reminder_settings (organisation_id TEXT PRIMARY KEY, customer_mode TEXT NOT NULL DEFAULT 'approve' CHECK(customer_mode IN ('off','approve','auto')),
      day_before INTEGER NOT NULL DEFAULT 1, day_of INTEGER NOT NULL DEFAULT 1, workers INTEGER NOT NULL DEFAULT 1, owner_summary INTEGER NOT NULL DEFAULT 1, confirmations INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reminder_log (organisation_id TEXT NOT NULL, work_order_id TEXT NOT NULL, kind TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL, detail TEXT,
      PRIMARY KEY (organisation_id, work_order_id, kind, target));`);

  const DEFAULTS = { customer_mode: 'approve', day_before: 1, day_of: 1, workers: 1, owner_summary: 1, confirmations: 1 };
  const settings = (org) => ({ ...DEFAULTS, ...(db.prepare('SELECT * FROM business_reminder_settings WHERE organisation_id=?').get(org) || {}) });
  const schema = z.object({ customer_mode: z.enum(['off', 'approve', 'auto']), day_before: z.boolean(), day_of: z.boolean(), workers: z.boolean(), owner_summary: z.boolean(), confirmations: z.boolean() }).strict();
  function saveSettings(org, user, input) {
    const p = schema.safeParse(input);
    if (!p.success) return { ok: false, status: 400, error: 'Choose how customer reminders are sent.' };
    const d = p.data, b = (v) => (v ? 1 : 0);
    db.prepare(`INSERT INTO business_reminder_settings (organisation_id,customer_mode,day_before,day_of,workers,owner_summary,confirmations,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(organisation_id) DO UPDATE SET customer_mode=excluded.customer_mode,day_before=excluded.day_before,day_of=excluded.day_of,workers=excluded.workers,owner_summary=excluded.owner_summary,confirmations=excluded.confirmations,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
      .run(org, d.customer_mode, b(d.day_before), b(d.day_of), b(d.workers), b(d.owner_summary), b(d.confirmations), user, iso());
    return { ok: true, settings: settings(org) };
  }

  const business = (org) => db.prepare('SELECT COALESCE(display_name,name) name, timezone FROM organisations WHERE id=?').get(org) || { name: 'Our business', timezone: 'Australia/Perth' };
  const customerOf = (org, id) => (id ? db.prepare('SELECT id,name,email,phone FROM tenant_customers WHERE id=? AND organisation_id=?').get(id, org) : null);
  const owner = (org) => db.prepare("SELECT user_id FROM memberships WHERE organisation_id=? AND role='owner' ORDER BY created_at LIMIT 1").get(org)?.user_id || null;
  const once = (org, job, kind, target, detail = null) => db.prepare('INSERT OR IGNORE INTO reminder_log (organisation_id,work_order_id,kind,target,created_at,detail) VALUES (?,?,?,?,?,?)').run(org, job, kind, target, iso(now()), detail).changes === 1;
  const refFor = (org, j) => { const b = db.prepare("SELECT id FROM tenant_documents WHERE organisation_id=? AND kind='booking' AND work_order_id=?").get(org, j.id); return b ? enquiryReference(org, b.id) : null; };

  /** Sends (or stages for approval) one customer message on each channel the customer and the business can use. */
  function toCustomer(org, j, kind, texts) {
    const s = settings(org);
    if (s.customer_mode === 'off') return { skipped: 'off' };
    const c = customerOf(org, j.customer_id);
    if (!c) return { skipped: 'no_customer' };
    const by = owner(org);
    const targets = [];
    const m = mobile(c.phone);
    if (m && smsReady(org)) targets.push({ channel: 'sms', address: m, text: texts.sms });
    if (EMAIL.test(String(c.email || ''))) targets.push({ channel: 'email', address: String(c.email).toLowerCase(), text: texts.email });
    if (!targets.length) return { skipped: 'no_channel' };
    const status = s.customer_mode === 'auto' ? 'approved' : 'pending_approval';
    if (status === 'pending_approval' && (!createApproval || !by)) return { skipped: 'no_approver' };
    const done = [];
    for (const t of targets) {
      if (!once(org, j.id, kind, t.channel)) continue;
      try {
        db.transaction(() => {
          const q = outbound.queue(org, { channel: t.channel, address: t.address, name: c.name, subject: texts.subject, text: t.text, status, customerId: c.id, by, provider: 'oprun_reminders' });
          if (status === 'pending_approval') {
            const req = { saas: { organisation_id: org, user_id: by, role: 'owner' }, ip: 'system', headers: {}, get: () => '' };
            const a = createApproval(req, { approval_type: 'outbound_message', source_module: 'reminders', title: `${t.channel === 'sms' ? 'Text' : 'Email'} ${c.name || 'customer'}: ${texts.label}`.slice(0, 200), summary: t.text.slice(0, 600), entity_type: 'comms_message', entity_id: q.id, risk_level: 'normal', draft_payload: { body: t.text, channel: t.channel, to: t.address, subject: texts.subject, work_order_id: j.id, message_id: q.id, thread_id: q.threadId, kind } });
            db.prepare('UPDATE comms_messages SET approval_id=? WHERE id=?').run(a.id, q.id);
          }
          done.push(t.channel);
        })();
      } catch (e) {
        db.prepare('DELETE FROM reminder_log WHERE organisation_id=? AND work_order_id=? AND kind=? AND target=?').run(org, j.id, kind, t.channel);
        log.warn('[REMINDERS] could not queue', kind, String(e.message || e).slice(0, 160));
      }
    }
    return { channels: done, status };
  }

  function customerTexts(org, j, kind) {
    const b = business(org), c = customerOf(org, j.customer_id), hi = first(c?.name) ? `Hi ${first(c.name)}` : 'Hi', ref = refFor(org, j);
    const when = whenText(j.start_at, b.timezone), at = timeText(j.start_at, b.timezone);
    const where = j.address ? ` at ${j.address}` : '';
    const reply = 'Reply to this message if you need to change it.';
    if (kind === 'confirmation') return { label: 'booking confirmed', subject: `Booking confirmed${ref ? ` (${ref})` : ''}: ${b.name}`, sms: `${hi}, your booking with ${b.name} for ${j.title} is confirmed for ${when}${where}.${ref ? ` Ref ${ref}.` : ''} ${reply}`, email: `${hi},\n\nYour booking with ${b.name} is confirmed.\n\nJob: ${j.title}\nWhen: ${when}${j.address ? `\nWhere: ${j.address}` : ''}${ref ? `\nReference: ${ref}` : ''}\n\n${reply}\n\nKind regards,\n${b.name}` };
    if (kind === 'day_before') return { label: 'reminder for tomorrow', subject: `Reminder: ${j.title} tomorrow`, sms: `${hi}, a reminder from ${b.name}: ${j.title} is booked for tomorrow, ${when}${where}.${ref ? ` Ref ${ref}.` : ''} ${reply}`, email: `${hi},\n\nA reminder that ${b.name} is booked for "${j.title}" tomorrow, ${when}${where}.${ref ? `\nReference: ${ref}` : ''}\n\n${reply}\n\nKind regards,\n${b.name}` };
    return { label: 'reminder for today', subject: `Today: ${j.title} at ${at}`, sms: `${hi}, ${b.name} here: see you today at ${at}${where} for ${j.title}.${ref ? ` Ref ${ref}.` : ''} ${reply}`, email: `${hi},\n\nSee you today at ${at}${where} for "${j.title}".${ref ? `\nReference: ${ref}` : ''}\n\n${reply}\n\nKind regards,\n${b.name}` };
  }

  /** Called when the last required worker accepts: tells the team and confirms with the customer. */
  async function onAllocated(org, workOrderId) {
    const j = db.prepare('SELECT * FROM work_orders WHERE id=? AND organisation_id=?').get(workOrderId, org);
    if (!j || j.completed_at || j.status === 'cancelled') return { skipped: true };
    const b = business(org);
    const names = db.prepare("SELECT w.full_name FROM job_offers o JOIN workers w ON w.id=o.worker_id AND w.organisation_id=o.organisation_id WHERE o.work_order_id=? AND o.organisation_id=? AND o.status='accepted'").all(j.id, org).map((r) => r.full_name);
    if (once(org, j.id, 'allocated', 'team')) await notify.notifyRoles(org, ['owner', 'admin'], { kind: 'job_confirmed', title: `Job confirmed: ${j.title}`.slice(0, 180), body: `${whenText(j.start_at, b.timezone)}. Workers: ${names.join(', ') || 'none'}.`, link: '#work/bookings', urgent: false, dedupe: `job-confirmed:${j.id}` }).catch?.(() => {});
    const s = settings(org);
    const customer = s.confirmations && j.start_at && Date.parse(j.start_at) > now().getTime() ? toCustomer(org, j, 'confirmation', customerTexts(org, j, 'confirmation')) : { skipped: 'off' };
    return { workers: names, customer };
  }

  const automationReminded = (org, id) => { try { return Boolean(db.prepare("SELECT 1 FROM automation_marks WHERE organisation_id=? AND mark='reminded' AND ref=?").get(org, id)); } catch { return false; } };
  /** One pass of the reminder schedule. Safe to run as often as you like: every message is sent once. */
  async function runReminders() {
    const t = now(), out = { customer: 0, workers: 0, summaries: 0 };
    const jobs = db.prepare(`SELECT * FROM work_orders WHERE start_at IS NOT NULL AND completed_at IS NULL AND status NOT IN ('cancelled') AND start_at > ? AND start_at < ? ORDER BY start_at`).all(iso(t), iso(new Date(t.getTime() + 30 * HOUR)));
    const summaries = new Map();
    for (const j of jobs) {
      const org = j.organisation_id, s = settings(org), b = business(org);
      const nowL = localParts(t, b.timezone), jobL = localParts(new Date(j.start_at), b.timezone);
      const isToday = jobL.date === nowL.date;
      const hoursAway = (Date.parse(j.start_at) - t.getTime()) / HOUR;
      try {
        if (s.day_before && !isToday && hoursAway <= 30 && hoursAway >= 12 && nowL.hour >= 8 && nowL.hour < 20 && !automationReminded(org, j.id)) {
          const r = toCustomer(org, j, 'day_before', customerTexts(org, j, 'day_before')); out.customer += r.channels?.length || 0;
          // The older "Send appointment reminders" automation skips jobs marked here, so a customer is never reminded twice.
          if (r.channels?.length) try { db.prepare("INSERT OR IGNORE INTO automation_marks(organisation_id,mark,ref,created_at) VALUES (?,'reminded',?,?)").run(org, j.id, iso(t)); } catch { /* automation tables not installed */ }
        }
        if (isToday && nowL.hour >= 7) {
          if (s.day_of) { const r = toCustomer(org, j, 'day_of', customerTexts(org, j, 'day_of')); out.customer += r.channels?.length || 0; }
          if (s.workers) {
            const ws = db.prepare("SELECT w.id,w.user_id,w.full_name FROM job_offers o JOIN workers w ON w.id=o.worker_id AND w.organisation_id=o.organisation_id WHERE o.work_order_id=? AND o.organisation_id=? AND o.status='accepted'").all(j.id, org);
            for (const w of ws) {
              if (!w.user_id || !once(org, j.id, 'worker_day_of', w.id)) continue;
              await notify.notifyUser(org, w.user_id, { kind: 'job_today', title: `Today ${timeText(j.start_at, b.timezone)}: ${j.title}`.slice(0, 180), body: j.address || '', link: '#work/jobs', urgent: true, dedupe: `job-today:${j.id}:${w.user_id}` });
              out.workers++;
            }
          }
          if (s.owner_summary) { const list = summaries.get(org) || []; list.push(j); summaries.set(org, list); }
        }
      } catch (e) { log.warn('[REMINDERS] job', j.id, String(e.message || e).slice(0, 160)); }
    }
    for (const [org, list] of summaries) {
      const b = business(org), day = localParts(t, b.timezone).date;
      if (!once(org, `summary:${day}`, 'owner_summary', day)) continue;
      await notify.notifyRoles(org, ['owner', 'admin'], { kind: 'jobs_today', title: `${list.length} job${list.length === 1 ? '' : 's'} today`, body: list.slice(0, 6).map((j) => `${timeText(j.start_at, b.timezone)} ${j.title}`).join('; ').slice(0, 600), link: '#work/bookings', urgent: false, dedupe: `jobs-today:${day}` });
      out.summaries++;
    }
    return out;
  }

  function install(app, { requireSaasUser, requireSaasRole, saasAudit }) {
    const senior = requireSaasRole('owner', 'admin', 'manager', 'super_admin', 'director');
    app.get('/api/saas/reminders/settings', requireSaasUser, senior, (req, res) => res.json({ ok: true, settings: settings(req.saas.organisation_id), sms_ready: Boolean(smsReady(req.saas.organisation_id)) }));
    app.put('/api/saas/reminders/settings', requireSaasUser, requireSaasRole('owner', 'admin', 'super_admin'), (req, res) => {
      const r = saveSettings(req.saas.organisation_id, req.saas.user_id, req.body || {});
      if (!r.ok) return res.status(r.status).json(r);
      saasAudit(req, 'reminders.settings_saved', 'organisation', req.saas.organisation_id, { customer_mode: r.settings.customer_mode });
      res.json(r);
    });
  }

  return { settings, saveSettings, onAllocated, runReminders, customerTexts, install };
}
