// TR-41: Operations → AI automations → AI agents. Oprun's own agents, their scheduled jobs and each job's latest result.
// Data: GET /api/operator/agents. "Run now" uses the existing automation run route; pausing an agent needs
// operations approve. Needs office/console-team.js for shared helpers.
(() => {
  const T = () => window.OprunConsoleTeam.ui;
  const WHEN = { 'schedule.hourly': 'Every hour', 'schedule.daily': 'Every day at 7 am (Perth)', 'schedule.weekly': 'Every Monday at 7 am (Perth)', 'schedule.monthly': 'First of each month', manual: 'Only when run by hand' };
  const time = (x) => new Date(x).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  function result(r) {
    if (!r) return { label: 'Not run yet', cls: '' };
    if (r.status === 'completed' || r.status === 'completed_warning') return r.output?.kind === 'alert' ? { label: 'Needs attention', cls: 'as-blocked' } : { label: 'All clear', cls: 'as-accepted' };
    if (r.status === 'skipped') return { label: 'Nothing to report', cls: '' };
    if (['failed', 'verification_failed', 'blocked'].includes(r.status)) return { label: r.status === 'blocked' ? 'Blocked' : 'Failed', cls: 'as-overdue' };
    return { label: 'Running', cls: '' };
  }

  async function render(host, api, ctx) {
    const { el } = T();
    const d = await api('/api/operator/agents');
    const refresh = () => { host.replaceChildren(); return render(host, api, ctx); };
    const runs = d.agents.flatMap((a) => a.jobs.map((j) => result(j.last_run).label));
    const tile = (label, n, tone) => el('div', { class: 'ex-tile' + (n && tone ? ' ex-' + tone : '') }, el('span', { class: 'ex-label', text: label }), el('b', { class: 'ex-value', text: String(n) }));
    host.append(el('div', { class: 'ex-tiles' },
      tile('Agents', d.agents.length), tile('Active', d.agents.filter((a) => a.status === 'active').length),
      tile('Needing attention', runs.filter((x) => x === 'Needs attention').length, 'warning'), tile('Failed or blocked', runs.filter((x) => x === 'Failed' || x === 'Blocked').length, 'critical')));
    host.append(el('p', { class: 'portal-note', text: 'Each agent may only run the checks on its own list. These checks read Oprun records and write reports; they never send, change or delete anything.' }));
    const list = el('ul', { class: 'as-list', 'aria-label': 'AI agents' });
    for (const a of d.agents) {
      const jobs = el('ul', { class: 'ag-jobs' }, a.jobs.map((j) => {
        const r = j.last_run, s = result(r);
        return el('li', { 'data-job': j.id },
          el('div', { class: 'tm-bar' }, el('b', { text: j.action_label }),
            el('span', { class: 'as-meta' }, el('span', { class: 'as-badge ' + s.cls, text: s.label }), r ? el('span', { text: time(r.updated_at) }) : null)),
          el('small', { class: 'ag-when', text: (WHEN[j.trigger_type] || j.trigger_type) + (j.status !== 'active' ? ` · ${j.status}` : '') }),
          r?.output ? el('details', {}, el('summary', { text: r.output.title }), el('pre', { class: 'ag-body', text: r.output.body })) : r?.error ? el('p', { class: 'tm-note', text: r.error }) : null,
          ctx.can('operations', 'edit') && a.status === 'active' && j.status === 'active' ? el('div', { class: 'tm-actions' }, el('button', { type: 'button', class: 'portal-button', text: 'Run now', 'aria-label': `Run ${j.action_label} now`,
            onclick: async (e) => { e.target.disabled = true; try { await api(`/api/operator/automation/workflows/${j.id}/run`, { method: 'POST', body: '{}' }); ctx.notify(`${j.action_label} started.`); setTimeout(refresh, 800); } catch (x) { ctx.notify(x.message); e.target.disabled = false; } } })) : null);
      }));
      list.append(el('li', { class: 'as-card', 'data-agent': a.key },
        el('div', { class: 'tm-bar' }, el('b', { class: 'as-title', text: a.name }), el('span', { class: 'as-badge ' + (a.status === 'active' ? 'as-accepted' : 'as-blocked'), text: a.status === 'active' ? 'Active' : 'Paused' })),
        el('p', { class: 'tm-note', text: a.responsibilities }),
        a.overdue_runs ? el('p', { class: 'as-alert', text: `${a.overdue_runs} run(s) past the ${a.deadline_minutes}-minute deadline.` }) : null,
        jobs,
        d.can_manage ? el('div', { class: 'tm-actions' }, el('button', { type: 'button', class: 'portal-button', text: a.status === 'active' ? 'Pause agent' : 'Resume agent', 'aria-label': `${a.status === 'active' ? 'Pause' : 'Resume'} ${a.name}`,
          onclick: async () => { try { await api(`/api/operator/agents/${a.id}`, { method: 'PUT', body: JSON.stringify({ status: a.status === 'active' ? 'paused' : 'active', revision: a.revision }) }); ctx.notify(`${a.name} ${a.status === 'active' ? 'paused' : 'resumed'}.`); await refresh(); } catch (x) { ctx.notify(x.message); } } })) : null));
    }
    if (!d.agents.length) list.append(el('li', { class: 'portal-note', text: 'No agents yet.' }));
    host.append(el('section', { class: 'portal-panel cp-section' }, el('h2', { text: 'Oprun agents' }), list));
  }

  window.OprunConsoleAgents = { handles: (r) => r === 'agents/list', render: (r, host, api, ctx) => render(host, api, ctx) };
})();
