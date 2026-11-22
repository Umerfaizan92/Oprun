// T-179: choose several photos and videos for a campaign or a post. Upload from the device (several at once) or pick
// from the business's media library. Up to 10, kept in the order chosen. Files go to the existing media library
// (POST /api/saas/media), so the same photo can be reused later.
(() => {
  'use strict';
  const MAX = 10;let workspaceEpoch=0;
  const resetPickers=()=>{workspaceEpoch++;document.querySelectorAll('.media-picker').forEach(n=>n.dispatchEvent(new Event('oprun:picker-reset')))};
  window.addEventListener('superpro:workspace-ready',resetPickers);window.addEventListener('pagehide',resetPickers);document.getElementById('logout')?.addEventListener('click',resetPickers,true);
  const make = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v === null || v === undefined || v === false) continue; if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat()) if (k !== null && k !== undefined) e.append(k);
    return e;
  };
  const headers = () => window.SuperProWorkspaceContext?.headers?.() || {};
  async function request(path, opt = {}) {
    const epoch=workspaceEpoch;const r = await fetch(path, { credentials: 'same-origin', ...opt, headers: { ...headers(), ...(opt.headers || {}) } });
    let d = {}; try { d = await r.json(); } catch { /* not JSON */ }
    if(epoch!==workspaceEpoch)throw new Error('Workspace changed. Previous media selection was discarded.');
    if (!r.ok || d.ok === false) throw new Error(d.error || `The server refused this action (${r.status}).`);
    return d;
  }
  let uid = 0;

  function create({ selected = [], label = 'Photos and videos', hint = '' } = {}) {
    const known = new Map(); // id -> { id, kind, name }
    let chosen = selected.map((m) => (typeof m === 'string' ? m : m.id)).filter(Boolean);
    for (const m of selected) if (typeof m === 'object' && m?.id) known.set(m.id, { id: m.id, kind: m.kind, name: m.name || m.original_name || '' });
    const listeners = [];
    const fid = `media-picker-${++uid}`;
    const strip = make('ul', { class: 'mp-strip', 'aria-label': 'Chosen photos and videos' });
    const status = make('p', { class: 'mp-status', role: 'status', 'aria-live': 'polite' });
    const input = make('input', { type: 'file', id: fid, multiple: true, accept: 'image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm', class: 'mp-file' });
    const grid = make('div', { class: 'mp-library', hidden: true, role: 'group', 'aria-label': 'Media library' });
    const libButton = make('button', { type: 'button', class: 'portal-button', 'aria-expanded': 'false', text: 'Choose from media library' });
    const thumb = (m) => {
      const url = `/api/saas/media/${encodeURIComponent(m.id)}/file`;
      return m.kind === 'video'
        ? make('span', { class: 'mp-thumb mp-video', 'aria-hidden': 'true' }, make('video', { src: url, preload: 'metadata', muted: true, playsinline: true }), make('span', { class: 'mp-badge', text: 'Video' }))
        : make('span', { class: 'mp-thumb', 'aria-hidden': 'true' }, make('img', { src: url, alt: '', loading: 'lazy' }));
    };
    const changed = () => { draw(); listeners.forEach((fn) => fn(chosen.slice())); };
    function draw() {
      strip.replaceChildren(...chosen.map((id, i) => {
        const m = known.get(id) || { id, kind: 'photo', name: '' };
        return make('li', {}, thumb(m), make('button', { type: 'button', class: 'mp-remove', 'aria-label': `Remove ${m.name || (m.kind === 'video' ? 'video' : 'photo')} ${i + 1}`, text: '×', onclick: () => { chosen = chosen.filter((x) => x !== id); changed(); } }));
      }));
      strip.hidden = !chosen.length;
      count.textContent = chosen.length ? `${chosen.length} of ${MAX} chosen` : 'None chosen';
      grid.querySelectorAll('[data-media-id]').forEach((b) => b.setAttribute('aria-pressed', String(chosen.includes(b.dataset.mediaId))));
    }
    async function openLibrary() {
      const open = grid.hidden; grid.hidden = !open; libButton.setAttribute('aria-expanded', String(open));
      if (!open || grid.dataset.loaded) return;
      grid.replaceChildren(make('p', { class: 'mp-status', text: 'Loading your media…' }));
      try {
        const d = await request('/api/saas/media');
        const items = (d.media || []).filter((m) => ['photo', 'video'].includes(m.kind)).slice(0, 60);
        items.forEach((m) => known.set(m.id, { id: m.id, kind: m.kind, name: m.original_name }));
        grid.dataset.loaded = '1';
        grid.replaceChildren(...(items.length ? items.map((m) => make('button', { type: 'button', class: 'mp-pick', 'data-media-id': m.id, 'aria-pressed': 'false', 'aria-label': `${m.kind === 'video' ? 'Video' : 'Photo'}: ${m.original_name}`, onclick: () => {
          if (chosen.includes(m.id)) chosen = chosen.filter((x) => x !== m.id);
          else if (chosen.length >= MAX) { status.textContent = `Up to ${MAX} photos and videos.`; return; } else chosen.push(m.id);
          status.textContent = ''; changed();
        } }, thumb(m))) : [make('p', { class: 'mp-status', text: 'Your media library is empty. Add photos or videos from your device.' })]));
        draw();
      } catch (e) { grid.replaceChildren(make('p', { class: 'mp-status', text: e.message })); }
    }
    input.addEventListener('change', async () => {
      const files = [...input.files]; input.value = '';
      if (!files.length) return;
      const room = MAX - chosen.length;
      if (room <= 0) { status.textContent = `Up to ${MAX} photos and videos. Remove one first.`; return; }
      const form = new FormData(); files.slice(0, Math.min(room, 10)).forEach((f) => form.append('files', f));
      status.textContent = `Uploading ${Math.min(files.length, room)} file${files.length === 1 ? '' : 's'}…`;
      try {
        const d = await request('/api/saas/media', { method: 'POST', body: form });
        d.ids.forEach((id, i) => { const f = files[i]; known.set(id, { id, kind: f.type.startsWith('video/') ? 'video' : 'photo', name: f.name }); chosen.push(id); });
        delete grid.dataset.loaded; if (!grid.hidden) { grid.hidden = true; openLibrary(); }
        status.textContent = `${d.ids.length} added.${files.length > room ? ` Only ${MAX} can be used.` : ''}`; changed();
      } catch (e) { status.textContent = e.message; }
    });
    libButton.addEventListener('click', openLibrary);
    const count = make('span', { class: 'mp-count' });
    const element = make('div', { class: 'cx-field media-picker' },
      make('span', { class: 'cx-label', text: label }),
      strip,
      make('div', { class: 'mp-actions' }, make('label', { class: 'portal-button mp-upload', for: fid, text: 'Add from your device' }), input, libButton, count),
      grid, status, hint ? make('small', { text: hint }) : null);
    element.addEventListener('oprun:picker-reset',()=>{chosen=[];known.clear();grid.replaceChildren();grid.hidden=true;delete grid.dataset.loaded;status.textContent='';input.value='';libButton.setAttribute('aria-expanded','false');draw()});
    draw();
    return { element, value: () => chosen.slice(), onChange: (fn) => listeners.push(fn) };
  }
  window.OprunMediaPicker = { create };
})();
