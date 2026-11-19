// Outbound customer messages queued through the inbox (T-143, T-144).
// A message is stored in the customer's SMS or email conversation and a schedule row is added for "now".
// The comms scheduler (service.sendDue, every 30 s) sends it only while its status is 'approved', so:
//   status 'pending_approval' → waits in Approvals; sent after a person approves (and possibly edits) it;
//   status 'approved'         → a person already chose to send this exact text (for example "Send quote").
// Every message is visible in the Unibox, and a failed send alerts the owner (see service.sendDue).
import crypto from 'node:crypto';

const iso = () => new Date().toISOString();

export function createOutbound({ db, comms = null }) {
  /** The conversation for this address (created when needed). */
  function threadFor(org, channel, address, name, subject, now = iso()) {
    const t = db.prepare('SELECT id FROM comms_threads WHERE organisation_id=? AND channel=? AND contact_address=?').get(org, channel, address);
    if (t) {
      db.prepare('UPDATE comms_threads SET contact_name=COALESCE(contact_name,?),subject=COALESCE(subject,?),updated_at=? WHERE id=?').run(name || null, subject || null, now, t.id);
      return t.id;
    }
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO comms_threads (id,organisation_id,channel,contact_address,contact_name,subject,status,last_message_at,created_at,updated_at) VALUES (?,?,?,?,?,?,'open',?,?,?)").run(id, org, channel, address, name || null, subject || null, now, now, now);
    return id;
  }

  /** Queues one message. Returns { id, threadId }. */
  function queue(org, { channel, address, name = null, subject = null, text, status, customerId = null, enquiryId = null, by = null, provider = 'oprun', now = iso() }) {
    if (!['sms', 'email'].includes(channel)) throw new Error('Only text and email messages can be queued.');
    if (!['pending_approval', 'approved'].includes(status)) throw new Error('A queued message is either waiting for approval or approved.');
    const threadId = threadFor(org, channel, address, name, subject, now);
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO comms_messages (id,organisation_id,thread_id,direction,kind,body,provider,status,ai_generated,created_by_user_id,occurred_at,created_at) VALUES (?,?,?,'outbound','message',?,?,?,0,?,?,?)").run(id, org, threadId, String(text).slice(0, 4000), provider, status, by, now, now);
    db.prepare("INSERT INTO comms_message_schedule (message_id,organisation_id,send_at,state,created_by,created_at,updated_at) VALUES (?,?,?,'waiting',?,?,?)").run(id, org, now, by, now, now);
    if (comms && (customerId || enquiryId)) { try { comms.link(org, threadId, { customer_id: customerId || undefined, enquiry_id: enquiryId || undefined }, by || 'system'); } catch { /* linking is best effort */ } }
    return { id, threadId };
  }

  return { threadFor, queue };
}
