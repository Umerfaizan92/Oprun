/* Mobile presentation only: invoke the real permission-filtered controls and keep forms in place. */
(() => {
  const media = matchMedia('(max-width: 760px)');
  const make = (tag, cls, text) => {
    const node = document.createElement(tag); node.className = cls || '';
    if (text) node.textContent = text;
    return node;
  };
  const icon = (name) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(svg.namespaceURI, 'use');
    use.setAttribute('href', '#' + name); svg.append(use); return svg;
  };
  const sectionIcon = label => /overview|dashboard|summary/i.test(label) ? 'i-grid'
    : /attention|alert|notification/i.test(label) ? 'i-bell'
    : /readiness|ready|check/i.test(label) ? 'i-check'
    : /workflow|guide|next|step/i.test(label) ? 'i-arrow'
    : /calendar|schedule|history|activity|queue/i.test(label) ? 'i-clock'
    : /security|trust|approval|compliance|rule/i.test(label) ? 'i-shield'
    : /people|staff|team|customer|contact|applicant/i.test(label) ? 'i-users'
    : /inbox|message|call|email|reply/i.test(label) ? 'i-bell'
    : /setting|appearance|profile|brand|business/i.test(label) ? 'i-building'
    : /ai|suggest|readiness/i.test(label) ? 'i-spark' : 'i-doc';
  let dock, menu, sections, actions, frame, signature = '', resize;
  const watched = new WeakSet();
  const badges = new MutationObserver(() => queue());
  const watch = node => { if (node && !watched.has(node)) { watched.add(node); badges.observe(node, {childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','class','aria-label','data-drawer']}); } };
  const badgeValue = node => node && !node.hidden ? node.textContent.trim() : '';
  const addBadge = (control, count) => { if (!count || count === '0') return; control.append(make('small','mobile-workspace-badge',count)); control.setAttribute('aria-label', control.getAttribute('aria-label') + ', ' + count + ' unread'); };
  // Ignore our own mobile-only hiding of the source list; honour all its parent panels and native states.
  const availableList = list => {
    for (let node = list; node && !node.matches('.view'); node = node.parentElement) {
      if (node.hidden || node.classList.contains('focus-inactive')) return false;
      if (node !== list && getComputedStyle(node).display === 'none') return false;
    }
    return !list.hidden;
  };
  function control(label, symbol, action, current, key) {
    const b = make('button', 'mobile-workspace-item'); b.type = 'button'; b.dataset.dockKey = key;
    b.title = label; b.setAttribute('aria-label', label);
    const plate = make('span', 'mobile-workspace-icon'); plate.append(icon(symbol));
    b.append(plate, make('span', 'mobile-workspace-label', label));
    if (current) b.setAttribute('aria-current', current);
    b.addEventListener('click', action); return b;
  }
  function refresh() {
    frame = null;
    const workspace = document.getElementById('workspace'), nav = window.SuperProNav, session = window.GDS_SESSION;
    if (!workspace || workspace.hidden || !nav || !session || !document.body.classList.contains('portal-workspace')) {
      if (dock) dock.hidden = true; return;
    }
    const root = workspace.querySelector('.view:not([hidden])'); if (!root) return;
    const view = root.id.replace(/-view$/, '');
    if (!nav.sequence(session.user.role).includes(view)) { if (dock) dock.hidden = true; return; }
    if (!dock) {
      dock = make('nav', 'mobile-workspace-dock'); dock.id = 'mobile-workspace-dock'; dock.setAttribute('aria-label', 'Menu and current page sub-sections');
      menu = control('Menu', 'i-menu', event => { event.stopPropagation(); document.querySelector('.navigation-business-trigger')?.click(); }, null, 'menu');
      menu.classList.add('mobile-workspace-menu'); menu.setAttribute('aria-controls','business-navigation'); menu.setAttribute('aria-haspopup','dialog');
      sections = make('div', 'mobile-workspace-sections'); sections.setAttribute('aria-label', 'Page sub-sections');
      dock.append(menu, sections); workspace.querySelector('.app-main').append(dock);
      resize = new ResizeObserver(() => document.body.style.setProperty('--mobile-workspace-dock-height', Math.ceil(dock.getBoundingClientRect().height) + 'px'));
      resize.observe(dock);
    }
    dock.hidden = !media.matches;
    const lists = [...root.querySelectorAll('[role="tablist"],[data-section-index]')].filter(availableList);
    const sources = lists.map(list => ({list, buttons:[...list.querySelectorAll('[role="tab"],[data-section-link]')].filter(b => !b.hidden)})).filter(s => s.buttons.length);
    const rail = document.getElementById('business-navigation'); watch(rail);
    menu.setAttribute('aria-expanded', String(rail?.dataset.drawer === 'true'));
    const chatShell = document.getElementById('gds-staff-chat'); watch(chatShell);
    const chat = chatShell && !chatShell.hidden ? chatShell.querySelector('.sc-launch') : null;
    const chatUnread = badgeValue(chat?.querySelector('.sc-badge'));
    const ask = document.querySelector('#gds-copilot .copilot-launch');
    const next = JSON.stringify([media.matches, view, !!rail, !!chat, chatUnread, !!ask, sources.map(s => [s.list.getAttribute('aria-label'),s.buttons.map(b => [b.textContent.trim(),b.disabled,b.getAttribute('aria-selected'),b.getAttribute('aria-current')])])]);
    // Retain live references even if a module replaces its tabs with identical text.
    const sameSources = dock._sources?.length === sources.length && sources.every((s, i) => s.buttons.length === dock._sources[i].buttons.length && s.buttons.every((b, j) => b === dock._sources[i].buttons[j]));
    if (next === signature && sameSources) return;
    signature = next; dock._sources = sources;
    const focused = dock.contains(document.activeElement) || actions?.contains(document.activeElement) ? document.activeElement.dataset.dockKey : null;
    const sectionScroll = sections.scrollLeft;
    // AI/chat remain available inside Menu; the bottom bar contains only Menu and sub-sections.
    if (rail && !actions) {
      actions = make('div','mobile-workspace-actions'); actions.setAttribute('role','group'); actions.setAttribute('aria-label','Workspace help and chat');
      const security = rail.querySelector('.sidebar-footer');
      if (security) security.before(actions); else rail.querySelector('nav')?.after(actions);
    }
    if (actions) {
      actions.replaceChildren();
      if (ask) actions.append(control('Ask Oprun', 'i-spark', () => { document.querySelector('.business-navigation-close')?.click(); ask.click(); }, null, 'ask'));
      if (chat) { const button = control('Office chat','i-users', () => { document.querySelector('.business-navigation-close')?.click(); chat.click(); }, null, 'chat'); addBadge(button,chatUnread); actions.append(button); }
      actions.hidden = !actions.children.length;
    }
    sections.replaceChildren();
    sources.forEach(({list, buttons}, i) => {
      list.classList.add('mobile-workspace-source');
      const row = make('div', 'mobile-workspace-section-group'); row.setAttribute('role','group'); row.setAttribute('aria-label', list.getAttribute('aria-label') || 'Page sections');
      buttons.forEach((b, j) => {
        const label = b.textContent.trim(), selected = b.getAttribute('aria-selected') === 'true' || !!b.getAttribute('aria-current');
        const proxy = control(label, sectionIcon(label), () => { b.click(); queue(); }, selected ? 'location' : null, `section-${i}-${j}`);
        proxy.disabled = b.disabled;
        if (b.hasAttribute('aria-controls')) proxy.setAttribute('aria-controls', b.getAttribute('aria-controls'));
        row.append(proxy);
      });
      sections.append(row);
    });
    sections.hidden = !sources.length;
    sections.scrollLeft = sectionScroll;
    if (focused) { const selector = `[data-dock-key="${CSS.escape(focused)}"]`; (dock.querySelector(selector) || actions?.querySelector(selector) || (rail?.dataset.drawer === 'true' ? rail.querySelector('.business-navigation-close') : menu))?.focus({preventScroll:true}); }
    else sections.querySelector('[aria-current]')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function queue() { if (!frame) frame = requestAnimationFrame(refresh); }
  function boot() {
    const root = document.querySelector('.content-wrap');
    if (root) new MutationObserver(queue).observe(root, {childList:true,subtree:true,attributes:true,attributeFilter:['hidden','aria-selected','aria-current','disabled','class']});
    // Permission changes and late-loaded chat controls are separate from page rendering.
    new MutationObserver(queue).observe(document.body, {childList:true});
    media.addEventListener('change', queue);
    const viewport = () => { const v = window.visualViewport; document.body.style.setProperty('--mobile-workspace-viewport-height', (v?.height || innerHeight) + 'px'); document.body.style.setProperty('--mobile-workspace-keyboard-offset', Math.max(0, innerHeight - (v?.height || innerHeight) - (v?.offsetTop || 0)) + 'px'); };
    window.visualViewport?.addEventListener('resize', viewport); window.visualViewport?.addEventListener('scroll', viewport); window.addEventListener('resize', viewport); viewport();
    for (const event of ['gds:viewchange','superpro:nav-ready','superpro:access-changed','superpro:sectionchange','hashchange','popstate']) window.addEventListener(event, queue);
    queue();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
