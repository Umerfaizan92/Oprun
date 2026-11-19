# 07 Knowledge auto-load from Oprun records

Owner of this file: what the receptionist knows, where each fact comes from, how it is approved and refreshed, and how
it reaches the live call. Names come from [00_CONTRACT.md](00_CONTRACT.md). The system prompt template that receives
the two blocks is owned by [03](03_NATURALNESS_PROMPT.md); the `call-context` endpoint and caching by
[01](01_ARCHITECTURE.md); customer matching by [06](06_CUSTOMER_MANAGEMENT.md); privacy rules by
[08](08_SECURITY_COMPLIANCE_METERING.md). The owner reviews the facts in wizard Step 2 ([02](02_SETUP_WIZARD.md)).

## 1. Two blocks, two lifetimes

| Block | Placeholder in the prompt (03) | Built | Size budget | Scope |
|---|---|---|---|---|
| Business facts | `{{BUSINESS_FACTS}}` | Ahead of time, approved by the owner, stored as `receptionist_knowledge.prompt_block` | ≤ ~2,500 tokens | Same for every caller of the business |
| Caller context | `{{CALLER_CONTEXT}}` | At call start by `GET /api/internal/voice/call-context` | ≤ ~400 tokens | Only this caller; empty for unknown numbers |

Only these two placeholders carry Oprun data into the prompt. Nothing else from the database is injected.

## 2. What is pulled for business facts (verified sources in the repository)

| Topic | Source table and fields | Notes |
|---|---|---|
| Business name and identity | `organisations` (`name` / `display_name`, `legal_name`, `state`, `postcode`, `timezone`) | ABN is never spoken unless a caller asks for it for an invoice |
| Business type, contact, website, service area, services list, brand voice, owner's AI instructions | `onboarding_profiles` (`business_type`, `phone`, `website`, `service_area`, `services` JSON array of names, `brand_voice`, `ai_instructions`) | `services` holds names only, no prices |
| Services and areas used for SEO | `seo_profiles` (`services_json`, `areas_json`) when present | Merged with onboarding services, de-duplicated by name |
| Existing receptionist wording | `tenant_receptionist_profiles` (`greeting`, `knowledge`, `hours`, `timezone`) — **approved/`status` non-draft revision only** | Migrated once into the first knowledge revision; then read-only (see 09) |
| Hours and time zone | `receptionist_config.hours_json`, `timezone` | Spoken in the business's local time |
| Bookable services, durations, "from" prices, service area for bookings | `receptionist_config.booking_rules_json` (wizard Step 4) | **The only source of prices the receptionist may say.** Oprun has no tenant price list today (the `service_catalog` table is legacy single-tenant and is never read) |
| What the business typically does | Aggregates over `work_orders` and `tenant_documents` (`kind='booking'`, `kind='quote'`) of the last 12 months: most common job titles (top 10), typical duration (median `estimated_hours`), suburbs served (top 15 suburbs or postcodes from job addresses, suburb only) | Aggregates only. A suburb appears only if it has 3 or more jobs. No names, street addresses, prices or dates of individual jobs |
| Common questions and answers | Owner-written FAQ cards from wizard Step 2, plus questions extracted from the last 90 days of Unibox `comms_messages` inbound text **as question themes only** (for example "Do you work weekends?"), each needing an owner-written answer before it is used | Extracted themes without an owner answer are shown as "Needs your answer" and are not included |
| Transfers | `receptionist_config.transfer_targets_json`, `transfer_when`; live availability from `staff_availability` is read at transfer time by `warm_transfer` (04), not stored in facts | The facts only say "I can try to put you through to the team during business hours" |

## 3. What is never included

- Any other customer's personal information: names, phone numbers, emails, street addresses, job history, messages,
  invoices or payments. Aggregates follow the 3-job minimum above.
- Internal costs, margins, labour rates, materials costs, profit, staff pay (`work_orders.materials_cents`,
  `labour_rate_cents`, profit figures).
- Private phone numbers, private emails, home addresses, transfer numbers (only "the team" is said), the founder
  account or Fleet Parlour data.
- Prices from past quotes or invoices. Only owner-entered "from" prices in `booking_rules_json` are said.
- Staff names unless the owner marked them as "OK to say" on the transfer list.
- Anything from documents uploaded for compliance (worker documents, VEVO, identity files).

The extraction prompt repeats these exclusions, and a final rule-based filter removes any phone number, email or
street-address pattern from `facts_json` that is not the business's own public contact detail.

## 4. Extraction pipeline (`oprun-web`)

1. **Trigger:** wizard Step 2, "Rebuild" on the Knowledge tab, or the nightly job (§5). Creates a
   `receptionist_knowledge` row: next `revision`, `status='draft'`.
