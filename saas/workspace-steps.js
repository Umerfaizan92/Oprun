/* Sequential screens (T-173, docs/product-redesign/03 §4–§5).
   1. Business setup (#onboarding-form): one section per step with "Step N of 8", Back and "Save and continue".
      Each step saves the whole form through its existing submit handler, the step is remembered per business,
      finished sections are ticked, and the last step shows a review with an Edit link per section.
   2. Add worker (#worker-form): on phones only, three short steps (details → role → work rights) before
      "Create worker profile". On tablets and desktops the form stays as one screen.
   Existing element IDs, field names, submit handlers and the settings tabs are reused, never replaced. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const isPhone = () => document.documentElement.dataset.device === 'phone' || (!document.documentElement.dataset.device && innerWidth < 700);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
  const filled = (panel) => $$('input,select,textarea', panel).some((el) => !['hidden', 'file', 'button', 'submit'].includes(el.type) && !el.disabled && (el.type === 'checkbox' ? el.checked : String(el.value || '').trim() !== ''));

  // ---------- 1. Business setup ----------
  function businessSetup() {
    const form = $('#onboarding-form'), content = $('#onboarding-form .settings-content'), tabs = $$('.settings-nav [data-settings-target]');
    if (!form || !content || !tabs.length || form.dataset.steps) return;
    form.dataset.steps = '1';
    // Controls without a name (logo upload, address search) belong to their own buttons, not to this save. Detach
    // them from the form so their own checks (e.g. a logo address) cannot silently block saving the settings.
    for (const el of $$('input,select,textarea', form)) if (!el.name && !el.hasAttribute('form')) el.setAttribute('form', 'oprun-detached-control');
    const panelOf = (b) => document.getElementById(b.dataset.settingsTarget)?.closest('article');
    const steps = tabs.map((b) => ({ tab: b, panel: panelOf(b), title: b.textContent.trim() })).filter((s) => s.panel);
    const key = () => 'oprun-setup-step:' + (window.GDS_SESSION?.organisation?.id || 'workspace');
    let at = Math.min(Math.max(Number(store.get(key())) || 0, 0), steps.length - 1), internal = false, touched = false;

    const head = make('div', 'setup-stepper');
    head.setAttribute('aria-live', 'polite');
    const label = make('p', 'setup-stepper-label'), bar = make('div', 'setup-stepper-bar'), fill = make('span');
    bar.append(fill); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '1'); bar.setAttribute('aria-valuemax', String(steps.length));
    head.append(label, bar);
    const foot = make('div', 'setup-stepper-actions');
    const back = make('button', 'secondary-button', 'Back'); back.type = 'button'; back.id = 'setup-step-back';
    const next = make('button', 'primary-button', 'Save and continue'); next.type = 'button'; next.id = 'setup-step-next';
    foot.append(back, next);
    const review = make('section', 'setup-review'); review.id = 'setup-review'; review.hidden = true; review.setAttribute('aria-labelledby', 'setup-review-title');
    content.prepend(head); content.append(review);
    const sticky = $('.sticky-save', form); (sticky || content).before(foot);

    function paintTicks() { for (const s of steps) { const done = filled(s.panel); s.tab.classList.toggle('is-done', done); s.tab.dataset.done = done ? 'true' : 'false'; } }
    function show(i) {
      at = Math.min(Math.max(i, 0), steps.length - 1); store.set(key(), String(at));
      review.hidden = true; foot.hidden = false; head.hidden = false;
      internal = true; try { steps[at].tab.click(); } finally { internal = false; }
      label.textContent = `Step ${at + 1} of ${steps.length} · ${steps[at].title}`;
      fill.style.width = `${Math.round(((at + 1) / steps.length) * 100)}%`; bar.setAttribute('aria-valuenow', String(at + 1));
      back.disabled = at === 0;
      next.textContent = at === steps.length - 1 ? 'Save and review' : 'Save and continue';
      paintTicks();
    }
    function showReview() {
      paintTicks();
      steps.forEach((s) => { s.panel.hidden = true; });
      foot.hidden = true; head.hidden = true;
      review.replaceChildren(make('h2', '', 'Review your business setup'));
      review.firstChild.id = 'setup-review-title';
      const list = make('ul', 'setup-review-list');
      steps.forEach((s, i) => {
        const done = filled(s.panel), li = make('li', done ? 'is-done' : 'is-todo');
        li.append(make('span', 'setup-review-state', done ? 'Done' : 'To do'), make('b', '', s.title));
        const edit = make('button', 'secondary-button compact', 'Edit'); edit.type = 'button'; edit.addEventListener('click', () => show(i));
        li.append(edit); list.append(li);
      });
      const todo = steps.filter((s) => !filled(s.panel)).length;
      review.append(make('p', 'pl-meta', todo ? `${todo} section${todo === 1 ? '' : 's'} still to do. Everything you entered is saved.` : 'Every section has details. Everything is saved.'), list);
      review.hidden = false; review.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
    // Saving uses the form's own submit handler. Invalid fields keep the person on the step that needs them.
    function save() {
      const bad = [...form.elements].find((el) => el.name && el.willValidate && !el.checkValidity());
      if (bad) { const i = steps.findIndex((s) => s.panel.contains(bad)); if (i >= 0 && i !== at) show(i); bad.reportValidity(); return false; }
      // One quiet confirmation in the step header instead of a pop-up for every step.
      document.documentElement.dataset.quietSave = '1'; clearTimeout(save.t); save.t = setTimeout(() => { delete document.documentElement.dataset.quietSave; }, 4000);
      form.requestSubmit(); return true;
    }
    next.addEventListener('click', () => { if (!save()) return; const saved = steps[at].title; if (at === steps.length - 1) showReview(); else { show(at + 1); label.textContent += ` · ${saved} saved`; } });
    back.addEventListener('click', () => show(at - 1));
    tabs.forEach((b) => b.addEventListener('click', () => { if (!internal) touched = true; const i = steps.findIndex((s) => s.tab === b); if (i >= 0 && i !== at) { at = i; store.set(key(), String(at)); label.textContent = `Step ${at + 1} of ${steps.length} · ${steps[at].title}`; fill.style.width = `${Math.round(((at + 1) / steps.length) * 100)}%`; back.disabled = at === 0; next.textContent = at === steps.length - 1 ? 'Save and review' : 'Save and continue'; review.hidden = true; foot.hidden = false; head.hidden = false; } }));
    form.addEventListener('input', paintTicks);
    // Resume where this business left off, unless the person has already picked a section.
    window.addEventListener('superpro:workspace-ready', () => { if (touched) return; at = Math.min(Number(store.get(key())) || 0, steps.length - 1); show(at); }, { once: true });
    show(at);
  }

  // ---------- 2. Add worker on phones ----------
  function workerForm() {
    const form = $('#worker-form'); if (!form || form.dataset.steps) return;
    form.dataset.steps = '1';
    const field = (name) => form.elements[name]?.closest('label');
    const groups = [
      { title: 'Worker details', fields: ['full_name', 'email', 'phone'] },
      { title: 'Role', fields: ['role_title', 'employment_type', 'worker_level'] },
      { title: 'Work rights', fields: ['work_status'], au: true }
    ];
    const submit = $('button[type="submit"]', form);
    const head = make('p', 'setup-stepper-label worker-step-label'); head.setAttribute('aria-live', 'polite');
    const nav = make('div', 'setup-stepper-actions worker-step-actions full');
    const back = make('button', 'secondary-button', 'Back'); back.type = 'button';
    const next = make('button', 'primary-button', 'Continue'); next.type = 'button';
    nav.append(back, next); form.prepend(head); submit.before(nav);
    let at = 0;
    const active = () => groups.filter((g) => !g.au || (document.documentElement.dataset.country || 'AU') === 'AU');
    function paint() {
      const g = active(), phone = isPhone();
      form.classList.toggle('is-stepped', phone);
      head.hidden = !phone; nav.hidden = !phone;
      at = Math.min(at, g.length - 1);
      for (const [i, grp] of g.entries()) for (const n of grp.fields) { const l = field(n); if (l) l.hidden = phone && i !== at; }
      if (!phone) { for (const grp of groups) for (const n of grp.fields) { const l = field(n); if (l && !(grp.au && !g.includes(grp))) l.hidden = false; } submit.hidden = false; return; }
      head.textContent = `Step ${at + 1} of ${g.length} · ${g[at].title}`;
      back.disabled = at === 0; next.hidden = at === g.length - 1; submit.hidden = at !== g.length - 1;
    }
    next.addEventListener('click', () => {
      const bad = active()[at].fields.map((n) => form.elements[n]).find((el) => el && !el.checkValidity());
      if (bad) { bad.reportValidity(); return; }
      at += 1; paint(); form.elements[active()[at].fields[0]]?.focus();
    });
    back.addEventListener('click', () => { at = Math.max(0, at - 1); paint(); });
    form.addEventListener('reset', () => { at = 0; setTimeout(paint, 0); });
    form.addEventListener('submit', () => setTimeout(() => { if (!form.elements.full_name?.value) { at = 0; paint(); } }, 400));
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-device', 'data-country'] });
    paint();
  }

  function init() { businessSetup(); workerForm(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0)); else setTimeout(init, 0);
  window.OprunSteps = { init };
})();
