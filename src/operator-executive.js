// TR-30: Operator Console executive dashboard.
// One read-only summary for the console's first page. Each block appears only for platform staff whose role grants
// that section (the founder sees all). Figures are counts and totals recorded in Oprun; nothing is estimated, and no
// subscriber business records (customers, jobs, finance, staff) are read.
import { backupBucket } from './backup-env.js';

const DAY = 86400000;
const has = (v) => Boolean(String(v ?? '').trim());

export function installOperatorExecutive(app, { db, env, platform, policy, now = () => Date.now() }) {
  // A missing optional table becomes "not recorded" (null) instead of an error.
  const all = (sql, ...a) => { try { return db.prepare(sql).all(...a); } catch { return null; } };
  const one = (sql, ...a) => { try { return db.prepare(sql).get(...a); } catch { return null; } };
  const iso = (ms) => new Date(ms).toISOString();
  const waived = () => new Set((all('SELECT organisation_id FROM complimentary_grants') || []).map((g) => g.organisation_id).filter((id) => policy?.active?.(id)));

  function subscribers(t) {
    const subs = all('SELECT organisation_id,status,trial_ends_at FROM organisation_subscriptions') || [];
    const by = {};
    for (const s of subs) by[s.status] = (by[s.status] || 0) + 1;
    const orgs = all('SELECT created_at FROM organisations') || [];
    const newer = (days) => orgs.filter((o) => o.created_at && Date.parse(o.created_at) >= t - days * DAY).length;
    // Sign-ups per week, oldest first, for the last 8 weeks (week 8 is the current partial week).
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const end = t - (7 - i) * 7 * DAY, start = end - 7 * DAY;
      return { week_ending: iso(end).slice(0, 10), count: orgs.filter((o) => { const c = Date.parse(o.created_at); return c > start && c <= end; }).length };
    });
    const free = waived();
    return {
      total: subs.length,
      by_status: by,
      new_7_days: newer(7),
      new_30_days: newer(30),
      trials_ending_7_days: subs.filter((s) => s.status === 'trialing' && s.trial_ends_at && Date.parse(s.trial_ends_at) >= t && Date.parse(s.trial_ends_at) <= t + 7 * DAY).length,
      complimentary: free.size,
      signups_by_week: weeks
    };
  }

  function revenue(t) {
    const free = waived();
    const subs = all('SELECT s.organisation_id,s.status,p.monthly_fee_cents FROM organisation_subscriptions s LEFT JOIN subscription_plans p ON p.id=s.plan_id') || [];
    const paying = subs.filter((s) => s.status === 'active' && !free.has(s.organisation_id));
    const payingIds = new Set(paying.map((p) => p.organisation_id));
    const addons = all("SELECT organisation_id,SUM(price_cents*quantity) c FROM organisation_addons WHERE status='active' GROUP BY organisation_id") || [];
    const addonMrr = addons.filter((a) => payingIds.has(a.organisation_id)).reduce((s, a) => s + (a.c || 0), 0);
    const overdue = one("SELECT COUNT(*) n,COALESCE(SUM(total_cents),0) c FROM platform_invoices WHERE status IN ('approved','sent') AND due_at<?", iso(t));
    const paid30 = one("SELECT COALESCE(SUM(total_cents),0) c FROM platform_invoices WHERE status='paid' AND paid_at>=?", iso(t - 30 * DAY));
    return {
      note: 'Recorded in Oprun. Compare with the payment provider before reporting.',
      mrr_cents: paying.reduce((s, p) => s + (p.monthly_fee_cents || 0), 0) + addonMrr,
      paying_subscribers: paying.length,
      overdue_invoices: overdue ? { count: overdue.n, total_cents: overdue.c } : null,
      paid_last_30_days_cents: paid30 ? paid30.c : null
    };
  }

  const openCount = (kind, statuses) => one(`SELECT COUNT(*) n FROM platform_records WHERE kind=? AND status IN (${statuses.map(() => '?').join(',')})`, kind, ...statuses)?.n ?? null;

  function support() {
    return {
      open_tickets: openCount('ticket', ['open']),
      waiting_tickets: openCount('ticket', ['waiting']),
      pending_access_requests: one("SELECT COUNT(*) n FROM support_access_requests WHERE status='pending'")?.n ?? null
    };
  }

  function operations(t) {
    const jobs = all('SELECT status,COUNT(*) n FROM background_jobs GROUP BY status');
    const by = jobs ? Object.fromEntries(jobs.map((j) => [j.status, j.n])) : null;
    return {
      open_incidents: openCount('incident', ['open', 'waiting']),
      open_tasks: openCount('task', ['open', 'waiting']),
      jobs: by ? {
        queued: by.queued || 0,
        running: by.running || 0,
        failed_24_hours: one("SELECT COUNT(*) n FROM background_jobs WHERE status IN ('failed','dead') AND updated_at>=?", iso(t - DAY))?.n ?? 0,
        dead: by.dead || 0
      } : null,
      backups_configured: has(backupBucket(env)) && !/^(1|true|yes)$/i.test(String(env.BACKUP_DISABLED || ''))
    };
  }

  // Items that need someone, most serious first. Each route is the console address (group/page) where it is handled.
  function attention(s) {
    const out = [];
    const add = (level, key, text, route) => out.push({ level, key, text, route });
    const n = (v, one, many) => `${v} ${v === 1 ? one : many}`;
    if (s.operations) {
      const o = s.operations;
      if (!o.backups_configured) add('critical', 'backups', 'Database backups are not configured.', 'f01/platform/backups');
      if (o.open_incidents) add('critical', 'incidents', `${n(o.open_incidents, 'open incident', 'open incidents')}.`, 'f07/records:incident');
      if (o.jobs?.dead) add('warning', 'jobs-dead', `${n(o.jobs.dead, 'background job has', 'background jobs have')} stopped after repeated failures.`, 'f01/system');
      else if (o.jobs?.failed_24_hours) add('warning', 'jobs-failed', `${n(o.jobs.failed_24_hours, 'background job', 'background jobs')} failed in the last 24 hours.`, 'f01/system');
    }
    if (s.revenue?.overdue_invoices?.count) add('warning', 'overdue', `${n(s.revenue.overdue_invoices.count, 'invoice is', 'invoices are')} overdue.`, 'f03/invoices');
    if (s.support) {
      if (s.support.pending_access_requests) add('warning', 'access', `${n(s.support.pending_access_requests, 'support access request is', 'support access requests are')} waiting for the business owner.`, 'f04/support-access');
      if (s.support.open_tickets) add('info', 'tickets', `${n(s.support.open_tickets, 'support ticket is', 'support tickets are')} open.`, 'f04/records:ticket');
    }
    if (s.subscribers?.trials_ending_7_days) add('info', 'trials', `${n(s.subscribers.trials_ending_7_days, 'trial ends', 'trials end')} in the next 7 days.`, 'f02/subscribers');
    const rank = { critical: 0, warning: 1, info: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
  }

  app.get('/api/operator/executive', platform.identity, platform.permit('overview', 'read'), (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const t = now(), can = (section) => platform.can(req, section, 'read');
    const sections = {};
    if (can('subscribers')) sections.subscribers = subscribers(t);
    if (can('billing')) sections.revenue = revenue(t);
    if (can('support')) sections.support = support();
    if (can('operations')) sections.operations = operations(t);
    res.json({ ok: true, generated_at: iso(t), role: req.platform.role, sections, attention: attention(sections) });
  });
}
