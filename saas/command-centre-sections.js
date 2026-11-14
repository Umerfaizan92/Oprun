// Prompt 02 (12 Nov 2026): Command Centre sub-sections "Your Workspace" and "Action Centre" (was Priorities / Attention items).
// - Your Workspace: every page this person may open, grouped like the main navigation, with live counts, a quick
//   filter and an "Ask AI" fallback. Tiles open the real pages, so each one uses its own authorised API.
// - Priorities: "Your next step" (three permitted cards, now with live status) and the AI Operations Brief (live
//   priorities with actions, refresh time, and an on-demand AI plan through the existing AI Operations endpoint).
// Master prompt (12 Nov 2026): "Priorities" is now "Action Centre" (old ?section=priorities and attention-items links
//   still work), and Readiness + Workflow guide are one "Workflow Guidance" section: the eight-stage core workflow with
//   live counts from the pipeline and job endpoints, then the real Setup Checklist (saas/workspace-setup.js).
// Data comes only from endpoints the signed-in role can already call; nothing is sent, published or charged here.
(() => {
  const view = document.getElementById('dashboard-view');
  if (!view || window.OprunCommandSections) return;
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v); } for (const k of kids.flat()) if (k != null) n.append(k); return n; };
  const icon = id => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), u = document.createElementNS(s.namespaceURI, 'use'); u.setAttribute('href', '#' + id); s.setAttribute('aria-hidden', 'true'); s.append(u); return s; };
  const get = async url => { const r = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } }); if (!r.ok) throw Object.assign(new Error('unavailable'), { status: r.status }); return r.json(); };
  const nav = () => window.SuperProNav, session = () => window.GDS_SESSION;
  const allowedViews = () => new Set(nav()?.sequence(session()?.user?.role) || []);
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const time = t => new Date(t).toLocaleTimeString(window.OprunLocale?.locale || [], { hour: 'numeric', minute: '2-digit' });
  // Prompt 03 L3b: text from the reader's dictionary (workspace-locale.js); English kept here as the fallback.
  const tr = (key, values, english) => window.OprunLocale?.t?.(key, values) ?? english;
  const sx = (s, field) => tr(`wg.s.${s.key}.${field}`, {}, s[field]);
  const unit = (s, n) => tr(`wg.s.${s.key}.unit`, { n }, plural(n, s.unit[0], s.unit[1]));

  // ---------- live data (shared by both sections) ----------
  let data = null, pipeline = null, loadedAt = 0, loading = null, failed = false;
  async function refresh(force) {
    if (loading) return loading;
    if (!force && data && Date.now() - loadedAt < 30000) return data;
    loading = (async () => {
      const [cc, pl] = await Promise.allSettled([get('/api/saas/command-centre'), allowedViews().has('enquiries') ? get('/api/saas/pipeline/overview') : Promise.reject(new Error('n/a'))]);
      failed = cc.status === 'rejected' && !data;
      if (cc.status === 'fulfilled') { data = cc.value; loadedAt = Date.now(); }
      if (pl.status === 'fulfilled') pipeline = pl.value;
      loading = null; paint(); return data;
    })();
    return loading;
  }
  const stage = key => pipeline?.stages?.find(s => s.key === key || s.stage === key || s.id === key)?.count ?? null;
  const live = () => ({
    enquiries: stage('enquiry') ?? stage('enquiries'),
    unifiedinbox: data?.inbox?.needs_reply ?? null,
    approvals: data?.approvals?.pending ?? null,
    jobs: data?.jobs ? data.jobs.awaiting : null,
    workforce: data?.team ? data.team.attention : null
  });

  // ---------- Your Workspace ----------
  const GROUP_ICON = { work: 'i-briefcase', customers: 'i-users', people: 'i-users', communications: 'i-bell', growth: 'i-video', money: 'i-doc', setup: 'i-shield', today: 'i-grid' };
  let query = '';
  function paintFeatures() {
    const host = $('[data-cc-features]'); if (!host || !nav() || !session()) return;
    const allowed = allowedViews(), counts = live();
    const groups = nav().DOMAINS.map(g => ({ g, items: g.items.filter(i => allowed.has(i.view) && i.view !== 'dashboard') })).filter(x => x.items.length);
    const q = query.trim().toLowerCase(), match = i => !q || (i.label + ' ' + (i.alias || []).join(' ')).toLowerCase().includes(q);
    const tile = (g, i) => {
      const n = counts[i.view];
      const a = el('a', { class: 'cc-tile' + (i.secondary ? ' is-secondary' : ''), href: '#' + i.path, 'data-cc-view': i.view },
        el('span', { class: 'cc-tile-icon' }, icon(((ic) => ic && !ic.startsWith('mono:') ? ic : null)(window.OprunIconFor?.(i.label)) || i.icon || GROUP_ICON[g.id] || 'i-doc')),
        el('span', { class: 'cc-tile-text' }, el('b', { text: i.label }), el('small', { text: g.label })),
        n ? el('span', { class: 'cc-count', 'aria-label': tr('ff.waiting', { n }, `${n} waiting`), text: n > 99 ? '99+' : String(n) }) : null);
      return a;
    };
    // The filter box is created once and kept, so typing is never interrupted by a re-render.
    if (!host.querySelector('#cc-feature-filter')) host.replaceChildren(el('div', { class: 'cc-filter' },
      el('label', { class: 'sr-only', for: 'cc-feature-filter', text: tr('ff.label', {}, 'Find a feature') }),
      el('input', { id: 'cc-feature-filter', type: 'search', placeholder: tr('ff.placeholder', {}, 'Find a feature…'), autocomplete: 'off', enterkeyhint: 'search', 'aria-controls': 'cc-feature-results' })),
      el('div', { id: 'cc-feature-results', 'aria-live': 'polite' }));
    // The filter box is kept between paints, so its label and placeholder follow the current language here.
    host.querySelector('label[for=cc-feature-filter]').textContent = tr('ff.label', {}, 'Find a feature');
    host.querySelector('#cc-feature-filter').placeholder = tr('ff.placeholder', {}, 'Find a feature…');
    const results = host.querySelector('#cc-feature-results');
    const sig = JSON.stringify([window.OprunLocale?.locale, q, Boolean(window.OprunIconFor), groups.map(x => [x.g.id, x.g.label, x.items.map(i => [i.view, i.label, counts[i.view]])])]);
    if (results.dataset.ccSig === sig) return; results.dataset.ccSig = sig; // E-037: same loop guard as the Action Centre
    const sections = [];
    let shown = 0;
    for (const { g, items } of groups) {
      // One or two extra features are shown directly; only longer lists sit behind "More in …".
      const extra = items.filter(i => i.secondary && match(i)), main = [...items.filter(i => !i.secondary && match(i)), ...(extra.length < 3 ? extra : [])], more = extra.length < 3 ? [] : extra;
      if (!main.length && !more.length) continue; shown += main.length + more.length;
      const block = el('section', { class: 'cc-group', 'aria-label': g.label }, el('h3', {}, icon(GROUP_ICON[g.id] || 'i-grid'), el('span', { text: g.label }), el('small', { class: 'cc-group-count', text: String(main.length + more.length) })), el('div', { class: 'cc-grid' }, main.map(i => tile(g, i))));
      if (more.length) block.append(q ? el('div', { class: 'cc-grid' }, more.map(i => tile(g, i))) : el('details', { class: 'cc-more' }, el('summary', { text: tr('ff.more', { group: g.label, n: more.length }, `More in ${g.label} (${more.length})`) }), el('div', { class: 'cc-grid' }, more.map(i => tile(g, i)))));
      sections.push(block);
    }
    const empty = q && !shown ? el('div', { class: 'cc-empty' }, el('p', { text: tr('ff.none', { query }, `No feature matches “${query}”.`) }), el('button', { type: 'button', class: 'secondary-button compact', 'data-cc-ask': '' , text: tr('ff.ask', {}, 'Ask AI where to find it') })) : null;
    results.replaceChildren(...(empty ? [empty] : []), ...sections);
  }
  view.addEventListener('input', e => { if (e.target.id === 'cc-feature-filter') { query = e.target.value; paintFeatures(); } });
  view.addEventListener('keydown', e => { if (e.target.id === 'cc-feature-filter' && e.key === 'Enter') { e.preventDefault(); const first = $('[data-cc-features] .cc-tile'); if (first && query) first.click(); else if (query) askWhere(); } if (e.target.id === 'cc-feature-filter' && e.key === 'Escape') { query = ''; e.target.value = ''; paintFeatures(); } });
  const askWhere = () => window.dispatchEvent(new CustomEvent('superpro:ask', { detail: { question: `Where in Oprun can I ${query.trim()}?` } }));
  view.addEventListener('click', e => { if (e.target.closest('[data-cc-ask]')) askWhere(); });

  // ---------- Action Centre: Your next step ----------
  function paintNextSteps() {
    const start = $('#workspace-start'); if (!start) return;
    const c = live(), j = data?.jobs;
    const status = {
      enquiries: c.enquiries == null ? null : c.enquiries ? [tr('cc.newEnquiries', { n: c.enquiries }, plural(c.enquiries, 'new enquiry', 'new enquiries')), 'warn'] : [tr('cc.noEnquiries', {}, 'No new enquiries'), 'ok'],
      jobs: !j ? null : (j.today || j.awaiting) ? [tr('cc.jobsToday', { n: j.today, awaiting: j.awaiting }, `${plural(j.today, 'job')} today · ${j.awaiting} to allocate`), j.awaiting ? 'warn' : 'info'] : [tr('cc.nothingToday', {}, 'Nothing scheduled today'), 'ok'],
      unifiedinbox: c.unifiedinbox == null ? null : c.unifiedinbox ? [tr('cc.needReply', { n: c.unifiedinbox }, plural(c.unifiedinbox, 'conversation') + ' need a reply'), 'warn'] : [tr('cc.allAnswered', {}, 'All conversations answered'), 'ok'],
      onboarding: null
    };
    start.querySelectorAll('.workspace-start-link').forEach(a => {
      const v = nav()?.resolve?.(a.getAttribute('href'), session()?.user?.role) || '';
      a.querySelector('.cc-step-status')?.remove();
      const st = status[v]; if (st) a.append(el('span', { class: 'cc-step-status cc-' + st[1], text: st[0] }));
      a.dataset.ccView = v;
    });
  }

  // ---------- Action Centre: AI Operations Brief ----------
  function priorities() {
    if (!data) return [];
    const allowed = allowedViews(), out = [];
    const add = (view, level, title, detail, protectedAction) => { if (allowed.has(view)) out.push({ view, level, title, detail, protectedAction }); };
    const c = live();
    if (data.approvals?.pending) add('approvals', 'high', tr('cc.p.approvals', { n: data.approvals.pending }, `${plural(data.approvals.pending, 'approval')} waiting for you`), tr('cc.p.approvalsDetail', {}, 'Quotes, replies or publishing are on hold until you decide.'), true);
    if (data.inbox?.needs_reply) add('unifiedinbox', 'high', tr('cc.p.reply', { n: data.inbox.needs_reply }, `${plural(data.inbox.needs_reply, 'customer')} waiting for a reply`), data.inbox.drafts_waiting ? tr('cc.p.drafts', { n: data.inbox.drafts_waiting }, `${data.inbox.drafts_waiting} AI drafts are ready to review.`) : tr('cc.p.replyDetail', {}, 'Reply from the Unified Inbox; AI can draft for your approval.'), Boolean(data.inbox.drafts_waiting));
    if (c.enquiries) add('enquiries', 'medium', tr('cc.p.enquiries', { n: c.enquiries }, `${plural(c.enquiries, 'new enquiry', 'new enquiries')} to qualify`), tr('cc.p.enquiriesDetail', {}, 'Turn them into quotes before they go cold.'), false);
    if (data.jobs?.awaiting) add('jobs', 'medium', tr('cc.p.allocate', { n: data.jobs.awaiting }, `${plural(data.jobs.awaiting, 'job')} awaiting allocation`), data.team?.ready ? tr('cc.p.ready', { n: data.team.ready }, `${data.team.ready} workers are ready to schedule.`) : tr('cc.p.noneReady', {}, 'No workers are ready to schedule yet.'), false);
    if (data.team?.attention || data.team?.expiring) add('workforce', data.team.expiring ? 'medium' : 'low', tr('cc.p.compliance', { n: data.team.attention }, `${plural(data.team.attention, 'worker')} need compliance checks`), data.team.expiring ? tr('cc.p.expiring', { n: data.team.expiring }, `${plural(data.team.expiring, 'document')} expire within 30 days.`) : tr('cc.p.review', {}, 'Review documents before scheduling.'), false);
    if (data.finance && data.finance.profit_cents < 0) add('finance', 'high', tr('cc.p.loss', {}, 'This month is running at a loss'), tr('cc.p.lossDetail', {}, 'Costs are above income so far this month.'), false);
    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 6);
  }
  function paintBrief() {
    const panel = $('#priorities .ai-brief-panel'); if (!panel) return;
    let box = panel.querySelector('.cc-brief'); if (!box) { box = el('div', { class: 'cc-brief' }); panel.querySelector('.briefing-box')?.after(box); }
    const pill = panel.querySelector('.panel-head .status-pill');
    if (pill) { pill.className = 'status-pill ' + (failed ? 'warn' : data ? 'good' : 'neutral'); pill.textContent = failed ? tr('cc.unavailable', {}, 'Live data unavailable') : data ? tr('cc.liveAt', { time: time(loadedAt) }, `Live · ${time(loadedAt)}`) : tr('cc.loadingLive', {}, 'Loading live data…'); }
    const list = priorities(), canAi = allowedViews().has('assistant');
    // Skip identical repaints: rebuilding changes the DOM, the section script then re-announces the section, which
    // repainted again - about 20 rebuilds a second while the Action Centre was open (E-037).
    const sig = JSON.stringify([window.OprunLocale?.locale, failed, loadedAt, canAi, list]);
    if (box.dataset.ccSig === sig) return; box.dataset.ccSig = sig;
    const items = list.length ? el('ol', { class: 'cc-priority-list' }, list.map((p, n) => el('li', { class: 'cc-priority cc-' + p.level },
      el('span', { class: 'cc-rank', 'aria-hidden': 'true', text: String(n + 1) }),
      el('span', { class: 'cc-priority-text' }, el('b', { text: p.title }), el('small', { text: p.detail }), p.protectedAction ? el('span', { class: 'cc-tag', text: tr('cc.needsApproval', {}, 'Needs your approval') }) : null),
      el('a', { class: 'secondary-button compact', href: '#' + nav().pathFor(p.view), text: p.protectedAction ? tr('cc.review', {}, 'Review') : tr('cc.open', {}, 'Open') }))))
      : el('p', { class: 'cc-clear', text: data ? tr('cc.clear', {}, 'Nothing urgent right now. Your queues are clear.') : failed ? tr('cc.loadFailed', {}, 'Live figures could not be loaded. Try Refresh.') : tr('cc.loadingPriorities', {}, 'Loading live priorities…') });
    const tools = el('div', { class: 'cc-brief-tools' },
      el('button', { type: 'button', class: 'secondary-button compact', 'data-cc-refresh': '', text: tr('cc.refresh', {}, 'Refresh') }),
      canAi ? el('button', { type: 'button', class: 'primary-button compact', 'data-cc-plan': '', text: tr('cc.plan', {}, 'Generate AI plan') }) : null,
      el('span', { class: 'cc-note', text: tr('cc.planNote', {}, 'AI recommends; sending, publishing and payments always wait for approval.') }));
    const keepPlan = box.querySelector('.cc-plan');
    box.replaceChildren(items, tools, ...(keepPlan ? [keepPlan] : []));
  }
  // The AI plan is requested in English (the model's prompt) but answered in the reader's language when it is not English.
  const answerIn = () => { const l = window.OprunLocale?.locale || 'en'; if (/^en\b/.test(l)) return ''; let name = l; try { name = new Intl.DisplayNames(['en'], { type: 'language' }).of(l); } catch {} return ` Answer in ${name}.`; };
  async function plan(button) {
    const box = $('#priorities .cc-brief'); let out = box.querySelector('.cc-plan');
    if (!out) { out = el('div', { class: 'cc-plan', role: 'status', 'aria-live': 'polite' }); box.append(out); }
    button.disabled = true; out.dataset.state = 'busy'; out.textContent = tr('cc.planBusy', {}, 'Preparing your plan from live figures…');
    const list = priorities().map(p => `- ${p.title}: ${p.detail}`).join('\n') || '- No urgent items.';
    try {
      const r = await fetch('/api/saas/ai/threads', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Daily priorities plan', message: `Using only these live workspace figures, give me a short prioritised plan for today (max 5 steps). Mark any step that needs my approval.${answerIn()}\n${list}` }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ai_response) throw new Error(d.error || tr('cc.aiUnavailable', {}, 'AI is not available right now.'));
      out.dataset.state = 'done'; out.replaceChildren(el('b', { text: tr('cc.planTitle', {}, 'AI plan') }), el('p', { text: d.ai_response }), el('small', { text: tr('cc.planSaved', {}, 'Saved to AI Operations. Review before acting.') }));
    } catch (err) { out.dataset.state = 'error'; out.textContent = tr('cc.planError', { error: err.message }, err.message + ' Your live priorities above are still accurate.'); }
    finally { button.disabled = false; }
  }
  view.addEventListener('click', e => { const r = e.target.closest('[data-cc-refresh]'), p = e.target.closest('[data-cc-plan]'); if (r) refresh(true); if (p) plan(p); });


  // ---------- Workflow Guidance: core workflow ----------
  // Each stage reads one real figure; null means this role cannot see it or it did not load, and is shown as such.
  const STAGES = [
    { key: 'enquiry', name: 'Enquiry', icon: 'i-bell', view: 'enquiries', count: () => stage('enquiries'), unit: ['new enquiry', 'new enquiries'],
      what: 'A request for work arrives from a call, email, form, social message or the AI receptionist.', needs: 'A customer and what they want.', next: 'Qualify it and turn it into a quote.' },
    { key: 'quotation', name: 'Quotation', icon: 'i-doc', view: 'quotes', count: () => stage('quotes'), unit: ['quote waiting', 'quotes waiting'],
      what: 'Price the work. Quotes are approved by you before the customer sees them.', needs: 'An enquiry and your services and prices.', next: 'When the customer accepts, it becomes a booking.' },
    { key: 'booking', name: 'Booking', icon: 'i-clock', view: 'bookings', count: () => stage('bookings'), unit: ['booking awaiting workers', 'bookings awaiting workers'],
      what: 'The accepted quote is booked with a date and creates a job.', needs: 'An accepted quote.', next: 'Allocate workers to the job.' },
    { key: 'allocation', name: 'Allocation', icon: 'i-users', view: 'jobs', count: () => data?.jobs ? data.jobs.awaiting ?? null : null, unit: ['job to allocate', 'jobs to allocate'],
      what: 'Offer the job to workers who have the right skills and current compliance.', needs: 'A booked job and ready workers.', next: 'Workers accept and the job goes ahead.' },
    { key: 'execution', name: 'Execution', icon: 'i-briefcase', view: 'jobs', count: () => stage('allocated'), unit: ['job in progress', 'jobs in progress'],
      what: 'The team does the work and records notes, photos and time against the job.', needs: 'Allocated workers.', next: 'Mark the job complete.' },
    { key: 'completion', name: 'Completion', icon: 'i-check', view: 'bookings', count: () => stage('to_invoice'), unit: ['completed job to invoice', 'completed jobs to invoice'],
      what: 'The job is finished with its evidence, ready to bill.', needs: 'A job in progress.', next: 'Create the invoice.' },
    { key: 'invoice', name: 'Invoice', icon: 'i-doc', view: 'businessinvoices', count: () => stage('unpaid'), unit: ['invoice unpaid', 'invoices unpaid'],
      what: 'Approve and issue the invoice from the completed job.', needs: 'A completed job.', next: 'Collect payment.' },
    { key: 'payment', name: 'Payment', icon: 'i-shield', view: 'businessinvoices', count: () => stage('paid'), unit: ['invoice paid', 'invoices paid'], done: true,
      what: 'Payments land against each invoice and close the job.', needs: 'An issued invoice.', next: 'The job is closed and profit is recorded.' }
  ];
  let openStage = null;
  function paintWorkflow() {
    const host = $('[data-cc-workflow]'); if (!host) return;
    const allowed = allowedViews(), canAi = allowed.has('assistant');
    // Skip identical repaints: other modules react to DOM changes, so an unchanged repaint could loop.
    const sig = JSON.stringify([window.OprunLocale?.locale, failed, loadedAt, openStage, [...allowed].length, data || pipeline ? STAGES.map(s => s.count()) : null]);
    if (sig === host.dataset.wgSig) return; host.dataset.wgSig = sig;
    const pill = $('[data-wg-status]');
    if (pill) { pill.className = 'status-pill ' + (failed ? 'warn' : data ? 'good' : 'neutral'); pill.textContent = failed ? tr('cc.unavailable', {}, 'Live data unavailable') : data ? tr('cc.liveAt', { time: time(loadedAt) }, `Live · ${time(loadedAt)}`) : tr('cc.loadingLive', {}, 'Loading live data…'); }
    const rows = STAGES.map((s, i) => {
      const n = data || pipeline ? s.count() : undefined, can = allowed.has(s.view);
      const st = n === undefined ? [tr('wg.loading', {}, 'Loading…'), 'wait'] : n === null ? [tr('wg.noRole', {}, 'Not available for your role'), 'none'] : n === 0 ? [s.done ? tr('wg.noneYet', {}, 'None yet') : tr('wg.clear', {}, 'Clear'), 'ok'] : [unit(s, n), s.done ? 'ok' : 'warn'];
      const id = 'wg-' + s.key, isOpen = openStage === s.key;
      return el('li', { class: 'wg-stage wg-' + st[1] + (isOpen ? ' is-open' : ''), 'data-wg-stage': s.key },
        el('button', { type: 'button', class: 'wg-step', 'aria-expanded': String(isOpen), 'aria-controls': id, 'data-wg-toggle': s.key },
          el('span', { class: 'wg-num', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0') }),
          el('span', { class: 'wg-icon' }, icon(s.icon)),
          el('span', { class: 'wg-name' }, el('b', { text: sx(s, 'name') }), el('small', { class: 'wg-chip', text: st[0] }))),
        el('div', { class: 'wg-detail', id, hidden: !isOpen },
          el('p', { text: sx(s, 'what') }),
          el('dl', {}, el('dt', { text: tr('wg.needs', {}, 'Needs') }), el('dd', { text: sx(s, 'needs') }), el('dt', { text: tr('wg.then', {}, 'Then') }), el('dd', { text: sx(s, 'next') })),
          el('div', { class: 'wg-actions' },
            can ? el('a', { class: 'primary-button compact', href: '#' + nav().pathFor(s.view), text: tr('wg.open', { page: nav().pageMeta?.[s.view]?.[1] || sx(s, 'name') }, `Open ${nav().pageMeta?.[s.view]?.[1] || s.name}`) }) : el('small', { class: 'setup-locked', text: tr('wg.locked', {}, 'Your role cannot open this stage. Ask your business owner.') }),
            canAi ? el('button', { type: 'button', class: 'secondary-button compact', 'data-wg-ask': s.key, text: tr('wg.ask', {}, 'Ask AI about this step') }) : null)));
    });
    const known = STAGES.map(s => (data || pipeline ? s.count() : null)).filter(n => n != null);
    const active = STAGES.filter(s => { const n = data || pipeline ? s.count() : null; return n && !s.done; }).length;
    host.replaceChildren(
      el('p', { class: 'wg-summary', text: !data && !pipeline ? (failed ? tr('wg.loadFailed', {}, 'Live figures could not be loaded. Use Refresh in the Action Centre or reload.') : tr('wg.loadingFigures', {}, 'Loading live workflow figures…')) : known.length ? (active ? tr('wg.attention', { n: active }, `${plural(active, 'stage')} need attention. Select a stage to see what it needs and open it.`) : tr('wg.nothing', {}, 'Nothing is waiting at any stage you can see.')) : tr('wg.noFigures', {}, 'Your role cannot see pipeline figures. Select a stage to learn how it works.') }),
      el('ol', { class: 'wg-list' }, rows));
  }
  view.addEventListener('click', e => {
    const t = e.target.closest('[data-wg-toggle]'), a = e.target.closest('[data-wg-ask]');
    if (t) { openStage = openStage === t.dataset.wgToggle ? null : t.dataset.wgToggle; paintWorkflow(); view.querySelector(`[data-wg-toggle="${openStage || t.dataset.wgToggle}"]`)?.focus(); }
    if (a) { const s = STAGES.find(x => x.key === a.dataset.wgAsk), n = s?.count(); window.dispatchEvent(new CustomEvent('superpro:ask', { detail: { question: `Help me with the ${s.name} step of my workflow${n != null ? ` (live figure: ${plural(n, s.unit[0], s.unit[1])})` : ''}. What should I do next?` } })); }
  });
  function paintChecklist() { const h = $('[data-setup-checklist]'); if (h && window.OprunSetupChecklist && section === 'workflow-guidance' && !view.hidden) window.OprunSetupChecklist.render(h); }

  // ---------- section focus: show only the chosen section's content ----------
  let section = 'business-overview', timer;
  function currentSection() { const t = view.querySelector('.context-section-tabs [role=tab][aria-selected=true]'); return t?.dataset.sectionKey || 'business-overview'; }
  // Runs only when the chosen section or the page visibility really changes; other modules re-set aria-selected to the
  // same value whenever content changes, and reacting to those would re-render in a loop.
  let lastKey = '';
  function sync() {
    const k = currentSection() + '|' + view.hidden; if (k === lastKey) return; lastKey = k;
    section = currentSection(); view.dataset.ccSection = section; document.body.dataset.ccSection = view.hidden ? '' : section;
    clearInterval(timer);
    if (!view.hidden && ['your-workspace', 'action-centre', 'workflow-guidance'].includes(section)) { paintChecklist(); refresh(); timer = setInterval(() => { if (!document.hidden) refresh(true); }, 60000); }
  }
  function paint() { paintFeatures(); paintNextSteps(); paintBrief(); paintWorkflow(); }
  new MutationObserver(sync).observe(view, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'hidden'] });
  new MutationObserver(paintNextSteps).observe(document.getElementById('workspace-start') || view, { childList: true });
  for (const ev of ['gds:viewchange', 'superpro:sectionchange', 'superpro:workspace-ready', 'superpro:access-changed', 'superpro:nav-ready']) window.addEventListener(ev, () => { sync(); paint(); });
  // Language change: redraw every section from the figures already loaded, and mark them as written in that language.
  const scope = () => { const l = window.OprunLocale; const lang = l?.translated?.('cc.refresh') ? l.locale : 'en'; for (const n of [$('[data-cc-features]'), $('#priorities .ai-brief-panel'), $('[data-cc-workflow]'), $('#workspace-start')]) if (n) { n.dataset.i18nScope = 'today-sections'; n.lang = lang; } };
  window.addEventListener('oprun:locale-changed', () => { scope(); paint(); });
  scope();
  sync(); paint();
  window.OprunCommandSections = { refresh, priorities, live };
})();
