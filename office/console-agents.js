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

  // ---------- TR-42: Agent Command Center ----------
  async function center(host, api, ctx) {
    const { el, dialog, label } = T();
    const d = await api('/api/operator/agents/center');
    const refresh = () => { host.replaceChildren(); return center(host, api, ctx); };
    const c = d.counts, rate = c.runs_7d ? Math.round((c.success_7d / c.runs_7d) * 100) + '%' : '—';
    const tile = (lab, n, tone) => el('div', { class: 'ex-tile' + (n && tone && n !== '—' ? ' ex-' + tone : '') }, el('span', { class: 'ex-label', text: lab }), el('b', { class: 'ex-value', text: String(n) }));
    // MB-13: the AI Supervisor's own status first, so a stopped supervisor is never missed.
    const sv = d.supervisor;
    if (sv) host.append(el('p', { class: 'sv-status ' + (sv.running ? 'sv-ok' : 'sv-stopped'), role: 'status', 'data-supervisor-status': sv.running ? 'running' : 'stopped' },
      el('span', { class: 'sv-dot', 'aria-hidden': 'true' }), el('b', { text: sv.running ? 'AI Supervisor is checking' : 'AI Supervisor needs attention' }), ' ',
      el('span', { text: sv.message + (sv.last_check_at ? ` Last check ${time(sv.last_check_at)}.` : '') }),
      d.can_run ? el('button', { type: 'button', class: 'portal-button', text: 'Check now', onclick: async (e) => { e.target.disabled = true; try { await api('/api/operator/agents/supervisor/check', { method: 'POST', body: '{}' }); ctx.notify('The AI Supervisor checked the agents and background jobs.'); await refresh(); } catch (err) { e.target.disabled = false; ctx.notify(err.message || 'The check did not run.'); } } }) : null));
    host.append(el('div', { class: 'ex-tiles' }, ...(sv ? [tile('Open findings', sv.open_findings, 'critical')] : []), tile('Escalated', c.escalated_open, 'critical'), tile('Waiting for approval', c.waiting_approval, 'warning'), tile('Failed (24 h)', c.failed_24h, 'critical'),
      tile('Queued', c.queued), tile('Running', c.running), tile('Success (7 days)', rate)));
    const STATUS = { received: 'Starting', queued: 'Queued', executing: 'Running', approved: 'Approved, waiting to run', held: 'Held (automation paused)', failed: 'Failed', verification_failed: 'Check failed', blocked: 'Blocked' };
    const runItem = (r, extra = []) => el('li', { class: 'as-card', 'data-run': r.id },
      el('div', { class: 'tm-bar' }, el('b', { class: 'as-title', text: `${r.agent}: ${r.action_label}` }), el('span', { class: 'as-badge ' + (/fail|block/.test(r.status) ? 'as-overdue' : ''), text: STATUS[r.status] || r.status })),
      el('p', { class: 'as-meta' }, el('span', { text: time(r.updated_at) })), r.error ? el('p', { class: 'tm-note', text: r.error }) : null, ...extra);
    const section = (title, items, empty) => el('section', { class: 'portal-panel cp-section' }, el('h2', { text: `${title} (${items.length})` }), items.length ? el('ul', { class: 'as-list' }, items) : el('p', { class: 'portal-note', text: empty }));

    const act = (e, action) => () => dialog(`${action === 'resolve' ? 'Resolve' : 'Acknowledge'}: ${e.agent}`, [label(action === 'resolve' ? 'What was done?' : 'Note (optional)', el('textarea', { name: 'note', rows: '2', maxlength: '1000', required: action === 'resolve', minlength: action === 'resolve' ? '5' : null }))],
      async (f) => { await api(`/api/operator/agents/escalations/${e.id}`, { method: 'POST', body: JSON.stringify({ action, note: f.get('note') || '' }) }); ctx.notify(action === 'resolve' ? 'Marked resolved.' : 'Acknowledged.'); await refresh(); });
    const KIND = { failed: 'Failed', blocked: 'Blocked', overdue: 'Late' };
    if (sv) {
      const KIND = { dead_job: 'Background job gave up', repeated_failures: 'Agent keeps failing' };
      const items = sv.findings.map((f) => el('li', { class: 'as-card' + (f.status === 'open' ? ' as-late' : ''), 'data-finding': f.id },
        el('div', { class: 'tm-bar' }, el('b', { class: 'as-title', text: f.title }), el('span', { class: 'as-badge' + (f.status === 'open' ? ' as-overdue' : ''), text: f.status === 'open' ? KIND[f.kind] || 'Open' : 'Resolved' })),
        el('p', { class: 'tm-note', text: f.detail }), el('p', { class: 'as-meta' }, el('span', { text: f.status === 'open' ? `First seen ${time(f.first_seen)}` : `Resolved ${time(f.resolved_at)}` }))));
      const day = sv.daily;
      const panel = section('Supervisor findings', items, 'Nothing needs attention. Findings clear by themselves once the cause is fixed.');
      if (day) panel.append(el('p', { class: 'portal-note', 'data-supervisor-daily': day.day, text: `Daily summary ${day.day}: ${day.runs_7d} agent runs in 7 days (${day.runs_7d ? Math.round((day.success_7d / day.runs_7d) * 100) + '% succeeded' : 'none yet'}), ${day.failed_24h} failed in 24 h, ${day.waiting_approval} waiting for approval, ${day.escalated_open} open escalations.` }));
      host.append(panel);
    }
    host.append(section('Escalations', d.escalations.map((e) => el('li', { class: 'as-card' + (e.status === 'open' ? ' as-late' : ''), 'data-escalation': e.id },
      el('div', { class: 'tm-bar' }, el('b', { class: 'as-title', text: `${e.agent}: ${KIND[e.kind]}` }), el('span', { class: 'as-badge ' + (e.status === 'open' ? 'as-overdue' : e.status === 'resolved' ? 'as-accepted' : 'as-blocked'), text: e.status === 'open' ? 'Open' : e.status === 'resolved' ? 'Resolved' : 'Acknowledged' })),
      el('p', { class: 'tm-note', text: e.reason }),
      el('p', { class: 'as-meta' }, el('span', { text: `Sent to ${e.contact}${e.assigned ? ' (also in their My work)' : ''} · ${time(e.created_at)}` })),
      e.note ? el('p', { class: 'tm-note', text: 'Note: ' + e.note }) : null,
      ctx.can('operations', 'edit') && e.status !== 'resolved' ? el('div', { class: 'tm-actions' },
        e.status === 'open' ? el('button', { type: 'button', class: 'portal-button', text: 'Acknowledge', 'aria-label': `Acknowledge ${e.agent} escalation`, onclick: act(e, 'acknowledge') }) : null,
        el('button', { type: 'button', class: 'portal-button', text: 'Resolve', 'aria-label': `Resolve ${e.agent} escalation`, onclick: act(e, 'resolve') })) : null)), 'No escalations in the last 7 days.'));

    // Needs a decision: level 3 actions wait here; level 4 is never offered.
    const decide = (r, decision) => async () => {
      if (decision === 'reject') return dialog(`Reject: ${r.title}`, [label('Why (optional)', el('textarea', { name: 'note', rows: '2', maxlength: '2000' }))], async (f) => {
        await api(`/api/operator/automation/approvals/${r.approval_id}/decision`, { method: 'POST', body: JSON.stringify({ decision: 'reject', note: f.get('note') || '' }) }); ctx.notify('Rejected. Nothing was done.'); await refresh(); });
      try { await api(`/api/operator/automation/approvals/${r.approval_id}/decision`, { method: 'POST', body: JSON.stringify({ decision: 'approve' }) }); ctx.notify('Approved.'); await refresh(); } catch (x) { ctx.notify(x.message); }
    };
    host.append(section('Needs a decision', d.waiting.map((r) => runItem(r, [
      el('p', { class: 'as-body', text: r.summary || '' }),
      el('p', { class: 'as-meta' }, el('span', { class: 'as-badge as-blocked', text: `Level ${r.policy_level} · ${r.risk_level} risk` }), el('span', { text: `${r.reference_code} · expires ${time(r.expires_at)}` })),
      d.can_approve ? el('div', { class: 'tm-actions' }, el('button', { type: 'button', class: 'portal-button primary', text: 'Approve', 'aria-label': `Approve ${r.title}`, onclick: decide(r, 'approve') }), el('button', { type: 'button', class: 'portal-button', text: 'Reject', 'aria-label': `Reject ${r.title}`, onclick: decide(r, 'reject') }))
        : el('p', { class: 'portal-note', text: 'Someone with operations approval rights must decide this.' })])), 'No agent action is waiting for approval. Actions at level 3 always wait here; level 4 actions are never run.'));

    host.append(section('Queue and running', d.queue.map((r) => runItem(r)), 'Nothing is queued or running.'));
    host.append(section('Failed in the last 7 days', d.failed.map((r) => runItem(r)), 'No failed agent runs in the last 7 days.'));

    const table = el('table', { class: 'ag-perf' }, el('caption', { class: 'sr-only', text: 'Agent performance over the last 7 days' }),
      el('thead', {}, el('tr', {}, ['Agent', 'Runs', 'Success', 'Average time', 'Last failure'].map((h) => el('th', { scope: 'col', text: h })))),
      el('tbody', {}, d.performance.map((p) => el('tr', {}, el('th', { scope: 'row', text: p.name + (p.status !== 'active' ? ' (paused)' : '') }), el('td', { text: String(p.runs || 0) }),
        el('td', { text: p.success_rate == null ? '—' : p.success_rate + '%' }), el('td', { text: p.avg_seconds == null ? '—' : p.avg_seconds + ' s' }), el('td', { text: p.last_failure ? time(p.last_failure) : 'None' })))));
    host.append(el('section', { class: 'portal-panel cp-section' }, el('h2', { text: 'Performance (7 days)' }), el('div', { class: 'ag-perf-wrap' }, table)));
  }

  window.OprunConsoleAgents = { handles: (r) => r === 'agents/list' || r === 'agents/center', render: (r, host, api, ctx) => (r === 'agents/center' ? center(host, api, ctx) : render(host, api, ctx)) };
})();