2. **Collect:** read the sources in §2 for the session's organisation only; compute aggregates in SQL.
3. **Write facts:** call the existing `generateAiText` (OpenAI path in `ai-provider-shim.js`) with the collected
   material marked as untrusted data and the instruction to return JSON only. Output shape, stored in `facts_json`:
   ```json
   {
     "business": {"name": "...", "type": "...", "area_summary": "...", "website": "..."},
     "hours": [{"days": "Mon-Fri", "open": "07:00", "close": "17:00"}],
     "services": [{"name": "...", "summary": "...", "bookable": true, "duration_min": 60, "price_from_cents": null}],
     "service_area": {"suburbs": ["..."], "note": "..."},
     "faqs": [{"q": "...", "a": "..."}],
     "policies": [{"topic": "call-out fee", "text": "..."}],
     "transfers": {"available": true, "when": "on_request"}
   }
   ```
   Every fact carries `source` entries (table and, for aggregates, the count) in `sources_json`, so the owner sees
   "From 42 past jobs" and reviewers can trace each line.
4. **Filter:** the rule-based filter in §3 runs on the JSON. If the AI call fails, the build falls back to a
   template-only revision made directly from the structured sources (no generated summaries) so setup never stalls.
5. **Owner review:** wizard Step 2 or the Knowledge tab shows the facts as cards. Edits update the draft. "Approve"
   creates the `receptionist_knowledge` approval (always required, contract §7).
6. **Approve:** on approval, `status='approved'`, `approved_by`, `approved_at` set; the previous approved revision
   becomes `superseded`; `receptionist_config.knowledge_revision` is set to the new revision; the `prompt_block` is
   rendered (§6).
7. **Audit:** every build, edit and approval is written to the audit trail with the revision number.

## 5. Refresh rules

- **Mark stale:** when any source in §2 changes (onboarding profile saved, booking rules saved, hours changed, a FAQ
  edited, a job completed), the Knowledge tab shows "Changes since you last approved". No live change happens.
- **Nightly draft:** at 2 am business time, if the approved revision is stale, a new draft is built. The owner gets one
  notification per day at most: "Your receptionist's knowledge has 3 updates to approve".
- **Only approved revisions go live.** The live call always uses `receptionist_config.knowledge_revision`. A draft is
  never used on a call, including test calls before the first approval (test calls before Step 2 use the draft with a
  visible "Unapproved draft" label in the test screen).
- **Hours and booking-rule changes** made in Settings take effect on the next call without re-approval, because the
  owner typed them directly; the prompt_block is re-rendered from the approved facts plus the new structured values,
  and the knowledge revision number is unchanged.
- Rollback: the Knowledge tab can re-approve any `superseded` revision.

## 6. Rendering `prompt_block` (the `{{BUSINESS_FACTS}}` value)

Plain text, short lines, written for speech (times as "seven in the morning to five in the afternoon", prices as
"from one hundred and twenty dollars"), in this fixed order so trimming is predictable:

1. Business: name, what it does, one-sentence area summary.
2. Hours (with time zone) and public holidays note.
3. Bookable services with duration and "from" price if set.
4. Other services (not bookable on a call: take a message).
5. Service area.
6. Policies (call-out fee, payment, warranty) exactly as the owner approved.
7. FAQs with answers.
8. Transfers.

**Budget:** ≤ ~2,500 tokens (counted with the live LLM's tokenizer at render time). If over budget, trim from the end
of section 7, then shorten section 4 to names only, then section 5 to the summary; the Knowledge tab shows what was
trimmed. Sections 1–3 are never trimmed.

## 7. The per-caller block (`{{CALLER_CONTEXT}}`)

Built at call start by `GET /api/internal/voice/call-context` (01) from the caller's number, after matching the
caller to `tenant_customers` of this organisation only (matching rules in 06). Cached in the worker for the call; not
refreshed mid-call except after `create_or_update_customer` returns (04).

Contents for a matched customer:
- First name (and how they prefer to be called, if noted).
- Customer status (`lead`, `current`, `past`).
- Last 3 jobs: job title and month only ("Hot water service, March"), no prices.
- Open enquiry, if any: title, its follow-up state (contract §6.1), any booking held or waiting for approval.
- The customer's `caller_note` (the one note staff wrote for the receptionist to use, rule in 06). `notes` are
  never included.
- Up to two open Unibox items from this number in the last 14 days, as one-line summaries ("Asked for a quote by text
  on Tuesday").

For an unknown or withheld number: the block is the single line `Caller not recognised.` The caller is never told who
the number belongs to; the receptionist confirms identity by asking, not by announcing (03).

If two or more customers share the number, the block says `Number shared by more than one customer: ask the caller's
name.` and includes no details until the caller confirms who they are (06).

## 8. How both blocks enter the prompt

The template in 03 contains exactly one `{{BUSINESS_FACTS}}` and one `{{CALLER_CONTEXT}}`. The worker:
1. receives `business_facts` (the approved `prompt_block`, with `knowledge_revision`) and `caller_context` from
   `call-context` at call start;
2. substitutes them verbatim, each wrapped in delimiters that mark them as data, not instructions:
   `<business_facts revision="12"> … </business_facts>` and `<caller_context> … </caller_context>`;
3. never concatenates anything else from Oprun into the system prompt.
The call record stores `knowledge_revision` in `voice_calls.summary_json` so every answer can be traced to the facts
it was given.

## 9. The long tail

Facts beyond the budget, and anything per caller, are not stuffed into the prompt. When a caller asks something the
facts don't cover, the receptionist says it will check with the team and takes a message (03); the question is saved
as a "Needs your answer" theme for the next knowledge revision.
