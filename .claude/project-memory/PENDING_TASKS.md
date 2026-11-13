# Pending tasks

Ordered: the first task whose status is not COMPLETED is the one to resume. Status values: NOT_STARTED, IN_PROGRESS,
BLOCKED, TESTING, COMPLETED. When a task is verified, move it to COMPLETED_TASKS.md with its evidence.

## T-037 Accessible names that match visible text in the Business OS (P03 follow-up)
- Status: BLOCKED
- Blocked by: owner approval (existing tests and the console page use the current labels; they change together).
- Requirement: "Pin navigation" button labelled "Expand main navigation"; co-pilot button showing "Ask Super Pro"
  labelled "Open Super Pro AI co-pilot"; dashboard tiles' labels do not contain their visible text.
- Acceptance: axe `label-content-name-mismatch` 0 on workspace; tests updated in the same commit.

## T-040 Create enquiries from inbox messages and receptionist calls
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Phase 04 remaining gap (docs/phase-04/VERIFICATION.md)
- Files: not known yet
- Acceptance: Owner approval of scope; tests added; verify:modules clean

## T-041 Customer-facing quote and invoice documents (PDF or email from the record)
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Phase 04 remaining gap (docs/phase-04/VERIFICATION.md)
- Files: not known yet
- Acceptance: Owner approval of scope; tests added; verify:modules clean

## T-042 Attachments on enquiries, quotes and invoices
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Phase 04 remaining gap (docs/phase-04/VERIFICATION.md)
- Files: not known yet
- Acceptance: Owner approval of scope; tests added; verify:modules clean

## T-043 Notifications for pipeline events
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Phase 04 remaining gap (docs/phase-04/VERIFICATION.md)
- Files: not known yet
- Acceptance: Owner approval of scope; tests added; verify:modules clean

## T-044 Pipeline summary on the Today dashboard
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Phase 04 remaining gap (docs/phase-04/VERIFICATION.md)
- Files: not known yet
- Acceptance: Owner approval of scope; tests added; verify:modules clean

## T-045 Store backup restore-drill results for the Storage & backups tab
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Phase 04 remaining gap (docs/phase-04/VERIFICATION.md)
- Files: not known yet
- Acceptance: Owner approval of scope; tests added; verify:modules clean

