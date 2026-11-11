// Master prompt 2026-11-12, deliverable 3: one clear primary action when a core area is empty.
// Read-only: it only reads counts the signed-in user is already allowed to see (server enforces tenant and grants)
// and never performs an action itself. Each guide links to an existing route; nothing is created automatically.
(() => {
  const GUIDES = {
    work: {
      views: ['enquiries', 'quotes', 'bookings', 'jobs'],
      url: '/api/saas/pipeline/overview',
      empty: d => Array.isArray(d.stages) && d.stages.every(s => !s.count),
      text: 'No work in the pipeline yet. Capture your first enquiry: it flows to quote, booking, job and invoice, with your approval at each external step.',
      action: 'Capture an enquiry', target: 'enquiries'
    },
    communications: {
      views: ['unifiedinbox'],
      url: '/api/saas/comms/unified?folder=inbox',
      empty: d => Array.isArray(d.items) && !d.items.length && !Object.values(d.counts || {}).some(Boolean),
      text: 'Your Unified Inbox is empty. Connect email, SMS, WhatsApp or social channels so customer messages arrive here. AI drafts replies; nothing is sent without approval.',
      action: 'Connect a channel', target: 'integrations'
    },
    growth: {
      views: ['growth'],
      url: '/api/saas/growth/overview',
      empty: d => d.ok && !Object.values(d.calendar_counts || {}).some(Boolean) && !Object.values(d.plans || {}).some(Boolean),
      text: 'No growth plan yet. Create your first campaign draft. Posts, emails and ad spend always wait for your approval before anything is published.',
      action: 'Create a campaign draft', target: 'campaignstudio'
    }
  };
  const seen = new Map();
  async function show(view) {
    document.querySelectorAll('.view-empty-guide').forEach(e => { e.hidden = true; });
    const nav = window.SuperProNav, session = window.GDS_SESSION;
    if (!nav || !session) return;
    const entry = Object.entries(GUIDES).find(([, g]) => g.views.includes(view));
    if (!entry) return;
    const [key, guide] = entry, allowed = new Set(nav.sequence(session.user.role));
    const targetView = allowed.has(guide.target) ? guide.target : guide.views.find(v => allowed.has(v));
    if (!targetView) return;
    let empty = seen.get(key + ':' + session.organisation.id);
    if (empty === undefined) {
      try {
        const r = await fetch(guide.url, { credentials: 'same-origin', headers: { accept: 'application/json' } });
        empty = r.ok ? guide.empty(await r.json()) : false;
      } catch { empty = false; }
      seen.set(key + ':' + session.organisation.id, empty);
    }
    const host = document.getElementById(view + '-view');
    if (!empty || !host || window.GDS_SESSION !== session) return;
    let box = host.querySelector(':scope > .view-empty-guide');
    if (!box) {
      box = document.createElement('div'); box.className = 'view-empty-guide'; box.dataset.guide = key; box.setAttribute('role', 'note');
      const p = document.createElement('p'); p.textContent = guide.text;
      const a = document.createElement('a'); a.href = '#' + nav.pathFor(targetView); a.textContent = guide.action;
      // Already on the target page: jump to its first form field instead of reloading the same route.
      a.addEventListener('click', e => {
        if (targetView !== view) return;
        const field = host.querySelector('form input:not([type=hidden]), form textarea, form select');
        if (!field) return;
        e.preventDefault(); const wrap = field.closest('details'); if (wrap) wrap.open = true;
        field.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); field.focus({ preventScroll: true });
      });
      box.append(p, a);
      const heading = host.querySelector(':scope > .page-heading');
      if (heading) heading.after(box); else host.prepend(box);
    }
    box.hidden = false;
  }
  // A saved record changes emptiness; re-check on the next visit.
  document.addEventListener('submit', () => seen.clear(), true);
  window.addEventListener('gds:viewchange', e => show(e.detail.view));
  window.SuperProEmptyGuides = { GUIDES, show };
})();
