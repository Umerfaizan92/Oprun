// Phase 04: Enquiries, Quotes, Bookings and Invoices as one connected pipeline in the Business OS.
// Every action calls the server and reports only what the server confirmed; errors are shown as errors.
(() => {
  const VIEWS = {
    enquiries: { kind: 'enquiry', title: 'Enquiries', lede: 'Every request for work, from any channel. Turn one into a quote when you are ready to price it.' },
    quotes: { kind: 'quote', title: 'Quotes', lede: 'Priced work waiting for your approval and the customer’s yes. An accepted quote becomes a booking and a job.' },
    bookings: { kind: 'booking', title: 'Bookings', lede: 'Booked work and its job: offer it to workers, follow allocation, and mark it complete.' },
    businessinvoices: { kind: 'invoice', title: 'Invoices', lede: 'Invoices from completed jobs. Approve, issue, and see payments land against each one.' }
  };
  const STAGE_VIEW = { enquiries: 'work/enquiries', quotes: 'work/quotes', bookings: 'work/bookings', allocated: 'work/bookings', to_invoice: 'work/bookings', unpaid: 'money/invoices', paid: 'money/invoices' };
  const STATUS = {
    open: 'New', draft: 'Draft', quoted: 'Quoted', lost: 'Closed', approved: 'Approved', accepted: 'Accepted by customer', booked: 'Booked',
    completed: 'Job complete', invoiced: 'Invoiced', issued: 'Issued, unpaid', part_paid: 'Part paid', paid: 'Paid', cancelled: 'Cancelled', declined: 'Declined by customer'
  };
  const JOB_STATUS = { awaiting_allocation: 'Needs workers', offered: 'Offered to workers', allocated: 'Workers allocated', cancelled: 'Cancelled' };
  const CHANNELS = [['phone', 'Phone call'], ['email', 'Email'], ['website', 'Website form'], ['sms', 'SMS'], ['social', 'Social media'], ['walk_in', 'In person'], ['receptionist', 'AI receptionist'], ['referral', 'Referral'], ['other', 'Other']];

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  const money = (c) => (Number(c || 0) / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
  const date = (v) => (v ? (window.OprunTime ? OprunTime.when(v) : new Date(v).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })) : '');
  const day = (v) => (v ? new Date(v).toLocaleDateString('en-AU', { dateStyle: 'medium' }) : '');
  // Hides buttons a person cannot use; the server still enforces every permission.
  const can = (feature, action = 'read') => (!window.GDS_SESSION?.access || typeof window.SuperProCan !== 'function' ? true : window.SuperProCan(feature, action));

  async function api(path, opt = {}) {
    const r = await fetch(path, { credentials: 'same-origin', ...opt, headers: { 'Content-Type': 'application/json', ...(window.SuperProWorkspaceContext?.headers?.() || {}), ...(opt.headers || {}) } });
    let d = {};
    try { d = await r.json(); } catch { /* not JSON */ }
    if (!r.ok || d.ok === false) throw new Error(d.error || `The server refused this action (${r.status}).`);
    return d;
  }
  const post = (path, body = {}) => api(path, { method: 'POST', body: JSON.stringify(body) });

  function say(section, text, bad = false) {
    const s = section.querySelector('[data-pl-status]');
    if (!s) return;
    s.textContent = text;
    s.dataset.tone = bad ? 'bad' : 'good';
    if (!bad) window.SPMotion?.toast?.(text);
  }

  // A button that runs a server action, stays disabled while it runs, and reports the real outcome.
  function act(section, label, fn, { primary = false, done } = {}) {
    const b = el('button', { type: 'button', class: 'portal-button' + (primary ? ' primary' : ''), text: label });
    b.addEventListener('click', async () => {
      b.disabled = true; b.setAttribute('aria-busy', 'true');
      try { const r = await fn(); if (r !== false) { if (done) say(section, typeof done === 'function' ? done(r) : done); await refresh(section.dataset.plView); } }
      catch (e) { say(section, e.message, true); }
      finally { b.disabled = false; b.removeAttribute('aria-busy'); }
    });
    return b;
  }

  // An inline form that opens under a card (no browser prompts).
  function inlineForm(section, card, title, fields, submitLabel, onSubmit, doneText) {
    card.querySelector('.pl-inline')?.remove();
    const f = el('form', { class: 'pl-inline portal-form' }, el('b', { text: title }));
    for (const fd of fields) {
      if (fd.type === 'checkbox') { f.append(el('label', { class: 'pl-check' }, el('input', { type: 'checkbox', name: fd.name, checked: fd.value !== false }), fd.label)); continue; }
      if (fd.type === 'select') { f.append(el('label', {}, fd.label, el('select', { name: fd.name }, fd.options.map(([v, t]) => el('option', { value: v, text: t }))))); continue; }
      f.append(el('label', {}, fd.label, el(fd.type === 'textarea' ? 'textarea' : 'input', { name: fd.name, type: fd.type === 'textarea' ? null : fd.type || 'text', required: fd.required, min: fd.min, step: fd.step, value: fd.value, placeholder: fd.placeholder, maxlength: fd.max })));
    }
    const submit = el('button', { type: 'submit', class: 'portal-button primary', text: submitLabel });
    f.append(el('div', { class: 'pl-actions' }, submit, el('button', { type: 'button', class: 'portal-button', text: 'Cancel', onclick: () => f.remove() })));
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); submit.disabled = true;
      const values = {};
      for (const fd of fields) { const i = f.elements[fd.name]; values[fd.name] = fd.type === 'checkbox' ? i.checked : i.value; }
      try { await onSubmit(values); say(section, doneText); await refresh(section.dataset.plView); }
      catch (err) { say(section, err.message, true); submit.disabled = false; }
    });
    card.append(f);
    f.querySelector('input,select,textarea')?.focus();
  }

  // T-145: a send form that always shows the exact text first. Nothing is sent until the person presses "Send now".
  function sendForm(section, card, title, fields, preview, send, doneText) {
    card.querySelector('.pl-inline')?.remove();
    const f = el('form', { class: 'pl-inline portal-form' }, el('b', { text: title }));
    for (const fd of fields) {
      if (fd.type === 'checkbox') { f.append(el('label', { class: 'pl-check' }, el('input', { type: 'checkbox', name: fd.name, checked: fd.value !== false, disabled: fd.disabled }), fd.label)); continue; }
      if (fd.type === 'note') { f.append(el('p', { class: 'portal-note', text: fd.text })); continue; }
      f.append(el('label', {}, fd.label, el(fd.type === 'textarea' ? 'textarea' : 'input', { name: fd.name, type: fd.type === 'textarea' ? null : fd.type || 'text', min: fd.min, step: fd.step, value: fd.value, placeholder: fd.placeholder, maxlength: fd.max })));
    }
    const box = el('div', { class: 'pl-preview', 'aria-live': 'polite' });
    const show = el('button', { type: 'submit', class: 'portal-button primary', text: 'Preview message' });
    const go = el('button', { type: 'button', class: 'portal-button primary', text: 'Send now', hidden: true });
    f.append(box, el('div', { class: 'pl-actions' }, show, go, el('button', { type: 'button', class: 'portal-button', text: 'Cancel', onclick: () => f.remove() })));
    const values = () => { const v = {}; for (const fd of fields) { if (!fd.name) continue; const i = f.elements[fd.name]; v[fd.name] = fd.type === 'checkbox' ? i.checked && !i.disabled : i.value; } return v; };
    f.addEventListener('input', () => { go.hidden = true; box.replaceChildren(); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); show.disabled = true;
      try {
        const d = await preview(values());
        const p = d.preview || {};
        box.replaceChildren(
          p.sms && values().sms ? el('div', {}, el('b', { text: 'Text message' }), el('pre', { class: 'pl-body', text: p.sms })) : null,
          p.email && values().email ? el('div', {}, el('b', { text: 'Email: ' + (p.subject || '') }), el('pre', { class: 'pl-body', text: p.email })) : null,
          el('p', { class: 'portal-note', text: 'The link in the real message is unique to this customer.' }));
        go.hidden = false; go.focus();
      } catch (err) { say(section, err.message, true); }
      finally { show.disabled = false; }
    });
    go.addEventListener('click', async () => {
      go.disabled = true;
      try { await send(values()); say(section, doneText); await refresh(section.dataset.plView); }
      catch (err) { say(section, err.message, true); go.disabled = false; }
    });
    card.append(f);
    f.querySelector('input,select,textarea')?.focus();
  }
  const channelsOf = (v) => [v.sms ? 'sms' : null, v.email ? 'email' : null].filter(Boolean);
  const local = (iso) => { if (!iso) return ''; const d = new Date(iso); const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
  const linkLine = (l) => {
    if (!l) return null;
    const how = String(l.channels || '').split(',').filter(Boolean).map((c) => (c === 'sms' ? 'text' : 'email')).join(' and ');
    const out = { accepted: 'customer accepted online', declined: 'customer declined online', reviewed: 'customer left a review', superseded: 'replaced by a newer link' }[l.outcome];
    const expired = !l.outcome && Date.parse(l.expires_at) < Date.now();
    return `${l.kind === 'review' ? 'Review link' : 'Quote link'} sent ${day(l.sent_at)}${how ? ' by ' + how : ''} · ${out || (expired ? 'link expired' : 'waiting for the customer')}`;
  };

  // T-165: offer a booked job to chosen workers, or to every eligible worker (the open pool). The first acceptances fill it.
  async function offerChooser(section, card, j) {
    card.querySelector('.pl-inline')?.remove();
    const d = await api(`/api/saas/work-orders/${j.id}/eligible`);
    const f = el('form', { class: 'pl-inline portal-form' }, el('b', { text: `Who should get this job? It needs ${d.required_workers} worker${d.required_workers > 1 ? 's' : ''}.` }));
    const eligible = d.workers.filter((w) => w.eligible);
    const boxes = eligible.map((w) => el('label', { class: 'pl-check' }, el('input', { type: 'checkbox', value: w.id }), ` ${w.full_name}${w.offer_status ? ` (${w.offer_status})` : ''}`));
    const blocked = d.workers.filter((w) => !w.eligible);
    f.append(eligible.length ? el('fieldset', { class: 'pl-workers' }, el('legend', { text: 'Eligible workers' }), boxes) : el('p', { class: 'portal-note', text: 'No worker is eligible yet: check availability, skills and compliance in People > Workers.' }),
      blocked.length ? el('p', { class: 'pl-meta', text: 'Not eligible: ' + blocked.map((w) => `${w.full_name} (${w.missing_skills?.length ? 'skills' : w.blocking_compliance ? 'compliance' : 'availability'})`).join(', ') }) : null);
    const chosen = el('button', { type: 'button', class: 'portal-button primary', text: 'Offer to the workers I chose', disabled: !eligible.length || null });
    const pool = el('button', { type: 'button', class: 'portal-button', text: 'Offer to everyone eligible', disabled: !eligible.length || null });
    const go = async (btn, body) => { btn.disabled = true; try { const r = await post(`/api/saas/work-orders/${j.id}/offer`, body); say(section, `Offered to ${r.offered} worker${r.offered === 1 ? '' : 's'}. The job is confirmed when enough accept, and you will be told.`); await refresh(section.dataset.plView); } catch (e) { say(section, e.message, true); btn.disabled = false; } };
    chosen.addEventListener('click', () => { const ids = boxes.map((b) => b.querySelector('input')).filter((i) => i.checked).map((i) => i.value); if (!ids.length) return say(section, 'Tick at least one worker, or offer it to everyone eligible.', true); go(chosen, { worker_ids: ids }); });
    pool.addEventListener('click', () => go(pool, {}));
    f.append(el('div', { class: 'pl-actions' }, chosen, pool, el('button', { type: 'button', class: 'portal-button', text: 'Cancel', onclick: () => f.remove() })));
    card.append(f);
  }

  // T-164: how appointment reminders and booking confirmations reach customers, workers and the owner.
  function remindersPanel(section) {
    const box = el('details', { class: 'portal-panel pl-reminders' }, el('summary', { text: 'Reminders and confirmations' }));
    box.addEventListener('toggle', async () => {
      if (!box.open || box.dataset.loaded) return; box.dataset.loaded = '1';
      try {
        const { settings: st, sms_ready } = await api('/api/saas/reminders/settings');
        const mode = el('select', { name: 'customer_mode' }, [['approve', 'Wait in Approvals (you check each one)'], ['auto', 'Send automatically (fixed wording)'], ['off', 'Do not message customers']].map(([v, t]) => el('option', { value: v, text: t, selected: st.customer_mode === v || null })));
        const tick = (name, label) => el('label', { class: 'pl-check' }, el('input', { type: 'checkbox', name, checked: Boolean(st[name]) || null }), ' ' + label);
        const f = el('form', { class: 'portal-form' },
          el('p', { class: 'portal-note', text: sms_ready ? 'Customers get a text and an email when they have both.' : 'Customers get emails. Connect your business SMS sender in Connections to text them too.' }),
          el('label', {}, 'Messages to customers', mode),
          tick('confirmations', 'Confirm the booking when workers have accepted'), tick('day_before', 'Remind the customer the day before (8 am to 8 pm)'), tick('day_of', 'Remind the customer on the morning of the job'),
          tick('workers', 'Alert assigned workers on the day (app and text)'), tick('owner_summary', "Send owners and admins a morning summary of today's jobs"));
        const save = el('button', { type: 'submit', class: 'portal-button primary', text: 'Save' });
        f.append(el('div', { class: 'pl-actions' }, save));
        f.addEventListener('submit', async (e) => { e.preventDefault(); save.disabled = true; try { const v = (n) => f.elements[n].checked; await api('/api/saas/reminders/settings', { method: 'PUT', body: JSON.stringify({ customer_mode: mode.value, confirmations: v('confirmations'), day_before: v('day_before'), day_of: v('day_of'), workers: v('workers'), owner_summary: v('owner_summary') }) }); say(section, 'Reminder settings saved.'); } catch (err) { say(section, err.message, true); } finally { save.disabled = false; } });
        box.append(f);
      } catch (err) { box.append(el('p', { class: 'portal-note', text: err.message })); }
    });
    return box;
  }

  // ---------- pipeline strip (shared by all four views) ----------
  async function strip() {
    const host = el('nav', { class: 'pl-strip', 'aria-label': 'Work pipeline' });
    try {
      const { stages } = await api('/api/saas/pipeline/overview');
      for (const st of stages) {
        host.append(el('a', { class: 'pl-stage' + (st.count ? ' has' : ''), href: '#' + STAGE_VIEW[st.key], 'data-stage': st.key },
          el('b', { text: String(st.count) }), el('span', { text: st.label }), st.total_cents ? el('small', { text: money(st.total_cents) }) : null));
      }
    } catch (e) { host.append(el('p', { class: 'portal-note', text: 'Pipeline summary unavailable: ' + e.message })); }
    return host;
  }

  // T-042: photos, plans and signed acceptance on a record. The server checks the business, the person's permission
  // and the real file content; this only lists, adds and removes.
  function docFiles(id, el) {
    const box = el('section', { class: 'pl-files', 'data-doc-files': id, 'aria-label': 'Files on this record' });
    const hdrs = () => ({ ...(window.SuperProWorkspaceContext?.headers?.() || {}) });
    const call = async (path, opt = {}) => { const r = await fetch(path, { credentials: 'same-origin', ...opt, headers: { ...hdrs(), ...(opt.headers || {}) } }); let d = {}; try { d = await r.json(); } catch { /* not JSON */ } if (!r.ok || d.ok === false) throw new Error(d.error || `The server refused this action (${r.status}).`); return d; };
    const status = el('p', { class: 'pl-meta', 'aria-live': 'polite' });
    const listEl = el('ul', { class: 'pl-file-list' });
    const size = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
    let labels = {};
    const draw = (items) => {
      listEl.replaceChildren(...items.map((a) => el('li', {}, el('a', { href: `/api/saas/document-attachments/${encodeURIComponent(a.id)}/file`, target: '_blank', rel: 'noopener', text: a.original_name }), ` · ${labels[a.label] || a.label} · ${size(a.size_bytes)} `,
        el('button', { type: 'button', class: 'portal-button', text: 'Remove', 'aria-label': `Remove ${a.original_name}`, onclick: async (e) => { e.target.disabled = true; try { draw((await call(`/api/saas/document-attachments/${encodeURIComponent(a.id)}`, { method: 'DELETE' })).attachments); status.textContent = 'Removed.'; } catch (err) { status.textContent = err.message; e.target.disabled = false; } } }))));
      if (!items.length) listEl.append(el('li', { class: 'pl-meta', text: 'No files yet.' }));
    };
    const kind = el('select', { 'aria-label': 'What the file is' });
    const input = el('input', { type: 'file', multiple: true, accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf', 'aria-label': 'Choose photos or PDFs' });
    input.addEventListener('change', async () => {
      if (!input.files.length) return; const fd = new FormData(); fd.append('label', kind.value); [...input.files].slice(0, 10).forEach((f) => fd.append('files', f));
      status.textContent = 'Uploading…';
      try { draw((await call(`/api/saas/documents/${encodeURIComponent(id)}/attachments`, { method: 'POST', body: fd })).attachments); status.textContent = 'Added.'; } catch (err) { status.textContent = err.message; } finally { input.value = ''; }
    });
    box.append(el('h3', { text: 'Files' }), listEl, el('div', { class: 'pl-actions' }, kind, input), status);
    call(`/api/saas/documents/${encodeURIComponent(id)}/attachments`).then((d) => { labels = d.labels || {}; kind.replaceChildren(...Object.entries(labels).map(([v, t]) => el('option', { value: v, text: t }))); draw(d.attachments || []); })
      .catch((err) => { if (/not found/i.test(err.message)) box.remove(); else box.replaceChildren(el('h3', { text: 'Files' }), el('p', { class: 'pl-meta', text: err.message })); });
    return box;
  }
  // ---------- trail ----------
  async function showTrail(section, id) {
    const box = section.querySelector('.pl-trail') || section.appendChild(el('aside', { class: 'pl-trail portal-panel', 'aria-live': 'polite' }));
    box.replaceChildren(el('p', { class: 'portal-note', text: 'Loading the full history…' }));
    try {
      const t = await api('/api/saas/pipeline/trail/' + encodeURIComponent(id));
      box.replaceChildren(el('div', { class: 'pl-trail-head' }, el('h2', { text: 'History of this work' }), el('button', { type: 'button', class: 'portal-button', text: 'Close', onclick: () => box.remove() })));
      const ol = el('ol', { class: 'pl-chain' });
      for (const c of t.chain) {
        ol.append(el('li', {}, el('b', { text: { enquiry: 'Enquiry', quote: 'Quote', booking: 'Booking', invoice: 'Invoice' }[c.kind] }), ` ${c.reference && !String(c.title).includes(c.reference) ? c.reference + ' · ' : ''}${c.title} · ${STATUS[c.status] || c.status}`,
          c.total_cents ? el('span', { class: 'pl-amt', text: ' · ' + money(c.total_cents) }) : null,
          c.job ? el('small', { text: ` Job: ${JOB_STATUS[c.job.status] || c.job.status}${c.job.completed_at ? ', completed ' + day(c.job.completed_at) : ''}` }) : null));
      }
      for (const p of t.payments) ol.append(el('li', {}, el('b', { text: 'Payment' }), ` ${money(p.amount_cents)} · ${p.status === 'paid' ? 'received ' + day(p.paid_at) : p.status}${p.receipt_no ? ' · receipt ' + p.receipt_no : ''}`));
      box.append(ol, docFiles(id, el));
      if (t.events.length) box.append(el('details', {}, el('summary', { text: `Activity log (${t.events.length})` }), el('ul', { class: 'pl-events' }, t.events.map((e) => el('li', { text: `${date(e.created_at)} · ${e.action.replace(/[._]/g, ' ')}${e.user_name ? ' · ' + e.user_name : ''}` })))));
      box.scrollIntoView({ block: 'nearest', behavior: window.SPMotion?.allowed?.() ? 'smooth' : 'auto' });
    } catch (e) { box.replaceChildren(el('p', { class: 'portal-note', 'data-tone': 'bad', text: e.message })); }
  }

  // ---------- cards ----------
  function card(section, r) {
    const c = el('article', { class: 'portal-card pl-card', 'data-id': r.id, 'data-status': r.status });
    const who = r.customer ? [r.customer.name, r.customer.phone, r.customer.email].filter(Boolean).join(' · ') : 'No customer linked';
    c.append(
      el('div', { class: 'pl-card-head' }, el('h2', { text: r.reference && !String(r.title).includes(r.reference) ? `${r.reference} · ${r.title}` : r.title }), el('span', { class: 'portal-status pl-' + r.status, text: STATUS[r.status] || r.status })),
      el('p', { class: 'pl-who', text: who }),
      r.body ? el('p', { class: 'pl-body', text: r.body }) : null
    );
    if (r.kind !== 'enquiry' && (r.amount_cents || r.total_cents)) {
      c.append(el('dl', { class: 'pl-money' },
        el('dt', { text: 'Price' }), el('dd', { text: money(r.amount_cents) }),
        el('dt', { text: r.gst_applies ? 'GST 10%' : 'GST' }), el('dd', { text: r.gst_applies ? money(r.gst_cents) : 'GST-free' }),
        el('dt', { text: 'Total' }), el('dd', { text: money(r.total_cents) })));
    }
    const meta = [];
    if (r.channel) meta.push('From ' + (CHANNELS.find(([v]) => v === r.channel)?.[1] || r.channel).toLowerCase());
    if (r.start_at) meta.push('Booked for ' + date(r.start_at));
    if (r.job && r.kind === 'booking') meta.push(r.job.completed_at ? 'Job complete ' + day(r.job.completed_at) : JOB_STATUS[r.job.status] || r.job.status, !r.job.completed_at && r.job.offers?.accepted ? `${r.job.offers.accepted} worker${r.job.offers.accepted > 1 ? 's' : ''} accepted` : null, r.job.address);
    if (r.due_at) meta.push('Due ' + day(r.due_at));
    if (r.links && ['quote', 'booking'].includes(r.kind)) meta.push(linkLine(r.links));
    if (r.review) meta.push(`Customer rated ${'★'.repeat(r.review.rating)}${'☆'.repeat(5 - r.review.rating)}${r.review.comment ? ': “' + String(r.review.comment).slice(0, 120) + '”' : ''}`);
    if (r.kind === 'quote' && r.start_at && ['approved', 'accepted'].includes(r.status)) meta.push('Proposed time ' + date(r.start_at));
    if (r.kind === 'invoice' && r.job && ['issued', 'part_paid', 'paid'].includes(r.status)) meta.push(`Paid ${money(r.job.paid_cents)}, owing ${money(r.job.owing_cents)}`);
    if (r.kind === 'invoice' && !r.work_order_id) meta.push('Not linked to a job: payments cannot be tracked. Create invoices from a completed job in Bookings.');
    meta.push('Created ' + day(r.created_at));
    c.append(el('p', { class: 'pl-meta', text: meta.filter(Boolean).join(' · ') }));
    const actions = el('div', { class: 'pl-actions' });
    actionsFor(section, c, r, actions);
    if (r.kind !== 'enquiry' || r.status !== 'open') actions.append(act(section, 'History', async () => { await showTrail(section, r.id); return false; }));
    c.append(actions);
    return c;
  }

  function actionsFor(section, c, r, a) {
    const S = section;
    if (r.kind === 'enquiry') {
      if (r.status === 'quoted') a.append(el('a', { class: 'portal-button primary', href: '#work/quotes', text: 'See the quote' }));
      if (['open', 'draft'].includes(r.status) && can('customers', 'create')) a.append(act(S, 'Create quote', async () => {
        inlineForm(S, c, 'Quote for ' + (r.customer?.name || 'this customer'), [
          { name: 'amount', label: 'Price excluding GST (AUD)', type: 'number', min: '0.01', step: '0.01', required: true },
          { name: 'gst_applies', label: 'Add GST (10%)', type: 'checkbox', value: true },
          { name: 'details', label: 'What the quote covers', type: 'textarea', value: r.body, max: 20000 }
        ], 'Save quote draft', (v) => post(`/api/saas/pipeline/enquiries/${r.id}/quote`, { amount: Number(v.amount), gst_applies: v.gst_applies, details: v.details }), 'Quote draft saved. Approve it in Quotes.');
        return false;
      }, { primary: true }));
      if (['open', 'draft', 'quoted'].includes(r.status) && can('customers', 'edit')) a.append(act(S, 'Close as lost', () => post(`/api/saas/pipeline/enquiries/${r.id}/close`), { done: 'Enquiry closed.' }));
      if (r.status === 'open') a.append(act(S, 'History', async () => { await showTrail(S, r.id); return false; }));
    }
    if (r.kind === 'quote') {
      if (r.status === 'draft' && can('approvals', 'approve')) a.append(act(S, 'Approve quote', () => post(`/api/saas/business-hub/quote/${r.id}/approve`, { revision: r.revision }), { primary: true, done: 'Quote approved. Press Send to customer to text or email it with an accept link.' }));
      if (r.status === 'approved' && can('approvals', 'approve')) a.append(act(S, r.links && !r.links.outcome ? 'Send again' : 'Send to customer', async () => {
        const cu = r.customer || {};
        sendForm(S, c, 'Send the quote to ' + (cu.name || 'the customer'), [
          { name: 'start_at', label: 'Proposed date and time (optional: if set, accepting books the job)', type: 'datetime-local', value: local(r.start_at) },
          { name: 'estimated_hours', label: 'Time required (hours, optional)', type: 'number', min: '0.25', step: '0.25', value: r.estimated_hours ?? '' },
          { name: 'note', label: 'Short note at the start (optional)', max: 300, placeholder: 'For example: Thanks for your call today.' },
          { name: 'sms', label: cu.phone ? 'Text message to ' + cu.phone : 'Text message (no mobile number on this customer)', type: 'checkbox', value: Boolean(cu.phone), disabled: !cu.phone },
          { name: 'email', label: cu.email ? 'Email to ' + cu.email : 'Email (no email address on this customer)', type: 'checkbox', value: Boolean(cu.email), disabled: !cu.email },
          { type: 'note', text: 'The customer gets a private link to view, accept or decline. Sending a new link replaces the old one.' }
        ], (v) => post(`/api/saas/pipeline/quotes/${r.id}/send`, sendBody(v, true)), (v) => post(`/api/saas/pipeline/quotes/${r.id}/send`, sendBody(v, false)), 'Quote sent. You will be told when the customer answers.');
        function sendBody(v, dry) {
          const b = { revision: r.revision, channels: channelsOf(v), dry_run: dry };
          b.start_at = v.start_at ? new Date(v.start_at).toISOString() : null;
          b.estimated_hours = v.estimated_hours ? Number(v.estimated_hours) : null;
          if (v.note && v.note.trim()) b.note = v.note.trim();
          return b;
        }
        return false;
      }, { primary: true }));
      if (r.status === 'approved') a.append(act(S, 'Record customer acceptance', async () => {
        inlineForm(S, c, 'How did the customer accept?', [{ name: 'evidence', label: 'Date, channel and reference (for example: accepted by phone 30 Oct, spoke to Sam)', required: true, max: 3000 }],
          'Record acceptance', (v) => { if (v.evidence.trim().length < 12) throw new Error('Add at least a date and how they accepted (12 characters or more).'); return post(`/api/saas/business-hub/quote/${r.id}/accept`, { revision: r.revision, evidence: v.evidence.trim() }); }, 'Acceptance recorded. You can book the job now.');
        return false;
      }));
      if (r.status === 'accepted' && can('jobs', 'create')) a.append(act(S, 'Book the job', async () => {
        inlineForm(S, c, 'Book the job', [
          { name: 'start_at', label: 'Date and time', type: 'datetime-local', required: true },
          { name: 'address', label: 'Job address', value: r.customer?.address || '', max: 300 },
          { name: 'estimated_hours', label: 'Estimated hours', type: 'number', min: '0.25', step: '0.25' },
          { name: 'required_workers', label: 'Workers needed', type: 'number', min: '1', step: '1', value: '1' }
        ], 'Create booking and job', (v) => {
          if (!v.start_at) throw new Error('Choose the date and time.');
          const body = { start_at: new Date(v.start_at).toISOString(), revision: r.revision };
          if (v.address) body.address = v.address;
          if (v.estimated_hours) body.estimated_hours = Number(v.estimated_hours);
          if (v.required_workers) body.required_workers = Number(v.required_workers);
          return post(`/api/saas/pipeline/quotes/${r.id}/book`, body);
        }, 'Booked. The job is in Bookings and Jobs, ready to offer to workers.');
        return false;
      }, { primary: true }));
    }
    if (r.kind === 'booking' && r.job) {
      const j = r.job;
      if (!j.completed_at && j.status !== 'allocated' && can('jobs', 'approve')) a.append(act(S, j.status === 'offered' ? 'Offer again' : 'Offer to workers', async () => { await offerChooser(S, c, j); return false; }, { primary: true }));
      if (!j.completed_at && can('jobs', 'edit')) a.append(act(S, 'Mark job complete', () => post(`/api/saas/pipeline/jobs/${j.id}/complete`), { done: 'Job marked complete. You can invoice it now.' }));
      if (j.completed_at && !r.review && can('customers', 'edit')) a.append(act(S, r.links?.kind === 'review' && !r.links.outcome ? 'Ask for a review again' : 'Ask for a review', async () => {
        const cu = r.customer || {};
        let settings = { review_url: '' };
        try { settings = await api('/api/saas/customer-links/settings'); } catch { /* the request still works without the public review link */ }
        sendForm(S, c, 'Ask ' + (cu.name || 'the customer') + ' how it went', [
          { name: 'note', label: 'Short note (optional)', max: 300, placeholder: 'For example: It was great working on your ute.' },
          { name: 'review_url', label: 'Your public review link, shown after they answer (optional, for example your Google review link)', type: 'url', max: 500, value: settings.review_url || '' },
          { name: 'sms', label: cu.phone ? 'Text message to ' + cu.phone : 'Text message (no mobile number on this customer)', type: 'checkbox', value: Boolean(cu.phone), disabled: !cu.phone },
          { name: 'email', label: cu.email ? 'Email to ' + cu.email : 'Email (no email address on this customer)', type: 'checkbox', value: Boolean(cu.email), disabled: !cu.email },
          { type: 'note', text: 'Every customer sees your public review link after giving feedback, whatever their rating.' }
        ], (v) => post(`/api/saas/pipeline/jobs/${j.id}/review-request`, { channels: channelsOf(v), dry_run: true, ...(v.note.trim() ? { note: v.note.trim() } : {}) }), async (v) => {
          if ((v.review_url || '').trim() !== (settings.review_url || '')) await api('/api/saas/customer-links/settings', { method: 'PUT', body: JSON.stringify({ review_url: v.review_url.trim() }) });
          return post(`/api/saas/pipeline/jobs/${j.id}/review-request`, { channels: channelsOf(v), ...(v.note.trim() ? { note: v.note.trim() } : {}) });
        }, 'Review request sent.');
        return false;
      }));
      if (j.completed_at && r.status === 'completed' && can('finance', 'create')) a.append(act(S, 'Create invoice', () => post(`/api/saas/pipeline/jobs/${j.id}/invoice`), { primary: true, done: 'Invoice draft created. Approve and issue it in Invoices.' }));
      a.append(el('a', { class: 'portal-button', href: '#work/jobs', text: 'Open in Jobs' }));
    }
    if (r.kind === 'invoice') {
      if (r.status === 'draft' && can('approvals', 'approve')) a.append(act(S, 'Approve invoice', () => post(`/api/saas/business-hub/invoice/${r.id}/approve`, { revision: r.revision }), { primary: true, done: 'Invoice approved. Issue it to start the payment terms.' }));
      if (r.status === 'approved' && r.work_order_id && can('finance', 'edit')) a.append(act(S, 'Issue invoice', () => post(`/api/saas/pipeline/invoices/${r.id}/issue`), { primary: true, done: (d) => `Invoice issued. Due ${day(d.due_at)}.` }));
      if (['issued', 'part_paid'].includes(r.status) && r.job && can('finance', 'approve')) {
        a.append(act(S, 'Record a payment', async () => {
          inlineForm(S, c, 'Record a payment received', [
            { name: 'amount', label: `Amount (owing ${money(r.job.owing_cents)})`, type: 'number', min: '0.01', step: '0.01', value: (r.job.owing_cents / 100).toFixed(2), required: true },
            { name: 'method', label: 'How it was paid', type: 'select', options: [['bank_transfer', 'Bank transfer'], ['eftpos', 'EFTPOS'], ['card_terminal', 'Card terminal'], ['cash', 'Cash'], ['other', 'Other']] }
          ], 'Record payment', (v) => post('/api/saas/payments/record', { work_order_id: r.work_order_id, amount: Number(v.amount), method: v.method }), 'Payment recorded against the job.');
          return false;
        }, { primary: true }));
        if (can('finance', 'approve')) a.append(act(S, 'Send invoice & payment link', async () => {
          const cu = r.customer || {};
          inlineForm(S, c, `Send the invoice for ${money(r.job.owing_cents)} to ${cu.name || 'the customer'} (${[cu.email, cu.phone].filter(Boolean).join(' and ') || 'no email or mobile saved'}). Texts go from your business SMS sender.`, [
            { name: 'provider', label: 'How they pay', type: 'select', options: [['stripe', 'Card (Stripe link)'], ['paypal', 'PayPal link'], ['bank', 'Bank transfer details']] }
          ], 'Send now', (v) => { if (!cu.email && !cu.phone) throw new Error('Add an email or mobile number to this customer first.'); return post('/api/saas/payments/requests', { work_order_id: r.work_order_id, provider: v.provider, send_to_customer: true }).then((d) => { const bad = (d.sent || []).filter((x) => !['sent', 'already_sent'].includes(x.status)); if (bad.length) throw new Error('Created, but not delivered by ' + bad.map((x) => `${x.channel} (${x.reason || x.status})`).join(', ') + '. The payment request is saved in Money.'); return d; }); }, 'Invoice and payment link sent.');
          return false;
        }, { primary: true }));
        a.append(el('a', { class: 'portal-button', href: '#money/ledger', text: 'Payments in Money' }));
      }
    }
  }

  // ---------- new enquiry form ----------
  async function enquiryForm(section) {
    const f = el('form', { class: 'portal-panel portal-form pl-new' }, el('h2', { text: 'New enquiry' }));
    let customers = [];
    try { customers = (await api('/api/saas/customers')).customers || []; } catch { /* the form still works with a new customer */ }
    const pick = el('select', { name: 'customer_id' }, el('option', { value: '', text: 'New customer' }), customers.slice(0, 500).map((cu) => el('option', { value: cu.id, text: [cu.name, cu.phone].filter(Boolean).join(' · ') })));
    const newCust = el('fieldset', { class: 'pl-newcust' }, el('legend', { text: 'Customer details' }),
      el('label', {}, 'Name', el('input', { name: 'name', maxlength: 160, autocomplete: 'off' })),
      el('label', {}, 'Phone', el('input', { name: 'phone', type: 'tel', maxlength: 40 })),
      el('label', {}, 'Email', el('input', { name: 'email', type: 'email', maxlength: 254 })),
      el('label', {}, 'Address', el('input', { name: 'address', maxlength: 300 })));
    pick.addEventListener('change', () => { newCust.hidden = !!pick.value; });
    const trackedLinks = (await window.SuperProLeadSources?.load?.()) || [];
    f.append(
      el('label', {}, 'What do they need?', el('input', { name: 'title', required: true, minlength: 2, maxlength: 240, placeholder: 'For example: leaking hot water system' })),
      el('label', {}, 'Details', el('textarea', { name: 'details', maxlength: 20000, rows: 2 })),
      el('label', {}, 'Came in by', el('select', { name: 'channel' }, CHANNELS.map(([v, t]) => el('option', { value: v, text: t })))),
      // T-071: optional tracked source, when the customer says which post, flyer or sign they saw.
      ...(trackedLinks.length ? [el('label', {}, 'Tracked link or QR code (optional)', el('select', { name: 'source_code' }, el('option', { value: '', text: 'Not from a tracked link' }), trackedLinks.map((o) => el('option', { value: o.code, text: o.label }))))] : []),
      el('label', {}, 'Customer', pick), newCust);
    const submit = el('button', { type: 'submit', class: 'portal-button primary', text: 'Save enquiry' });
    f.append(submit);
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); submit.disabled = true;
      const v = Object.fromEntries(new FormData(f));
      const body = { title: v.title, details: v.details || '', channel: v.channel, ...(v.source_code ? { source_code: v.source_code } : {}) };
      if (v.customer_id) body.customer_id = v.customer_id;
      else {
        if (!String(v.name || '').trim()) { say(section, 'Add the customer’s name, or choose an existing customer.', true); submit.disabled = false; return; }
        body.customer = { name: v.name.trim(), ...(v.phone ? { phone: v.phone } : {}), ...(v.email ? { email: v.email } : {}), ...(v.address ? { address: v.address } : {}) };
      }
      try { await post('/api/saas/pipeline/enquiries', body); say(section, 'Enquiry saved.'); await refresh('enquiries'); }
      catch (err) { say(section, err.message, true); submit.disabled = false; }
    });
    return el('details', { class: 'pl-newwrap', open: true }, el('summary', { text: 'Add an enquiry' }), f);
  }

  // ---------- views ----------
  function ensureView(id) {
    let s = document.getElementById(id + '-view');
    if (!s) {
      s = el('section', { class: 'view', id: id + '-view', hidden: true });
      ($('.content-wrap') || document.body).append(s);
    }
    if (!s.dataset.plView) {
      const v = VIEWS[id];
      s.replaceChildren(el('div', { class: 'page-heading' }, el('div', {}, el('h1', { text: v.title }), el('p', { text: v.lede }))),
        el('p', { class: 'portal-note pl-status', role: 'status', 'aria-live': 'polite', 'data-pl-status': '' }));
      s.dataset.plView = id;
    }
    return s;
  }

  const filters = {};
  async function refresh(id) {
    const v = VIEWS[id]; if (!v) return;
    const s = ensureView(id), org = window.GDS_SESSION?.organisation?.id;
    const body = el('div', { class: 'pl-body-wrap', 'data-body': '1' });
    const prev = s.querySelector('[data-body]');
    if (prev) prev.replaceWith(body); else s.append(body);
    body.append(el('p', { class: 'portal-note', text: 'Loading…' }));
    try {
      const [{ records }, stripEl] = await Promise.all([api('/api/saas/pipeline/' + v.kind), strip()]);
      if (window.GDS_SESSION?.organisation?.id !== org) return;
      body.replaceChildren(stripEl);
      if (id === 'enquiries' && can('customers', 'create')) { const w = await enquiryForm(s); w.open = !records.length; body.append(w); }
      if (id === 'enquiries') window.SuperProLeadSources?.mount(body);
      if (id === 'bookings' && ['owner', 'admin', 'super_admin', 'manager', 'director'].includes(window.GDS_SESSION?.user?.role || window.GDS_SESSION?.membership?.role || '')) { window.OprunAppointments?.mount(body); body.append(remindersPanel(s)); }
      const q = el('input', { type: 'search', class: 'portal-search', placeholder: `Search ${v.title.toLowerCase()} by title or customer`, 'aria-label': `Search ${v.title.toLowerCase()}`, value: filters[id]?.q || '' });
      const statuses = [...new Set(records.map((r) => r.status))];
      const st = el('select', { class: 'portal-search pl-filter', 'aria-label': 'Filter by status' }, el('option', { value: '', text: 'All statuses' }), statuses.map((x) => el('option', { value: x, text: STATUS[x] || x, selected: filters[id]?.status === x })));
      const grid = el('div', { class: 'portal-grid pl-grid' });
      const draw = () => {
        filters[id] = { q: q.value, status: st.value };
        const term = q.value.trim().toLowerCase();
        const shown = records.filter((r) => (!st.value || r.status === st.value) && (!term || [r.title, r.reference, r.customer?.name, r.customer?.phone, r.customer?.email].some((x) => String(x || '').toLowerCase().includes(term))));
        grid.replaceChildren(...shown.map((r) => card(s, r)));
        if (!shown.length) grid.append(el('p', { class: 'portal-empty', text: records.length ? 'Nothing matches that search.' : { enquiries: 'No enquiries yet. Add the first one above.', quotes: 'No quotes yet. Create one from an enquiry.', bookings: 'No bookings yet. Book an accepted quote.', businessinvoices: 'No invoices yet. Create one from a completed job in Bookings.' }[id] }));
      };
      q.addEventListener('input', draw); st.addEventListener('change', draw);
      body.append(el('div', { class: 'portal-toolbar pl-toolbar' }, q, st), grid);
      draw();
    } catch (e) {
      body.replaceChildren(el('p', { class: 'portal-note', 'data-tone': 'bad', text: e.message }));
    }
  }

  for (const id of Object.keys(VIEWS)) ensureView(id);
  window.addEventListener('gds:viewchange', (e) => { if (VIEWS[e.detail?.view]) refresh(e.detail.view); });
  // Opens a pipeline view already filtered to one record (used by workspace search).
  const prefill = (id, text) => { if (!VIEWS[id]) return; filters[id] = { q: text, status: '' }; };
  window.SuperProPipeline = { refresh, prefill };
})();
