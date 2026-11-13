/* Mobile presentation only: invoke the real permission-filtered controls and keep forms in place. */
(() => {
  const media = matchMedia('(max-width: 760px)');
  const make = (tag, cls, text) => {
    const node = document.createElement(tag); node.className = cls || '';
    if (text) node.textContent = text;
    return node;
  };
  const icon = (name) => {
    // A short code where no drawn icon fits, so pages never show a row of identical icons.
    if (String(name).startsWith('mono:')) { const t = make('b', 'mobile-workspace-mono', String(name).slice(5) || '•'); t.setAttribute('aria-hidden', 'true'); return t; }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(svg.namespaceURI, 'use');
    use.setAttribute('href', '#' + name); svg.append(use); return svg;
  };
  // Each tab gets the closest drawn icon; a short code only where nothing fits.
  const ICON_RULES = [
    [/^action centre$|priorities/i, 'i-target'], [/^workflow guidance$/i, 'i-route'], [/your workspace|all features|workspace map/i, 'i-briefcase'],
    [/^enquir|unified inbox|^inbox|channel inbox|received/i, 'i-inbox'], [/quote|estimate|quotation/i, 'i-quote'],
    [/invoice|receipt|gst|bas\b|sales doc/i, 'i-receipt'], [/booking|calendar|schedul/i, 'i-calendar'],
    [/job|work order|dispatch/i, 'i-tool'], [/stock|suppl|reorder|inventory/i, 'i-box'], [/archiv/i, 'i-archive'],
    [/mail|sent|spam|unsubscrib|suppress/i, 'i-mail'], [/call|phone|number|sms|receptionist/i, 'i-phone'],
    [/chat|message|conversation|content & replies/i, 'i-chat'], [/review|score/i, 'i-star'],
    [/payment|refund|paid|owed|bank|cost|profit|money|ledger|reconcil|get paid/i, 'i-coin'], [/billing|plan|usage|add-on/i, 'i-card'],
    [/report|summary|analytics|overview|keyword|insight|decision/i, 'i-chart'], [/help|support|manual|faq|complaint|guide/i, 'i-help'],
    [/about you|your role|profile|contact|address|applicant|worker|offshore/i, 'i-user'], [/staff|team|people|customer|member|access|roles/i, 'i-users'],
    [/polic|consent|lock|protected|security|trust|safety|safeguard/i, 'i-lock'], [/approval|compliance|rule|audit|governance/i, 'i-shield'],
    [/import|backup|upload|export|print/i, 'i-upload'], [/^new |create|^add /i, 'i-plus'], [/check|ready|readiness|flagged|task/i, 'i-check'],
    [/\bai\b|assistant|suggest|automat|growth hub/i, 'i-spark'], [/seo|search|google/i, 'i-search'],
    [/website|site|domain|link|connect|integration/i, 'i-link'], [/video|media|post|social|campaign|studio|creative|marketing/i, 'i-video'],
    [/activity|history|queue|log|recent/i, 'i-clock'], [/setting|appearance|brand|business|design|facts/i, 'i-building'],
    [/document|record|form|template|draft|specification|schema|file/i, 'i-doc'], [/next|step|start/i, 'i-arrow'], [/notification|alert|attention|fail|error|blocked/i, 'i-bell'], [/most used|favou?rite/i, 'i-star']
  ];
  const sectionIcon = label => ICON_RULES.find(([re]) => re.test(label))?.[1]
    || 'mono:' + String(label).replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  // Single-page menu groups borrow their closest related pages.
  const RELATED = { customers: ['enquiries', 'quotes', 'jobs', 'unifiedinbox', 'businessinvoices'] };
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
  const DOCK_I18N = { menu: 'chrome.allFeatures', ask: 'chrome.askOprun', chat: 'chrome.officeChat' };
  function control(label, symbol, action, current, key) {
    const b = make('button', 'mobile-workspace-item'); b.type = 'button'; b.dataset.dockKey = key;
    b.title = label; b.setAttribute('aria-label', label);
    const plate = make('span', 'mobile-workspace-icon'); plate.append(icon(symbol));
    const text = make('span', 'mobile-workspace-label', label), i18n = DOCK_I18N[key];
    if (i18n) { text.dataset.i18n = i18n; b.dataset.i18nAttr = `title=${i18n};aria-label=${i18n}`; } // Prompt 03 L5: translated as it appears
    b.append(plate, text);
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
      dock = make('nav', 'mobile-workspace-dock'); dock.id = 'mobile-workspace-dock'; dock.setAttribute('aria-label', 'All Features and current page sub-sections');
      // Prompt 01 #10: the drawer button is called All Features; it still opens the same navigation drawer.
      menu = control('All Features', 'i-menu', event => { event.stopPropagation(); document.querySelector('.navigation-business-trigger')?.click(); }, null, 'menu');
      menu.classList.add('mobile-workspace-menu'); menu.setAttribute('aria-controls','business-navigation'); menu.setAttribute('aria-haspopup','dialog');
      sections = make('div', 'mobile-workspace-sections'); sections.setAttribute('aria-label', 'Page sub-sections');
      // Prompt 01 #9: the bar is a direct child of <body>. Inside .app-main it inherited transformed/animated ancestors,
      // which turn position:fixed into 'fixed to that ancestor' and made the bar drift while scrolling.
      dock.append(menu, sections); document.body.append(dock);
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
    // Pages without their own tabs show the other pages of the same menu group, so the bar is never empty.
    if (!sources.length) {
      const allowed = new Set(nav.sequence(session.user.role)), domain = (nav.DOMAINS || []).find(d => d.items.some(i => i.view === view));
      let items = domain ? domain.items.filter(i => allowed.has(i.view)) : [];
      if (items.length < 2) items = [...items, ...(RELATED[view] || []).map(v => (nav.DOMAINS || []).flatMap(d => d.items).find(i => i.view === v)).filter(i => i && allowed.has(i.view) && !items.some(x => x.view === i.view))];
      if (items.length > 1) {
        const row = make('div', 'mobile-workspace-section-group'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', (domain?.label || 'Related') + ' pages');
        items.forEach((item, j) => row.append(control(item.label, sectionIcon(item.label), () => { location.hash = item.path; queue(); }, item.view === view ? 'page' : null, `page-${j}`)));
        sections.append(row);
      }
    }
    sections.hidden = !sections.children.length;
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
    // Prompt 01 #9: never move the bar with the visual viewport. Browsers update visualViewport and innerHeight at
    // different moments while the address bar shows/hides, which made the old keyboard offset jump during scrolling.
    // When the on-screen keyboard is open the bar is hidden instead, and returns when typing ends.
    const typing = () => { const a = document.activeElement; return !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && !/^(checkbox|radio|button|submit|range|color|file)$/.test(a.type || ''); };
    const viewport = () => { const v = window.visualViewport, h = v?.height || innerHeight; document.body.style.setProperty('--mobile-workspace-viewport-height', h + 'px'); document.body.style.setProperty('--mobile-workspace-keyboard-offset', '0px'); document.body.classList.toggle('mobile-keyboard-open', typing() && (screen.height - h > 220 || innerHeight - h > 150)); };
    document.addEventListener('focusin', () => setTimeout(viewport, 250)); document.addEventListener('focusout', () => setTimeout(viewport, 120));
    window.visualViewport?.addEventListener('resize', viewport); window.visualViewport?.addEventListener('scroll', viewport); window.addEventListener('resize', viewport); viewport();
    for (const event of ['gds:viewchange','superpro:nav-ready','superpro:access-changed','superpro:sectionchange','hashchange','popstate']) window.addEventListener(event, queue);
    queue();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
