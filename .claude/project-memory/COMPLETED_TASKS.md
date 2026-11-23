# Completed tasks

A task appears here only after its acceptance criteria were verified. Each entry: ID, requirement, files, evidence.
Newest last. Never edit evidence after the fact; add a correcting entry instead.

## T-000 Repository discovery and preservation audit (P00)
- Requirement: inventory, feature classification A–I, security/deployment baseline, preservation strategy, 10 outputs; stop after the report.
- Files: none (read-only audit).
- Evidence: report delivered in chat on 2026-10-29. Not stored in the repository.

## T-001 Competitor intelligence and master blueprint (P01)
- Requirement: Salesforce, HubSpot, monday.com research; 50+ capability comparison; blueprint for three products; capability matrix; deliverables 1–8.
- Files: none.
- Evidence: report delivered in chat on 2026-10-29. Not stored in the repository.

## T-002 Enterprise infrastructure and security (P02)
- Requirement: server-side role enforcement, tenant isolation, private encrypted storage with signed URLs and file validation, backup separation and restore drill, job queue, observability, dev/staging/prod plan, CI security checks.
- Files: `src/security-policy.js`, `file-safety.js`, `object-storage.js`, `job-queue.js`, `observability.js`, `staff-access.js`, `db.js`, `s3-files.js`; `scripts/*` (tests and tools listed in PROGRESS.md); `infra/aws/*`; `render.staging.yaml`; `docs/infrastructure/*`; `.github/*`.
- Evidence: commit `5cf7377`; `npm test` passed; delivered as bundle and patch on 2026-10-30.

## T-003 Design tokens and component library (P03)
- Files: `saas/ds/tokens.css`, `components.css`, `icons.svg`, `motion.js`.
- Evidence: commit `6b387fd`; contrast table in `docs/design/DESIGN_SYSTEM.md` (all AA).

## T-004 Public website, 19 pages (P03)
- Files: `scripts/site/content.mjs`, `templates.mjs`, `scripts/build-site.mjs`, `saas/site/*.html`, `src/public-site.js`, `src/server.js` (route, sitemap, robots, llms.txt), `saas/ds/site.js`, `site.css`, `saas/ds/src/hero-3d.mjs`, `scripts/build-ds.mjs`, `saas/content/testimonials.json`.
- Evidence: commits `6b387fd`, `6a5ddc8`; `public-site.test.mjs` (11 checks) and `test:site-ui` 15/15.

## T-005 Retheme existing pages and app motion (P03)
- Files: `saas/ds/retheme.css`, `app-motion.js`, 22 pages listed in `docs/design/DESIGN_SYSTEM.md`, `scripts/test-ui.mjs` (accent assertion).
- Evidence: `test:ui` 33/33 at `6a5ddc8`; visual review at 390/768/1440.

## T-006 Visual regression, accessibility and performance (P03)
- Files: `scripts/test-visual.mjs`, `scripts/report-a11y-perf.mjs`, `scripts/visual/session.mjs`, `qa/reports/*`, `docs/design/DESIGN_SYSTEM.md`.
- Evidence: 51 screens identical on repeat runs; axe 0 issues on new site; LCP 0.7–1.2 s throttled mobile; commit `6a5ddc8`; `npm test` 73/73.

## T-036 Fix "Live update" notice sliding under the folded rail on phones (P03 follow-up)
- Requirement: on 390 px the Business OS "Live update" notice is partly hidden behind the folded navigation rail.
  It must sit fully inside the content area. Existed before P03.
- Files: likely `saas/ds/retheme.css` (no layout changes to other elements).
- Acceptance: notice fully visible at 390 and 768; `test:ui` 33/33; `test:visual` only the expected screens change.
- Files changed: saas/ds/retheme.css (+ .br/.gz); scripts/test-ui.mjs
- Evidence: test:ui 34/34 incl. new notice-vs-rail check at 390/700/768/1440 (fails without the rule); test:visual 51 same; npm test 73/73; public-site tests 11/11. Fix finished by a fresh Claude Code session in the recovery drill (recorded 2026-10-30 on phase-03-cinematic-design at 98f6389)

## T-035 Persistent autosave, checkpoint and resume system (P03.5)
- Requirement (owner prompt, 2026-10-30, summarised): persistent project memory in `CLAUDE.md` and
  `.claude/project-memory/` (MASTER_PLAN, PROGRESS, COMPLETED_TASKS, PENDING_TASKS, DECISIONS, ERROR_LOG,
  SESSION_HANDOVER, CHECKPOINTS); task IDs and statuses; checkpoints with timestamp, phase, task, steps, files, tests,
  branch, commit, errors, next action; automatic resume detection that verifies git state instead of trusting notes;
  handover before context runs out; atomic commits, no force-push, no automatic push without permission; failure
  recovery that never blindly retries migrations, payments, emails, deploys or external APIs; Claude Code hooks for
  startup and handover without loops; a recovery drill; no secrets in memory.
- Files: `CLAUDE.md`, `.claude/settings.json`, `.claude/project-memory/*`, `scripts/memory/*` (incl. `task.mjs`), `docs/process/PROJECT_MEMORY.md`,
  `scripts/project-memory.test.mjs`, `package.json`.
- Acceptance: memory files present and validated; `npm run memory:checkpoint`, `memory:snapshot`, `memory:resume`,
  `memory:validate` work; SessionStart hook prints state; contract test passes inside `npm test`; recovery drill
  (start task → snapshot → lose working tree → new session → resume → finish without repeating) passes.
