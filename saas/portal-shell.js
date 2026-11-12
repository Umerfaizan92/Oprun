(() => {
  let shell, rail, active = 'dashboard', contextKey = '';
  const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  function breadcrumb(view, section = '') {
    const g = window.SuperProNav?.DOMAINS.find(d => d.items.some(i => i.view === view)), p = g?.items.find(i => i.view === view); if (!p) return;
    let b = document.getElementById('workspace-breadcrumb'); if (!b) { b = make('nav', 'navigation-breadcrumb'); b.id = 'workspace-breadcrumb'; b.setAttribute('aria-label', 'Breadcrumb'); document.querySelector('.page-context')?.prepend(b); }
    b.replaceChildren(make('span', '', g.label));
    const shortTitles = {onboarding:'Business settings',workforce:'Workforce',team:'Staff & access',integrations:'Connections',billing:'Plans & usage',fincompliance:'Finance settings',governance:'Security & trust'};
    const title = document.getElementById('page-title'); if (title) title.textContent = shortTitles[view] || p.label;
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
    // The top-bar "Ask or search workspace" button is the single finder; the older sticky duplicate is removed.
    document.getElementById('workspace-command')?.remove();
  }
  function rebuild() {
    const nav = window.SuperProNav, session = window.GDS_SESSION; if (!nav || !session || !window.SuperProNavigation) return;
    if (!rail) {
      document.body.classList.add('portal-workspace'); rail = make('aside', 'portal-rail'); rail.id = 'business-navigation'; rail.setAttribute('aria-label', 'Business navigation');
      const brand = make('a', 'portal-brand workspace-platform-brand'); brand.href = '#today/home'; brand.append((() => { const m = make('span', 'portal-mark'), i = document.createElement('img'); i.src = '/saas/oprun-icon.svg?v=20261031'; i.alt = ''; i.width = i.height = 48; i.style.cssText = 'display:block;width:100%;height:100%;border-radius:inherit'; m.append(i); return m; })(), make('span', 'platform-name', 'Oprun'));
      const toggle = make('button', 'business-navigation-close'); toggle.type = 'button'; toggle.append(make('span', '', '×'), make('span', 'sr-only', 'Close navigation')); toggle.firstElementChild.setAttribute('aria-hidden','true');
      const context = document.getElementById('workspace-context'); if (context) {context.append(toggle);rail.append(context);} else rail.append(toggle);
      rail.append(make('nav')); document.getElementById('workspace').append(rail);
      const security = document.querySelector('#sidebar .sidebar-footer'); if (security) rail.append(security);
      shell = new window.SuperProNavigation.Navigation({ rail, toggle, triggerHost: document.querySelector('.topbar-left'), key: 'sp-nav:business:pending', background: [document.querySelector('.app-main')], autoHide:true });
      installFooter(brand);
      const out = document.getElementById('logout'), foot = rail.querySelector('.sidebar-footer') || rail.appendChild(make('div', 'sidebar-footer'));
      if (out) { out.classList.remove('text-button'); out.classList.add('rail-signout'); out.setAttribute('aria-label', 'Sign out of Oprun'); foot.append(out); }
      const syncIdentity = () => {
        const name = document.getElementById('org-name-side')?.textContent?.trim() || 'Workspace';
        const avatar = document.getElementById('org-avatar-side');
        const mark = avatar ? avatar.cloneNode(true) : make('span','','◎');
        mark.removeAttribute('id'); mark.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));mark.classList.add('navigation-identity-logo');
        shell.trigger.classList.add('navigation-business-trigger');
        shell.trigger.replaceChildren(mark,make('span','navigation-identity-name',name),make('span','navigation-identity-chevron','⌄'));
        shell.trigger.title = name + ' · Open business navigation';
      };
      if (context) new MutationObserver(syncIdentity).observe(context,{childList:true,subtree:true,characterData:true,attributes:true});
      syncIdentity();
      const header = document.querySelector('.app-topbar');
      if (header && window.ResizeObserver) new ResizeObserver(() => document.body.style.setProperty('--navigation-header-height', Math.ceil(header.getBoundingClientRect().height) + 'px')).observe(header);
      new MutationObserver(syncBadges).observe(document.querySelector('.workspace-nav'), { childList: true, subtree: true, characterData: true });
    }
    const key = `sp-nav:business:${session.user.id || session.user.email}:${session.organisation.id}`;
    if (contextKey !== key) { contextKey = key; shell.key = key; let compact = false; try { compact = localStorage.getItem(key) === 'collapsed'; } catch {} shell.setCollapsed(compact); }
    const allowed = new Set(nav.sequence(session.user.role));
    shell.setGroups(nav.DOMAINS.map(d => ({ id: d.id, label: d.label, attribute: 'data-domain', icon: () => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), use = document.createElementNS(svg.namespaceURI, 'use'); use.setAttribute('href', '#' + d.icon); svg.append(use); return svg; }, pages: d.items.filter(i => allowed.has(i.view)).map(i => ({ id: i.view, path: i.path, label: i.label, badge: i.badge, secondary: i.secondary })) })).filter(d => d.pages.length));
    shell.setActive(active); syncBadges(); breadcrumb(active); workflowContext(active); bottomNav(allowed);
  }
  // Compact footer: Oprun mark and name with organised policy links (replaces the top-bar logo and the long trust block).
  function installFooter(brand) {
    const footer = document.querySelector('.app-footer'); if (!footer || footer.dataset.compact) return;
    footer.dataset.compact = 'true'; footer.setAttribute('aria-label', 'Oprun and policies');
    brand.classList.add('footer-brand'); brand.querySelector('.platform-name')?.after(make('small', 'footer-tagline', 'Run your world.'));
    const status = document.getElementById('subscription-footer') || make('span'); status.classList.add('footer-status');
    const links = make('nav', 'footer-policies'); links.setAttribute('aria-label', 'Policies');
    for (const [href, label] of [['/saas/terms.html','Terms'],['/saas/privacy.html','Privacy'],['/saas/policy-center.html','Policy centre'],['/saas/trust-center.html','Trust centre'],['/saas/subprocessors.html','Connected services'],['/saas/complaints.html','Complaints']]) {
      const a = make('a', '', label); a.href = href; a.target = '_blank'; a.rel = 'noopener'; links.append(a);
    }
    const legal = make('small', 'footer-legal', '© 2026 Oprun · AI-assisted software · human review is required for consequential decisions.');
    footer.replaceChildren(brand, links, legal, status);
  }
  // Phone bottom bar: icon shortcuts to the main areas this person may open, plus Menu for everything else.
  const BOTTOM = [['today','Today','i-grid'],['work','Work','i-briefcase'],['communications','Inbox','i-bell'],['money','Money','i-doc'],['people','People','i-users']];
  let bottom;
  function bottomNav(allowed) {
    const nav = window.SuperProNav; if (!nav) return;
    if (!bottom) {
      bottom = make('nav', 'mobile-bottom-nav'); bottom.id = 'mobile-bottom-nav'; bottom.setAttribute('aria-label', 'Main sections');
      document.getElementById('workspace')?.append(bottom);
      bottom.addEventListener('click', e => { if (!e.target.closest('[data-bottom-menu]')) return; e.stopPropagation(); shell?.setDrawer(true); }); // stop the outside-click handler from closing it again
    }
    const icon = id => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), use = document.createElementNS(svg.namespaceURI, 'use'); use.setAttribute('href', '#' + id); svg.setAttribute('aria-hidden', 'true'); svg.append(use); return svg; };
    const items = BOTTOM.map(([group, label, ic]) => { const g = nav.DOMAINS.find(d => d.id === group), page = g?.items.find(i => !i.secondary && allowed.has(i.view)); return page && { group, label, ic, page }; }).filter(Boolean).slice(0, 4);
    const links = items.map(({ group, label, ic, page }) => { const a = make('a'); a.href = '#' + page.path; a.dataset.bottomGroup = group; a.append(icon(ic), make('span', '', label)); return a; });
    const menu = make('button'); menu.type = 'button'; menu.dataset.bottomMenu = ''; menu.setAttribute('aria-controls', 'business-navigation'); menu.append(icon('i-menu'), make('span', '', 'Menu'));
    bottom.replaceChildren(...links, menu); markBottom();
  }
  function markBottom() {
    const g = window.SuperProNav?.DOMAINS.find(d => d.items.some(i => i.view === active))?.id;
    bottom?.querySelectorAll('a').forEach(a => { if (a.dataset.bottomGroup === g) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  function syncBadges() { rail?.querySelectorAll('[data-badge-source]').forEach(e => { const text = document.getElementById(e.dataset.badgeSource)?.textContent || ''; if (e.textContent !== text) e.textContent = text; }); }
  window.addEventListener('superpro:nav-ready', rebuild); window.addEventListener('superpro:access-changed', rebuild);
  window.addEventListener('gds:viewchange', e => { active = e.detail.view; shell?.setActive(active); breadcrumb(active); workflowContext(active); markBottom(); });
  window.addEventListener('superpro:sectionchange', e => breadcrumb(active, e.detail.label));
  fetch('/api/public/preview-status').then(r => r.json()).then(d => { if (d.isolated_preview) { document.body.dataset.isolatedPreview = 'true'; document.body.prepend(make('div', 'portal-preview-banner', 'Isolated preview · Synthetic test data only · Data may reset on restart.')); } }).catch(() => {});
})();
