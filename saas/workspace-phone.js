// T-183: Communications > Phone. Laid out like a phone app: Keypad, Recents and Contacts.
// Calls go out through the business's own Telnyx number (click to call): the member's mobile rings first and is then
// connected to the number chosen, so the person called sees the business number. Without a connected business
// number, calls are placed from the device in hand (tel:).
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

    async function call(number, label = '') {
      const n = clean(number); if (!n) { say('Enter a number first.', true); return; }
      if (!dial.ready) { location.href = 'tel:' + n; return; }
      say(`Calling ${label || n}…`);
      try { const r = await api('/api/saas/comms/dial', { method: 'POST', body: JSON.stringify({ to: n }) }); say(r.message); setTimeout(refreshRecents, 4000); } catch (e) { say(e.message, true); }
    }
    const callButton = (number, label) => el('button', { type: 'button', class: 'ph-call-mini', 'aria-label': `Call ${label || number}`, onclick: () => call(number, label) }, svg(PHONE));

    // Caller ID banner
    const cid = dial.ready
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
        el('time', { text: ago(c.at), datetime: c.at }), callButton(c.number, c.name || c.number))) : [el('p', { class: 'portal-empty', text: 'No calls yet. Calls you make and receive appear here.' })]));
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
    s.lastChild.replaceWith(el('div', { class: 'ph-shell' }, cid, list, ...panels));
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
