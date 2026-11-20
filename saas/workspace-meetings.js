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
        // T-186: invite and transcript from inside the call.
        invite: async ({ channel, to, message }) => (await api('/api/saas/meetings/invite', { method: 'POST', body: JSON.stringify({ meeting_id: m.id, channel, to, ...(message ? { message } : {}) }) })).message,
        allowGuests: async () => (await api(`/api/saas/meetings/${m.id}/guest-link`, { method: 'POST', body: JSON.stringify({ guests_allowed: true }) })).meeting.guest_link,
        transcriptUrl: `/api/saas/meetings/${m.id}/transcript?format=txt`,
        admit: async (waiting_id, allow) => (await api(`/api/saas/meetings/${m.id}/admit`, { method: 'POST', body: JSON.stringify({ waiting_id, allow }) })).waiting,
        end: async () => { await api(`/api/saas/meetings/${m.id}/end`, { method: 'POST', body: '{}' }); }
      } : null,
      onClose: (reason, text) => { o.hidden = true; o.replaceChildren(); document.documentElement.classList.remove('mc-open'); active = null; say(text); draw(host); }
    });
    say('');
  }

  // T-186: read or download a saved meeting transcript.
  function transcriptBox(m) {
    const body = el('div', { class: 'mt-transcript' });
    const box = el('details', { class: 'mt-transcript-box' }, el('summary', { text: 'Read transcript' }), body,
      el('a', { class: 'portal-button', href: `/api/saas/meetings/${m.id}/transcript?format=txt`, download: '', text: 'Download as text' }));
    box.addEventListener('toggle', async () => {
      if (!box.open || body.childElementCount) return;
      try { const d = await api(`/api/saas/meetings/${m.id}/transcript`); body.replaceChildren(el('ol', { class: 'mt-lines' }, d.lines.map((l) => el('li', {}, el('small', { text: new Date(l.spoken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' }), el('b', { text: `${l.speaker}${l.speaker_kind === 'guest' ? ' (guest)' : ''}: ` }), l.text)))); }
      catch (e) { body.replaceChildren(el('p', { text: e.message })); }
    });
    return box;
  }

  // ---------- invite: email, SMS, WhatsApp (sent from the business's own senders), share sheet, copy ----------
  function invitePanel(target, say) {
    const box = el('div', { class: 'mt-invite', hidden: true });
    const chan = el('select', { 'aria-label': 'Send by' }, el('option', { value: 'email', text: 'Email' }), el('option', { value: 'sms', text: 'SMS' }), el('option', { value: 'whatsapp', text: 'WhatsApp' }));
    const to = el('input', { 'aria-label': 'Email address or mobile number', placeholder: 'name@example.com', autocomplete: 'off' });
    const note = el('textarea', { 'aria-label': 'Add a note (optional)', rows: 2, maxlength: 1000, placeholder: 'Add a note (optional)' });
    chan.addEventListener('change', () => { to.placeholder = chan.value === 'email' ? 'name@example.com' : '0412 345 678'; to.type = chan.value === 'email' ? 'email' : 'tel'; to.inputMode = chan.value === 'email' ? 'email' : 'tel'; });
    const send = el('button', { type: 'button', class: 'portal-button primary', text: 'Send invitation', onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { const r = await api('/api/saas/meetings/invite', { method: 'POST', body: JSON.stringify({ ...target.ids, channel: chan.value, to: to.value.trim(), ...(note.value.trim() ? { message: note.value.trim() } : {}) }) }); say(r.message); to.value = ''; note.value = ''; }
      catch (err) { say(err.message, true); } finally { b.disabled = false; }
    } });
    const text = () => `You're invited to "${target.title}". Join here: ${target.link}`;
    const share = navigator.share ? el('button', { type: 'button', class: 'portal-button', text: 'Share…', onclick: () => navigator.share({ title: target.title, text: text(), url: target.link }).catch(() => {}) }) : null;
    const wa = el('a', { class: 'portal-button', href: `https://wa.me/?text=${encodeURIComponent(text())}`, target: '_blank', rel: 'noopener noreferrer', text: 'Open in WhatsApp' });
    const copy = el('button', { type: 'button', class: 'portal-button', text: 'Copy link', onclick: async () => { try { await navigator.clipboard.writeText(target.link); say('Link copied.'); } catch { say('Copy is blocked in this browser. Select the link and copy it.', true); } } });
    box.append(el('div', { class: 'mt-invite-row' }, chan, to), note, el('div', { class: 'mt-actions' }, send, share, wa, copy),
      el('small', { class: 'mt-hint', text: 'Email, SMS and WhatsApp go from your business senders in Connections. Guests wait in a lobby until you let them in.' }));
    const toggle = el('button', { type: 'button', class: 'portal-button', 'aria-expanded': 'false', text: 'Invite', onclick: () => { box.hidden = !box.hidden; toggle.setAttribute('aria-expanded', String(!box.hidden)); if (!box.hidden) to.focus(); } });
    return { toggle, box };
  }

  async function draw(host) {
    const body = host.querySelector('[data-mt-body]'); if (!body) return;
    const status = host.querySelector('[data-mt-status]');
    const say = (text, bad = false) => { status.textContent = text; status.dataset.tone = bad ? 'bad' : 'ok'; };
    const run = (fn) => async (e) => { const b = e.currentTarget; b.disabled = true; try { await fn(); } catch (err) { say(err.message, true); } finally { b.disabled = false; } };
    let d;
    try { d = await api('/api/saas/meetings'); } catch (e) { body.replaceChildren(el('p', { class: 'portal-note', 'data-tone': 'bad', text: e.message })); return; }
    const zoomInfo = await api('/api/saas/zoom').catch(() => null);
    const name = window.GDS_SESSION?.user?.full_name || window.GDS_SESSION?.user?.name || 'Team';
    const startNow = run(async () => {
      const made = await api('/api/saas/meetings', { method: 'POST', body: JSON.stringify({ title: `Meeting with ${name}`.slice(0, 120), mode: 'video', guests_allowed: true, notify_team: true }) });
      await join(host, made.meeting, say);
    });
    const startZoom = run(async () => { const r = await api('/api/saas/zoom/meetings', { method: 'POST', body: JSON.stringify({ topic: `Meeting with ${name}`.slice(0, 200) }) }); if (r.meeting.start_url) window.open(r.meeting.start_url, '_blank', 'noopener'); say('Zoom meeting created. Zoom opens in a new tab; invite people below.'); await draw(host); });

    // Start a meeting: built-in video now, Zoom now, or schedule for later.
    const form = el('form', { class: 'portal-form mt-form' },
      el('label', {}, 'Meeting name', el('input', { name: 'title', required: true, minlength: 2, maxlength: 120, placeholder: 'For example: Quote review with Sam' })),
      el('label', {}, 'Date and time (optional)', el('input', { name: 'starts_at', type: 'datetime-local' })),
      zoomInfo?.connected ? el('label', {}, 'Where', el('select', { name: 'where' }, el('option', { value: 'oprun', text: 'Oprun video (in the browser)' }), el('option', { value: 'zoom', text: 'Zoom' }))) : null,
      el('label', { class: 'mt-check' }, el('input', { name: 'guests_allowed', type: 'checkbox', checked: true }), ' Allow guests with a private link (they wait until you let them in)'),
      el('button', { type: 'submit', class: 'portal-button primary', text: 'Create meeting' }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const b = form.querySelector('[type=submit]'); b.disabled = true;
      const v = new FormData(form), at = v.get('starts_at') ? new Date(v.get('starts_at')).toISOString() : undefined;
      try {
        if (v.get('where') === 'zoom') await api('/api/saas/zoom/meetings', { method: 'POST', body: JSON.stringify({ topic: v.get('title'), ...(at ? { start_time: at } : {}) }) });
        else await api('/api/saas/meetings', { method: 'POST', body: JSON.stringify({ title: v.get('title'), mode: 'video', guests_allowed: v.get('guests_allowed') === 'on', ...(at ? { starts_at: at } : {}) }) });
        say('Meeting created. Use Invite to send the link.'); await draw(host);
      } catch (err) { say(err.message, true); b.disabled = false; }
    });
    const quick = el('article', { class: 'portal-panel mt-quick', 'aria-labelledby': 'mt-start-title' },
      el('h3', { id: 'mt-start-title', text: 'Start a meeting' }),
      el('p', { class: 'mt-lead', text: 'Meet face to face with customers and your team. Guests join from a private link and wait until you let them in.' }),
      el('div', { class: 'mt-actions' },
        el('button', { type: 'button', class: 'portal-button primary', text: 'Start video call', onclick: startNow }),
        zoomInfo?.connected ? el('button', { type: 'button', class: 'portal-button', text: 'Start Zoom meeting', onclick: startZoom }) : null),
      el('details', { class: 'mt-new' }, el('summary', { text: 'Schedule a meeting' }), form));

    const card = (m) => {
      const live = m.live.length ? `${m.live.length} in the call: ${m.live.map((p) => p.name).join(', ')}` : 'Nobody has joined yet';
      const actions = el('div', { class: 'mt-actions' }, el('button', { type: 'button', class: 'portal-button primary', text: m.live.length ? 'Join' : 'Start', 'aria-label': (m.live.length ? 'Join ' : 'Start ') + m.title, onclick: run(() => join(host, m, say)) }));
      let inv = null;
      if (m.guest_link) { inv = invitePanel({ ids: { meeting_id: m.id }, title: m.title, link: m.guest_link }, say); actions.append(inv.toggle); }
      if (m.can_manage) {
        const more = el('details', { class: 'mt-more' }, el('summary', { text: 'More' }), el('div', { class: 'mt-more-menu' },
          el('button', { type: 'button', class: 'portal-button', text: m.guests_allowed ? 'Replace guest link' : 'Allow guests', onclick: run(async () => { if (m.guests_allowed && !confirm('The current guest link will stop working. Continue?')) return; await api(`/api/saas/meetings/${m.id}/guest-link`, { method: 'POST', body: JSON.stringify({ guests_allowed: true }) }); say(m.guests_allowed ? 'New guest link made. The old one no longer works.' : 'Guests can now join with a private link.'); await draw(host); }) }),
          m.guests_allowed ? el('button', { type: 'button', class: 'portal-button', text: 'Turn guest link off', onclick: run(async () => { await api(`/api/saas/meetings/${m.id}/guest-link`, { method: 'POST', body: JSON.stringify({ guests_allowed: false }) }); say('Guests can no longer join this meeting.'); await draw(host); }) }) : null,
          el('button', { type: 'button', class: 'portal-button', text: 'End meeting', 'aria-label': 'End ' + m.title, onclick: run(async () => { if (!confirm('End this meeting for everyone?')) return; await api(`/api/saas/meetings/${m.id}/end`, { method: 'POST', body: '{}' }); say('Meeting ended.'); await draw(host); }) })));
        actions.append(more);
      }
      return el('li', { class: 'mt-card' + (m.live.length ? ' mt-live' : '') },
        el('div', { class: 'mt-card-main' }, el('span', { class: 'mt-badge', text: m.live.length ? 'Live' : 'Oprun video' }), el('b', { text: m.title }),
          el('small', { text: m.starts_at ? 'Scheduled for ' + when(m.starts_at) : 'Created ' + when(m.created_at) }),
          el('small', { class: 'mt-livenote', text: live + (m.waiting ? ` · ${m.waiting} guest${m.waiting === 1 ? '' : 's'} waiting` : '') })),
        actions, inv?.box || null);
    };
    const zoomCard = (m) => {
      const inv = invitePanel({ ids: { zoom_meeting_id: m.id }, title: m.topic, link: m.join_url }, say);
      return el('li', { class: 'mt-card' },
        el('div', { class: 'mt-card-main' }, el('span', { class: 'mt-badge mt-badge-zoom', text: 'Zoom' }), el('b', { text: m.topic }), el('small', { text: m.start_time ? 'Scheduled for ' + when(m.start_time) : 'Instant meeting · ' + when(m.created_at) }), m.passcode ? el('small', { text: 'Passcode ' + m.passcode }) : null),
        el('div', { class: 'mt-actions' },
          m.start_url ? el('a', { class: 'portal-button primary', href: m.start_url, target: '_blank', rel: 'noopener noreferrer', text: 'Start in Zoom', 'aria-label': 'Start ' + m.topic + ' in Zoom' }) : null,
          inv.toggle,
          el('button', { type: 'button', class: 'portal-button', text: 'Cancel', 'aria-label': 'Cancel ' + m.topic, onclick: run(async () => { if (!confirm('Cancel this Zoom meeting? The link stops working.')) return; await api(`/api/saas/zoom/meetings/${m.id}`, { method: 'DELETE' }); say('Zoom meeting cancelled.'); await draw(host); }) })),
        inv.box);
    };

    // Zoom: the business's own account (Server-to-Server OAuth app).
    let zoomPanel = null;
    if (zoomInfo) {
      if (zoomInfo.connected) zoomPanel = el('details', { class: 'portal-panel mt-zoom' }, el('summary', { text: `Zoom connected${zoomInfo.account ? ' · ' + zoomInfo.account : ''}` }),
        el('p', { text: 'Zoom meetings are created in your own Zoom account; Zoom bills you directly.' }), zoomInfo.problem ? el('p', { class: 'portal-note', 'data-tone': 'bad', text: zoomInfo.problem }) : null,
        el('button', { type: 'button', class: 'portal-button', text: 'Disconnect Zoom', onclick: run(async () => { if (!confirm('Disconnect Zoom? Existing Zoom links keep working in Zoom.')) return; await api('/api/saas/zoom', { method: 'DELETE' }); say('Zoom disconnected.'); await draw(host); }) }));
      else {
        const zf = el('form', { class: 'portal-form mt-form', autocomplete: 'off' },
          el('ol', { class: 'mt-steps' },
            el('li', {}, 'Open the ', el('a', { href: 'https://marketplace.zoom.us/develop/create', target: '_blank', rel: 'noopener noreferrer', text: 'Zoom App Marketplace' }), ' while signed in to your Zoom account, and create a Server-to-Server OAuth app.'),
            el('li', { text: 'Add the scopes meeting:write:meeting:admin and user:read:user:admin (or meeting:write and user:read), then activate the app.' }),
            el('li', { text: 'Copy the Account ID, Client ID and Client Secret here.' })),
          el('label', {}, 'Account ID', el('input', { name: 'account_id', required: true, minlength: 6, maxlength: 80 })),
          el('label', {}, 'Client ID', el('input', { name: 'client_id', required: true, minlength: 6, maxlength: 120 })),
          el('label', {}, 'Client Secret', el('input', { name: 'client_secret', type: 'password', required: true, minlength: 8, maxlength: 200 })),
          el('button', { type: 'submit', class: 'portal-button primary', text: 'Connect Zoom' }),
          el('small', { class: 'mt-hint', text: 'Stored encrypted and never shown again. Oprun checks the details with Zoom before saving.' }));
        zf.addEventListener('submit', async (e) => { e.preventDefault(); const b = zf.querySelector('[type=submit]'); b.disabled = true; const v = new FormData(zf);
          try { await api('/api/saas/zoom/connect', { method: 'POST', body: JSON.stringify({ account_id: v.get('account_id'), client_id: v.get('client_id'), client_secret: v.get('client_secret') }) }); say('Zoom connected.'); await draw(host); } catch (err) { say(err.message, true); b.disabled = false; } });
        zoomPanel = el('details', { class: 'portal-panel mt-zoom' }, el('summary', { text: 'Connect your Zoom account' }), el('p', { text: 'Run Zoom meetings from here with your own Zoom account: create, schedule, start and send invitations.' }), zf);
      }
    }
    const open = [...d.meetings.map(card), ...(zoomInfo?.meetings || []).map(zoomCard)];
    body.replaceChildren(...[
      quick,
      zoomPanel,
      el('div', { class: 'mt-section-head' }, el('h3', { class: 'mt-section-title', text: 'Upcoming and open meetings' }), el('a', { class: 'mt-cal-link', href: '#work/bookings', text: 'Open the calendar' })),
      open.length ? el('ul', { class: 'mt-list' }, open) : el('p', { class: 'portal-empty', text: 'No meetings yet. Start one now or schedule one for later. Customer video appointments made in Bookings appear here too.' }),
      d.past.length ? el('details', { class: 'portal-panel mt-past' }, el('summary', { text: `Past meetings (${d.past.length})` }), el('ul', { class: 'mt-list' }, d.past.map((m) => el('li', { class: 'mt-card' }, el('div', { class: 'mt-card-main' }, el('b', { text: m.title }), el('small', { text: `Ended ${when(m.ended_at)} · ${m.joins} join${m.joins === 1 ? '' : 's'}${m.transcript_lines ? ` · transcript ${m.transcript_lines} line${m.transcript_lines === 1 ? '' : 's'}` : ''}` })), m.transcript_lines ? transcriptBox(m) : null)))) : null,
      el('p', { class: 'portal-note mt-foot', text: `Oprun video: up to ${d.max_participants} people, picture and sound go directly between participants and are never recorded or stored.` + (d.relay_configured ? '' : ' On some office or mobile networks a direct call cannot connect; try another network or use Zoom.') })
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
