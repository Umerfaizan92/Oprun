// T-071 Lead sources panel on the Enquiries page: tracked links and QR codes, and a report of leads, quotes,
// bookings and paid revenue per source, campaign and area. Shows only what the server confirmed.
(() => {
  if (window.SuperProLeadSources) return;
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  const money = (c) => (Number(c || 0) / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
  const can = (action) => (!window.GDS_SESSION?.access || typeof window.SuperProCan !== 'function' ? true : window.SuperProCan('customers', action));
  async function api(path, opt = {}) {
    const r = await fetch(path, { credentials: 'same-origin', ...opt, headers: { 'Content-Type': 'application/json', ...(window.SuperProWorkspaceContext?.headers?.() || {}), ...(opt.headers || {}) } });
    let d = {}; try { d = await r.json(); } catch { /* not JSON */ }
    if (!r.ok || d.ok === false) throw new Error(d.error || `The server refused this action (${r.status}).`);
    return d.data && d.links === undefined ? d.data : d;
  }
  let cache = { links: [], channels: [] };

  function table(caption, rows, empty) {
    if (!rows.length) return el('p', { class: 'portal-empty', text: empty });
    return el('div', { class: 'ls-table' }, el('table', {}, el('caption', { text: caption }),
      el('thead', {}, el('tr', {}, ['Source', 'Leads', 'Quoted', 'Booked', 'Paid revenue'].map((h, i) => el('th', { scope: 'col', class: i ? 'num' : null, text: h })))),
      el('tbody', {}, rows.map((r) => el('tr', {}, el('th', { scope: 'row', text: r.label }), el('td', { class: 'num', text: r.leads }), el('td', { class: 'num', text: r.quoted }), el('td', { class: 'num', text: r.booked }), el('td', { class: 'num', text: money(r.revenue_cents) }))))));
  }

  async function draw(panel) {
    const body = panel.querySelector('[data-ls-body]');
    const say = (text, bad = false) => { const p = panel.querySelector('[data-ls-status]'); p.textContent = text; p.dataset.tone = bad ? 'bad' : 'ok'; };
    try {
      const d = await api('/api/saas/lead-sources'); cache = d;
      const r = d.report;
      const summary = el('p', { class: 'portal-note', text: r.total_leads ? `${r.total_leads} enquir${r.total_leads === 1 ? 'y' : 'ies'} in the last ${r.days} days; ${r.tracked_leads} came through a tracked link or QR code.` : `No enquiries in the last ${r.days} days yet.` });
      const links = d.links.length ? el('ul', { class: 'ls-links' }, d.links.map((l) => el('li', {},
        el('div', {}, el('b', { text: l.label }), el('small', { text: [l.channel_label, l.campaign && 'Campaign: ' + l.campaign, l.area && 'Area: ' + l.area].filter(Boolean).join(' · ') }),
          el('code', { text: l.short_url }), el('small', { text: `${l.clicks} visit${l.clicks === 1 ? '' : 's'} · ${l.leads} enquir${l.leads === 1 ? 'y' : 'ies'}` })),
        el('div', { class: 'ls-actions' },
          el('button', { type: 'button', class: 'portal-button', text: 'Copy link', onclick: async () => { try { await navigator.clipboard.writeText(l.short_url); say('Link copied.'); } catch { say('Copy is blocked in this browser. Select the address and copy it.', true); } } }),
          el('a', { class: 'portal-button', href: `/api/saas/lead-sources/links/${l.id}/qr.svg`, target: '_blank', rel: 'noopener', text: 'Open QR code' }),
          can('edit') && el('button', { type: 'button', class: 'portal-button', text: 'Archive', onclick: async (e) => { e.target.disabled = true; try { await api(`/api/saas/lead-sources/links/${l.id}/archive`, { method: 'POST', body: '{}' }); say('Link archived. Its past enquiries stay in the report.'); await draw(panel); } catch (err) { say(err.message, true); e.target.disabled = false; } } }))))) 
        : el('p', { class: 'portal-empty', text: 'No tracked links yet. Create one for each post, campaign, flyer or sign so you can see which brings in work.' });

      let form = null;
      if (can('create')) {
        const select = el('select', { name: 'channel', required: true }, d.channels.map((c) => el('option', { value: c.value, text: c.label })));
        form = el('form', { class: 'portal-form ls-form' },
          el('label', {}, 'Name (only you see this)', el('input', { name: 'label', required: true, minlength: 2, maxlength: 80, placeholder: 'For example: Spring offer post' })),
          el('label', {}, 'Where it will be used', select),
          el('label', {}, 'Type', el('select', { name: 'kind' }, el('option', { value: 'link', text: 'Link for a post, bio, message or email' }), el('option', { value: 'qr', text: 'QR code for print, a vehicle or a sign' }))),
          el('label', {}, 'Campaign (optional)', el('input', { name: 'campaign', maxlength: 120, placeholder: 'For example: Spring 2026' })),
          el('label', {}, 'Suburb, postcode or area (optional)', el('input', { name: 'area', maxlength: 80, placeholder: 'For example: Cockburn 6164' })),
          el('label', {}, 'Address it opens', el('input', { name: 'destination', type: 'url', required: true, maxlength: 600, placeholder: 'https://', 'aria-describedby': 'ls-dest-help' }),
            el('small', { id: 'ls-dest-help', text: d.own_website ? `Your website (${d.own_website}) or your page on a social or Google service.` : 'Your page on a social or Google service. To use your own website, verify it first in Setup & Trust, Connections, Website.' })),
          el('button', { type: 'submit', class: 'portal-button primary', text: 'Create tracked link' }));
        form.addEventListener('submit', async (e) => {
          e.preventDefault(); const b = form.querySelector('[type=submit]'); b.disabled = true;
          const v = Object.fromEntries(new FormData(form));
          try { await api('/api/saas/lead-sources/links', { method: 'POST', body: JSON.stringify({ label: v.label, kind: v.kind, channel: v.channel, campaign: v.campaign || '', area: v.area || '', destination: v.destination }) }); say('Tracked link created.'); await draw(panel); }
          catch (err) { say(err.message, true); b.disabled = false; }
        });
      }
      body.replaceChildren(...[summary,
        el('h3', { text: 'Where your work comes from' }), table('Leads by source', r.sources, 'Sources appear here once enquiries arrive.'),
        r.campaigns.length ? el('h3', { text: 'By campaign' }) : null, r.campaigns.length ? table('Leads by campaign', r.campaigns, '') : null,
        r.areas.length ? el('h3', { text: 'By area' }) : null, r.areas.length ? table('Leads by area', r.areas, '') : null,
        el('p', { class: 'portal-note', text: 'Paid revenue is money received on the jobs that came from these enquiries. Visits are counted as a number only; nothing about the visitor is stored.' }),
        el('h3', { text: 'Tracked links and QR codes' }), links,
        form ? el('details', { class: 'ls-new' }, el('summary', { text: 'Create a tracked link or QR code' }), form) : null].filter(Boolean));
    } catch (e) { body.replaceChildren(el('p', { class: 'portal-note', 'data-tone': 'bad', text: e.message })); }
  }

  /** Adds the panel to the Enquiries page. Safe to call on every refresh. */
  function mount(container) {
    if (!container || !can('read')) return null;
    const panel = el('details', { class: 'portal-panel ls-panel', id: 'lead-sources-panel' }, el('summary', { text: 'Lead sources: links, QR codes and results' }),
      el('p', { class: 'portal-note', 'data-ls-status': '1', role: 'status', 'aria-live': 'polite' }), el('div', { 'data-ls-body': '1' }, el('p', { class: 'portal-note', text: 'Open to load.' })));
    panel.open = sessionStorage.getItem('sp-lead-sources-open') === '1';
    panel.addEventListener('toggle', () => { try { sessionStorage.setItem('sp-lead-sources-open', panel.open ? '1' : '0'); } catch { /* storage unavailable */ } if (panel.open) draw(panel); });
    container.append(panel);
    if (panel.open) draw(panel);
    return panel;
  }
  /** Tracked links for the new-enquiry form, from the last load. */
  const options = () => (cache.links || []).map((l) => ({ code: l.code, label: `${l.label} (${l.channel_label})` }));
  const load = async () => { try { cache = await api('/api/saas/lead-sources'); } catch { /* the form still works without it */ } return options(); };
  window.SuperProLeadSources = { mount, options, load };
})();
