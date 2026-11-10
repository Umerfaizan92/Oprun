// T-074 Video Meetings page in the workspace: start a call now, schedule one, share a guest link, join and end.
// The call itself is drawn by meet-call.js. Shows only what the server confirmed.
(() => {
  if (window.SuperProMeetings) return;
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  async function api(path, opt = {}) {
    const r = await fetch(path, { credentials: 'same-origin', ...opt, headers: { 'Content-Type': 'application/json', ...(window.SuperProWorkspaceContext?.headers?.() || {}), ...(opt.headers || {}) } });
    let d = {}; try { d = await r.json(); } catch { /* not JSON */ }
    if (!r.ok || d.ok === false) throw new Error(d.error || `The server refused this action (${r.status}).`);
    return d;
  }
  const when = (v) => (v ? new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');
  let active = null, timer = null;

  function overlay() {
    let o = document.getElementById('meeting-call-overlay');
    if (!o) { o = el('div', { id: 'meeting-call-overlay', class: 'mc-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Call' }); document.body.append(o); }
    return o;
  }

  async function join(host, m, say) {
    if (active && !active.isClosed()) { say('You are already in a call. Leave it first.', true); return; }
    say('Joining…');
    const j = await api(`/api/saas/meetings/${m.id}/join`, { method: 'POST', body: '{}' });
    const o = overlay(); o.hidden = false; document.documentElement.classList.add('mc-open');
    active = window.SuperProCall.start({
      mount: o, join: j, waiting: j.waiting || [],
      host: m.can_manage ? {
        guestLink: m.guest_link,
        admit: async (waiting_id, allow) => (await api(`/api/saas/meetings/${m.id}/admit`, { method: 'POST', body: JSON.stringify({ waiting_id, allow }) })).waiting,
        end: async () => { await api(`/api/saas/meetings/${m.id}/end`, { method: 'POST', body: '{}' }); }
      } : null,
      onClose: (reason, text) => { o.hidden = true; o.replaceChildren(); document.documentElement.classList.remove('mc-open'); active = null; say(text); draw(host); }
    });
    say('');
  }

  async function draw(host) {
    const body = host.querySelector('[data-mt-body]'); if (!body) return;
    const status = host.querySelector('[data-mt-status]');
    const say = (text, bad = false) => { status.textContent = text; status.dataset.tone = bad ? 'bad' : 'ok'; };
    const run = (fn) => async (e) => { const b = e.currentTarget; b.disabled = true; try { await fn(); } catch (err) { say(err.message, true); } finally { b.disabled = false; } };
    let d;
    try { d = await api('/api/saas/meetings'); } catch (e) { body.replaceChildren(el('p', { class: 'portal-note', 'data-tone': 'bad', text: e.message })); return; }
    const startNow = (mode) => run(async () => {
      const name = window.GDS_SESSION?.user?.full_name || window.GDS_SESSION?.user?.name || 'Team';
      const made = await api('/api/saas/meetings', { method: 'POST', body: JSON.stringify({ title: `${mode === 'voice' ? 'Voice' : 'Video'} call started by ${name}`.slice(0, 120), mode, guests_allowed: true, notify_team: true }) });
      await join(host, made.meeting, say);
    });
    const quick = el('article', { class: 'portal-panel mt-quick' },
      el('h3', { text: 'Call now' }),
      el('p', { text: 'Starts a call straight away and tells your team. Copy the guest link inside the call to bring in a customer.' }),
      el('div', { class: 'mt-actions' },
        el('button', { type: 'button', class: 'portal-button primary', text: 'Start video call', onclick: startNow('video') }),
        el('button', { type: 'button', class: 'portal-button', text: 'Start voice call', onclick: startNow('voice') })));

    const form = el('form', { class: 'portal-form mt-form' },
      el('label', {}, 'Meeting name', el('input', { name: 'title', required: true, minlength: 2, maxlength: 120, placeholder: 'For example: Quote review with Sam' })),
      el('label', {}, 'Date and time (optional)', el('input', { name: 'starts_at', type: 'datetime-local' })),
      el('label', {}, 'Type', el('select', { name: 'mode' }, el('option', { value: 'video', text: 'Video and voice' }), el('option', { value: 'voice', text: 'Voice only' }))),
      el('label', { class: 'mt-check' }, el('input', { name: 'guests_allowed', type: 'checkbox', checked: true }), ' Allow guests with a private link (they wait until you let them in)'),
      el('button', { type: 'submit', class: 'portal-button primary', text: 'Create meeting' }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const b = form.querySelector('[type=submit]'); b.disabled = true;
      const v = new FormData(form);
      try {
        await api('/api/saas/meetings', { method: 'POST', body: JSON.stringify({ title: v.get('title'), mode: v.get('mode'), guests_allowed: v.get('guests_allowed') === 'on', ...(v.get('starts_at') ? { starts_at: new Date(v.get('starts_at')).toISOString() } : {}) }) });
        say('Meeting created.'); await draw(host);
      } catch (err) { say(err.message, true); b.disabled = false; }
    });

    const card = (m) => {
      const live = m.live.length ? `${m.live.length} in the call now: ${m.live.map((p) => p.name).join(', ')}` : 'Nobody is in the call yet';
      const actions = el('div', { class: 'mt-actions' }, el('button', { type: 'button', class: 'portal-button primary', text: m.live.length ? 'Join call' : 'Start call', 'aria-label': (m.live.length ? 'Join ' : 'Start ') + m.title, onclick: run(() => join(host, m, say)) }));
      if (m.guest_link) actions.append(el('button', { type: 'button', class: 'portal-button', text: 'Copy guest link', onclick: run(async () => { try { await navigator.clipboard.writeText(m.guest_link); say('Guest link copied. Send it to your customer; they wait until you let them in.'); } catch { say('Copy is blocked in this browser. Select the link below and copy it.', true); } }) }));
      if (m.can_manage) {
        actions.append(el('button', { type: 'button', class: 'portal-button', text: m.guests_allowed ? 'Replace guest link' : 'Allow guests', onclick: run(async () => { if (m.guests_allowed && !confirm('The current guest link will stop working. Continue?')) return; await api(`/api/saas/meetings/${m.id}/guest-link`, { method: 'POST', body: JSON.stringify({ guests_allowed: true }) }); say('A new guest link is ready.'); await draw(host); }) }));
        if (m.guests_allowed) actions.append(el('button', { type: 'button', class: 'portal-button', text: 'Turn guest link off', onclick: run(async () => { await api(`/api/saas/meetings/${m.id}/guest-link`, { method: 'POST', body: JSON.stringify({ guests_allowed: false }) }); say('Guests can no longer join this meeting.'); await draw(host); }) }));
        actions.append(el('button', { type: 'button', class: 'portal-button', text: 'End meeting', 'aria-label': 'End ' + m.title, onclick: run(async () => { if (!confirm('End this meeting for everyone?')) return; await api(`/api/saas/meetings/${m.id}/end`, { method: 'POST', body: '{}' }); say('Meeting ended.'); await draw(host); }) }));
      }
      return el('li', { class: 'mt-card' + (m.live.length ? ' mt-live' : '') },
        el('div', {}, el('b', { text: m.title }), el('small', { text: [m.mode === 'voice' ? 'Voice only' : 'Video', m.starts_at ? 'Scheduled ' + when(m.starts_at) : 'Created ' + when(m.created_at)].join(' · ') }),
          el('small', { class: 'mt-livenote', text: live + (m.waiting ? ` · ${m.waiting} guest${m.waiting === 1 ? '' : 's'} waiting` : '') }),
          m.guest_link ? el('code', { class: 'mt-link', text: m.guest_link }) : null),
        actions);
    };
    body.replaceChildren(...[
      quick,
      el('h3', { text: 'Open meetings' }),
      d.meetings.length ? el('ul', { class: 'mt-list' }, d.meetings.map(card)) : el('p', { class: 'portal-empty', text: 'No open meetings. Start a call now or create one for later.' }),
      el('details', { class: 'portal-panel mt-new' }, el('summary', { text: 'Create a meeting for later' }), form),
      d.past.length ? el('details', { class: 'portal-panel mt-past' }, el('summary', { text: `Ended meetings (${d.past.length})` }), el('ul', { class: 'mt-list' }, d.past.map((m) => el('li', { class: 'mt-card' }, el('div', {}, el('b', { text: m.title }), el('small', { text: `Ended ${when(m.ended_at)} · ${m.joins} join${m.joins === 1 ? '' : 's'}` })))))) : null,
      el('p', { class: 'portal-note', text: `Up to ${d.max_participants} people per call. Sound and picture go directly between the people in the call and are not recorded or stored by Super Pro.` + (d.relay_configured ? '' : ' On some office or mobile networks a direct call cannot connect; the other person can try a different network.') }),
    ].filter(Boolean));
  }

  /** Draws the Video Meetings page into the given container. Safe to call on every visit. */
  function mount(host) {
    if (!host) return;
    host.replaceChildren(el('p', { class: 'portal-note', 'data-mt-status': '1', role: 'status', 'aria-live': 'polite' }), el('div', { 'data-mt-body': '1' }, el('p', { class: 'portal-note', text: 'Loading meetings…' })));
    draw(host);
    clearInterval(timer);
    // Keep "who is in the call" current while the page is open and no call is on screen.
    timer = setInterval(() => { if (!document.body.contains(host)) return clearInterval(timer); if (!host.closest('section')?.hidden && !active && !host.querySelector('details[open] form')) draw(host); }, 15000);
  }
  window.SuperProMeetings = { mount };
})();
