// T-184: Appointments and the business calendar (Work > Bookings).
// - One calendar: bookings (work orders), appointments, Oprun video meetings and Zoom meetings.
// - Suggested free times inside the business's hours, with clash warnings.
// - A video appointment gets its own Oprun meeting and guest link automatically.
// - Reminders: the customer reminder is shown word for word when the appointment is made and is sent only if the
//   person ticks it (that tick is the approval); the team gets an in-app and phone alert before it starts.
import crypto from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const HOSTS = ['owner', 'admin', 'manager', 'super_admin', 'director'];
const KIND = { in_person: 'In person', phone: 'Phone call', video: 'Video call' };

// Local wall-clock time in a time zone -> UTC Date (no library: correct across daylight saving changes).
export function zonedToUtc(date, hh, mm, tz) {
  const guess = new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  const part = (d) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map((p) => [p.type, p.value]));
  const p = part(guess), asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

export function installAppointments(app, { db, env = {}, requireSaasUser, requireSaasRole, saasAudit, dispatch, notifications, now = () => Date.now() }) {
  db.exec(`CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, customer_id TEXT, contact_name TEXT, contact_email TEXT, contact_phone TEXT,
    title TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'in_person', starts_at TEXT NOT NULL, duration_min INTEGER NOT NULL DEFAULT 30,
    location TEXT, notes TEXT, meeting_id TEXT, status TEXT NOT NULL DEFAULT 'scheduled',
    remind_customer INTEGER NOT NULL DEFAULT 0, remind_channel TEXT, remind_before_min INTEGER NOT NULL DEFAULT 1440, reminder_text TEXT,
    reminded_at TEXT, reminder_error TEXT, staff_before_min INTEGER NOT NULL DEFAULT 30, staff_alerted_at TEXT,
    created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS appointments_org_time ON appointments(organisation_id, starts_at);`);
  const iso = () => new Date(now()).toISOString();
  const org = (req) => req.saas.organisation_id;
  const host = [requireSaasUser, requireSaasRole(...HOSTS)];
  const limiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
  const fail = (res, status, error, extra = {}) => res.status(status).json({ ok: false, error, ...extra });
  const orgRow = (o) => db.prepare('SELECT COALESCE(display_name,name) name, timezone, country FROM organisations WHERE id=?').get(o) || {};
  const tzOf = (o) => orgRow(o).timezone || 'Australia/Perth';
  const fmt = (v, tz) => new Date(v).toLocaleString('en-AU', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const base = () => String(env.PUBLIC_BASE_URL || 'https://www.oprun.ai').replace(/\/$/, '');
  const secretKey = String(env.SAAS_SESSION_SECRET || env.SESSION_SECRET || env.INTEGRATION_ENCRYPTION_KEY || '').trim();
  const guestLink = (m) => (secretKey && m ? `${base()}/saas/meet.html?m=${m.id}#t=${crypto.createHmac('sha256', secretKey).update(`meeting-guest:${m.id}:${m.guest_nonce}`).digest('base64url').slice(0, 32)}` : null);
  const has = (t) => { try { db.prepare(`SELECT 1 FROM ${t} LIMIT 1`).get(); return true; } catch { return false; } };

  // Everything on the calendar between two times.
  function events(o, from, to) {
    const out = [];
    for (const a of db.prepare("SELECT a.*, c.name customer_name FROM appointments a LEFT JOIN tenant_customers c ON c.id=a.customer_id WHERE a.organisation_id=? AND a.status<>'cancelled' AND a.starts_at < ? AND datetime(a.starts_at, '+' || a.duration_min || ' minutes') > datetime(?) ORDER BY a.starts_at").all(o, to, from)) {
      const m = a.meeting_id ? db.prepare('SELECT * FROM meetings WHERE id=?').get(a.meeting_id) : null;
      out.push({ id: a.id, type: 'appointment', kind: a.kind, kind_label: KIND[a.kind] || a.kind, title: a.title, start: a.starts_at, end: new Date(Date.parse(a.starts_at) + a.duration_min * 6e4).toISOString(), who: a.customer_name || a.contact_name || null,
        location: a.location, notes: a.notes, status: a.status, link: m && m.status === 'open' ? guestLink(m) : null, meeting_id: a.meeting_id, reminder: a.remind_customer ? (a.reminded_at ? 'sent' : a.reminder_error ? 'failed' : 'scheduled') : 'off', reminder_error: a.reminder_error, contact_email: a.contact_email, contact_phone: a.contact_phone });
    }
    if (has('work_orders')) for (const w of db.prepare("SELECT w.id,w.title,w.start_at,w.estimated_hours,w.status,w.address,c.name customer FROM work_orders w LEFT JOIN tenant_customers c ON c.id=w.customer_id WHERE w.organisation_id=? AND w.status<>'cancelled' AND w.start_at BETWEEN ? AND ? ORDER BY w.start_at").all(o, from, to))
      out.push({ id: w.id, type: 'booking', title: w.title, start: w.start_at, end: new Date(Date.parse(w.start_at) + (Number(w.estimated_hours) || 1) * 36e5).toISOString(), who: w.customer, location: w.address, status: w.status });
    if (has('meetings')) for (const m of db.prepare("SELECT * FROM meetings WHERE organisation_id=? AND status='open' AND starts_at BETWEEN ? AND ? AND id NOT IN (SELECT meeting_id FROM appointments WHERE meeting_id IS NOT NULL)").all(o, from, to))
      out.push({ id: m.id, type: 'meeting', title: m.title, start: m.starts_at, end: new Date(Date.parse(m.starts_at) + 30 * 6e4).toISOString(), status: 'open' });
    if (has('zoom_meetings')) for (const m of db.prepare("SELECT * FROM zoom_meetings WHERE organisation_id=? AND status='scheduled' AND start_time BETWEEN ? AND ?").all(o, from, to))
      out.push({ id: m.id, type: 'zoom', title: m.topic, start: m.start_time, end: new Date(Date.parse(m.start_time) + (m.duration || 30) * 6e4).toISOString(), link: m.join_url, status: 'scheduled' });
    return out.sort((a, b) => a.start.localeCompare(b.start));
  }
  const overlaps = (o, start, end, exceptId = null) => events(o, new Date(Date.parse(start) - 12 * 36e5).toISOString(), end).filter((e) => e.id !== exceptId && Date.parse(e.start) < Date.parse(end) && Date.parse(e.end) > Date.parse(start));

  app.get('/api/saas/calendar', ...host, (req, res) => {
    const from = Date.parse(req.query.from), to = Date.parse(req.query.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 62 * 864e5) return fail(res, 400, 'Choose a date range of up to two months.');
    res.json({ ok: true, timezone: tzOf(org(req)), events: events(org(req), new Date(from).toISOString(), new Date(to).toISOString()) });
  });

  // Suggested free times: weekdays 8:00-17:00 in the business's time zone (Saturday 9:00-13:00), on the half hour,
  // never in the past and never overlapping anything already on the calendar.
  app.get('/api/saas/appointments/slots', ...host, (req, res) => {
    const date = String(req.query.date || ''), dur = Math.min(Math.max(Number(req.query.duration) || 30, 15), 480);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, 400, 'Choose a date.');
    const tz = tzOf(org(req)), day = new Date(`${date}T12:00:00Z`).getUTCDay();
    const hours = day === 0 ? null : day === 6 ? [9, 13] : [8, 17];
    if (!hours) return res.json({ ok: true, slots: [], note: 'Sunday is outside your usual hours. Pick another day or type a time.' });
    const dayStart = zonedToUtc(date, 0, 0, tz).toISOString(), dayEnd = zonedToUtc(date, 23, 59, tz).toISOString();
    const busy = events(org(req), dayStart, dayEnd);
    const slots = [];
    for (let m = hours[0] * 60; m + dur <= hours[1] * 60 && slots.length < 8; m += 30) {
      const s = zonedToUtc(date, Math.floor(m / 60), m % 60, tz), e = new Date(s.getTime() + dur * 6e4);
      if (s.getTime() < now() + 15 * 6e4) continue;
      if (busy.some((b) => Date.parse(b.start) < e.getTime() && Date.parse(b.end) > s.getTime())) continue;
      slots.push({ start: s.toISOString(), label: s.toLocaleTimeString('en-AU', { timeZone: tz, hour: 'numeric', minute: '2-digit' }) });
    }
    res.json({ ok: true, slots, busy: busy.length, note: slots.length ? null : 'No free time left that day within your usual hours.' });
  });

  const reminderText = (a, tz, bizName, link) => `Reminder from ${bizName}: ${a.title} on ${fmt(a.starts_at, tz)}${a.kind === 'video' && link ? `. Join the video call: ${link}` : a.kind === 'phone' ? '. We will call you.' : a.location ? ` at ${a.location}` : ''}. If you need to change it, reply to this message or call us.`;
  const schema = z.object({
    customer_id: z.string().max(80).optional(), contact_name: z.string().trim().max(160).optional(), contact_email: z.email().max(200).optional(), contact_phone: z.string().trim().max(40).optional(),
    title: z.string().trim().min(2).max(200), kind: z.enum(['in_person', 'phone', 'video']).default('in_person'), starts_at: z.iso.datetime(), duration_min: z.number().int().min(15).max(480).default(30),
    location: z.string().trim().max(300).optional(), notes: z.string().trim().max(2000).optional(),
    remind_customer: z.boolean().default(false), remind_channel: z.enum(['email', 'sms']).optional(), remind_before_min: z.number().int().refine((v) => [60, 120, 1440, 2880].includes(v)).default(1440),
    staff_before_min: z.number().int().refine((v) => [0, 15, 30, 60].includes(v)).default(30), allow_overlap: z.boolean().default(false)
  }).strict();

  app.post('/api/saas/appointments', limiter, ...host, (req, res) => {
    const p = schema.safeParse(req.body || {}); if (!p.success) return fail(res, 400, p.error.issues[0]?.message || 'Check the appointment details.');
    const d = p.data, o = org(req), tz = tzOf(o);
    if (Date.parse(d.starts_at) < now() - 5 * 6e4) return fail(res, 400, 'Choose a time that has not passed.');
    let cust = null;
    if (d.customer_id) { cust = db.prepare('SELECT id,name,email,phone FROM tenant_customers WHERE id=? AND organisation_id=?').get(d.customer_id, o); if (!cust) return fail(res, 404, 'Customer not found.'); }
    const email = d.contact_email || cust?.email || null, phone = d.contact_phone || cust?.phone || null;
    if (d.remind_customer) {
      if (!d.remind_channel) return fail(res, 400, 'Choose email or SMS for the reminder.');
      if (d.remind_channel === 'email' && !email) return fail(res, 400, 'Add the customer\'s email to send an email reminder.');
      if (d.remind_channel === 'sms' && !phone) return fail(res, 400, 'Add the customer\'s mobile number to send an SMS reminder.');
    }
    const end = new Date(Date.parse(d.starts_at) + d.duration_min * 6e4).toISOString();
    const clash = overlaps(o, d.starts_at, end);
    if (clash.length && !d.allow_overlap) return fail(res, 409, `This time overlaps ${clash.map((c) => `"${c.title}"`).slice(0, 3).join(', ')}.`, { conflicts: clash.map((c) => ({ title: c.title, start: c.start, type: c.type })) });
    const id = crypto.randomUUID(), at = iso();
    let meetingId = null, meeting = null;
    db.transaction(() => {
      if (d.kind === 'video' && has('meetings')) {
        meetingId = crypto.randomUUID();
        db.prepare("INSERT INTO meetings (id,organisation_id,title,mode,starts_at,status,guests_allowed,guest_nonce,created_by,created_at) VALUES (?,?,?,'video',?,'open',1,?,?,?)").run(meetingId, o, d.title.slice(0, 120), d.starts_at, crypto.randomBytes(12).toString('hex'), req.saas.user_id, at);
        meeting = db.prepare('SELECT * FROM meetings WHERE id=?').get(meetingId);
      }
      const text = d.remind_customer ? reminderText({ ...d }, tz, orgRow(o).name || 'us', guestLink(meeting)) : null;
      db.prepare(`INSERT INTO appointments (id,organisation_id,customer_id,contact_name,contact_email,contact_phone,title,kind,starts_at,duration_min,location,notes,meeting_id,remind_customer,remind_channel,remind_before_min,reminder_text,staff_before_min,created_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, o, cust?.id || null, d.contact_name || cust?.name || null, email, phone, d.title, d.kind, d.starts_at, d.duration_min, d.location || null, d.notes || null, meetingId, d.remind_customer ? 1 : 0, d.remind_customer ? d.remind_channel : null, d.remind_before_min, text, d.staff_before_min, req.saas.user_id, at, at);
    })();
    saasAudit(req, 'appointment.created', 'appointment', id, { kind: d.kind, reminder: d.remind_customer ? d.remind_channel : 'off' });
    res.status(201).json({ ok: true, appointment: events(o, new Date(Date.parse(d.starts_at) - 1).toISOString(), end).find((e) => e.id === id), overlaps: clash.length });
  });

  // Preview of the customer reminder, word for word, before it is approved by ticking the box.
  app.post('/api/saas/appointments/preview', ...host, (req, res) => {
    const d = z.object({ title: z.string().max(200).default('Your appointment'), kind: z.enum(['in_person', 'phone', 'video']).default('in_person'), starts_at: z.iso.datetime(), location: z.string().max(300).optional() }).safeParse(req.body || {});
    if (!d.success) return fail(res, 400, 'Choose a time first.');
    const o = org(req); res.json({ ok: true, text: reminderText(d.data, tzOf(o), orgRow(o).name || 'us', d.data.kind === 'video' ? `${base()}/saas/meet.html?m=…` : null) });
  });

  app.patch('/api/saas/appointments/:id', limiter, ...host, (req, res) => {
    const a = db.prepare('SELECT * FROM appointments WHERE id=? AND organisation_id=?').get(req.params.id, org(req)); if (!a) return fail(res, 404, 'Appointment not found.');
    const p = z.object({ status: z.enum(['scheduled', 'done', 'cancelled']).optional(), starts_at: z.iso.datetime().optional(), duration_min: z.number().int().min(15).max(480).optional(), notes: z.string().max(2000).optional(), allow_overlap: z.boolean().default(false) }).strict().safeParse(req.body || {});
    if (!p.success) return fail(res, 400, 'Check the changes.');
    const d = p.data, starts = d.starts_at || a.starts_at, dur = d.duration_min || a.duration_min, end = new Date(Date.parse(starts) + dur * 6e4).toISOString();
    if ((d.starts_at || d.duration_min) && !d.allow_overlap) { const clash = overlaps(org(req), starts, end, a.id).filter((c) => c.id !== a.meeting_id); if (clash.length) return fail(res, 409, `This time overlaps ${clash.map((c) => `"${c.title}"`).slice(0, 3).join(', ')}.`); }
    const moved = d.starts_at && d.starts_at !== a.starts_at;
    const text = moved && a.remind_customer ? reminderText({ ...a, starts_at: starts }, tzOf(org(req)), orgRow(org(req)).name || 'us', a.meeting_id ? guestLink(db.prepare('SELECT * FROM meetings WHERE id=?').get(a.meeting_id)) : null) : a.reminder_text;
    db.prepare('UPDATE appointments SET status=?,starts_at=?,duration_min=?,notes=?,reminder_text=?,reminded_at=CASE WHEN ? THEN NULL ELSE reminded_at END,reminder_error=CASE WHEN ? THEN NULL ELSE reminder_error END,staff_alerted_at=CASE WHEN ? THEN NULL ELSE staff_alerted_at END,updated_at=? WHERE id=?')
      .run(d.status || a.status, starts, dur, d.notes ?? a.notes, text, moved ? 1 : 0, moved ? 1 : 0, moved ? 1 : 0, iso(), a.id);
    if (a.meeting_id && (moved || d.status === 'cancelled')) db.prepare(`UPDATE meetings SET starts_at=?${d.status === 'cancelled' ? ",status='ended',ended_at=?" : ''} WHERE id=? AND organisation_id=?`).run(...(d.status === 'cancelled' ? [starts, iso(), a.meeting_id, org(req)] : [starts, a.meeting_id, org(req)]));
    saasAudit(req, 'appointment.updated', 'appointment', a.id, { status: d.status || null, moved: Boolean(moved) });
    res.json({ ok: true });
  });

  // ---- reminders and team alerts ----
  let sweeping = false;
  async function sweep() {
    if (sweeping) return; sweeping = true;
    try {
      const t = now(), soon = new Date(t + 49 * 36e5).toISOString(), past = new Date(t - 36e5).toISOString();
      for (const a of db.prepare("SELECT * FROM appointments WHERE status='scheduled' AND starts_at BETWEEN ? AND ? ORDER BY starts_at LIMIT 200").all(past, soon)) {
        const start = Date.parse(a.starts_at);
        if (a.remind_customer && !a.reminded_at && !a.reminder_error && t >= start - a.remind_before_min * 6e4 && t < start) {
          // Claim first so two sweeps can never send twice.
          if (db.prepare("UPDATE appointments SET reminded_at=? WHERE id=? AND reminded_at IS NULL").run(iso(), a.id).changes) {
            try { await dispatch({ id: crypto.randomUUID(), organisation_id: a.organisation_id, channel: a.remind_channel, contact_address: a.remind_channel === 'email' ? a.contact_email : a.contact_phone, subject: `Reminder: ${a.title}`, body: a.reminder_text }); }
            catch (e) { db.prepare('UPDATE appointments SET reminded_at=NULL,reminder_error=? WHERE id=?').run(String(e.message).slice(0, 300), a.id); notifications?.notifyRoles?.(a.organisation_id, ['owner', 'admin'], { kind: 'appointment', title: `Reminder not sent: ${a.title}`, body: String(e.message).slice(0, 200), link: '#work/bookings', dedupe: `appt-fail:${a.id}` }).catch(() => {}); }
          }
        }
        if (a.staff_before_min && !a.staff_alerted_at && t >= start - a.staff_before_min * 6e4 && t < start + 5 * 6e4) {
          if (db.prepare('UPDATE appointments SET staff_alerted_at=? WHERE id=? AND staff_alerted_at IS NULL').run(iso(), a.id).changes)
            notifications?.notifyRoles?.(a.organisation_id, ['owner', 'admin', 'manager'], { kind: 'appointment', title: `${KIND[a.kind] || 'Appointment'} at ${fmt(a.starts_at, tzOf(a.organisation_id)).split(', ').pop()}: ${a.title}`, body: [a.contact_name, a.location].filter(Boolean).join(' · ') || 'Open Bookings for details.', link: '#work/bookings', dedupe: `appt:${a.id}` }).catch(() => {});
        }
      }
    } finally { sweeping = false; }
  }
  const timer = setInterval(() => { sweep().catch(() => {}); }, Number(env.APPOINTMENT_SWEEP_MS) || 60_000); timer.unref?.();
  return { sweep, events };
}
