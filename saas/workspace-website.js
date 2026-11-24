// Website: one self-service section for every subscriber (T-147). Mirrors AI Receptionist: one place, plain steps.
// Tabs: Overview · Build (new or transfer) · Domain · Business email · Growth · Activity. Pages & editor and the SEO
// tools are the existing screens, linked from here (no second copy of them).
// Nothing here claims success unless the server confirmed it. Domains, email and listings are paid to the provider by
// the business itself; Oprun never takes payment for them.
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
  let n = 0; const fid = () => `ws-${++n}`;
  const field = (label, input, hint) => { input.id ||= fid(); return el('div', { class: 'cx-field' }, el('label', { for: input.id, text: label }), input, hint ? el('small', { text: hint }) : null); };
  const panel = (title, ...kids) => el('section', { class: 'portal-panel cx-panel ws-panel' }, el('h2', { text: title }), ...kids);
  const link = (href, text, primary = false) => el('a', { href, target: '_blank', rel: 'noopener noreferrer', class: primary ? 'portal-button primary' : 'cx-linkbtn', text: text + ' ↗' });
  const when = (v) => (v ? new Date(v).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '');
  const role = () => window.GDS_SESSION?.user?.role || window.GDS_SESSION?.membership?.role || '';
  const isOwner = () => ['owner', 'admin', 'super_admin'].includes(role());
  const TABS = [['overview', 'Overview'], ['build', 'Build'], ['domain', 'Domain'], ['email', 'Business email'], ['growth', 'Growth'], ['activity', 'Activity']];
  let tab = 'overview';

  function shell(id, title, copy) {
    let s = document.getElementById(id + '-view');
    if (!s) { s = el('section', { class: 'view', id: id + '-view', hidden: true }); (document.querySelector('.content-wrap') || document.body).append(s); }
    s.replaceChildren(el('div', { class: 'page-heading' }, el('div', {}, el('h1', { text: title }), el('p', { text: copy }))), el('p', { class: 'portal-note pl-status', role: 'status', 'aria-live': 'polite', 'data-ws-status': '' }));
    return s;
  }
  const say = (s, text, bad = false) => { const p = s.querySelector('[data-ws-status]'); if (p) { p.textContent = text; p.dataset.tone = bad ? 'bad' : 'good'; } if (!bad) window.SPMotion?.toast?.(text); };
  const busy = async (s, btn, fn) => { if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); } try { await fn(); } catch (e) { say(s, e.message, true); } finally { if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); } } };
  const records = (rows) => el('div', { class: 'ws-table-wrap' }, el('table', { class: 'ws-table' }, el('thead', {}, el('tr', {}, ['Type', 'Name / host', 'Value', 'Why'].map((h) => el('th', { scope: 'col', text: h })))),
    el('tbody', {}, rows.map((r) => el('tr', {}, el('td', { text: r.type }), el('td', {}, el('code', { text: r.name })), el('td', {}, el('code', { text: (r.priority ? r.priority + ' ' : '') + r.value })), el('td', { text: r.purpose || '' }))))));

  async function render() {
    const s = shell('websitehub', 'Website', 'Build a new website or bring in the one you have, connect your own domain and business email, and grow honestly with search and listings. Everything is saved as a draft until you publish it.');
    const nav = el('div', { class: 'ws-tabs', role: 'tablist', 'aria-label': 'Website sections' }, TABS.map(([k, label]) => el('button', { type: 'button', role: 'tab', class: 'portal-button' + (k === tab ? ' primary' : ''), 'aria-selected': String(k === tab), text: label, onclick: () => { tab = k; render().catch((e) => say(s, e.message, true)); } })));
    const body = el('div', { class: 'ws-body' }, el('p', { class: 'pl-meta', text: 'Loading…' }));
    s.append(nav, body);
    const o = await api('/api/saas/website/overview');
    body.replaceChildren();
    if (tab === 'overview') overview(s, body, o);
    else if (tab === 'build') await build(s, body, o);
    else if (tab === 'domain') domain(s, body, o);
    else if (tab === 'email') email(s, body, o);
    else if (tab === 'growth') await growth(s, body);
    else await activity(s, body);
  }
  const go = (k) => () => { tab = k; render().catch((e) => say(document.getElementById('websitehub-view'), e.message, true)); };

  function overview(s, body, o) {
    const done = o.checklist.filter((c) => c.done).length;
    body.append(panel('Your website at a glance',
      o.site ? el('p', {}, el('b', { text: o.site.name }), ` · ${o.site.pages.length} page${o.site.pages.length === 1 ? '' : 's'}, ${o.published_pages} published · `, el('a', { href: o.site.url, target: '_blank', rel: 'noopener noreferrer', text: 'View your site ↗' })) : el('p', { text: 'You have no website in Oprun yet. Build a new one or bring in your existing site.' }),
      el('p', { text: `${done} of ${o.checklist.length} set-up steps done.` }),
      el('ul', { class: 'rx-checks' }, o.checklist.map((c) => el('li', { 'data-ok': String(c.done) }, `${c.done ? '✓' : '○'} ${c.label}`))),
      el('div', { class: 'pl-actions' },
        o.site ? el('a', { class: 'portal-button primary', href: '#website/pages', text: 'Edit pages and publish' }) : el('button', { type: 'button', class: 'portal-button primary', text: 'Build my website', onclick: go('build') }),
        el('a', { class: 'portal-button', href: '#website/search', text: 'Search & AI visibility' }),
        el('button', { type: 'button', class: 'portal-button', text: 'Domain', onclick: go('domain') })),
      el('p', { class: 'portal-note', text: o.hosting_note })));
    if (o.audit) body.append(panel('Latest SEO check', el('p', { text: `Score ${o.audit.score}/100 on ${when(o.audit.created_at)}.` }), el('a', { class: 'portal-button', href: '#website/seo-audit', text: 'Open the audit' })));
  }

  async function build(s, body, o) {
    const f = o.facts;
    let wizard = null;
    if (isOwner()) { try { wizard = await api('/api/saas/website/wizard'); } catch { wizard = null; } }
    const wizardOn = Boolean(wizard?.enabled && wizard.can_generate && window.OprunWebsiteWizard);
    if (o.site && !wizardOn) body.append(panel('You already have a website', el('p', { text: `${o.site.name} has ${o.site.pages.length} page(s). Edit, preview and publish them in Pages & editor. Publishing a first version, design changes or new claims asks for approval.` }), el('a', { class: 'portal-button primary', href: '#website/pages', text: 'Open Pages & editor' })));
    // ---- A. New website ----
    const name = el('input', { maxlength: '120', value: f.business_name || '', required: true, autocomplete: 'organization' });
    const services = el('textarea', { rows: '3', maxlength: '1200', placeholder: 'One per line, for example:\nAluminium bull bar polishing\nPaint correction' }, (f.services || []).join('\n'));
    const areas = el('textarea', { rows: '2', maxlength: '800', placeholder: 'One per line, for example:\nSuccess WA\nCockburn' }, (f.areas || []).join('\n'));
    const diff = el('input', { maxlength: '300', placeholder: 'One true sentence, for example: Mobile service, we come to you.' });
    const style = el('select', {}, [['clean_trade', 'Clean trade'], ['bold_industrial', 'Bold industrial'], ['warm_local', 'Warm local'], ['premium_dark', 'Premium dark'], ['medical_calm', 'Calm and clinical'], ['retail_bright', 'Bright retail']].map(([v, t]) => el('option', { value: v, text: t })));
    const color = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(f.color || '') ? f.color : '#1f4e79' });
    const pages = [['home', 'Home'], ['services', 'Services'], ['areas', 'Areas we serve'], ['about', 'About'], ['faq', 'Questions'], ['contact', 'Contact']].map(([v, t]) => el('label', { class: 'pl-check' }, el('input', { type: 'checkbox', value: v, checked: ['home', 'services', 'about', 'contact'].includes(v) || null }), ' ' + t));
    const lines = (t) => t.value.split('\n').map((x) => x.trim()).filter(Boolean);
    const buildBtn = el('button', { type: 'submit', class: 'portal-button primary', text: 'Build my website (drafts)' });
    const out = el('div', { 'aria-live': 'polite' });
    const form = el('form', { class: 'portal-form' }, field('Business name', name), field('Services', services, 'Only services you really offer. Each becomes a section.'), field('Areas you serve', areas),
      field('What makes you different (optional)', diff, 'Only facts. Oprun never invents reviews, numbers, awards or licences.'), field('Style', style), field('Brand colour', color),
      el('fieldset', { class: 'ws-pages' }, el('legend', { text: 'Pages' }), pages), el('div', { class: 'pl-actions' }, buildBtn), out);
    form.addEventListener('submit', (e) => { e.preventDefault(); busy(s, buildBtn, async () => {
      const chosen = pages.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
      const r = await send('/api/saas/website/build', 'POST', { name: name.value.trim(), style: style.value, color: color.value, services: lines(services).slice(0, 12), areas: lines(areas).slice(0, 12), ...(diff.value.trim() ? { difference: diff.value.trim() } : {}), pages: chosen.length ? chosen : ['home'] });
      out.replaceChildren(el('p', { text: `Done: ${r.pages.length} draft page(s) created${r.wording === 'ai' ? ' with AI wording from your facts' : ' with plain wording (AI was not available)'}. Check them, then publish.` }), el('a', { class: 'portal-button primary', href: '#website/pages', text: 'Review and publish' }));
      say(s, 'Website drafts created.');
    }); });
    // W-03 (T-149): the step-by-step Build wizard replaces the one-form builder when it is switched on (default).
    if (wizardOn) {
      const host = el('div', { class: 'wz-host' }, el('p', { class: 'pl-meta', text: 'Loading…' }));
      body.append(panel('A. Build a new website', el('p', { text: 'Oprun writes your pages from your own business details, one step at a time. Nothing goes live until you publish.' }), host));
      window.OprunWebsiteWizard.mount(host, { say: (t, bad) => say(s, t, bad), go: (k) => go(k)() }).catch((e) => say(s, e.message, true));
    } else body.append(panel('A. Build a new website', el('p', { text: 'Oprun writes your pages from your own business details. Nothing goes live until you publish.' }), o.site ? el('p', { class: 'portal-note', text: 'Building is off because you already have a website.' }) : form));

    // ---- B. Transfer ----
    const url = el('input', { type: 'url', maxlength: '300', placeholder: 'https://www.yourbusiness.com.au', value: o.website_connection?.url || '' });
    const tBtn = el('button', { type: 'button', class: 'portal-button primary', text: 'Bring my website in' });
    const tOut = el('div', { 'aria-live': 'polite' });
    tBtn.addEventListener('click', () => busy(s, tBtn, async () => {
      const r = await send('/api/saas/website/transfer', 'POST', { url: url.value.trim() });
      tOut.replaceChildren(el('p', { text: `Read ${r.pages_found} page(s), imported ${r.pages_imported} as drafts. Every old address that changed has a redirect, so search rankings are kept.` }),
        el('ul', { class: 'ws-list' }, r.inventory.slice(0, 30).map((x) => el('li', { text: `${x.old} → ${x.new_path} (${x.outcome.replace('_', ' ')})` }))),
        el('a', { class: 'portal-button primary', href: '#website/pages', text: 'Review the imported pages' }));
      say(s, 'Website brought in as drafts.');
    }));
    const conn = o.website_connection;
    const tPanel = panel('B. Bring in your existing website',
      el('p', { text: 'Oprun reads your public pages politely (it follows robots.txt), turns them into editable drafts and keeps every old address working with redirects. It only does this for a website you have proved is yours.' }),
      el('p', { class: 'portal-note', text: conn?.verified ? `Verified: ${conn.hostname}` : 'Step 1: prove you own it in Setup > Connections > Website (add one DNS record). Then come back here.' }),
      conn?.verified ? null : el('a', { class: 'portal-button', href: '#setup/connections', text: 'Open Connections' }),
      isOwner() ? el('div', { class: 'portal-form' }, field('Your current website', url), el('div', { class: 'pl-actions' }, tBtn), tOut) : el('p', { class: 'portal-note', text: 'Only the owner or an admin can bring a website in.' }));
    tPanel.id = 'ws-transfer'; body.append(tPanel);
  }

  function domain(s, body, o) {
    const q = el('input', { maxlength: '63', placeholder: 'yourbusiness', value: (o.facts.business_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '') });
    const buy = el('a', { class: 'portal-button primary', target: '_blank', rel: 'noopener noreferrer', href: o.links.spaceship, text: 'Search on Spaceship ↗' });
    q.addEventListener('input', () => { buy.href = 'https://www.spaceship.com/domain-search/?query=' + encodeURIComponent(q.value.trim()); });
    q.dispatchEvent(new Event('input'));
    body.append(panel('1. Buy a domain (you pay the registrar directly)',
      el('p', { text: 'Your domain is yours: you buy it in your own account and pay the registrar, not Oprun.' }),
      field('Name to search', q), el('div', { class: 'pl-actions' }, buy, link(o.links.ventraip, 'VentraIP (.com.au / .au)'), link(o.links.cloudflare, 'Cloudflare (at cost)')),
      el('p', { class: 'portal-note' }, '.com.au and .au need an Australian ABN or ACN that matches the name. ', el('a', { href: o.links.auda, target: '_blank', rel: 'noopener noreferrer', text: 'auDA rules ↗' }))));
    const host = el('input', { maxlength: '253', placeholder: 'www.yourbusiness.com.au' });
    const add = el('button', { type: 'submit', class: 'portal-button primary', text: 'Add domain' });
    const form = el('form', { class: 'portal-form' }, field('Domain you own', host, 'Already have one, or just bought one? Add it here.'), el('div', { class: 'pl-actions' }, add));
    form.addEventListener('submit', (e) => { e.preventDefault(); busy(s, add, async () => { await send('/api/saas/website/domains', 'POST', { hostname: host.value.trim() }); say(s, 'Domain added. Add the record below at your registrar, then press Check.'); await render(); }); });
    const list = o.domains.map((d) => {
      const check = el('button', { type: 'button', class: 'portal-button', text: 'Check now', onclick: (e) => busy(s, e.target, async () => { const r = await send(`/api/saas/website/domains/${d.id}/check`, 'POST'); say(s, r.domain.status === 'verified' ? `${d.hostname} is verified as yours.` : 'Not found yet. DNS changes can take up to an hour.', r.domain.status !== 'verified'); await render(); }) });
      // Two-step remove (no browser pop-ups): the first press asks, the second press removes.
      const remove = isOwner() ? el('button', { type: 'button', class: 'portal-button', text: 'Remove', onclick: (e) => { const b = e.target; if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = `Yes, remove ${d.hostname} from Oprun`; say(s, 'Press again to remove. Nothing changes at your registrar.'); return; } busy(s, b, async () => { await send(`/api/saas/website/domains/${d.id}`, 'DELETE'); say(s, 'Domain removed from Oprun.'); await render(); }); } }) : null;
      const c = d.check || {};
      return el('article', { class: 'portal-panel ws-domain' }, el('h3', { text: d.hostname + (d.is_primary ? ' (main)' : '') }),
        el('p', {}, el('b', { text: d.status === 'verified' ? 'Verified as yours' : 'Waiting for the DNS record' }), d.last_checked_at ? ` · checked ${when(d.last_checked_at)}` : ''),
        o.hosting_ready && d.status === 'verified' ? el('p', { class: 'pl-meta' }, d.live_url ? el('a', { href: d.live_url, target: '_blank', rel: 'noopener', text: `Live: ${d.live_url}` }) : (d.hosting_status === 'ssl_pending' ? 'Website: waiting for the security certificate (usually under 30 minutes after the records are added)' : 'Website: waiting for the CNAME record'), d.hosting_errors?.length ? ` · ${d.hosting_errors.join('; ')}` : '') : null,
        records(d.records), c.checked_at ? el('p', { class: 'pl-meta', text: [`Points to a server: ${c.resolves ? 'yes' : 'no'}`, `Email set up: ${c.has_email ? 'yes' : 'no'}`, c.nameservers?.length ? `DNS host: ${c.nameservers.join(', ')}` : null, c.error ? `Check problem: ${c.error}` : null].filter(Boolean).join(' · ') }) : null,
        el('div', { class: 'pl-actions' }, check, remove));
    });
    body.append(panel('2. Connect a domain you own', isOwner() ? form : el('p', { class: 'portal-note', text: 'Only the owner or an admin can add domains.' }), ...list, el('p', { class: 'portal-note', text: o.hosting_note })));
  }

  function email(s, body, o) {
    const domains = [...new Set(o.domains.map((d) => d.hostname.replace(/^www\./, '')))];
    if (!domains.length) { body.append(panel('Business email', el('p', { text: 'Add your domain first, then set up email like you@yourbusiness.com.au.' }), el('button', { type: 'button', class: 'portal-button primary', text: 'Go to Domain', onclick: go('domain') }))); return; }
    const dSel = el('select', {}, domains.map((d) => el('option', { value: d, text: d })));
    const pSel = el('select', {}, [['google', 'Google Workspace'], ['microsoft', 'Microsoft 365'], ['zoho', 'Zoho Mail (Australia)']].map(([v, t]) => el('option', { value: v, text: t })));
    const out = el('div', { 'aria-live': 'polite' });
    const showSetup = (e) => out.replaceChildren(
      el('p', {}, el('b', { text: e.provider_name }), ` for ${e.domain}: ${e.status === 'verified' ? 'all records found ✓' : 'records not all found yet'}`),
      el('p', { class: 'portal-note', text: e.price }), el('div', { class: 'pl-actions' }, link(e.signup, `Sign up with ${e.provider_name}`, true)),
      el('p', { text: 'Add these records at your DNS host (where your domain is managed). Keep any existing records for other services.' }), records(e.records),
      el('p', { class: 'pl-meta', text: [`MX ${e.checks.mx ? '✓' : '✗'}`, `SPF ${e.checks.spf ? '✓' : '✗'}${e.checks.spf_duplicates ? ' (you have more than one SPF record: keep only one)' : ''}`, `DMARC ${e.checks.dmarc ? '✓' : '✗'}`, e.checks.error ? `Check problem: ${e.checks.error}` : null].filter(Boolean).join(' · ') }),
      el('button', { type: 'button', class: 'portal-button', text: 'Check again', onclick: (ev) => busy(s, ev.target, async () => { const r = await send('/api/saas/website/email/check', 'POST', { domain: e.domain }); showSetup(r.email); }) }));
    const start = el('button', { type: 'button', class: 'portal-button primary', text: 'Show my records' , onclick: (ev) => busy(s, ev.target, async () => { const r = await send('/api/saas/website/email', 'POST', { domain: dSel.value, provider: pSel.value }); showSetup(r.email); }) });
    body.append(panel('Business email (you pay the email provider directly)',
      el('p', { text: 'Choose a provider, sign up with your domain, then add the records Oprun shows. Oprun checks them for you. Your existing email keeps working: do not delete records you still use.' }),
      isOwner() ? el('div', { class: 'portal-form' }, field('Domain', dSel), field('Provider', pSel), el('div', { class: 'pl-actions' }, start)) : el('p', { class: 'portal-note', text: 'Only the owner or an admin can set up email.' }),
      out, o.email.length ? el('ul', { class: 'ws-list' }, o.email.map((e) => el('li', { text: `${e.domain}: ${e.provider_name} · ${e.status === 'verified' ? 'verified' : 'records pending'}${e.checked_at ? ' · ' + when(e.checked_at) : ''}` }))) : null));
  }

  async function growth(s, body) {
    const [g, ai] = await Promise.all([api('/api/saas/website/growth'), api('/api/saas/seo/ai-crawlers').catch(() => null)]);
    // W-18 (D-W18): AI answer engines. One setting for the business's websites; llms.txt follows it.
    if (ai) {
      const site = ai.sites[0], name = 'ws-ai-mode';
      const opts = [['all', 'Let AI answer engines and AI training read my site'], ['no_training', 'Let AI answer engines read my site, block AI training'], ['none', 'Block all AI crawlers (Google and Bing search still work)']];
      const radios = el('div', { class: 'ws-ai-modes', role: 'radiogroup', 'aria-label': 'AI crawler setting' }, opts.map(([v, t]) => el('label', { class: 'ws-ai-mode' }, el('input', { type: 'radio', name, value: v, checked: site?.mode === v || null, disabled: !site || !isOwner() || null }), ' ', t)));
      const save = el('button', { type: 'button', class: 'portal-button primary', text: 'Save AI setting', disabled: !site || !isOwner() || null });
      save.addEventListener('click', () => busy(s, save, async () => { const v = radios.querySelector('input:checked')?.value; if (!v) return say(s, 'Choose a setting first.', true); await send('/api/saas/seo/ai-crawlers', 'PUT', { mode: v }); say(s, 'AI setting saved. Your robots.txt and llms.txt now follow it.'); }));
      body.append(panel('AI answer engines', el('p', { text: 'ChatGPT, Perplexity, Claude and Google AI can quote your website when people ask about your services. Oprun publishes an llms.txt summary of your business and pages (only what you told Oprun and published), and writes your choice into robots.txt.' }),
        site ? radios : el('p', { text: 'Create and publish your website first; then this setting appears.' }),
        site ? el('div', { class: 'pl-actions' }, save, link(site.llms_url, 'View llms.txt'), link(site.robots_url, 'View robots.txt')) : null,
        !isOwner() && site ? el('small', { text: 'Only the owner or an admin can change this.' }) : null));
    }
    const STATUS = [['not_started', 'Not started'], ['in_progress', 'In progress'], ['listed', 'Listed'], ['needs_fix', 'Needs fixing']];
    body.append(panel('Listings (honest links)', el('p', { text: g.rules }),
      el('ul', { class: 'ws-listings' }, g.listings.map((l) => {
        const sel = el('select', { 'aria-label': `Status for ${l.name}` }, STATUS.map(([v, t]) => el('option', { value: v, text: t, selected: v === l.status || null })));
        const u = el('input', { type: 'url', maxlength: '500', placeholder: 'Your listing link (https://…)', value: l.listing_url, 'aria-label': `Listing link for ${l.name}` });
        const save = el('button', { type: 'button', class: 'portal-button', text: 'Save', onclick: (e) => busy(s, e.target, async () => { await send(`/api/saas/website/listings/${l.key}`, 'PUT', { status: sel.value, ...(u.value.trim() ? { url: u.value.trim() } : {}) }); say(s, `${l.name} saved.`); }) });
        return el('li', { class: 'ws-listing' }, el('b', { text: l.name }), ' ', l.url ? link(l.url, 'Open') : null, el('div', { class: 'ws-row' }, sel, u, save));
      }))));
    const csv = el('textarea', { rows: '4', maxlength: '2000000', placeholder: 'Paste the "Top linking sites" export from Google Search Console (Links report)' });
    const imp = el('button', { type: 'button', class: 'portal-button primary', text: 'Import' });
    const out = el('div', { 'aria-live': 'polite' });
    imp.addEventListener('click', () => busy(s, imp, async () => { const r = await send('/api/saas/website/links/import', 'POST', { csv: csv.value }); out.replaceChildren(el('p', { text: `${r.referring_domains} sites link to you (${r.links} links).${r.new_sites.length ? ` New: ${r.new_sites.slice(0, 10).join(', ')}.` : ''}${r.lost_sites.length ? ` Lost: ${r.lost_sites.slice(0, 10).join(', ')}.` : ''}` })); say(s, 'Links imported.'); }));
    body.append(panel('Who links to you', el('p', { text: 'Google Search Console shows which sites link to you. Export "Top linking sites" and paste it here; Oprun tracks new and lost links over time.' }),
      field('Search Console export', csv), el('div', { class: 'pl-actions' }, imp), out,
      g.snapshots.length ? el('ul', { class: 'ws-list' }, g.snapshots.map((x) => el('li', { text: `${when(x.taken_at)}: ${x.referring_domains} sites, ${x.links} links` }))) : null));
  }

  async function activity(s, body) {
    const a = (await api('/api/saas/website/activity')).activity;
    body.append(panel('Website activity', el('p', { text: 'Every website, domain, email and SEO change, who made it and when. This log cannot be edited.' }),
      a.length ? el('ul', { class: 'ws-list' }, a.map((x) => el('li', { text: `${when(x.at)} · ${x.by} · ${x.action.replace(/^(website|seo)\./, '').replace(/_/g, ' ')}` }))) : el('p', { class: 'portal-note', text: 'Nothing yet.' })));
  }

  // Older screens now live inside Website. Their addresses keep working and point here.
  function pointer(id, title, target, href = '#website/home') {
    const s = shell(id, title, 'This is now part of Website.');
    s.append(el('section', { class: 'portal-panel cx-panel' }, el('p', { text: 'Build or bring in your website, connect your domain and email, and grow with search and listings, all in one place.' }),
      el('div', { class: 'pl-actions' }, el('a', { class: 'portal-button primary', href, text: 'Open Website', onclick: () => { tab = target; } }))));
  }

  if (document.getElementById('workspace') || document.querySelector('.content-wrap')) {
    shell('websitehub', 'Website', 'Build, transfer, domain, email and growth in one place.');
    // Older addresses keep a section so the router can show them; each points into Website.
    shell('website', 'Website & Domain', 'This is now part of Website.'); shell('searchconsole', 'Search connection', 'This is now part of Website.'); shell('backlinks', 'Links & listings', 'This is now part of Website.');
    window.addEventListener('gds:viewchange', (e) => {
      const v = e.detail?.view;
      if (v === 'websitehub') render().catch((err) => say(document.getElementById('websitehub-view'), err.message, true));
      else if (v === 'website') pointer('website', 'Website & Domain', 'domain');
      else if (v === 'searchconsole') pointer('searchconsole', 'Search connection', 'overview', '#website/seo-google');
      else if (v === 'backlinks') pointer('backlinks', 'Links & listings', 'growth');
    });
  }
})();
