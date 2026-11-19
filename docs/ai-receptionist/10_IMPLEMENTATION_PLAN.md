# 10 Implementation plan, MVP scope and success metrics

Output #10 of the brief. Tasks are numbered `R-01 … R-20`. Each is recorded in the repository memory as a `T-` task with the title prefix
`R-xx`: **R-01 = T-121 … R-20 = T-140** (R-n = T-(120+n)), so any tool (Claude, ChatGPT, Codex) resumes from
`PENDING_TASKS.md`. Everything ships behind `RECEPTIONIST_ENABLED` (default off) and is switched on for the founder
workspace first. Standing rules from `CLAUDE.md` apply: no deploy, push or infrastructure change without the owner's
approval; every existing route keeps working.

## 1. Phases

### Phase 0: Prove the voice (before any product work)
| Task | What | Acceptance |
|---|---|---|
| R-01 | `oprun-voice` skeleton: Pipecat + `TelnyxFrameSerializer` + Deepgram Flux + ElevenLabs Flash (Cartesia fallback) + LLM adapter (`bedrock_au`, `openai`); fixed test prompt; no Oprun tools | A test number in Sydney answers; per-turn timings logged |
| R-02 | Latency and naturalness bake-off from Sydney: 20 scripted calls × both LLM providers, plus the Retell benchmark from the voice-stack decision; 5 blind "human or AI?" listeners | p50 ≤ 700 ms and p95 ≤ 1000 ms caller-stop → first audio; barge-in stop ≤ 80 ms (p95 ≤ 120 ms); **D-R5 closed and recorded** with `memory:task -- decision` |

