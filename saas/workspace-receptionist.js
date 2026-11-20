// AI Receptionist: one self-service section for every subscriber (D-R12, T-142).
// Replaces the old placeholder screens "AI Receptionist" (draft only), "Phone Numbers" and "Calls & SMS".
// 1. Your number: the business uses its OWN Telnyx account. It buys or ports the number and pays Telnyx directly
//    (links below); Oprun only connects it. Keys are sent once over HTTPS, stored encrypted, never shown again.
// 2. What callers hear: greeting, services and facts, opening hours, time zone (existing receptionist profile API).
// 3. Calls & transfers: answer mode, transfer/emergency number, voicemail (existing Call Handling screen).
// 4. Alerts: who is told about each call. 5. Test it.
// Nothing here claims success unless the server confirmed it.
(() => {
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return e;
  };
  const api = async (path, opt = {}) => {
    const r = await fetch(path, { credentials: 'same-origin', ...opt, headers: { 'Content-Type': 'application/json', ...(window.SuperProWorkspaceContext?.headers?.() || {}), ...(opt.headers || {}) } });
    let d = {}; try { d = await r.json(); } catch { /* not JSON */ }
    if (!r.ok || d.ok === false) throw new Error(d.error || `The server refused this action (${r.status}).`);
    return d;
  };
  let n = 0; const fid = () => `rx-${++n}`;
  const field = (label, input, hint) => { input.id ||= fid(); return el('div', { class: 'cx-field' }, el('label', { for: input.id, text: label }), input, hint ? el('small', { text: hint }) : null); };
  const card = (num, title, ...kids) => el('section', { class: 'portal-panel cx-panel rx-step' }, el('h2', {}, el('span', { class: 'rx-num', 'aria-hidden': 'true', text: String(num) }), ' ', title), ...kids);
  const link = (href, text) => el('a', { href, target: '_blank', rel: 'noopener noreferrer', class: 'cx-linkbtn', text });
  const when = (v) => (v ? new Date(v).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '');
  const STATUS = { not_connected: 'Not connected', connecting: 'Connecting…', needs_attention: 'Needs attention', connected: 'Connected', disconnected: 'Disconnected' };
  const role = () => window.GDS_SESSION?.user?.role || window.GDS_SESSION?.membership?.role || '';

  function shell(id, title, copy) {
    let s = document.getElementById(id + '-view');
    if (!s) { s = el('section', { class: 'view', id: id + '-view', hidden: true }); (document.querySelector('.content-wrap') || document.body).append(s); }
    s.replaceChildren(el('div', { class: 'page-heading' }, el('div', {}, el('h1', { text: title }), el('p', { text: copy }))), el('p', { class: 'portal-note pl-status', role: 'status', 'aria-live': 'polite', 'data-rx-status': '' }));
    return s;
  }
  const say = (s, text, bad = false) => { const p = s.querySelector('[data-rx-status]'); if (p) { p.textContent = text; p.dataset.tone = bad ? 'bad' : 'good'; } if (!bad) window.SPMotion?.toast?.(text); };
  const busy = async (s, btn, fn) => { if (btn) btn.disabled = true; try { await fn(); } catch (e) { say(s, e.message, true); } finally { if (btn) btn.disabled = false; } };

  async function render() {
    const s = shell('receptionist', 'AI Receptionist', 'Set up your own AI receptionist: your number, what callers hear, transfers and alerts. Every call lands in your Unified Inbox with the caller saved as a customer and an enquiry.');
    const body = el('div', { class: 'rx-body' }, el('p', { class: 'pl-meta', text: 'Loading…' }));
    s.append(body);
    const owner = role() === 'owner';
    const [tx, profile, voice] = await Promise.all([
      api('/api/saas/receptionist/telnyx').then((d) => d.telnyx),
      owner ? api('/api/saas/receptionist-profile').then((d) => d.profile).catch(() => null) : Promise.resolve(null),
      api('/api/saas/comms/voice').catch(() => null)
    ]);
    body.replaceChildren();

    // ---------- 1. Your number ----------
    const L = tx.links;
    const statusLine = el('p', {}, el('b', { text: STATUS[tx.status] || tx.status }), tx.number ? ` · ${tx.number}` : '', tx.connected_at ? ` · since ${when(tx.connected_at)}` : '');
    const steps = tx.steps?.length ? el('ul', { class: 'rx-checks' }, tx.steps.map((x) => el('li', { 'data-ok': String(x.ok) }, `${x.ok ? '✓' : '✗'} ${x.detail}`))) : null;
    const problem = tx.problem ? el('p', { class: 'portal-note', 'data-tone': 'bad', text: tx.problem }) : null;
    const guide = el('details', { open: tx.status === 'not_connected' || null },
      el('summary', { text: 'How it works (you pay Telnyx directly)' }),
      el('ol', {},
        el('li', {}, 'Open or create your own Telnyx account. ', link(L.signup, 'Create a Telnyx account')),
        el('li', {}, 'Get a number in Telnyx: buy a new one, or move (port) your existing business number. Telnyx charges you directly; Oprun never handles number payments. ', link(L.buy_number, 'Buy a number'), ' ', link(L.port_number, 'Port my number')),
        el('li', {}, 'Copy your API key and your public key from Telnyx. ', link(L.api_keys, 'API keys'), ' ', link(L.public_key, 'Public key')),
        el('li', {}, 'Paste them below with your number and press Connect. Oprun checks the number is in your account, creates the AI assistant and voice application in your account, and points your number at your receptionist.')),
      el('p', { class: 'sx-source', text: 'To keep your existing number without porting: buy a Telnyx number, connect it here, then set call forwarding on your old phone line to that number.' }));
    const numberCard = card(1, 'Your number', statusLine, problem, steps, guide);
    if (owner) {
      const key = el('input', { type: 'password', name: 'api_key', autocomplete: 'off', required: true, minlength: '20', maxlength: '400', placeholder: 'KEY…' });
      const pub = el('input', { type: 'password', name: 'public_key', autocomplete: 'off', required: true, minlength: '40', maxlength: '100', placeholder: 'Base64 public key' });
      const num = el('input', { type: 'tel', name: 'number', autocomplete: 'off', required: true, maxlength: '20', placeholder: '+61 8 xxxx xxxx', value: tx.number || '' });
      const asst = el('input', { type: 'text', name: 'assistant_id', autocomplete: 'off', maxlength: '60', placeholder: 'Optional: assistant-…' });
      const form = el('form', { class: 'cx-form', onsubmit: (e) => { e.preventDefault(); busy(s, form.querySelector('[type=submit]'), async () => {
        const r = await api('/api/saas/receptionist/telnyx/connect', { method: 'POST', body: JSON.stringify({ api_key: key.value.trim(), public_key: pub.value.trim(), number: num.value.trim(), assistant_id: asst.value.trim() }) });
        key.value = ''; pub.value = '';
        say(s, r.telnyx.status === 'connected' ? `Connected. Calls to ${r.telnyx.number} now reach your AI receptionist.` : 'Connected with one step left: see "Needs attention".', r.telnyx.status !== 'connected');
        await render();
      }); } },
        field('Telnyx API key', key, 'Stored encrypted. It is never shown again.'), field('Telnyx public key', pub, 'Used to check that each call really comes from Telnyx.'),
        field('Your number in Telnyx', num), field('AI assistant ID (optional)', asst, 'Leave blank and Oprun creates one in your Telnyx account.'),
        el('div', { class: 'pl-actions' }, el('button', { type: 'submit', class: 'portal-button primary', text: tx.status === 'not_connected' || tx.status === 'disconnected' ? 'Connect' : 'Reconnect' })));
      numberCard.append(form);
      if (tx.status === 'connected' || tx.status === 'needs_attention') numberCard.append(el('div', { class: 'pl-actions' }, el('button', { type: 'button', class: 'portal-button', text: 'Disconnect this number', onclick: (e) => busy(s, e.target, async () => {
        if (!window.confirm('Stop sending calls on this number to Oprun? Your number and Telnyx account stay yours; nothing is released.')) return;
        await api('/api/saas/receptionist/telnyx/disconnect', { method: 'POST', body: '{}' }); say(s, 'Disconnected. Calls are no longer sent to Oprun.'); await render();
      }) })));
      numberCard.append(el('p', { class: 'sx-source', text: `Your receptionist's private webhook address (filled in automatically): ${tx.webhook_url}` }));
    } else numberCard.append(el('p', { class: 'portal-note', text: 'Only the business owner can connect or change the phone number.' }));
    body.append(numberCard);

    // ---------- 2. What callers hear ----------
    if (owner) {
      const p = profile || {};
      const greeting = el('input', { name: 'greeting', required: true, minlength: '4', maxlength: '300', value: p.greeting || '', placeholder: 'Thanks for calling … How can I help?' });
      const knowledge = el('textarea', { name: 'knowledge', rows: '7', maxlength: '20000', placeholder: 'Services you offer, starting prices, areas you cover, address or location, parking, payment options, emergency service, what to ask every caller…' }, p.knowledge || '');
      const hours = el('input', { name: 'hours', maxlength: '1000', value: p.hours || '', placeholder: 'Mon-Fri 8:00-17:00, Sat 9-12' });
      const questions = el('textarea', { name: 'questions', rows: '4', maxlength: '4000', placeholder: 'One question per line, for example:\nIs the bull bar steel or aluminium?\nIs the vehicle drivable?' }, p.questions || '');
      const apptType = el('select', { name: 'appointment_type' }, [['on_site', 'We go to the customer (on-site job)'], ['at_business', 'The customer brings it to us'], ['phone', 'Phone appointment'], ['online', 'Online meeting']].map(([v, t]) => el('option', { value: v, text: t, selected: (p.appointment_type || 'on_site') === v || null })));
      const wa = el('input', { name: 'whatsapp_link', type: 'url', maxlength: '300', value: p.whatsapp_link || '', placeholder: 'https://wa.me/61400000000' });
      const up = el('input', { name: 'upload_link', type: 'url', maxlength: '300', value: p.upload_link || '', placeholder: 'https://yourwebsite.com.au/contact' });
      const autoLinks = el('input', { name: 'send_links_after_call', type: 'checkbox', checked: Boolean(p.send_links_after_call) || null });
      const linksMsg = el('input', { name: 'links_message', maxlength: '600', value: p.links_message || '', placeholder: 'Thanks for calling. Send us photos of the job here:' });
      const tz = el('select', { name: 'timezone' }, ['Australia/Perth', 'Australia/Darwin', 'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Sydney', 'Australia/Melbourne', 'Australia/Hobart'].map((z) => el('option', { value: z, text: z.replace('Australia/', ''), selected: (p.timezone || 'Australia/Perth') === z || null })));
      const f = el('form', { class: 'cx-form', onsubmit: (e) => { e.preventDefault(); busy(s, f.querySelector('[type=submit]'), async () => {
        await api('/api/saas/receptionist-profile', { method: 'PUT', body: JSON.stringify({ greeting: greeting.value.trim(), knowledge: knowledge.value, hours: hours.value.trim(), timezone: tz.value, questions: questions.value, appointment_type: apptType.value, whatsapp_link: wa.value.trim(), upload_link: up.value.trim(), send_links_after_call: autoLinks.checked, links_message: linksMsg.value.trim(), revision: p.revision || 0 }) });
        say(s, 'Saved. The next call uses these details.'); await render();
      }); } },
        field('Greeting', greeting, 'The first thing callers hear.'), field('Services, prices and business facts', knowledge, 'The receptionist only says what is written here. It never invents prices or availability.'),
        field('Opening hours', hours, 'Outside these hours transfers are skipped and messages are taken.'), field('Time zone', tz),
        field('How your appointments work', apptType, 'Decides whether the receptionist asks for the job address, a drop-off time or a call time.'),
        field('Extra questions for every caller', questions, 'Always asked as well: full name (spelled), mobile, email (spelled), address, the exact service and item (make, model, year), job details and preferred day and time.'),
        field('WhatsApp link', wa, 'Optional. Offered to callers who want to send photos or chat.'), field('Photo upload or contact form link', up, 'Optional. For example your website contact page.'),
        el('div', { class: 'cx-field' }, el('label', {}, autoLinks, ' Text these links to the caller straight after the call when they ask for them'), el('small', { text: 'Sends exactly your words below plus the links, from your connected SMS sender. Every other reply to the caller waits in Approvals.' })),
        field('Your words for that text', linksMsg),
        el('div', { class: 'pl-actions' }, el('button', { type: 'submit', class: 'portal-button primary', text: 'Save what callers hear' })));
      body.append(card(2, 'What callers hear', f));
    } else body.append(card(2, 'What callers hear', el('p', { class: 'portal-note', text: 'Only the business owner can change the greeting, services and hours.' })));

    // ---------- 3. Calls & transfers ----------
    const st = voice?.settings;
    const MODE = { assistant: 'The AI receptionist answers', forward: 'Calls go straight to a person', voicemail: 'Voicemail only' };
    body.append(card(3, 'Calls, transfers and emergencies',
      st ? el('p', {}, `${MODE[st.mode] || st.mode}. Transfer number: ${st.transfer_number || 'not set'}. Transfers: ${st.transfer_when === 'fallback' ? 'only if the receptionist fails' : 'when the caller asks or it cannot help'}.`) : el('p', { text: 'Call handling has not been set yet.' }),
      el('p', { class: 'sx-source', text: 'Set your transfer or emergency number here. Transfers happen during opening hours; the number is never read out to callers.' }),
      el('div', { class: 'pl-actions' }, el('a', { class: 'portal-button primary', href: '#communications/call-handling', text: 'Open call settings and call history' }))));

    // ---------- 4. Alerts ----------
    body.append(card(4, 'Alerts for every call',
      el('p', { text: 'After each call, owners and admins get an alert in Oprun, a phone notification, and a text message with the caller\'s name, what they need and their call-back number. The caller is saved as a customer and an enquiry is opened, linked in the Unified Inbox.' }),
      el('p', { class: 'sx-source', text: 'Texts go to the mobile number on each person\'s profile, unless they switched texts off in notification settings.' }),
      el('div', { class: 'pl-actions' }, el('a', { class: 'portal-button', href: '#communications/inbox', text: 'Open Unified Inbox' }))));

    // ---------- 5. Test ----------
    const calls = voice?.calls || [];
    body.append(card(5, 'Test your receptionist',
      el('p', { text: tx.status === 'connected' && tx.number ? `Call ${tx.number} from your mobile. Ask a question, give your name and number, and hang up. Within a minute the call appears below and in the Unified Inbox, and you get an alert.` : 'Connect your number first (step 1), then call it from your mobile.' }),
      calls.length ? el('ul', { class: 'rx-calls' }, calls.slice(0, 5).map((c) => el('li', {}, `${when(c.started_at)} · ${c.from_number || 'Unknown caller'} · ${c.voicemail ? 'Voicemail' : c.transferred_to_human ? 'Transferred' : c.answered_at ? 'Answered' : 'Missed'}${c.failures?.length ? ' · problem: ' + c.failures.map((f) => f.step).join(', ') : ''}`))) : el('p', { class: 'portal-empty', text: 'No calls yet.' }),
      el('div', { class: 'pl-actions' }, el('button', { type: 'button', class: 'portal-button', text: 'Refresh', onclick: (e) => busy(s, e.target, render) }))));
    stepper(body, tx);
  }

  // T-177 (docs/product-redesign/03 §7): one step at a time instead of one long page. The five cards, their forms,
  // IDs and save buttons are unchanged; the step list lets the owner jump to any step, and the step is remembered.
  function stepper(body, tx) {
    const cards = [...body.querySelectorAll(':scope > .rx-step')];
    if (cards.length < 2) return;
    const key = 'oprun-rx-step:' + (window.GDS_SESSION?.organisation?.id || 'workspace');
    const read = () => { try { return Number(localStorage.getItem(key)); } catch { return NaN; } };
    const write = (v) => { try { localStorage.setItem(key, String(v)); } catch { /* private mode */ } };
    const connected = tx.status === 'connected';
    let at = Number.isInteger(read()) && read() >= 0 && read() < cards.length ? read() : (connected ? 1 : 0);
    const titles = cards.map((c) => c.querySelector('h2')?.textContent.replace(/^\s*\d+\s*/, '').trim() || '');
    const nav = el('nav', { class: 'rx-steps', 'aria-label': 'Receptionist set-up steps' });
    const list = el('ol', {});
    const buttons = titles.map((t, i) => el('button', { type: 'button', 'data-rx-step': String(i + 1), onclick: () => go(i) },
      el('span', { class: 'rx-steps-num', 'aria-hidden': 'true', text: i === 0 && connected ? '✓' : String(i + 1) }), el('span', { class: 'rx-steps-name', text: t })));
    buttons.forEach((b) => list.append(el('li', {}, b)));
    nav.append(list);
    const back = el('button', { type: 'button', class: 'secondary-button', id: 'rx-step-back', text: 'Back', onclick: () => go(at - 1) });
    const next = el('button', { type: 'button', class: 'primary-button', id: 'rx-step-next', onclick: () => {
      // Unsaved changes are saved on the way (not the Telnyx keys: connecting is its own, explicit button).
      const form = cards[at].querySelector('form[data-rx-dirty]:not(:has(input[type=password]))');
      if (form) { form.removeAttribute('data-rx-dirty'); form.requestSubmit(); }
      go(at + 1);
    } });
    const foot = el('div', { class: 'rx-steps-actions' }, back, next);
    const label = () => { next.textContent = cards[at]?.querySelector('form[data-rx-dirty]:not(:has(input[type=password]))') ? 'Save and continue' : 'Next: ' + (titles[at + 1] || ''); };
    cards.forEach((c) => c.addEventListener('input', (e) => { e.target.form?.setAttribute('data-rx-dirty', ''); label(); }));
    body.prepend(nav); body.append(foot);
    function go(i, scroll = true) {
      at = Math.max(0, Math.min(cards.length - 1, i)); write(at);
      cards.forEach((c, n) => { c.hidden = n !== at; });
      buttons.forEach((b, n) => { if (n === at) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      back.hidden = at === 0;
      next.hidden = at === cards.length - 1;
      label();
      if (scroll) nav.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    go(at, false);
  }

  function pointer(id, title) {
    const s = shell(id, title, 'Phone numbers and calls are now set up in one place: AI Receptionist.');
    s.append(el('section', { class: 'portal-panel cx-panel' }, el('p', { text: 'Connect your own Telnyx number, set what callers hear, transfers and alerts, and test your receptionist.' }),
      el('div', { class: 'pl-actions' }, el('a', { class: 'portal-button primary', href: '#communications/receptionist', text: 'Open AI Receptionist' }))));
  }

  if (document.getElementById('workspace') || document.querySelector('.content-wrap')) {
    // Sections exist from the start so the router can show them; content loads when opened.
    shell('receptionist', 'AI Receptionist', 'Set up your own AI receptionist: your number, what callers hear, transfers and alerts.');
    shell('phone', 'Phone Numbers', 'Phone numbers and calls are now set up in AI Receptionist.');
    shell('calls', 'Calls & SMS', 'Phone numbers and calls are now set up in AI Receptionist.');
    window.addEventListener('gds:viewchange', (e) => {
      const v = e.detail?.view;
      if (v === 'receptionist') render().catch((err) => say(document.getElementById('receptionist-view'), err.message, true));
      else if (v === 'phone') pointer('phone', 'Phone Numbers');
      else if (v === 'calls') pointer('calls', 'Calls & SMS');
    });
  }
})();
