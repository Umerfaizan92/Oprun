# 09 Comparison and merge with Oprun's existing AI features

Output #9 of the brief. The aim: one AI Receptionist, one settings record, one call path, and the existing
approval-first Unibox untouched in spirit. Every fact in the "today" column was read from the code (see
[00_CONTRACT.md §1](00_CONTRACT.md#1-ground-truth-what-already-exists-in-the-repository-verified-by-reading-the-code)).

## 1. Disposition of every existing receptionist piece

| # | Existing piece (today) | Decision | What happens |
|---|---|---|---|
| 1 | Legacy platform-wide flow in `src/server.js`: `BUSINESS_RECEPTIONIST_AI_INSTRUCTIONS`, `handleTelnyxCallInitiated/Answered`, `receptionist_settings` (`id=1`), `voice_enquiries`, `GET/PUT /api/admin/receptionist-settings` | **Remove after migration** | The founder's own line (Fleet Parlour, founder-exempt account) becomes a normal business in the new path. Its settings are copied into `receptionist_config` for the founder workspace. The admin routes return the migrated values read-only for one release, then are removed with owner approval. `voice_enquiries` rows are copied into `tenant_documents` enquiries for the founder workspace (dry-run report first) |
| 2 | Phase 07 per-business flow `src/comms/voice.js`: routing, answer, Telnyx AI Assistant (`ai_assistant_start`), transfer, voicemail, apology, de-duplication, inbox write on hang-up | **Keep and extend** | Routing reads `receptionist_numbers` (falls back to `comms_channels` during migration). On answer it starts **media streaming to `oprun-voice`** instead of `ai_assistant_start`. The Telnyx AI Assistant stays only as the `fallback_assistant` stage. Transfer, voicemail, apology, de-duplication and failure log are reused unchanged |
| 3 | `voice_settings` (per business: mode, transfer number, recording notice, voicemail greeting, transfer_when) | **Merge into `receptionist_config`** | One-time copy; `voice.js` reads `receptionist_config` first. Table kept read-only one release |
| 4 | `tenant_receptionist_profiles` + `GET/PUT /api/saas/receptionist-profile` | **Merge** | Greeting, hours, timezone, transfer destination → `receptionist_config`. Free-text `knowledge` → first draft of `receptionist_knowledge` (owner approves it in wizard step 2). The API stays as a compatibility shim that reads/writes the new tables |
| 5 | `POST /api/saas/comms/voice-logs` (manual/API call logging) | **Keep** | Still useful for calls taken on other phones. Logged calls are not billed |
| 6 | Unibox (`comms_threads`, `comms_messages`, `comms_thread_meta`, `recordInbound`) | **Keep, reuse** | Receptionist calls and follow-ups are ordinary Unibox threads and messages. No second inbox |
| 7 | Rule-based inbox AI (`src/comms/ai.js`: categorise, sentiment, qualifyLead, escalation, duplicates, draftReply, followUps) | **Keep** | Still runs on every thread. The receptionist adds an LLM call summary (`voice_calls.summary_json`) and passes its structured fields in, so the heuristics get better inputs. `followUps()` suggestions are hidden for threads that have an active `receptionist_followups` row, so staff never see two follow-up prompts for one enquiry |
| 8 | Outbound approvals (`createWorkspaceApproval`, `approval_type='outbound_message'`, `applyApprovalToComms`) | **Keep, reuse** | All AI-written customer messages use this exact path. Only the message classes the owner allowed in [00_CONTRACT.md §8](00_CONTRACT.md#8-message-classes-and-who-may-send-automatically) skip it |
| 9 | Pipeline (`createEnquiry`, `createQuoteFromEnquiry`, `createJobForBooking`) | **Keep, add one helper** | The receptionist creates enquiries through `createEnquiry` (channel `receptionist`). New helper `createBookingFromEnquiry` (spec in [04_TOOLS.md](04_TOOLS.md)) for bookings that skip a quote |
| 10 | AI provider shim (OpenAI default `gpt-5.6-luna`, `generateAiText`) | **Keep for after-call work** | Summaries, drafts and knowledge extraction stay on the existing provider and its `usage_events kind='ai'` limits. The live call uses the low-latency adapter chosen by D-R5 in `oprun-voice` |
| 11 | Workspace views `assistant`, `voiceflow`, `receptionist`, `phone`, `calls` | **Replace with one section** | One "AI Receptionist" section ([02_SETUP_WIZARD.md](02_SETUP_WIZARD.md)). Every old path and alias opens it. The "AI Assistant" chat co-pilot (non-phone) keeps its own entry; only the phone receptionist parts move |
| 12 | Founder channel activation (`comms_channels` pending → active by founder) | **Replace for voice** | Self-service buy / forward / port. The founder keeps an override in the operator console for support |
| 13 | Pending task **T-040** "Create enquiries from inbox messages and receptionist calls" | **Absorbed** | The receptionist half is delivered by this project (task R-03 in [10_IMPLEMENTATION_PLAN.md](10_IMPLEMENTATION_PLAN.md)). The inbox-message half stays in T-040 |
| 14 | Public page `saas/site/receptionist.html` | **Keep, align wording** | Claims are checked against what is live before each release (standing rule: never claim a feature that is not verified) |

## 2. What the new receptionist adds that did not exist

| Capability | Before | After |
|---|---|---|
| Voice quality and speed | Telnyx AI Assistant with a generic voice; latency not measured | Sydney media plane, Flux turn detection, streaming TTS, measured p50/p95 per call |
| Knowledge | One free-text box | Facts extracted from Oprun records, owner-approved, versioned |
| Customer records | Calls only logged to the inbox | Customer created/updated, enquiry created, linked to the thread |
| Booking | None on the phone | Live slots, hold, approval, booking + job |
| Follow-up | Manual | State machine until booked or closed, approval-first |
| Numbers | Founder activates one number | Buy / forward / port in the wizard, several numbers per business |
| Transfer | Blind transfer to one number | Warm transfer with a spoken briefing, team list, returns to receptionist if nobody accepts |
| Metering | None for calls | Billable calls, spam and < 15 s free, spend cap |

## 3. Migration order (no downtime, reversible)

1. Add the new tables and columns (additive only; `npm test` migration checks must pass).
2. Copy legacy settings into `receptionist_config` and draft `receptionist_knowledge` for every business with a
   profile; write a dry-run report first and keep the source rows.
3. Backfill `receptionist_numbers` from active `comms_channels` voice rows (`origin='bought'`, `is_primary=1`).
4. Turn on `RECEPTIONIST_ENABLED` for the founder workspace only; place test calls.
5. Turn it on per business as they finish the wizard. `voice.js` chooses the path per business:
   live config → streaming; otherwise the existing Phase 07 path.
6. After one stable release, retire the legacy platform flow (item 1) with owner approval.

Rollback at any point: set `RECEPTIONIST_ENABLED=0` (or pause one business). `voice.js` returns to the Phase 07 path,
which still reads the kept legacy tables.

## 4. Single source of truth after the merge

| Question | Single answer lives in |
|---|---|
| How does this business's phone answer? | `receptionist_config` |
| What may the receptionist say? | Approved `receptionist_knowledge` revision |
| Which numbers ring this business? | `receptionist_numbers` |
| What happened on a call? | `voice_calls` (+ the Unibox thread) |
| Who is the caller? | `tenant_customers` |
| What did they ask for? | `tenant_documents` enquiry |
| What happens next with them? | `receptionist_followups` |
| What needs a human yes? | `workspace_approvals` |
