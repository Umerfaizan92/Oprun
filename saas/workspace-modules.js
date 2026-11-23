/* TR-24: Business settings > Modules. The owner (or an admin) switches optional modules on or off; each industry has a
   recommended set. A switched-off module disappears from the menu and its data is kept. The server enforces the same
   rule (src/module-rules.js). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const make = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v); } n.append(...kids.filter(Boolean)); return n; };
  const api = async (url, opt = {}) => { const r = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, ...opt }); const d = await r.json().catch(() => ({})); if (!r.ok || d.ok === false) throw new Error(d.error || 'Request failed'); return d; };
  const canEdit = () => ['owner', 'admin', 'super_admin'].includes(window.GDS_SESSION?.user?.role);

  function render(host, d) {
    const form = make('form', { class: 'module-switches' });
    const list = make('div', { class: 'module-list', role: 'group', 'aria-label': 'Modules' });
    for (const m of d.modules) {
      const id = 'module-' + m.key;
      list.append(make('label', { class: 'module-row', for: id },
        make('input', { type: 'checkbox', id, name: m.key, checked: m.on, disabled: !canEdit() }),
        make('span', { class: 'module-name', text: m.label }),
        m.recommended ? make('span', { class: 'module-tag', text: 'Recommended' }) : make('span', { class: 'module-tag module-tag-muted', text: 'Optional' })));
    }
    const status = make('p', { class: 'module-status', role: 'status', 'aria-live': 'polite' });
    const save = make('button', { type: 'submit', class: 'primary-button', text: 'Save modules', disabled: !canEdit() });
    const reset = make('button', { type: 'button', class: 'secondary-button', text: 'Use the recommended set', disabled: !canEdit() });
    const send = async (body, msg) => {
      save.disabled = reset.disabled = true; status.textContent = 'Saving…';
      try { await api('/api/saas/modules', { method: 'PUT', body: JSON.stringify(body) }); status.textContent = msg + ' Updating the menu…'; setTimeout(() => location.reload(), 600); }
      catch (e) { status.textContent = e.message; save.disabled = reset.disabled = !canEdit(); }
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); send({ modules: Object.fromEntries(d.modules.map((m) => [m.key, form.elements[m.key].checked])) }, 'Modules saved.'); });
    reset.addEventListener('click', () => send({ use_recommended: true }, 'Recommended modules applied.'));
    form.append(list, make('div', { class: 'module-actions' }, save, reset), status);
    host.replaceChildren(
      make('div', { class: 'panel-head' }, make('div', {}, make('h2', { text: 'Modules' }), make('p', { class: 'muted', text: 'Switch off what your business does not use. Nothing is deleted, and you can switch a module back on at any time. Core pages are always on.' }))),
      canEdit() ? form : make('p', { class: 'muted', text: 'Only the owner or an admin can change modules.' }));
  }

  async function show() {
    const view = $('#onboarding-view'); if (!view || view.hidden) return;
    let host = $('#module-settings');
    if (!host) { host = make('article', { class: 'panel module-settings', id: 'module-settings' }); view.append(host); }
    if (host.dataset.loaded) return; host.dataset.loaded = '1';
    try { render(host, await api('/api/saas/modules')); } catch (e) { host.replaceChildren(make('p', { class: 'muted', text: e.message })); delete host.dataset.loaded; }
  }
  window.addEventListener('gds:viewchange', () => setTimeout(show, 0));
  window.addEventListener('hashchange', () => setTimeout(show, 50));
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => setTimeout(show, 300)) : setTimeout(show, 300);
})();
