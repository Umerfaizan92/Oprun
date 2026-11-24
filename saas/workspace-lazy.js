/* TR-72: load each workspace page's code when the page is first opened.
   Page scripts are written in workspace.html as <script type="oprun/lazy" data-lazy="<group>" src="…">: the browser
   neither downloads nor runs them at start. When a page opens, app.js showView() asks OprunLazy.load(view) first; the
   scripts of the page's group then run once, in the order they appear in the page, and the page is shown after them.
   A page that is not in the table below loads every group (the safe default), so a page whose code is not mapped
   still works exactly as before; the pages in NONE are drawn by start-up code only.
   The page scripts listen for "superpro:workspace-ready" only to reset their state when the business changes, so a
   script that loads after that event has fired starts with the same fresh state and needs nothing replayed. */
(() => {
  const GROUP_VIEWS = {
    seo: ['seocentre', 'seoaudit', 'seoclusters', 'seogoogle', 'seostudio', 'seobuilder', 'seolocal', 'seoanalytics', 'seoreports', 'visibility'],
    finance: ['finance', 'finsales', 'finpayments', 'finreconcile', 'finreports', 'fincompliance', 'finplan'],
    integrations: ['integrations'],
    video: ['video'],
    automations: ['automations'],
    meetings: ['meetings', 'archive', 'teamchat', 'supportaccess', 'businesscampaigns'],
    website: ['websitehub', 'website', 'searchconsole', 'backlinks'],
    mail: ['mail'],
    hiring: ['hiring'],
    stock: ['stock'],
    migration: ['migration'],
    exports: ['exports'],
    growth: ['growth'],
    team: ['team'],
    manual: ['manual'],
    comms: ['unifiedinbox', 'voiceflow', 'campaignstudio', 'consent', 'dialer', 'receptionist', 'comms', 'phone', 'calls'],
    pipeline: ['enquiries', 'quotes', 'bookings', 'businessinvoices'],
    customers: ['customers', 'jobs']
  };
  // Pages drawn only by code that loads at start (app.js, ai-operations.js, approvals.js, workspace-ops.js and the
  // set-up, plan and support scripts).
  const NONE = new Set(['dashboard', 'assistant', 'approvals', 'workforce', 'onboarding', 'governance', 'support', 'billing', 'automation', 'offshore']);
  const loaded = new Map(); // group -> Promise
  const settled = new Set();
  const tags = (group) => [...document.querySelectorAll('script[type="oprun/lazy"]')].filter((t) => !group || t.dataset.lazy === group);
  const allGroups = () => [...new Set(tags().map((t) => t.dataset.lazy))];

  function groupsFor(view) {
    if (NONE.has(view)) return [];
    const mapped = Object.keys(GROUP_VIEWS).filter((g) => GROUP_VIEWS[g].includes(view));
    return mapped.length ? mapped : allGroups();
  }

  // One group's scripts, in page order. Scripts added with async=false run in the order they were added.
  function start(group) {
    if (loaded.has(group)) return loaded.get(group);
    const list = tags(group);
    const p = Promise.all(list.map((t) => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = t.getAttribute('src'); s.async = false; s.dataset.lazyLoaded = group;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load ' + t.getAttribute('src')));
      document.head.append(s);
    }))).then(() => { settled.add(group); }, (e) => { loaded.delete(group); throw e; });
    loaded.set(group, p);
    return p;
  }

  // Groups are started in page order so code shared between them runs in the same order as before.
  function load(view) {
    const want = new Set(groupsFor(view));
    return Promise.all(allGroups().filter((g) => want.has(g)).map(start)).then(() => undefined);
  }
  const ready = (view) => groupsFor(view).every((g) => settled.has(g));

  window.OprunLazy = { load, ready, groupsFor, GROUP_VIEWS };
})();
