# Pending tasks

Ordered: the first task whose status is not COMPLETED is the one to resume. Status values: NOT_STARTED, IN_PROGRESS,
BLOCKED, TESTING, COMPLETED. When a task is verified, move it to COMPLETED_TASKS.md with its evidence.

## T-037 Accessible names that match visible text in the Business OS (P03 follow-up)
- Status: BLOCKED
- Blocked by: owner approval (existing tests and the console page use the current labels; they change together).
- Requirement: "Pin navigation" button labelled "Expand main navigation"; co-pilot button showing "Ask Super Pro"
  labelled "Open Super Pro AI co-pilot"; dashboard tiles' labels do not contain their visible text.
- Acceptance: axe `label-content-name-mismatch` 0 on workspace; tests updated in the same commit.

## T-048 Phase 05 follow-up: move the automation scheduler to a worker process
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: The per-minute automation scheduler runs in the web process; move it to a worker before running more than one instance
- Files: src/automation/engine.js, render.yaml (needs owner approval)
- Acceptance: Owner-approved plan; schedules still run once per period

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

## T-060 Live reliability check after deploy (Phase 09)
- Status: NOT_STARTED
- Added: 2026-10-30
- Requirement: On production: Check the backup bucket, Back up now, Test a restore, run npm run backup:restore-drill, set OPERATOR_ALERT_EMAIL, record results
- Files: docs/phase-09/REPORT.md
- Acceptance: Results recorded; all bucket checks OK

## Roadmap correction
The eleven prompts 00–10 were received and implemented in Claude. The former "P04 onwards not received" placeholder was stale. Phase completion evidence is in MASTER_PLAN.md; the concrete unfinished tasks above remain open.

T-062 historical stop-before-deploy instruction is superseded operationally by the owner's later explicit requests to push to Render. Its consolidation evidence is carried forward in T-063; neither task is marked complete before the correct-source CI and hosted acceptance pass.

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

## T-076 Oprun public-site fixes and mobile release preparation
- Status: BLOCKED
- Added: 2026-11-11
- Requirement: Owner 2026-11-11: fix all problems identified in the public website audit and make Oprun ready for Android and Apple stores. Owner selected Primary Render connection for deployment in My Workspace. Preserve data and credentials; verify release readiness honestly.
- Files: saas/auth.js, saas/product-guide.js, saas/registration-layout.css, saas/sw.js, scripts/site, src/product-guide-knowledge.js, src/mobile-association.js, mobile/, .github/workflows/mobile-builds.yml
- Acceptance: Plan selection and contextual guide answers verified; registration layout and install guidance tested; public website deployed after checks; native projects compile in CI; signing, device testing and store approvals tracked as owner release gates rather than falsely completed.

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

## T-121 R-01 AI Receptionist: oprun-voice skeleton: Pipecat + TelnyxFrameSerializer + Deepgram Flux + ElevenLabs Flash (
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: oprun-voice skeleton: Pipecat + TelnyxFrameSerializer + Deepgram Flux + ElevenLabs Flash (Cartesia fallback) + LLM adapter (bedrock_au, openai); fixed test prompt; no Oprun tools (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-01)
- Files: docs/ai-receptionist/
- Acceptance: A test number in Sydney answers; per-turn timings logged

## T-122 R-02 AI Receptionist: Latency and naturalness bake-off from Sydney: 20 scripted calls × both LLM providers, plu
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Latency and naturalness bake-off from Sydney: 20 scripted calls × both LLM providers, plus the Retell benchmark from the voice-stack decision; 5 blind "human or AI?" listeners (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-02)
- Files: docs/ai-receptionist/
- Acceptance: p50 ≤ 700 ms and p95 ≤ 1000 ms caller-stop → first audio; barge-in stop ≤ 80 ms (p95 ≤ 120 ms); **D-R5 closed and recorded** with memory:task -- decision

