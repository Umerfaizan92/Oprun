// TR-32: assignment and tracking pages in the Operator Console.
//   team/assignments  Oprun team → Assignments: assign work, see progress, review completed work.
//   work/mine         My work: what is assigned to me; start, report a blocker, complete with evidence.
// Also adds an Assign button to enquiries, tickets, tasks, incidents, team tasks and projects (decorate()).
// Data: /api/operator/assignments. Needs office/console-team.js for shared helpers.
(() => {
  const T = () => window.OprunConsoleTeam.ui;
  const STATE = { assigned: 'Not started', in_progress: 'In progress', blocked: 'Blocked', done: 'Waiting for review', reopened: 'Reopened', accepted: 'Done' };
  const PRIORITY = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
  const send = (api, url, body) => api(url, { method: 'POST', body: JSON.stringify(body) });

  function badge(text, cls) { return T().el('span', { class: 'as-badge ' + (cls || ''), text }); }
  function meta(i) {
    const { el, fmtDate } = T();
    return el('p', { class: 'as-meta' },
      badge(STATE[i.state] || i.state, 'as-' + i.state),
      i.overdue ? badge('Overdue', 'as-overdue') : null,
      i.priority !== 'normal' ? badge(PRIORITY[i.priority] + ' priority', 'as-p-' + i.priority) : null,
      el('span', { text: [i.kind_label, i.assignee ? `For ${i.assignee}` : null, i.due_on ? `Due ${fmtDate(i.due_on)}` : 'No due date'].filter(Boolean).join(' · ') }));
  }

  async function details(api, id, ctx, after) {
    const { el, dialog, fmtDate } = T();
    const d = await api(`/api/operator/assignments/${encodeURIComponent(id)}`);
    const i = d.item;
    const when = (x) => new Date(x).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const ACT = { assigned: 'Assigned', reassigned: 'Reassigned', updated: 'Assignment changed', started: 'Started', blocked: 'Blocked', completed: 'Marked complete', accepted: 'Accepted', reopened: 'Reopened' };
    const body = [meta(i),
      i.body ? el('p', { class: 'as-body', text: i.body }) : null,
      i.state === 'done' || i.state === 'accepted' ? el('section', { class: 'as-evidence', 'aria-label': 'Completion' },
        el('h3', { text: 'Completion' }), el('p', { text: i.completion_note || '' }),
        i.evidence_url ? el('p', {}, el('a', { href: i.evidence_url, target: '_blank', rel: 'noopener noreferrer', text: 'Open evidence link' })) : el('p', { class: 'portal-note', text: 'No evidence link given.' }),
        i.reviewed_by ? el('p', { class: 'portal-note', text: `Reviewed by ${i.reviewed_by}` }) : null) : null,
      el('h3', { text: 'History' }),
      el('ol', { class: 'as-history' }, d.history.map((h) => el('li', {}, el('b', { text: ACT[h.action] || h.action }), ` · ${h.actor} · ${when(h.created_at)}`, h.note ? el('p', { text: h.note }) : null)))];
    const reviewer = i.state === 'done' && ctx.review;
    if (reviewer) body.push(el('label', { class: 'tm-field' }, el('span', { text: 'Note (needed to reopen)' }), el('textarea', { name: 'note', rows: '2', maxlength: '1000' })),
      el('fieldset', { class: 'tm-days' }, el('legend', { text: 'Decision' }),
        el('label', {}, el('input', { type: 'radio', name: 'decision', value: 'accept', checked: true }), 'Accept and close'),
        el('label', {}, el('input', { type: 'radio', name: 'decision', value: 'reopen' }), 'Reopen')));
    dialog(i.title, body, async (f) => {
      if (!reviewer) return;
      await send(api, `/api/operator/assignments/${i.id}/review`, { decision: f.get('decision'), note: f.get('note') || '', revision: i.revision });
      ctx.notify(f.get('decision') === 'accept' ? 'Accepted and closed.' : 'Reopened. The assignee will see your note.');
      await after();
    });
    if (!reviewer) { const save = document.querySelector('dialog[open] [type=submit]'); if (save) save.textContent = 'Close'; }
    else document.querySelector('dialog[open] [type=submit]').textContent = 'Save decision';
  }

  function assignDialog(api, ctx, data, { record = null, after }) {
    const { el, dialog, label, select } = T();
    const kinds = data.kinds.filter((k) => (record ? k.kind === record.kind && k.can_assign : k.can_create));
    const people = (kind) => data.assignees.filter((p) => p.areas.includes(data.kinds.find((k) => k.kind === kind)?.area));
    const who = el('select', { name: 'assignee_id', required: true });
    const fill = (kind) => { const list = people(kind); who.replaceChildren(...(list.length ? list.map((p) => el('option', { value: p.id, text: p.name, selected: p.id === record?.assigned_to })) : [el('option', { value: '', text: 'No staff can open this type of work yet' })])); };
    const kindSel = select('kind', kinds.map((k) => [k.kind, k.label]), record?.kind || kinds[0]?.kind);
    kindSel.onchange = () => fill(kindSel.value);
    fill(record?.kind || kinds[0]?.kind);
    const min = new Date().toISOString().slice(0, 10);
    dialog(record ? `Assign: ${record.title}` : 'New assignment', [
      record ? null : label('Type of work', kindSel),
      record ? null : label('Title', el('input', { name: 'title', required: true, minlength: '2', maxlength: '200' })),
      record ? null : label('Details (optional)', el('textarea', { name: 'body', rows: '3', maxlength: '15000' })),
      label('Who does it', who),
      el('div', { class: 'tm-pair' }, label('Due date (optional)', el('input', { name: 'due_on', type: 'date', min, value: record?.due_on || '' })), label('Priority', select('priority', Object.entries(PRIORITY), record?.priority || 'normal'))),
      label('Note for them (optional)', el('textarea', { name: 'note', rows: '2', maxlength: '1000' })),
      el('p', { class: 'portal-note', text: 'Only staff who can open this type of work are listed. They will see it under My work.' })
    ], async (f) => {
      const body = { assignee_id: f.get('assignee_id'), due_on: f.get('due_on') || null, priority: f.get('priority'), note: f.get('note') || '' };
      if (!body.assignee_id) throw new Error('Choose who does it.');
      if (record) await send(api, `/api/operator/assignments/${record.id}/assign`, { ...body, revision: record.revision });
      else await send(api, '/api/operator/assignments', { ...body, kind: f.get('kind'), title: f.get('title'), body: f.get('body') || '' });
      ctx.notify('Assigned. It now shows under their My work.');
      await after();
    });
  }

  // ---------- Oprun team → Assignments ----------
  async function manage(host, api, ctx, filter = 'open') {
    const { el } = T();
    const d = await api('/api/operator/assignments?state=' + filter);
    const refresh = () => { host.replaceChildren(); return manage(host, api, ctx, filter); };
    const tile = (label, n, tone) => el('div', { class: 'ex-tile' + (n && tone ? ' ex-' + tone : '') }, el('span', { class: 'ex-label', text: label }), el('b', { class: 'ex-value', text: String(n) }));
    const tiles = el('div', { class: 'ex-tiles' }, tile('Open', d.counts.open), tile('Waiting for review', d.counts.review, 'warning'), tile('Overdue', d.counts.overdue, 'critical'), tile('Blocked', d.counts.blocked, 'warning'));
    const tabs = el('div', { class: 'as-tabs', role: 'group', 'aria-label': 'Show' }, [['open', 'Open'], ['review', 'Waiting for review'], ['closed', 'Done'], ['all', 'All']].map(([f, t]) =>
      el('button', { type: 'button', class: 'portal-button' + (filter === f ? ' is-active' : ''), 'aria-pressed': String(filter === f), text: t, onclick: () => { filter = f; refresh(); } })));
    const canNew = d.kinds.some((k) => k.can_create);
    const bar = el('div', { class: 'tm-bar' }, el('p', { class: 'portal-note', text: 'Work you hand to Oprun staff, with due dates and proof of completion.' }),
      canNew ? el('button', { type: 'button', class: 'portal-button primary', text: 'New assignment', onclick: () => assignDialog(api, ctx, d, { after: refresh }) }) : null);
    const list = el('ul', { class: 'as-list', 'aria-label': 'Assignments' });
    for (const i of d.items) list.append(card(i, [
      el('button', { type: 'button', class: 'portal-button' + (i.state === 'done' ? ' primary' : ''), text: i.state === 'done' ? 'Review' : 'Details', 'aria-label': `${i.state === 'done' ? 'Review' : 'Details for'} ${i.title}`, onclick: () => details(api, i.id, { ...ctx, review: true }, refresh).catch((x) => ctx.notify(x.message)) }),
      d.kinds.find((k) => k.kind === i.kind)?.can_assign && i.state !== 'accepted' && i.state !== 'done' ? el('button', { type: 'button', class: 'portal-button', text: 'Reassign', 'aria-label': `Reassign ${i.title}`, onclick: () => assignDialog(api, ctx, d, { record: i, after: refresh }) }) : null]));
    if (!d.items.length) list.append(el('li', { class: 'portal-note', text: filter === 'review' ? 'Nothing is waiting for your review.' : filter === 'open' ? 'No open assignments.' : 'Nothing here yet.' }));
    host.append(tiles, el('section', { class: 'portal-panel cp-section' }, bar, tabs, list));
  }

  function card(i, actions) {
    const { el } = T();
    return el('li', { class: 'as-card' + (i.overdue ? ' as-late' : ''), 'data-assignment': i.id },
      el('b', { class: 'as-title', text: i.title }), meta(i),
      i.state === 'blocked' || i.state === 'reopened' ? el('p', { class: 'tm-note', text: i.state === 'blocked' ? 'Blocked — open Details to see why.' : 'Reopened — open Details to see what is still needed.' }) : null,
      el('div', { class: 'tm-actions' }, actions));
  }

  // ---------- My work ----------
  async function mine(host, api, ctx) {
    const { el, dialog, label } = T();
    const d = await api('/api/operator/assignments/mine');
    const refresh = () => { host.replaceChildren(); return mine(host, api, ctx); };
    const open = d.items.filter((i) => i.state !== 'accepted' && i.state !== 'done');
    const waiting = d.items.filter((i) => i.state === 'done'), done = d.items.filter((i) => i.state === 'accepted');
    const step = (i, state) => async () => {
      if (state === 'blocked') return dialog(`Blocked: ${i.title}`, [label('What is blocking you?', el('textarea', { name: 'note', required: true, minlength: '5', rows: '3', maxlength: '1000' }))],
        async (f) => { await send(api, `/api/operator/assignments/${i.id}/progress`, { state, note: f.get('note'), revision: i.revision }); ctx.notify('Marked as blocked. The person who assigned it can see your note.'); await refresh(); });
      try { await send(api, `/api/operator/assignments/${i.id}/progress`, { state, revision: i.revision }); await refresh(); } catch (x) { ctx.notify(x.message); }
    };
    const complete = (i) => dialog(`Complete: ${i.title}`, [
      label('What did you do?', el('textarea', { name: 'note', required: true, minlength: '10', rows: '4', maxlength: '4000' })),
      label('Evidence link (optional, https://)', el('input', { name: 'evidence_url', type: 'url', pattern: 'https://.*', maxlength: '500', placeholder: 'https://' })),
      el('p', { class: 'portal-note', text: 'The person who assigned it reviews this and either accepts it or reopens it.' })
    ], async (f) => { await send(api, `/api/operator/assignments/${i.id}/complete`, { note: f.get('note'), evidence_url: f.get('evidence_url') || null, revision: i.revision }); ctx.notify('Sent for review.'); await refresh(); });
    const actions = (i) => [
      i.state === 'assigned' || i.state === 'reopened' || i.state === 'blocked' ? el('button', { type: 'button', class: 'portal-button', text: i.state === 'blocked' ? 'Unblocked' : 'Start', 'aria-label': `${i.state === 'blocked' ? 'Mark unblocked' : 'Start'}: ${i.title}`, onclick: step(i, 'in_progress') }) : null,
      i.state !== 'blocked' ? el('button', { type: 'button', class: 'portal-button', text: 'Blocked', 'aria-label': `Report a blocker: ${i.title}`, onclick: step(i, 'blocked') }) : null,
      el('button', { type: 'button', class: 'portal-button primary', text: 'Mark complete', 'aria-label': `Mark complete: ${i.title}`, onclick: () => complete(i) }),
      el('button', { type: 'button', class: 'portal-button', text: 'Details', 'aria-label': `Details for ${i.title}`, onclick: () => details(api, i.id, ctx, refresh).catch((x) => ctx.notify(x.message)) })];
    const section = (title, items, empty, act) => el('section', { class: 'portal-panel cp-section' }, el('h2', { text: `${title} (${items.length})` }),
      items.length ? el('ul', { class: 'as-list' }, items.map((i) => card(i, act(i)))) : el('p', { class: 'portal-note', text: empty }));
    const detailsOnly = (i) => [el('button', { type: 'button', class: 'portal-button', text: 'Details', 'aria-label': `Details for ${i.title}`, onclick: () => details(api, i.id, ctx, refresh).catch((x) => ctx.notify(x.message)) })];
    host.append(
      section('To do', open, ctx.isFounder ? 'The founder key has no staff profile, so nothing is assigned to it. Staff see their work here.' : 'Nothing assigned to you right now.', actions),
      section('Waiting for review', waiting, 'Nothing waiting for review.', detailsOnly),
      section('Accepted in the last 14 days', done, 'Nothing accepted recently.', detailsOnly));
  }

  // Assign button on record pages (enquiries, tickets, tasks, incidents, team tasks, projects).
  let cache = null;
  async function decorate(panelEl, record, kind, ctx) {
    if (!ctx.can('team', 'edit') || !ctx.can('team', 'read')) return;
    try { cache = cache && Date.now() - cache.at < 15000 ? cache : { at: Date.now(), d: await ctx.api('/api/operator/assignments?state=all') }; } catch { return; }
    const k = cache.d.kinds.find((x) => x.kind === kind); if (!k?.can_assign) return;
    const { el, fmtDate } = T();
    const current = cache.d.items.find((x) => x.id === record.id);
    if (current) panelEl.append(el('p', { class: 'as-meta' }, badge(STATE[current.state] || current.state, 'as-' + current.state), el('span', { text: `For ${current.assignee || 'unknown'}${current.due_on ? ` · due ${fmtDate(current.due_on)}` : ''}` })));
    if (current?.state === 'done' || current?.state === 'accepted') return;
    panelEl.append(el('div', { class: 'tm-actions' }, el('button', { type: 'button', class: 'portal-button', text: current ? 'Reassign' : 'Assign', 'aria-label': `${current ? 'Reassign' : 'Assign'} ${record.title}`,
      onclick: () => assignDialog(ctx.api, ctx, cache.d, { record: current || { ...record, kind }, after: async () => { cache = null; await ctx.refresh(); } }) })));
  }

  const renderers = { 'team/assignments': manage, 'work/mine': mine };
  window.OprunAssignments = { handles: (r) => Object.prototype.hasOwnProperty.call(renderers, r), render: (r, host, api, ctx) => renderers[r](host, api, ctx), decorate, kinds: ['prospect', 'ticket', 'task', 'incident', 'staff_task', 'project'] };
})();
