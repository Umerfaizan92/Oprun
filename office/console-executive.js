// TR-30: executive dashboard on the Operator Console's first page (Platform overview → Overview).
// Data: GET /api/operator/executive. Blocks appear only for sections the signed-in platform role may read.
// Every figure is recorded in Oprun; when a figure could not be read the tile says so instead of showing 0.
(() => {
  const el = (t, c, text) => { const e = document.createElement(t); if (c) e.className = c; if (text !== undefined) e.textContent = text; return e; };
  const money = (c) => (c == null ? 'Not recorded' : (c / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: c % 100 ? 2 : 0 }));
  const num = (v) => (v == null ? '—' : Number(v).toLocaleString('en-AU'));
  const STATUS = { trialing: 'On trial', active: 'Paying', past_due: 'Payment overdue', restricted: 'Read-only after trial', cancelled: 'Cancelled', canceled: 'Cancelled', archived: 'Archived', paused: 'Paused' };
  const statusName = (s) => STATUS[s] || String(s || 'Unknown').replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());

  function tile(label, value, sub, route, tone) {
    const t = el(route ? 'a' : 'div', 'ex-tile' + (tone ? ' ex-' + tone : ''));
    if (route) { t.href = '#' + route; t.setAttribute('aria-label', `${label}: ${value}${sub ? ', ' + sub : ''}. Open`); }
    t.append(el('span', 'ex-label', label), el('b', 'ex-value', value));
    if (sub) t.append(el('small', 'ex-sub', sub));
    return t;
  }

  function attention(items) {
    const box = el('section', 'ex-attention'); box.setAttribute('aria-labelledby', 'ex-attention-title');
    const h = el('h2', '', items.length ? 'Needs attention' : 'Nothing needs attention'); h.id = 'ex-attention-title';
    box.append(h);
    if (!items.length) { box.append(el('p', 'ex-calm', 'No incidents, failed jobs, overdue invoices or waiting requests in the areas you can see.')); return box; }
    const list = el('ul', 'ex-list');
    for (const i of items) {
      const li = el('li', 'ex-item ex-' + i.level);
      li.dataset.attention = i.key;
      const tag = el('span', 'ex-level', i.level === 'critical' ? 'Urgent' : i.level === 'warning' ? 'Check' : 'For you');
      const a = el('a', 'ex-link', i.text); a.href = '#' + i.route;
      li.append(tag, a); list.append(li);
    }
    box.append(list);
    return box;
  }

  // Sign-ups per week as plain bars (no animation). Text alternative lists every week.
  function signups(weeks) {
    const box = el('section', 'ex-panel ex-signups'); box.setAttribute('aria-labelledby', 'ex-signups-title');
    const h = el('h2', '', 'New businesses per week'); h.id = 'ex-signups-title';
    const max = Math.max(1, ...weeks.map((w) => w.count)), total = weeks.reduce((s, w) => s + w.count, 0);
    const chart = el('ol', 'ex-bars'); chart.setAttribute('aria-label', `${total} new businesses in the last 8 weeks`);
    for (const w of weeks) {
      const li = el('li', 'ex-bar' + (w.count ? '' : ' ex-zero'));
      const d = new Date(w.week_ending + 'T00:00:00Z');
      const label = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      li.title = `Week ending ${label}: ${w.count}`;
      const bar = el('i'); bar.style.height = Math.round((w.count / max) * 100) + '%';
      li.append(el('span', 'ex-bar-n', String(w.count)), bar, el('small', '', label));
      chart.append(li);
    }
    box.append(h, chart, el('p', 'ex-foot', total ? `${total} in the last 8 weeks. The last bar is the current week so far.` : 'No new businesses in the last 8 weeks.'));
    return box;
  }

  function statuses(by) {
    const box = el('section', 'ex-panel'); box.setAttribute('aria-labelledby', 'ex-status-title');
    const h = el('h2', '', 'Subscribers by status'); h.id = 'ex-status-title';
    const dl = el('dl', 'ex-status');
    const rows = Object.entries(by || {}).sort((a, b) => b[1] - a[1]);
    for (const [k, v] of rows) { const r = el('div'); r.append(el('dt', '', statusName(k)), el('dd', '', num(v))); dl.append(r); }
    box.append(h, rows.length ? dl : el('p', 'ex-foot', 'No subscribers yet.'));
    return box;
  }

  function render(host, d) {
    const s = d.sections || {}, wrap = el('div', 'ex-dash'); wrap.dataset.executive = '';
    wrap.append(attention(d.attention || []));
    const tiles = el('div', 'ex-tiles');
    if (s.subscribers) {
      tiles.append(tile('Businesses', num(s.subscribers.total), s.subscribers.new_7_days ? `${s.subscribers.new_7_days} new this week` : 'None new this week', 'f02/subscribers'));
      tiles.append(tile('Trials ending', num(s.subscribers.trials_ending_7_days), 'In the next 7 days', 'f02/subscribers', s.subscribers.trials_ending_7_days ? 'info' : ''));
    }
    if (s.revenue) {
      tiles.append(tile('Monthly recurring revenue', money(s.revenue.mrr_cents), `${num(s.revenue.paying_subscribers)} paying`, 'f01/platform/revenue'));
      const o = s.revenue.overdue_invoices;
      tiles.append(tile('Overdue invoices', o ? num(o.count) : 'Not recorded', o && o.count ? money(o.total_cents) : '', 'f03/invoices', o?.count ? 'warning' : ''));
    }
    if (s.support) tiles.append(tile('Open tickets', num(s.support.open_tickets), s.support.waiting_tickets ? `${s.support.waiting_tickets} waiting on a reply` : '', 'f04/records:ticket'));
    if (s.operations) {
      const j = s.operations.jobs;
      tiles.append(tile('Failed jobs', j ? num(j.failed_24_hours) : 'Not recorded', 'Last 24 hours', 'f01/system', j?.failed_24_hours ? 'warning' : ''));
      tiles.append(tile('Open incidents', num(s.operations.open_incidents), '', 'f07/records:incident', s.operations.open_incidents ? 'critical' : ''));
    }
    if (tiles.childElementCount) wrap.append(tiles);
    if (s.subscribers) { const row = el('div', 'ex-row'); row.append(signups(s.subscribers.signups_by_week || []), statuses(s.subscribers.by_status)); wrap.append(row); }
    if (s.revenue?.note) wrap.append(el('p', 'ex-foot', s.revenue.note));
    host.prepend(wrap);
    return wrap;
  }

  window.OprunExecutive = { render, statusName };
})();
