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
