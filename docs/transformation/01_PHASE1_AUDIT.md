# 01 · Phase 1 read-only audit (verified 23 Nov 2026)

Everything below was checked directly against Render, GitHub and the repository on 23 Nov 2026. Nothing was
changed, deployed or deleted during this audit. Items that could not be verified are listed in §9.

## 1. Production and Render

| Service | ID | State | Branch / deploy | Disk | Cost (US$/month, list price) | Finding |
|---|---|---|---|---|---|---|
| **Oprun AI** (production, oprun.ai) | `srv-dbuq98ojo6nc73aro66g` | Running, Singapore | `main`, auto-deploy on commit. **Live commit `6cbbe20` (T-202)**, live since 22 Nov 19:00 UTC; previous `0e7bfb0` deactivated | 10 GB at `/var/data` | Starter 7 + disk 2.50 | Correct and current. Build runs `npm ci --include=dev && npm test` (~10 build minutes per deploy) |
| Oprun (legacy) | `srv-dan4rdqjnfac73fceor0` | **Running**, `super-pro-ai-office-manager.onrender.com` | `main`, auto-deploy **off** (last updated 14 Nov) | **Own 10 GB disk** | Starter 7 + disk 2.50 | Old copy still charged. Its disk may hold an older database: inspect before any decision (needs owner approval) |
| superpro-ai-v2-preview-20261029 | `srv-dbhldj942hec73cpcs4g` | Running (free) | `codex/superpro-two-portals-v2` (branch no longer on GitHub), auto-deploy off | none | 0 | Stale preview; could become the free staging service |
| fleet-office-ai | `srv-daju353m8hqs739nq42g` | Suspended (free) | `main`, root `backend` | none | 0 | Legacy |
| fleet-office-ai-v6-test | `srv-daka6irm8hqs73drsibg` | Suspended (free) | `main` | none | 0 | Legacy |
| diwaanshahkhwaan-soh8 | `srv-dbmadtl6e07s73bkpni0` | Running (free) | other repository | none | 0 | **Out of scope** (separate project) |

Build minutes ran out once this month (22 Nov); the owner added a US$5 build spend limit.

## 2. GitHub and the task register

- Remote branches: only `main` plus open pull-request branches. Local stale branches are not on GitHub.
- **26 open pull requests**: #170 (self-hosted video spec, T-196, waiting on budget); 9 Dependabot bumps
  (#124–#128, #45–#49); 7 old "deploy evidence / release record" PRs (#71–#91); 6 October phase PRs (#34–#39);
  #22, #61, #129. Most are superseded by work already on `main`. Proposal: review and **close** (not delete)
  the superseded ones, after owner approval.
- GitHub reports **1 moderate vulnerability** on `main`; the alert detail is not readable with this session's
  access (owner can open Security → Dependabot).
- Task register: **86 tasks pending**. Inconsistencies found: T-141 and T-142 (receptionist) and T-194 (Codex
  unified Media Studio, superseded by T-202) are still "TESTING". The receptionist plan R-02…R-20
  (T-122–T-140) and the website plan W-03…W-20 (T-149–T-163, T-200, T-201) are open.

## 3. Pages, navigation and front-end size

| Area | Count (measured) | Finding |
|---|---|---|
| Business Workspace menu | 8 groups, **31 main pages** + **31 secondary pages** still registered | First wave reduced the main menu; 31 "secondary" pages remain reachable (15 under Growth: SEO tools and "(older)" pages) |
| Operator Console (`office/console.html`) | **9 groups, 35 pages** | Marketing (7) and Operations (7) are crowded; no departments/teams, workload or project tracking |
| Public website (`saas/site/`, built by `npm run build:site`) | **21 pages** (home, features ×7, industries ×6, pricing, receptionist, stories, help, contact, install, account deletion) | No dedicated Integrations or Security page in the site build (Trust Center exists as a separate account page) |
| Account pages (`saas/*.html`) | **21 pages** (sign-in, create account, verify, recover, worker onboarding, terms, privacy, trust centre, pay, …) | Mixed generations of styling |
| Workspace page weight | **44 stylesheets, 81 scripts** on `workspace.html`; **64 CSS files**, **82 distinct media queries** | First-wave target was ≤ 6 stylesheets; not reached. Main source of inconsistent look and of slow first load |

Secondary pages still registered (candidates to merge, routes kept as aliases):
- Communications: Call Handling, Email folder, Channel inbox (classic view), Phone numbers setup, Calls & SMS setup
- Growth: Growth Hub, Search & AI visibility, Pages & editor, SEO · Audit/Keywords/Google/Content/Local/Analytics/
  Reports, Search readiness (older), Search connection, Links & listings, Website & domain (older), Older campaign drafts
- Money: Bank Reconciliation, Reports & GST, Sales documents (older view)
- Setup: Automation Settings, User Manual, Import Your Data, Print & Export Hub, Support Access, Change Plan
- Work: Archived records · People: Offshore Staff

## 4. Design system and branding

- Tokens (`saas/ds/tokens.css`): deep navy background, **gold action colour `#E6B455`** (light theme `#8A6408`),
  WCAG AA pairs in both themes. Components: `saas/ds/components.css`, `kit.css`, `layout.css`, `refresh.css`,
  `retheme.css`, plus ~57 page stylesheets layered on top.
- Brand files: `oprun-icon.svg`, `oprun-mark.svg`, `oprun-logo.svg`, 192/512 PNG icons, `favicon.ico`,
  `manifest.webmanifest`. Old `superpro-*` icon files are still in `saas/` but **nothing references them**.
- The brief asks for **purple, cyan and subtle blue accents**. That replaces the current gold identity across
  logo, icons, emails and both apps: a brand decision that needs the owner's approval and the reference
  screenshot (not received; only the text brief arrived).

## 5. AI, automation and agents (what already exists)

- `src/automation/` engine: **36 catalogued actions plus 5 owner-switchable rules** with **4 policy levels** (automatic, rule-based, human
  approval, restricted), strict payload schemas, approver permissions, plain-language previews, executors and
  verifiers, schedules, and an approval queue. Covers enquiries, quotes, scheduling, invoices, reconciliation,
  campaigns, SEO, website updates, platform health, backups, failed jobs, reviews and refunds.
- `src/job-queue.js`: durable queue with retries, timeouts and idempotency (used by Media Studio and Reels).
- `src/platform-health.js`, operator "AI automations" and "Reliability & backups" pages.
- Missing for the brief's **AI Agent Manager**: a named-agent layer (owner, scope, permissions, queue, schedule,
  deadlines, escalation, performance) over this engine, and a command-centre view. Build on the engine, not a
  second system.

