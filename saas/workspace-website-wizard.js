// W-03 (T-149): Website → Build wizard for a NEW site (docs/ai-website/03_WIZARD.md). Nine steps, one at a time, with
// progress and a summary of what will be created. Steps 1–4 and 8–9 work here; steps 5–7 (domain, email, search) open
// the Website tabs that already do them. Every step is saved, so the owner can leave and come back. Nothing is
// published here: "Send for approval" uses the normal page publishing, which asks for approval on a first release.
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
  const send = (path, method, body) => api(path, { method, body: JSON.stringify(body || {}) });
  let n = 0; const fid = () => `wz-${++n}`;
  const field = (label, input, hint) => { input.id ||= fid(); const h = hint ? el('small', { id: fid(), text: hint }) : null; if (h) input.setAttribute('aria-describedby', h.id); return el('div', { class: 'cx-field' }, el('label', { for: input.id, text: label }), input, h); };
  const STEPS = ['Start', 'Business', 'Design', 'Pages', 'Domain', 'Email', 'Search', 'Review', 'Publish'];
  const CORE = [['home', 'Home'], ['services', 'Services'], ['areas', 'Areas we serve'], ['about', 'About'], ['faq', 'Questions'], ['contact', 'Contact']];
  const SWATCH = { clean_trade: ['#1f4e79', 'system-ui, sans-serif'], bold_industrial: ['#b45309', '"Arial Narrow", Arial, sans-serif'], warm_local: ['#166534', 'Georgia, serif'], premium_dark: ['#111827', '"Helvetica Neue", Arial, sans-serif'], medical_calm: ['#0e7490', 'system-ui, sans-serif'], retail_bright: ['#be185d', 'system-ui, sans-serif'] };
  const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  /** host: an element inside the Build tab. ctx: { say(text, bad), go(tab) }. */
  async function mount(host, ctx) {
    let st = await api('/api/saas/website/wizard');
    let d = structuredClone(st.data), at = Math.max(0, Math.min(8, (st.step || 1) - 1)), review = st.review;
    const say = ctx.say;
    const root = el('div', { class: 'wz' }); host.replaceChildren(root);

    const save = async (step) => { st = { ...st, ...(await send('/api/saas/website/wizard', 'PUT', { step: step + 1, data: d })) }; return st; };
    function plan() {
      const b = d.business, out = [];
      for (const [k, t] of CORE) if (d.pages.core.includes(k) && !(k === 'faq' && !b.hours && !b.mobile_service)) out.push(t);
      if (d.pages.service_pages) for (const s of b.services) out.push(s);
      for (const a of b.areas) if (a.fact) out.push(`${b.services[0] || 'Services'} in ${a.name}`);
      return out;
    }
    const progress = el('p', { class: 'wz-progress' });
    const bar = el('progress', { max: '9', class: 'wz-bar', 'aria-hidden': 'true' });
    const nav = el('nav', { class: 'rx-steps wz-steps', 'aria-label': 'Website build steps' });
    const list = el('ol', {}); nav.append(list);
    const buttons = STEPS.map((t, i) => { const b = el('button', { type: 'button', 'data-wz-step': String(i + 1), onclick: async () => { const ok = collect(); if (!ok && i > at) return; try { await save(i); } catch { /* saved on the next step */ } go(i); } }, el('span', { class: 'rx-steps-num', 'aria-hidden': 'true', text: String(i + 1) }), el('span', { class: 'rx-steps-name', text: t })); list.append(el('li', {}, b)); return b; });
    const card = el('section', { class: 'portal-panel cx-panel wz-card', 'aria-live': 'polite' });
    const summary = el('aside', { class: 'wz-summary', 'aria-label': 'What will be created' });
    const back = el('button', { type: 'button', class: 'secondary-button', id: 'wz-back', text: 'Back', onclick: () => go(at - 1) });
    const next = el('button', { type: 'button', class: 'primary-button', id: 'wz-next', onclick: async () => {
      if (!collect()) return;
      next.disabled = true;
      try { await save(Math.min(8, at + 1)); go(at + 1); } catch (e) { say(e.message, true); } finally { next.disabled = false; }
    } });
    root.append(progress, bar, nav, el('div', { class: 'wz-layout' }, card, summary), el('div', { class: 'rx-steps-actions' }, back, next));

    let collect = () => true;
    function paintSummary() {
      const pages = plan(), b = d.business;
      summary.replaceChildren(el('h3', { text: 'What will be created' }),
        el('p', { text: `${pages.length} draft page${pages.length === 1 ? '' : 's'} for ${b.name || 'your business'}, in the ${st.styles[d.style.key] || 'Clean trade'} style.` }),
        el('ul', {}, pages.slice(0, 20).map((p) => el('li', { text: p }))),
        el('p', { class: 'portal-note', text: 'Nothing goes live until you publish, and a first release always asks for approval.' }),
        st.allowance ? el('p', { class: 'sx-source', text: `Website generations this month: ${st.allowance.website_generation.used} of ${st.allowance.website_generation.limit}.` }) : null);
    }
    function go(i, focus = true) {
      at = Math.max(0, Math.min(8, i));
      buttons.forEach((b, k) => { if (k === at) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      progress.textContent = `Step ${at + 1} of 9: ${STEPS[at]}`; bar.value = at + 1;
      back.hidden = at === 0; next.hidden = at >= 7; next.textContent = at === 3 ? 'Save and go to Domain' : 'Save and continue';
      collect = () => true;
      card.replaceChildren(); [step1, step2, step3, step4, step5, step6, step7, step8, step9][at]();
      paintSummary();
      if (focus) card.querySelector('h2')?.focus({ preventScroll: false });
    }
    const head = (title, intro) => [el('h2', { tabindex: '-1', text: title }), intro ? el('p', { text: intro }) : null];

    // 1. New site or transfer
    function step1() {
      const opt = (v, title, text) => { const i = el('input', { type: 'radio', name: 'wz-mode', value: v, checked: d.mode === v || null, onchange: () => { d.mode = v; } }); return el('label', { class: 'wz-choice' }, i, el('span', {}, el('b', { text: title }), el('small', { text }))); };
      card.append(...head('New website or redesign?'), el('fieldset', { class: 'wz-choices' }, el('legend', { class: 'sr-only', text: 'Choose one' }),
        opt('new', 'Make me a new website', 'Oprun writes draft pages from your own business details.'),
        opt('transfer', 'Redesign my existing website', 'Bring your current pages in first (keeps your addresses with redirects).')));
      collect = () => { if (d.mode === 'transfer') { say('Bring your current website in with the panel below this one. Then come back to redesign it.'); document.getElementById('ws-transfer')?.scrollIntoView({ behavior: 'smooth' }); return false; } return true; };
    }
    // 2. Business info
    function step2() {
      const b = d.business;
      const i = (k, attrs) => el('input', { value: b[k] || '', ...attrs });
      const name = i('name', { maxlength: '120', autocomplete: 'organization', required: true }), abn = i('abn', { maxlength: '14', inputmode: 'numeric', placeholder: '11 digits' }), phone = i('phone', { type: 'tel', maxlength: '30', required: true }), email = i('email', { type: 'email', maxlength: '160' }), address = i('address', { maxlength: '200' });
      const mobile = el('input', { type: 'checkbox', checked: b.mobile_service || null });
      const hours = i('hours', { maxlength: '300', placeholder: 'Monday to Friday, 7am to 5pm' }), diff = i('difference', { maxlength: '300', placeholder: 'One true sentence about you' });
      const lic = el('textarea', { rows: '2', maxlength: '800', placeholder: 'One per line, for example: Plumbing licence PL1234' }, b.licences.join('\n'));
      // Services as chips.
      const chips = el('ul', { class: 'wz-chips', 'aria-label': 'Services' });
      const paintChips = () => chips.replaceChildren(...b.services.map((s, k) => el('li', {}, el('span', { text: s }), el('button', { type: 'button', class: 'wz-chip-x', 'aria-label': `Remove ${s}`, text: '×', onclick: () => { b.services.splice(k, 1); paintChips(); paintSummary(); } }))));
      const svc = el('input', { maxlength: '80', placeholder: 'For example: Blocked drains' });
      const addSvc = () => { const v = svc.value.trim(); if (v.length >= 2 && !b.services.includes(v) && b.services.length < 12) { b.services.push(v); svc.value = ''; paintChips(); paintSummary(); } svc.focus(); };
      svc.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSvc(); } });
      paintChips();
      // Areas with an optional unique fact (an area gets its own page only with a fact).
      const areas = el('div', { class: 'wz-areas' });
      const paintAreas = () => areas.replaceChildren(...b.areas.map((a, k) => el('div', { class: 'wz-area' },
        field(`Area ${k + 1}`, el('input', { value: a.name, maxlength: '60', oninput: (e) => { a.name = e.target.value; } })),
        field('One true thing about working there (optional)', el('input', { value: a.fact, maxlength: '300', placeholder: 'Gives this area its own page', oninput: (e) => { a.fact = e.target.value; paintSummary(); } })),
        el('button', { type: 'button', class: 'secondary-button compact', text: 'Remove', 'aria-label': `Remove area ${a.name || k + 1}`, onclick: () => { b.areas.splice(k, 1); paintAreas(); paintSummary(); } }))),
        b.areas.length < 12 ? el('button', { type: 'button', class: 'secondary-button compact', text: 'Add an area', onclick: () => { b.areas.push({ name: '', fact: '' }); paintAreas(); areas.querySelector('.wz-area:last-of-type input')?.focus(); } }) : null);
      paintAreas();
      card.append(...head('Your business', 'Pre-filled from Oprun. Check each detail: only what you confirm is used on the site.'),
        el('div', { class: 'wz-grid' }, field('Business name', name), field('Phone', phone), field('Email (optional)', email), field('ABN (optional)', abn, 'Shown in the site details when given.'), field('Address (optional)', address)),
        el('label', { class: 'cx-check' }, mobile, ' We come to you (mobile service)'),
        el('div', { class: 'cx-field' }, el('label', { for: svc.id = fid(), text: 'Services you offer' }), chips, el('div', { class: 'wz-row' }, svc, el('button', { type: 'button', class: 'secondary-button compact', text: 'Add service', onclick: addSvc })), el('small', { text: 'Only services you really offer. Up to 12.' })),
        el('fieldset', { class: 'wz-fieldset' }, el('legend', { text: 'Areas you serve' }), areas),
        el('div', { class: 'wz-grid' }, field('Opening hours (optional)', hours), field('What makes you different (optional)', diff, 'Oprun never invents reviews, numbers, awards or licences.')),
        field('Licences (optional)', lic));
      collect = () => {
        Object.assign(b, { name: name.value.trim(), abn: abn.value.trim(), phone: phone.value.trim(), email: email.value.trim(), address: address.value.trim(), mobile_service: mobile.checked, hours: hours.value.trim(), difference: diff.value.trim(), licences: lic.value.split('\n').map((x) => x.trim()).filter((x) => x.length >= 2).slice(0, 6) });
        b.areas = b.areas.map((a) => ({ name: a.name.trim(), fact: a.fact.trim() })).filter((a) => a.name.length >= 2);
        const gaps = [!b.name && 'business name', !b.phone && 'phone', !b.services.length && 'at least one service', !b.areas.length && 'at least one area'].filter(Boolean);
        if (gaps.length) { say(`Add ${gaps.join(', ')} to continue.`, true); return false; }
        if (b.abn && !/^(\d\s?){11}$/.test(b.abn)) { say('An ABN has 11 digits.', true); abn.focus(); return false; }
        return true;
      };
    }
    // 3. Design style
    function step3() {
      const color = el('input', { type: 'color', value: d.style.color || SWATCH[d.style.key][0], oninput: (e) => { d.style.color = e.target.value; } });
      const cards = Object.entries(st.styles).map(([k, label]) => {
        const [c, font] = SWATCH[k] || SWATCH.clean_trade;
        const i = el('input', { type: 'radio', name: 'wz-style', value: k, checked: d.style.key === k || null, onchange: () => { d.style.key = k; d.style.color = c; color.value = c; paintSummary(); } });
        return el('label', { class: 'wz-style' }, i, el('span', { class: 'wz-swatch', style: `background:${c}`, 'aria-hidden': 'true' }), el('span', { class: 'wz-style-name', style: `font-family:${font}`, text: label }));
      });
      card.append(...head('Design style', 'Pick a look. You can change colours and photos later in Pages.'), el('fieldset', { class: 'wz-styles' }, el('legend', { class: 'sr-only', text: 'Style' }), cards), field('Brand colour', color, 'Text colour is chosen automatically so it stays readable.'));
    }
    // 4. Pages
    function step4() {
      const boxes = CORE.map(([k, t]) => el('label', { class: 'cx-check' }, el('input', { type: 'checkbox', value: k, checked: d.pages.core.includes(k) || null, onchange: (e) => { d.pages.core = e.target.checked ? [...new Set([...d.pages.core, k])] : d.pages.core.filter((x) => x !== k); paintSummary(); } }), ' ', t));
      const per = el('label', { class: 'cx-check' }, el('input', { type: 'checkbox', checked: d.pages.service_pages || null, onchange: (e) => { d.pages.service_pages = e.target.checked; paintSummary(); } }), ' One page for each service');
      const noFact = d.business.areas.filter((a) => !a.fact).map((a) => a.name);
      card.append(...head('Pages', 'Suggested for your business. Untick what you do not need.'), el('fieldset', { class: 'wz-fieldset' }, el('legend', { text: 'Main pages' }), boxes), per,
        noFact.length ? el('p', { class: 'portal-note', text: `No separate page for ${noFact.join(', ')}: add one true thing about working there (step 2) to give an area its own page. Thin copies of the same page hurt search.` }) : null,
        d.pages.core.includes('faq') && !d.business.hours && !d.business.mobile_service ? el('p', { class: 'portal-note', text: 'The Questions page is written only from facts you gave, such as opening hours. Without them it is skipped.' }) : null);
      collect = () => { if (!d.pages.core.length && !d.pages.service_pages) { say('Choose at least one page.', true); return false; } return true; };
    }
    // 5–7: done on their own Website tabs.
    const later = (title, text, tab, label) => () => card.append(...head(title, text), el('div', { class: 'pl-actions' }, el('button', { type: 'button', class: 'secondary-button', text: label, onclick: () => ctx.go(tab) })), el('p', { class: 'portal-note', text: 'You can do this now or after the pages are ready. Your progress here is saved.' }));
    const step5 = later('Domain', 'Use a domain you own, or buy one (you pay the registrar directly, not Oprun).', 'domain', 'Open Domain');
    const step6 = later('Business email', 'Optional. Get the records for Google Workspace, Microsoft 365 or Zoho (paid to them, not Oprun).', 'email', 'Open Business email');
    const step7 = () => card.append(...head('Search & AI visibility', 'Main search phrases, Google Search Console and AI answer engines are set up in Search & AI visibility.'), el('div', { class: 'pl-actions' }, el('a', { class: 'secondary-button', href: '#website/search', text: 'Open Search & AI visibility' })), el('p', { class: 'portal-note', text: 'Your progress here is saved.' }));
    // 8. Generate and review
    function step8() {
      const gen = el('button', { type: 'button', class: 'primary-button', id: 'wz-generate', text: review?.pages?.length ? 'Generate again' : 'Generate my draft pages' });
      const out = el('div', { class: 'wz-review' });
      const paint = () => {
        const pages = review?.pages || [];
        out.replaceChildren(...(review?.notes || []).map((t) => el('p', { class: 'portal-note', text: t })), pages.length ? el('ul', { class: 'wz-pages' }, pages.map((p) => {
          const blocked = p.checks?.blocked, warn = (p.checks?.checks || []).filter((c) => c.level !== 'ok' && c.level !== 'pass' && c.level !== 'block').length;
          return el('li', { class: 'wz-page' },
            el('div', { class: 'wz-page-head' }, el('b', { text: p.title }), el('span', { class: 'wz-tag', text: p.wording === 'ai' ? 'Written by AI from your facts' : 'Plain wording from your facts' }), el('span', { class: 'wz-tag' + (blocked ? ' bad' : ''), text: blocked ? 'Must fix before publishing' : warn ? `${warn} thing${warn === 1 ? '' : 's'} to check` : 'Checks passed' })),
            p.removed_claims?.length ? el('details', { class: 'wz-removed' }, el('summary', { text: `${p.removed_claims.length} sentence${p.removed_claims.length === 1 ? '' : 's'} left out (could not be checked)` }), el('ul', {}, p.removed_claims.map((c) => el('li', {}, el('q', { text: c.text }), ' ', el('small', { text: c.reason }))))) : null,
            el('ul', { class: 'wz-blocks' }, p.blocks.filter((x) => ['hero', 'text', 'faq'].includes(x.type)).map((x) => el('li', {}, el('span', { text: `${x.type === 'hero' ? 'Top banner' : x.type === 'faq' ? 'Questions' : 'Text'}${x.heading ? ': ' + x.heading : ''}` }),
              el('button', { type: 'button', class: 'secondary-button compact', 'aria-label': `Rewrite ${x.heading || x.type} on ${p.title}`, text: 'Rewrite', onclick: async (e) => { e.target.disabled = true; try { review = (await send('/api/saas/website/wizard/section', 'POST', { page_id: p.id, index: x.index })).review; say('Section rewritten. Check it in the preview.'); paint(); } catch (err) { say(err.message, true); e.target.disabled = false; } } })))),
            el('div', { class: 'pl-actions' }, el('a', { class: 'secondary-button compact', href: p.preview_url, target: '_blank', rel: 'noopener noreferrer', text: 'Preview ↗', 'aria-label': `Preview ${p.title} (opens a new tab)` }), el('a', { class: 'secondary-button compact', href: '#website/pages', text: 'Edit text', 'aria-label': `Edit ${p.title} in Pages` })));
        })) : el('p', { class: 'portal-empty', text: 'No pages yet. Generate them from your details.' }), pages.length ? el('div', { class: 'pl-actions' }, el('button', { type: 'button', class: 'primary-button', text: 'Continue to publish', onclick: async () => { await save(8); go(8); } })) : null);
      };
      gen.addEventListener('click', async () => {
        gen.disabled = true; gen.textContent = 'Writing your pages…'; out.replaceChildren(el('p', { class: 'pl-meta', text: `Writing ${plan().length} pages from your details. This can take a minute.` }));
        try { await save(7); const r = await send('/api/saas/website/wizard/generate', 'POST', {}); review = r.review; st = { ...st, ...(await api('/api/saas/website/wizard')) }; say(`${r.pages.length} draft pages ready. Check them, then continue to publish.`); }
        catch (e) { say(e.message, true); }
        finally { gen.disabled = false; gen.textContent = 'Generate again'; paint(); paintSummary(); }
      });
      card.append(...head('Generate and review', 'Oprun writes each page from your details only. Anything it could not check is left out and listed, so you can add it yourself if it is true.'), el('div', { class: 'pl-actions' }, gen), out);
      paint();
    }
    // 9. Publish (through the normal approval-first publishing)
    function step9() {
      const pages = review?.pages || [];
      const out = el('ul', { class: 'wz-results', 'aria-live': 'polite' });
      const sendBtn = el('button', { type: 'button', class: 'primary-button', id: 'wz-publish', text: 'Send for approval', disabled: !pages.length || null });
      sendBtn.addEventListener('click', async () => {
        sendBtn.disabled = true; out.replaceChildren();
        for (const p of pages) {
          const li = el('li', { text: `${p.title}: sending…` }); out.append(li);
          try { const r = await send(`/api/saas/seo/pages/${encodeURIComponent(p.id)}/publish`, 'POST', {}); li.textContent = `${p.title}: ${r.message || 'Sent.'}`; }
          catch (e) { li.textContent = `${p.title}: ${e.message}`; li.dataset.tone = 'bad'; }
        }
        say('Done. Pages that need approval wait in Approvals; nothing else was changed.');
        sendBtn.disabled = false;
      });
      card.append(...head('Publish', 'A first release, design changes and new claims always need an approval. Low-risk changes can go live under your approval rule.'),
        el('dl', { class: 'wz-facts' }, el('dt', { text: 'Pages' }), el('dd', { text: pages.length ? `${pages.length} draft${pages.length === 1 ? '' : 's'}` : 'Generate them first (step 8)' }),
          el('dt', { text: 'Address' }), el('dd', {}, st.site ? el('a', { href: st.site.url, target: '_blank', rel: 'noopener noreferrer', text: st.site.url + ' ↗' }) : 'Made when the pages are generated'),
          el('dt', { text: 'Your own domain' }), el('dd', { text: 'Set up in Domain (step 5)' })),
        el('div', { class: 'pl-actions' }, sendBtn, el('a', { class: 'secondary-button', href: '#today/approvals', text: 'Open Approvals' })), out);
    }
    go(at, false);
    return { reload: () => mount(host, ctx) };
  }
  window.OprunWebsiteWizard = { mount };
})();
