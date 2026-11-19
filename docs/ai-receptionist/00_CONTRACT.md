# 00 Contract: the single source of names, data and decisions

Every other file in `docs/ai-receptionist/` must use the names, states and decisions below exactly. If a file needs a
name that is not here, add it here first. If a file disagrees with this contract, this contract wins and the other
file is the mistake.

Written 2026-11-19 against `main` at `9da4b37` (merge of PR #133).

## 1. Ground truth: what already exists in the repository (verified by reading the code)

| Area | What exists | File |
|---|---|---|
| Telnyx webhook | `POST /api/webhooks/telnyx`, Ed25519 signature check (`TELNYX_PUBLIC_KEY`), acknowledges first, de-duplicates events, then dispatches | `src/server.js` |
| Per-business call flow (Phase 07) | `createVoice()`: routes the dialled number to its business, answers, starts Telnyx transcription and the **Telnyx AI Assistant** (`ai_assistant_start`, `TELNYX_AI_ASSISTANT_ID`), transfer during hours, voicemail, apology, hang-up. Writes the call to the inbox on hang-up | `src/comms/voice.js` |
| Call tables | `voice_calls`, `voice_events`, `voice_settings(owner_key, mode, transfer_number, recording_notice, voicemail_greeting, transfer_when)` | `src/comms/voice.js` |
| Number → business routing | `orgForNumber()` reads `comms_channels` where `channel='voice' AND status='active'`. `comms_channels` has `PRIMARY KEY(organisation_id, channel)`, so **one voice number per business today** | `src/server.js`, `src/saas-platform.js` |
| Number activation | Business requests a channel (`status='pending'`); the founder activates it (`status='active'`). No self-service buying or porting | `src/saas-platform.js` |
| Business receptionist profile | `tenant_receptionist_profiles(organisation_id, greeting, knowledge, hours, timezone, transfer_destination, revision, status draft…)`, API `GET/PUT /api/saas/receptionist-profile` | `src/business-hub.js` |
| Legacy platform receptionist | One platform-wide flow: `BUSINESS_RECEPTIONIST_AI_INSTRUCTIONS`, `receptionist_settings` (single row `id=1`), `voice_enquiries`, `GET/PUT /api/admin/receptionist-settings`. Phase 07 left these in place | `src/server.js`, `src/db.js` |
| Manual call logging | `POST /api/saas/comms/voice-logs` (senior roles) | `src/saas-platform.js` |
| Unified inbox ("Unibox") | `comms_threads` (one per business + channel + contact address), `comms_messages` (statuses `received, draft, pending_approval, approved, rejected, sending, sent, failed`; `ai_generated`; `approval_id`), `comms_thread_meta` (category, sentiment, summary, `lead_score`, `lead_band`, `customer_id`, `enquiry_id`, escalation) | `src/saas-platform.js`, `src/comms/service.js` |
| Inbox write path | `recordInbound(db, {...})` | `src/saas-platform.js` |
| Inbox heuristics | `categorise, sentiment, summarise, extractDetails, qualifyLead, escalation, duplicates, followUps, draftReply, analyseThread` (rule-based, no LLM) | `src/comms/ai.js` |
| Customers (tenant) | `tenant_customers(id, organisation_id, name, email, phone, address, notes, status lead/current/past, source, …)` | `src/saas-platform.js` |
| Enquiry → quote → booking → job | `tenant_documents` (`kind` enquiry/quote/booking/invoice/credit_note, `status`, `customer_id`, `source_id`, `work_order_id`, `channel`), jobs = `work_orders`. `installPipeline()` returns `createEnquiry, createQuoteFromEnquiry, createJobForBooking, createInvoiceFromJob, refreshInvoice, gstFor`. Enquiry channel enum already includes `receptionist` | `src/pipeline.js` |
| Approvals | `workspace_approvals` + `createWorkspaceApproval(req, {approval_type, source_module, title, summary, entity_type, entity_id, risk_level, draft_payload, required_role})`; outbound replies use `approval_type='outbound_message'` and `applyApprovalToComms()` | `src/server.js`, `src/saas-platform.js` |
| Notifications | `notifications.notifyRoles(org, roles, opts)`, web push (`src/web-push.js`) | `src/notifications.js` |
| AI provider | `ai-provider-shim.js`: OpenAI (`OPENAI_API_KEY`, default model `gpt-5.6-luna`), Gemini, other OpenAI-compatible hosts; `generateAiText` | `src/ai-provider-shim.js` |
| Usage metering | `usage_events(id, organisation_id, kind, created_at)`, used today for `kind='ai'` limits | `src/entitlements.js` |
| Add-ons | `organisation_addons(addon_id, quantity, status requested/active/cancelled/declined, price_cents)` | `src/addons.js` |
| Workspace screens today | `assistant` ("AI Assistant & Receptionist", alias `operations/receptionist`), `voiceflow` ("Call Handling", `communications/call-handling`), `receptionist`, `phone`, `calls` views | `saas/workspace-nav.js`, `saas/workspace-comms-platform.js`, `saas/portal-workspace.js` |
| Hosting | One Node 22 service on Render, region **singapore**, SQLite on a disk, Litestream to S3 | `render.yaml` |
| Project memory | `.claude/project-memory/*` written through `npm run memory:*`; ChatGPT handover in `docs/chatgpt-emergency-handover/` | `CLAUDE.md` |
| Open overlapping task | **T-040 "Create enquiries from inbox messages and receptionist calls"** (NOT_STARTED). This project absorbs it; do not create a second task for the same work | `.claude/project-memory/PENDING_TASKS.md` |

The legacy single-tenant tables `enquiries`, `customers`, `bookings`, `service_catalog`, `date_proposals` (no
`organisation_id`) belong to the old Fleet Parlour flow. **The receptionist never reads or writes them.**

## 2. Product names (use these words in the UI and docs)

- **AI Receptionist**: the product and the one workspace section that replaces `assistant`, `voiceflow`,
  `receptionist`, `phone` and `calls`. Old routes and aliases stay and open the new section.
- **Unibox**: the existing Unified Inbox (`communications/inbox`). Not a new inbox.
- **Enquiry**: a `tenant_documents` row with `kind='enquiry'`, `channel='receptionist'`.
- **Lead**: not a new table. A lead is a `tenant_customers` row with `status='lead'` plus the thread's
  `comms_thread_meta.lead_score / lead_band`.
- **Booking**: a `tenant_documents` row with `kind='booking'` and its job in `work_orders`, created only through the
  pipeline helpers.
- **Follow-up**: a `receptionist_followups` row that drives messages until the enquiry is booked or closed.

## 3. Services

| Service | Where | Role |
|---|---|---|
| `oprun-web` | Existing Render service (`super-pro-ai-office-manager`, Singapore) | System of record. Owns the database, Telnyx call-control webhook, approvals, Unibox, wizard, billing. Unchanged hosting |
| `oprun-voice` | **New** Python service (Pipecat) on AWS `ap-southeast-2` Sydney (ECS Fargate, 2+ tasks behind an ALB with WebSocket support), domain `voice.oprun.ai` | Media plane only: Telnyx audio stream ↔ Deepgram Flux ↔ LLM ↔ ElevenLabs/Cartesia. Holds no database. Calls `oprun-web` internal API for tools |
| Telnyx | Sydney PoP | Numbers, Call Control, media streaming, porting, SMS |

Call audio never passes through Singapore. Only call-control events and tool calls cross Sydney ↔ Singapore.

## 4. Locked stack (change only with a measured result from Sydney)

| Layer | Choice | Setting |
|---|---|---|
| Telephony | Telnyx Call Control + bidirectional media streaming (PCMU 8 kHz) | Twilio is a documented backup, not built in the MVP |
| Call engine | Pipecat, `TelnyxFrameSerializer` + FastAPI WebSocket transport | Python 3.12 |
| STT + turn | Deepgram Flux `flux-general-multi` (English first) | `eot_threshold=0.7`, `eager_eot_threshold=0.5`, `eot_timeout_ms=3000` (tunable per business 2000–5000) |
| Barge-in | Local Silero VAD in the worker | Stop TTS within 80 ms of confirmed caller speech |
| TTS | ElevenLabs Flash v2.5 primary, Cartesia Sonic fallback | Australian-accent voice list curated in the wizard |
| LLM (live call) | **Decision D-R5 open**: `bedrock_au` (Amazon Bedrock, AU geographic inference profile, Sydney/Melbourne) vs `openai` (existing key). Chosen by the bake-off in Phase 0 | Env `VOICE_LLM_PROVIDER`, `VOICE_LLM_MODEL` |
| LLM (after the call) | Existing `generateAiText` / OpenAI path in `oprun-web` | Summaries, drafts, knowledge extraction |
| Latency budget | 530–775 ms caller-stops → first audio; report p50 and p95 per call | Fail the release gate if p95 > 1000 ms in the Sydney test set |

## 5. New and changed data (SQLite, `oprun-web`)

All new tables carry `organisation_id` and every query filters by the organisation from the session or from the
call token. Nothing trusts an organisation id sent by a client or by the voice worker.

| Table | Purpose | Key columns |
|---|---|---|
| `receptionist_config` | **The one settings record per business.** Replaces `voice_settings` (per business) and the operational fields of `tenant_receptionist_profiles` | `organisation_id PK, status ('draft','live','paused'), greeting, hours_json, timezone, voice_id, voice_provider, languages_json, booking_mode ('approve','auto'), booking_rules_json, approval_level ('approve_all','auto_confirmations','auto_followups'), transfer_targets_json, transfer_when ('on_request','urgent','never'), forward_mode, recording_notice INTEGER, recording_enabled INTEGER DEFAULT 0, transcript_retention_days DEFAULT 365, recording_retention_days DEFAULT 90, voicemail_greeting, voice_speed ('slower','normal','quicker'), spend_cap_cents, cap_action ('take_message','voicemail'), knowledge_revision, wizard_step, updated_by, updated_at` |
| `receptionist_knowledge` | Versioned knowledge snapshots | `id, organisation_id, revision, status ('draft','approved','superseded'), facts_json, prompt_block, sources_json, approved_by, approved_at, created_at` |
| `receptionist_numbers` | All numbers of a business (allows a forwarding target and a porting number at the same time) | `id, organisation_id, e164 UNIQUE, telnyx_number_id, number_type ('local','1300','1800','mobile'), origin ('bought','forward_target','ported'), status ('provisioning','active','releasing','released'), is_primary, requirement_group_id, forwarded_from_e164, forward_verified_at, created_at, updated_at` |
| `receptionist_port_orders` | Porting state machine | `id, organisation_id, telnyx_port_order_id, numbers_json, number_kind, status (see §6.3), foc_date, rejection_reason, loa_document_id, invoice_document_id, approval_id, created_at, updated_at` |
| `receptionist_followups` | Follow-up state machine per enquiry | `id, organisation_id, enquiry_id UNIQUE, customer_id, thread_id, state (see §6.1), step, next_action_at, last_channel, attempts, stop_reason, created_at, updated_at` |
| `receptionist_slot_holds` | Stops two callers taking the same time while a booking waits for approval | `id, organisation_id, start_at, end_at, call_control_id, enquiry_id, approval_id, expires_at` |
| `receptionist_blocklist` | Spam block list: a business's own entries plus Oprun's shared list (`organisation_id` NULL) | `id, organisation_id NULL, e164, reason, added_by, created_at, UNIQUE(organisation_id, e164)` |
| `receptionist_tool_calls` | Stored tool responses so a retried tool call returns the same answer (kept 24 h) | `idempotency_key PK, organisation_id, call_control_id, tool_name, response_json, created_at` |
| `receptionist_duplicate_candidates` | Review queue for possible duplicate customers (never auto-merged) | `id, organisation_id, customer_id, candidate_customer_id, reason, status ('open','merged','dismissed'), created_at, decided_by, decided_at` |
| `voice_calls` (existing, **extended**, not duplicated) | Adds: `customer_id, enquiry_id, thread_id, intent, outcome, language, spam_score, billable INTEGER, latency_p50_ms, latency_p95_ms, barge_in_count, summary_json, worker_session_id` | |
| `tenant_customers` (existing, **extended**) | Adds `caller_note TEXT` (≤ 300 chars): the one staff-written note the receptionist may use with this caller. `notes` never reach the prompt | |
| `comms_channels` (existing) | Keeps one `voice` row = the business's **primary** display number. Routing moves to `receptionist_numbers` | |
| `usage_events` (existing) | One row `kind='receptionist_call'` per **billable** call | |

### 5.1 `receptionist_config.booking_rules_json` (one shape, used by 02, 04 and 07)
```json
{
  "services": [ { "id": "svc_1", "name": "Blocked drain", "aliases": ["drain"], "duration_min": 60,
                  "price_from_cents": 12000, "needs_visit": true } ],
  "buffer_min": 15, "lead_time_hours": 2, "window_days": 14,
  "bookable_hours": null, "service_area": ["Joondalup", "6027"], "crews": 1
}
```
`bookable_hours` null means "use `hours_json`". Empty `services` means "no bookings on calls, take a message".
`price_from_cents` is the only price the receptionist may say.

### 5.2 Fixed value lists
- `voice_calls.outcome`: `completed, caller_hung_up, spam, wrong_number, transferred, silence, message_taken,
  voicemail, missed, test`.
- Tool argument enums are defined once, in [04_TOOLS.md](04_TOOLS.md). Other files use those values only.
- Worker metrics sent to `POST events` (not columns): `barge_in_stop_ms, eager_cancelled, filler_count,
  repeat_requests`. Per-call aggregates go to `voice_calls.latency_p50_ms, latency_p95_ms, barge_in_count`.

Legacy tables `voice_settings`, `tenant_receptionist_profiles`, `receptionist_settings`, `voice_enquiries` are migrated,
then kept read-only for one release for rollback, then dropped only with the owner's approval.

## 6. State machines (exact state names)

### 6.1 Enquiry follow-up (`receptionist_followups.state`)
`NEW → QUALIFYING → AWAITING_CUSTOMER → SLOT_PROPOSED → BOOKING_PENDING_APPROVAL → BOOKED`
Terminal: `BOOKED, CLOSED_LOST, CLOSED_NO_RESPONSE, OPTED_OUT, HANDED_TO_STAFF`.
`HANDED_TO_STAFF` stops all automatic messages; a staff member can return it to `AWAITING_CUSTOMER`.

### 6.2 Call (`voice_calls.stage`, existing values kept, new ones added)
Existing: `ringing, answered, assistant, transferring, voicemail_greeting, voicemail_recording, apology, ended`.
New: `streaming` (audio connected to `oprun-voice`), `fallback_assistant` (Telnyx AI Assistant used because the worker
was unreachable). Fallback chain: `streaming → fallback_assistant → transferring → voicemail_greeting → apology → ended`.

### 6.3 Port order (`receptionist_port_orders.status`)
`draft → documents_uploaded → awaiting_owner_approval → submitted → foc_confirmed → ported → live`
Side states: `rejected` (returns to `documents_uploaded` after a fix), `cancelled`.

### 6.4 Number (`receptionist_numbers.status`)
`provisioning → active → releasing → released`.

## 7. Approvals (existing `workspace_approvals`, `source_module='receptionist'`)

| `approval_type` | Created when | Default |
|---|---|---|
| `receptionist_booking` | The receptionist agreed a time with a caller | Required unless `booking_mode='auto'` |
| `outbound_message` (existing type) | Any AI-written SMS/email to a customer | Required unless `approval_level` allows that message class (§8) |
| `receptionist_knowledge` | A knowledge revision is ready to go live | Always required |
| `receptionist_port_order` | A port order is ready to submit | Always required |
| `receptionist_number_purchase` | A number purchase will add a monthly charge | Always required (one tap in the wizard) |

## 8. Message classes and who may send automatically

| Class | Example | `approve_all` (default) | `auto_confirmations` | `auto_followups` |
|---|---|---|---|---|
| `post_call_ack` | "Thanks for calling Smith Plumbing, we've got your request and will confirm a time shortly." (fixed template) | Draft | **Auto** | **Auto** |
| `booking_confirmation` | Sent after the booking approval | Draft | **Auto** | **Auto** |
| `followup_nudge` | Template reminder at the cadence in §9 | Draft | Draft | **Auto** |
| `free_text_reply` | Anything the LLM writes freely, or anything containing a price, a promise or a complaint answer | Draft | Draft | Draft |

Auto-send is allowed only for fixed templates with filled fields, only to a contact with SMS/email consent recorded,
never between 8 pm and 8 am in the business's time zone, and always with opt-out text (Spam Act 2003).

## 9. Follow-up cadence (default, editable per business)

Attempt 1: within 5 minutes after the call (`post_call_ack`). Attempt 2: +4 hours (business hours only). Attempt 3:
next business day 10 am. Attempt 4: +3 business days. Then `CLOSED_NO_RESPONSE`. Any customer reply pauses the
cadence and puts the thread in `needs_reply`. "STOP" or an unsubscribe moves to `OPTED_OUT` and records suppression.

## 10. Live-call tools (names are fixed; schemas in `04_TOOLS.md`)
`check_availability, create_or_update_customer, create_enquiry_lead, merge_to_unibox, propose_booking, warm_transfer,
draft_followup`. Plus two control tools: `end_call`, `take_message`.
`merge_to_unibox` and `draft_followup` are normally run by `oprun-web` after the call; the agent may call them live only
when the caller asks for something to be sent now.

## 11. Internal API between `oprun-voice` and `oprun-web`
- Base: `https://<oprun-web>/api/internal/voice/`. Auth: header `X-Voice-Service-Key` (env `VOICE_SERVICE_KEY`) **and**
  a call token (HMAC-SHA256 with `VOICE_CALL_TOKEN_SECRET`, claims `{org, call_control_id, exp ≤ 45 min}`) issued by
  `oprun-web` when it starts the stream. The organisation always comes from the token.
- Endpoints: `GET call-context`, `POST tools/<tool_name>`, `POST events` (latency, barge-in, transcript segments),
  `POST call-ended`.
- Every POST carries `idempotency_key = sha256(call_control_id + tool_name + turn_index)`.

## 12. Environment variables (new)
`oprun-web`: `VOICE_WORKER_WSS_URL`, `VOICE_SERVICE_KEY`, `VOICE_CALL_TOKEN_SECRET`, `RECEPTIONIST_ENABLED` (feature
flag, default `0`), `TELNYX_MESSAGING_PROFILE_ID`.
`oprun-voice`: `OPRUN_WEB_BASE_URL`, `VOICE_SERVICE_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `CARTESIA_API_KEY`,
`VOICE_LLM_PROVIDER`, `VOICE_LLM_MODEL`, `AWS_REGION=ap-southeast-2`, `OPENAI_API_KEY` (only if `openai`).
Values are "[stored separately]" and never written to the repository.

## 12a. Code names (helpers, events, UI)

| Kind | Names |
|---|---|
| New helpers in `oprun-web` | `createBookingFromEnquiry(org, actor, enquiryId, {...})` (added to `installPipeline`'s return object); `receptionistActor(org)` (a request-shaped system actor so `createWorkspaceApproval` and `saasAudit` work unchanged); `applyApprovalToReceptionist(db, row, status, edited)` (one hook in the approval decision transaction, next to `applyApprovalToComms`) |
| Job type (existing `job-queue.js`) | `receptionist.followup` |
| Audit events | `receptionist.customer_created, receptionist.customer_updated, receptionist.consent_recorded, receptionist.duplicate_flagged, receptionist.booking_proposed, receptionist.booking_created` |
| Notification kinds | `receptionist_call, receptionist_message, receptionist_emergency` |
| Sources | `tenant_customers.source='receptionist'`; consent source `receptionist_call` |
| Workspace view | id `aireceptionist`, path `communications/ai-receptionist`; old views and aliases open it ([02](02_SETUP_WIZARD.md)) |
| Wizard API | `/api/saas/receptionist/*` (list in [02](02_SETUP_WIZARD.md)) |

Repository finding (not changed by this project): outbound reply approvals use two type names today,
`outbound_message` (`src/saas-platform.js`) and `external_message` (`src/comms/service.js`). The receptionist uses
`outbound_message` only. Unifying the two is a separate clean-up task (R-03 notes it; it is not silently changed).

## 13. Decisions

| ID | Decision | Status |
|---|---|---|
| D-R1 | Pipeline STT→LLM→TTS, not speech-to-speech | Locked |
| D-R2 | Telnyx Sydney primary, Twilio backup (not built in MVP) | Locked |
| D-R3 | `oprun-voice` on AWS Sydney; `oprun-web` stays on Render Singapore | Locked |
| D-R4 | Approval-first: nothing AI-written reaches a customer without approval unless the owner chose an auto level (§8) | Locked |
| D-R5 | Live-call LLM provider (`bedrock_au` vs `openai`) | **Open: bake-off in Phase 0** |
| D-R6 | One AI Receptionist section; old views become aliases | Locked |
| D-R7 | Honesty: the receptionist says it is Oprun's AI assistant whenever a caller sincerely asks; it never claims to be a person | Locked |
| D-R8 | Calls under 15 s or flagged spam are never billed | Locked |
| D-R9 | No external human receptionist network; escalation goes to the business's own team | Locked |
| D-R10 | T-040 is absorbed into this project's tasks | Locked |
| D-R11 | Test line: Telnyx number **08 6289 1786** (+61 8 6289 1786), owned by Faizan, unused and not live for any customer. Used for R-01/R-02 and staging tests; after the receptionist passes R-02 it becomes Fleet Parlour's primary number (founder workspace, `receptionist_numbers.is_primary=1`) | Locked (owner, 2026-11-19) |
| D-R12 | **Each business uses its own Telnyx account** (owner, 2026-11-19). The business buys or ports numbers and pays Telnyx directly through links in the AI Receptionist section; Oprun only connects it (ownership check, assistant + Call Control app created in the business's account, number assigned, keys stored encrypted). Calls arrive at `/api/webhooks/communications/telnyx-voice/:organisationId`, verified with that business's public key, and are controlled only with that business's key. Supersedes the single-Oprun-account assumption in §3, §5 (`receptionist_numbers`, `receptionist_port_orders`, `receptionist_number_purchase`) and D-R2 for numbers; table `receptionist_provider` holds the connection. Implemented in T-142 | Locked (owner, 2026-11-19) |
