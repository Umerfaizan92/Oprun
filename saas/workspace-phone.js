// T-183: Communications > Phone. Laid out like a phone app: Keypad, Recents and Contacts.
// T-188: calls go straight from this browser to the number dialled, from the business's own Telnyx number (web phone),
// with a live call screen: ringing, timer, mute, keypad tones, hold, speaker, record and hang up.
// "Ring my mobile first" (click to call) stays as a second choice. Without a business number, calls use the device (tel:).
(() => {
  if (window.OprunPhone) return;
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v === null || v === undefined || v === false) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  async function api(path, opt = {}) {
    const r = await fetch(path, { credentials: 'same-origin', ...opt, headers: { 'Content-Type': 'application/json', ...(window.SuperProWorkspaceContext?.headers?.() || {}), ...(opt.headers || {}) } });
    let d = {}; try { d = await r.json(); } catch { /* not JSON */ }
    if (!r.ok || d.ok === false) throw new Error(d.error || `The server refused this action (${r.status}).`);
    return d;
  }
  const svg = (path) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = path; return s; };
  const PHONE = '<path d="M7 4h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2z" fill="currentColor"/>';
  const IN = '<path d="M17 7 7 17M7 9v8h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  const OUT = '<path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '#';
  const ago = (v) => { const t = Date.parse(v); if (!Number.isFinite(t)) return ''; const m = Math.round((Date.now() - t) / 6e4); if (m < 1) return 'Just now'; if (m < 60) return `${m} min ago`; if (m < 1440) return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); if (m < 10080) return new Date(t).toLocaleDateString([], { weekday: 'short' }); return new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' }); };
  const clean = (n) => String(n || '').replace(/[^\d+*#]/g, '');

  function view() {
    let s = document.getElementById('dialer-view');
    if (!s) { s = el('section', { class: 'view', id: 'dialer-view', hidden: true }); (document.querySelector('.content-wrap') || document.body).append(s); }
    return s;
  }

  async function render() {
    const s = view();
    let dial = null, book = { customers: [], team: [], recents: [] };
    const status = el('p', { class: 'portal-note ph-status', role: 'status', 'aria-live': 'polite' });
    const say = (t, bad = false) => { status.textContent = t; status.dataset.tone = bad ? 'bad' : 'ok'; };
    s.replaceChildren(el('div', { class: 'page-heading' }, el('div', {}, el('h1', { text: 'Phone' }), el('p', { text: 'Call customers and your team from your business number. Every call is listed in Recents.' }))), status, el('p', { class: 'pl-meta', text: 'Loading…' }));
    try { [dial, book] = await Promise.all([api('/api/saas/comms/dial'), api('/api/saas/comms/phonebook')]); }
    catch (e) { s.lastChild.replaceWith(el('p', { class: 'portal-note', 'data-tone': 'bad', text: e.message })); return; }

    async function ringMobile(n, label) {
      say(`Calling ${label || n}…`);
      try { const r = await api('/api/saas/comms/dial', { method: 'POST', body: JSON.stringify({ to: n }) }); say(r.message); setTimeout(refreshRecents, 4000); } catch (e) { say(e.message, true); }
    }
    async function call(number, label = '') {
      const n = clean(number); if (!n) { say('Enter a number first.', true); return; }
      if (live) { say('Finish the current call first.', true); return; }
      if (dial.web_phone) return webCall(n, label);
      if (dial.ready) return ringMobile(n, label);
      location.href = 'tel:' + n;
    }

    // ---------- live call screen (web phone) ----------
    let live = null;
    const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    const csName = el('b', { class: 'ph-cs-name' }), csNum = el('small', { class: 'ph-cs-num' }), csState = el('p', { class: 'ph-cs-state', role: 'status', 'aria-live': 'polite' });
    const csRec = el('span', { class: 'ph-cs-rec', hidden: true, text: 'Recording' });
    const ICON = { mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      pad: '<g fill="currentColor"><circle cx="6" cy="5" r="1.7"/><circle cx="12" cy="5" r="1.7"/><circle cx="18" cy="5" r="1.7"/><circle cx="6" cy="11" r="1.7"/><circle cx="12" cy="11" r="1.7"/><circle cx="18" cy="11" r="1.7"/><circle cx="6" cy="17" r="1.7"/><circle cx="12" cy="17" r="1.7"/><circle cx="18" cy="17" r="1.7"/><circle cx="12" cy="22" r="1.4"/></g>',
      hold: '<path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>', rec: '<circle cx="12" cy="12" r="6.5" fill="currentColor"/>',
      spk: '<path d="M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' };
    const ctl = (label, icon, onclick, extra = {}) => el('button', { type: 'button', class: 'ph-cs-btn', 'aria-pressed': 'false', onclick, ...extra }, el('span', { class: 'ph-cs-ico' }, svg(ICON[icon])), el('span', { class: 'ph-cs-label', text: label }));
    const muteBtn = ctl('Mute', 'mic', () => live?.call && (live.call.toggleAudioMute(), setPressed(muteBtn, !pressed(muteBtn))));
    const padBtn = ctl('Keypad', 'pad', () => { dtmfPad.hidden = !dtmfPad.hidden; setPressed(padBtn, !dtmfPad.hidden); });
    const holdBtn = ctl('Hold', 'hold', () => { if (!live?.call) return; live.call.toggleHold(); });
    const recBtn = ctl('Record', 'rec', () => toggleRecord());
    const spkBtn = ctl('Speaker', 'spk', () => nextSpeaker());
    const endBtn = el('button', { type: 'button', class: 'ph-cs-end', 'aria-label': 'End call', onclick: () => hangUp() }, svg(PHONE));
    const pressed = (b) => b.getAttribute('aria-pressed') === 'true';
    const setPressed = (b, on) => b.setAttribute('aria-pressed', String(Boolean(on)));
    const dtmfPad = el('div', { class: 'ph-pad ph-dtmf', role: 'group', 'aria-label': 'Send keypad tones', hidden: true }, [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']].map(([k, sub]) => el('button', { type: 'button', class: 'ph-key', 'aria-label': k, onclick: () => { try { live?.call?.dtmf(k); csNum.textContent = (live.tones = (live.tones || '') + k); } catch { /* not connected yet */ } } }, el('b', { text: k }), el('small', { text: sub }))));
    const callScreen = el('div', { class: 'ph-callscreen', hidden: true, 'aria-label': 'Call in progress' },
      el('div', { class: 'ph-cs-top' }, el('span', { class: 'ph-avatar ph-cs-avatar', 'aria-hidden': 'true' }), csName, csNum, csState, csRec),
      dtmfPad,
      el('div', { class: 'ph-cs-grid' }, muteBtn, padBtn, holdBtn, recBtn, spkBtn),
      el('div', { class: 'ph-cs-endrow' }, endBtn));
    function showCall(on) { callScreen.hidden = !on; keypad.hidden = on; list.hidden = on; cid.hidden = on; if (on) panels.forEach((p) => { p.hidden = true; }); else select(0); }
    function setState(text) { csState.textContent = text; }

    let rtc = null, rtcAt = 0, rtcFrom = '';
    function loadSdk() {
      if (window.TelnyxWebRTC) return Promise.resolve();
      return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = '/saas/vendor/telnyx/telnyx-webrtc.js?v=2.28.2'; sc.onload = () => res(); sc.onerror = () => rej(new Error('The web phone could not load. Check your connection.')); document.head.append(sc); });
    }
    function remoteAudio() { let a = document.getElementById('ph-remote-audio'); if (!a) { a = el('audio', { id: 'ph-remote-audio', autoplay: true, playsinline: true }); document.body.append(a); } return a; }
    async function client() {
      if (rtc && Date.now() - rtcAt < 20 * 3600e3) return rtc;
      try { rtc?.disconnect(); } catch { /* old */ }
      const [t] = await Promise.all([api('/api/saas/comms/webphone/token', { method: 'POST', body: '{}' }), loadSdk()]);
      rtcFrom = t.caller_number;
      const c = new window.TelnyxWebRTC.TelnyxRTC({ login_token: t.login_token, enableCallReports: false });
      c.remoteElement = remoteAudio();
      await new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error('The call server did not answer. Try again.')), 15000);
        c.on('telnyx.ready', () => { clearTimeout(timer); res(); });
        c.on('telnyx.error', (e) => { clearTimeout(timer); rej(new Error(e?.error?.message || e?.message || 'The web phone could not sign in.')); });
        c.on('telnyx.notification', onNote);
        c.connect();
      });
      rtc = c; rtcAt = Date.now(); return c;
    }
    function onNote(n) {
      if (n?.type === 'userMediaError') { say('Allow the microphone for this site to make calls.', true); if (live) finish('microphone blocked'); return; }
      if (n?.type !== 'callUpdate' || !live || n.call !== live.call && n.call?.id !== live.call?.id) return;
      const st = n.call.state;
      if (['new', 'requesting', 'trying', 'recovering'].includes(st)) setState('Calling…');
      else if (st === 'early' || st === 'ringing') setState('Ringing…');
      else if (st === 'active') {
        setPressed(holdBtn, false); holdBtn.querySelector('.ph-cs-label').textContent = 'Hold';
        if (!live.started) { live.started = Date.now(); api(`/api/saas/comms/webphone/calls/${live.id}`, { method: 'PATCH', body: JSON.stringify({ state: 'answered' }) }).catch(() => {}); live.tick = setInterval(() => { if (live?.started && live.call?.state === 'active') setState(fmt(Math.round((Date.now() - live.started) / 1000))); }, 1000); }
        setState(fmt(Math.round((Date.now() - live.started) / 1000)));
      } else if (st === 'held') { setState('On hold'); setPressed(holdBtn, true); holdBtn.querySelector('.ph-cs-label').textContent = 'Resume'; }
      else if (st === 'hangup' || st === 'destroy') finish(n.call.cause || n.call.sipReason || '');
    }
    async function webCall(n, label) {
      say('');
      live = { call: null, id: null, started: 0, label, number: n };
      csName.textContent = label || n; csNum.textContent = label ? n : ''; csState.textContent = 'Connecting…';
      callScreen.querySelector('.ph-cs-avatar').textContent = label ? initials(label) : '#';
      [muteBtn, padBtn, holdBtn, recBtn].forEach((b) => setPressed(b, false)); dtmfPad.hidden = true; csRec.hidden = true;
      spkBtn.hidden = !('setSinkId' in HTMLMediaElement.prototype);
      showCall(true); endBtn.focus();
      try {
        const [c, logged] = await Promise.all([client(), api('/api/saas/comms/webphone/calls', { method: 'POST', body: JSON.stringify({ to: n }) })]);
        if (!live) return; // hung up while connecting
        live.id = logged.id;
        live.call = c.newCall({ destinationNumber: logged.to, callerNumber: rtcFrom || logged.from, audio: true, video: false, remoteElement: remoteAudio() });
        setState('Calling…');
      } catch (e) { say(e.message, true); if (live?.id) api(`/api/saas/comms/webphone/calls/${live.id}`, { method: 'PATCH', body: JSON.stringify({ state: 'ended', cause: 'not placed' }) }).catch(() => {}); live = null; showCall(false); }
    }
    function hangUp() { if (!live) return showCall(false); setState('Ending…'); if (live.call) { try { live.call.hangup(); } catch { finish('ended'); } } else { live = null; showCall(false); } }
    async function finish(cause) {
      if (!live || live.done) return; const l = live; l.done = true;
      clearInterval(l.tick);
      const secs = l.started ? Math.round((Date.now() - l.started) / 1000) : 0;
      setState(l.started ? `Call ended · ${fmt(secs)}` : (/busy/i.test(cause) ? 'Busy' : 'No answer'));
      const rec = await stopRecord(l);
      if (l.id) {
        await api(`/api/saas/comms/webphone/calls/${l.id}`, { method: 'PATCH', body: JSON.stringify({ state: 'ended', duration: secs, cause: String(cause || '').slice(0, 80) }) }).catch(() => {});
        if (rec) { try { const fd = new FormData(); fd.append('audio', rec, 'call.' + (rec.type.includes('mp4') ? 'm4a' : 'webm')); const r = await fetch(`/api/saas/comms/webphone/calls/${l.id}/recording`, { method: 'POST', credentials: 'same-origin', headers: { ...(window.SuperProWorkspaceContext?.headers?.() || {}) }, body: fd }); if (!r.ok) throw new Error(); say('Call recording saved. Find it in Recents.'); } catch { say('The call recording could not be saved.', true); } }
      }
      setTimeout(() => { if (live === l) { live = null; showCall(false); select(1); } }, 1600);
    }

    // Recording happens in this browser (both voices), only after confirming the other person has been told.
    async function toggleRecord() {
      if (!live?.call || live.call.state !== 'active') { say('Recording starts once the call is connected.', true); return; }
      if (live.recorder) { live.recordingStopped = true; await stopRecord(live, true); return; }
      if (!confirm('Before recording, tell the other person this call is being recorded. In Australia recording a call without consent can be unlawful. Start recording?')) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)(), dest = ctx.createMediaStreamDestination();
        for (const st of [live.call.localStream, live.call.remoteStream]) if (st?.getAudioTracks?.().length) ctx.createMediaStreamSource(st).connect(dest);
        const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => window.MediaRecorder?.isTypeSupported?.(t));
        const r = new MediaRecorder(dest.stream, type ? { mimeType: type } : undefined), chunks = [];
        r.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
        r.start(1000); live.recorder = { r, chunks, ctx, type: r.mimeType || type || 'audio/webm' };
        setPressed(recBtn, true); recBtn.querySelector('.ph-cs-label').textContent = 'Stop rec'; csRec.hidden = false;
      } catch { say('This browser cannot record calls.', true); }
    }
    function stopRecord(l) {
      const rec = l?.recorder; if (!rec) return Promise.resolve(l?.savedRecording || null);
      l.recorder = null; setPressed(recBtn, false); recBtn.querySelector('.ph-cs-label').textContent = 'Record'; csRec.hidden = true;
      return new Promise((res) => { rec.r.onstop = () => { rec.ctx.close().catch(() => {}); const b = rec.chunks.length ? new Blob(rec.chunks, { type: rec.type.split(';')[0] }) : null; l.savedRecording = b; res(b); }; try { rec.r.stop(); } catch { res(null); } });
    }
    async function nextSpeaker() {
      try {
        const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput'); if (outs.length < 2) { say('Only one speaker is available on this device.'); return; }
        const a = remoteAudio(), i = outs.findIndex((d) => d.deviceId === (a.sinkId || 'default')); const next = outs[(i + 1) % outs.length];
        await a.setSinkId(next.deviceId); say(`Sound: ${next.label || 'speaker ' + ((i + 1) % outs.length + 1)}`); setPressed(spkBtn, next.deviceId !== 'default');
      } catch { say('Could not change the speaker.', true); }
    }
    const callButton = (number, label) => el('button', { type: 'button', class: 'ph-call-mini', 'aria-label': `Call ${label || number}`, onclick: () => call(number, label) }, svg(PHONE));

    // Caller ID banner
    const cid = dial.web_phone
      ? el('div', { class: 'ph-cid ok' }, svg(PHONE), el('span', {}, 'Calling from ', el('b', { text: dial.business_number }), '. Calls go straight from here to the number you dial.'),
        dial.ready ? el('button', { type: 'button', class: 'portal-button ph-alt', text: 'Ring my mobile instead', onclick: () => { const n = clean(input.value); if (!n) { say('Enter a number first.', true); return; } ringMobile(n, match.textContent.split(' · ')[0]); } }) : null)
      : dial.ready
      ? el('div', { class: 'ph-cid ok' }, svg(PHONE), el('span', {}, 'Calling from ', el('b', { text: dial.business_number }), `. Your mobile (${dial.your_mobile}) rings first; answer to connect.`))
      : el('div', { class: 'ph-cid' }, svg(PHONE), el('span', { text: dial.business_number ? 'Add your mobile number to your profile to call from the business number. Until then calls go from this device.' : 'Calls go from this device. Connect your business number in AI Receptionist so people see it when you call.' }),
        el('a', { class: 'portal-button', href: dial.business_number ? '#people/staff' : '#communications/receptionist', text: dial.business_number ? 'Add my mobile' : 'Connect number' }));

    // Keypad
    const input = el('input', { class: 'ph-number', type: 'tel', inputmode: 'tel', autocomplete: 'tel', 'aria-label': 'Phone number', placeholder: 'Enter a number' });
    const match = el('p', { class: 'ph-match', 'aria-live': 'polite' });
    const everyone = [...book.customers, ...book.team];
    const showMatch = () => { const d = input.value.replace(/\D/g, '').replace(/^0+/, ''); const m = d.length >= 4 ? everyone.find((c) => String(c.number).replace(/\D/g, '').includes(d)) : null; match.textContent = m ? `${m.name} · ${m.kind}` : ''; };
    input.addEventListener('input', showMatch);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') call(input.value); });
    const press = (k) => { input.value += k; showMatch(); input.focus(); };
    const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
    const pad = el('div', { class: 'ph-pad', role: 'group', 'aria-label': 'Keypad' }, KEYS.map(([k, sub]) => el('button', { type: 'button', class: 'ph-key', 'aria-label': k === '0' ? '0 (hold for +)' : k, onclick: () => press(k), oncontextmenu: (e) => { if (k === '0') { e.preventDefault(); press('+'); } } }, el('b', { text: k }), el('small', { text: sub }))));
    const keypad = el('div', { class: 'ph-keypad' },
      el('div', { class: 'ph-display' }, input, el('button', { type: 'button', class: 'ph-back', 'aria-label': 'Delete last digit', text: '⌫', onclick: () => { input.value = input.value.slice(0, -1); showMatch(); input.focus(); } })),
      match, pad,
      el('div', { class: 'ph-actions' },
        el('button', { type: 'button', class: 'ph-plus', 'aria-label': 'Add plus for an international number', text: '+', onclick: () => press('+') }),
        el('button', { type: 'button', class: 'ph-dial', 'aria-label': 'Call', onclick: () => call(input.value, match.textContent.split(' · ')[0]) }, svg(PHONE)),
        el('span', { class: 'ph-spacer', 'aria-hidden': 'true' })));

    // Recents
    const recentsBox = el('div', { class: 'ph-list' });
    const drawRecents = () => {
      recentsBox.replaceChildren(...(book.recents.length ? book.recents.map((c) => el('div', { class: 'ph-row' + (c.result === 'missed' ? ' ph-missed' : '') },
        el('span', { class: 'ph-dir', title: c.direction === 'outgoing' ? 'Outgoing' : 'Incoming' }, svg(c.direction === 'outgoing' ? OUT : IN)),
        el('div', { class: 'ph-main' }, el('b', { text: c.name || c.number }), el('small', { text: [c.name ? c.number : null, c.direction === 'outgoing' ? 'Outgoing' : 'Incoming', c.result, c.duration ? `${Math.floor(c.duration / 60)}:${String(c.duration % 60).padStart(2, '0')}` : null].filter(Boolean).join(' · ') })),
        el('time', { text: ago(c.at), datetime: c.at }), callButton(c.number, c.name || c.number),
        c.recording ? el('audio', { class: 'ph-rec-play', controls: true, preload: 'none', src: c.recording, 'aria-label': `Recording of the call with ${c.name || c.number}` }) : null)) : [el('p', { class: 'portal-empty', text: 'No calls yet. Calls you make and receive appear here.' })]));
    };
    async function refreshRecents() { try { book = { ...book, recents: (await api('/api/saas/comms/phonebook')).recents }; drawRecents(); } catch { /* keep the list */ } }

    // Contacts
    const q = el('input', { type: 'search', class: 'ph-search', placeholder: 'Search name or number', 'aria-label': 'Search contacts' });
    const contactsBox = el('div', { class: 'ph-list' });
    const drawContacts = () => {
      const term = q.value.trim().toLowerCase(), d = term.replace(/\D/g, '').replace(/^0+/, '');
      const hit = (c) => !term || String(c.name).toLowerCase().includes(term) || (d && String(c.number).replace(/\D/g, '').includes(d));
      const group = (title, list) => { const rows = list.filter(hit); return rows.length ? [el('h3', { class: 'ph-group', text: `${title} (${rows.length})` }), ...rows.map((c) => el('div', { class: 'ph-row' },
        el('span', { class: 'ph-avatar', 'aria-hidden': 'true', text: initials(c.name) }),
        el('div', { class: 'ph-main' }, el('b', { text: c.name }), el('small', { text: `${c.number} · ${c.kind}` })),
        callButton(c.number, c.name)))] : []; };
      const out = [...group('Customers', book.customers), ...group('Team', book.team)];
      contactsBox.replaceChildren(...(out.length ? out : [el('p', { class: 'portal-empty', text: everyone.length ? 'No contact matches that search.' : 'No contacts with a phone number yet. Add phone numbers to customers in Customers.' })]));
    };
    q.addEventListener('input', drawContacts);

    // Tabs: Keypad, Recents, Contacts (the phone tab bar mirrors these on mobile).
    const tabs = [['keypad', 'Keypad', keypad], ['recents', 'Recents', recentsBox], ['contacts', 'Contacts', el('div', {}, q, contactsBox)]];
    const list = el('div', { class: 'ph-tabs', role: 'tablist', 'aria-label': 'Phone', 'data-managed-sections': 'phone' });
    const panels = tabs.map(([id, label, body]) => el('div', { class: 'ph-panel', role: 'tabpanel', id: `dialer-panel-${id}`, 'aria-labelledby': `dialer-tab-${id}`, hidden: true }, body));
    const buttons = tabs.map(([id, label], i) => el('button', { type: 'button', role: 'tab', id: `dialer-tab-${id}`, 'aria-controls': `dialer-panel-${id}`, 'aria-selected': 'false', tabindex: '-1', text: label, onclick: () => select(i) }));
    function select(i) { buttons.forEach((b, n) => { b.setAttribute('aria-selected', String(n === i)); b.tabIndex = n === i ? 0 : -1; }); panels.forEach((p, n) => { p.hidden = n !== i; }); if (tabs[i][0] === 'recents') refreshRecents(); }
    // Arrow keys between tabs come from page-sections.js (keyboard), which every tab list in the workspace shares.
    list.append(...buttons);
    drawRecents(); drawContacts();
    s.lastChild.replaceWith(el('div', { class: 'ph-shell' }, cid, list, callScreen, ...panels));
    select(0);
  }

  if (document.getElementById('workspace') || document.querySelector('.content-wrap')) {
    view();
    // Render once per visit: the workspace re-announces the view when a tab inside it changes.
    let here = false;
    window.addEventListener('gds:viewchange', (e) => { const now = e.detail?.view === 'dialer'; if (now && !here) render(); here = now; });
  }
  window.OprunPhone = { render };
})();
