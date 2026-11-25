// R-13 (T-133) and R-14 (T-134): follow-up after a receptionist call, docs/ai-receptionist/05_LEAD_TO_BOOKING_FLOW.md
// and contract §8-§9. One row per enquiry moves through fixed states. Messages are fixed templates; whether one is sent
// automatically or waits for approval is decided at send time from the class and the owner's approval level. Nothing is
// sent without recorded consent, during quiet hours (8 pm - 8 am local), or without opt-out wording.
import crypto from 'node:crypto';
import { normPhone } from './service.js';

const TERMINAL = new Set(['BOOKED', 'CLOSED_LOST', 'CLOSED_NO_RESPONSE', 'OPTED_OUT']);
const ACTIVE = new Set(['AWAITING_CUSTOMER', 'SLOT_PROPOSED']);
export const MESSAGE_CLASSES = ['post_call_ack', 'booking_confirmation', 'followup_nudge', 'free_text_reply'];
// Contract §8: which classes may go out without a person approving them.
const AUTO = { approve_all: new Set(), auto_confirmations: new Set(['post_call_ack', 'booking_confirmation']), auto_followups: new Set(['post_call_ack', 'booking_confirmation', 'followup_nudge']) };
const RISKY = /\$\s?\d|\bprice|\bcost|\bguarantee|\bpromise|\brefund|\bcomplain/i;

