# Release plan (TR-80 review, TR-81 release)

Prepared 25 Nov 2026 by Claude. Nothing here has been done to production. Every step that changes production waits
for the owner's explicit approval in chat.

## 1. What is being released

- From `main` at `6cbbe20` (22 Nov, the live code) to the release candidate on `claude/transformation-phase1`
  (currently `8f0cdb4`): 76 commits, 270 files changed (about 20,300 lines added, 2,000 removed).
- `main` has had no other commits since, and the candidate already contains it, so the merge is a straight
  fast-forward-style merge with no conflicts.
- The test site (`oprun-test`, `srv-dc1keajl550s73eolqk0`) runs `d017ea0`. The candidate adds one tested speed change
  since then (D-078: the first page waits only for its own data). **The owner's review (TR-80) should be done on the
  candidate itself, so the test site should be updated to the candidate first** (this resets the test data).

## 2. Database changes (reviewed 25 Nov against `6cbbe20`)

All changes only add things. Nothing existing is renamed, rebuilt, emptied or deleted:

- 15 new tables (all `CREATE TABLE IF NOT EXISTS`): `platform_agents`, `platform_agent_escalations`,
  `platform_assignment_events`, `platform_departments`, `platform_teams`, `platform_team_members`,
  `platform_staff_profiles`, `platform_time_off`, `onboarding_sessions`, `onboarding_proposals`,
  `onboarding_consents`, `workspace_templates`, `website_wizard`, `website_generation_runs`, `usage_events`.
- New columns, each added only if missing:
  - `organisations.modules_json`, `onboarding_profiles.pipeline_stages_json`, `automation_workflows.agent_id`;
  - `platform_records`: `due_on`, `priority` (default `normal`), `assigned_by`, `assigned_at`, `work_state`,
    `completed_at`, `completion_note`, `evidence_url`, `reviewed_by`, `reviewed_at`;
  - `seo_sites`: `build_mode`, `build_status`, `style_json`, `source_url`, `primary_domain`, `generated_at`.
- 7 new indexes.
- Table definitions without `IF NOT EXISTS` occur only in test files. The two new `DELETE` statements are user actions
  in the Operator Console (saving a team's members, cancelling a time-off entry); each save or cancellation is written
  to the audit log.

**One start-up effect:** on its first start, the new version creates the 13 standard agents (TR-41,
`src/agents/defaults.js`) once, each with its jobs switched on: 3 agents check hourly, 9 daily and 1 weekly. Every
job is a level-1 report: it reads Oprun's own records and writes a report or alert; none sends, changes or deletes
anything, and restricted actions (production deploys, database resets, payments) are refused by name (TR-43). After
creation the founder owns them: pausing or archiving is never undone by a restart. If the owner prefers them paused at
first, that is one action in the Operator Console after the release.

## 3. Before the release (owner)

1. **TR-80:** review the candidate on the test site on a phone, a tablet and a laptop (checklist in section 6) and
   say "approved" or list what to change.
2. **TR-73:** in Render open the service **Oprun AI** (`srv-dbuq98ojo6nc73aro66g`, paid plan with a disk), not
   `oprun-test` (free services have no Shell), then **Shell** in its menu, and run
   `npm run backup:restore-drill -- --compare /var/data/oprun-ai.sqlite`; share the output. The command and its
   script are already in the live code (unchanged by this release). The live database file is
   `/var/data/oprun-ai.sqlite` (from the live start-up log, 22 Nov), not the default `super-pro.sqlite`.
3. Set on the live service (Render → Environment): `OPERATOR_TOTP_SECRET` (enter it in an authenticator app first),
   `SESSION_MAX_AGE_DAYS=30`, `STRICT_PASSWORD_MATCH=1`. These values are never written to the repository.
4. Decide the old Oprun service and its disk (keep, suspend or delete: the owner's call; nothing is touched without it).
5. Website builder pricing (TR-63 allowance is 10 generations on trial, 100 on paid plans until decided).
6. Check Render's build spend limit for the workspace (logs on 22 Nov mentioned it).

## 4. Release steps (Claude, only after the owner says "release approved")

1. Record the live deploy ID and commit of `srv-dbuq98ojo6nc73aro66g` (for rollback).
2. Owner takes the one-line database backup from `docs/DEPLOY.md` section 1, **with the live file name
   `/var/data/oprun-ai.sqlite`** (the guide's `super-pro.sqlite` is the default, not the live name), or confirms the
   Litestream snapshot of the day exists.
3. Open a pull request `claude/transformation-phase1` → `main` with the summary of sections 1–2; merge it without
   rewriting history (no force-push).
4. **The live service deploys by itself when `main` changes.** Checked on 25 Nov: "Oprun AI"
   (`srv-dbuq98ojo6nc73aro66g`) has auto-deploy on, for every commit on `main` (`docs/DEPLOY.md` says it is off; the
   service setting is what counts). So the merge in step 3 starts the production deploy; nothing is merged to `main`
   before the owner's release approval. Watch the build (`npm ci --include=dev && npm test`) and start-up logs. If the
   owner prefers to deploy by hand, they switch auto-deploy off first (Render → Oprun AI → Settings), and Claude then
   triggers the deploy after the merge.
5. After it is live: `/healthz` returns `{"ok":true}`; the start-up diagnostics show no new failure; the deploy record
   shows the merge commit; static files carry the new version stamps and bundles (`/saas/__b/…`) load.
6. Screenshots of the public site, the Business Workspace and the Operator Console at phone and laptop width, compared
   with the test site; any difference is fixed through a new tested commit, never by editing production.
7. Update `PROGRESS.md`, `COMPLETED_TASKS.md` and the handover.

## 5. Rollback

If the build fails, the current live deploy keeps running; nothing changes. If the new version misbehaves after it is
live: redeploy the recorded previous commit from Render (the database changes are additive, so the previous code runs
on the new tables untouched). Never restore a database backup over live data without the owner's explicit decision;
`docs/release/ROLLBACK_PLAN.md` has the full procedure, including the S3 restore marker check.

## 6. What to check on the test site (TR-80)

For each of phone, tablet and laptop, in light and dark:

- Sign in (Business), and the visible Operator sign-in link on the sign-in page.
- Command Centre: figures, greeting, quick actions; no content jumping while it loads.
- Navigation: every menu group opens; the phone bottom bar; search finds a customer and opens it.
- Enquiries, quotes, bookings, invoices: create one of each; open Money.
- Unified Inbox and AI Receptionist (call handling inside the receptionist page).
- Website builder: the 9-step wizard, generate a page, regenerate a section.
- Connections page: status list, test a connection.
- Video, Reel Maker, Media Studio; Meetings; Automations; Team; Growth.
- Language switch to Hindi or Urdu and back.
- Operator Console: Agents page (13 agents), staff work, support access requests.

Known and accepted: workspace Lighthouse 75–83 on a simulated slow phone (target 85 not met; see
`qa/reports/LIGHTHOUSE.md`); the test site's start-up warnings are expected there (no backups, test settings).
