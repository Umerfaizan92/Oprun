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

## T-081 Communications redesign: meetings calendar and history, in-call tools, phone keypad, receptionist hub
- Status: IN_PROGRESS
- Added: 2026-11-11
- Requirement: Owner 2026-11-12 (Hindi, summarised in full): use the best available plugins; reorganise the Communications section to be compact, space-saving, user friendly. Video Meetings: previous call history in one openable section; calendar scheduling with AI-assisted appointments (customer books video call with date, time, duration; conversations update the calendar automatically, with notes); before/inside a call, send the guest invite link by email, SMS and other connected channels; full-screen option; background/filter option; best HD quality (4K/8K where possible). AI Receptionist: keep its relevant tools inside it and enhance. Calls and SMS: number keypad, contact list, recent call history, same for SMS. Then audit, fix, deploy, push. Owner also instructs: preserve all work at every stopping point so any session or model can continue from the same place.
- Files: saas/workspace-meetings.js; saas/meet-call.js; saas/meetings.css; saas/portal-workspace.js; saas/workspace-phone.js (new); saas/workspace-receptionist.js (new); src/meetings.js; src/server.js; scripts
- Acceptance: Stage A meetings: history section, calendar with duration and notes, suggestions from conversations needing one-click confirm, invite by email/SMS/WhatsApp/share, full screen, picture filter, quality selector. Stage B phone: keypad, contacts, recent, messages. Stage C receptionist hub. Each stage committed and pushed separately with tests; existing IDs, routes and labels keep working; phone, tablet, laptop fit; deploy after CI green
