// TR-41: Oprun's thirteen standard agents (brief section 8). Created once if missing; after that the founder owns
// them (pausing, changing or archiving a job is never undone by a restart). Every job is a level-1 report action
// that reads Oprun's own records and writes a report or alert; none sends, changes or deletes anything.
export const DEFAULT_AGENTS = [
  { key: 'platform_health', name: 'Platform health', responsibilities: 'Checks every hour that the database answers, background work is moving and storage has room.', schedule: 'schedule.hourly', jobs: ['monitor_health'] },
  { key: 'security', name: 'Security', responsibilities: 'Daily review of security settings, locked accounts, long-lived sessions and unread security notices.', schedule: 'schedule.daily', jobs: ['security_review'] },
  { key: 'customer_enquiries', name: 'Customer enquiries', responsibilities: 'Daily check that new enquiries to Oprun have an owner and are followed up within two days.', schedule: 'schedule.daily', jobs: ['enquiry_queue_check'] },
  { key: 'subscriber_onboarding', name: 'Subscriber onboarding', responsibilities: 'Daily check of new businesses that have not finished setup, especially trials ending soon.', schedule: 'schedule.daily', jobs: ['onboarding_check'] },
  { key: 'staff_allocation', name: 'Staff allocation', responsibilities: 'Daily check for unassigned work, overdue or blocked assignments and people away with open work.', schedule: 'schedule.daily', jobs: ['staff_allocation_check'] },
  { key: 'customer_support', name: 'Customer support', responsibilities: 'Hourly check of urgent, escalated and ageing support cases and waiting access requests.', schedule: 'schedule.hourly', jobs: ['support_queue_check'] },
  { key: 'communications', name: 'Communications', responsibilities: 'Daily check that emails are being delivered and none are stuck or failing.', schedule: 'schedule.daily', jobs: ['communications_check'] },
  { key: 'ui_quality', name: 'UI and UX quality', responsibilities: 'Weekly review of the accessibility and speed reports shipped with each release.', schedule: 'schedule.weekly', jobs: ['ui_quality_check'] },
  { key: 'automated_testing', name: 'Automated testing', responsibilities: 'Daily self-test of database integrity, schema, the audit chain, stuck background jobs and the last backup restore test.', schedule: 'schedule.daily', jobs: ['self_test'] },
  { key: 'media_content', name: 'Media and content', responsibilities: 'Daily check for failed or stuck video, reel and render jobs.', schedule: 'schedule.daily', jobs: ['media_jobs_check'] },
  { key: 'integrations', name: 'Integrations', responsibilities: 'Hourly check of failed background work; daily check of broken business connections and open reliability alerts.', schedule: 'schedule.hourly', jobs: ['platform_failed_jobs', 'integrations_check'] },
  { key: 'billing_monitor', name: 'Billing monitoring', responsibilities: 'Daily check of overdue invoices, failed payments, past-due subscriptions and trials about to end.', schedule: 'schedule.daily', jobs: ['billing_check'] },
  { key: 'release_coordination', name: 'Release coordination', responsibilities: 'Daily check of the running version, restarts, release notes, blocked release tasks and backup readiness.', schedule: 'schedule.daily', jobs: ['release_check', 'verify_backups'] }
];
