// TR-31: Oprun team pages in the Operator Console (group "Oprun team").
//   team/people     People & workload: availability, time off, open work and working hours for Oprun's own staff.
//   team/structure  Departments & teams.
// Data: /api/operator/team. Oprun staff only; subscriber businesses and their workers are never shown here.
(() => {
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v === null || v === undefined || v === false) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  const AVAIL = { available: 'Available', busy: 'Busy', away: 'Away', off: 'Off today' };
  const ROLE = { admin: 'Administrator', billing: 'Billing', support: 'Support', marketing: 'Marketing', maintenance: 'Maintenance', custom: 'Custom access' };
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const KIND = { ticket: ['ticket', 'tickets'], task: ['task', 'tasks'], incident: ['incident', 'incidents'], staff_task: ['team task', 'team tasks'], hire: ['hiring request', 'hiring requests'], prospect: ['prospect', 'prospects'], campaign: ['campaign', 'campaigns'], content: ['content draft', 'content drafts'], cost: ['cost', 'costs'], announcement_draft: ['announcement', 'announcements'] };
  const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '');
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const label = (text, control) => el('label', { class: 'tm-field' }, el('span', { text }), control);
  const status = (a) => el('span', { class: 'tm-avail tm-' + a.status, text: AVAIL[a.status] + (a.until ? ` until ${fmtDate(a.until)}` : '') });

  function dialog(title, body, onSave) {
    const err = el('p', { class: 'tm-error', role: 'alert' });
    const form = el('form', { class: 'tm-form', method: 'dialog' }, ...body, err,
      el('div', { class: 'portal-toolbar' }, el('button', { type: 'button', class: 'portal-button', text: 'Cancel', onclick: () => dlg.close() }), el('button', { type: 'submit', class: 'portal-button primary', text: 'Save' })));
    const dlg = el('dialog', { class: 'portal-modal', 'aria-label': title }, el('h2', { text: title }), form);
    form.onsubmit = async (e) => { e.preventDefault(); err.textContent = ''; const b = form.querySelector('[type=submit]'); b.disabled = true;
      try { await onSave(new FormData(form)); dlg.close(); } catch (x) { err.textContent = x.message; } finally { b.disabled = false; } };
    dlg.onclose = () => dlg.remove(); document.body.append(dlg); dlg.showModal();
    dlg.querySelector('input,select,textarea')?.focus();
  }
  const send = (api, url, method, body) => api(url, { method, body: JSON.stringify(body) });
  const select = (name, options, value, blank) => el('select', { name }, blank !== undefined ? el('option', { value: '', text: blank }) : null,
    options.map(([v, t]) => el('option', { value: v, text: t, selected: v === value })));

  // ---------- People & workload ----------
  async function people(host, api, ctx) {
    const d = await api('/api/operator/team');
    const canEdit = ctx.can('team', 'edit');
    const dept = new Map(d.departments.map((x) => [x.id, x])), team = new Map(d.teams.map((x) => [x.id, x]));
    const active = d.people.filter((p) => p.account === 'active');
    const me = d.people.find((p) => p.id === d.me);
    const counts = { available: 0, busy: 0, away: 0, off: 0 };
    for (const p of active) counts[p.availability.status]++;
    const refresh = () => { host.replaceChildren(); return people(host, api, ctx); };

    const summary = el('div', { class: 'ex-tiles tm-summary' },
      tile('Oprun staff', active.length, `${counts.available} available now`),
      tile('Away or off', counts.away + counts.off, counts.busy ? `${counts.busy} busy` : ''),
      tile('Open work assigned', active.reduce((s, p) => s + p.workload.open, 0), 'Tickets, tasks and incidents'),
      tile('Not assigned yet', d.unassigned_open_items, 'Open items with no owner'));

    const mine = me ? myAvailability(me, api, refresh) : el('p', { class: 'portal-note', text: 'You are signed in with the founder key, which has no staff profile. Staff set their own availability here.' });

    const filter = select('department', d.departments.filter((x) => !x.archived).map((x) => [x.id, x.name]), '', 'All departments');
    filter.setAttribute('aria-label', 'Show department');
    const list = el('ul', { class: 'tm-people', 'aria-label': 'Oprun staff' });
    const paint = () => {
      const f = filter.value;
      const rows = d.people.filter((p) => !f || p.department_id === f || p.team_ids.some((t) => team.get(t)?.department_id === f));
      list.replaceChildren(...(rows.length ? rows.map((p) => person(p)) : [el('li', { class: 'portal-note', text: d.people.length ? 'No staff in this department yet.' : 'No Oprun staff accounts yet. Add them in Founder controls → Operator staff & roles.' })]));
    };
    filter.onchange = paint;

    function person(p) {
      const teams = p.team_ids.map((t) => team.get(t)?.name).filter(Boolean);
      // A department set on the person wins; otherwise show the departments of their teams.
      const deptText = (x) => dept.get(x.department_id)?.name || [...new Set(x.team_ids.map((t) => dept.get(team.get(t)?.department_id)?.name).filter(Boolean))].map((n) => n + ' (through team)').join(', ') || 'Not set';
      const work = Object.entries(p.workload.by_kind).map(([k, n]) => (KIND[k] ? plural(n, KIND[k][0], KIND[k][1]) : `${n} ${k}`)).join(', ');
      const hours = `${p.work_days.map((x) => DAY_NAMES[x]).join(' ')} · ${p.work_start}–${p.work_end}`;
      return el('li', { class: 'tm-person' + (p.account !== 'active' ? ' tm-inactive' : ''), 'data-person': p.id },
        el('div', { class: 'tm-person-head' },
          el('div', {}, el('b', { text: p.name }), el('small', { text: [p.job_title, ROLE[p.role] || p.role].filter(Boolean).join(' · ') })),
          p.account === 'active' ? status(p.availability) : el('span', { class: 'tm-avail', text: 'Sign-in disabled' })),
        el('dl', { class: 'tm-facts' },
          el('div', {}, el('dt', { text: 'Department' }), el('dd', { text: deptText(p) })),
          el('div', {}, el('dt', { text: 'Teams' }), el('dd', { text: teams.join(', ') || 'None' })),
          el('div', {}, el('dt', { text: 'Open work' }), el('dd', { text: p.workload.open || p.workload.waiting ? `${p.workload.open} open${p.workload.waiting ? `, ${p.workload.waiting} waiting` : ''}${work ? ` (${work})` : ''}` : 'Nothing open' })),
          el('div', {}, el('dt', { text: 'Hours' }), el('dd', { text: hours + (p.weekly_capacity_hours != null ? ` · ${p.weekly_capacity_hours} h a week` : '') }))),
        p.availability.note ? el('p', { class: 'tm-note', text: p.availability.note }) : null,
        p.time_off.length ? el('p', { class: 'tm-note', text: 'Time off: ' + p.time_off.map((t) => `${fmtDate(t.starts_on)}–${fmtDate(t.ends_on)}${t.reason ? ` (${t.reason})` : ''}`).join('; ') }) : null,
        canEdit && p.account === 'active' ? el('div', { class: 'tm-actions' }, el('button', { type: 'button', class: 'portal-button', text: 'Edit work details', 'aria-label': `Edit work details for ${p.name}`, onclick: () => editPerson(p) })) : null);
    }

    function editPerson(p) {
      const days = el('fieldset', { class: 'tm-days' }, el('legend', { text: 'Working days' }),
        DAY_NAMES.map((n, i) => el('label', {}, el('input', { type: 'checkbox', name: 'day', value: String(i), checked: p.work_days.includes(i) }), n)));
      dialog(`Work details: ${p.name}`, [
        label('Job title', el('input', { name: 'job_title', value: p.job_title, maxlength: '80' })),
        label('Department', select('department_id', d.departments.filter((x) => !x.archived).map((x) => [x.id, x.name]), p.department_id || '', 'Not set')),
        label('Hours a week', el('input', { name: 'hours', type: 'number', min: '0', max: '80', value: p.weekly_capacity_hours ?? '' })),
        days,
        el('div', { class: 'tm-pair' }, label('Starts', el('input', { name: 'work_start', type: 'time', value: p.work_start })), label('Finishes', el('input', { name: 'work_end', type: 'time', value: p.work_end })))
      ], async (f) => {
        await send(api, `/api/operator/team/people/${encodeURIComponent(p.id)}`, 'PUT', { job_title: f.get('job_title'), department_id: f.get('department_id') || null,
          weekly_capacity_hours: f.get('hours') === '' ? null : Number(f.get('hours')), work_days: f.getAll('day').map(Number), work_start: f.get('work_start'), work_end: f.get('work_end'), revision: p.revision });
        ctx.notify(`Saved work details for ${p.name}.`); await refresh();
      });
    }

    host.append(summary, mine,
      el('section', { class: 'portal-panel cp-section' },
        el('div', { class: 'tm-bar' }, el('h2', { text: 'Oprun staff' }), filter),
        list,
        el('p', { class: 'portal-note', text: d.note })));
    paint();
  }

  function tile(lab, value, sub) { return el('div', { class: 'ex-tile' }, el('span', { class: 'ex-label', text: lab }), el('b', { class: 'ex-value', text: String(value) }), sub ? el('small', { class: 'ex-sub', text: sub }) : null); }

  function myAvailability(me, api, refresh) {
    const until = el('input', { name: 'away_until', type: 'date', value: me.away_until || '' });
    const choice = select('availability', Object.entries(AVAIL), me.set_availability);
    const untilField = label('Back on', until);
    const sync = () => { untilField.hidden = choice.value !== 'away'; };
    choice.onchange = sync;
    const msg = el('p', { class: 'portal-note', role: 'status' });
    const form = el('form', { class: 'tm-inline' },
      label('I am', choice), untilField,
      label('Note for the team (optional)', el('input', { name: 'note', value: me.availability_note, maxlength: '140' })),
      el('button', { type: 'submit', class: 'portal-button primary', text: 'Save availability' }));
    form.onsubmit = async (e) => { e.preventDefault(); const f = new FormData(form);
      try { await send(api, '/api/operator/team/people/me/availability', 'PUT', { availability: f.get('availability'), note: f.get('note') || '', away_until: f.get('availability') === 'away' && f.get('away_until') ? f.get('away_until') : null }); await refresh(); }
      catch (x) { msg.textContent = x.message; } };
    const off = el('form', { class: 'tm-inline' },
      label('First day', el('input', { name: 'starts_on', type: 'date', required: true })),
      label('Last day', el('input', { name: 'ends_on', type: 'date', required: true })),
      label('Reason (optional)', el('input', { name: 'reason', maxlength: '140' })),
      el('button', { type: 'submit', class: 'portal-button', text: 'Add time off' }));
    off.onsubmit = async (e) => { e.preventDefault(); const f = new FormData(off);
      try { await send(api, '/api/operator/team/people/me/time-off', 'POST', { starts_on: f.get('starts_on'), ends_on: f.get('ends_on'), reason: f.get('reason') || '' }); await refresh(); }
      catch (x) { msg.textContent = x.message; } };
    const planned = me.time_off.length ? el('ul', { class: 'tm-offlist' }, me.time_off.map((t) => el('li', {}, `${fmtDate(t.starts_on)}–${fmtDate(t.ends_on)}${t.reason ? ` · ${t.reason}` : ''} `,
      el('button', { type: 'button', class: 'portal-button', text: 'Cancel', 'aria-label': `Cancel time off from ${fmtDate(t.starts_on)}`, onclick: async () => { try { await api(`/api/operator/team/time-off/${encodeURIComponent(t.id)}`, { method: 'DELETE' }); await refresh(); } catch (x) { msg.textContent = x.message; } } })))) : null;
    sync();
    return el('section', { class: 'portal-panel cp-section', 'aria-labelledby': 'tm-me-title' },
      el('div', { class: 'tm-bar' }, el('h2', { id: 'tm-me-title', text: 'My availability' }), status(me.availability)),
      form, el('h3', { class: 'tm-sub', text: 'Planned time off' }), planned, off, msg);
  }

  // ---------- Departments & teams ----------
  async function structure(host, api, ctx) {
    const d = await api('/api/operator/team');
    const canCreate = ctx.can('team', 'create'), canEdit = ctx.can('team', 'edit');
    const staff = d.people.filter((p) => p.account === 'active'), who = new Map(d.people.map((p) => [p.id, p.name]));
    const refresh = () => { host.replaceChildren(); return structure(host, api, ctx); };
    const leadSelect = (v) => select('lead_id', staff.map((p) => [p.id, p.name]), v || '', 'No lead');
    const members = (chosen = []) => el('fieldset', { class: 'tm-members' }, el('legend', { text: 'Members' }),
      staff.length ? staff.map((p) => el('label', {}, el('input', { type: 'checkbox', name: 'member', value: p.id, checked: chosen.includes(p.id) }), p.name)) : el('p', { class: 'portal-note', text: 'No staff accounts yet.' }));

    const editDept = (x) => dialog(x ? `Edit ${x.name}` : 'New department', [
      label('Name', el('input', { name: 'name', required: true, minlength: '2', maxlength: '80', value: x?.name || '' })),
      label('What it does (optional)', el('textarea', { name: 'description', maxlength: '500', rows: '3' }, x?.description || '')),
      label('Lead', leadSelect(x?.lead_id)),
      x ? el('label', { class: 'tm-check' }, el('input', { type: 'checkbox', name: 'archived', checked: !!x.archived }), 'Archived (hidden from choices; nothing is deleted)') : null
    ], async (f) => {
      const body = { name: f.get('name'), description: f.get('description') || '', lead_id: f.get('lead_id') || null };
      if (x) await send(api, `/api/operator/team/departments/${x.id}`, 'PUT', { ...body, archived: f.get('archived') === 'on', revision: x.revision });
      else await send(api, '/api/operator/team/departments', 'POST', body);
      ctx.notify(x ? 'Department saved.' : 'Department added.'); await refresh();
    });
    const editTeam = (x, deptId) => dialog(x ? `Edit ${x.name}` : 'New team', [
      label('Name', el('input', { name: 'name', required: true, minlength: '2', maxlength: '80', value: x?.name || '' })),
      label('Department', select('department_id', d.departments.filter((y) => !y.archived).map((y) => [y.id, y.name]), x?.department_id || deptId)),
      label('What it does (optional)', el('textarea', { name: 'description', maxlength: '500', rows: '2' }, x?.description || '')),
      label('Lead', leadSelect(x?.lead_id)),
      members(x?.members),
      x ? el('label', { class: 'tm-check' }, el('input', { type: 'checkbox', name: 'archived', checked: !!x.archived }), 'Archived (nothing is deleted)') : null
    ], async (f) => {
      const body = { name: f.get('name'), department_id: f.get('department_id'), description: f.get('description') || '', lead_id: f.get('lead_id') || null, members: f.getAll('member') };
      if (x) await send(api, `/api/operator/team/teams/${x.id}`, 'PUT', { ...body, archived: f.get('archived') === 'on', revision: x.revision });
      else await send(api, '/api/operator/team/teams', 'POST', body);
      ctx.notify(x ? 'Team saved.' : 'Team added.'); await refresh();
    });

    const top = el('div', { class: 'tm-bar' }, el('p', { class: 'portal-note', text: `${plural(d.departments.filter((x) => !x.archived).length, 'department', 'departments')}, ${plural(d.teams.filter((x) => !x.archived).length, 'team', 'teams')}. For Oprun's own staff only.` }),
      canCreate ? el('button', { type: 'button', class: 'portal-button primary', text: 'Add department', onclick: () => editDept(null) }) : null);
    host.append(top);
    if (!d.departments.length) host.append(el('section', { class: 'portal-panel cp-section' }, el('h2', { text: 'No departments yet' }), el('p', { class: 'portal-note', text: canCreate ? 'Add a department such as Support, Sales or Engineering, then add its teams.' : 'Departments will appear here once they are added.' })));
    for (const x of d.departments) {
      const teams = d.teams.filter((t) => t.department_id === x.id);
      host.append(el('section', { class: 'portal-panel cp-section tm-dept' + (x.archived ? ' tm-inactive' : ''), 'data-department': x.id },
        el('div', { class: 'tm-bar' },
          el('div', {}, el('h2', { text: x.name + (x.archived ? ' (archived)' : '') }), el('small', { text: `Lead: ${who.get(x.lead_id) || 'not set'}` })),
          el('div', { class: 'tm-actions' },
            canEdit ? el('button', { type: 'button', class: 'portal-button', text: 'Edit', 'aria-label': `Edit department ${x.name}`, onclick: () => editDept(x) }) : null,
            canCreate && !x.archived ? el('button', { type: 'button', class: 'portal-button', text: 'Add team', 'aria-label': `Add a team to ${x.name}`, onclick: () => editTeam(null, x.id) }) : null)),
        x.description ? el('p', { class: 'tm-note', text: x.description }) : null,
        teams.length ? el('ul', { class: 'tm-teams' }, teams.map((t) => el('li', { 'data-team': t.id, class: t.archived ? 'tm-inactive' : '' },
          el('div', {}, el('b', { text: t.name + (t.archived ? ' (archived)' : '') }), el('small', { text: `Lead: ${who.get(t.lead_id) || 'not set'} · ${plural(t.members.length, 'member', 'members')}` }),
            t.members.length ? el('p', { class: 'tm-note', text: t.members.map((m) => who.get(m)).filter(Boolean).join(', ') }) : null),
          canEdit ? el('button', { type: 'button', class: 'portal-button', text: 'Edit', 'aria-label': `Edit team ${t.name}`, onclick: () => editTeam(t) }) : null)))
          : el('p', { class: 'portal-note', text: 'No teams in this department yet.' })));
    }
  }

  const renderers = { 'team/people': people, 'team/structure': structure };
  // Shared small UI helpers, also used by console-assignments.js.
  window.OprunConsoleTeam = { ui: { el, dialog, label, select, status, fmtDate, plural }, handles: (route) => Object.prototype.hasOwnProperty.call(renderers, route), render: (route, host, api, ctx) => renderers[route](host, api, ctx) };
})();
