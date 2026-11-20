// T-184: Work > Bookings > Appointments & calendar.
// One calendar for bookings, appointments, Oprun video meetings and Zoom meetings, a week at a time. New appointments
// get suggested free times, a clash check, an automatic video link for video calls, an optional customer reminder
// (shown word for word before it is approved) and a team alert before they start.
(() => {
  if (window.OprunAppointments) return;
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v === null || v === undefined || v === false) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  async function api(path, opt = {}) {
    const r = await fetch(path, { credentials: 'same-origin', ...opt, headers: { 'Content-Type': 'application/json', ...(window.SuperProWorkspaceContext?.headers?.() || {}), ...(opt.headers || {}) } });
    let d = {}; try { d = await r.json(); } catch { /* not JSON */ }
    if (!r.ok || d.ok === false) throw Object.assign(new Error(d.error || `The server refused this action (${r.status}).`), { status: r.status, data: d });
    return d;
  }
  const TYPE = { appointment: 'Appointment', booking: 'Booking', meeting: 'Video meeting', zoom: 'Zoom' };
  const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Everything is shown and entered in the business's time zone (returned by the calendar), wherever the person is.
  let TZ;
  const time = (v) => new Date(v).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  const ymdTz = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const hhmmTz = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  function zonedToUtc(date, hh, mm) {
    const guess = new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(guess).map((x) => [x.type, x.value]));
    return new Date(guess.getTime() - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - guess.getTime()));
  }

  function mount(host) {
    let week = startOfWeek(new Date()), customers = null;
    const status = el('p', { class: 'portal-note ap-status', role: 'status', 'aria-live': 'polite' });
    const say = (t, bad = false) => { status.textContent = t; status.dataset.tone = bad ? 'bad' : 'ok'; };
    const label = el('b', { class: 'ap-range' });
    const days = el('div', { class: 'ap-days' });
    const formBox = el('div', { class: 'ap-form-box', hidden: true });
    const newBtn = el('button', { type: 'button', class: 'portal-button primary', text: 'New appointment', 'aria-expanded': 'false', onclick: () => toggleForm() });
    const panel = el('section', { class: 'portal-panel ap-panel', 'aria-labelledby': 'ap-title' },
      el('div', { class: 'ap-head' }, el('div', {}, el('h2', { id: 'ap-title', text: 'Appointments & calendar' }), el('p', { class: 'ap-lede', text: 'Customer meetings, calls and site visits next to your booked work. Reminders go out on time and your team is alerted before each one.' })), newBtn),
      formBox, status,
      el('div', { class: 'ap-nav' },
        el('button', { type: 'button', class: 'portal-button', 'aria-label': 'Previous week', text: '‹', onclick: () => { week.setDate(week.getDate() - 7); load(); } }),
        label,
        el('button', { type: 'button', class: 'portal-button', 'aria-label': 'Next week', text: '›', onclick: () => { week.setDate(week.getDate() + 7); load(); } }),
        el('button', { type: 'button', class: 'portal-button', text: 'This week', onclick: () => { week = startOfWeek(new Date()); load(); } }),
        el('span', { class: 'ap-legend', 'aria-hidden': 'true' }, Object.entries(TYPE).map(([k, v]) => el('span', { class: 'ap-dot', 'data-type': k, text: v })))),
      days);
    host.append(panel);

    async function load() {
      const end = new Date(week); end.setDate(end.getDate() + 7);
      const last = new Date(end); last.setDate(last.getDate() - 1);
      label.textContent = `${week.toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`;
      let d; try { d = await api(`/api/saas/calendar?from=${week.toISOString()}&to=${end.toISOString()}`); } catch (e) { days.replaceChildren(el('p', { class: 'portal-note', 'data-tone': 'bad', text: e.message })); return; }
      TZ = d.timezone || undefined;
      const today = ymdTz(new Date());
      days.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
        const day = new Date(week); day.setDate(day.getDate() + i); day.setHours(12); const key = ymd(day);
        const list = d.events.filter((e) => ymdTz(new Date(e.start)) === key);
        return el('div', { class: 'ap-day' + (key === today ? ' ap-today' : '') + (list.length ? '' : ' ap-empty') },
          el('div', { class: 'ap-date' }, el('span', { text: day.toLocaleDateString([], { weekday: 'short' }) }), el('b', { text: String(day.getDate()) })),
          el('div', { class: 'ap-events' }, list.length ? list.map(eventCard) : el('span', { class: 'ap-free', text: 'Free' })));
      }));
    }
    function eventCard(e) {
      const acts = [];
      if (e.link) acts.push(el('a', { class: 'ap-act', href: e.link, target: '_blank', rel: 'noopener noreferrer', text: e.type === 'zoom' ? 'Open Zoom' : 'Join' }));
      if (e.type === 'appointment') {
        acts.push(el('button', { type: 'button', class: 'ap-act', text: 'Done', 'aria-label': `Mark ${e.title} done`, onclick: () => patch(e, { status: 'done' }, 'Marked as done.') }));
        acts.push(el('button', { type: 'button', class: 'ap-act', text: 'Cancel', 'aria-label': `Cancel ${e.title}`, onclick: () => { if (confirm(`Cancel "${e.title}"?${e.link ? ' The video link stops working.' : ''}`)) patch(e, { status: 'cancelled' }, 'Appointment cancelled.'); } }));
      }
      if (e.type === 'booking') acts.push(el('a', { class: 'ap-act', href: '#work/bookings', text: 'Open' }));
      const meta = [e.kind_label, e.who, e.location].filter(Boolean).join(' · ');
      return el('article', { class: 'ap-event', 'data-type': e.type, 'data-status': e.status },
        el('div', { class: 'ap-when' }, el('b', { text: time(e.start) }), el('small', { text: time(e.end) })),
        el('div', { class: 'ap-what' }, el('span', { class: 'ap-tag', text: TYPE[e.type] }), el('b', { text: e.title }), meta ? el('small', { text: meta }) : null,
          e.type === 'appointment' && e.reminder !== 'off' ? el('small', { class: 'ap-rem', 'data-state': e.reminder, text: e.reminder === 'sent' ? 'Reminder sent' : e.reminder === 'failed' ? `Reminder not sent: ${e.reminder_error || ''}` : 'Reminder scheduled' }) : null,
          e.status === 'done' ? el('small', { class: 'ap-rem', 'data-state': 'sent', text: 'Done' }) : null),
        acts.length ? el('div', { class: 'ap-acts' }, acts) : null);
    }
    async function patch(e, body, msg) { try { await api(`/api/saas/appointments/${e.id}`, { method: 'PATCH', body: JSON.stringify(body) }); say(msg); load(); } catch (err) { say(err.message, true); } }

    async function toggleForm() {
      const open = formBox.hidden; formBox.hidden = !open; newBtn.setAttribute('aria-expanded', String(open));
      if (!open) return;
      if (!customers) { try { customers = (await api('/api/saas/customers')).customers || []; } catch { customers = []; } }
      formBox.replaceChildren(buildForm()); formBox.querySelector('input,select')?.focus();
    }
    function buildForm() {
      const f = el('form', { class: 'portal-form ap-form', novalidate: true });
      const field = (label, input, extra) => el('label', { class: 'ap-field' + (extra ? ' ' + extra : '') }, el('span', { text: label }), input);
      const cust = el('select', { name: 'customer_id' }, el('option', { value: '', text: 'Someone new' }), customers.map((c) => el('option', { value: c.id, text: c.name + (c.phone ? ` · ${c.phone}` : '') })));
      const newWho = el('div', { class: 'ap-new-who' }, field('Name', el('input', { name: 'contact_name', maxlength: 160 })), field('Email', el('input', { name: 'contact_email', type: 'email', maxlength: 200 })), field('Mobile', el('input', { name: 'contact_phone', type: 'tel', maxlength: 40 })));
      cust.addEventListener('change', () => { newWho.hidden = Boolean(cust.value); preview(); });
      const kind = el('select', { name: 'kind' }, el('option', { value: 'in_person', text: 'In person' }), el('option', { value: 'phone', text: 'Phone call' }), el('option', { value: 'video', text: 'Video call (link made for you)' }));
      const tomorrow = new Date(Date.now() + 864e5);
      const date = el('input', { name: 'date', type: 'date', required: true, value: ymd(tomorrow) });
      const timeIn = el('input', { name: 'time', type: 'time', required: true, step: 900 });
      const dur = el('select', { name: 'duration_min' }, [15, 30, 45, 60, 90, 120].map((m) => el('option', { value: m, text: m < 60 ? `${m} min` : `${m / 60} hour${m > 60 ? 's' : ''}`, selected: m === 30 || null })));
      const slots = el('div', { class: 'ap-slots', role: 'group', 'aria-label': 'Suggested times' });
      const suggest = async () => {
        slots.replaceChildren(el('small', { text: 'Finding free times…' }));
        try { const r = await api(`/api/saas/appointments/slots?date=${date.value}&duration=${dur.value}`);
          slots.replaceChildren(...(r.slots.length ? [el('small', { text: 'Free times:' }), ...r.slots.map((s) => el('button', { type: 'button', class: 'ap-slot', text: s.label, onclick: (e) => { timeIn.value = hhmmTz(new Date(s.start)); slots.querySelectorAll('.ap-slot').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); preview(); } }))] : [el('small', { text: r.note || 'No free times that day.' })]));
        } catch (e) { slots.replaceChildren(el('small', { text: e.message })); }
      };
      date.addEventListener('change', suggest); dur.addEventListener('change', suggest);
      const loc = field('Address or place', el('input', { name: 'location', maxlength: 300 }), 'ap-loc');
      kind.addEventListener('change', () => { loc.hidden = kind.value !== 'in_person'; preview(); });
      const remind = el('input', { type: 'checkbox', name: 'remind_customer' });
      const chan = el('select', { name: 'remind_channel', 'aria-label': 'Send the reminder by' }, el('option', { value: 'sms', text: 'SMS' }), el('option', { value: 'email', text: 'Email' }));
      const before = el('select', { name: 'remind_before_min', 'aria-label': 'When to send the reminder' }, el('option', { value: 1440, text: 'the day before' }), el('option', { value: 2880, text: '2 days before' }), el('option', { value: 120, text: '2 hours before' }), el('option', { value: 60, text: '1 hour before' }));
      const previewBox = el('blockquote', { class: 'ap-preview', hidden: true });
      const staff = el('select', { name: 'staff_before_min' }, el('option', { value: 30, text: '30 minutes before' }), el('option', { value: 15, text: '15 minutes before' }), el('option', { value: 60, text: '1 hour before' }), el('option', { value: 0, text: 'No alert' }));
      const startIso = () => { if (!date.value || !timeIn.value) return null; const [h, m] = timeIn.value.split(':').map(Number); return zonedToUtc(date.value, h, m).toISOString(); };
      async function preview() {
        previewBox.hidden = !remind.checked; if (!remind.checked || !startIso()) { previewBox.textContent = remind.checked ? 'Choose a time to see the reminder.' : ''; return; }
        try { const r = await api('/api/saas/appointments/preview', { method: 'POST', body: JSON.stringify({ title: f.elements.title.value || 'Your appointment', kind: kind.value, starts_at: startIso(), ...(f.elements.location.value ? { location: f.elements.location.value } : {}) }) }); previewBox.textContent = r.text; } catch { /* keep */ }
      }
      [remind, chan, timeIn].forEach((x) => x.addEventListener('change', preview));
      const submit = el('button', { type: 'submit', class: 'portal-button primary', text: 'Save appointment' });
      f.append(
        el('div', { class: 'ap-grid' }, field('Who', cust), field('What it is for', el('input', { name: 'title', required: true, minlength: 2, maxlength: 200, placeholder: 'For example: quote review' })), field('Type', kind)),
        newWho,
        el('div', { class: 'ap-grid' }, field('Date', date), field(TZ ? `Time (${TZ.split('/').pop().replace(/_/g, ' ')} time)` : 'Time', timeIn), field('Length', dur)),
        slots, loc,
        field('Notes (optional)', el('textarea', { name: 'notes', rows: 2, maxlength: 2000 }), 'ap-wide'),
        el('div', { class: 'ap-remind' }, el('label', { class: 'ap-check' }, remind, ' Send the customer a reminder by '), chan, before),
        previewBox,
        el('div', { class: 'ap-grid' }, field('Alert my team', staff)),
        el('p', { class: 'ap-hint', text: 'Ticking the reminder approves this exact message. It is sent from your business email or SMS sender in Connections.' }),
        el('div', { class: 'ap-actions' }, submit, el('button', { type: 'button', class: 'portal-button', text: 'Cancel', onclick: () => toggleForm() })));
      async function save(allowOverlap = false) {
        const v = new FormData(f), body = { title: String(v.get('title') || '').trim(), kind: kind.value, starts_at: startIso(), duration_min: Number(dur.value), remind_customer: remind.checked, staff_before_min: Number(staff.value), ...(allowOverlap ? { allow_overlap: true } : {}) };
        if (!body.title || !body.starts_at) { say('Add what it is for, a date and a time.', true); return; }
        if (cust.value) body.customer_id = cust.value; else for (const k of ['contact_name', 'contact_email', 'contact_phone']) if (String(v.get(k) || '').trim()) body[k] = String(v.get(k)).trim();
        if (remind.checked) { body.remind_channel = chan.value; body.remind_before_min = Number(before.value); }
        if (kind.value === 'in_person' && v.get('location')) body.location = String(v.get('location')).trim();
        if (v.get('notes')) body.notes = String(v.get('notes')).trim();
        submit.disabled = true;
        try {
          const r = await api('/api/saas/appointments', { method: 'POST', body: JSON.stringify(body) });
          say(`Saved: ${r.appointment.title}, ${new Date(r.appointment.start).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ })}.${r.appointment.link ? ' A video link was made; it is in the calendar.' : ''}`);
          toggleForm(); week = startOfWeek(new Date(r.appointment.start)); load();
        } catch (e) {
          if (e.status === 409 && e.data?.conflicts && confirm(`${e.message} Book it anyway?`)) return save(true);
          say(e.message, true);
        } finally { submit.disabled = false; }
      }
      f.addEventListener('submit', (e) => { e.preventDefault(); save(); });
      suggest(); loc.hidden = false;
      return f;
    }
    load();
  }
  window.OprunAppointments = { mount };
})();
