(() => {
  let shell, rail, active = 'dashboard', contextKey = '';
  const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  function breadcrumb(view, section = '') {
    const g = window.SuperProNav?.DOMAINS.find(d => d.items.some(i => i.view === view)), p = g?.items.find(i => i.view === view); if (!p) return;
    let b = document.getElementById('workspace-breadcrumb'); if (!b) { b = make('nav', 'navigation-breadcrumb'); b.id = 'workspace-breadcrumb'; b.setAttribute('aria-label', 'Breadcrumb'); document.querySelector('.page-context')?.prepend(b); }
    b.replaceChildren(make('span', '', g.label), make('span', 'navigation-divider', '/'), make('span', '', p.label));
    if (section) b.append(make('span', 'navigation-divider', '/'), make('span', '', section));
  }
  function workflowContext(view) {
    const nav = window.SuperProNav, session = window.GDS_SESSION;
    if (!nav || !session) return;
    let host = document.getElementById('workspace-workflows');
    if (!host) {
      host = make('div', 'workspace-workflows'); host.id = 'workspace-workflows';
      document.querySelector('.content-wrap')?.prepend(host);
      host.addEventListener('click', e => {
        if (e.target.closest('a') && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !window.SuperProNavigation.canLeave()) e.preventDefault();
      });
    }
    host.replaceChildren();
    for (const flow of nav.contexts(view, session.user.role)) {
      if (flow.items.length < 2) continue;
      const row = make('nav', 'workflow-links'); row.setAttribute('aria-label', flow.label);
      row.append(make('span', 'workflow-label', flow.label));
      for (const item of flow.items) {
        const link = make('a', '', item.label); link.href = '#' + item.path;
        if (item.view === view) link.setAttribute('aria-current', 'page');
        row.append(link);
      }
      host.append(row);
    }
    const start = document.getElementById('workspace-start');
    if (start) {
      const allowed = new Set(nav.sequence(session.user.role)); start.replaceChildren();
      const title = make('div'); title.append(make('p','kicker','YOUR NEXT STEP'),make('h2','','Start with the work that matters'));
      start.append(title);
      const steps = [['enquiries','Capture an enquiry','Start the customer-to-invoice workflow.'],['jobs','Open your jobs','Review allocated work and record progress.'],['unifiedinbox','Review conversations','Read customer conversations available to your account.'],['onboarding','Complete business setup','Review your business details and approval controls.']];
      const primary = steps.filter(([view]) => allowed.has(view)).slice(0, 3);
      for (const [target,label,detail] of primary) {
        const link = make('a','workspace-start-link'); link.href = '#' + nav.pathFor(target);
        link.append(make('strong','',label),make('span','',detail)); start.append(link);
      }
      start.hidden = !primary.length;
    }
    let command = document.getElementById('workspace-command');
    if (!command) {
      command = make('aside','workspace-command'); command.id = 'workspace-command'; command.setAttribute('aria-label','Workspace command');
      const search = make('button','','Ask or find a workspace feature'); search.type = 'button';
      search.addEventListener('click', () => document.querySelector('.search-button')?.click());
      command.append(search,make('span','','Suggestions need review. External actions require approval.'));
      document.querySelector('.app-main')?.append(command);
    }
  }
  function rebuild() {
    const nav = window.SuperProNav, session = window.GDS_SESSION; if (!nav || !session || !window.SuperProNavigation) return;
    if (!rail) {
      document.body.classList.add('portal-workspace'); rail = make('aside', 'portal-rail'); rail.id = 'business-navigation'; rail.setAttribute('aria-label', 'Business navigation');
      const brand = make('a', 'portal-brand'); brand.href = '#b01/home'; brand.append((() => { const m = make('span', 'portal-mark'), i = document.createElement('img'); i.src = '/saas/oprun-icon.svg?v=20261031'; i.alt = ''; i.width = i.height = 40; i.style.cssText = 'display:block;width:100%;height:100%;border-radius:inherit'; m.append(i); return m; })(), make('span', 'navigation-label', 'Oprun'));
      const toggle = make('button', 'portal-main-button'); toggle.type = 'button'; toggle.append(make('span', 'portal-icon', '☰'), make('span', 'navigation-label', 'Collapse navigation')); rail.append(brand, toggle);
      const context = document.getElementById('workspace-context'); if (context) rail.append(context);
      rail.append(make('nav')); document.getElementById('workspace').append(rail);
      const security = document.querySelector('#sidebar .sidebar-footer'); if (security) rail.append(security);
      shell = new window.SuperProNavigation.Navigation({ rail, toggle, triggerHost: document.querySelector('.topbar-left'), key: 'sp-nav:business:pending', background: [document.querySelector('.app-main')] });
      new MutationObserver(syncBadges).observe(document.querySelector('.workspace-nav'), { childList: true, subtree: true, characterData: true });
    }
    const key = `sp-nav:business:${session.user.id || session.user.email}:${session.organisation.id}`;
    if (contextKey !== key) { contextKey = key; shell.key = key; let compact = false; try { compact = localStorage.getItem(key) === 'collapsed'; } catch {} shell.setCollapsed(compact); }
    const allowed = new Set(nav.sequence(session.user.role));
    shell.setGroups(nav.DOMAINS.map(d => ({ id: d.id, label: d.label, attribute: 'data-domain', icon: () => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), use = document.createElementNS(svg.namespaceURI, 'use'); use.setAttribute('href', '#' + d.icon); svg.append(use); return svg; }, pages: d.items.filter(i => allowed.has(i.view)).map(i => ({ id: i.view, path: i.path, label: i.label, badge: i.badge, secondary: i.secondary })) })).filter(d => d.pages.length));
    shell.setActive(active); syncBadges(); breadcrumb(active); workflowContext(active);
  }
  function syncBadges() { rail?.querySelectorAll('[data-badge-source]').forEach(e => { const text = document.getElementById(e.dataset.badgeSource)?.textContent || ''; if (e.textContent !== text) e.textContent = text; }); }
  window.addEventListener('superpro:nav-ready', rebuild); window.addEventListener('superpro:access-changed', rebuild);
  window.addEventListener('gds:viewchange', e => { active = e.detail.view; shell?.setActive(active); breadcrumb(active); workflowContext(active); });
  window.addEventListener('superpro:sectionchange', e => breadcrumb(active, e.detail.label));
  fetch('/api/public/preview-status').then(r => r.json()).then(d => { if (d.isolated_preview) { document.body.dataset.isolatedPreview = 'true'; document.body.prepend(make('div', 'portal-preview-banner', 'Isolated preview · Synthetic test data only · Data may reset on restart.')); } }).catch(() => {});
})();
