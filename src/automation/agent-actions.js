// TR-41: report actions used by Oprun's own AI agents (src/agents/defaults.js).
// All are level 1 and write only an internal report or alert to AI suggestions and reports (automation_outputs).
// They read counts from Oprun's records; no customer names, emails or message text are copied into a report.
// A table that does not exist yet is reported as "not recorded" instead of failing the run.
import { z } from 'zod';

const DAY = 86400000, HOUR = 3600000;
const iso = (t) => new Date(t).toISOString();
const P = z.object({}).strict();
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// Count with a query; null if the table or column is missing.
function count(ctx, sql, ...args) { try { const r = ctx.db.prepare(sql).get(...args); return r ? Number(Object.values(r)[0] || 0) : 0; } catch { return null; } }
function rows(ctx, sql, ...args) { try { return ctx.db.prepare(sql).all(...args); } catch { return null; } }
const now = (ctx) => (ctx.deps.clock ? ctx.deps.clock() : Date.now());

function report(label, triggers, data_involved, analyse, link = '#f01/platform/automation') {
  return {
    scope: 'platform', label, capability: null, level: 1, effect: 'output', feature: 'operations', triggers: [...triggers, 'manual'], params: P,
    analyse(ctx) { const r = analyse(ctx); return { title: r.title, problems: r.problems.slice(0, 30).map((x) => String(x).slice(0, 300)), facts: r.facts.slice(0, 30).map((x) => String(x).slice(0, 300)) }; },
    schema: z.object({ title: z.string().max(120), problems: z.array(z.string().max(300)).max(30), facts: z.array(z.string().max(300)).max(30) }),
    preview: (ctx, p) => ({ description: label, data_involved, expected_outcome: p.problems.length ? p.problems.join('; ').slice(0, 300) : 'No problems found.' }),
    execute: (ctx, p) => ctx.deps.outputs.add(ctx, {
      kind: p.problems.length ? 'alert' : 'report',
      title: p.problems.length ? `${p.title}: ${plural(p.problems.length, 'item')} to check` : `${p.title}: all clear`,
      body: [...p.problems.map((x) => '• ' + x), ...p.facts.map((x) => '· ' + x)].join('\n') || 'Nothing recorded.', link
    }),
    verify: (ctx, p, result) => (ctx.db.prepare('SELECT 1 FROM automation_outputs WHERE id=?').get(result?.ref) ? { ok: true, detail: 'Report recorded.' } : { ok: false, detail: 'The report was not stored.' })
  };
}
const fact = (facts, label, n) => facts.push(`${label}: ${n == null ? 'not recorded' : n}`);

