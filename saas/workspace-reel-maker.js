// T-197: free Reel Maker panel in Media Studio. The business's own photos and videos become a professional reel on
// Oprun's server: no AI service, no per-video charge. Words are suggestions the person edits; nothing is invented.
(() => {
  const ui = () => window.SuperProUI;
  let mounted = false, timer = null, epoch = 0, reels = [], state = null;
  const $ = (s) => document.querySelector(s);
  function el(tag, props, ...kids) { const n = ui().el(tag, props, ...kids); if (tag === 'textarea' && props?.value !== undefined) n.value = props.value; return n; }

  function mount() {
    if (mounted) return true;
    const view = $('#video-view'), anchor = view?.querySelector('.studio-workflow') || view?.querySelector('.page-heading');
    if (!anchor || !window.OprunMediaPicker || !window.SuperProUI) return false;
    mounted = true;
    const s = state = { template: 'showcase', ratio: '9:16', hooks: [] };
    const seg = (name, items, cur, on) => el('div', { class: 'aiv-seg', role: 'radiogroup', 'aria-label': name }, ...items.map(([v, l, h]) => el('button', { type: 'button', role: 'radio', 'data-v': v, 'aria-checked': String(v === cur), title: h || '', text: l, onclick: (e) => { e.currentTarget.parentElement.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-checked', String(x === e.currentTarget))); on(v); } })));
    const field = (label, input, hint) => el('label', { class: 'rm-field' }, el('span', { class: 'cx-label', text: label }), input, hint ? el('small', { text: hint }) : null);
    const templates = el('div', { class: 'rm-templates', role: 'radiogroup', 'aria-label': 'Reel type' });
    const tHint = el('p', { class: 'muted rm-hint' });
    const picker = window.OprunMediaPicker.create({ label: 'Your photos and videos (in order)', hint: 'Up to 10. Each one becomes a scene. Real photos keep real faces.' });
    const service = el('input', { id: 'rm-service', maxlength: '60', placeholder: 'e.g. Bathroom renovation', 'aria-label': 'What the reel is about' });
    const offer = el('input', { id: 'rm-offer', maxlength: '90', placeholder: 'Type your real offer, e.g. 10% off in December', 'aria-label': 'Your offer' });
    const quote = el('textarea', { id: 'rm-quote', rows: '2', maxlength: '220', placeholder: 'Paste a real customer review (with their permission)', 'aria-label': 'Customer review' });
    const offerRow = field('Your offer', offer), quoteRow = field('Customer review', quote, 'Only real reviews. Oprun never writes reviews for you.');
    const suggest = el('button', { type: 'button', class: 'secondary-button compact', id: 'rm-suggest', text: 'Suggest words (free)' });
    const hookPick = el('div', { class: 'rm-hooks', role: 'radiogroup', 'aria-label': 'Hook ideas' });
    const hook = el('input', { id: 'rm-hook', maxlength: '90', placeholder: 'First words people see, e.g. Watch this transformation', 'aria-label': 'Hook' });
    const title = el('input', { id: 'rm-title', maxlength: '90', 'aria-label': 'Title' });
    const features = el('textarea', { id: 'rm-features', rows: '3', 'aria-label': 'Feature lines', placeholder: 'One per line, e.g. Licensed and insured' });
    const cta = el('input', { id: 'rm-cta', maxlength: '70', placeholder: 'e.g. Book your free quote', 'aria-label': 'Call to action' });
    const phone = el('input', { id: 'rm-phone', maxlength: '30', 'aria-label': 'Phone on end card' }), website = el('input', { id: 'rm-website', maxlength: '80', 'aria-label': 'Website on end card' });
    const caption = el('textarea', { id: 'rm-caption', rows: '4', maxlength: '3000', 'aria-label': 'Post caption', value: '' });
    const quality = el('select', { 'aria-label': 'Quality', id: 'rm-quality' }, el('option', { value: '1080p', text: '1080p (best)' }), el('option', { value: '720p', text: '720p (faster)' }));
    const accent = el('input', { type: 'color', id: 'rm-accent', value: '#c9a24d', 'aria-label': 'Brand colour' });
    const logo = el('select', { id: 'rm-logo', 'aria-label': 'Logo for end card' }, el('option', { value: '', text: 'No logo' }));
    const music = el('select', { id: 'rm-music', 'aria-label': 'Voice or music' }, el('option', { value: '', text: 'No added voice or music' }));
    const keep = el('input', { type: 'checkbox', id: 'rm-keep', checked: true }), endCard = el('input', { type: 'checkbox', id: 'rm-end', checked: true });
    const make = el('button', { type: 'button', class: 'primary-button', id: 'rm-make', text: 'Make my reel' });
    const status = el('p', { role: 'status', class: 'muted', id: 'rm-status' }), list = el('div', { class: 'rm-list', id: 'rm-list' });
    const panel = el('article', { class: 'panel rm-panel', id: 'reel-maker-panel', 'aria-labelledby': 'rm-heading' },
      el('div', { class: 'panel-head' }, el('div', {}, el('span', { class: 'panel-kicker', text: 'REEL MAKER · FREE' }), el('h2', { id: 'rm-heading', text: 'Turn your photos and videos into a professional reel' }),
        el('p', { text: 'Hook, title, feature lines, smart framing, smooth transitions and a branded end card. Made on Oprun, with no AI charges and no faces changed.' })), el('span', { class: 'status-pill neutral', text: '$0 per reel' })),
      el('h3', { class: 'rm-step', text: '1. Choose a reel type' }), templates, tHint,
      el('h3', { class: 'rm-step', text: '2. Add your photos and videos' }), picker.element,
      el('h3', { class: 'rm-step', text: '3. Words on screen' }),
      el('div', { class: 'rm-grid' }, field('What is it about?', service), offerRow, quoteRow),
      el('div', { class: 'rm-row' }, suggest), hookPick,
      el('div', { class: 'rm-grid' }, field('Hook (first 2 seconds)', hook), field('Title', title), field('Feature lines', features, 'Shown one per scene. Keep them short.'), field('Call to action', cta), field('Phone', phone), field('Website', website)),
      el('h3', { class: 'rm-step', text: '4. Look and sound' }),
      el('div', { class: 'rm-grid' }, field('Shape', seg('Reel shape', [['9:16', 'Reels / TikTok / Shorts'], ['4:5', 'Feed 4:5'], ['1:1', 'Square'], ['16:9', 'YouTube / wide']], s.ratio, (v) => { s.ratio = v; })), field('Quality', quality), field('Brand colour', accent), field('Logo (end card)', logo), field('Your voice or music', music, 'Record or upload it in your media library first.'),
        el('label', { class: 'aiv-check' }, keep, el('span', { text: 'Keep the sound from my videos' })), el('label', { class: 'aiv-check' }, endCard, el('span', { text: 'Add a branded end card' }))),
      field('Post caption', caption, 'Used when you create a post draft. Check every claim before it is posted.'),
      el('div', { class: 'rm-row' }, make), status,
      el('h3', { class: 'rm-step', text: 'Your reels' }), list);
    anchor.after(panel);

    const sync = () => { offerRow.hidden = s.template !== 'offer'; quoteRow.hidden = s.template !== 'review'; };
    const setHooks = (hooks) => { s.hooks = hooks; hookPick.replaceChildren(...hooks.map((h, i) => el('button', { type: 'button', role: 'radio', class: 'rm-hook', 'aria-checked': String(hook.value === h), text: h, onclick: (e) => { hook.value = h; hookPick.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b === e.currentTarget))); }, 'data-i': String(i) }))); };
    async function plan() {
      const run = epoch; suggest.disabled = true; status.textContent = 'Writing suggestions…';
      try {
        const lines = features.value.split('\n').map((x) => x.trim()).filter(Boolean);
        const body = { template: s.template, service: service.value.trim() || undefined, offer: offer.value.trim() || undefined, quote: quote.value.trim() || undefined, features: lines.length ? lines : undefined, title: title.value.trim() || undefined, cta: cta.value.trim() || undefined };
        const d = await ui().api('/api/saas/reels/plan', { method: 'POST', body: JSON.stringify(body) }); if (run !== epoch) return;
        const p = d.plan; hook.value = p.hook; setHooks(p.hooks); title.value = p.title; if (!lines.length) features.value = p.features.join('\n'); cta.value = p.cta;
        if (!phone.value) phone.value = p.phone || ''; if (!website.value) website.value = p.website || ''; caption.value = p.caption;
        status.textContent = 'Suggestions ready. Change anything you like.';
      } catch (e) { if (run === epoch) status.textContent = e.message; } finally { suggest.disabled = false; }
    }
    suggest.addEventListener('click', plan);
    make.addEventListener('click', async () => {
      const items = picker.value();
      if (!items.length) { status.textContent = 'Add at least one photo or video.'; return; }
      if (hook.value.trim().length < 2) { status.textContent = 'Add a hook, or press “Suggest words”.'; hook.focus(); return; }
      const run = epoch; make.disabled = true; status.textContent = 'Sending…';
      const spec = { template: s.template, aspect_ratio: s.ratio, quality: quality.value, hook: hook.value.trim(), title: title.value.trim(), features: features.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8),
        cta: cta.value.trim(), phone: phone.value.trim(), website: website.value.trim(), items: items.map((media_id) => ({ media_id })), logo_media_id: logo.value || null, accent: accent.value,
        audio: music.value ? { media_id: music.value, volume: 0.8, keep_original: keep.checked } : null, caption: caption.value.trim(), end_card: endCard.checked };
      try {
        await ui().api('/api/saas/reels', { method: 'POST', body: JSON.stringify({ idempotency_key: crypto.randomUUID(), spec }) }); if (run !== epoch) return;
        status.textContent = 'Your reel is being made. It usually takes a minute or two; you can keep working.'; await load();
      } catch (e) { if (run === epoch) status.textContent = e.message; } finally { make.disabled = false; }
    });
    s.refs = { reset: () => { picker.element.dispatchEvent(new Event('oprun:picker-reset')); [service, offer, quote, hook, title, features, cta, phone, website, caption].forEach((x) => { x.value = ''; }); hookPick.replaceChildren(); status.textContent = ''; list.replaceChildren(); }, templates, tHint, sync, logo, music, accent, list, status, setTemplate: (id) => { s.template = id; } };
    return true;
  }

  function card(r) {
    const busy = ['queued', 'processing'].includes(r.status);
    const label = { queued: 'Waiting to start', processing: 'Making your reel…', succeeded: `Ready · ${r.seconds || ''}s`, failed: 'Could not be made', cancelled: 'Cancelled' }[r.status] || r.status;
    const actions = [];
    if (r.status === 'succeeded' && r.preview_url) {
      actions.push(el('a', { class: 'secondary-button compact', href: r.preview_url, download: `${(r.title || 'reel').replace(/[^\w -]/g, '').slice(0, 60) || 'reel'}.mp4`, text: 'Download' }));
      if (r.caption) actions.push(el('button', { type: 'button', class: 'secondary-button compact', text: 'Copy caption', onclick: async (e) => { try { await navigator.clipboard.writeText(r.caption); e.currentTarget.textContent = 'Copied'; } catch { ui().note?.('Copy did not work in this browser.'); } } }));
      actions.push(el('button', { type: 'button', class: 'secondary-button compact', text: 'Create post draft', onclick: () => window.dispatchEvent(new CustomEvent('oprun:studio-publish', { detail: { id: r.media_id, title: r.title, caption: r.caption } })) }));
    }
    if (busy) actions.push(el('button', { type: 'button', class: 'secondary-button compact', text: 'Cancel', onclick: () => act(`/api/saas/reels/${r.id}/cancel`, 'POST') }));
    else actions.push(el('button', { type: 'button', class: 'secondary-button compact', text: 'Clear from list', title: 'The video stays in your media library', onclick: () => act(`/api/saas/reels/${r.id}`, 'DELETE') }));
    return el('div', { class: 'rm-card', 'data-reel': r.id, 'data-status': r.status },
      r.status === 'succeeded' && r.preview_url ? el('video', { src: r.preview_url, controls: true, playsinline: true, preload: 'metadata', class: 'rm-video', 'aria-label': `Reel: ${r.title}` }) : el('div', { class: 'rm-video rm-placeholder', text: busy ? '⏳' : '—' }),
      el('div', { class: 'rm-meta' }, el('b', { text: r.title || 'Reel' }), el('small', { text: `${label} · ${r.aspect_ratio}` }), r.error ? el('small', { class: 'rm-error', text: r.error }) : null, el('div', { class: 'rm-actions' }, ...actions)));
  }
  async function act(url, method) { try { await ui().api(url, { method, body: method === 'POST' ? '{}' : undefined }); await load(); } catch (e) { state.refs.status.textContent = e.message; } }

  async function load() {
    if (!mount()) return;
    const run = epoch, r = state.refs;
    const [d, m] = await Promise.all([ui().api('/api/saas/reels'), ui().api('/api/saas/media').catch(() => ({ media: [] }))]); if (run !== epoch) return;
    if (!r.templates.childElementCount) {
      r.templates.replaceChildren(...d.templates.map((t) => el('button', { type: 'button', role: 'radio', class: 'rm-template', 'data-template': t.id, 'aria-checked': String(t.id === state.template), text: t.label, onclick: (e) => { r.setTemplate(t.id); r.tHint.textContent = t.hint; r.templates.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b === e.currentTarget))); r.sync(); } })));
      r.tHint.textContent = d.templates.find((t) => t.id === state.template)?.hint || ''; r.sync(); if (d.accent) r.accent.value = d.accent;
    }
    const fill = (sel, kinds, first) => { const cur = sel.value; sel.replaceChildren(el('option', { value: '', text: first }), ...(m.media || []).filter((x) => kinds.includes(x.kind)).slice(0, 80).map((x) => el('option', { value: x.id, text: x.original_name || x.id }))); sel.value = cur; };
    fill(r.logo, ['photo'], 'No logo'); fill(r.music, ['audio', 'video'], 'No added voice or music');
    if (!d.available) r.status.textContent = 'Reel making is not available on this server right now.';
    reels = d.reels || [];
    r.list.replaceChildren(...(reels.length ? reels.map(card) : [el('p', { class: 'muted', text: 'No reels yet. Your finished reels appear here and in your media library.' })]));
    clearTimeout(timer); timer = reels.some((x) => ['queued', 'processing'].includes(x.status)) ? setTimeout(() => { if (!$('#video-view')?.hidden) load().catch(() => {}); }, 4000) : null;
  }

  function watch() {
    const view = $('#video-view'); if (!view) return;
    const check = () => { if (!view.hidden) load().catch((e) => { if (state?.refs) state.refs.status.textContent = e.message; }); else { clearTimeout(timer); timer = null; } };
    new MutationObserver(check).observe(view, { attributes: true, attributeFilter: ['hidden'] }); check();
  }
  window.addEventListener('superpro:workspace-ready', () => { epoch++; clearTimeout(timer); timer = null; state?.refs?.reset(); if (!$('#video-view')?.hidden) load().catch(() => {}); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