## T-047 Phase 05 follow-up: inbound Inbox messages as automation triggers
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Emails, SMS and social messages recorded by recordInbound should emit an inbox.message event (untrusted text) so automations can classify and draft replies
- Files: src/saas-platform.js, src/automation/*
- Acceptance: Contract test: inbound email starts an automation, text treated as untrusted, injection forces approval

## T-048 Phase 05 follow-up: move the automation scheduler to a worker process
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: The per-minute automation scheduler runs in the web process; move it to a worker before running more than one instance
- Files: src/automation/engine.js, render.yaml (needs owner approval)
- Acceptance: Owner-approved plan; schedules still run once per period

## T-050 Phase 06 follow-up: fix the public-site SEO findings
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Owner decision: legal pages noindex vs sitemap; shorten 7 long titles; add 3 meta descriptions; trim 3 long descriptions; responsive images; complete structured data; permanent redirect for /start (see docs/phase-06/REPORT.md)
- Files: site/, src/server.js sitemap
- Acceptance: Platform audit shows none of these findings; test:visual and site tests pass

## T-051 Phase 06 follow-up: image re-encoding for the Website Builder
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Add an image library (sharp) to convert uploads to WebP/AVIF with sizes; needs owner approval for the new dependency on Render
- Files: package.json, src/seo/*
- Acceptance: Uploaded JPEG becomes WebP with srcset; Render build passes

## T-052 Phase 06 follow-up: custom domains for builder sites
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Serve a business site on its own domain: DNS verification and certificates on Render (infrastructure change, owner approval)
- Files: render.yaml, src/seo/routes.js
- Acceptance: Owner-approved plan; domain ownership verified before serving

## T-053 Phase 06: record live Google evidence after deploy
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: After deploy with Google credentials: run Check connection for each Google service and Sync; confirm seo_google_checks rows show ok=1 with real samples
- Files: none (operational)
- Acceptance: Each connected service shows Verified in the Google Integration Centre

## T-055 Live Telnyx and Resend verification for Phase 07
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Place a staging test call (assistant, transcript, transfer, voicemail) and send a test campaign; confirm Resend receipts reach /api/webhooks/communications/resend
- Files: src/comms/voice.js, src/comms/service.js
- Acceptance: Live call and email evidence recorded in docs/phase-07/REPORT.md

## T-057 Live Stripe test-mode check for Phase 08
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: With a business's Stripe test keys: create a payment link, pay it, request and approve a partial and a full refund; confirm webhooks and job balances
- Files: src/payments.js, src/finance/service.js
- Acceptance: Evidence recorded in docs/phase-08/REPORT.md

## T-059 Monthly snapshot copies for long-term retention
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: Copy the first daily snapshot of each month to super-pro/monthly/ (S3 Batch Operations or a put-only scheduled copy)
- Files: src/reliability/backup.js, docs/phase-09/BACKUP_AND_RECOVERY.md
- Acceptance: Monthly copies present and covered by the 400-day lifecycle rule

## T-060 Live reliability check after deploy (Phase 09)
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: On production: Check the backup bucket, Back up now, Test a restore, run npm run backup:restore-drill, set OPERATOR_ALERT_EMAIL, record results
- Files: docs/phase-09/REPORT.md
- Acceptance: Results recorded; all bucket checks OK

## T-062 Final consolidation on consolidated-improvements-2026
- Status: IN_PROGRESS
- Added: 2026-10-30
- Requirement: Owner prompt 2026-10-30 23:25 (attachment): recover history, verify Phases 00-10 and the six earlier design/development prompts, preserve every feature, consolidate on branch consolidated-improvements-2026, run all checks, write docs/release/* (9 files), commit, push, record SHA, stop before deploy
- Files: docs/release/*
- Acceptance: Branch pushed with exact SHA; 9 release docs with evidence; all suites pass; no deploy

## T-063 Recover the Claude eleven-prompt release and reconcile security fixes
- Status: TESTING
- Added: 2026-10-30
- Requirement: Owner completed Prompt 00 through Prompt 10 in Claude and transferred SUPER_PRO_AI_EMERGENCY_HANDOVER.zip. The previous preview deployed the older baseline. Preserve consolidated-improvements-2026 and all 470 matching archive files; verify and release the actual implementation with the tested storage/isolation fixes.
- Files: src; saas; office; scripts; docs/release
- Acceptance: Correct source proved by archive hashes; release tests and preview acceptance pass; production data and credentials preserved

## Roadmap correction
The eleven prompts 00–10 were received and implemented in Claude. The former "P04 onwards not received" placeholder was stale. Phase completion evidence is in MASTER_PLAN.md; the concrete unfinished tasks above remain open.

T-062 historical stop-before-deploy instruction is superseded operationally by the owner's later explicit requests to push to Render. Its consolidation evidence is carried forward in T-063; neither task is marked complete before the correct-source CI and hosted acceptance pass.

## T-065 Publish reviewed navigation branch after explicit source-publication authorization
- Status: BLOCKED
- Added: 2026-10-31
- Requirement: Automatic approval review rejected the earlier source push because export permission was not explicit. The implementation is complete locally. Ask the owner to authorize publishing this source branch to the existing public GitHub repository and opening a draft PR. Do not bypass the rejection through another connector. No deployment authorization is included.
- Files: codex/navigation-hierarchy-20261031; docs/navigation; repository project memory
- Acceptance: After explicit authorization, push only the reviewed feature branch and create a draft PR using the prepared description; verify branch contents and report the PR URL. No merge or production deploy.

## T-066 Navigation audit, unsaved-form save acknowledgement and release prep
- Status: TESTING
- Added: 2026-10-31
- Requirement: Owner prompts 2026-10-31: audit restored navigation (60 business, 34 founder pages), fix reproducible defects incl. superpro:form-saved never emitted, re-run checks with pinned browser, prepare release; no merge/deploy without authorisation
- Files: saas/navigation-shell.js, scripts/test-navigation-ui.mjs
- Acceptance: Full suite incl. test:navigation-ui passes on the final commit; CI green on PR #54

## T-067 Audit and repair isolated subscriber connections and measured insights
- Status: TESTING
- Added: 2026-11-01
- Requirement: Owner 2026-11-01: audit current live Setup and Trust Connections errors; professionally redesign isolated subscriber connections for email SMS website Search Console Analytics Tag Manager Google Business Profile X Snapchat YouTube TikTok WhatsApp Meta Facebook Instagram; direct in-app authorised setup, actionable AI-assisted diagnostics, provider-supported up-to-date metrics; prepare tested changes for owner manual deployment; no production connection changes or password collection.
- Files: src/integration-runtime.js; src/server.js; src/db.js; saas/integration-manager.js; saas/app.js; scripts; docs/connections
- Acceptance: Provider capability and readiness matrix evidence; secure OAuth state and callbacks; per-tenant tokens resources metrics and diagnostics; truthful unavailable metrics; responsive accessible setup and error recovery; tests pass; reviewed changes committed and resumable handover saved; owner deploys separately

## T-068 Read-only audit of subscriber social connections and provider capability
- Status: TESTING
- Added: 2026-11-09
- Requirement: Owner 2026-11-09: read-only audit of Connect flows for Facebook, Instagram, WhatsApp Business, TikTok, YouTube, X, Snapchat and Google Business Profile; investigate reported Invalid application error and Fleet Parlour links without guessing; capability matrix from official documentation; no push, merge, deploy, key rotation, data reset, publishing or spending
- Files: docs/social-integrations/STATUS.md; docs/social-integrations/HANDOVER.md
- Acceptance: Findings with file and line evidence; unknowns and external blockers listed; prioritised plan; STATUS.md and HANDOVER.md delivered; owner supplies blockers B1 to B3 before any implementation

## T-069 Connections safe base (Blueprint phase A)
- Status: TESTING
- Added: 2026-11-09
- Requirement: Owner 2026-11-10: plan each task, build one by one, preserve everything, audit, fix, then push to Render. Phase A: require Founder sign-in on legacy /api/tiktok/login, its legacy callback and /api/tiktok/status; keep /api/social-stats readable but stop anonymous forced refresh; validate OAuth redirect addresses; force provider account chooser; bind each external account to one workspace only; no change to Fleet Parlour tokens, data or website
- Files: src/server.js; src/integration-security.js; src/integration-runtime.js; scripts; docs/social-integrations
- Acceptance: New tests prove each guard; npm test and focused integration tests pass; deployed to Render only after tests pass; production health verified after deploy

## T-072 Provider-dependent phases C, D, E, G, H, I, J of the Connections blueprint
- Status: BLOCKED
- Added: 2026-11-09
- Requirement: Owner 2026-11-10 blueprint; blocked on owner provider dashboards and Meta, Google, TikTok approvals (STATUS.md blockers B1 to B3)
- Files: docs/social-integrations/BLUEPRINT.md
- Acceptance: Each phase split into its own task when its blocker clears

## T-073 Stop malformed Meta App ID reaching Facebook; record Invalid application cause
- Status: TESTING
- Added: 2026-11-10
- Requirement: Owner 2026-11-10 screenshots: Facebook shows Invalid app ID on Meta and WhatsApp cards; Google cards blocked by redirect check. Owner: set everything for me. Treat a non-numeric META_APP_ID as not set up, ignore stray spaces, set GOOGLE_REDIRECT_URI in Render, document cause
- Files: src/server.js; src/integration-runtime.js; scripts/connections-safe-base.test.mjs; docs/social-integrations/STATUS.md
- Acceptance: Tests pass; deployed; owner sets the real App ID and registers redirect addresses with Meta and Google

## T-074 Built-in video and voice meetings with direct calling from the workspace
- Status: TESTING
- Added: 2026-11-10
- Requirement: Owner 2026-11-10: as a SaaS expert build in video meeting or call app integration, to directly call from the app; proper backend; everything in working condition. Native browser-to-browser calls with rooms and signalling on the SuperPro server, guest invite links with a waiting room, isolated per workspace
- Files: src/meetings.js; src/server.js; saas/meet-call.js; saas/workspace-meetings.js; saas/meet.html; saas/meetings.css; saas/portal-workspace.js; scripts
- Acceptance: Server test covers isolation, guest waiting room, limits and cleanup; browser test proves two staff and one guest see and hear each other with fake media; npm test passes; pages fit phone, tablet, laptop

## T-076 Oprun public-site fixes and mobile release preparation
- Status: BLOCKED
- Added: 2026-11-11
- Requirement: Owner 2026-11-11: fix all problems identified in the public website audit and make Oprun ready for Android and Apple stores. Owner selected Primary Render connection for deployment in My Workspace. Preserve data and credentials; verify release readiness honestly.
- Files: saas/auth.js, saas/product-guide.js, saas/registration-layout.css, saas/sw.js, scripts/site, src/product-guide-knowledge.js, src/mobile-association.js, mobile/, .github/workflows/mobile-builds.yml
- Acceptance: Plan selection and contextual guide answers verified; registration layout and install guidance tested; public website deployed after checks; native projects compile in CI; signing, device testing and store approvals tracked as owner release gates rather than falsely completed.

## T-077 Subscriber channel operations hub, owner-controlled access and local campaigns
- Status: IN_PROGRESS
- Added: 2026-11-11
- Requirement: Owner 2026-11-11 requests organize and upgrade every Connections provider across social email WhatsApp YouTube and Google; subscriber-owned sign-in, posts videos text comments replies messaging subscribers viewers ads campaign overviews progress local-area targeting and AI recommendations; enforce tenant isolation and owner-controlled team access, exclude other businesses and platform operators; preserve resumable checkpoints, update related pages consistently, test then push and live-test. Owner additionally requests relevant tools/plugins including Elementor where available.
- Files: src/integration-*, src/channel-*, src/staff-access.js, src/server.js, saas/integration-manager.*, saas/workspace*, scripts, docs/connections
- Acceptance: Tenant and member permission attack tests pass; one organized hub integrates existing pages and actual supported provider workflows; unsupported permissions/APIs labelled accurately; campaigns persist local targeting and approvals; AI output requires review; CI and browser tests pass; publish and verify production where access permits

## T-078 Restore and preserve Operator sign-in on Business sign-in
- Status: TESTING
- Added: 2026-11-11
- Requirement: Owner 11 Nov 2026: before deploying, audit the Operator sign-in option removed from the Business sign-in page, restore it, preserve it and never delete it in future changes without explicit owner instruction.
- Files: saas/sign-in.html;scripts/test-mobile-readiness.mjs;CLAUDE.md
- Acceptance: Operator sign-in is visible and keyboard accessible on business sign-in at phone tablet desktop widths;opens existing operator authentication;business session cannot access operator APIs;regression guard and standing preservation rule committed before deployment

## T-079 Channel content is viewable: media previews, links, per-item detail and measured totals
- Status: TESTING
- Added: 2026-11-11
- Requirement: Owner 2026-11-12 screenshots: TikTok connected but synced content cannot be clicked or viewed (no video, comments, likes detail); Overview shows no measurements after sync. Audit every connection and fix.
- Files: src/channel-providers.js; src/server.js; saas/channel-operations.js; saas/channel-operations.css; scripts
- Acceptance: Synced items carry validated provider link, thumbnail and date; cards open detail with in-app player where the provider allows and an Open on provider link; Overview shows measured totals after sync; unsupported data (TikTok comment text) labelled honestly; tests pass; phone tablet laptop fit

## T-080 Connections speed, comments section, site-style hover and close control
- Status: TESTING
- Added: 2026-11-11
- Requirement: Owner 2026-11-12: improve performance on all Connections sections; comments still cannot be clicked to read and reply; close button not appropriate; add hover/overlay on each section like the rest of the site.
- Files: saas/channel-operations.js; saas/channel-operations.css; src/channel-providers.js; src/server.js; scripts
- Acceptance: Fewer and parallel requests, panels drawn on demand, versioned assets cached; Comments opens a comments section with text and reply where the provider gives it and an honest link-out where it does not; icon close; hover matches site; tests pass

## T-081 Implement uploaded final redesign and security audit prompts
- Status: TESTING
- Added: 2026-11-11
- Requirement: Owner authorizes reading Oprun_Final_Redesign_Audit_Prompts_2026-11-12.pdf, implementing its four prompts step by step, auditing and fixing, preserving all routes features data and resumable ChatGPT/Claude checkpoints, publishing and deploying existing Render service after passing checks. PDF requires complete 6-7 group navigation mapping; design tokens accessible responsive command centre unified communications; concrete security audit and cross-tenant tests; prioritised 90-day feature roadmap with stories acceptance security complexity. Keep visible Operator sign-in and no Install on business sign-in. External provider/store/user-research gates must remain truthful.
- Files: saas/workspace-nav.js,saas/portal-shell.js,saas/workspace.html,saas/workspace-redesign.css,src/growth.js,src/channel-operations.js,scripts,docs/redesign
- Acceptance: All 60 business views retain routes roles controls; seven main groups and contextual navigation work; responsive design and security regressions pass; all PDF prompt outputs and exact resumption steps committed; CI passes before deployment; deployed revision verified and external-only limitations recorded

## T-082 Master Senior prompt: clean 7+Setup navigation, remove B01-B09 numbering, merge with Final Redesign pack
- Status: TESTING
- Added: 2026-11-11
- Requirement: Owner uploaded Oprun_Master_Senior_Prompts_with_Continuation_2026-11-12.pdf with Final Redesign pack; merge both, remove all visible B01/B02 numbering, groups Today Work Customers People Communications Growth Money Setup, fold duplicate surfaces (Unified Inbox, Work Pipeline, Growth Hub, SEO Command Centre tabs), empty states with one primary action, 8 deliverables, audit, live Render test. Keep every route alias, form, API and element ID.
- Files: saas/workspace-nav.js,saas/workspace-empty-guides.js,saas/workspace-redesign.css,saas/*.js,src/*,scripts/*test*,docs/redesign/05_MASTER_PROMPT_DELIVERABLES.md
- Acceptance: No B0x text in nav/titles/breadcrumbs; 60 views preserved; all legacy hashes resolve; npm test and UI suites pass; deployed revision verified

## T-083 Tighten secondary navigation and Today density
- Status: TESTING
- Added: 2026-11-11
- Requirement: Owner ordered steps:1audit current workspace-nav.js/navigation-shell.js secondary flags;2all legacy and individual SEO destinations stay secondary under existing More and disclosures start closed with compact accessible CSS;3polish Today spacing/attention cards without losing data or features;4verify canonical routes aliases roles tenant isolation and approvals unchanged;5create commit directly on main with exact message Tighten secondary navigation and reduce density for legacy and SEO sub-pages. Preserve all prior work and use requested checkpoint block if approaching limits.
- Files: saas/workspace-nav.js,saas/navigation-shell.js,saas/workspace-redesign.css,saas/workspace.html,office/console.html,scripts/test-navigation-ui.mjs,scripts/test-redesign-ui.mjs
- Acceptance: All listed secondary flags present; More closed by default including secondary deep links and stays manually controllable; compact accessible navigation and Today at phone/tablet/desktop; all60views current/legacy hashes and grants preserved; no backend data/auth/approval changes; required checks pass; exact requested main commit published

## T-084 Prominent branding and unified auto-hiding business navigation
- Status: TESTING
- Added: 2026-11-11
- Requirement: Owner steering before Render deployment: make Oprun name prominent across business workspace/public website/main branding; slightly enlarge logos; shorten top-page wording; replace rail Oprun brand plus standalone close row plus subscriber identity with one tidy business logo/name identity; minimise close control; click open/click close and auto-hide navigation; preserve business switching roles tenant isolation approvals and all prior features. Brand remains spelled Oprun.
- Files: saas/navigation-shell.js,saas/portal-shell.js,saas/workspace-redesign.css,saas/brand.css,saas/brand-presence.css,scripts/site/templates.mjs,saas HTML,office/console.html,scripts UI tests
- Acceptance: One business identity header and compact44px close; click-triggered drawer opens/closes on selection outside click Escape and restores focus; business switching and role/founder restrictions preserved; prominent brand/logo on website/auth/workspace/Founder; concise top heading; no hover/inactivity surprises; all view/route/grant controls preserved; full browser/accessibility/security CI before combined Render deployment

## T-085 Command Centre hierarchy and mobile AI density
- Status: TESTING
- Added: 2026-11-11
- Requirement: Owner ordered six steps: full visual/structural Today and nav audit; greeting/business identity first; fully functional AI bar becomes compact secondary after operational content, never mobile fullscreen; attention/readiness/next steps accessible early; reinforce22 secondary More items default closed; calm consistent spacing fonts empty states touch/overflow across major views; preserve all routes aliases backend stores tenant isolation approvals roles; exact main commit Reorganise Command Centre hierarchy, constrain AI command bar on mobile, and tighten navigation density. Checkpoint block if near limits.
- Files: saas/workspace-voicebar.js;saas/workspace-redesign.css;saas/workspace.html;scripts/test-redesign-ui.mjs;docs/redesign
- Acceptance: Greeting before AI; mobile AI less than40percent viewport at normal text; all type/voice/send/chip controls remain; metrics/readiness/nextstep and role rules retained; route/security checks and responsive CI pass; exact requested main commit

## T-086 Fix failed Render build of a5b3e93 (flaky Level 3 approval test)
- Status: NOT_STARTED
- Added: 2026-11-12
- Requirement: Owner: last manual deploy failed on Render; audit, fix, run live test
- Files: scripts/automation-governance.test.mjs,scripts/verify-all.mjs
- Acceptance: npm test passes; Render deploy of the fix is live; startup diagnostics pass

## T-087 Rebuild ChatGPT f039490 changes: footer brand, mobile bottom nav, sidebar sign-out, finder/chat fixes
- Status: TESTING
- Added: 2026-11-12
- Requirement: Owner's ChatGPT commit f039490 never reached GitHub (push blocked). Rebuild: Oprun logo/name in compact footer with organised policy links; fixed bottom navigation with icons on mobile; Sign out at bottom of sidebar; remove duplicate finder; fix chat badges, permissions and panel overlap. Deploy for live test.
- Files: saas/workspace.html,saas/portal-shell.js,saas/workspace-redesign.css,saas/app.js
- Acceptance: Visible at 390/768/1440; all routes/IDs kept; operator link kept; npm test + UI suites pass; deployed live

## T-088 Restore saved ChatGPT workspace design over Claude PR82 and deploy
- Status: TESTING
- Added: 2026-11-12
- Requirement: User dislikes Claude replacement; restore ChatGPT f039490 mobile page and section dock, integrated chat actions, compact four-link footer, final sidebar signout; deploy for live testing
- Files: not known yet
- Acceptance: Original visual files restored; security guards retained; targeted tests and full release checks pass; saved remote changes; Render release live; served assets match

## T-089 One mobile bottom row: Menu and sub-sections only
- Status: TESTING
- Added: 2026-11-12
- Requirement: User screenshot: remove bottom main-page row; main pages remain sidebar; one bottom row with Menu plus only current page sub-sections; make header business identity static on mobile; improve icons and Menu usability across every page
- Files: not known yet
- Acceptance: All60 routes preserved in sidebar; one bottom row; Menu opens/closes with correct focus; static business logo/name; original section functions and permissions; full release checks pass; deployed live and source files verified

## T-090 Compact mobile bottom bar (size only), minimised notification settings, phone push alerts
- Status: TESTING
- Added: 2026-11-12
- Requirement: Owner: keep existing ChatGPT bottom menu bar, only make it smaller and auto-fit sub-sections with no sideways scroll; minimise notification settings behind a small Notification settings option and reorganise the panel professionally; send phone notifications (even when app closed) for every activity update such as job enquiries, not logs; prompt for notification permission right after sign-in/install; voice alerts
- Files: saas/workspace-mobile.css,saas/platform-notices.js,saas/workspace-push.js,saas/sw.js,saas/common.js,src/web-push.js,src/notifications.js,src/server.js,package.json
- Acceptance: No horizontal scroll in dock at 320/390; settings collapsed by default and auto-save; push subscribe/send tested; npm test and UI suites pass; deployed

## T-091 Prompt 01: Final Command Centre refinement
- Status: TESTING
- Added: 2026-11-12
- Requirement: Owner prompt 'OPRUN FINAL COMMAND CENTRE REFINEMENT' (12 Nov 2026): 1 greeting keep, remove name/role/email under it; 2 Open Job Pool + Ask AI side by side compact; 3 remove '<name> right now' line, keep/enhance live status; 4 five live sections compact; 5 move Your Workspace menu to dedicated features destination; 6 remove Your Next Step section; 7 enhance AI command bar; 8 premium minimal footer reusable; 9 fix bottom nav movement (scroll/resize/keyboard, safe area, no overlap); 10 rename bottom Menu to All Features. Preserve colours, routes, RBAC, tenant isolation. PR only, no merge/deploy without approval. Await Prompt 02.
- Files: saas/workspace.html,saas/workspace-gadgets.js,saas/workspace-mobile.*,saas/app.js,saas/*.css
- Acceptance: All 10 changes verified at 320-1920px; npm test + UI suites; PR opened, not merged

## T-092 Prompt 02: Your Workspace section and Priorities (renamed Attention items)
- Status: TESTING
- Added: 2026-11-12
- Requirement: Owner Prompt 02 (12 Nov): Your Workspace after Business overview with all features compact and connected; rename Attention items, keep only Your Next Step (3 cards) and AI Operations Brief, enhanced; hide header/chatbot/AI bar there; preserve routes; PR only
- Files: saas/command-centre-sections.js,saas/command-centre.css,saas/workspace.html,saas/focused-workspace.js,saas/page-sections.js,saas/workspace-mobile.js
- Acceptance: Both sections verified 320-1440 incl. axe; npm test; PR opened, not merged

## T-094 Global language preferences and competitive platform blueprint
- Status: TESTING
- Added: 2026-11-12
- Requirement: Add tenant-bound subscriber language preferences, honest translation coverage and RTL foundation; map HighLevel and three peer benchmarks with provider activation register; keys and approvals deferred by owner.
- Files: src/localization.js; saas/workspace-locale.js; saas/workspace.html; docs/platform-blueprint; scripts/localization.test.mjs
- Acceptance: Authentication and cross-tenant tests, locale validation, preference persistence, fallback and RTL checks, existing regression suite; no production activation claims.

