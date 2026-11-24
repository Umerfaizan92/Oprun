/* TR-50: Business settings > Guided setup. One question at a time, typed or spoken, in the owner's language.
   Every answer is saved on the server straight away (src/onboarding-interview.js), so closing the browser loses
   nothing: the next visit opens at the first unanswered question. Any answer can be edited later. Nothing here
   changes the workspace; a proposal for review comes from these answers (TR-52). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const make = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else if (k.startsWith('on')) n[k] = v; else n.setAttribute(k, v === true ? '' : v); } n.append(...kids.flat().filter((x) => x != null && x !== false)); return n; };
  const api = async (url, opt = {}) => { const r = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ...(window.SuperProWorkspaceContext?.headers?.() || {}) }, ...opt }); const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(d.error || 'Something went wrong. Try again.'), { data: d, status: r.status }); return d; };
  // English fallbacks; the catalogue (saas/locale-catalog.js, ob.*) supplies other languages.
  const EN = { 'ob.title': 'Guided setup', 'ob.intro': 'Answer in your own words, by typing or speaking, in any language. Each answer is saved straight away, so you can stop and come back later.', 'ob.progress': '{n} of {total} answered', 'ob.welcomeBack': 'Welcome back. Carry on from question {n}.', 'ob.answer': 'Your answer', 'ob.speak': 'Speak', 'ob.stop': 'Stop', 'ob.listening': 'Listening… speak now', 'ob.heard': 'Heard you. Check the text, then save.', 'ob.back': 'Back', 'ob.skip': 'Skip for now', 'ob.save': 'Save answer', 'ob.saved': 'Saved', 'ob.optional': 'Optional', 'ob.edit': 'Edit', 'ob.notAnswered': 'Not answered yet', 'ob.allAnswered': 'All questions answered', 'ob.finish': 'Finish', 'ob.finished': 'Your answers are saved. Oprun will use them to propose a workspace for you to review. Nothing changes until you approve it.', 'ob.yourAnswers': 'Your answers', 'ob.voiceUnavailable': 'Voice is not available in this browser. Type your answer instead.' };
  const t = (key, values = {}) => window.OprunLocale?.t?.(key, values) || String(EN[key] || key).replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
  const locale = () => window.OprunLocale?.locale || document.documentElement.lang || 'en-AU';
  const canAnswer = () => ['owner', 'admin', 'manager', 'super_admin', 'director'].includes(window.GDS_SESSION?.user?.role);

  let data = null, step = 0, listening = false;
  // TR-51: a question may use country or industry wording (q.text, q.hint) and placeholders (q.vars).
  const qText = (q) => t('ob.q.' + (q.text || q.key), q.vars || {});
  const hText = (q) => t('ob.h.' + (q.hint || q.text || q.key), q.vars || {});
  const accept = (d) => { data = { ...data, questions: d.questions || data.questions, context: d.context || data.context, session: d.session }; };

  function render(host) {
    const { questions, session } = data;
    const total = questions.length;
    const progress = make('div', { class: 'ob-progress' },
      make('span', { text: t('ob.progress', { n: session.answered, total }) }),
      make('progress', { max: String(total), value: String(session.answered), 'aria-label': t('ob.progress', { n: session.answered, total }) }));
    const c = data.context;
    const head = make('div', { class: 'panel-head' }, make('div', {}, make('h2', { id: 'ob-title', text: t('ob.title') }), make('p', { class: 'muted', text: t('ob.intro') }),
      c ? make('p', { class: 'muted ob-context', text: t(c.industry_guessed ? 'ob.forBusinessGuess' : 'ob.forBusiness', { industry: c.industry.code === 'custom' ? 'your business' : (/^[A-Z][a-z]/.test(c.industry.label) && !/^[A-Z][a-z]+ [A-Z]/.test(c.industry.label) ? c.industry.label[0].toLowerCase() + c.industry.label.slice(1) : c.industry.label), country: c.country.name }) }) : null));
    const body = make('div', { class: 'ob-body' });
    if (step < total) body.append(questionCard(questions[step], step, total));
    else body.append(doneCard());
    // replaceChildren() would print a null as the word "null", so empty parts are left out first.
    host.replaceChildren(...[head, progress,
      session.answered && step === session.first_unanswered && step < total && !host.dataset.greeted ? make('p', { class: 'ob-resume', role: 'status', text: t('ob.welcomeBack', { n: step + 1 }) }) : null,
      body, summary()].filter(Boolean));
    host.dataset.greeted = '1';
  }

  function questionCard(q, i, total) {
    const a = data.session.answers[q.key];
    const id = 'ob-answer-' + q.key;
    const area = make('textarea', { id, name: 'answer', rows: '4', maxlength: String(q.max), required: q.required, 'aria-describedby': id + '-hint ' + id + '-status' });
    area.value = a?.value || '';
    const status = make('p', { class: 'ob-status', id: id + '-status', role: 'status', 'aria-live': 'polite' });
    let source = a?.source || 'text', heardLanguage = a?.language || null;
    area.addEventListener('input', () => { source = 'text'; });
    const voice = window.SuperProAIClient?.listen;
    const mic = make('button', { type: 'button', class: 'secondary-button ob-mic', 'aria-pressed': 'false', text: t('ob.speak'), disabled: !voice });
    mic.onclick = async () => {
      if (listening) { window.SuperProAIClient.stopListening?.(); return; }
      listening = true; mic.setAttribute('aria-pressed', 'true'); mic.textContent = t('ob.stop'); status.textContent = t('ob.listening');
      try {
        const r = await voice({ language: 'auto', manual: true, onStatus: (msg) => { if (msg) status.textContent = msg; } });
        if (r?.text) { area.value = (area.value.trim() ? area.value.trim() + ' ' : '') + r.text; source = 'voice'; heardLanguage = r.language || null; status.textContent = t('ob.heard'); area.focus(); }
      } catch (e) { status.textContent = e.message || t('ob.voiceUnavailable'); }
      finally { listening = false; mic.setAttribute('aria-pressed', 'false'); mic.textContent = t('ob.speak'); }
    };
    const form = make('form', { class: 'ob-question', 'data-question': q.key },
      make('p', { class: 'ob-step', text: `${t('ob.t.' + q.topic)} · ${i + 1} / ${total}${q.required ? '' : ' · ' + t('ob.optional')}` }),
      make('label', { for: id, class: 'ob-label', text: qText(q) }),
      make('p', { class: 'muted ob-hint', id: id + '-hint', text: hText(q) }),
      area,
      voice ? null : make('p', { class: 'muted', text: t('ob.voiceUnavailable') }),
      make('div', { class: 'ob-actions' },
        i > 0 ? make('button', { type: 'button', class: 'secondary-button', text: t('ob.back'), onclick: () => go(i - 1) }) : null,
        mic,
        !q.required ? make('button', { type: 'button', class: 'secondary-button', text: t('ob.skip'), onclick: () => go(i + 1) }) : null,
        make('button', { type: 'submit', class: 'primary-button', text: t('ob.save'), disabled: !canAnswer() })),
      status);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const value = area.value.trim();
      if (!value && !q.required) return go(i + 1);
      const button = form.querySelector('[type=submit]'); button.disabled = true;
      try {
        const d = await api('/api/saas/onboarding/interview/answers/' + encodeURIComponent(q.key), { method: 'PUT', body: JSON.stringify({ value, source, language: heardLanguage || locale(), revision: data.session.revision }) });
        accept(d); status.textContent = t('ob.saved');
        step = d.session.step; render($('#ob-interview'));
        $('#ob-interview textarea')?.focus();
      } catch (x) { status.textContent = x.message; if (x.data?.session) data.session = x.data.session; button.disabled = false; }
    };
    return form;
  }

  function doneCard() {
    const s = data.session, done = s.status === 'answered';
    const status = make('p', { class: 'ob-status', role: 'status', 'aria-live': 'polite', text: done ? t('ob.finished') : '' });
    const finish = make('button', { type: 'button', class: 'primary-button', text: t('ob.finish'), disabled: done || !canAnswer() || s.missing_required.length > 0 });
    finish.onclick = async () => { finish.disabled = true; try { const d = await api('/api/saas/onboarding/interview/finish', { method: 'POST', body: '{}' }); accept(d); render($('#ob-interview')); } catch (x) { status.textContent = x.message; finish.disabled = false; } };
    const proposalHost = make('div', { class: 'ob-proposal', id: 'ob-proposal' });
    if (done) setTimeout(() => loadProposal(proposalHost), 0);
    return make('div', { class: 'ob-done' }, make('h3', { text: t('ob.allAnswered') }), done ? null : finish, status, proposalHost);
  }

  // ---------- TR-52: proposed workspace, applied only after the owner approves ----------
  const STAGE_EN = { enquiry: 'Enquiry', quotation: 'Quotation', booking: 'Booking', allocation: 'Allocation', execution: 'Execution', completion: 'Completion', invoice: 'Invoice', payment: 'Payment' };
  async function loadProposal(host, d = null) {
    try { d = d || await api('/api/saas/onboarding/proposal'); } catch (x) { host.replaceChildren(make('p', { class: 'muted', text: x.message })); return; }
    const p = d.proposal;
    const remake = make('button', { type: 'button', class: p ? 'secondary-button' : 'primary-button', text: t(p ? 'ob.p.remake' : 'ob.p.prepare') });
    remake.onclick = async () => { remake.disabled = true; remake.textContent = t('ob.p.working'); try { await api('/api/saas/onboarding/proposal', { method: 'POST', body: '{}' }); await loadProposal(host); } catch (x) { remake.disabled = false; remake.textContent = x.message; } };
    if (!p) return host.replaceChildren(remake);
    if (p.status === 'approved') return host.replaceChildren(applied(p));
    if (p.status === 'declined') return host.replaceChildren(make('p', { class: 'muted', text: t('ob.p.declined') }), remake);
    if (p.stale) return host.replaceChildren(make('p', { class: 'ob-resume', role: 'status', text: t('ob.p.stale') }), remake);
    host.replaceChildren(review(p, d, host), make('div', { class: 'ob-actions' }, remake));
  }

  function review(p, d, host) {
    const pr = p.proposal, form = make('form', { class: 'ob-review', 'aria-labelledby': 'ob-p-title' });
    const box = (name, value, checked, label, note) => make('label', { class: 'ob-check' }, make('input', { type: 'checkbox', name, value, checked }), make('span', {}, label, note ? make('small', { class: 'muted', text: ' · ' + note }) : null));
    const section = (title, ...kids) => make('fieldset', { class: 'ob-fieldset' }, make('legend', { text: title }), ...kids);
    form.append(make('h3', { id: 'ob-p-title', text: t('ob.p.title') }), make('p', { class: 'muted', text: t('ob.p.intro') }),
      section(t('ob.p.profile'), make('p', { text: [pr.profile.business_type, t(pr.profile.team_mode === 'solo' ? 'ob.p.teamSolo' : 'ob.p.teamTeam'), pr.profile.service_area].filter(Boolean).join(' · ') }), box('profile', '1', true, t('ob.p.profileApply'))),
      section(t('ob.p.services'), ...pr.services.map((x) => box('service', x, true, x))),
      section(t('ob.p.modules'), ...pr.modules.map((m) => box('module', m.key, m.on, m.label, m.reason === 'solo' ? t('ob.p.reasonSolo') : m.reason === 'not_for_industry' ? t('ob.p.reasonIndustry') : t('ob.p.recommended')))),
      section(t('ob.p.stages'), ...pr.stages.map((st) => { const b = box('stage', st.key, st.on, window.OprunLocale?.t?.(`wg.s.${st.key}.name`) || STAGE_EN[st.key], st.reason === 'solo' ? t('ob.p.reasonSolo') : st.reason ? t('ob.p.reasonIndustry') : null); if (st.key === 'enquiry' || st.key === 'payment') b.querySelector('input').disabled = true; return b; })),
      section(t('ob.p.templates'), ...pr.templates.map((tp) => make('div', { class: 'ob-template' }, box('template', tp.key, true, tp.title, tp.channel === 'sms' ? 'SMS' : 'Email'), make('pre', { class: 'ob-template-body', text: tp.body })))));
    const status = make('p', { class: 'ob-status', id: 'ob-p-status', role: 'status', 'aria-live': 'polite' });
    if (!d.can_approve) { form.append(make('p', { class: 'muted', text: t('ob.p.ownerOnly') })); return form; }
    form.append(section(t('ob.p.consentHeading'), make('label', { class: 'ob-check' }, make('input', { type: 'checkbox', name: 'consent', 'aria-describedby': 'ob-p-status' }), make('span', { text: d.consent.text }))),
      make('div', { class: 'ob-actions' },
        make('button', { type: 'button', class: 'secondary-button', text: t('ob.p.decline'), onclick: async () => { try { await api(`/api/saas/onboarding/proposal/${p.id}/decline`, { method: 'POST', body: '{}' }); await loadProposal(host); } catch (x) { status.textContent = x.message; } } }),
        make('button', { type: 'submit', class: 'primary-button', text: t('ob.p.approve') })), status);
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!form.elements.consent.checked) { status.textContent = t('ob.p.needConsent'); return; }
      const all = (n) => [...form.querySelectorAll(`input[name="${n}"]`)];
      const choices = { profile: form.elements.profile.checked, services: all('service').filter((x) => x.checked).map((x) => x.value), modules: Object.fromEntries(all('module').map((x) => [x.value, x.checked])),
        stages: all('stage').filter((x) => x.checked || x.disabled).map((x) => x.value), templates: all('template').filter((x) => x.checked).map((x) => x.value) };
      const button = form.querySelector('[type=submit]'); button.disabled = true;
      try { const r = await api(`/api/saas/onboarding/proposal/${p.id}/approve`, { method: 'POST', body: JSON.stringify({ consent: true, consent_version: d.consent.version, choices }) }); setTimeout(() => location.reload(), 1500); host.replaceChildren(applied(r.proposal)); }
      catch (x) { status.textContent = x.message; button.disabled = false; }
    };
    return form;
  }

  function applied(p) {
    const when = p.decided_at ? new Date(p.decided_at).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const out = make('div', { class: 'ob-applied' }, make('p', { class: 'ob-resume', role: 'status', text: t('ob.p.applied', { date: when, name: p.decided_by || '' }) }));
    api('/api/saas/workspace-templates').then((d) => { if (!d.templates.length) return;
      out.append(make('h3', { text: t('ob.p.templates') }), ...d.templates.map((tp) => { const copy = make('button', { type: 'button', class: 'secondary-button', text: t('ob.p.copy'), 'aria-label': `${t('ob.p.copy')}: ${tp.title}` });
        copy.onclick = async () => { try { await navigator.clipboard.writeText(tp.body); copy.textContent = t('ob.p.copied'); } catch { /* clipboard blocked: the text stays selectable */ } };
        return make('div', { class: 'ob-template' }, make('div', { class: 'ob-actions' }, make('b', { text: tp.title }), copy), make('pre', { class: 'ob-template-body', text: tp.body })); })); }).catch(() => {});
    return out;
  }

  function summary() {
    const list = make('ol', { class: 'ob-summary' });
    data.questions.forEach((q, i) => {
      const a = data.session.answers[q.key];
      list.append(make('li', { class: i === step ? 'is-current' : '' },
        make('div', {}, make('b', { text: qText(q) }), make('p', { class: a?.value ? '' : 'muted', text: a?.value ? (a.value.length > 160 ? a.value.slice(0, 160) + '…' : a.value) : t('ob.notAnswered') })),
        make('button', { type: 'button', class: 'secondary-button', text: t('ob.edit'), 'aria-label': `${t('ob.edit')}: ${qText(q)}`, onclick: () => go(i) })));
    });
    return make('details', { class: 'ob-answers', open: data.session.answered > 0 }, make('summary', { text: `${t('ob.yourAnswers')} (${data.session.answered})` }), list);
  }

  // Moving between questions is saved too, so the next visit opens where the owner was.
  async function go(i) {
    step = Math.max(0, Math.min(i, data.questions.length));
    render($('#ob-interview'));
    $('#ob-interview textarea')?.focus();
    try { const d = await api('/api/saas/onboarding/interview/step', { method: 'PUT', body: JSON.stringify({ step, revision: data.session.revision }) }); accept(d); } catch (x) { if (x.data?.session) data.session = x.data.session; }
  }

  async function show(force = false) {
    const view = $('#onboarding-view'); if (!view || view.hidden) return;
    let host = $('#ob-interview');
    if (!host) { host = make('article', { class: 'panel ob-interview', id: 'ob-interview', 'aria-labelledby': 'ob-title' }); const heading = view.querySelector('.page-heading'); if (heading) heading.after(host); else view.prepend(host); }
    if (host.dataset.loaded && !force) return; host.dataset.loaded = '1';
    try { data = await api('/api/saas/onboarding/interview'); step = data.session.status === 'answered' ? data.questions.length : data.session.step; render(host); }
    catch (e) { host.replaceChildren(make('p', { class: 'muted', text: e.message })); delete host.dataset.loaded; }
  }
  window.addEventListener('gds:viewchange', () => setTimeout(show, 0));
  window.addEventListener('hashchange', () => setTimeout(show, 50));
  window.addEventListener('oprun:locale-changed', () => { if (data) render($('#ob-interview')); });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => setTimeout(show, 300)) : setTimeout(show, 300);
  window.OprunInterview = { reload: () => show(true) };
})();
