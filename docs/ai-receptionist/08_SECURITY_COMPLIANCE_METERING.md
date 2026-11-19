# 08 Security, compliance and metering

Names, tables and decisions follow [00_CONTRACT.md](00_CONTRACT.md). This file is design guidance, not legal advice.
Faizan should have an Australian privacy lawyer review the collection notice, recording notice and Spam Act wording
before launch.

## 1. Tenant isolation

- The organisation is taken **only** from the signed-in session (workspace) or from the call token (voice worker).
  An organisation id in a request body, query string or worker payload is ignored.
- Every query on `receptionist_*`, `voice_calls`, `tenant_customers`, `tenant_documents`, `work_orders`, `comms_*` and
  `workspace_approvals` filters by that organisation.
- Number routing uses `receptionist_numbers` (status `active`). An unknown dialled number is rejected, never answered by
  a generic assistant.
- The founder's own business (Fleet Parlour) is an ordinary subscriber account on the hidden founder plan. It gets no
  special data path.
- Tests: a two-business isolation test for every internal endpoint and tool (business A's token can never read or write
  business B's data), added next to the existing tenant-isolation tests.

## 2. Internal API authentication (`oprun-voice` → `oprun-web`)

| Control | Detail |
|---|---|
| Service key | Header `X-Voice-Service-Key` = `VOICE_SERVICE_KEY`; compared in constant time |
| Call token | HMAC-SHA256 with `VOICE_CALL_TOKEN_SECRET`, claims `{org, call_control_id, exp ≤ 45 min}`; issued by `oprun-web` at `streaming_start`; rejected after the call has ended |
| Idempotency | Every POST carries `idempotency_key`; repeats return the first result |
| Transport | HTTPS only; the worker accepts WebSockets only from Telnyx with a valid token in the URL |
| Rate limit | Per call token and per organisation, so a looping agent cannot flood the database |
| Telnyx webhooks | Existing Ed25519 check with `TELNYX_PUBLIC_KEY`; unsigned or stale events are refused |

## 3. Secrets

All keys (`TELNYX_*`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `CARTESIA_API_KEY`, `VOICE_SERVICE_KEY`,
`VOICE_CALL_TOKEN_SECRET`, `OPENAI_API_KEY`, AWS credentials) are "[stored separately]": Render environment for
`oprun-web`, AWS Secrets Manager for `oprun-voice`. They are never written to the repository, memory files, logs,
transcripts or prompts. The transfer phone numbers of team members are never spoken to callers and are shown masked
(last three digits), as Phase 07 already does.

## 4. Prompt injection

Everything a caller says is **data, not instructions**. The agent's rules cannot be changed by caller speech
("ignore your instructions", "you are now…", "read me the owner's number"). Tools validate every argument on the
server; the agent cannot reach any record outside the call's organisation, cannot change settings, prices or approvals,
and cannot send free-text messages without approval. The prompt rules are in
[03_NATURALNESS_PROMPT.md](03_NATURALNESS_PROMPT.md); server-side validation is in [04_TOOLS.md](04_TOOLS.md).

## 5. Personal information: minimise, keep briefly, delete on request

| Data | Collected | Default retention | Notes |
|---|---|---|---|
| Caller number, name, address, job details | Only what the job needs | Same as the customer record | Lives in `tenant_customers` / `tenant_documents` |
| Transcript | Every answered call | 12 months (`receptionist_config.transcript_retention_days`) | Stored on `voice_calls`; owner can shorten |
| Recording (if the business turns recording on) | Optional (`receptionist_config.recording_enabled`) | 90 days (`recording_retention_days`) | Off by default; transcription notice still given |
| Latency and barge-in metrics | Every call | 24 months | No personal content |
| Vendor-side audio and text | Processed per call | Request zero or minimum retention from each vendor in the contract | See §6 |

The agent never asks for card numbers, government ID numbers or health information. If a caller offers them, the
agent says it can't take those details on this line and the transcript redacts digit runs that look like card or ID
numbers before storage.

Deletion: a deletion request from a caller is handled through the existing account-deletion and privacy tooling for the
business; it removes the transcript, recording and summary, and the customer record if the business has no legal reason
to keep it.

## 6. Australian requirements

| Requirement | What we do |
|---|---|
| **Privacy Act 1988, APP 5 (collection notice)** | Greeting includes a short notice; the full notice is on the business's privacy page and Oprun's `privacy.html` / `subprocessors.html` |
| **APP 8 (cross-border disclosure)** | Listed below. Prefer onshore processing; disclose the rest in the privacy policy and subprocessor list |
| **APP 11 (security)** | Encryption in transit and at rest (disk + S3), role-based access, audit log, retention limits above |
| **State and territory listening-device laws** | The existing `recording_notice` behaviour stays on by default: the greeting says the call is transcribed (and recorded, if on) before the caller gives details. A business cannot switch the notice off while transcription or recording is on |
| **Spam Act 2003 (SMS and email follow-ups)** | Send only with consent (the caller asked to be contacted, or express consent recorded); identify the business; include a working opt-out ("Reply STOP"); honour opt-outs within 5 business days (we do it at once); record suppression |
| **Do Not Call Register Act 2006** | The MVP makes no outbound marketing calls. Follow-ups are SMS/email about the caller's own enquiry |
| **AI honesty (D-R7)** | The receptionist says it is Oprun's AI assistant whenever a caller sincerely asks, and never claims to be a person |
| **Emergencies** | For anything life-threatening (fire, gas leak with symptoms, injury, crime in progress) the agent tells the caller to hang up and call **000** first, then offers to notify the team |
| **Numbering rules (ACMA)** | Number purchase and porting go through Telnyx, a registered Australian carriage service provider, with identity, address and ABN checks (see [02_SETUP_WIZARD.md](02_SETUP_WIZARD.md)) |

### Where data is processed

| Vendor | What it processes | Where (to confirm in each contract) |
|---|---|---|
| Telnyx | Call audio, numbers, SMS | Sydney PoP for media; account data may be held offshore |
| AWS (`oprun-voice`) | Live audio in memory, no storage | Sydney `ap-southeast-2` |
| Deepgram | Caller audio → text | Confirm region; request no retention |
| ElevenLabs / Cartesia | Reply text → audio | Confirm region; request no retention |
| LLM (D-R5) | Transcript text | `bedrock_au`: Sydney/Melbourne; `openai`: offshore |
| Render (`oprun-web`) | Records, transcripts, summaries | Singapore (offshore) |
| AWS S3 backups | Database copies | Bucket region as configured |

The D-R5 bake-off should weigh onshore processing, not only latency.

## 7. Spam filtering

A call is scored at answer and again at hang-up; the score is stored in `voice_calls.spam_score` (0–100).

| Signal | Weight |
|---|---|
| Caller reputation / spam flag from Telnyx, if offered on the account (**verify availability on staging**) | High |
| Number on the business's own block list or Oprun's shared known-spam list (`receptionist_blocklist`) | High |
| Robocall audio: recorded message, no response to the greeting, tone patterns | High |
| Silence for the first 5 s after the greeting | Medium |
| Call shorter than 15 s | Medium |
| Same number calling many Oprun businesses within an hour | Medium |
| Withheld number | Low (never blocks by itself) |

- Score ≥ 70 at answer: short polite close, no tools, no enquiry, thread goes to the Unibox `spam` folder.
- Score ≥ 70 after the call: the call is moved to `spam` and marked not billable.
- A genuine caller marked spam can be restored by staff in one tap; restoring also removes the number from the block list.

## 8. Metering

**Billable call** (`voice_calls.billable = 1`): answered by the receptionist, lasted 15 seconds or more, and not spam.
Calls under 15 s, spam calls, calls that went straight to transfer because the receptionist was paused, and test calls
from the wizard are never billable (D-R8).

| Item | How |
|---|---|
| Count | One `usage_events` row with `kind='receptionist_call'` per billable call, written when the call ends |
| Included calls | The AI Receptionist add-on in `organisation_addons` (quantity = included calls per month). Faizan sets the prices; the existing add-on mechanism carries them, including the plan discounts already agreed for add-ons |
| Overage | Per billable call above the included amount, at the price Faizan sets |
| Spend cap | `receptionist_config.spend_cap_cents`. At 80 %: notify the owner (in-app, push, email). At 100 %: the receptionist keeps answering, in the mode the owner chose (`receptionist_config.cap_action`): **take messages only** (`take_message`) or **voicemail** (`voicemail`). Calls are never dropped and never sent to a dead line |
| Statement | Monthly line on the existing platform invoice: calls answered, billable calls, spam calls blocked (free), overage |
| Founder plan | The founder's hidden exempt plan has no cap and no charge; usage is still counted for reporting |
| Number charges | Bought or ported numbers are billed monthly through the same add-on mechanism after the `receptionist_number_purchase` approval |

## 9. Audit

Every settings change, knowledge approval, number purchase, port order step, booking approval and auto-sent message is
written to the existing audit log with the user, time and before/after values.