## T-123 R-03 AI Receptionist: Data model: new tables and voice_calls columns from [00_CONTRACT.md §5](00_CONTRACT.md#5-
- Status: TESTING
- Added: 2026-11-19
- Requirement: Data model: new tables and voice_calls columns from [00_CONTRACT.md §5](00_CONTRACT.md#5-new-and-changed-data-sqlite-oprun-web), migration + backfill dry-run (absorbs the receptionist half of T-040) (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-03)
- Files: docs/ai-receptionist/
- Acceptance: npm test migration checks pass; dry-run report reviewed by the owner

## T-124 R-04 AI Receptionist: Internal API /api/internal/voice/* with service key + call token; call-context endpoint
- Status: TESTING
- Added: 2026-11-19
- Requirement: Internal API /api/internal/voice/* with service key + call token; call-context endpoint (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-04)
- Files: docs/ai-receptionist/
- Acceptance: Contract tests: wrong org token rejected; expired token rejected; idempotent replays

## T-125 R-05 AI Receptionist: voice.js: route via receptionist_numbers; on answer start streaming to oprun-voice with ca
- Status: TESTING
- Added: 2026-11-19
- Requirement: voice.js: route via receptionist_numbers; on answer start streaming to oprun-voice with call token; fallback_assistant → transfer → voicemail → apology chain (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-05)
- Files: docs/ai-receptionist/
- Acceptance: Webhook replay test covers every fallback branch; a killed worker still ends in voicemail, never silence

## T-126 R-06 AI Receptionist: Naturalness prompt + barge-in/backchannel rules ([03](03_NATURALNESS_PROMPT.md)) in the wo
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Naturalness prompt + barge-in/backchannel rules ([03](03_NATURALNESS_PROMPT.md)) in the worker (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-06)
- Files: docs/ai-receptionist/
- Acceptance: The 10 scenarios pass the robotic-behaviour checklist in staging

## T-127 R-07 AI Receptionist: Tools create_or_update_customer, create_enquiry_lead, take_message, end_call ([04](04_TOOL
- Status: TESTING
- Added: 2026-11-19
- Requirement: Tools create_or_update_customer, create_enquiry_lead, take_message, end_call ([04](04_TOOLS.md), [06](06_CUSTOMER_MANAGEMENT.md)) (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-07)
- Files: docs/ai-receptionist/
- Acceptance: New caller → customer lead + enquiry; existing caller matched by phone; no duplicate customer in tests

## T-128 R-08 AI Receptionist: After-call: summary (generateAiText), Unibox call log on the caller's voice thread, comms_
- Status: TESTING
- Added: 2026-11-19
- Requirement: After-call: summary (generateAiText), Unibox call log on the caller's voice thread, comms_thread_meta links, owner push + SMS summary (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-08)
- Files: docs/ai-receptionist/
- Acceptance: Call appears in Unibox with summary, transcript, recording, linked customer and enquiry within 30 s of hang-up

## T-129 R-09 AI Receptionist: Spam filter and metering: billable, usage_events kind='receptionist_call', spend cap modes
- Status: TESTING
- Added: 2026-11-19
- Requirement: Spam filter and metering: billable, usage_events kind='receptionist_call', spend cap modes ([08](08_SECURITY_COMPLIANCE_METERING.md)) (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-09)
- Files: docs/ai-receptionist/
- Acceptance: Spam and < 15 s calls not billed; cap reached → take-message mode, never dropped calls

## T-130 R-10 AI Receptionist: check_availability + receptionist_slot_holds
- Status: TESTING
- Added: 2026-11-19
- Requirement: check_availability + receptionist_slot_holds (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-10)
- Files: docs/ai-receptionist/
- Acceptance: Two parallel calls never get the same held slot

## T-131 R-11 AI Receptionist: propose_booking + createBookingFromEnquiry + receptionist_booking approval
- Status: TESTING
- Added: 2026-11-19
- Requirement: propose_booking + createBookingFromEnquiry + receptionist_booking approval (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-11)
- Files: docs/ai-receptionist/
- Acceptance: Approve → booking doc + job; reject → hold released, follow-up returns to AWAITING_CUSTOMER

## T-132 R-12 AI Receptionist: warm_transfer with whisper briefing and return-to-receptionist
- Status: TESTING
- Added: 2026-11-19
- Requirement: warm_transfer with whisper briefing and return-to-receptionist (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-12)
- Files: docs/ai-receptionist/
- Acceptance: Staff hears the briefing; no answer in 25 s → caller back with the receptionist → message taken

## T-133 R-13 AI Receptionist: receptionist_followups state machine + scheduler ([05](05_LEAD_TO_BOOKING_FLOW.md))
- Status: TESTING
- Added: 2026-11-19
- Requirement: receptionist_followups state machine + scheduler ([05](05_LEAD_TO_BOOKING_FLOW.md)) (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-13)
- Files: docs/ai-receptionist/
- Acceptance: Every transition in the table has a test; scheduler ticks are idempotent

## T-134 R-14 AI Receptionist: draft_followup + message classes + approval levels + consent/opt-out
- Status: TESTING
- Added: 2026-11-19
- Requirement: draft_followup + message classes + approval levels + consent/opt-out (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-14)
- Files: docs/ai-receptionist/
- Acceptance: Default level sends nothing without approval; STOP → OPTED_OUT + suppression; no sends 8 pm–8 am

## T-135 R-15 AI Receptionist: One AI Receptionist section + aliases for old views ([02](02_SETUP_WIZARD.md))
- Status: TESTING
- Added: 2026-11-19
- Requirement: One AI Receptionist section + aliases for old views ([02](02_SETUP_WIZARD.md)) (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-15)
- Files: docs/ai-receptionist/
- Acceptance: Navigation inventory test: every old route opens the new section; phone/iPad/laptop checks pass

## T-136 R-16 AI Receptionist: Knowledge auto-load + review + approval ([07](07_KNOWLEDGE_AUTOLOAD.md))
- Status: TESTING
- Added: 2026-11-19
- Requirement: Knowledge auto-load + review + approval ([07](07_KNOWLEDGE_AUTOLOAD.md)) (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-16)
- Files: docs/ai-receptionist/
- Acceptance: Only approved revisions reach calls; no other customer's personal data in prompt_block (test)

## T-137 R-17 AI Receptionist: Numbers: buy (Requirement Group), forward (carrier steps + test call), port (LOA, document
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Numbers: buy (Requirement Group), forward (carrier steps + test call), port (LOA, documents, approval, status sync) (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-17)
- Files: docs/ai-receptionist/
- Acceptance: Number bought on a test account and live in < 10 min; forward verified by test call; port order reaches submitted in staging

## T-138 R-18 AI Receptionist: Voice choice, booking rules, approval level, one-tap test call, go-live
- Status: TESTING
- Added: 2026-11-19
- Requirement: Voice choice, booking rules, approval level, one-tap test call, go-live (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-18)
- Files: docs/ai-receptionist/
- Acceptance: A new test business completes the wizard in ≤ 10 minutes on a phone

## T-139 R-19 AI Receptionist: Retire the legacy platform flow and old settings tables (after one stable release, owner a
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Retire the legacy platform flow and old settings tables (after one stable release, owner approval) (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-19)
- Files: docs/ai-receptionist/
- Acceptance: No code path reads the legacy tables; rollback note written

## T-140 R-20 AI Receptionist: Public page wording, help article, pricing add-on, monitoring dashboard
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Public page wording, help article, pricing add-on, monitoring dashboard (spec: docs/ai-receptionist/10_IMPLEMENTATION_PLAN.md R-20)
- Files: docs/ai-receptionist/
- Acceptance: Every claim on saas/site/receptionist.html maps to a verified feature

## T-141 Receptionist call intake: every business call becomes customer + enquiry + Unibox link + owner push/SMS
- Status: TESTING
- Added: 2026-11-19
- Requirement: Owner 2026-11-19: test call left no record and no alert. Calls to a business number must create/update the customer, create an enquiry, show in Unibox and alert the owner by push and SMS (R-07/R-08 first slice)
- Files: src/comms/receptionist-intake.js; src/server.js; scripts/receptionist-intake.test.mjs
- Acceptance: Unit tests 9/9; npm test 73/73; live call to a business number shows in Unibox with customer and enquiry and alerts the owner

## T-142 AI Receptionist self-service section with the business's own Telnyx account
- Status: TESTING
- Added: 2026-11-19
- Requirement: Owner 2026-11-19: one AI Receptionist section any subscriber sets up alone; connect own number (buy/port/pay directly in Telnyx via links), greeting, services, hours, transfers/emergency, alerts, test; remove duplicate placeholder screens; secure, logged, no liability for Oprun
- Files: src/comms/receptionist-telnyx.js; src/comms/voice.js; src/server.js; saas/workspace-receptionist.js; saas/portal-workspace.js; saas/workspace-nav.js; saas/workspace.html; scripts/receptionist-telnyx.test.mjs; scripts/test-ui.mjs; docs/ai-receptionist/00_CONTRACT.md
- Acceptance: receptionist-telnyx tests 9/9; npm test 73/73; test:ui 35/35 incl. new section check; owner connects a real Telnyx number live and a test call lands in Unibox

## T-153 W-07 AI Website: Live Oprun data sync (nightly diff → drafts / low-risk updates)
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Live Oprun data sync (nightly diff → drafts / low-risk updates) (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: A changed phone number appears after approval; a new review appears automatically when allowed

## T-154 W-08 AI Website: Speed budget check added to `prePublishChecks`
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Speed budget check added to `prePublishChecks` (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: Over-budget pages cannot publish without the owner accepting the warning

## T-156 W-10 AI Website: DNS connections (Cloudflare token, Porkbun key), diff + approval + write + verify
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: DNS connections (Cloudflare token, Porkbun key), diff + approval + write + verify (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: Write only after approval; wrong token gives a plain error; records verified by lookup

## T-157 W-11 AI Website: Email set-up for Google, Microsoft and Zoho: record templates, SPF merge, DMARC, verificat
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Email set-up for Google, Microsoft and Zoho: record templates, SPF merge, DMARC, verification (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: SPF never duplicated; MX never removed without approval; verified state reached in a test zone

## T-158 W-12 AI Website: Domain search + registrar deep links + link checker for every external link
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Domain search + registrar deep links + link checker for every external link (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: All links return 200 in CI weekly

## T-159 W-13 AI Website: Ownership gate + crawl inventory + keep/merge/drop screen
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Ownership gate + crawl inventory + keep/merge/drop screen (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: Unverified host refused; robots.txt respected

## T-160 W-14 AI Website: Redesign from inventory + redirect map + pre-switch check + 30-day watch
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Redesign from inventory + redirect map + pre-switch check + 30-day watch (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: Every old URL → 200 or one 301; no chains; watch report produced

## T-161 W-15 AI Website: Growth: citations checklist + NAP check, mention finder, outreach drafts through approvals
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Growth: citations checklist + NAP check, mention finder, outreach drafts through approvals, Links CSV import, optional DataForSEO key (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: No message sent without approval; daily cap enforced

## T-162 W-16 AI Website: Export to GitHub and ZIP (static bundle, `_redirects`, sitemap)
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Export to GitHub and ZIP (static bundle, `_redirects`, sitemap) (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: Exported bundle deploys on Cloudflare Pages and the form still posts to Oprun

## T-163 W-17 AI Website: Help article, public page wording, pricing line for the Website add-on, monitoring of gene
- Status: NOT_STARTED
- Added: 2026-11-19
- Requirement: Help article, public page wording, pricing line for the Website add-on, monitoring of generation cost (docs/ai-website/10_IMPLEMENTATION_PLAN.md)
- Files: see docs/ai-website/02_ARCHITECTURE.md
- Acceptance: Owner approves wording; no claims beyond what is built

## T-200 W-19 AI Website: Buy a domain inside Oprun with the business's own Cloudflare account (Registrar API beta, D-W15)
- Status: NOT_STARTED
- Added: 2026-11-22
- Requirement: From brief v2 (docs/ai-website/PROMPT_V2_2026-11-23.txt) and docs/ai-website/00_CONTRACT.md
- Files: src/website/hub.js, src/website/registrar.js, saas/workspace-website.js
- Acceptance: Search + live price shown; owner-only confirm records an approval; one registration per idempotency key; unsupported extension falls back to deep link; token encrypted write-only; mocked API tests pass; no Oprun payment method ever used

## T-201 W-20 AI Website: Free email forwarding with Cloudflare Email Routing (D-W17)
- Status: NOT_STARTED
- Added: 2026-11-22
- Requirement: From brief v2 (docs/ai-website/PROMPT_V2_2026-11-23.txt) and docs/ai-website/00_CONTRACT.md
- Files: src/website/hub.js, saas/workspace-website.js
- Acceptance: Records shown or written after approval; SPF merged; screen states receive-only; verified by DNS lookup; tests pass

## T-236 TR-72 Performance: workspace first-load budget and Lighthouse mobile >= 85
- Status: IN_PROGRESS
- Added: 2026-11-24
- Requirement: Backlog TR-72: Performance: workspace first load budget; Lighthouse mobile >= 85 on main pages
- Files: src/asset-bundles.js, scripts/report-lighthouse.mjs, saas/ds/motion.js, qa/reports/LIGHTHOUSE.md
- Acceptance: Report saved; every main page >= 85

## T-240 TR-81 Approved release to production
- Status: IN_PROGRESS
- Added: 2026-11-25
- Requirement: Backlog TR-81: approved release: merge, confirm live SHA on srv-dbuq98ojo6nc73aro66g, check caching, screenshot public site, Business Workspace and Operator Console on phone and laptop
- Files: docs/transformation/05_RELEASE_PLAN.md
- Acceptance: Merge on main, live deploy succeeded on the merge commit, health and start-up diagnostics checked, live screenshots compared with the test site

## T-241 AWS lifecycle rules for the live backup root (oprun-ai/)
- Status: NOT_STARTED
- Added: 2026-11-25
- Requirement: Infra rule files use super-pro/ prefixes; live writes under oprun-ai/. Owner applies lifecycle rules (snapshots 35 days, monthly ~13 months) for oprun-ai/ in AWS.
- Files: infra/aws/backup-lifecycle.json
- Acceptance: Owner confirms rules applied to oprun-ai/ prefixes

## T-242 Live provider check for the channel hub (real accounts)
- Status: NOT_STARTED
- Added: 2026-11-25
- Requirement: With a real subscriber account: connect one provider (e.g. Facebook or Gmail), confirm consent screen, a synced item, and one approved reply delivered. Synthetic tests cannot cover real provider consent.
- Files: docs/connections/OWNER-SETUP.md
- Acceptance: Owner or tester records one successful live consent and one approved delivery per provider used
