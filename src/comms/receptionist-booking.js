// R-10 (T-130) and R-11 (T-131): live appointment times and booking for the AI receptionist (04_TOOLS.md §3.1, §3.4).
// Times come from the business's booking rules and hours; busy time is bookings, jobs and unexpired holds. A slot id
// is signed and bound to one business and one call. Booking waits for approval unless the owner chose 'auto'.
//
// hours_json / bookable_hours shape: { "mon": [["07:00","17:00"]], "tue": [...], ..., "sun": [] } in the config's
// time zone. Anything else (for example the legacy free-text hours) means "no bookable hours": take a message.
import crypto from 'node:crypto';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const J = (v, d) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };

// Offset (minutes) of a time zone at an instant, using the runtime's time zone data.
function offsetMinutes(tz, at) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - at.getTime()) / 60000;
}
// Wall-clock date and time in a zone -> instant.
export function zoned(date, hhmm, tz) {
  const [y, m, d] = date.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
  let t = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 2; i++) t = Date.UTC(y, m - 1, d, h, mi) - offsetMinutes(tz, new Date(t)) * 60000;
  return new Date(t);
}
const localParts = (at, tz) => Object.fromEntries(new Intl.DateTimeFormat('en-AU', { timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((x) => [x.type, x.value]));
export function spokenLabel(at, tz) {
  const p = localParts(at, tz), day = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay(), dn = +p.day;
  const ord = dn % 10 === 1 && dn !== 11 ? 'st' : dn % 10 === 2 && dn !== 12 ? 'nd' : dn % 10 === 3 && dn !== 13 ? 'rd' : 'th';
  const h = +p.hour, m = +p.minute, h12 = h % 12 || 12, ap = h < 12 ? 'am' : 'pm';
  const time = m === 0 ? `${h12} ${ap}` : m === 30 ? `half past ${h12}` : m === 15 ? `quarter past ${h12}` : m === 45 ? `quarter to ${(h + 1) % 12 || 12}` : `${h12}:${String(m).padStart(2, '0')} ${ap}`;
  return `${DAY_NAMES[day]} the ${dn}${ord} at ${time}`;
}

export function createReceptionistBooking({ db, env, pipeline, createApproval, audit = () => {}, actorFor, clock = () => Date.now() }) {
  const hooks = {}; // set by the follow-up module: onBooked, onBookingPending, onBookingRejected
  const secret = () => String(env.VOICE_CALL_TOKEN_SECRET || '');
  const signSlot = (payload) => { const b = Buffer.from(JSON.stringify(payload)).toString('base64url'); return `${b}.${crypto.createHmac('sha256', secret()).update(b).digest('base64url')}`; };
  function readSlot(id) {
    const [b, sig] = String(id || '').split('.'); if (!b || !sig || !secret()) return null;
    const want = crypto.createHmac('sha256', secret()).update(b).digest('base64url');
    if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
    try { const p = JSON.parse(Buffer.from(b, 'base64url').toString('utf8')); return p.exp * 1000 >= clock() ? p : null; } catch { return null; }
  }
  const config = (org) => db.prepare('SELECT * FROM receptionist_config WHERE organisation_id=?').get(org);
  const tzOf = (org, cfg) => cfg?.timezone || db.prepare('SELECT timezone FROM organisations WHERE id=?').get(org)?.timezone || 'Australia/Perth';
  function rulesOf(cfg) { const r = J(cfg?.booking_rules_json, {}); return { services: Array.isArray(r.services) ? r.services : [], buffer_min: Number(r.buffer_min ?? 15), lead_time_hours: Number(r.lead_time_hours ?? 2), window_days: Number(r.window_days ?? 14), bookable_hours: r.bookable_hours ?? null, service_area: Array.isArray(r.service_area) ? r.service_area : [], crews: Math.max(1, Number(r.crews ?? 1)) }; }
  function resolveService(rules, { service_id, service }) {
    if (service_id) return rules.services.find((s) => s.id === service_id) || null;
    const q = String(service || '').trim().toLowerCase(); if (!q) return null;
    return rules.services.find((s) => s.name.toLowerCase() === q || (s.aliases || []).some((a) => a.toLowerCase() === q))
      || rules.services.find((s) => q.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(q) || (s.aliases || []).some((a) => q.includes(a.toLowerCase()))) || null;
  }
  const validHours = (h) => h && typeof h === 'object' && DAYS.some((d) => Array.isArray(h[d]) && h[d].every((x) => Array.isArray(x) && /^\d{2}:\d{2}$/.test(x[0]) && /^\d{2}:\d{2}$/.test(x[1])));
  // Busy intervals [start,end) in ms, all for this organisation only.
  function busy(org, fromMs, toMs, defaultMin) {
    const out = [];
    for (const b of db.prepare("SELECT start_at FROM tenant_documents WHERE organisation_id=? AND kind='booking' AND status<>'cancelled' AND work_order_id IS NULL AND start_at IS NOT NULL").all(org)) { const s = Date.parse(b.start_at); out.push([s, s + defaultMin * 60000]); }
    for (const w of db.prepare("SELECT start_at,estimated_hours FROM work_orders WHERE organisation_id=? AND status<>'cancelled' AND start_at IS NOT NULL").all(org)) { const s = Date.parse(w.start_at); out.push([s, s + (w.estimated_hours ? w.estimated_hours * 3600000 : defaultMin * 60000)]); }
    for (const h of db.prepare('SELECT start_at,end_at FROM receptionist_slot_holds WHERE organisation_id=? AND expires_at>?').all(org, new Date(clock()).toISOString())) out.push([Date.parse(h.start_at), Date.parse(h.end_at)]);
    return out.filter(([s, e]) => Number.isFinite(s) && e > fromMs && s < toMs);
  }
  function capacityAt(org, rules, startMs, tz) {
    let cap = rules.crews;
    const today = localParts(new Date(clock()), tz), day = localParts(new Date(startMs), tz);
    if (today.year === day.year && today.month === day.month && today.day === day.day) {
      try { cap -= db.prepare("SELECT COUNT(*) n FROM staff_availability WHERE organisation_id=? AND status IN ('unavailable','on_leave','day_off')").get(org).n; } catch { /* no availability yet */ }
    }
    return Math.max(0, Math.min(cap, rules.crews));
  }
  const overlaps = (list, s, e) => list.filter(([bs, be]) => bs < e && be > s).length;

  function candidateSlots(org, cfg, rules, svc, { date_from, date_to, duration_minutes, exclude = [] }) {
    const tz = tzOf(org, cfg), hours = rules.bookable_hours ?? J(cfg.hours_json, null);
    if (!validHours(hours)) return [];
    const dur = Number(duration_minutes || svc.duration_min || 60), step = dur + rules.buffer_min;
    const earliest = clock() + rules.lead_time_hours * 3600000, latest = clock() + rules.window_days * 86400000;
    const out = [];
    const d0 = new Date(`${date_from}T00:00:00Z`), d1 = new Date(`${date_to}T00:00:00Z`);
    for (let d = d0; d <= d1 && out.length < 60; d = new Date(d.getTime() + 86400000)) {
      const date = d.toISOString().slice(0, 10), key = DAYS[d.getUTCDay()];
      for (const [a, b] of hours[key] || []) {
        let s = zoned(date, a, tz).getTime(); const close = zoned(date, b, tz).getTime();
        for (; s + dur * 60000 <= close; s += step * 60000) if (s >= earliest && s <= latest && !exclude.includes(s)) out.push([s, s + dur * 60000]);
      }
    }
    const busyList = out.length ? busy(org, out[0][0], out[out.length - 1][1], dur) : [];
    return out.filter(([s, e]) => overlaps(busyList, s, e) < capacityAt(org, rules, s, tz));
  }
  // Up to three, spread out: preferably different days, otherwise at least three hours apart.
  function spread(slots, n = 3) {
    const pick = [];
    for (const s of slots) { if (pick.length >= n) break; if (!pick.some((p) => new Date(p[0]).toDateString() === new Date(s[0]).toDateString())) pick.push(s); }
    for (const s of slots) { if (pick.length >= n) break; if (!pick.includes(s) && pick.every((p) => Math.abs(p[0] - s[0]) >= 3 * 3600000)) pick.push(s); }
    return pick.sort((a, b) => a[0] - b[0]);
  }
  const prefersMorning = (txt) => /morning/i.test(txt || '') ? (h) => h < 12 : /afternoon/i.test(txt || '') ? (h) => h >= 12 : null;

  function checkAvailability(org, call, a) {
    const cfg = config(org), rules = rulesOf(cfg);
    if (!cfg || cfg.status !== 'live' || !rules.services.length) return { status: 409, code: 'ERR_NOT_ALLOWED', speak: "I can't lock a time in myself, but I'll get the team to call you to confirm." };
    const svc = resolveService(rules, a);
    if (!svc) return { status: 400, code: 'ERR_VALIDATION', data: { missing: ['service'], services: rules.services.map((s) => s.name) }, speak: 'Which of our services is it for?' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date_from) || !/^\d{4}-\d{2}-\d{2}$/.test(a.date_to) || a.date_to < a.date_from || (Date.parse(a.date_to) - Date.parse(a.date_from)) > 21 * 86400000) return { status: 400, code: 'ERR_VALIDATION', data: { missing: ['date_from', 'date_to'] }, speak: 'What days would suit you?' };
    if (a.suburb && rules.service_area.length && !rules.service_area.some((x) => x.toLowerCase() === String(a.suburb).trim().toLowerCase())) return { data: { service: svc.name, slots: [], out_of_area: true }, speak: "That's outside the area we cover, I'm afraid." };
    const tz = tzOf(org, cfg);
    let slots = candidateSlots(org, cfg, rules, svc, a);
    const enquiryPrefs = call.enquiry_id ? db.prepare("SELECT body FROM tenant_documents WHERE id=? AND organisation_id=?").get(call.enquiry_id, org)?.body : '';
    const pref = prefersMorning(String(enquiryPrefs).match(/Preferred times: (.*)/)?.[1]);
    if (pref) { const liked = slots.filter(([s]) => pref(+localParts(new Date(s), tz).hour)); if (liked.length) slots = [...liked, ...slots.filter((x) => !liked.includes(x))]; }
    const chosen = spread(slots).map(([s, e]) => ({ slot_id: signSlot({ org, call_control_id: call.call_control_id, service_key: svc.id || svc.name, start_at: new Date(s).toISOString(), end_at: new Date(e).toISOString(), exp: Math.floor(clock() / 1000) + 900 }), label: spokenLabel(new Date(s), tz), start_at: new Date(s).toISOString(), end_at: new Date(e).toISOString() }));
    return { data: { service: svc.name, slots: chosen, out_of_area: false }, speak: chosen.length ? `I've got ${chosen.map((c) => c.label.replace(/ the \d+\w\w/, '')).join(', or ')}.` : "I don't have anything free in those days. Would another week work?" };
  }

  function proposeBooking(org, call, a) {
    const p = readSlot(a.slot_id);
    if (!p || p.org !== org || p.call_control_id !== call.call_control_id) return { status: 400, code: 'ERR_VALIDATION', data: { missing: ['slot_id'] }, speak: 'Let me check the times again.' };
    const fresh = db.prepare('SELECT customer_id,enquiry_id FROM voice_calls WHERE call_control_id=? AND organisation_id=?').get(call.call_control_id, org);
    if (!fresh?.enquiry_id) return { status: 409, code: 'ERR_PRECONDITION', speak: 'Let me just note down what you need first.' };
    const cfg = config(org), rules = rulesOf(cfg), tz = tzOf(org, cfg), s = Date.parse(p.start_at), e = Date.parse(p.end_at);
    if (!cfg || cfg.status !== 'live') return { status: 409, code: 'ERR_NOT_ALLOWED', speak: "I can't lock that in myself, but I'll get the team to call you to confirm." };
    const holdId = crypto.randomUUID(), now = new Date(clock()).toISOString();
    // Re-check and hold in one transaction, so two callers can never hold the same time.
    const ok = db.transaction(() => {
      if (overlaps(busy(org, s, e, (e - s) / 60000), s, e) >= capacityAt(org, rules, s, tz)) return false;
      db.prepare('INSERT INTO receptionist_slot_holds (id,organisation_id,start_at,end_at,call_control_id,enquiry_id,expires_at) VALUES (?,?,?,?,?,?,?)').run(holdId, org, p.start_at, p.end_at, call.call_control_id, fresh.enquiry_id, new Date(clock() + 15 * 60000).toISOString());
      return true;
    }).immediate();
    if (!ok) {
      const svc = rulesOf(cfg).services.find((x) => (x.id || x.name) === p.service_key) || { duration_min: (e - s) / 60000 };
      const from = new Date(s).toISOString().slice(0, 10), to = new Date(s + 7 * 86400000).toISOString().slice(0, 10);
      const alt = spread(candidateSlots(org, cfg, rules, svc, { date_from: from, date_to: to, duration_minutes: (e - s) / 60000 }), 2).map(([x, y]) => ({ slot_id: signSlot({ ...p, start_at: new Date(x).toISOString(), end_at: new Date(y).toISOString(), exp: Math.floor(clock() / 1000) + 900 }), label: spokenLabel(new Date(x), tz), start_at: new Date(x).toISOString(), end_at: new Date(y).toISOString() }));
      return { status: 409, code: 'ERR_CONFLICT', data: { alternatives: alt }, speak: "Ah, that one's just gone." };
    }
    const label = spokenLabel(new Date(s), tz), actor = actorFor(org);
    const cust = fresh.customer_id ? db.prepare('SELECT name FROM tenant_customers WHERE id=? AND organisation_id=?').get(fresh.customer_id, org) : null;
    if (cfg.booking_mode === 'auto') {
      try { pipeline.createBookingFromEnquiry(org, 'ai_receptionist', fresh.enquiry_id, { start_at: p.start_at, end_at: p.end_at, address: a.address, notes: a.notes || '' }); }
      catch (err) { db.prepare('DELETE FROM receptionist_slot_holds WHERE id=?').run(holdId); return { status: 409, code: 'ERR_CONFLICT', data: { alternatives: [] }, speak: "I'm not able to book that one, the team will call you." }; }
      db.prepare('DELETE FROM receptionist_slot_holds WHERE id=?').run(holdId);
      if (hooks.onBooked) hooks.onBooked(org, fresh.enquiry_id, { via: 'receptionist', label, address: a.address });
      else db.prepare("UPDATE receptionist_followups SET state='BOOKED',updated_at=? WHERE enquiry_id=? AND organisation_id=?").run(now, fresh.enquiry_id, org);
      audit(actor, 'receptionist.booking_created', 'enquiry', fresh.enquiry_id, { start_at: p.start_at });
      return { data: { status: 'booked', label }, speak: `You're booked in for ${label}.` };
    }
    // Approval: the hold lasts until the approval expires (24 hours, or 2 hours before the slot if sooner).
    const expires = new Date(Math.max(clock() + 15 * 60000, Math.min(clock() + 24 * 3600000, s - 2 * 3600000))).toISOString();
    const ap = createApproval(actor, { approval_type: 'receptionist_booking', source_module: 'receptionist', title: `Book ${String(a.service).slice(0, 80)} for ${cust?.name || 'a caller'}`, summary: `${label}, ${a.address}`.slice(0, 500), entity_type: 'enquiry', entity_id: fresh.enquiry_id, risk_level: 'normal', draft_payload: { start_at: p.start_at, end_at: p.end_at, address: a.address, notes: a.notes || '', hold_id: holdId }, required_role: 'senior', expires_at: expires });
    db.prepare('UPDATE receptionist_slot_holds SET approval_id=?,expires_at=? WHERE id=?').run(ap.id, expires, holdId);
    db.prepare("UPDATE receptionist_followups SET state='BOOKING_PENDING_APPROVAL',updated_at=? WHERE enquiry_id=? AND organisation_id=?").run(now, fresh.enquiry_id, org);
    audit(actor, 'receptionist.booking_proposed', 'enquiry', fresh.enquiry_id, { start_at: p.start_at, approval: ap.reference_code });
    return { data: { status: 'pending_approval', label }, speak: `I've pencilled you in for ${label}. The team will confirm shortly.` };
  }

  // Called inside the approval decision transaction. Approved: book (an edited time is re-checked; a clash throws and
  // the decision fails with 409). Rejected or expired: release the hold.
  function applyApproval(row, status, editedJson) {
    if (row.approval_type !== 'receptionist_booking') return;
    const org = row.organisation_id, draft = J(row.draft_payload_json, {}), edited = J(editedJson, null) || {};
    const payload = { ...draft, ...edited };
    const now = new Date(clock()).toISOString();
    db.prepare('DELETE FROM receptionist_slot_holds WHERE id=? AND organisation_id=?').run(draft.hold_id, org);
    if (status !== 'approved') { if (hooks.onBookingRejected) hooks.onBookingRejected(org, row.entity_id); else db.prepare("UPDATE receptionist_followups SET state='AWAITING_CUSTOMER',updated_at=? WHERE enquiry_id=? AND organisation_id=? AND state='BOOKING_PENDING_APPROVAL'").run(now, row.entity_id, org); return; }
    if (payload.start_at !== draft.start_at || payload.end_at !== draft.end_at) {
      const cfg = config(org), rules = rulesOf(cfg), s = Date.parse(payload.start_at), e = Date.parse(payload.end_at);
      if (!(e > s) || overlaps(busy(org, s, e, (e - s) / 60000), s, e) >= capacityAt(org, rules, s, tzOf(org, cfg))) throw Object.assign(new Error('That time is no longer free.'), { status: 409 });
    }
    pipeline.createBookingFromEnquiry(org, 'ai_receptionist', row.entity_id, { start_at: payload.start_at, end_at: payload.end_at, address: payload.address, notes: payload.notes || '' });
    if (hooks.onBooked) hooks.onBooked(org, row.entity_id, { via: 'receptionist', label: label(org, payload.start_at), address: payload.address });
    else db.prepare("UPDATE receptionist_followups SET state='BOOKED',updated_at=? WHERE enquiry_id=? AND organisation_id=?").run(now, row.entity_id, org);
  }

  const label = (org, startAt) => spokenLabel(new Date(startAt), tzOf(org, config(org)));
  // Up to two open times for a follow-up message (no hold: the hold happens when the customer accepts).
  function offerTimes(org, enquiryId) {
    const cfg = config(org), rules = rulesOf(cfg); if (!cfg || cfg.status !== 'live' || !rules.services.length) return [];
    const title = db.prepare('SELECT title FROM tenant_documents WHERE id=? AND organisation_id=?').get(enquiryId, org)?.title || '';
    const svc = resolveService(rules, { service: title.split(' – ')[0] }); if (!svc) return [];
    const from = new Date(clock()).toISOString().slice(0, 10), to = new Date(clock() + 7 * 86400000).toISOString().slice(0, 10);
    return spread(candidateSlots(org, cfg, rules, svc, { date_from: from, date_to: to }), 2).map(([x]) => label(org, x));
  }
  return { checkAvailability, proposeBooking, applyApproval, readSlot, candidateSlots, label, offerTimes, hooks };
}