export function createReceptionistFollowups({ db, comms, booking = null, createApproval, actorFor, notify = async () => {}, queue = null, clock = () => Date.now(), log = console }) {
  const iso = (ms = clock()) => new Date(ms).toISOString();
  const row = (org, enquiryId) => db.prepare('SELECT * FROM receptionist_followups WHERE enquiry_id=? AND organisation_id=?').get(enquiryId, org);
  const cfgOf = (org) => db.prepare('SELECT * FROM receptionist_config WHERE organisation_id=?').get(org) || {};
  const tzOf = (org) => cfgOf(org).timezone || db.prepare('SELECT timezone FROM organisations WHERE id=?').get(org)?.timezone || 'Australia/Perth';
  const local = (ms, tz) => Object.fromEntries(new Intl.DateTimeFormat('en-AU', { timeZone: tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23', minute: '2-digit' }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  // Move a time out of quiet hours (8 pm - 8 am) to the next 8 am, in the business time zone.
  function outOfQuiet(ms, tz) { let t = ms; for (let i = 0; i < 48; i++) { const h = +local(t, tz).hour; if (h >= 8 && h < 20) return t; t += 30 * 60000 - (t % (30 * 60000)); } return t; }
  const isWeekday = (ms, tz) => !['Sat', 'Sun'].includes(local(ms, tz).weekday);
  function at10(ms, tz) { let t = ms; for (let i = 0; i < 96; i++) { const p = local(t, tz); if (+p.hour === 10 && +p.minute === 0 && isWeekday(t, tz)) return t; t += 15 * 60000 - (t % (15 * 60000)); } return t; }
  // Contract §9 cadence, from the time the previous attempt went out.
  function nextTime(attemptJustDone, tz, from = clock()) {
    if (attemptJustDone === 0) return outOfQuiet(from + 60000, tz);
    if (attemptJustDone === 1) { let t = outOfQuiet(from + 4 * 3600000, tz); while (!isWeekday(t, tz)) t = outOfQuiet(t + 12 * 3600000, tz); return t; }
    if (attemptJustDone === 2) return at10(from + 12 * 3600000, tz);
    let t = from, days = 0; while (days < 3) { t += 86400000; if (isWeekday(t, tz)) days++; } return at10(t - 3600000, tz);
  }
  function schedule(f, ms) {
    db.prepare('UPDATE receptionist_followups SET next_action_at=?,updated_at=? WHERE id=?').run(iso(ms), iso(), f.id);
    try { queue?.enqueue?.('receptionist.followup', { id: f.id, attempts: f.attempts }, { organisationId: f.organisation_id, idempotencyKey: `rxf:${f.id}:${f.attempts}`, runAt: iso(ms) }); } catch (e) { log.warn?.('[receptionist] could not queue follow-up:', e.message); }
  }
  function setState(f, state, extra = {}) {
    const sets = { state, updated_at: iso(), ...extra };
    db.prepare(`UPDATE receptionist_followups SET ${Object.keys(sets).map((k) => `${k}=@${k}`).join(',')} WHERE id=@id`).run({ ...sets, id: f.id });
    return { ...f, ...sets };
  }
  // Cancel automatic messages not yet sent for this enquiry (drafts' approvals are cancelled too).
  function cancelQueued(f) {
    const msgs = db.prepare("SELECT m.id,m.approval_id FROM comms_messages m JOIN comms_message_schedule s ON s.message_id=m.id JOIN comms_thread_meta t ON t.thread_id=m.thread_id WHERE m.organisation_id=? AND t.enquiry_id=? AND s.state='waiting' AND m.created_by_user_id IS NULL AND m.provider='super_pro'").all(f.organisation_id, f.enquiry_id);
    for (const m of msgs) {
      db.prepare("UPDATE comms_message_schedule SET state='cancelled',error='Follow-up stopped',updated_at=? WHERE message_id=?").run(iso(), m.id);
      db.prepare("UPDATE comms_messages SET status='rejected' WHERE id=? AND status IN ('pending_approval','approved')").run(m.id);
      if (m.approval_id) db.prepare("UPDATE workspace_approvals SET status='cancelled',updated_at=? WHERE id=? AND status IN ('pending','clarification_requested')").run(iso(), m.approval_id);
    }
    return msgs.length;
  }

  // ------------------------------------------------------------------ composing and sending one message
  const consentFor = (org, channel, address) => {
    if (!address) return false;
    const a = channel === 'email' ? String(address).trim().toLowerCase() : normPhone(address);
    if (db.prepare('SELECT 1 FROM marketing_suppressions WHERE owner_key=? AND channel=? AND address=?').get(org, channel, a)) return false;
    return Boolean(db.prepare("SELECT 1 FROM marketing_consents WHERE owner_key=? AND channel=? AND address=? AND status='granted'").get(org, channel, a));
  };
  function channelFor(org, cust) {
    if (cust?.phone && consentFor(org, 'sms', cust.phone)) return { channel: 'sms', to: normPhone(cust.phone) };
    if (cust?.email && consentFor(org, 'email', cust.email)) return { channel: 'email', to: String(cust.email).trim().toLowerCase() };
    return null;
  }
  function threadFor(org, ch, cust, enquiryId) {
    let t = db.prepare('SELECT id FROM comms_threads WHERE organisation_id=? AND channel=? AND contact_address=?').get(org, ch.channel, ch.to);
    if (!t) { t = { id: crypto.randomUUID() }; db.prepare("INSERT INTO comms_threads (id,organisation_id,channel,contact_address,contact_name,subject,status,last_message_at,created_at,updated_at) VALUES (?,?,?,?,?,?,'open',?,?,?)").run(t.id, org, ch.channel, ch.to, cust?.name || null, ch.channel === 'email' ? 'Your enquiry' : null, iso(), iso(), iso()); }
    try { comms?.link?.(org, t.id, { customer_id: cust?.id || undefined, enquiry_id: enquiryId }, 'ai_receptionist'); } catch (e) { log.warn?.('[receptionist] link failed:', e.message); }
    return t.id;
  }
  function body(org, cls, f, ctx) {
    const biz = db.prepare('SELECT COALESCE(display_name,name) n FROM organisations WHERE id=?').get(org)?.n || 'us';
    const enq = db.prepare('SELECT title FROM tenant_documents WHERE id=? AND organisation_id=?').get(f.enquiry_id, org);
    const service = String(enq?.title || 'your enquiry').split(' – ')[0], first = String(ctx.cust?.name || '').split(/\s+/)[0] || 'there';
    const end = ctx.channel === 'sms' ? ` ${biz}. Reply STOP to opt out.` : `\n\n${biz}`;
    if (cls === 'post_call_ack') return ctx.pendingLabel ? `Hi ${first}, thanks for calling ${biz}. We've pencilled you in for ${ctx.pendingLabel} and will confirm shortly.${end}` : `Hi ${first}, thanks for calling ${biz}. We've got your request for ${service} and will be in touch about a time.${end}`;
    if (cls === 'booking_confirmation') return `${first}, you're booked for ${service} on ${ctx.label}${ctx.address ? ` at ${ctx.address}` : ''}. Reply here if anything changes.${end}`;
    if (cls === 'followup_nudge' && ctx.attempt === 4) return `Hi ${first}, still keen on ${service}? Reply with a time that suits, or we'll close this off.${end}`;
    if (cls === 'followup_nudge') return `Hi ${first}, when suits you for ${service}?${ctx.times?.length ? ` We have ${ctx.times.join(' or ')}.` : ''} Reply with a day and time.${end}`;
    return `${String(ctx.text || '').slice(0, 900)}${end}`;
  }
  // Creates the message: approved and scheduled (auto), or a draft that waits for approval. Returns what happened.
  function sendOrDraft(org, f, cls, ctx = {}) {
    const cust = f.customer_id ? db.prepare('SELECT * FROM tenant_customers WHERE id=? AND organisation_id=?').get(f.customer_id, org) : null;
    const ch = ctx.channelPref ? (consentFor(org, ctx.channelPref, ctx.channelPref === 'sms' ? cust?.phone : cust?.email) ? { channel: ctx.channelPref, to: ctx.channelPref === 'sms' ? normPhone(cust.phone) : String(cust.email).trim().toLowerCase() } : null) : channelFor(org, cust);
    if (!ch) return { skipped: 'no consent' };
    let text = body(org, cls, f, { ...ctx, cust, channel: ch.channel });
    if (cls !== 'free_text_reply' && RISKY.test(ctx.text || '')) cls = 'free_text_reply';
    const level = cfgOf(org).approval_level || 'approve_all', auto = AUTO[level]?.has(cls) && cls !== 'free_text_reply';
    const threadId = threadFor(org, ch, cust, f.enquiry_id), id = crypto.randomUUID(), now = iso();
    const sendAt = iso(outOfQuiet(clock(), tzOf(org)));
    // One pending nudge per enquiry: an older draft still waiting is replaced, never doubled.
    if (!auto) for (const old of db.prepare("SELECT m.id,m.approval_id FROM comms_messages m WHERE m.organisation_id=? AND m.thread_id=? AND m.status='pending_approval' AND m.created_by_user_id IS NULL AND m.provider='super_pro'").all(org, threadId)) {
      db.prepare("UPDATE comms_messages SET status='rejected' WHERE id=?").run(old.id);
      db.prepare("UPDATE comms_message_schedule SET state='cancelled',error='Replaced by a newer follow-up',updated_at=? WHERE message_id=?").run(now, old.id);
      if (old.approval_id) db.prepare("UPDATE workspace_approvals SET status='cancelled',updated_at=? WHERE id=? AND status IN ('pending','clarification_requested')").run(now, old.approval_id);
    }
    db.prepare("INSERT INTO comms_messages (id,organisation_id,thread_id,direction,kind,body,provider,status,ai_generated,created_by_user_id,occurred_at,created_at) VALUES (?,?,?,'outbound','message',?,'super_pro',?,1,NULL,?,?)").run(id, org, threadId, text.slice(0, 4000), auto ? 'approved' : 'pending_approval', now, now);
    db.prepare("INSERT INTO comms_message_schedule (message_id,organisation_id,send_at,state,created_by,created_at,updated_at) VALUES (?,?,?,'waiting','ai_receptionist',?,?)").run(id, org, sendAt, now, now);
    if (!auto) {
      const ap = createApproval(actorFor(org), { approval_type: 'outbound_message', source_module: 'receptionist', title: `${cls === 'booking_confirmation' ? 'Booking confirmation' : cls === 'post_call_ack' ? 'Thank-you after a call' : 'Follow-up'} to ${cust?.name || ch.to} (${ch.channel})`, summary: text.slice(0, 600), entity_type: 'comms_message', entity_id: id, risk_level: 'normal', draft_payload: { body: text, channel: ch.channel, to: ch.to, message_class: cls }, required_role: 'senior' });
      db.prepare('UPDATE comms_messages SET approval_id=? WHERE id=?').run(ap.id, id);
    }
    return { message_id: id, channel: ch.channel, auto, send_at: sendAt, thread_id: threadId };
  }

  // ------------------------------------------------------------------ transitions (05 §3)
  function onCallEnded(org, enquiryId, { emergency = false } = {}) {
    let f = row(org, enquiryId); if (!f || TERMINAL.has(f.state) || f.state === 'HANDED_TO_STAFF') return f;
    if (emergency) return setState(f, 'HANDED_TO_STAFF', { next_action_at: null });                                   // row 7
    if (f.state === 'QUALIFYING' || f.state === 'NEW') f = setState(f, 'AWAITING_CUSTOMER');                           // row 5
    if (f.attempts === 0) {
      const hold = db.prepare('SELECT start_at FROM receptionist_slot_holds WHERE organisation_id=? AND enquiry_id=? AND expires_at>?').get(org, enquiryId, iso());
      const r = sendOrDraft(org, f, 'post_call_ack', { pendingLabel: hold && booking?.label ? booking.label(org, hold.start_at) : null });  // rows 5/6, attempt 1
      f = setState(f, f.state, { attempts: 1, step: 1, last_channel: r.channel || null });
      if (f.state !== 'BOOKING_PENDING_APPROVAL') schedule(f, nextTime(1, tzOf(org)));
    }
    return f;
  }
  function onBooked(org, enquiryId, { via = null, label = null, address = null } = {}) {
    const f = row(org, enquiryId); if (!f || TERMINAL.has(f.state) && f.state !== 'BOOKED') return f;
    cancelQueued(f);
    const done = setState(f, 'BOOKED', { next_action_at: null });                                                         // rows 4, 8, 18
    if (via === 'receptionist' && label) sendOrDraft(org, done, 'booking_confirmation', { label, address });
    return done;
  }
  function onBookingRejected(org, enquiryId) { const f = row(org, enquiryId); if (!f || f.state !== 'BOOKING_PENDING_APPROVAL') return f; const g = setState(f, 'AWAITING_CUSTOMER'); schedule(g, nextTime(Math.max(1, g.attempts), tzOf(org))); return g; } // row 9
  function onCustomerReplied(org, enquiryId, { stop = false } = {}) {
    const f = row(org, enquiryId); if (!f || TERMINAL.has(f.state)) return f;
    if (stop) { cancelQueued(f); return setState(f, 'OPTED_OUT', { next_action_at: null, stop_reason: 'opted_out' }); }  // row 14
    if (f.state === 'HANDED_TO_STAFF') return f;
    return setState(f, f.state, { next_action_at: null });                                                                // row 12: pause
  }
  function onStaffTookOver(org, enquiryId) { const f = row(org, enquiryId); if (!f || TERMINAL.has(f.state)) return f; cancelQueued(f); return setState(f, 'HANDED_TO_STAFF', { next_action_at: null }); } // row 15
  function onStaffResumed(org, enquiryId) {                                                                               // row 16
    const f = row(org, enquiryId); if (!f || !['HANDED_TO_STAFF', 'CLOSED_NO_RESPONSE'].includes(f.state)) return f;
    const g = setState(f, 'AWAITING_CUSTOMER', { stop_reason: null }); schedule(g, nextTime(Math.max(1, g.attempts), tzOf(org))); return g;
  }
  function onEnquiryClosed(org, enquiryId) { const f = row(org, enquiryId); if (!f || TERMINAL.has(f.state)) return f; cancelQueued(f); return setState(f, 'CLOSED_LOST', { next_action_at: null, stop_reason: 'enquiry_closed' }); } // row 17

  // One scheduled attempt. Acts only if the row is still where the job expected it (a reply or booking may have come).
  async function runAttempt({ id, attempts }) {
    const f = db.prepare('SELECT * FROM receptionist_followups WHERE id=?').get(id);
    if (!f || !ACTIVE.has(f.state) || f.attempts !== attempts || !f.next_action_at || Date.parse(f.next_action_at) > clock() + 1000) return { skipped: true };
    const org = f.organisation_id, enq = db.prepare('SELECT status FROM tenant_documents WHERE id=? AND organisation_id=?').get(f.enquiry_id, org);
    if (!enq || ['closed', 'lost', 'cancelled'].includes(enq.status)) return { state: onEnquiryClosed(org, f.enquiry_id)?.state };
    if (['booked', 'completed'].includes(enq.status)) return { state: onBooked(org, f.enquiry_id)?.state };
    // A person replied by hand on a linked thread since the last attempt: they own it now.
    if (db.prepare("SELECT 1 FROM comms_messages m JOIN comms_thread_meta t ON t.thread_id=m.thread_id WHERE m.organisation_id=? AND t.enquiry_id=? AND m.direction='outbound' AND m.created_by_user_id IS NOT NULL AND m.created_at>?").get(org, f.enquiry_id, f.updated_at)) return { state: onStaffTookOver(org, f.enquiry_id).state };
    if (f.attempts >= 4) {                                                                                                // row 11
      const g = setState(f, 'CLOSED_NO_RESPONSE', { next_action_at: null, stop_reason: 'no_response' });
      await Promise.resolve(notify(org, { kind: 'receptionist_message', title: 'Follow-up finished with no reply', body: 'The enquiry is still open; close it or call the customer.', link: '#work/enquiries', dedupe: `receptionist:noreply:${f.id}` })).catch(() => {});
      return { state: g.state };
    }
    const attempt = f.attempts + 1;
    const times = attempt < 4 && booking?.offerTimes ? booking.offerTimes(org, f.enquiry_id) : [];
    const r = sendOrDraft(org, f, 'followup_nudge', { attempt, times });                                                // row 10
    const g = setState(f, times.length ? 'SLOT_PROPOSED' : f.state, { attempts: attempt, step: attempt, last_channel: r.channel || f.last_channel });
    schedule(g, attempt >= 4 ? clock() + 3 * 86400000 : nextTime(attempt, tzOf(org)));
    return { state: g.state, attempt, ...r };
  }
  // Safety sweep (every 5 minutes): due rows get their job, so a crash before queueing loses nothing.
  async function sweep() {
    let n = 0;
    for (const f of db.prepare('SELECT * FROM receptionist_followups WHERE next_action_at IS NOT NULL AND next_action_at<=? ORDER BY next_action_at LIMIT 200').all(iso())) {
      if (!ACTIVE.has(f.state)) continue;
      try { await runAttempt({ id: f.id, attempts: f.attempts }); n++; } catch (e) { log.warn?.('[receptionist] follow-up failed:', e.message); }
    }
    return { ran: n };
  }
  // Live tool draft_followup (04 §3.9): only to a caller who agreed to texts/emails in this call.
  function draftFollowup(org, call, a) {
    const fresh = db.prepare('SELECT customer_id,enquiry_id FROM voice_calls WHERE call_control_id=? AND organisation_id=?').get(call.call_control_id, org);
    const f = fresh?.enquiry_id ? row(org, fresh.enquiry_id) : null;
    if (!f || !fresh.customer_id) return { status: 409, code: 'ERR_PRECONDITION', speak: 'Let me just grab your details first.' };
    const r = sendOrDraft(org, f, a.message_class, { channelPref: a.channel, text: a.intent });
    if (r.skipped) return { status: 409, code: 'ERR_PRECONDITION', speak: a.channel === 'sms' ? 'Is it OK if I text that to you?' : 'Is it OK if I email that to you?' };
    return { data: { status: r.auto ? 'queued' : 'draft' }, speak: r.auto ? "I'll get that out to you." : 'The team will send that through shortly.' };
  }

  return { onCallEnded, onBooked, onBookingRejected, onCustomerReplied, onStaffTookOver, onStaffResumed, onEnquiryClosed, runAttempt, sweep, sendOrDraft, draftFollowup, nextTime };
}
