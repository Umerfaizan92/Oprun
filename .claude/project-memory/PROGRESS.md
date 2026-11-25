# Progress

Where the project stands, phase by phase. Detail per task lives in COMPLETED_TASKS.md and PENDING_TASKS.md.
Last updated: 2026-10-30 (P03.5 completed).

## Repository state

- Default branch `main` = `8318b9e` on GitHub (last commit before this work).
- Local branch `phase-02-infrastructure-security` = `5cf7377` (P02).
- Branch `phase-03-cinematic-design` = P02 + P03 + P03.5 commits, pushed to GitHub on 2026-10-30 after the owner
  installed the Claude GitHub App on this repository. Pull request into main awaits the owner's review.
- Other tools (Codex, Cursor) have their own remote branches (`codex/*`, `cursor/*`). Do not modify or delete them;
  check `git log origin/main` for new commits before starting work.

## P00 Repository discovery and preservation (COMPLETED)

Inventory, feature classification A–I, security and deployment baseline, preservation strategy. Report delivered in
chat; it is not stored in the repository. No code changed.

## P01 Competitor intelligence and master blueprint (COMPLETED)

Salesforce, HubSpot and monday.com compared on 50+ capabilities (verified vs inferred); blueprint for website,
Business OS and Founder Console; capability matrix Existing → Improved → New → Automated → Human approval.
Report delivered in chat; not stored in the repository. No code changed.

## P02 Enterprise infrastructure and security (COMPLETED, commit 5cf7377)

- New modules in `src/`: `security-policy.js`, `file-safety.js`, `object-storage.js`, `job-queue.js`,
  `observability.js`.
- `staff-access.js` worker/contractor permission ceiling; `db.js` indexes; `s3-files.js` server-side encryption.
- Scripts: `verify-storage.mjs`, `restore-drill.mjs`, `secret-scan.mjs`, `post-deploy-check.mjs`, `test-server.mjs`
  and tests.
- `infra/aws` least-privilege policies, `render.staging.yaml` (render.yaml untouched), `docs/infrastructure/*`,
  `.github/workflows/ci.yml`, `security.yml`, `dependabot.yml`.

## P03 Cinematic design system and frontend transformation (COMPLETED, commits 6b387fd, 6a5ddc8)

- Design system in `saas/ds/`: tokens (midnight/graphite, gold actions, cyan live/AI), components, 30-icon sprite,
  motion engine, Three.js hero (lazy, SVG fallback), retheme bridge for 22 existing pages, app motion.
- Public website: 19 pages generated from `scripts/site/` into `saas/site/`, clean routes in `src/public-site.js`,
  `/start` trial redirect, sitemap, robots, llms.txt.
- Tests and reports: `scripts/public-site.test.mjs`, `test-site-ui.mjs` (15), `test-visual.mjs` (51 screens),
  `report-a11y-perf.mjs`; results in `qa/reports/`; documentation in `docs/design/DESIGN_SYSTEM.md`.

## P03.5 Persistent autosave, checkpoint and resume (COMPLETED)

`CLAUDE.md`, `.claude/project-memory/`, `scripts/memory/` (resume, checkpoint, snapshot, restore, task, validate),
hooks in `.claude/settings.json`, `docs/process/PROJECT_MEMORY.md`. Recovery drill passed with a fresh Claude Code
session that resumed and finished T-036.

## Test suites (all passing at 6a5ddc8)

| Command | What | Last result |
|---|---|---|
| `npm test` | syntax, migrations, permissions, pipeline, contract tests, quality, manifest | 73/73 |
| `npm run test:unit` | contract tests (`scripts/*.test.mjs`) | 127/127 |
| `npm run test:ui` | Business OS and Console browser checks | 34/34 |
| `npm run test:site-ui` | public website browser checks | 15/15 |
| `npm run test:visual` | 51 screens vs local baselines (`test:visual:update` makes them) | 51 same |
| `npm run report:a11y-perf` | axe WCAG 2.2 AA and throttled Web Vitals | 0 new-site issues, all budgets met |
| `npm run smoke:test`, `integration:test`, `security:secrets`, `verify:manifest` | runtime, integrations, secrets, manifest | pass |

## Log

