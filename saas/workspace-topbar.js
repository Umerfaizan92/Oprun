// Owner request (2026-11-14): one tidy row on phones. Language, help, get paid and the manual sit in a "More"
// menu on small screens. The same buttons (same IDs and handlers) are moved, never copied; on larger screens
// the wrapper is display:contents, so they appear in the bar exactly as before.
(() => {
  const IDS = ['workspace-language', 'replay-tour', 'pad-open', 'open-digital-manual'];
  let actions, menu, toggle;
  const close = (focus = false) => { if (!menu || menu.hidden) return; menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); if (focus) toggle.focus(); };
  function gather() {
    for (const id of IDS) { const el = document.getElementById(id); if (el && el.parentElement !== menu) menu.append(el); }
    // Keep the menu order stable whichever script added a button first.
    for (const id of IDS) { const el = document.getElementById(id); if (el) menu.append(el); }
  }
  function build() {
    actions = document.querySelector('#workspace .app-topbar > .topbar-actions'); if (!actions || actions.querySelector('.topbar-more')) return;
    toggle = document.createElement('button');
    Object.assign(toggle, { type: 'button', className: 'topbar-more-toggle' });
    toggle.setAttribute('aria-label', 'More options'); toggle.setAttribute('aria-haspopup', 'true'); toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';
    menu = document.createElement('div'); menu.className = 'topbar-more'; menu.id = 'topbar-more'; menu.hidden = true; menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'More options');
    toggle.setAttribute('aria-controls', menu.id);
    const search = actions.querySelector('.search-button');
    (search ? search.after(menu) : actions.prepend(menu));
    const profile = actions.querySelector('.profile-menu'); profile ? profile.before(toggle) : actions.append(toggle);
    gather();
    toggle.addEventListener('click', e => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('button,a')?.focus(); });
    menu.addEventListener('click', e => { if (e.target.closest('button,a')) setTimeout(() => close(), 0); });
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target) && e.target !== toggle) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) close(true); });
    addEventListener('resize', () => { if (matchMedia('(min-width:761px)').matches) close(); });
    // Closing a window opened from the menu returns keyboard focus to the visible "More" button.
    document.getElementById('workspace-language-dialog')?.addEventListener('close', () => { const t = document.getElementById('workspace-language'); if (t && !t.getClientRects().length) toggle.focus(); });
    // Buttons such as "Get paid" and the manual are added by other scripts after load.
    new MutationObserver(() => { if (IDS.some(id => { const el = document.getElementById(id); return el && el.parentElement !== menu; })) gather(); }).observe(actions, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