export const AGENT_ACTIONS = {
  security_review: report('Security review', ['schedule.daily'], ['Security settings (names only, never values)', 'Locked accounts and sign-in session counts', 'Unread security notices'], (ctx) => {
    const t = now(ctx), problems = [], facts = [];
    const d = ctx.deps.diagnostics?.();
    if (d) for (const c of d.checks.filter((c) => /^(security\.|config\.secrets)/.test(c.id))) (c.status === 'pass' ? facts : problems).push(c.detail);
    else facts.push('Security settings check is not available on this server.');
    const locked = count(ctx, 'SELECT COUNT(*) n FROM users WHERE locked_until>?', iso(t));
    if (locked) problems.push(`${plural(locked, 'account is', 'accounts are')} locked after repeated failed sign-ins.`); else fact(facts, 'Locked accounts', locked);
    const failing = count(ctx, 'SELECT COUNT(*) n FROM users WHERE failed_login_attempts>=3');
    if (failing) problems.push(`${plural(failing, 'account has', 'accounts have')} 3 or more failed sign-ins in a row.`);
    const old = count(ctx, 'SELECT COUNT(*) n FROM user_sessions WHERE expires_at>? AND created_at<?', iso(t), iso(t - 30 * DAY));
    if (old) problems.push(`${plural(old, 'business sign-in session is', 'business sign-in sessions are')} older than 30 days and still active.`); else fact(facts, 'Sessions older than 30 days', old);
    const notices = count(ctx, "SELECT COUNT(*) n FROM security_notifications WHERE read_at IS NULL AND severity IN ('high','critical')");
    if (notices) problems.push(`${plural(notices, 'high-severity security notice is', 'high-severity security notices are')} unread.`);
    return { title: 'Security review', problems, facts };
  }, '#f08/security'),

  enquiry_queue_check: report('Enquiry follow-up check', ['schedule.daily'], ['Oprun prospect records (counts only)'], (ctx) => {
    const t = now(ctx), problems = [], facts = [];
    const open = count(ctx, "SELECT COUNT(*) n FROM platform_records WHERE kind='prospect' AND status IN ('open','waiting')");
    const fresh = count(ctx, "SELECT COUNT(*) n FROM platform_records WHERE kind='prospect' AND created_at>=?", iso(t - DAY));
    const unowned = count(ctx, "SELECT COUNT(*) n FROM platform_records WHERE kind='prospect' AND status='open' AND assigned_to IS NULL");
    const stale = count(ctx, "SELECT COUNT(*) n FROM platform_records WHERE kind='prospect' AND status='open' AND updated_at<?", iso(t - 2 * DAY));
    if (unowned) problems.push(`${plural(unowned, 'open enquiry has', 'open enquiries have')} nobody assigned.`);
    if (stale) problems.push(`${plural(stale, 'open enquiry has', 'open enquiries have')} not been touched for 2 days.`);
    fact(facts, 'Open enquiries', open); fact(facts, 'New in the last 24 hours', fresh);
    return { title: 'Enquiries', problems, facts };
  }, '#f06/records:prospect'),

  onboarding_check: report('Subscriber onboarding check', ['schedule.daily'], ['New businesses and their setup progress (counts only)'], (ctx) => {
    const t = now(ctx), problems = [], facts = [];
    const recent = count(ctx, 'SELECT COUNT(*) n FROM organisations WHERE created_at>=?', iso(t - 14 * DAY));
    const done = count(ctx, 'SELECT COUNT(*) n FROM organisations o JOIN onboarding_profiles p ON p.organisation_id=o.id WHERE o.created_at>=? AND p.completed_at IS NOT NULL', iso(t - 14 * DAY));
    const stuck = count(ctx, 'SELECT COUNT(*) n FROM organisations o LEFT JOIN onboarding_profiles p ON p.organisation_id=o.id WHERE o.created_at<? AND o.created_at>=? AND p.completed_at IS NULL', iso(t - 3 * DAY), iso(t - 14 * DAY));
    const ending = count(ctx, "SELECT COUNT(*) n FROM organisation_subscriptions s LEFT JOIN onboarding_profiles p ON p.organisation_id=s.organisation_id WHERE s.status='trialing' AND s.trial_ends_at BETWEEN ? AND ? AND p.completed_at IS NULL", iso(t), iso(t + 7 * DAY));
    if (stuck) problems.push(`${plural(stuck, 'business', 'businesses')} joined more than 3 days ago and has not finished setup.`);
    if (ending) problems.push(`${plural(ending, 'trial ends', 'trials end')} within 7 days with setup unfinished.`);
    fact(facts, 'New businesses in the last 14 days', recent); fact(facts, 'Of those, setup finished', done);
    return { title: 'Onboarding', problems, facts };
  }, '#f02/subscribers'),

  staff_allocation_check: report('Staff allocation check', ['schedule.daily'], ['Oprun work items, assignments and staff availability (counts only)'], (ctx) => {
    const t = now(ctx), today = iso(t).slice(0, 10), problems = [], facts = [];
    const unassigned = count(ctx, "SELECT COUNT(*) n FROM platform_records WHERE assigned_to IS NULL AND status IN ('open','waiting') AND kind IN ('ticket','task','incident','staff_task','project')");
    const overdue = count(ctx, "SELECT COUNT(*) n FROM platform_records WHERE work_state IN ('assigned','in_progress','blocked','reopened') AND due_on<?", today);
    const blocked = count(ctx, "SELECT COUNT(*) n FROM platform_records WHERE work_state='blocked'");
    const review = count(ctx, "SELECT COUNT(*) n FROM platform_records WHERE work_state='done'");
    const awayWithWork = count(ctx, "SELECT COUNT(DISTINCT r.assigned_to) n FROM platform_records r JOIN platform_staff_profiles p ON p.user_id=r.assigned_to WHERE r.status IN ('open','waiting') AND (p.availability IN ('away','off') OR EXISTS (SELECT 1 FROM platform_time_off o WHERE o.user_id=p.user_id AND ? BETWEEN o.starts_on AND o.ends_on))", today);
    if (unassigned) problems.push(`${plural(unassigned, 'open work item has', 'open work items have')} nobody assigned.`);
    if (overdue) problems.push(`${plural(overdue, 'assignment is', 'assignments are')} past the due date.`);
    if (blocked) problems.push(`${plural(blocked, 'assignment is', 'assignments are')} blocked.`);
    if (awayWithWork) problems.push(`${plural(awayWithWork, 'person is', 'people are')} away or off with open work. Consider reassigning.`);
    fact(facts, 'Completed work waiting for review', review);
    return { title: 'Staff allocation', problems, facts };
  }, '#f05/team/assignments'),

  support_queue_check: report('Support queue check', ['schedule.hourly', 'schedule.daily'], ['Support cases, tickets and support access requests (counts only)'], (ctx) => {
    const t = now(ctx), problems = [], facts = [];
    const open = count(ctx, "SELECT COUNT(*) n FROM support_cases WHERE status NOT IN ('resolved','closed')");
    const urgent = count(ctx, "SELECT COUNT(*) n FROM support_cases WHERE status NOT IN ('resolved','closed') AND (severity IN ('high','critical','urgent') OR escalation_required=1)");
    const aged = count(ctx, "SELECT COUNT(*) n FROM support_cases WHERE status NOT IN ('resolved','closed') AND created_at<?", iso(t - 2 * DAY));
    const tickets = count(ctx, "SELECT COUNT(*) n FROM platform_records WHERE kind='ticket' AND status='open'");
    const access = count(ctx, "SELECT COUNT(*) n FROM support_access_requests WHERE status='pending'");
    if (urgent) problems.push(`${plural(urgent, 'urgent or escalated support case is', 'urgent or escalated support cases are')} open.`);
    if (aged) problems.push(`${plural(aged, 'support case has', 'support cases have')} been open for more than 2 days.`);
    if (access) problems.push(`${plural(access, 'support access request is', 'support access requests are')} waiting.`);
    fact(facts, 'Open support cases', open); fact(facts, 'Open tickets', tickets);
    return { title: 'Support', problems, facts };
  }, '#f04/records:ticket'),

  communications_check: report('Communications delivery check', ['schedule.daily'], ['Email delivery status counts (no addresses or content)'], (ctx) => {
    const t = now(ctx), problems = [], facts = [];
    const failedPlatform = count(ctx, "SELECT COUNT(*) n FROM portal_mail WHERE scope='platform' AND status='failed' AND updated_at>=?", iso(t - DAY));
    const failedBusiness = count(ctx, "SELECT COUNT(*) n FROM portal_mail WHERE scope='business' AND status='failed' AND updated_at>=?", iso(t - DAY));
    const stuck = count(ctx, "SELECT COUNT(*) n FROM portal_mail WHERE status IN ('queued','sending') AND updated_at<?", iso(t - HOUR));
    const sent = count(ctx, "SELECT COUNT(*) n FROM portal_mail WHERE status IN ('sent','delivered','opened') AND updated_at>=?", iso(t - DAY));
    if (failedPlatform) problems.push(`${plural(failedPlatform, 'Oprun email', 'Oprun emails')} failed in the last 24 hours.`);
    if (failedBusiness) problems.push(`${plural(failedBusiness, 'subscriber email', 'subscriber emails')} failed in the last 24 hours (check the email provider).`);
    if (stuck) problems.push(`${plural(stuck, 'email has', 'emails have')} been waiting to send for over an hour.`);
    fact(facts, 'Emails sent in the last 24 hours', sent);
    if (ctx.deps.mail?.providerReady && !ctx.deps.mail.providerReady()) problems.push('No email provider is connected, so nothing can be sent.');
    return { title: 'Communications', problems, facts };
  }, '#f06/platform/campaigns'),

  ui_quality_check: report('UI and accessibility quality check', ['schedule.weekly', 'schedule.daily'], ['The accessibility and performance reports produced with this release'], (ctx) => {
    const problems = [], facts = [];
    const a11y = ctx.deps.qaReport?.('accessibility.json'), perf = ctx.deps.qaReport?.('performance.json');
    if (!a11y || !perf) return { title: 'UI quality', problems: ['The release quality reports are missing from this server. Run npm run report:a11y-perf before releasing.'], facts };
    const bad = a11y.results.filter((r) => r.violations?.length);
    for (const r of bad.slice(0, 10)) problems.push(`Accessibility: ${r.page} at ${r.width}px (${r.theme}) has ${plural(r.violations.length, 'issue')}: ${r.violations.map((v) => v.id || v).slice(0, 3).join(', ')}.`);
    const b = perf.budget || {};
    for (const r of perf.results.filter((r) => (b.lcp && r.lcp > b.lcp) || (b.cls && r.cls > b.cls) || (b.tbt && r.tbt > b.tbt)).slice(0, 10)) problems.push(`Speed: ${r.page} (${r.mode}) is over budget (load ${r.lcp} ms, shift ${r.cls}, blocking ${r.tbt} ms).`);
    facts.push(`${a11y.results.length} page checks against ${a11y.standard || 'WCAG 2.2 AA'}; ${bad.length} with issues.`);
    facts.push(`${perf.results.length} pages measured for speed.`);
    if (a11y.generated_at) facts.push(`Report generated ${a11y.generated_at.slice(0, 10)}.`);
    return { title: 'UI quality', problems, facts };
  }),

  self_test: report('Automated self-test', ['schedule.daily'], ['Database integrity, schema, audit chain and background job checks'], (ctx) => {
    const t = now(ctx), problems = [], facts = [];
    const d = ctx.deps.diagnostics?.();
    if (d) for (const c of d.checks.filter((c) => /^(database\.|audit\.|storage\.)/.test(c.id))) (c.status === 'pass' ? facts : problems).push(c.detail);
    else problems.push('Self-test checks are not available on this server.');
    const stuck = count(ctx, "SELECT COUNT(*) n FROM background_jobs WHERE status='running' AND updated_at<?", iso(t - HOUR));
    if (stuck) problems.push(`${plural(stuck, 'background job has', 'background jobs have')} been running for over an hour.`);
    const restore = rows(ctx, 'SELECT status,finished_at FROM reliability_restore_tests ORDER BY started_at DESC LIMIT 1');
    if (restore?.length) (restore[0].status === 'passed' || restore[0].status === 'ok' ? facts : problems).push(`Last backup restore test: ${restore[0].status}${restore[0].finished_at ? ' on ' + restore[0].finished_at.slice(0, 10) : ''}.`);
    else facts.push('No backup restore test recorded yet.');
    return { title: 'Self-test', problems, facts };
  }, '#f07/platform/reliability'),

  media_jobs_check: report('Media and content jobs check', ['schedule.daily'], ['Video, reel and render job status counts'], (ctx) => {
    const t = now(ctx), problems = [], facts = [], week = iso(t - 7 * DAY), hour = iso(t - HOUR);
    for (const [table, name] of [['ai_video_jobs', 'AI video'], ['reel_jobs', 'reel'], ['video_render_jobs', 'video render']]) {
      const failed = count(ctx, `SELECT COUNT(*) n FROM ${table} WHERE status IN ('failed','error') AND updated_at>=?`, week);
      const stuck = count(ctx, `SELECT COUNT(*) n FROM ${table} WHERE status IN ('queued','processing','running','rendering','pending') AND updated_at<?`, hour);
      const total = count(ctx, `SELECT COUNT(*) n FROM ${table} WHERE created_at>=?`, week);
      if (failed) problems.push(`${plural(failed, name + ' job')} failed in the last 7 days.`);
      if (stuck) problems.push(`${plural(stuck, name + ' job has', name + ' jobs have')} not moved for over an hour.`);
      fact(facts, `${name[0].toUpperCase() + name.slice(1)} jobs in the last 7 days`, total);
    }
    return { title: 'Media and content', problems, facts };
  }),

  integrations_check: report('Integrations check', ['schedule.daily'], ['Connected integration status counts and open reliability alerts'], (ctx) => {
    const problems = [], facts = [];
    const byProvider = rows(ctx, "SELECT provider,COUNT(*) n FROM organisation_integrations WHERE status IN ('error','failed','expired','needs_reconnect','disconnected') GROUP BY provider ORDER BY n DESC");
    for (const r of byProvider || []) problems.push(`${r.provider}: ${plural(r.n, 'business connection needs', 'business connections need')} attention.`);
    const connected = count(ctx, "SELECT COUNT(*) n FROM organisation_integrations WHERE status IN ('connected','active')");
    const alerts = rows(ctx, "SELECT component,COUNT(*) n FROM reliability_alerts WHERE status='open' GROUP BY component");
    for (const a of alerts || []) problems.push(`Open reliability alert for ${a.component} (${a.n}).`);
    fact(facts, 'Working business connections', connected);
    return { title: 'Integrations', problems, facts };
  }, '#f01/system'),

  billing_check: report('Billing monitor', ['schedule.daily'], ['Oprun invoices, payment attempts and subscription status counts'], (ctx) => {
    const t = now(ctx), problems = [], facts = [];
    const overdue = rows(ctx, "SELECT COUNT(*) n,COALESCE(SUM(total_cents),0) c FROM platform_invoices WHERE status IN ('approved','sent') AND due_at<?", iso(t));
    if (overdue?.[0]?.n) problems.push(`${plural(overdue[0].n, 'invoice is', 'invoices are')} overdue (${(overdue[0].c / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}).`);
    const dunning = count(ctx, "SELECT COUNT(*) n FROM platform_dunning WHERE status='open'");
    if (dunning) problems.push(`${plural(dunning, 'payment reminder sequence is', 'payment reminder sequences are')} open.`);
    const failedPay = count(ctx, "SELECT COUNT(*) n FROM platform_pay_attempts WHERE status IN ('failed','declined','error') AND created_at>=?", iso(t - 7 * DAY));
    if (failedPay) problems.push(`${plural(failedPay, 'payment attempt', 'payment attempts')} failed in the last 7 days.`);
    const pastDue = count(ctx, "SELECT COUNT(*) n FROM organisation_subscriptions WHERE status='past_due'");
    if (pastDue) problems.push(`${plural(pastDue, 'subscription is', 'subscriptions are')} past due.`);
    const trials = count(ctx, "SELECT COUNT(*) n FROM organisation_subscriptions WHERE status='trialing' AND trial_ends_at BETWEEN ? AND ?", iso(t), iso(t + 3 * DAY));
    fact(facts, 'Trials ending in the next 3 days', trials);
    fact(facts, 'Paying subscriptions', count(ctx, "SELECT COUNT(*) n FROM organisation_subscriptions WHERE status='active'"));
    return { title: 'Billing', problems, facts };
  }, '#f03/invoices'),

  release_check: report('Release status check', ['schedule.daily'], ['Running version, restarts, release notes and open release tasks'], (ctx) => {
    const t = now(ctx), problems = [], facts = [];
    const boots = rows(ctx, 'SELECT started_at,commit_sha FROM reliability_boots ORDER BY started_at DESC LIMIT 1');
    if (boots?.length) facts.push(`Running version ${String(boots[0].commit_sha || 'unknown').slice(0, 7)} since ${boots[0].started_at.slice(0, 16).replace('T', ' ')} UTC.`);
    const restarts = count(ctx, 'SELECT COUNT(*) n FROM reliability_boots WHERE started_at>=?', iso(t - DAY));
    if (restarts > 3) problems.push(`The server restarted ${restarts} times in the last 24 hours.`); else fact(facts, 'Restarts in the last 24 hours', restarts);
    const latest = rows(ctx, 'SELECT version,title,released_at FROM product_release_events ORDER BY released_at DESC LIMIT 1');
    facts.push(latest?.length ? `Latest release note: ${latest[0].version} "${latest[0].title}" (${String(latest[0].released_at).slice(0, 10)}).` : 'No release notes recorded.');
    const tasks = count(ctx, "SELECT COUNT(*) n FROM platform_records WHERE kind='task' AND status IN ('open','waiting')");
    fact(facts, 'Open tasks and releases', tasks);
    const blocked = count(ctx, "SELECT COUNT(*) n FROM platform_records WHERE kind='task' AND work_state='blocked'");
    if (blocked) problems.push(`${plural(blocked, 'release task is', 'release tasks are')} blocked.`);
    return { title: 'Release', problems, facts };
  }, '#f07/records:task')
};