One line per notable change, newest last (written by `npm run memory:task -- progress`).
- 2026-10-30: T-036 done: live-update notices stay right of the folded rail on phones (finished in the recovery drill by a new session)
- 2026-10-30: T-035 done: project memory, checkpoints, recovery snapshots, resume check, hooks; recovery drill passed
- 2026-10-30: Branch pushed and PR #33 opened into main (no merge, no deploy)
- 2026-10-30: Phase 04 complete: pipeline connected, 47 modules verified, offshore staff, automation, search, founder platform tabs
- 2026-10-30: Phase 04 pull request #34 opened (stacked on #33)
- 2026-10-30: Phase 05 pushed as PR #35 (base phase-04-business-os)
- 2026-10-30: Phase 06 pushed as PR #36 (base phase-05-ai-automation)
- 2026-10-31: T-064 complete locally at c10b382: nested sidebar and contextual sections for 60 business and 34 founder pages; 575 navigation checks, 12 visual screens, full workflow and repository checks passed. T-065 is publication-only and blocked awaiting explicit source publication authorization. Render production remains at 3edc118.
- 2026-11-01: T-067: added tenant-bound pending signed receipts with idempotent replay and seven-day retention; 15 focused security/delivery cases passed. Verified subscriber follow-ups use the owned sender rather than inherited platform sender. Candidate not pushed or deployed; live provider consent and unsupported adapters remain explicit.
- 2026-11-09: T-069 merged as PR #64 (565417a) and deployed to Render srv-dan4rdqjnfac73fceor0, deploy dep-dbp5g5c9v7es73alp900 live 2026-11-09 23:36 UTC; startup diagnostics 16/16. Live HTTP check of the Founder guards from outside is still to be done by the owner.
- 2026-11-10: PR #65 merged and deployed 2026-11-10 00:50 UTC. T-070 and T-071 complete. T-069 awaits the owner's live check of the Founder guards. T-072 stays blocked on SuperPro-named provider apps and Meta, Google and TikTok review. CI note: test-pipeline-ui 'a server failure never shows success' failed once on CI and passed on re-run and three local runs; it reads the status before the reply arrives when the status is already marked bad.
- 2026-11-10: PR #66 (T-073) merged as 6f168a2 and deployed, Render deploy dep-dbp7a8vf3r2c73fa0eu0 live 2026-11-10 01:40 UTC, startup diagnostics 16/16. GOOGLE_REDIRECT_URI set on Render to the shared /oauth/google/callback address. Waiting on owner: real META_APP_ID and secret in Render; redirect addresses registered with Meta and Google.
- 2026-11-11: T-076: targeted tests 14/14 pass; source PWA and account deletion entry points implemented. Native build projects prepared; local Chromium execution blocked by environment and iOS requires macOS. GitHub push/CI and deployment await explicit publishing approval.
- 2026-11-11: T-076 web release manually deployed by owner and verified live after transient 502. Installation, account deletion, Scale plan selection, readiness and signed-out guards pass. Android/iOS builds pass; signed-device testing and store release gates remain.
- 2026-11-11: T-077: focused channel and existing integration/security tests 14/14 pass. Added per-provider owner grants, Gmail OAuth, immutable reply review, safe delivery states, recent YouTube/Gmail/TikTok/X/GBP content, owned transport inbox bridges and campaign planning. Google Ads reporting default upgraded to documented v26; paid spend stays gated.
- 2026-11-11: T-081 source published as PR75 at 0be3094 with identical local tree. Local npm test 73/73, 55 contract files and 21 focused security/navigation cases pass; 60-page semantic capture has zero runtime/HTTP errors. CI43089882031 and Security43089882150 running; Render remains6615f960. Added explicit phone/tablet/desktop contrast and new-component visual evidence tests for next candidate.
- 2026-11-11: T-081 CI reproduced save-warning issue in a local semantic fixture: automatic regulatory POST and presence heartbeat were incorrectly attached to a form submission. Added explicit client-only background-request metadata so monitoring cannot hold or clear saved form state; failed saves and edits-after-submit remain protected. Moved sticky command before footer and allowed wrapped header height after visual review.
- 2026-11-11: T-083 Step4 diagnosed original contract failure: project-memory mismatch fixture inherits CURRENT BRANCH main, so its expected mismatch cannot exist. Fixed test fixture with explicit feature-branch and absent-commit inputs; all assertions retained and focused memory tests pass. No production code changed for this correction.
- 2026-11-12: T-094: candidate based on live/main ff4efc8. Language preference API, catalogue, partial dictionaries, RTL shell, operator coverage endpoint and page added. Baseline npm test passed 73/73 on Node 22.23.5; final run after additions pending. Chromium visual run blocked by environment socket restriction, not counted as passed. Credentials and approvals deferred per owner. No deployment or remote push.
- 2026-11-12: T-094 final candidate includes main 7310f6c density update. Full latest-main Node 22.23.5 regression 73/73 PASS; focused tests 12/12 PASS. 197 locale options with four pilot dictionaries, not complete workspace translation. Operator navigation inventory: 9 groups and 35 pages; new language coverage page included. Four compatible dependency updates pinned; production audit 0 reported known vulnerabilities. Visual browser/device checks remain blocked, no deployment/push or new provider credentials.
- 2026-11-13: E-036 resolved: tilt removed from cards with controls; test-ui default timeout 15s; failure capture kept. Under 2x parallel load test-ui went from about 100% failure to 6/6 pass
- 2026-11-19: AI Receptionist spec pack written (docs/ai-receptionist/00-11 + resume prompt); tasks R-01..R-20 added; T-040 receptionist half absorbed by R-03/R-07
- 2026-11-19: T-143 receptionist v2 shipped; lifecycle phase 2 (customer quote accept link, auto booking, allocator approval, day-of reminders to customer/team/worker, invoice approval, review request) is next.
- 2026-11-19: Shipped quote acceptance + review links (T-145) and the one Website section (T-147: build, transfer, domain, email, growth, activity). Next: custom-domain hosting (needs Cloudflare for SaaS from owner), reminders T-164, allocator T-165, invoice sending T-166.
- 2026-11-20: T-164 reminders, T-165 allocator choice + confirmations, T-166 invoice + payment link sending shipped.
- 2026-11-20: SMS send failures now show the Telnyx reason, failed messages can be retried, AU numbers normalised to +61, raw transcript text kept out of customer texts.
- 2026-11-20: Product redesign specification complete (T-167, docs/product-redesign/). Next: Phase 1 country-based sign-up.
- 2026-11-20: Phase 1 (T-168) country-based sign-up live: any country can sign up by email + mobile; Australia unchanged.
- 2026-11-20: Country rules live (T-170): currency, tax wording, invoice checks, e-invoicing notices and marketing send window follow each business's country; Australia unchanged.
- 2026-11-20: T-175: global visual refresh (ds/refresh.css), bottom tabs reveal their content with a name chip, inbox list first on phones, internal audit events no longer shown as toasts.
- 2026-11-20: T-176: removed repeated page labels and tab headings, label-echo tooltips; fixed phone layouts on Work and Money; widened setup checklist.
- 2026-11-20: T-177: AI Receptionist is now 5 steps with a step list and Back/Next; one related-pages row per page; checkboxes sit beside their labels. Next: Campaign Studio, Website hub.
- 2026-11-20: T-179 photos/videos for campaigns and posts; T-180 Video Meetings with own-account Zoom, invites, phone keypad (click-to-call); T-181 official platform icons in Connections.
- 2026-11-20: T-183 Phone page; T-184 video quality and backgrounds (self-hosted MediaPipe), appointments and calendar in Bookings with reminders and team alerts. Next: T-185 Media Studio AI video generation; research shows Veo 3.1 preview in Gemini API shut down 2026-10-22, verify providers first.
- 2026-11-21: T-188/T-189/T-190 released via PR165 main cfcae59. Render deploy dep-dc0ghqbrjlhs739ukbt0 verified live; six production smoke checks pass. Continuation on codex/t190-release-handover.
- 2026-11-21: Owner authorized live-testing release. PR166 squash-merged as main58fc72b597666c637a7fefb19af5962bb1980a80; tree exactly matches green candidate834275b. Render dep-dc0nunmc6qcc73bonn2g build_in_progress. Await exact-commit live and read-only smoke before reporting deployed. T193 specification remains on audit branch; T194 unified redesign and402 recovery are not implemented.
- 2026-11-21: T191/T192 released for authorized live testing: main58fc72b, Render dep-dc0nunmc6qcc73bonn2g LIVE19:31:50 Perth. Six deploy checks and two live feature-asset checks PASS. PR166 merged; T193 specification preserved. T194 unified redesign/typed402 recovery remain NOT_STARTED; no paid provider render performed.
- 2026-11-21: T195 phases0-3 approval package preserved on codex/t195-media-studio-blueprint remote04299af6444696f9f098e60f1227f612c3a3b964 (localb52f108, treeadd9fbcc). Five required coordination docs and17-vendor research plus347-record source census published. T194 BLOCKED pending owner design/implementation approval; no runtime/deploy/paid action.
- 2026-11-21: DirectionA implementation MS04A/MS04B/MS05A in progress: typed billing/readiness recovery and explicit retry;safe speech fallback;default-off unified creator;workspace/capture epoch guards. First50 focused regressions pass;final regression and hosted browser acceptance pending. No deployment or paid provider calls.
- 2026-11-21: T194: full local regression73/73 including86 contract files passed. Candidate d5b1274 remote PR168; four security checks pass, hosted verify/UI running. Follow-up source guards and2 adversarial tests pass; not deployed.
- 2026-11-22: T-197 free Reel Maker built and verified; releasing to Render.
- 2026-11-22: T-198 AI Website spec v2 refresh done; next T-199 llms.txt + AI-crawler setting.
- 2026-11-22: T-199 llms.txt + AI-crawler setting built and verified; Render builds paused (build minutes used up), goes live on next deploy.
- 2026-11-22: T-202 Media Studio redesign built and verified; releasing to Render.
- 2026-11-22: T-203 Phase 1 audit, backlog and blueprint done on branch claude/transformation-phase1; waiting for owner approvals (TR-01).
- 2026-11-22: TR-01 approvals recorded (D-055), TR-02 register tidy (T-194 closed), palette samples sent; waiting for palette choice and test-site switch.
- 2026-11-22: Palette kept gold (D-056). TR-03 done: oprun-test free isolated-preview service live on claude/transformation-staging. Next TR-10/TR-12.
- 2026-11-22: T-204 gold scale and hard-coded gold clean-up done (no visual change on 105 screenshots); pushed to oprun-test.
- 2026-11-22: T-205 design-system catalogue + shared component styles done; on oprun-test.
- 2026-11-25: 25 Nov: test site (oprun-test, srv-dc1keajl550s73eolqk0) updated to d017ea0 at the owner's request (deploy dep-dc36j5s9v7es73fmo88g live 04:53 UTC; test data reset). Continuing TR-72 stage 5.
- 2026-11-25: 25 Nov: release plan prepared (docs/transformation/05_RELEASE_PLAN.md): database changes since main 6cbbe20 reviewed (15 new tables, new columns, 7 indexes, all additive; 13 standard agents created once on first start), owner pre-release steps, release and rollback steps, TR-80 review checklist. No production change made.
- 2026-11-25: 25 Nov 14:15 UTC: test site updated to release candidate f678118 at the owner's request (deploy dep-dc3eqblg1s2s73eiq9qg live; started cleanly, 13 standard agents created; test data reset). Waiting for the owner's TR-80 review.
- 2026-11-25: 25 Nov: owner approved the release candidate on the test site (TR-80, T-239 complete). Live service srv-dbuq98ojo6nc73aro66g last started 22 Nov 19:00 UTC and still warns OPERATOR_TOTP_SECRET, SESSION_MAX_AGE_DAYS and STRICT_PASSWORD_MATCH unset. TR-81 waits for the owner's explicit release approval; TR-73 production drill output still outstanding.
- 2026-11-25: 25 Nov: TR-73 production restore drill passed (owner). Remaining before TR-81: owner's explicit release approval and the live security settings.
- 2026-11-25: 25 Nov: TR-73 production drill details: 253 tables restored in 4.4 s, integrity ok, audit chain 553 rows verified, row counts match (owner screenshot).