## 6. Security and tenant isolation

- 91 test files; 50 of them exercise tenant isolation or cross-business access. `npm test` (73 checks) gates
  every Render build.
- **4 live security warnings** from production start-up diagnostics (22 Nov): `OPERATOR_TOTP_SECRET` not set
  (founder key alone opens the console); business sessions renew for 365 days; `SESSION_MAX_AGE_DAYS` not set;
  first-letter password case swap still accepted (`STRICT_PASSWORD_MATCH` off). Each is fixed by a Render
  setting the owner enters; no code change needed.
- Client-supplied `workspace_id` / `organisation_id` is rejected or ignored by the routes tested this week
  (reels: rejected; AI video deletion: ignored, only the signed-in business is affected).

## 7. Backups and recovery

- Database: Litestream replicates the SQLite database continuously to an S3 bucket in `ap-southeast-2`
  (production log, 22 Nov). Uploaded files are copied to S3 (log: "saved 13 uploaded file(s) to S3").
- Last recorded restore check: 22 Nov 2026, isolated backup verification passed (commit `8573c88`).
- Before any high-risk change (database migration, legacy disk work): run a fresh restore check first.

## 8. Mobile and caching

- Android (Trusted Web Activity) and iOS (WebKit) projects build; **not published** (needs developer accounts,
  signing, real devices).
- Service worker (`sw.js`) is network-first with an offline fallback; it does **not** serve stale screens to
  online users. Its offline pre-cache list carries old version strings (low impact; tidy in Phase 3).

## 9. Not verifiable from this session

- **Live screenshots of oprun.ai**: this workspace's network blocks oprun.ai. Live-UI verification (brief §12)
  needs either Claude in Chrome on the owner's computer or the domain allowed for this session.
- Provider dashboards (Telnyx, Meta, Google, Stripe), Render environment values, the legacy service's disk
  contents, the Dependabot alert detail, real Android/iOS devices.

## 10. Classification

| Area | Decision | Why |
|---|---|---|
| Work pipeline (enquiry → quote → booking → job → invoice), Unified Inbox, approvals, AI Receptionist, Website hub, Reels, Media Studio (T-202), money ledger, staff roles, tenant isolation | **KEEP** (restyle only) | Working, tested, recently rebuilt |
| Public website, sign-in/registration screens, Business Workspace pages, Operator Console | **UPGRADE** | Working, but mixed visual generations and 44 stylesheets |
| Secondary pages (§3 list) | **MERGE** into their main page as tabs or filters; routes stay as aliases | Duplicates and "(older)" labels still reachable |
| AI Agent Manager, operator departments/teams/workload/assignment, project tracking, voice multilingual onboarding with workspace proposal, Integrations and Security public pages, temporary-suggestion system | **BUILD** (on existing engine, queue and nav registry) | Not present |
| Unused `superpro-*` icons, superseded PRs, stale tasks (T-194), legacy Render services | **RETIRE**, only after owner approval and, for services, after checking the legacy disk | Clutter or cost; data must be checked first |
| Self-hosted video (T-196), app-store publishing | **DEFERRED** | Need budget or developer accounts |
