// Prompt 02 (12 Nov 2026): Command Centre sub-sections "Your Workspace" and "Priorities" (renamed from Attention items).
// - Your Workspace: every page this person may open, grouped like the main navigation, with live counts, a quick
//   filter and an "Ask AI" fallback. Tiles open the real pages, so each one uses its own authorised API.
// - Priorities: "Your next step" (three permitted cards, now with live status) and the AI Operations Brief (live
//   priorities with actions, refresh time, and an on-demand AI plan through the existing AI Operations endpoint).
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
  const time = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

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
        el('span', { class: 'cc-tile-icon' }, icon(i.icon || GROUP_ICON[g.id] || 'i-doc')),
        el('span', { class: 'cc-tile-text' }, el('b', { text: i.label }), el('small', { text: g.label })),
        n ? el('span', { class: 'cc-count', 'aria-label': `${n} waiting`, text: n > 99 ? '99+' : String(n) }) : null);
      return a;
    };
    // The filter box is created once and kept, so typing is never interrupted by a re-render.
    if (!host.querySelector('#cc-feature-filter')) host.replaceChildren(el('div', { class: 'cc-filter' },
      el('label', { class: 'sr-only', for: 'cc-feature-filter', text: 'Find a feature' }),
      el('input', { id: 'cc-feature-filter', type: 'search', placeholder: 'Find a feature…', autocomplete: 'off', enterkeyhint: 'search', 'aria-controls': 'cc-feature-results' })),
      el('div', { id: 'cc-feature-results', 'aria-live': 'polite' }));
    const results = host.querySelector('#cc-feature-results');
    const sections = [];
    let shown = 0;
    for (const { g, items } of groups) {
      const main = items.filter(i => !i.secondary && match(i)), more = items.filter(i => i.secondary && match(i));
      if (!main.length && !more.length) continue; shown += main.length + more.length;
      const block = el('section', { class: 'cc-group', 'aria-label': g.label }, el('h3', {}, icon(GROUP_ICON[g.id] || 'i-grid'), g.label), el('div', { class: 'cc-grid' }, main.map(i => tile(g, i))));
      if (more.length) block.append(q ? el('div', { class: 'cc-grid' }, more.map(i => tile(g, i))) : el('details', { class: 'cc-more' }, el('summary', { text: `More in ${g.label} (${more.length})` }), el('div', { class: 'cc-grid' }, more.map(i => tile(g, i)))));
      sections.push(block);
    }
    const empty = q && !shown ? el('div', { class: 'cc-empty' }, el('p', { text: `No feature matches “${query}”.` }), el('button', { type: 'button', class: 'secondary-button compact', 'data-cc-ask': '' , text: 'Ask AI where to find it' })) : null;
    results.replaceChildren(...(empty ? [empty] : []), ...sections);
  }
  view.addEventListener('input', e => { if (e.target.id === 'cc-feature-filter') { query = e.target.value; paintFeatures(); } });
  view.addEventListener('keydown', e => { if (e.target.id === 'cc-feature-filter' && e.key === 'Enter') { e.preventDefault(); const first = $('[data-cc-features] .cc-tile'); if (first && query) first.click(); else if (query) askWhere(); } if (e.target.id === 'cc-feature-filter' && e.key === 'Escape') { query = ''; e.target.value = ''; paintFeatures(); } });
  const askWhere = () => window.dispatchEvent(new CustomEvent('superpro:ask', { detail: { question: `Where in Oprun can I ${query.trim()}?` } }));
  view.addEventListener('click', e => { if (e.target.closest('[data-cc-ask]')) askWhere(); });

  // ---------- Priorities: Your next step ----------
  function paintNextSteps() {
    const start = $('#workspace-start'); if (!start) return;
    const c = live(), j = data?.jobs;
    const status = {
      enquiries: c.enquiries == null ? null : c.enquiries ? [plural(c.enquiries, 'new enquiry', 'new enquiries'), 'warn'] : ['No new enquiries', 'ok'],
      jobs: !j ? null : (j.today || j.awaiting) ? [`${plural(j.today, 'job')} today · ${j.awaiting} to allocate`, j.awaiting ? 'warn' : 'info'] : ['Nothing scheduled today', 'ok'],
      unifiedinbox: c.unifiedinbox == null ? null : c.unifiedinbox ? [plural(c.unifiedinbox, 'conversation') + ' need a reply', 'warn'] : ['All conversations answered', 'ok'],
      onboarding: null
    };
    start.querySelectorAll('.workspace-start-link').forEach(a => {
      const v = nav()?.resolve?.(a.getAttribute('href'), session()?.user?.role) || '';
      a.querySelector('.cc-step-status')?.remove();
      const st = status[v]; if (st) a.append(el('span', { class: 'cc-step-status cc-' + st[1], text: st[0] }));
      a.dataset.ccView = v;
    });
  }

  // ---------- Priorities: AI Operations Brief ----------
  function priorities() {
    if (!data) return [];
    const allowed = allowedViews(), out = [];
    const add = (view, level, title, detail, protectedAction) => { if (allowed.has(view)) out.push({ view, level, title, detail, protectedAction }); };
    const c = live();
    if (data.approvals?.pending) add('approvals', 'high', `${plural(data.approvals.pending, 'approval')} waiting for you`, 'Quotes, replies or publishing are on hold until you decide.', true);
    if (data.inbox?.needs_reply) add('unifiedinbox', 'high', `${plural(data.inbox.needs_reply, 'customer')} waiting for a reply`, data.inbox.drafts_waiting ? `${data.inbox.drafts_waiting} AI drafts are ready to review.` : 'Reply from the Unified Inbox; AI can draft for your approval.', Boolean(data.inbox.drafts_waiting));
    if (c.enquiries) add('enquiries', 'medium', `${plural(c.enquiries, 'new enquiry', 'new enquiries')} to qualify`, 'Turn them into quotes before they go cold.', false);
    if (data.jobs?.awaiting) add('jobs', 'medium', `${plural(data.jobs.awaiting, 'job')} awaiting allocation`, data.team?.ready ? `${data.team.ready} workers are ready to schedule.` : 'No workers are ready to schedule yet.', false);
    if (data.team?.attention || data.team?.expiring) add('workforce', data.team.expiring ? 'medium' : 'low', `${plural(data.team.attention, 'worker')} need compliance checks`, data.team.expiring ? `${plural(data.team.expiring, 'document')} expire within 30 days.` : 'Review documents before scheduling.', false);
    if (data.finance && data.finance.profit_cents < 0) add('finance', 'high', 'This month is running at a loss', 'Costs are above income so far this month.', false);
    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 6);
  }
  function paintBrief() {
    const panel = $('#priorities .ai-brief-panel'); if (!panel) return;
    let box = panel.querySelector('.cc-brief'); if (!box) { box = el('div', { class: 'cc-brief' }); panel.querySelector('.briefing-box')?.after(box); }
    const pill = panel.querySelector('.panel-head .status-pill');
    if (pill) { pill.className = 'status-pill ' + (failed ? 'warn' : data ? 'good' : 'neutral'); pill.textContent = failed ? 'Live data unavailable' : data ? `Live · ${time(loadedAt)}` : 'Loading live data…'; }
    const list = priorities();
    const items = list.length ? el('ol', { class: 'cc-priority-list' }, list.map((p, n) => el('li', { class: 'cc-priority cc-' + p.level },
      el('span', { class: 'cc-rank', 'aria-hidden': 'true', text: String(n + 1) }),
      el('span', { class: 'cc-priority-text' }, el('b', { text: p.title }), el('small', { text: p.detail }), p.protectedAction ? el('span', { class: 'cc-tag', text: 'Needs your approval' }) : null),
      el('a', { class: 'secondary-button compact', href: '#' + nav().pathFor(p.view), text: p.protectedAction ? 'Review' : 'Open' }))))
      : el('p', { class: 'cc-clear', text: data ? 'Nothing urgent right now. Your queues are clear.' : failed ? 'Live figures could not be loaded. Try Refresh.' : 'Loading live priorities…' });
    const canAi = allowedViews().has('assistant');
    const tools = el('div', { class: 'cc-brief-tools' },
      el('button', { type: 'button', class: 'secondary-button compact', 'data-cc-refresh': '', text: 'Refresh' }),
      canAi ? el('button', { type: 'button', class: 'primary-button compact', 'data-cc-plan': '', text: 'Generate AI plan' }) : null,
      el('span', { class: 'cc-note', text: 'AI recommends; sending, publishing and payments always wait for approval.' }));
    const keepPlan = box.querySelector('.cc-plan');
    box.replaceChildren(items, tools, ...(keepPlan ? [keepPlan] : []));
  }
  async function plan(button) {
    const box = $('#priorities .cc-brief'); let out = box.querySelector('.cc-plan');
    if (!out) { out = el('div', { class: 'cc-plan', role: 'status', 'aria-live': 'polite' }); box.append(out); }
    button.disabled = true; out.dataset.state = 'busy'; out.textContent = 'Preparing your plan from live figures…';
    const list = priorities().map(p => `- ${p.title}: ${p.detail}`).join('\n') || '- No urgent items.';
    try {
      const r = await fetch('/api/saas/ai/threads', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Daily priorities plan', message: `Using only these live workspace figures, give me a short prioritised plan for today (max 5 steps). Mark any step that needs my approval.\n${list}` }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ai_response) throw new Error(d.error || 'AI is not available right now.');
      out.dataset.state = 'done'; out.replaceChildren(el('b', { text: 'AI plan' }), el('p', { text: d.ai_response }), el('small', { text: 'Saved to AI Operations. Review before acting.' }));
    } catch (err) { out.dataset.state = 'error'; out.textContent = err.message + ' Your live priorities above are still accurate.'; }
    finally { button.disabled = false; }
  }
  view.addEventListener('click', e => { const r = e.target.closest('[data-cc-refresh]'), p = e.target.closest('[data-cc-plan]'); if (r) refresh(true); if (p) plan(p); });

  // ---------- section focus: show only the chosen section's content ----------
  let section = 'business-overview', timer;
  function currentSection() { const t = view.querySelector('.context-section-tabs [role=tab][aria-selected=true]'); return t?.dataset.sectionKey || 'business-overview'; }
  function sync() {
    section = currentSection(); view.dataset.ccSection = section; document.body.dataset.ccSection = view.hidden ? '' : section;
    clearInterval(timer);
    if (!view.hidden && (section === 'your-workspace' || section === 'priorities')) { refresh(); timer = setInterval(() => { if (!document.hidden) refresh(true); }, 60000); }
  }
  function paint() { paintFeatures(); paintNextSteps(); paintBrief(); }
  new MutationObserver(sync).observe(view, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'hidden'] });
  new MutationObserver(paintNextSteps).observe(document.getElementById('workspace-start') || view, { childList: true });
  for (const ev of ['gds:viewchange', 'superpro:sectionchange', 'superpro:workspace-ready', 'superpro:access-changed', 'superpro:nav-ready']) window.addEventListener(ev, () => { sync(); paint(); });
  sync(); paint();
  window.OprunCommandSections = { refresh, priorities, live };
})();