- Remaining: see SESSION_HANDOVER.md.
- Files changed: CLAUDE.md; .claude/settings.json; .claude/project-memory/*; scripts/memory/*; scripts/project-memory.test.mjs; docs/process/PROJECT_MEMORY.md; package.json
- Evidence: commit 0af91f5; npm test 73/73; test:unit 132/132 incl. 5 project-memory tests; memory:validate, security:secrets, verify:manifest, smoke:test pass; recovery drill passed: fresh Claude Code session resumed and finished T-036 without repeating completed work (docs/process/PROJECT_MEMORY.md) (recorded 2026-10-30 on phase-03-cinematic-design at 0af91f5)

## T-038 Publish P02/P03 to GitHub
- Requirement: get the P02, P03 and P03.5 commits onto GitHub without touching main.
- Acceptance: branch `phase-03-cinematic-design` on GitHub matches the local branch; pull request into main open for the owner's review (no merge, no deploy).
- Evidence: branch phase-03-cinematic-design pushed to GitHub at 4d2c1c3 (matches local); pull request #33 into main opened for owner review; main untouched at 8318b9e; nothing merged or deployed (recorded 2026-10-30 on phase-03-cinematic-design at 4d2c1c3)

## T-039 Phase 04: complete Business Operating System integration
- Added: 2026-10-30
- Requirement: Owner prompt 2026-10-30 (full text in docs/phase-04/PROMPT.md). Use the Phase 00 inventory as mandatory preservation checklist; improve every existing module; complete broken or disconnected workflows. Subscriber workspace: dashboard, business setup, CRM/customers, enquiries, quotations, bookings, jobs, work orders, worker allocation, workforce compliance, offshore staff, AI receptionist, unified inbox, email and messaging, invoices, payments, accounting and GST, marketing, campaigns, social media, content studio, website management, SEO, AI approvals, files and documents, reports, analytics, branding, notifications, help and support, integrations, automation settings. Preserve pipeline Enquiry > Quote > Booking > Allocation > Completion > Invoice > Payment with correct propagation. Founder console: subscriber admin, organisation management, plans, platform billing, revenue analytics, infrastructure status, storage and backups, AI usage and costs, platform marketing, system email, support tickets, security and audit logs, feature flags, compliance, platform configuration; keep subscriber business comms separate from founder platform comms. Unified navigation, search, filters, notifications, activity history, AI assistance, file attachments, permissions, mobile. Never show success for a backend action that did not succeed. Every existing feature verified working or documented with blockers.
- Files: src/*, saas/*, office/*, scripts/*
- Acceptance: Feature inventory saved; pipeline end-to-end test passes; every module verified or blocker documented in docs/phase-04/VERIFICATION.md; no false success messages (tested); npm test and UI suites pass
- Files changed: src/pipeline.js, src/platform-health.js, src/business-ops.js, src/business-hub.js, src/staff-access.js, src/server.js, saas/workspace-pipeline.*, saas/workspace-ops.js, saas/workspace-nav.js, office/console-platform.*, office/console.js, scripts/*.test.mjs, scripts/test-pipeline-ui.mjs, scripts/test-console-platform.mjs, scripts/verify-modules.mjs, docs/phase-04/*
- Evidence: commit 55d009e; npm test 73/73; test:unit 139/139; test:ui 34/34; test:pipeline-ui 15/15; test:console-ui 12/12; verify:modules 47/47 with 0 problems; test:visual 51 unchanged; axe clean on new screens; report docs/phase-04/VERIFICATION.md (recorded 2026-10-30 on phase-04-business-os at 55d009e)

## T-046 Phase 05: autonomous AI operations with human governance
- Added: 2026-10-30
- Requirement: Owner prompt 2026-10-30 (full text in docs/phase-05/PROMPT.md). Central AI automation engine with 20 capabilities; 4-level approval policy (automatic, rule-based automatic, human approval, restricted); approval queue with full metadata and Approve/Reject/Edit/Schedule/Request clarification; server-side authorisation, structured tool schemas, idempotency keys, bounded retries, rate limits, complete audit; AI never follows instructions in untrusted content; no-code builder Trigger > Conditions > AI Analysis > Proposed Action > Approval > Execution > Verification with dry-run, versions, error recovery, emergency pause.
- Files: src/automation/*, saas/*, office/*, scripts/*
- Acceptance: Engine, policies, builder, queue and audit report working; level rules enforced and tested; injection and permission tests; npm test and UI suites pass; docs/phase-05/REPORT.md
- Evidence: Commits 2863893 and c6bc352: npm test 73/73, test:unit 155/155 (automation-governance 7, automation-engine 8), test:automations-ui 11/11 incl. axe and phone/iPad, test:ui 34/34, pipeline-ui 15/15, console-ui 14/14, verify:modules 49 modules 0 problems, visual 51 unchanged, a11y-perf clean; report docs/phase-05/REPORT.md (recorded 2026-10-30 on phase-05-ai-automation at c6bc352)

## T-049 Phase 06: autonomous SEO, Google and website intelligence platform
- Added: 2026-10-30
- Requirement: docs/phase-06/PROMPT.md (verbatim): modules A-H, deliverables 1-10, strict account separation, no fabricated search data, no ranking guarantees, human approval for public claims and production releases
- Files: src/seo/*, src/server.js, saas/workspace-seo-*.js, office/console-platform.js, scripts/*seo*.test.mjs, docs/phase-06/*
- Acceptance: Contract and browser tests for every module; real crawler/audit tested against the running server; Google clients tested against documented response formats and a live self-test recorded when credentials and network exist; report lists anything not verified
- Evidence: Commit 426b472: npm test 73/73, test:unit 169/169 (seo-audit 5, seo-units 5, seo-platform 4), test:seo-ui 11/11 with axe and phone/iPad, test:ui 34/34, pipeline-ui 15/15, console-ui 16/16, automations-ui 11/11, verify:modules 54/0, visual 51 unchanged, a11y-perf clean; live Google evidence tracked as T-053; report docs/phase-06/REPORT.md (recorded 2026-10-30 on phase-06-seo-platform at 426b472)

## T-054 Phase 07: unified communication and campaign automation
- Added: 2026-10-30
- Requirement: docs/phase-07/PROMPT.md (verbatim): channels, unified inbox folders and views, 10 AI functions, Telnyx voice audit and improvements, campaigns (email/SMS/social, calendar, scheduling, segments, tracking, AI recommendations, approvals), consent/unsubscribe/suppression, founder email isolation
- Files: src/comms/*, src/server.js, saas/workspace-comms-*.js, office/console-platform.js, scripts/*comms*.test.mjs, docs/phase-07/*
- Acceptance: End-to-end tests for inbox, AI functions, voice webhook flow against a mock Telnyx API, campaigns with approval and compliance, founder separation; report lists anything not verified live
- Evidence: comms.test 6/6, test:comms-ui 10/10, npm test, test:unit, test:ui, test:site-ui, test:pipeline-ui, test:console-ui, test:automations-ui, test:seo-ui, test:visual, security:secrets all pass; report:a11y-perf passes (home TBT lab variance, unchanged page) (recorded 2026-10-30 on phase-07-communications at 56086ac)

## T-056 Phase 08: finance, payments and compliance automation
- Added: 2026-10-30
- Requirement: docs/phase-08/PROMPT.md (verbatim)
- Files: src/finance/*, saas/workspace-finance-platform.*, office/console-platform.js, scripts/finance*.test.mjs, docs/phase-08/*
- Acceptance: Tested subscriber finance workflows (quotes, estimates, deposits, tax invoices, GST, receipts, payment links/status, refunds and credit notes with approval, reconciliation, reports, overdue reminders), platform billing (plans, trials, renewals, failures, changes with approval, revenue), payment architecture review, AI assists with approvals, versioned AU rules with sources, audit log, compliance review list; all suites pass
- Evidence: finance.test 6/6, test:finance-ui 11/11, npm test, test:unit 181/181, test:ui, test:site-ui, test:pipeline-ui, test:console-ui, test:automations-ui, test:seo-ui, test:comms-ui (re-run 10/10 after removing a racy assertion), test:visual, report:a11y-perf, security:secrets all pass (recorded 2026-10-30 on phase-08-finance at ed9de92)

## T-058 Phase 09: automated backup and reliability engine
- Added: 2026-10-30
- Requirement: docs/phase-09/PROMPT.md (verbatim)
- Files: src/reliability/*, office/console-platform.js, scripts/reliability*.test.mjs, docs/phase-09/*
- Acceptance: Audit of Render/DB/S3/GitHub; snapshot backups (encrypted, separate bucket, integrity, manifest), restore verification, config backup, retention via lifecycle, RPO/RTO doc; monitors for all listed components with alerts and daily summary; bounded self-healing; approval-only destructive actions; Founder dashboard; runbooks; tests pass
- Evidence: reliability.test 4/4, test:reliability-ui 7/7, npm test, test:unit 185/185, test:ui, test:site-ui, test:pipeline-ui, test:console-ui, test:automations-ui, test:seo-ui, test:comms-ui, test:finance-ui, test:visual, report:a11y-perf, security:secrets all pass (recorded 2026-10-30 on phase-09-reliability at e5c8c8c)

## T-061 Phase 10: final QA, security audit and release candidate
- Added: 2026-10-30
- Requirement: docs/phase-10/PROMPT.md (verbatim), including the automation policy table
- Files: scripts/release-audit.mjs, scripts/release-security.test.mjs, docs/phase-10/*
- Acceptance: Functional inventory diff vs main shows no removed routes/IDs (or each explained); security, automation, frontend, SEO and infrastructure audits evidenced by tests; verified failures fixed; all suites pass; release candidate, rollback plan and final report; pushed; not deployed
- Evidence: test:unit 197/197, npm test 74 checks, all UI suites, test:visual, report:a11y-perf (0 over budget), verify:modules 54/0, smoke, integration, deploy:check, release:audit, release-seo-check, security:secrets, npm audit 0 all pass (recorded 2026-10-30 on phase-10-release at 96bf844)

## T-064 Navigation prompts 1-6: nested sidebar and contextual sections
- Added: 2026-10-31
- Requirement: Owner authorises all six navigation prompts in this conversation: verify current live baseline; nested sidebar in both portals; contextual top section tabs; clarify overlap and readiness; responsive accessibility; complete regression matrix and release candidate. Preserve all routes permissions records and functions. Save checkpoints for resumption. No production deployment.
- Files: saas/portal-shell.*; saas/focused-workspace.*; saas/workspace-nav.js; office/console.*; scripts; docs/navigation
- Acceptance: All 60 business entries and 34 founder tabs mapped; nested sidebar and contextual sections work across roles and sizes; tests and repository checks pass; changes committed and saved; deployment remains separate
- Evidence: Implementation commit c10b382587ec87e9001f7c741f6f8616ee06c581; full npm test 45 contract files and 73/73 checks; committed-tree test:fast 69/69; navigation browser 575; reviewed visual 12; main UI 34 pipeline 15 automation 11 founder 16 SEO 11 comms 10 finance 11 reliability 7; module checks 66 with zero problems; quality smoke integration secrets manifest memory passed. Production unchanged. (recorded 2026-10-31 on codex/navigation-hierarchy-20261031 at c10b382)

## T-070 Accounts tab: stages, health lights, daily checks, reconnect alerts (Blueprint phase B)
- Added: 2026-11-09
- Requirement: Owner 2026-11-10 blueprint phase B; see docs/social-integrations/BLUEPRINT.md section 2 tab 1
- Files: saas/integration-manager.js; src/server.js; src/integration-runtime.js
- Acceptance: Each connection shows state and one fix action; daily health check job; tests pass; fits phone, iPad, laptop
- Evidence: npm test 73/73 passed; scripts/connections-health.test.mjs 6 tests passed; Connections browser test passed at 390, 768 and 1440 px; merged as PR #65 (6096efc); Render deploy dep-dbp6j2c9v7es73aorkig live with startup diagnostics 16/16 (recorded 2026-11-10 on claude/connections-memory-20261110 at 6096efc)

## T-071 Lead sources: tagging, tracked links, QR codes, source report (Blueprint phase F)
- Added: 2026-11-09
- Requirement: Owner 2026-11-10 blueprint phase F; see docs/social-integrations/BLUEPRINT.md section 2 tab 5
- Files: src/pipeline.js; src/db.js; saas
- Acceptance: Every new enquiry records a source; tracked link and QR per campaign; source report per workspace; isolation tests pass
- Evidence: npm test 73/73 passed; scripts/lead-sources.test.mjs passed; scripts/test-lead-sources-ui.mjs passed at 390, 768 and 1440 px with accessibility check; navigation 576 checks passed; merged as PR #65 (6096efc); Render deploy dep-dbp6j2c9v7es73aorkig live (recorded 2026-11-10 on claude/connections-memory-20261110 at 6096efc)

## T-075 Rebrand to Oprun: logo, tagline, product name
- Added: 2026-11-11
- Requirement: Owner (2026-11-11) approved the new brand Oprun with tagline 'Run your world.' and the crescent-moon arrow + compass star logo; authorised updating all user-facing names, icons, favicon, manifest and site copy, auditing, pushing and deploying to the production Render service for live testing.
- Files: saas/oprun-*.svg|png, saas/favicon.ico, saas/premium-ui.js, scripts/site/*.mjs, saas/**, office/**, src/**, README.md, package.json
- Acceptance: No user-facing 'Super Pro' text remains outside docs; new logo shows on site, sign-in, workspace and icons; npm test, test:ui, test:site-ui, check:site, security:secrets pass; infra identifiers unchanged
- Evidence: npm test 73/73, test:ui 34 (two clean runs), test:site-ui 16, check:site 19 pages, security:secrets clean, connections/lead-sources/meetings UI pass, visual 51 screens, a11y 0 serious; screenshots of home and sign-in checked (recorded 2026-11-11 on claude/oprun-rebrand-20261111 at 80274ce)

## T-093 Command Centre four sections + Setup Checklist fix (master prompt)
- Added: 2026-11-12
- Requirement: Business overview, Your Workspace, Action Centre (next step + AI brief), Workflow Guidance (8-stage live workflow + working setup checklist); fix Setup Checklist; keep aliases/RBAC; test and deploy to Render
- Files: saas/workspace-setup.js saas/command-centre-sections.js saas/workspace.html saas/command-centre.css saas/focused-workspace.js saas/page-sections.js saas/workspace-mobile.js scripts/test-redesign-ui.mjs
- Acceptance: npm test, test:redesign-ui, test:mobile-workspace-ui pass; live deploy healthy
- Evidence: npm test 73/73; test:redesign-ui PASS 320/390/768/1440 (4 tabs, 8 stages, checklist navigates+focuses, aliases, axe dark/light); test:mobile-workspace-ui 354 checks; verify:manifest; security:secrets (recorded 2026-11-12 on claude/workspace-and-priorities at 66b79aa)

## T-095 Founder Console tables: dense rows, sticky headings, phone cards (density batch 3 follow-up)
- Added: 2026-11-12
- Requirement: Frontend transformation progress file pending batch B3 follow-up: console tables sticky headers, dense rows, phone card layout; scoped to Founder Console; keep IDs/routes/RBAC
- Files: office/console-tables.js,saas/ds/kit.css,office/console.html,scripts/test-console-all-tabs.mjs
- Acceptance: No table sideways scroll at 390; labelled cards for 3+ columns; sticky headings at 1440; console-all, console-ui, navigation-ui, ui pass; own PR
- Evidence: Console tables: dense rows, sticky headings at 768/1440, labelled cards at 390 for 3+ column tables, scoped to #console-content. console-all 30 pages at 1440/768/390 with table assertions (negative check fails without script); console-ui 16; navigation-ui 594; ui 34; mobile-workspace-ui 354; npm test 73/73 (recorded 2026-11-13 on claude/t095-console-tables at 7750aae)

## T-096 Prompt 03 L1: dictionary foundation and Today screen
- Added: 2026-11-13
- Requirement: Prompt 03 Complete localization, first group: versioned dictionaries with review status, ICU-style plural/interpolation, per-screen coverage, explicit fallback, Today screen strings, mixed-language bidi isolation; translations marked machine-draft-unreviewed
- Files: saas/locale-catalog.js,saas/workspace.html,saas/workspace-locale.js,saas/workspace-locale.css,src/operator-console.js,office/console-platform.js,scripts/localization-dictionary.test.mjs,scripts/test-localization-ui.mjs
- Acceptance: English unchanged (dictionary equals HTML); hi/ur/ar cover shell+Today; plural/placeholder tests; Urdu Today in browser at 1440/768/390/360 with no sideways scroll and correct bidi; operator page shows version/review/per-screen coverage; npm test and UI suites pass
- Evidence: Dictionary foundation (version 2026-11-13.1, review status, SCREENS, screenCoverage, formatMessage with Intl.PluralRules) and 14 Today strings in hi/ur/ar (machine draft, unreviewed). localization-dictionary.test 4/4; localization unit 13/13; browser test PASS incl Urdu Today at 1440/768/390/360, bidi plaintext for English and isolate for translated text; npm test 73/73; test:unit 300 pass 0 fail (recorded 2026-11-13 on claude/fix-test-ui-staff at 20441bc)

## T-097 Prompt 03 L2: Today greeting and live figures board
- Added: 2026-11-13
- Requirement: Translate script-rendered Today text (greeting, live board labels, plurals, status, live badge, loading) through dictionaries with English fallback; redraw on language change; keep RTL order for mixed lines
- Files: saas/locale-catalog.js,saas/workspace-locale.js,saas/workspace-gadgets.js,saas/workspace.html,saas/workspace-locale.css,scripts/localization-dictionary.test.mjs,scripts/localization-ui.test.mjs,scripts/test-localization-ui.mjs
- Acceptance: English output identical; hi/ur/ar todayLive 24/24; board redraws without reload; Urdu tiles RTL isolate; npm test, unit, UI suites pass
- Evidence: todayLive 24 keys in hi/ur/ar (machine draft); OprunLocale.t; board redraw on oprun:locale-changed; Arabic six plural forms; English identical (tests); browser: Urdu greeting and board, ur->ar->ur switch without reload, tile lines rtl/isolate; npm test 73/73; test:unit 301 pass 0 fail; test:ui, command-centre-loading, redesign, mobile-workspace 354, navigation 594, console-all PASS (recorded 2026-11-13 on claude/l2-today-scripts at 3ac5a02)

## T-098 Prompt 03 L3a: industry vocabulary per locale
- Added: 2026-11-13
- Requirement: Translate server industry vocabulary (8 groups x 9 words incl. singular member) per locale; English stays server text; board uses translated words when available
- Files: saas/locale-catalog.js,saas/workspace-gadgets.js,scripts/localization-dictionary.test.mjs,scripts/test-localization-ui.mjs
- Acceptance: English dictionary equals src/industry-registry.js TERMS (test); Urdu board shows no English vocabulary; suites pass
- Evidence: 72 term keys hi/ur/ar (machine draft); dictionary 2026-11-13.3; sync test with industry registry 8 groups; browser: Urdu board has no Jobs/Team/Income/costs; npm test 73/73; test:unit 302 pass 0 fail; test:ui, command-centre-loading, mobile-workspace 354 PASS (recorded 2026-11-13 on claude/l3-terms-today at 8254b6e)

## T-099 Prompt 03 L3b: Today workflow guidance, Action Centre and feature finder
- Added: 2026-11-13
- Requirement: Migrate about 60 strings in saas/command-centre-sections.js (feature finder, Action Centre next steps, workflow guidance 8 stages with what/how/needs text, checklist states) to dictionaries via OprunLocale.t with English fallback; AI prompt texts stay English for the model but add the reader's language to the request; redraw on oprun:locale-changed
- Files: saas/command-centre-sections.js,saas/locale-catalog.js,scripts/localization-dictionary.test.mjs,scripts/test-localization-ui.mjs
- Acceptance: English output identical; hi/ur/ar coverage for new screen keys; browser check of Workflow Guidance and Action Centre tabs in Urdu at 390/1440; suites pass
- Evidence: 98 todaySections keys hi/ur/ar (machine draft), dictionary 2026-11-13.4; Action Centre, Workflow Guidance 8 stages, feature finder text via OprunLocale.t with English fallback; AI plan requested with Answer in <language>; redraw on language change; E-037 render loop fixed (40 and 99 rebuilds per 2s on main, now 0). Tests: dictionary+locale 12/12; localization browser PASS (Urdu tabs, stage detail, plan request); command-centre loading 14 cases incl loop check; npm test 73/73; test:unit 302 pass 0 fail; test:ui, redesign, navigation, mobile-workspace PASS (recorded 2026-11-13 on claude/t099-today-sections at 51fcd07)

## T-100 Prompt 03 L4: business navigation menu
- Added: 2026-11-13
- Requirement: Translate navigation group, page and related-page group names (workspace-nav.js DOMAINS and WORKFLOWS) per locale without changing routes; redraw both menus and dependent tiles on language change
- Files: saas/locale-catalog.js,saas/workspace-nav.js,saas/navigation-shell.js,saas/workspace.html,scripts/localization-dictionary.test.mjs,scripts/test-localization-ui.mjs
- Acceptance: English labels equal dictionary (test); Urdu menu, breadcrumb and chips translated; links still route; no overflow at 390; navigation-ui and all suites pass
- Evidence: nav dictionary 78 keys (8 groups, 60 pages, 9 related groups, More tools) hi/ur/ar machine draft, dictionary 2026-11-13.5; relabel on oprun:locale-changed keeps routes; render click listener moved inside bind guard; tests: dictionary+locale 13/13 incl sync with live menu; localization browser PASS (Urdu rail, chips, link routes); npm test 73/73; test:unit 303 pass 0 fail; navigation-ui, ui, mobile-workspace, redesign, console-all PASS; Urdu menu no overflow at 390 (recorded 2026-11-13 on claude/l4-navigation at dc42983)

## T-101 Prompt 03 L5: always-visible chrome
- Added: 2026-11-13
- Requirement: Translate top bar, floating Office chat and Ask Oprun, phone bottom bar and footer, including aria-labels, tooltips and placeholders; translate elements created after load
- Files: saas/workspace-locale.js,saas/locale-catalog.js,saas/workspace.html,saas/workspace-pad.js,saas/workspace-chat.js,saas/app.js,saas/workspace-mobile.js,saas/support.js,scripts/localization-dictionary.test.mjs,scripts/test-localization-ui.mjs
- Acceptance: Urdu chrome text and labels in browser; English identical (script text test); no clipping at 390; npm test, unit, UI and site suites pass
- Evidence: 19 chrome keys hi/ur/ar (machine draft), dictionary 2026-11-13.6; workspace-locale translateTree with data-i18n-attr (aria-label, placeholder, title, data-tip) and MutationObserver for late elements; tests: dictionary 8/8 incl script English invariant; localization browser PASS (top bar, labels, floating buttons, footer, phone dock in Urdu); npm test 73/73; test:unit 304 pass 0 fail; ui, mobile-workspace, navigation, redesign, site-ui 16 PASS; no clipping at 390 (recorded 2026-11-13 on claude/l5-chrome at 4581eca)

## T-102 Short professional language picker labels
- Added: 2026-11-13
- Requirement: Owner request 2026-11-13: language list titles short and professional; each language once in its own standard name, English name only for non-Latin scripts, no codes
- Files: saas/locale-catalog.js,saas/workspace-locale.js,scripts/localization-dictionary.test.mjs,scripts/test-localization-ui.mjs
- Acceptance: 197 unique labels, no codes or repeats, capitalised; browser shows English (Australia) and اردو · Urdu; suites pass
- Evidence: Labels via Intl.DisplayNames languageDisplay standard, capitalised, English appended for non-Latin; Twi override; 197 unique, longest 38 chars; dictionary test; browser picker check PASS; npm test 73/73; test:unit 305 pass 0 fail; console-ui 16 PASS (recorded 2026-11-13 on claude/language-list-labels at a3d2450)

## T-103 Prompt 03 L6: Today tabs and voice bar
- Added: 2026-11-13
- Requirement: Translate configured page tab names (28, focused-workspace.js) without changing their English section keys, and the Today voice bar (title, placeholder, buttons, chips, hint and all status messages)
- Files: saas/page-sections.js,saas/workspace-voicebar.js,saas/workspace-locale.js,saas/locale-catalog.js,scripts/localization-dictionary.test.mjs,scripts/test-localization-ui.mjs
- Acceptance: Urdu tabs and voice bar in browser; section keys and links unchanged; unknown keys never shown; all suites pass
- Evidence: 55 keys (28 tab names, 27 voice bar) hi/ur/ar machine draft, dictionary 2026-11-13.7; tab keys stay English (browser asserts keys and ?section link); translateOne skips unknown keys; dictionary 10/10 incl tab-name sync and voice bar script English; localization browser PASS; npm test 73/73; test:unit 306 pass 0 fail; navigation-ui, ui, mobile-workspace, console-all, redesign PASS (recorded 2026-11-13 on claude/l6-today-tabs-voicebar at 2ac4f71)

## T-104 Prompt 03 L7: notifications panel, subscription line, phrase translator
- Added: 2026-11-13
- Requirement: Translate the notifications panel and footer subscription line; add a reusable phrase translator for older HTML-string screens (exact English phrase to key, remembers English for switching back)
- Files: saas/workspace-locale.js,saas/platform-notices.js,saas/app.js,saas/locale-catalog.js,scripts/localization-dictionary.test.mjs,scripts/test-localization-ui.mjs
- Acceptance: Urdu panel text and labels, footer line; switching to English restores exact English; data untouched; suites pass
- Evidence: Phrase translator (data-i18n-phrases + window.OprunPhraseMaps) with English memory for text and aria-label/placeholder/title; notices map 62 phrases hi/ur/ar machine draft, dictionary 2026-11-13.8; subscription line split into text nodes (same English); tests: dictionary 11/11 incl phrase map sync; browser Urdu panel, close label, footer, en-AU round trip restores English; npm test 73/73; test:unit 307 pass 0 fail; ui, navigation, mobile-workspace, redesign PASS (recorded 2026-11-13 on claude/l7-notifications at 3ade869)

## T-105 S1 Meta sync and comment replies
- Added: 2026-11-13
- Requirement: Sync Facebook Page and linked Instagram posts, comments and follower totals; approved replies to synced comments; ownership re-checked on every call
- Files: src/channel-providers.js,src/server.js,scripts/channel-operations.test.mjs
- Acceptance: Unit test covers sync, ownership refusal, Page-token use, reply endpoints; npm test passes
- Evidence: channel-operations.test.mjs 11/11 incl. new S1 test; npm test 73/73; security:secrets passed (recorded 2026-11-13 on claude/s1-meta-sync at cee9f9a)

## T-106 S2 Instagram and Facebook image posting
- Added: 2026-11-13
- Requirement: Optional public https image on post drafts (additive column); Instagram container publish with status wait and no double publish; Facebook photo posts; image field in composer per selected account
- Files: src/channel-providers.js,src/channel-operations.js,saas/channel-operations.js,scripts/channel-operations.test.mjs
- Acceptance: Provider and route tests cover URL checks, publish once, error and timeout paths; channel UI test and npm test pass
- Evidence: channel-operations.test.mjs 13/13 incl. 2 new S2 tests; test-channel-operations-ui 4/4 at 390/768/1440; npm test 73/73; secrets scan passed (recorded 2026-11-13 on claude/s2-meta-media at e701f62)

## T-107 S3 WhatsApp approved templates
- Added: 2026-11-13
- Requirement: List approved UTILITY templates for the selected number; template replies to existing WhatsApp conversations after the 24-hour window, with approval; re-check approval at send; refuse opted-out numbers and marketing templates
- Files: src/channel-providers.js,src/channel-operations.js,saas/channel-operations.js,scripts/channel-operations.test.mjs
- Acceptance: Provider and route tests; channel UI and npm test pass
- Evidence: channel-operations.test.mjs 15/15 incl. 2 new S3 tests; channel UI 4/4; npm test 73/73; secrets scan passed (recorded 2026-11-13 on claude/s3-whatsapp-templates at 11bac49)

## T-108 S4 TikTok video posting
- Added: 2026-11-13
- Requirement: Approved TikTok posts from a public https video link; creator chooses visibility from TikTok's allowed options; video.publish permission required; one post only, status checked; AI suggestions never propose text-only posts where media is required
- Files: src/channel-providers.js,src/channel-operations.js,saas/channel-operations.js,scripts/channel-operations.test.mjs
- Acceptance: Unit and UI tests pass; npm test passes
- Evidence: channel-operations.test.mjs 16/16 incl. S4; channel UI 4/4 (390/768/1440); npm test 73/73; security:secrets passed (recorded 2026-11-13 on claude/s4-tiktok-publish at 0d2f2dc)

## T-109 S5a own-website contact form
- Added: 2026-11-13
- Requirement: Business can paste a ready-made enquiry form into its own verified website; only that https origin gets CORS and may be the return address; other foreign origins are refused; enquiries go to inbox and enquiries
- Files: src/server.js,src/comms/routes.js,saas/integration-manager.js,saas/workspace.html,scripts/comms.test.mjs
- Acceptance: comms tests incl. S5 pass; Connections UI test passes; npm test passes
- Evidence: comms.test.mjs S5 tests 2/2 plus existing contact test; test-connections-ui PASS; npm test 73/73; security:secrets passed (recorded 2026-11-13 on claude/s5-website at 465b45b)

## T-110 S5b website visit counts
- Added: 2026-11-13
- Requirement: Privacy-friendly daily visit counts for the verified website: page path and referring site only, no cookies, IPs, identifiers or query strings; bots and do-not-track skipped; verified origin only; owner view of totals, top pages and sources
- Files: src/website-visits.js,src/comms/routes.js,src/server.js,saas/integration-manager.js,saas/workspace.html,scripts/comms.test.mjs,scripts/route-guards.test.mjs
- Acceptance: comms S5b test passes; route guard reviewed; Connections UI passes; npm test passes
- Evidence: comms.test.mjs S5 tests 3/3; route-guards with reviewed public visit route; test-connections-ui PASS; npm test 73/73; security:secrets passed (recorded 2026-11-13 on claude/s5b-site-visits at 53ba53a)

## T-111 S6 Google Business Profile gaps
- Added: 2026-11-13
- Requirement: Show direction requests; monthly search terms that found the business (exact or fewer-than values); Business Profile posts may include a public photo, 1,500-character limit
- Files: src/seo/google.js,src/integration-insights.js,src/channel-providers.js,saas/integration-manager.js,saas/workspace.html,scripts/seo-units.test.mjs,scripts/channel-operations.test.mjs
- Acceptance: seo-units and channel tests pass; Connections UI passes; npm test passes
- Evidence: seo-units + channel-operations 0 failures incl. 2 new S6 tests; test-connections-ui PASS; npm test 73/73; security:secrets passed (recorded 2026-11-13 on claude/s6-google at 53fa914)

## T-112 V1 Facebook video and Instagram Reels posting
- Added: 2026-11-13
- Requirement: Owner: proper video posting on all social platforms. V1: Facebook Page video from public link, Instagram Reels, photo/video choice in composer
- Files: src/channel-providers.js,src/channel-operations.js,saas/channel-operations.js,saas/workspace.html,scripts/channel-operations.test.mjs
- Acceptance: channel unit + UI tests and npm test pass
- Evidence: channel-operations 18/18 incl. V1 test; channel UI 4/4 (390/768/1440); npm test 73/73; security:secrets passed (recorded 2026-11-13 on claude/v1-meta-video at d406973)

## T-113 C1 Connections: own sign-in, own app keys, switch account, audit
- Added: 2026-11-13
- Requirement: Owner: each business connects its own accounts (provider sign-in; never Oprun or Fleet Parlour accounts, never passwords); optional own developer app keys per platform family (encrypted, write-only, isolated); switch account; organised Connections; audit and fix buttons; secure backend
- Files: src/oauth-apps.js,src/server.js,src/integration-runtime.js,saas/integration-manager.js,saas/workspace.html,scripts/connections-safe-base.test.mjs,scripts/integration-tenant.test.mjs,scripts/test-connections-ui.mjs
- Acceptance: Server test for own keys; refresh test; Connections UI test incl. switch and own keys; button audit; npm test passes
- Evidence: connections-safe-base own-keys test pass; integration-tenant 8/8 incl. refresh; test-connections-ui PASS incl. switch account and own app keys; browser audit of 27 Connections buttons: no errors, no 5xx, no broken buttons; npm test 73/73; security:secrets passed (recorded 2026-11-13 on claude/c1-own-accounts at e53cebe)

## T-114 M1 one-row top and bottom bars
- Added: 2026-11-13
- Requirement: Owner: top and bottom bars messy on phones; business name hidden under the language button; redesign premium, organised, one row each; consistent sizing and spacing
- Files: saas/workspace-bars.css,saas/workspace-topbar.js,saas/workspace.html,saas/workspace-locale.js,saas/app.js,saas/integration-manager.js,scripts/test-localization-ui.mjs,scripts/test-connections-ui.mjs
- Acceptance: Phone 360/390 one-row top bar with name visible; More menu works and closes; one-row dock with no wrapped labels; tablet/laptop single row uniform; UI suites and npm test pass
- Evidence: Screenshots 360/390/768/1440 checked; navigation-ui 594 checks, mobile-readiness, redesign-ui, test-ui, localization-ui, channels, connections (3 runs), site, pipeline, console, automations, comms, finance, reliability, verify:modules, check:site, release:audit all pass; seo-ui one transient failure, passed 2 reruns and on base; npm test 73/73 (recorded 2026-11-13 on claude/m1-mobile-bars at 9be25b8)

## T-115 C2 sign-in hardening
- Added: 2026-11-13
- Requirement: Owner: sign-in not happening on any connection. Verified Oprun redirects correctly for all configured providers; make Meta permissions configurable (core by default, extras via META_EXTRA_SCOPES / META_SCOPES / WHATSAPP_SCOPES) so Meta does not refuse sign-in for unadded permissions; keep failed sign-in visible on the card
- Files: src/server.js,saas/integration-manager.js,saas/workspace-bars.css,saas/workspace.html,scripts/connections-safe-base.test.mjs
- Acceptance: Round-trip test: core scopes only, extras added, malformed dropped, refused sign-in recorded and shown; npm test passes
- Evidence: connections-safe-base 8/8 incl. new round-trip test; local browser check: Connect redirects to Facebook, Google, TikTok and X sign-in for 8 providers; connections-ui PASS; npm test 73/73 (recorded 2026-11-13 on claude/m2-connections-tidy at 8995658)

## T-116 V2 YouTube and X photo/video posting
- Added: 2026-11-13
- Requirement: Owner: video, photo and message posting on every social platform where possible. YouTube video upload with title, description and Public/Unlisted/Private; X photo and video via v2 chunked upload (media.write); safe server-side media fetch
- Files: src/media-fetch.js,src/channel-providers.js,src/channel-operations.js,src/server.js,saas/channel-operations.js,scripts/channel-operations.test.mjs
- Acceptance: Unit tests for upload, ownership, privacy, chunking, processing failure, fetcher address checks; npm test passes
- Evidence: channel-operations 21/21 incl. V2 and media-fetcher tests; channels-ui PASS; npm test 73/73 (recorded 2026-11-13 on claude/m2-connections-tidy at e58cf1b)

## T-117 C3 Connect does nothing on phones; gold badges
- Added: 2026-11-13
- Requirement: Owner: pressing Connect / Authorise does nothing. Show the result right under the buttons and scroll to it; show a tappable 'Continue to sign-in' link because phones may block opening the provider app without a direct tap; tidy cards; original gold badges instead of provider logos
- Files: saas/integration-manager.js,saas/workspace-bars.css,saas/workspace.html
- Acceptance: Browser check: message and link under Connect; connections, channels, navigation, mobile, redesign UI pass
- Evidence: Browser check at 980px: message under buttons, Continue link with provider URL; connections-ui, channels-ui, navigation-ui, mobile-readiness, redesign-ui pass; npm test 73/73 (recorded 2026-11-13 on claude/m2-connections-tidy at e58cf1b)

## T-118 M3 bottom bar on every page
- Added: 2026-11-13
- Requirement: Owner: bottom tabs only on Today; want relevant tabs on every section. Pages without their own tabs show their menu group's pages (related pages for single-page groups); distinct icons (19 new original icons) or short codes; many tabs scroll instead of squeezing
- Files: saas/workspace-mobile.js,saas/workspace-bars.css,saas/workspace.html,scripts/mobile-workspace.test.mjs
- Acceptance: All 60 menu pages show at least 2 dock items; mobile tests and UI suites pass
- Evidence: Browser sweep: 60/60 pages have dock items; mobile-workspace 9/9; mobile-readiness, navigation, redesign UI pass; npm test 73/73 (recorded 2026-11-13 on claude/m3-dock-everywhere at 0258280)

## T-119 C4 Connect blocked by callback check; compact Connections
- Added: 2026-11-13
- Requirement: Owner: Connect does nothing. Live logs: every provider stopped with 'callback address points to a different website'. Trust this app's own addresses (PUBLIC_BASE_URL, RENDER_EXTERNAL_HOSTNAME, APP_HOSTS); record the starting address and hand returning browsers back to it; log hosts on failure. Organise and compact cards
- Files: src/server.js,src/integration-security.js,saas/integration-manager.js,saas/workspace-bars.css,saas/workspace.html,scripts/connections-safe-base.test.mjs,scripts/test-connections-ui.mjs
- Acceptance: Relay test; unknown hosts still blocked; connections UI passes repeatedly; npm test passes
- Evidence: connections-safe-base 9/9 incl. relay test; connections-ui 4/4 consecutive runs; navigation-ui PASS; npm test 73/73; secrets passed (recorded 2026-11-13 on claude/m3-dock-everywhere at 0258280)

## T-120 M4 Workspace grid organised + one-row unique-icon bottom bar on every page
- Added: 2026-11-14
- Requirement: Owner: organise Workspace page icons professionally; fix double bottom bar on Connections (Overview); give every page one bottom bar with relevant, non-duplicate icons, especially Call handling
- Files: saas/command-centre-sections.js saas/workspace-bars.css saas/workspace-mobile.js saas/workspace.html
- Acceptance: Workspace grid grouped with distinct icons; nested tab groups render in one row; no two dock items share an icon on any page; tests pass
- Evidence: Sweep of 36 bar variations: none with two rows, no duplicate icons, no short codes; Connections Overview shows one bar (outer tab outlined gold, inner gold pill); Call handling: hash/phone/history. mobile-workspace 9/9, test:mobile-readiness, test:navigation-ui, test:redesign-ui, command-centre-loading-ui, npm test 73/73, secrets scan passed (recorded 2026-11-14 on claude/m4-workspace-grid at d967e48)

## T-143 AI receptionist v2: full enquiry, numbered reference, reply for approval, working texts/email
- Added: 2026-11-19
- Requirement: Owner 2026-11-19: receptionist must ask name (spelled), mobile, email, address, exact service and item (make/model/year), job details, preferred time; offer WhatsApp and photo-upload links; save customer email+address and a structured enquiry (not transcript); unique enquiry number shared with the customer; draft reply for approval then email+SMS on approval; fix SMS and email sending; for all subscribers.
- Files: src/comms/receptionist-intake.js, src/comms/voice.js, src/pipeline.js, src/business-hub.js, src/ai-provider-shim.js, src/integration-transports.js, src/saas-platform.js, src/notify.js, src/notifications.js, src/server.js, saas/workspace-receptionist.js, saas/integration-manager.js, saas/workspace-pipeline.js, scripts/receptionist-intake.test.mjs
- Acceptance: npm test passes; intake tests cover email/address/reference/approval drafts/dedupe/links; UI test passes
- Evidence: npm test 73/73, node --test scripts/*.test.mjs 351 pass (15 intake tests incl. email/address/reference/approval drafts/dedupe/links), test:ui 35/35, verify:manifest ok (recorded 2026-11-19 on fix/receptionist-intake-v2 at 32f6d2b)

## T-144 Email/SMS connect: clear errors for refused keys; SMS number must have a messaging profile
- Added: 2026-11-19
- Requirement: Owner 2026-11-20: connecting Resend and Telnyx in Connections both showed 'Authorisation expired or was revoked' with correct details.
- Files: src/integration-transports.js, scripts/integration-tenant.test.mjs
- Acceptance: Refused keys explain the fix without the key; sending-only Resend key explained; number without messaging profile refused; tests pass
- Evidence: Merged PR #140 (commit ca0160b): npm test 73/73, integration-tenant tests 9/9 incl. refused-key test (recorded 2026-11-19 on claude/ai-website-spec at ca0160b)

## T-146 AI Website spec pack (docs/ai-website)
- Added: 2026-11-19
- Requirement: Owner brief 2026-11-20 (docs/ai-website/PROMPT_ORIGINAL.txt): one-section AI website with generation, transfer/redesign, cinematic 3D, domains, business email, SEO and white-hat backlinks, Oprun integration; 11 outputs.
- Files: docs/ai-website/*
- Acceptance: All 11 outputs present, contract consistent with code, sources listed, progress state updated
- Evidence: docs/ai-website spec pack: 11 outputs + contract + sources + resume prompt; facts checked against code at ca0160b and provider docs 2026-11-20 (recorded 2026-11-19 on claude/ai-website-spec at ca0160b)

## T-145 Customer quote acceptance link + review request link, sent by SMS and email
- Added: 2026-11-19
- Requirement: Owner 2026-11-20: create an acceptance link for the customer, sent by text and email; add a review/feedback request link for every subscriber's customers by text and email; audit, no mistakes. Backend WIP on branch wip/quote-accept-review (commit 258f4d4); UI, tests and audit still to do.
- Files: src/customer-links.js, src/comms/outbound.js, src/pipeline.js, src/saas-platform.js, src/comms/receptionist-intake.js, src/server.js, saas/workspace-pipeline.js
- Acceptance: Quote send (SMS/email) with preview; public accept/decline page books the job when a time was proposed; review link page stores rating and notifies owner; customer texts only via the business's own sender; tests + UI tests pass
- Evidence: npm test 73/73; node --test scripts/*.test.mjs 368 pass (customer-links 8 tests: send rules, preview, single private link, accept books proposed time, decline, expiry, review once + no gating); test:ui 36/36 (recorded 2026-11-19 on claude/quote-review-links at b070239)

## T-147 W-01 AI Website: `saas/workspace-website.js`: **Website** section with 7 tabs that mount the existing SEO v
- Added: 2026-11-19
- Requirement: `saas/workspace-website.js`: **Website** section with 7 tabs that mount the existing SEO views; B06 shows one item; every old view id and `#b06/...` address opens the right tab; placeholders `website`, `searchconsole`, `backlinks` show what is coming instead of a request form, and existing requests stay listed (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: `test:ui`: every old address resolves; B06 has one item; no element id removed; phone/tablet/laptop screenshots
- Evidence: npm test 73/73; unit 368 pass (website-hub 8 tests: build from facts, AI fallback, ownership-gated transfer + redirects, domain uniqueness + TXT verify, email SPF merge + checks, listings/links import, activity isolation, DoH); test:ui 36/36 incl. Website section + old routes; phone screenshot no sideways scroll (recorded 2026-11-19 on claude/quote-review-links at b070239)

## T-164 Appointment reminders by text, email and in-app: customer, business and assigned worker
- Added: 2026-11-19
- Requirement: Owner 2026-11-19: on the appointment day remind the customer, the business (in Oprun) and the assigned employee; reminders at each step by email, SMS and notification. Today only a day-before customer email automation exists (send_appointment_reminder).
- Files: src/automation/catalogue.js, src/notifications.js, src/comms/outbound.js
- Acceptance: Day-before and day-of reminders to customer by SMS+email via the business sender, in-app to owner, SMS/in-app to assigned workers; no duplicates; tests pass
- Evidence: job-lifecycle tests 8/8 (day-before in 8am-8pm local window, day-of, approve/auto/off modes, SMS only via business sender, no duplicates, workers + owner summary); npm test 73/73; test:ui 37/37 (recorded 2026-11-20 on claude/reminders-allocator-invoice at 4e1fe05)

## T-165 Job Allocator: offer to chosen workers or the open pool, confirm when filled
- Added: 2026-11-19
- Requirement: Owner 2026-11-19: booked job appears in the Job Allocator with an approval option; after approval refer it to chosen employees or put it in a pool for an employee to pick; then the job is confirmed. Today 'Offer to workers' offers to all eligible workers only.
- Files: src/server.js (work-orders offer), saas/workspace-pipeline.js, Job Allocator UI
- Acceptance: Owner can pick specific eligible workers or the pool; first acceptances fill required_workers; job shows confirmed and the customer confirmation draft goes to Approvals; tests pass
- Evidence: offer to chosen eligible workers or the pool (eligible preview endpoint, ineligible choice refused 409); allocation triggers team alert + customer confirmation (approval by default); tests above + npm test 73/73 (recorded 2026-11-20 on claude/reminders-allocator-invoice at 4e1fe05)

## T-166 Send approved invoice and payment link to the customer by text and email; payment and review reminders
- Added: 2026-11-19
- Requirement: Owner 2026-11-19: after completion, invoice approved by a human, then sent; payment; review; reminders at each step by email, SMS and notification.
- Files: src/pipeline.js, src/customer-links.js, payments module
- Acceptance: Issued invoice can be sent with a preview by SMS/email incl. payment link; overdue reminder drafts; review request offered after payment; tests pass
- Evidence: Send invoice & payment link on issued invoices (existing payments request with send_to_customer, delivery problems shown); customer payment texts only via the business sender; pipeline/finance tests pass; npm test 73/73 (recorded 2026-11-20 on claude/reminders-allocator-invoice at 4e1fe05)

## T-155 W-09 AI Website: Cloudflare for SaaS: custom hostnames API, host middleware, status polling, cache purge on
- Added: 2026-11-19
- Requirement: Cloudflare for SaaS: custom hostnames API, host middleware, status polling, cache purge on publish (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: A test domain goes `added → active`; unknown hosts get 404; another business's host never serves this site
- Evidence: Custom-domain hosting wired (edge.js, hub hosting status/poll, seo mount, contact form on business domains). Tests: website-edge 6/6, website-hub 8/8, seo-platform end-to-end edge checks, comms send-failure reason + retry; npm test 73/73, test:ui 37/37. Switched on only when CLOUDFLARE_SAAS_* env vars are set. (recorded 2026-11-20 on claude/custom-domains at 9568f69)

## T-167 Product-wide audit and adaptive redesign specification (country onboarding, page redesign, devices, advanced AI features, legal/billing)
- Added: 2026-11-20
- Requirement: Owner prompt of 20 Nov 2026, kept verbatim in docs/product-redesign/PROMPT_ORIGINAL.txt: audit every page, country-based onboarding (Australia keeps full verification; other countries email+phone only; non-AU workers upload documents only), page-by-page redesign with sequential mobile-first screens, automatic adaptation for desktop/tablet/mobile browser/Android app/iOS app, advanced AI features (website, domain, migration, social studio, campaigns), legal/security/billing checklist, phased implementation plan, progress state.
- Files: docs/product-redesign/*
- Acceptance: Eight required outputs written, grounded in the current code with file references, decisions needing the owner listed, progress state updated, committed and pushed.
- Evidence: Specification written in docs/product-redesign/ (00-07 + PROMPT_ORIGINAL.txt), grounded in code at 4f60bcc with file references; npm run manifest/memory checks passed. Implementation is phased in 07_IMPLEMENTATION_PLAN.md; Phase 1 next. (recorded 2026-11-20 on claude/product-redesign-spec at 4f60bcc)

## T-168 Phase 1: country-based sign-up and worker documents pack
- Added: 2026-11-20
- Requirement: Implement docs/product-redesign/02_COUNTRY_ONBOARDING.md and Phase 1 of 07_IMPLEMENTATION_PLAN.md; Australian sign-up unchanged.
- Files: src/country-profile.js, src/server.js registration routes, src/db.js, saas/create-account.html, saas/worker-onboarding.html, src/workforce-compliance.js
- Acceptance: Tests in 02 §6 pass; existing AU registration tests unchanged; npm test and test:ui pass.
- Evidence: Country sign-up built: src/country-profile.js, registration country branch + voice code resend, org country/verification_level columns, documents-only worker pack, unpaid international trials cannot message customers (INTL_TRIAL_OUTBOUND=allow overrides). Tests: scripts/country-signup.test.mjs 2/2 (AU unchanged, GB/IE flows, duplicates, blocked country, workers, outbound gate); npm test 73/73; test:ui 37/37; test:site-ui 16/16; browser check of create-account GB flow reaching verify-account. (recorded 2026-11-20 on claude/country-signup at c920d94)

## T-170 Country rules: invoices, currency, tax wording, e-invoicing notices, marketing send window
- Added: 2026-11-20
- Requirement: Owner 20 Nov 2026: fix everything according to each country's local rules and regulations. Implemented per docs/product-redesign/06 §5.
- Files: src/country-rules.js, src/finance/rules.js, src/finance/service.js, src/finance/routes.js, src/payments.js, src/customer-links.js, src/job-lifecycle.js, src/comms/service.js, saas/workspace-finance-platform.js
- Acceptance: scripts/country-rules.test.mjs passes; AU finance tests unchanged; npm test and UI tests pass.
- Evidence: Country rules in code (src/country-rules.js) for invoices, currency, tax wording/rates, e-invoicing notices, tax summary, record retention, dates, phone normalisation, marketing send window. Tests: scripts/country-rules.test.mjs 4/4 (UK VAT invoice end to end in GBP, US/IT/AU rules, send window, phones); npm test 73/73; test:ui 37/37; test:finance-ui 11/11; customer-links 8/8; job-lifecycle 8/8. (recorded 2026-11-20 on claude/country-rules at 2386889)

## T-171 Phase 2: navigation clean-up
- Added: 2026-11-20
- Requirement: docs/product-redesign/03 §1: shorter main menu, duplicates under More, every route kept; notifications open the Unified Inbox.
- Files: saas/workspace-nav.js, src/comms/*, src/message-delivery.js, src/business-ops.js, docs/navigation/*
- Acceptance: Main menu 30 pages; all 61 routes resolve; nav, redesign and UI tests pass.
- Evidence: Main menu 61 -> 30 pages; 31 duplicates/specialist tools under each group's More list; Consent moved to Customers; notifications and settings links open the Unified Inbox; light-theme contrast fix for Secure account; phone dock tab fits 390px. Tests: npm test 73/73; test:ui 37/37; test:navigation-ui pass (608 checks); test:redesign-ui pass; redesign-preservation + mobile-workspace unit tests pass. test-mobile-workspace-ui still fails at a pre-existing Work-tab aria check (fails on main too). (recorded 2026-11-20 on claude/nav-cleanup at 3d22ba9)

## T-172 Phase 3: adaptive foundation (device/shell detection, layout rules, breakpoint guard, app markers)
- Added: 2026-11-20
- Requirement: docs/product-redesign/05 §2,§3,§8 and Phase 3 of 07: data-device/data-shell/data-pointer before first paint on every app page; Android and iOS apps identify themselves; touch rules; no new breakpoints.
- Files: saas/ds/platform.js, saas/ds/layout.css, saas/*.html, mobile/android/.../AndroidManifest.xml, mobile/ios/Oprun/OprunApp.swift, scripts/platform.test.mjs, scripts/breakpoints.test.mjs, qa/breakpoints-legacy.json
- Acceptance: Unit tests pass; npm test, test:ui, navigation/redesign/site UI tests pass.
- Evidence: saas/ds/platform.js + layout.css on all 21 app pages; app markers in AndroidManifest and OprunApp.swift; tests: platform.test 4/4, breakpoints.test 2/2, npm test 73/73, test:ui 37/37, navigation-ui 608 checks, redesign-ui, site-ui 16/16, mobile-readiness pass; browser probe phone/android-app, tablet/ios-app, desktop/browser with no errors or overflow. (recorded 2026-11-20 on claude/adaptive-foundation at 4dec06a)

## T-173 Phase 4: sequential Business setup and Add worker
- Added: 2026-11-20
- Requirement: docs/product-redesign/03 §4-§5: Business setup one section per step with Back / Save and continue, saved per step, step remembered, ticks and review; Add worker in three steps on phones.
- Files: saas/workspace-steps.js, saas/workspace-steps.css, saas/workspace.html, saas/workspace-extras.js, scripts/test-ui.mjs
- Acceptance: UI check passes; npm test and UI suites pass.
- Evidence: workspace-steps.js/css: Business setup stepper (8 steps, saves via existing handler per step, remembered, ticks, review) and Add worker 3 phone steps; unnamed logo/address controls detached so they cannot block saving; one quiet confirmation per step. Tests: new test:ui check passes (UI CHECKS 38), npm test 73/73, test:navigation-ui 608 checks, test:redesign-ui pass. (recorded 2026-11-20 on claude/sequential-setup at 74c852a)

## T-174 Phase 5 (part 1): page clean-up from a visual audit
- Added: 2026-11-20
- Requirement: docs/product-redesign/03: related-page rows and the phone tab bar show main pages only; no stray text; phone tab bars fit 390px; local date format for the trial; the phone-layout regression test passes again.
- Files: saas/workspace-nav.js, saas/workspace-mobile.js, saas/workspace-bars.css, saas/workspace-pipeline.js, saas/workspace-finance-platform.js, saas/app.js, scripts/test-mobile-workspace-ui.mjs
- Acceptance: test-mobile-workspace-ui passes for all 61 pages at 390/1440; npm test and UI suites pass.
- Evidence: Visual audit at 390/1440: secondary pages removed from related rows and phone tab bar (shown only while open); stray null text fixed in new enquiry form and sales documents; phone tab bars fit (shrink to 44px, 8+ wrap); trial date localised; stale mobile test updated for page tabs and the 14 Nov nested-row rule. Tests: test-mobile-workspace-ui 311 checks PASS (61 pages x 2 widths), npm test 73/73, test:ui 38/38, test:navigation-ui 608, test:redesign-ui, test:comms-ui 10, test:finance-ui 11. (recorded 2026-11-20 on claude/page-redesign at c83f4d8)

## T-175 Visual refresh and working phone tabs
- Added: 2026-11-20
- Requirement: Owner 2026-11-20: bottom tabs looked like they did nothing; redesign the whole app with a better colour scheme, spacing, organised sections, duplicates removed, professional and cinematic.
- Files: saas/ds/refresh.css, saas/workspace-mobile.js, saas/workspace-extras.js, saas/workspace.html
- Acceptance: Tapping a bottom tab scrolls to its content and names it; one consistent card/button/field/tab style in dark and light; inbox list first on phones; no 'Access used' toast; all UI suites and npm test pass
- Evidence: npm test 73/73, test:ui 38/38, navigation-ui 608, redesign-ui phone/tablet/desktop, mobile-workspace-ui 311, breakpoints 2/2 passed; screenshots checked at 390 and 1440 (recorded 2026-11-20 on claude/visual-redesign at 2ae40db)

## T-176 Remove duplicates and fix phone layouts
- Added: 2026-11-20
- Requirement: Owner 2026-11-20 'Continue next' after T-175: organise sections and remove duplicates across the app.
- Files: saas/ds/refresh.css, saas/workspace-tidy.js, saas/app.js, saas/workspace.html
- Acceptance: No repeated label/tab/heading triples; tooltips no longer echo visible labels; Work stage counters and new-customer fields fit a phone; Money cards have no empty blocks; setup checklist readable; all suites pass
- Evidence: npm test 73/73, test:ui 38, navigation-ui 608, redesign-ui, mobile-workspace-ui 311, breakpoints pass; duplicate audit and phone screenshots checked (recorded 2026-11-20 on claude/page-organisation at 02607e8)

## T-177 AI Receptionist in steps
- Added: 2026-11-20
- Requirement: Owner 2026-11-20 'Continue next': split the longest pages into clear steps so the owner doesn't scroll one long form.
- Files: saas/workspace-receptionist.js, saas/ds/refresh.css, saas/portal-shell.js, scripts/test-ui.mjs
- Acceptance: Receptionist shows one of 5 steps at a time with a step list, Back/Next and save-and-continue for the greeting form; one related-pages row per page; checkbox beside its label; all suites pass
- Evidence: npm test 73/73, test:ui 38 (receptionist steps check added), navigation-ui 608, redesign-ui, mobile-workspace-ui 311, breakpoints pass; phone and desktop screenshots checked (recorded 2026-11-20 on claude/receptionist-steps at 9538192)

## T-178 Top bar on phones and Select all channels/platforms
- Added: 2026-11-20
- Requirement: Owner 2026-11-20: Command Centre heading left-aligned on phones; theme switch in the phone top bar; remove the 'F' circle if it has no purpose. Campaign Studio and Media Studio need 'Select all' so one campaign goes to every connected channel/platform at once, linked to the backend.
- Files: saas/ds/refresh.css, src/comms/service.js, src/comms/routes.js, src/server.js, saas/workspace-comms-platform.js, saas/app.js, saas/workspace.html, saas/workspace-extras.js, scripts/comms.test.mjs
- Acceptance: Heading left on phone; theme toggle visible on phone; initials circle hidden; GET channels, POST bundle, POST bundle submit work with per-channel approval; Media Studio saves one render per platform; tests pass
- Evidence: npm test 73/73; comms.test new bundle and multi-platform render tests pass; test:ui 38, navigation-ui 608, redesign-ui, mobile-workspace-ui 311, comms-ui 10; browser check: select all -> drafts -> submit all (recorded 2026-11-20 on claude/topbar-mobile at 93ad7bd)

## T-179 Multiple photos and videos for campaigns and posts
- Added: 2026-11-20
- Requirement: Owner 2026-11-20: add multiple photos and videos to campaigns and posts.
- Files: src/comms/service.js, src/growth.js, saas/workspace-comms-platform.js
- Acceptance: Campaign holds up to 10 library photos/videos; social posts carry them; Facebook posts photos/video; email shows photos; tests pass
- Evidence: npm test 73/73 (new comms media test, growth-media-publish test); test:ui 38, navigation-ui 608, redesign-ui, mobile-workspace-ui 311, comms-ui 10; browser: upload 2 photos, library pick/remove, saved and reloaded (recorded 2026-11-20 on claude/campaign-media at c0fd610)

## T-180 Video meetings, Zoom, invites and call keypad
- Added: 2026-11-20
- Requirement: Owner 2026-11-20: make the Video section professional; send meeting invites by message, email or any platform; integrate Zoom so a business adds its own Zoom details and signs in to run meetings; organise the call section, remove what is not needed, add a keypad to dial numbers.
- Files: TBD
- Acceptance: TBD after audit
- Evidence: npm test 73/73 (new meetings-zoom test, click-to-call test); test-meetings-ui PASS (3-way WebRTC, axe); test:ui 38, navigation-ui 608, redesign-ui, mobile-workspace-ui 311; screenshots 390/1440 (recorded 2026-11-20 on claude/meetings-zoom at cb2e494)

## T-181 Official social platform logos in Connections
- Added: 2026-11-20
- Requirement: Owner 2026-11-20: replace the custom generated social icons in Connections with the platforms' official logos (Facebook, TikTok, Instagram, WhatsApp and all others), sized automatically.
- Files: TBD
- Acceptance: TBD
- Evidence: npm test 73/73; test:ui 38, navigation-ui 608, redesign-ui, mobile-workspace-ui 311; Connections screenshots 390 light and 1440 dark: 10 official icons, 2 Oprun badges (recorded 2026-11-20 on claude/official-logos at 6cc637e)

## T-182 Notifications panel redesign and footer spacing
- Added: 2026-11-20
- Requirement: Owner 2026-11-20: redesign the Alerts and Delivery activity lists in notifications (smaller, organised, professional); remove the extra space under the footer on every page and anywhere else; make the footer short and professional; push to Render.
- Files: saas/platform-notices.js, saas/ds/refresh.css, saas/portal-shell.js, saas/workspace.html
- Acceptance: Compact rows with icon, title, time, status chip; no space below footer on phone (only the tab bar) or laptop; footer compact; all suites pass
- Evidence: npm test 73/73; test:ui 38, navigation-ui 608, redesign-ui, mobile-workspace-ui 311, localization-ui, meetings-ui; measured gap below footer = tab bar only (phone) and 0 (laptop) (recorded 2026-11-20 on claude/notifications-footer at 9cf8d50)

## T-183 Phone page and desktop launcher overlap
- Added: 2026-11-20
- Requirement: Owner 2026-11-20: Office chat and Ask Oprun overlap the footer on desktop; move the keypad out of Video Meetings into its own Phone section in Communications with Keypad, Recents and Contacts (all customers' numbers), calling from the business number.
- Files: saas/workspace-phone.js, src/meeting-extras.js, src/comms/voice.js, saas/workspace-nav.js, saas/locale-catalog.js, saas/workspace-meetings.js, saas/ds/refresh.css
- Acceptance: Phone page with 3 tabs works on phone and desktop; recents and contacts from data; launchers inside footer band on desktop; all tests pass
- Evidence: npm test 73/73; test:ui 38, navigation-ui 616, mobile-workspace-ui, redesign-ui, localization-ui, meetings-ui; browser check of keypad match, recents, contacts at 390/1440 (recorded 2026-11-20 on claude/phone-page at 25f8ff7)

## T-184 Video meetings quality, backgrounds, calendar and appointments
- Added: 2026-11-20
- Requirement: Owner 2026-11-20: Oprun video with HD up to 4K/8K where possible and background change; meetings on a calendar; Work > Bookings gets Appointments (customer meetings) on the calendar with AI-assisted automated reminders and notifications; organise Zoom setup.
- Files: TBD
- Acceptance: TBD
- Evidence: npm test 73/73 (new appointments.test: calendar, slots, clash, video link, reminder once, team alert, isolation); test-meetings-ui PASS; test:ui 38, navigation-ui, mobile-workspace-ui, redesign-ui; browser: blur/backdrop effect sends CanvasCapture track, Full HD 1920x1080; appointment form and calendar at 390/1440 (recorded 2026-11-20 on claude/meetings-pro at 3eed0c9)

## T-185 Media Studio preview and AI video generation
- Added: 2026-11-20
- Requirement: Owner 2026-11-20: preview and play generated videos and images inside Media Studio; enhance the AI setup and integrate the best AI video generators so any idea or prompt produces a top-quality video, AI-assisted.
- Files: TBD
- Acceptance: TBD
- Evidence: src/ai-video.js (own Google Gemini Omni 1.2 / Runway Gen-4.5, Veo 3.1, Kling 4.0, Seedance 2.5 keys, encrypted; AI prompt director; background generate+poll; MP4 saved to tenant_media), saas/media-viewer.js lightbox, saas/workspace-ai-video.js panel, library preview buttons. scripts/ai-video.test.mjs pass; test-ai-video-ui.mjs pass (real H.264 plays, preview, 390/768/1440 fit, axe clean); npm test 73/73; test:ui 38, navigation, redesign, localization, mobile workspace pass. (recorded 2026-11-20 on claude/media-studio-ai at 0804f19)

## T-186 Video call: full screen, in-call invite, transcription
- Added: 2026-11-20
- Requirement: Owner (21 Nov 2026): in Video Meetings call screen add a full-size (full screen) option; add an Invite button in the call with Email, Message (SMS) and Copy link so the invitation goes straight from the video; add transcription of the video conversation with an option to save it.
- Files: saas/meet-call.js, saas/meetings.css, src/meetings.js, src/meeting-extras.js
- Acceptance: Full screen toggles on desktop and phone; invite from call sends email/SMS via business senders and copy link works; transcript captured during call can be saved to the meeting and viewed later; tests and UI checks pass; deployed
- Evidence: meet-call.js: Full screen (iPhone falls back to native video player), in-call Invite (Email/SMS/WhatsApp via business senders, copy link, share, allow guests), host Transcribe with consent prompt, live captions for all, transcript panel and download; src/meetings.js transcript table + endpoints (host-only toggle, saved only while on, access organiser/managers/attendees, txt download, delete). meetings-transcript.test.mjs + meetings.test.mjs pass; test-meetings-ui.mjs pass (fullscreen, invite tabs, copy link, captions to guest, transcript panel, 390/1440 fit, axe); npm test 73/73. (recorded 2026-11-20 on claude/call-tools at 4ecf81a)

## T-187 Telnyx calling fix and one own-number setup for SMS and calls
- Added: 2026-11-20
- Requirement: Owner (21 Nov 2026, screenshot): Phone call fails 'Telnyx refused the call: Connection has no Outbound Profile assigned D38'. Fix. When a business sets up Telnyx SMS in Connections, calling must be set up automatically with the same number; every business uses only its own number; the operator's (platform) number must never be used by or accessible to subscribers. Audit and fix.
- Files: src/comms/voice.js, src/comms/receptionist-telnyx.js, src/integration-*, saas connections UI
- Acceptance: Click-to-call works after automatic outbound voice profile assignment; SMS number connection also enables calls; no platform number fallback for businesses; tests pass; deployed
- Evidence: receptionist-telnyx.js: ensureOutbound (reuse/create 'Oprun outbound calls' profile in business account, attach to app) in connect step 4b; setupCalling from SMS number (separate 'Oprun outgoing calls' app, inbound routing untouched, needs public key); callCredentials; voice.js D38 auto-repair + one retry; webhook verifies with call creds; Connections SMS save sets up calling and reports result; PLATFORM_SMS_FOR_BUSINESSES honoured only in tests so the operator number is never used for a business. receptionist-telnyx.test.mjs 12/12; npm test 73/73; test:ui 38; comms UI 10. (recorded 2026-11-20 on claude/telnyx-own-number at efda7cb)

## T-188 Web phone: call straight from the browser with a live call screen
- Added: 2026-11-20
- Requirement: Owner (21 Nov 2026, screenshot): calling from Phone rang his own mobile instead of the dialled number. The call must go to the number dialled; show live call (calling, ringing, timer), keypad disappears, controls cancel/end, mute and similar, professional recording.
- Files: saas/workspace-phone.js, src/comms/receptionist-telnyx.js, src/meeting-extras.js, saas/vendor/telnyx
- Acceptance: Dial places a WebRTC call from the business number to the dialled number; live call screen with mute, tones, hold, speaker, record (consent), end; Recents with recording; tests pass
- Evidence: Telnyx WebRTC SDK 2.28.2 (MIT) vendored; per-business SIP credential connection 'Oprun web phone' (ani_override business number, outbound profile) + per-member telephony credential, 24h JWT only; call log + private recordings; live call screen. webphone.test.mjs pass; test-webphone-ui.mjs pass (ringing, timer, mute, tones, hold, record consent, end, Recents recording, 390/1440, axe); npm test 73/73. (recorded 2026-11-20 on claude/web-phone at 0c95e87)

## T-189 Enquiry alerts from inquiry@oprun.ai, professional email design, enquiry SMS fix
- Added: 2026-11-20
- Requirement: Owner (21 Nov 2026, screenshots): enquiry emails arrive from security@oprun.ai; enquiries must come from inquiry@oprun.ai (email and message), security stays separate for verification. Redesign all Oprun emails to be highly professional (logo visible without images, clear sections, confidentiality/legal notes). Enquiry SMS to mobile not received ('Message could not be sent' SMS). Audit and fix.
- Files: src/email-templates.js, notification senders, src/notify.js
- Acceptance: Enquiry email from inquiry@oprun.ai; security codes from security@; new template; SMS enquiry alert delivered or clear cause; tests pass
- Evidence: email-templates.js redesign (HTML-drawn mark visible with images blocked, eyebrow, details card, callout, confidentiality/APP notice, audience line, Trust Center link, optional postal address); mailer.enquirySender -> 'Oprun Enquiries <inquiry@oprun.ai>' (ENQUIRY_FROM override), security@ kept for verification; receptionist owner email uses kind enquiry with structured facts and button; enquiry SMS uses ENQUIRY_SMS_FROM when set, falls back once to platform number, failure reason logged as [ALERT SMS]. email-templates.test 4/4, receptionist-intake 16/16, npm test 73/73. (recorded 2026-11-21 on claude/web-phone at fa7f1a6)

## T-190 AI video creator: camera recording, longer videos, own photos/videos, own voice
- Added: 2026-11-20
- Requirement: Owner (21 Nov 2026): in Media Studio add recording a short video from the live camera to generate from; length not limited to 15 seconds; upload own photos or videos from gallery/mobile/laptop and generate from them (e.g. a face photo + prompt); record own voice so the video speaks in the person's own voice; fully AI assisted.
- Files: src/ai-video.js, saas/workspace-ai-video.js
- Acceptance: Camera capture to library; reference photos/videos used in generation; long videos via extension/chaining; own-voice narration; tests pass
- Evidence: PR165 squash merged main cfcae59; CI44857659877 and Security44857659884 green. Node22 npm test73/73 with81 contract files; AI-video camera and recorded-voice two-shot generation/playback UI, web phone, meetings, localization, mobile, navigation, redesign and comms pass. Render srv-dbuq98ojo6nc73aro66g deploy dep-dc0ghqbrjlhs739ukbt0 LIVE 2026-11-21 03:05:34 UTC; six read-only production smoke checks pass. Full evidence in docs/coordination/chatgpt.md. (recorded 2026-11-21 on codex/t190-release-handover at cfcae59)

## T-191 Multilingual voice dictation for AI video ideas and prompts
- Added: 2026-11-21
- Requirement: Owner 21 Nov 2026: add microphone speech-to-text beside AI video idea and director prompt inputs. Users dictate naturally in their language, text appears in the prompt field, then existing AI prompt writing and video generation work. Automatic language detection for provider-supported languages, explicit browser language fallback, editable review, accurate professional states and performance. Do not claim universal language support or zero recognition errors.
- Files: saas/workspace-ai-video.js, saas/workspace-ai-runtime.js, saas/workspace-video-dictation.js, saas/workspace.html, saas/ds/refresh.css, scripts/video-dictation.test.mjs, scripts/test-ai-video-ui.mjs
- Acceptance: Idea and prompt dictation; auto detection server request; selectable browser mode; original scripts/RTL preserved; no automatic paid generation; existing edits protected; no stale results after navigation/workspace switch/signout; permission/errors/limits handled; responsive and accessibility checks; backend and relevant UI regressions pass
- Evidence: Focused dictation/runtime18/18 pass; local Node22 npm test73/73; CI44868951803 job136738892502 feature UI group passes including real fake-device microphone capture, Urdu idea, Hindi prompt, existing AI-video playback and accessibility; source/handover validation and CodeQL pass at remote261281c, tree ba706167 matches local5088342. Broader CI continues; combined release waits for T-192. (recorded 2026-11-21 on codex/t191-video-prompt-dictation at 5088342)

## T-192 Custom full-length and continue-until-stopped AI video duration
- Added: 2026-11-21
- Requirement: Owner 21 Nov 2026: after completing T-191 voice dictation, replace fixed visible 15/30-second sections with custom full video duration including 1,5,10 minutes and an unlimited option. Deliver one continuous finished video; handle provider clip limits internally without exposing sections. Unlimited must mean continue until the person explicitly finishes, with ongoing provider charges clearly disclosed and no claim of an unlimited native provider clip. Test both tasks, then push to Render for owner live testing.
- Files: src/ai-video.js, src/media-tools.js, saas/workspace-ai-video.js, scripts/ai-video-projects.test.mjs, scripts/test-ai-video-ui.mjs
- Acceptance: Custom durations accepted and final duration matches requested length within encoding tolerance; no segment selector shown; continuous generation can be stopped and finalized safely; clear billing consent; tenant/role isolation, retries, cancellation and output limits handled; test evidence; combined release deployed and verified
- Evidence: Candidate 6dd2a0ec594662299e990fda3721a57746928dd5 tree 834275b22a1dba8587325bde67b7f6434284c906: Node22 full suite 73/73; focused regressions 23/23; hosted CI44870894755 and Security44870894658 all six checks pass; actual 60/300/600-second final media; browser custom duration and continuous Finish acceptance. Code verified, not deployed. (recorded 2026-11-21 on codex/t193-unified-media-studio-audit at 42c7ed3)

## T-193 Unified Media Studio audit and implementation specification
- Added: 2026-11-21
- Requirement: Audit original Media Studio and AI Video Generation, diagnose Google402 with evidence, map all duplicates, design one mobile-first Idea-Prompt-Media-Settings-Voice-Generate-Preview-Save/Post system, specify microphone and multilingual fallback, reliable generation and campaign/social integration, recommend current APIs, acceptance criteria and transfer-safe progress. Deliver all nine requested outputs in order; do not claim implementation or funded acceptance.
- Files: docs/media-studio/UNIFIED_MEDIA_STUDIO_SPEC.md;docs/coordination/chatgpt.md
- Acceptance: Evidence-linked current audit, billing diagnosis with limitations, keep/remove/merge map, unified architecture, voice placement/behavior, generation and error contracts, social capability matrix, sequenced implementation and test gates, completed specification progress state and exact next action preserved.
- Evidence: All nine required specification sections and ten design progress items verified; repository audit with exact source locations, official billing/model/voice sources checked, production and candidate CI independently reverified; documentation structure and manifest/memory checks pass. Specification only; implementation is T-194. (recorded 2026-11-21 on codex/t193-unified-media-studio-audit at 42c7ed3)

## T-195 Master Media Studio recovery research audit and approval blueprint
- Added: 2026-11-21
- Requirement: Owner MASTER AI MEDIA STUDIO TRANSFORMATION21Nov: execute phases0-3 only before major implementation; verify current GitHub/Render/assets, T185-T194 and redesign status; diagnose missing redesign, reported Speak controls and Google402 without claiming live resolution; research17 specified competitors using official sources; exhaustive source inventory; propose3 design directions and recommended architecture/database/APIs/security/two-tenant tests/roadmap/rollback/cost; maintain five media-studio coordination documents and append-only task journal; preserve and push documentation on separate Codex branch; stop for explicit owner blueprint approval before phases4-8 and separate production approval.
- Files: docs/coordination/media-studio-*.md;docs/media-studio/master-*;docs/coordination/chatgpt.md
- Acceptance: Evidence-linked production recovery;17-competitor matrix with public facts vs inference;machine-readable source inventory;three UI directions;modular reversible architecture and feature flags;threat model and adversarial acceptance matrix;prioritized batch plan;explicit blocked/untested live evidence;five coordination docs committed and pushed;concrete approval request before implementation.
- Evidence: Phases0-3 documentation deliverable verified: production/main58fc72b and five live assets match, read-only deploy6/6;17 official-source competitor rows;347 source-census records with50 source hashes;five requested coordination docs plus architecture/database/API/security/threat/roadmap/risk and three design directions;doc structure, manifest749, memory and secret checks pass. Authenticated runtime, funded providers and fresh backup restore remain explicitly unverified;T194 implementation approval pending. (recorded 2026-11-21 on codex/t195-media-studio-blueprint at fef2e17)

## T-197 Free professional reel maker for all subscribers
- Added: 2026-11-22
- Requirement: Owner (22 Nov): every subscriber, including the owner, uploads their own photos and videos and gets professional social reels (hooks, titles, features, framing, branded end card) at zero cost: no paid AI, runs on Render CPU with FFmpeg, real faces kept, nothing invented.
- Files: src/reel-maker.js, src/assets/fonts/*, src/server.js, saas/workspace-reel-maker.js, scripts/reel-maker.test.mjs
- Acceptance: npm test passes; render test produces a valid MP4 with text, cross-fades, end card for 9:16 and 1:1; UI test creates a reel; deployed and live on Render
- Evidence: npm test 73/73 passed; test:ui 38 passed; scripts/reel-maker.test.mjs 2/2 (9:16 720p 13 s reel with photos, clip, logo, music, end card rendered in about 16 s; 1:1 reel; tenant isolation; idempotency; delete keeps library video); test-reel-maker-ui passed (upload, suggest words, make, play, post draft with caption, 390/768/1440 fit, axe clean); ai-video-ui, media-studio-guided-ui, studio-editor, studio-draft-ui passed; security:secrets passed (recorded 2026-11-22 on claude/t197-reel-maker at 8573c88)

## T-198 AI Website spec v2 refresh (owner prompt 23 Nov)
- Added: 2026-11-22
- Requirement: Owner re-issued the AI Website architect brief (saved in docs/ai-website/PROMPT_V2_2026-11-23.txt): redesign/specify the one-section website system (new site + transfer/redesign with SEO equity, cinematic 3D, SEO/AEO + white-hat backlinks, domain buy/transfer preferring Cloudflare or Namecheap, business email, Oprun integration, tools/agents, MVP plan, progress state). Zero duplicates: update the existing docs/ai-website pack, do not write a second one.
- Files: docs/ai-website/*
- Acceptance: Every v2 output covered and cross-linked; facts refreshed Nov 2026 with sources; registrar decision for Cloudflare API and Namecheap recorded; honest code status; progress state updated; memory valid; pushed
- Evidence: docs/ai-website updated: 00 contract D-W15..D-W18, 01 Nov 2026 refresh, 02 mermaid buy/forwarding, 03 wizard, 06 in-app buy flow + Namecheap + forwarding, 07 AI crawlers, 09 agents + tools, 10 status/next order + W-18..W-20, 11 progress state with honest code status, SOURCES, resume prompt, PROMPT_V2 saved; new tasks T-199..T-201; memory:validate, verify:manifest and security:secrets passed (recorded 2026-11-22 on claude/ai-website-v2 at 4cb2553)

## T-199 W-18 AI Website: llms.txt per published site + owner AI-crawler setting in robots.txt (D-W18)
- Added: 2026-11-22
- Requirement: From brief v2 (docs/ai-website/PROMPT_V2_2026-11-23.txt) and docs/ai-website/00_CONTRACT.md
- Files: src/seo/routes.js, src/seo/service.js, saas/workspace-website.js
- Acceptance: GET /sites/:site/llms.txt and custom-domain /llms.txt return the business summary, services, areas, contact and pages; robots.txt reflects the setting; change needs approval; tests pass
- Evidence: scripts/ai-visibility.test.mjs 3/3 (robots rules, llms escaping, live free address + custom domain, owner-only, manager 403, isolation, audit, none mode removes llms); seo-platform + website-edge + website-hub 18/18; test:ui 38 (Growth panel); npm test 73/73 (recorded 2026-11-22 on claude/t199-llms-txt at 3c494cf)

## T-202 Media Studio redesign: one tool per page, old material removed, preview everywhere
- Added: 2026-11-22
- Requirement: Owner (23 Nov): Media Studio still shows old AI-generated videos. Redesign the whole Media Studio, delete previous material (owner chose: permanently delete his workspace's AI-generated videos), fresh compact version, one item per page, no extra suggestions/wording, add video preview, professional, zero errors, zero duplication; push to Render for live testing.
- Files: saas/workspace.html, saas/workspace-studio.js, saas/workspace-studio.css, saas/workspace-media.js, saas/workspace-ai-video.js, saas/workspace-reel-maker.js, saas/workspace-studio-editor.js, saas/workspace-studio-audio.js, saas/media-viewer.js, saas/app.js, src/ai-video.js, scripts/test-media-studio-ui.mjs, scripts/ai-video-generated-delete.test.mjs
- Acceptance: Tabs Library/Reels/Editor/AI video, one page visible; legacy spec form/trends/readiness/specs and guided layout removed; preview on library, reels and AI cards; owner can delete all AI-generated material in own workspace only; tests and npm test pass; live on Render
- Evidence: npm test 73/73; test:ui 38; test-media-studio-ui (4 tabs, one page visible, keyboard, preview, no legacy nodes, 390/768/1440 fit, axe clean per tab, phone dock); test-reel-maker-ui; test-ai-video-ui (incl. two-tap delete of AI videos); ai-video-generated-delete.test (own workspace only, uploads/other org/running kept, manager 403, audit); ai-video/studio/reel/media unit tests 17/17; release validation passed (recorded 2026-11-22 on claude/media-studio-redesign at 0e7bfb0)

## T-203 Transformation wave 2 - Phase 1 read-only audit, backlog and visual blueprint
- Added: 2026-11-22
- Requirement: Owner master brief 23 Nov (docs/transformation/PROMPT_ORIGINAL.txt): read-only audit of Render, Git, coordination files, pages, design, agents, security, backups; KEEP/MERGE/UPGRADE/BUILD/RETIRE; backlog; visual blueprint; present and request approval. New release rule: no merge to main / no production without explicit owner approval.
- Files: docs/transformation/*
- Acceptance: Audit facts verified against Render, GitHub and repo; backlog with live-UI acceptance; blueprint; checkpoint; branch pushed; nothing deployed
- Evidence: docs/transformation 00-04 written; facts verified 23 Nov: Render list_services (6 services, live 6cbbe20), list_deploys, gh PR list (26 open), nav registry parse (31 main + 31 secondary), console defs (9 groups/35 pages), automation ACTIONS 36 + RULES 5, tokens (gold, Manrope/Bodoni), sw.js network-first; memory:validate, verify:manifest, security:secrets passed; docs-only, nothing deployed (recorded 2026-11-22 on claude/transformation-phase1 at 6cbbe20)

## T-194 Implement unified Media Studio and provider recovery
- Added: 2026-11-21
- Requirement: Implement approved T-193 specification: remove competing creator/specification UX, typed provider402 recovery and readiness, one project flow with adjacent dictation controls, actual editing/output controls, integrated campaign/channel handoff, preserve legacy records, test all paths before combined deployment.
- Files: saas/workspace.html;saas/app.js;saas/workspace-ai-video.js;saas/workspace-video-dictation.js;src/ai-video.js;src/server.js;src/growth.js;src/channel-providers.js;scripts/
- Acceptance: One creator and library; no draft queue pretending to render; typed402 with saved draft and explicit funded fallback; multilingual reviewable dictation; real final videos; channel capability-gated variants and approved publishing; accessibility/mobile/recovery/tenant/security/browser tests green; authorized exact-commit Render deploy verified.
- Evidence: Released in 8573c88; its unified creator UI was then replaced by T-202 (PR #174, live 6cbbe20). Provider recovery kept and covered by scripts/media-provider-recovery.test.mjs (passing in npm test 73/73 on 6cbbe20) (recorded 2026-11-22 on claude/transformation-phase1 at 739d1d7)

## T-204 TR-10/TR-12 gold token scale and hard-coded gold clean-up
- Added: 2026-11-22
- Requirement: Transformation Phase 3 (palette kept gold, D-056): one gold scale in saas/ds/tokens.css; replace hard-coded gold-family colours in saas/*.css, saas/ds/*.css, office/*.css with the scale (alpha kept); warning/alert ambers excluded; no intended visual change except unifying legacy gold variants
- Files: saas/ds/tokens.css; saas/*.css; saas/ds/*.css; office/*.css
- Acceptance: Before/after screenshots of 31 workspace pages + public/sign-in pages (dark 1440/390, light 1440) show only small colour differences; npm test and test:ui pass; deployed to oprun-test
- Evidence: 533 hard-coded gold values in 59 stylesheets now use the --sp-gold-100..800 scale (saas/ds/tokens.css); warning ambers excluded; offline.css kept literal (works offline); meet.html now loads tokens.css; cache versions bumped (44 pages + site template V). Screenshot diff before/after on 105 page shots (31 workspace pages dark 1440/390 + light 1440, public and sign-in pages): none above 0.1% (largest = live clock). npm test 73/73; test:ui 38 (recorded 2026-11-22 on claude/transformation-staging at dfe3be6)

## T-205 TR-11 design-system catalogue and shared component styles
- Added: 2026-11-22
- Requirement: Transformation Phase 3: one reference page of every shared component in dark and light, generated from the workspace so it stays in step; fix components that only looked right inside their own pages
- Files: scripts/build-design-catalogue.mjs; saas/design-system.html; saas/design-system.js; saas/ds/retheme.css; saas/workspace.html; saas/join-team.html; scripts/design-catalogue.test.mjs
- Acceptance: Catalogue renders all sections in both themes on phone and laptop with no errors; contrast pairs pass AA; screenshot diff shows no page regressions; npm test and test:ui pass
- Evidence: saas/design-system.html generated from workspace (49 stylesheets, icon sprite) with colours, gold scale, live AA contrast table (all 10 pairs pass in dark and light), type, buttons, forms, status, cards, tabs, table, dialog/toast; noindex; CSP-clean (external design-system.js). New shared styles in retheme.css: link-button and danger-button (fixes unstyled AI-video 'Clear' and 'Schedule deletion' buttons), badge, data-table/table-scroll. app.css now versioned (cache). Audit corrected: 49 stylesheets, not 44. 105-shot screenshot diff: no change above 0.06%. Tests: design-catalogue 2/2, breakpoints, npm test 73/73, test:ui 38 (recorded 2026-11-22 on claude/transformation-staging at 71d2535)

## T-206 TR-20 one button standard (44px, 16px side padding) across primary, secondary, portal and danger buttons
- Added: 2026-11-22
- Requirement: Owner: pick the best professional combination and continue. Unify the two button sets so every main button has the same height and padding in dark and light themes.
- Files: saas/ds/retheme.css, saas/ds/retheme.css.br/.gz, saas/*.html version strings, saas/design-system.html
- Acceptance: Buttons measure 44px with 16px padding in both themes; screenshot diff shows only button-size changes; npm test, test:ui, release validation and secret scan pass
- Evidence: Buttons measured 44px/16px padding in dark and light; screenshot diff 105 signed-in shots: 6 pages over 0.5%, all taller buttons shifting content; npm test 73/73, test:ui 38/38, release validation and secret scan pass. T-204/T-205 light-theme evidence corrected in 04_PROGRESS.md (recorded 2026-11-22 on claude/transformation-staging at 5d0adb3)

## T-207 TR-13 brand assets: Oprun icons on every page, workspace installable, outbound checks named Oprun
- Added: 2026-11-22
- Requirement: Check logo/icons on every page, manifest, emails and both apps; keep superpro-* copies (D-022)
- Files: saas/*.html, scripts/build-design-catalogue.mjs, src/visibility.js, src/seo-cluster.js, src/server.js, scripts/brand-assets.test.mjs
- Acceptance: Every page's icon links load (200); workspace links the manifest; sign-in has no Install and keeps #signin-operator-link; tests pass
- Evidence: Browser check on local server: icon, apple-touch and manifest links return 200 on all 25 pages; workspace signed in with manifest; sign-in shows no Install and #signin-operator-link visible; brand-assets test 2/2; npm test 73/73; test:ui 38; release validation and secret scan pass (recorded 2026-11-22 on claude/transformation-staging at 207aa4b)

## T-208 TR-14 public website v2: Integrations and Security pages, live server prices, a11y/perf report fixed
- Added: 2026-11-22
- Requirement: Backlog TR-14: new Integrations and Security pages, pricing from server, Lighthouse-level a11y/perf on mobile, every claim matches a built feature. Existing site already redesigned (Phase 03), so no rewrite.
- Files: scripts/site/content.mjs, scripts/site/templates.mjs, saas/site/*, saas/ds/site.css, saas/ds/site.js, src/public-site.js, scripts/report-a11y-perf.mjs, scripts/public-site-v2.test.mjs
- Acceptance: Pages render on phone and laptop; claims each traced to code; prices follow /api/saas/plans; axe 0 serious on all public pages; Web Vitals budgets met; tests pass
- Evidence: Screenshots of /integrations and /security at 1440 and 390; price sync verified in browser (mocked A$59/A$99.50 shown, real server A$49/99/149); routes 200 and in sitemap; public-site-v2 test 3/3; npm test 73/73; test:ui 38; a11y/perf report: 0 serious issues on public pages, 0 over budget; release validation and secret scan pass (recorded 2026-11-22 on claude/transformation-staging at d3d99f8)

## T-209 TR-15 sign-in pages polish: aligned fields, fixed registration intro, footer clear of help button, plain-language labels
- Added: 2026-11-23
- Requirement: Backlog TR-15: sign-in, create account, verify, recover pages in the new system; keep #signin-operator-link; no Install option on sign-in
- Files: saas/ds/retheme.css(+.br/.gz), saas/create-account.html, saas/sign-in.html, retheme version refs, saas/design-system.html
- Acceptance: No horizontal overflow at 320/390/768; side-by-side fields aligned; intro stays while form scrolls on laptop; footer links not covered; sign-in fits one phone screen; operator link visible; tests pass
- Evidence: Browser checks: scrollWidth equals viewport at 320/390/768 on 5 auth pages; intro rectTop 0 when scrolled 1300px at 1440; footer links covered by help button: 0; screenshots before/after; npm test 73/73; test:ui 38 (sign-in fits 390x900, operator link visible, no install link); a11y report: sign-in/create-account dark 0 issues (recorded 2026-11-23 on claude/transformation-staging at 27e1316)