### Phase 1: Core call handling (MVP heart)
| Task | What | Acceptance |
|---|---|---|
| R-03 | Data model: new tables and `voice_calls` columns from [00_CONTRACT.md §5](00_CONTRACT.md#5-new-and-changed-data-sqlite-oprun-web), migration + backfill dry-run (absorbs the receptionist half of T-040) | `npm test` migration checks pass; dry-run report reviewed by the owner |
| R-04 | Internal API `/api/internal/voice/*` with service key + call token; `call-context` endpoint | Contract tests: wrong org token rejected; expired token rejected; idempotent replays |
| R-05 | `voice.js`: route via `receptionist_numbers`; on answer start streaming to `oprun-voice` with call token; `fallback_assistant` → transfer → voicemail → apology chain | Webhook replay test covers every fallback branch; a killed worker still ends in voicemail, never silence |
| R-06 | Naturalness prompt + barge-in/backchannel rules ([03](03_NATURALNESS_PROMPT.md)) in the worker | The 10 scenarios pass the robotic-behaviour checklist in staging |
| R-07 | Tools `create_or_update_customer`, `create_enquiry_lead`, `take_message`, `end_call` ([04](04_TOOLS.md), [06](06_CUSTOMER_MANAGEMENT.md)) | New caller → customer `lead` + enquiry; existing caller matched by phone; no duplicate customer in tests |
| R-08 | After-call: summary (`generateAiText`), Unibox call log on the caller's voice thread, `comms_thread_meta` links, owner push + SMS summary | Call appears in Unibox with summary, transcript, recording, linked customer and enquiry within 30 s of hang-up |
| R-09 | Spam filter and metering: `billable`, `usage_events kind='receptionist_call'`, spend cap modes ([08](08_SECURITY_COMPLIANCE_METERING.md)) | Spam and < 15 s calls not billed; cap reached → take-message mode, never dropped calls |

### Phase 2: Booking and transfer
| Task | What | Acceptance |
|---|---|---|
| R-10 | `check_availability` + `receptionist_slot_holds` | Two parallel calls never get the same held slot |
| R-11 | `propose_booking` + `createBookingFromEnquiry` + `receptionist_booking` approval | Approve → booking doc + job; reject → hold released, follow-up returns to `AWAITING_CUSTOMER` |
| R-12 | `warm_transfer` with whisper briefing and return-to-receptionist | Staff hears the briefing; no answer in 25 s → caller back with the receptionist → message taken |

### Phase 3: Unibox follow-up until booked
| Task | What | Acceptance |
|---|---|---|
| R-13 | `receptionist_followups` state machine + scheduler ([05](05_LEAD_TO_BOOKING_FLOW.md)) | Every transition in the table has a test; scheduler ticks are idempotent |
| R-14 | `draft_followup` + message classes + approval levels + consent/opt-out | Default level sends nothing without approval; STOP → `OPTED_OUT` + suppression; no sends 8 pm–8 am |

### Phase 4: Self-service setup
| Task | What | Acceptance |
|---|---|---|
| R-15 | One AI Receptionist section + aliases for old views ([02](02_SETUP_WIZARD.md)) | Navigation inventory test: every old route opens the new section; phone/iPad/laptop checks pass |
| R-16 | Knowledge auto-load + review + approval ([07](07_KNOWLEDGE_AUTOLOAD.md)) | Only approved revisions reach calls; no other customer's personal data in `prompt_block` (test) |
| R-17 | Numbers: buy (Requirement Group), forward (carrier steps + test call), port (LOA, documents, approval, status sync) | Number bought on a test account and live in < 10 min; forward verified by test call; port order reaches `submitted` in staging |
| R-18 | Voice choice, booking rules, approval level, one-tap test call, go-live | A new test business completes the wizard in ≤ 10 minutes on a phone |

### Phase 5: Clean-up and launch
| Task | What | Acceptance |
|---|---|---|
| R-19 | Retire the legacy platform flow and old settings tables (after one stable release, owner approval) | No code path reads the legacy tables; rollback note written |
| R-20 | Public page wording, help article, pricing add-on, monitoring dashboard | Every claim on `saas/site/receptionist.html` maps to a verified feature |

## 2. MVP scope (locked for the first live business)

**In:** Phase 0–3 plus a minimal wizard (R-15 basic, R-16, R-17 buy + forward only, R-18). English (AU) first, with
language switching for the languages Flux Multilingual and the chosen voice support. Approval level default
`approve_all`.

**Out of MVP (next):** self-service porting UI (ports done by the founder through Telnyx during the MVP; the port data
model ships in R-03 so nothing changes later), Twilio backup, outbound calling, website chat with the same knowledge,
waterfall transfer beyond the team list, per-business custom voices.

## 3. Success metrics

| Metric | Target at MVP | How measured |
|---|---|---|
| Caller-stop → first audio | p50 ≤ 700 ms, p95 ≤ 1000 ms | `voice_calls.latency_p50_ms / latency_p95_ms` |
| Barge-in stop time | p95 ≤ 120 ms (goal 80 ms) | Worker events |
| Naturalness score | ≥ 4.2 / 5 average; ≥ 60 % of blind listeners unsure or "human" on recorded test calls | Monthly listening panel on 20 sampled calls (with consent) |
| Robotic-behaviour defects | 0 repeated sentences, 0 talk-overs in the 10 scenarios | Checklist in [03](03_NATURALNESS_PROMPT.md) |
| Setup time | Median ≤ 10 min to go live (buy or forward) | Wizard timestamps |
| Enquiry capture | ≥ 95 % of non-spam calls create or update a customer and an enquiry or message | Calls vs records |
| Booking conversion | ≥ 35 % of booking-intent calls end `BOOKED` within 7 days (baseline measured in month 1, then improved) | `receptionist_followups` |
| Approval turnaround | Median ≤ 15 min in business hours | `workspace_approvals` timestamps |
| Missed calls | 0 calls ending in silence | Fallback chain logs |
| Billing accuracy | 0 spam or < 15 s calls billed | `voice_calls.billable` audit |

## 4. What to push to GitHub first for live testing

1. **This spec pack** on branch `claude/ai-receptionist-spec` (docs only, no behaviour change). Open a PR, review, merge.
2. **R-01 + R-02** in a new top-level folder `voice/` (Python, its own README and Dockerfile), plus a staging Telnyx
   number pointed at it. No change to `oprun-web`; nothing for existing customers.
3. **R-03 + R-04 + R-05** behind `RECEPTIONIST_ENABLED=0`, deployed to the Render **staging** service
   (`render.staging.yaml`) only, then founder-workspace live test calls.

Every push follows `CLAUDE.md`: verified commits only, no force-push, no production deploy without the owner's yes.

## 5. Dependencies the owner must provide (cannot be done from code)
- Telnyx: a staging number, Call Control application, messaging profile, porting enabled for AU.
- Accounts and keys for Deepgram, ElevenLabs, Cartesia, and AWS (Sydney) for `oprun-voice` and Bedrock (if chosen).
- The add-on price for the AI Receptionist and the included-call allowance per plan.
- Approval of D-R5 after the bake-off.
