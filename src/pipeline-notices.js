// T-043: bell notifications for pipeline events: a new enquiry, a job finished and ready to invoice, and an invoice
// that has gone overdue. Each is sent once per record (the dedupe key), to the owner and admins, never to the person
// who did the step themselves. Enquiries that already alert on their own (website form, AI receptionist, inbox rule)
// and quotes accepted by the customer (customer link) are not notified twice.
const SELF_NOTIFYING = new Set(['website_form', 'ai_receptionist', 'inbox_assistant']);
const ROLES = ['owner', 'admin'];
const isUser = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ''));

export function createPipelineNotices({ db, notifyRoles, followUps, clock = () => Date.now(), log = console }) {
  const send = (org, opts) => Promise.resolve(notifyRoles(org, ROLES, opts)).catch((e) => log.warn?.('[pipeline] notice not sent:', e.message));
  const docOf = (org, id) => db.prepare('SELECT d.id,d.kind,d.title,d.reference,d.channel,d.created_by,c.name customer FROM tenant_documents d LEFT JOIN tenant_customers c ON c.id=d.customer_id AND c.organisation_id=d.organisation_id WHERE d.id=? AND d.organisation_id=?').get(id, org);

  function onEvent(org, type, payload = {}, actorId = null) {
    try {
      if (type === 'enquiry.created') {
        const d = docOf(org, payload.enquiry_id); if (!d || d.kind !== 'enquiry' || SELF_NOTIFYING.has(d.created_by)) return null;
        return send(org, { kind: 'enquiry_new', title: `New enquiry: ${d.title}`.slice(0, 180), body: [d.customer, d.reference].filter(Boolean).join(' · '), link: '#work/enquiries', dedupe: `pipeline:enquiry:${d.id}`, excludeUserId: isUser(d.created_by) ? d.created_by : null });
      }
      if (type === 'job.completed') {
        const j = db.prepare('SELECT w.id,w.title,c.name customer,(SELECT 1 FROM tenant_documents i WHERE i.organisation_id=w.organisation_id AND i.work_order_id=w.id AND i.kind=\'invoice\' AND i.status<>\'cancelled\' LIMIT 1) invoiced FROM work_orders w LEFT JOIN tenant_customers c ON c.id=w.customer_id AND c.organisation_id=w.organisation_id WHERE w.id=? AND w.organisation_id=?').get(payload.work_order_id, org);
        if (!j || j.invoiced) return null;
        return send(org, { kind: 'job_ready_to_invoice', title: `Job complete, ready to invoice: ${j.title}`.slice(0, 180), body: j.customer || '', link: '#work/bookings', dedupe: `pipeline:job_done:${j.id}`, excludeUserId: isUser(actorId) ? actorId : null });
      }
    } catch (e) { log.warn?.('[pipeline] notice failed:', e.message); }
    return null;
  }

  // Overdue invoices: checked on a timer. One notice per invoice, the first time it is seen overdue.
  async function overdueSweep() {
    const orgs = db.prepare("SELECT DISTINCT organisation_id o FROM tenant_documents WHERE kind IN ('invoice','deposit') AND status IN ('issued','part_paid') AND due_at IS NOT NULL AND due_at<?").all(new Date(clock()).toISOString());
    let sent = 0;
    for (const { o } of orgs) {
      let items = []; try { items = followUps(o) || []; } catch (e) { log.warn?.('[pipeline] overdue check failed:', e.message); continue; }
      for (const i of items) {
        if (!(i.owing_cents > 0)) continue;
        await send(o, { kind: 'invoice_overdue', title: `Invoice ${i.number || ''} is overdue`.replace(/\s+/g, ' ').slice(0, 180), body: `${i.customer ? i.customer + ' · ' : ''}${i.days_overdue} day${i.days_overdue === 1 ? '' : 's'} overdue. ${i.recommendation || ''}`.trim(), link: '#money/invoices', dedupe: `pipeline:overdue:${i.document_id}` });
        sent++;
      }
    }
    return { checked: orgs.length, notices: sent };
  }

  return { onEvent, overdueSweep };
}
