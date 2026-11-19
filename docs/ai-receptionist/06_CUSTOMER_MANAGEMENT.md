# 06 Customer management from calls

Output #6. How the receptionist decides new vs existing customer, which fields a call may change, de-duplication,
withheld caller ID, shared numbers, consent and audit. All customers are rows of the existing `tenant_customers`
table (`id, organisation_id, name, email, phone, address, notes, status lead/current/past, source,
created_by_user_id, created_at, updated_at`). The legacy single-tenant `customers` table is never used (contract §1).
The tool schema is in `04` §3.2.

## 1. Principles
1. Never merge two customers automatically. A wrong merge leaks one person's details to another; a duplicate is
   only untidy. When unsure, create or keep separate and flag for review.
2. A call can add information; it never silently replaces what staff entered.
3. The agent never reads stored details back to a caller that the caller has not said in this call (privacy: the
   caller ID alone does not prove who is speaking).
4. Every change is audited with the call it came from.

## 2. Matching order (new vs existing)

Normalisation uses the existing helpers: `normPhone()` from `src/comms/service.js` (gives `+61…` for AU mobiles and
landlines) and lower-cased, trimmed email (`normEmail` in the same file).

| Step | Key | Rule | Result |
|---|---|---|---|
| 1 | Phone (caller ID, or a `phone` the caller read back) | Exact match on `normPhone(tenant_customers.phone)` within the organisation. Existing data may be stored in other formats, so the query compares normalised values (the existing `customerFor()` matches on the last 9 digits; the receptionist keeps that query as a candidate filter and then requires an exact `normPhone` equality) | 0 → step 2. 1 → **existing**. 2 or more → shared number (§5) |
| 2 | Email (only if the caller gives one) | Exact match on lower-cased `email` | 1 → **existing** (and the phone is added per §3). 0 → step 3. 2+ → duplicate candidate, use the most recently updated one and flag |
| 3 | Name + suburb | Case-insensitive name similarity ≥ 0.85 (token-sorted) **and** the same suburb in `address` | Never a match on its own. Create a **new** customer and record a duplicate candidate (§7) |
| 4 | Nothing matched | — | **New** customer |

A spoken name that clearly differs from a single phone match ("This is Raj" vs stored "Mary Chen") is treated as a
shared number (§5), not as a rename.

## 3. Fields a call may write

| Field | New customer | Existing customer |
|---|---|---|
| `name` | Caller's name as said (spelling confirmed for unusual names) | Filled only if empty or a placeholder ("Unnamed caller"). A correction ("it's spelt with a K") updates it and is audited with the old value |
| `phone` | Caller ID, or the read-back number if the ID is withheld or the caller asks to be called on another number | Never overwritten. A different number is appended to `notes` as "Also reachable on …" and shown to staff as a suggestion |
| `email` | As given (read back) | Filled if empty; a different one goes to `notes` as a suggestion |
| `address` | As given | Filled if empty; a different one goes to `notes`. The job address always goes on the enquiry/booking, so a different service address is normal and is not a conflict |
| `notes` | `[YYYY-MM-DD AI call] <facts stated>` | **Append-only**, one dated line per call, total `notes` kept within the existing 4000-character API limit by trimming the oldest AI lines first (never staff lines) |
| `status` | `lead` | Never downgraded. `lead` or `past` → `current` only when a booking is created (`createBookingFromEnquiry`, `04` §3.4). Calls never set `past` |
| `source` | `receptionist` | Unchanged |
| `caller_note` (new column, ≤ 300 chars) | Empty | Never written by a call. Staff write it for the receptionist to use ("Prefers to be called Bob; gate code is given on the day"). It is the **only** customer note that may reach `{{CALLER_CONTEXT}}`; `notes` stay private (07 §7) |
| `created_by_user_id` | `NULL` (system) | Unchanged |

Everything else about the call (transcript, summary, intent) lives on `voice_calls`, the enquiry and the Unibox
thread, not on the customer row.

## 4. Withheld or missing caller ID

- Telnyx `from` is empty, `anonymous`, `private` or not a number → no phone matching.
- The agent asks for a callback number and reads it back before calling `create_or_update_customer` with `phone`.
  Matching then uses that number (step 1). The number is marked as caller-stated in the dated note line
  ("number given by caller, not verified by caller ID").
- If the caller refuses: a customer is created only once a name is given; the enquiry can still be created; follow-ups
  are impossible without a channel and the follow-up row moves to `HANDED_TO_STAFF` at call end.
- Emergency with no name (`04` §3.3): the server creates `name = 'Unnamed caller'` with the caller ID (or no phone),
  so the enquiry can be saved at once; the row is flagged for review.
- Unibox: `recordInbound` needs a contact address, so a withheld call is filed under
  `'withheld:' + call_session_id` (`04` §3.8). That gives one thread per withheld call, linked to the customer through
  `comms_thread_meta.customer_id`, so the customer page still shows all of them.

## 5. Several people on one number

Common for households and small offices.
- Phone matches 2+ customers → the agent asks the name ("And who am I speaking with?") and picks the candidate whose
  name matches (similarity ≥ 0.85). No match → a **new** customer with the same phone, plus a duplicate candidate
  record linking it to the others (so staff can see "shares a number with …").
- Phone matches one customer but the spoken name differs → the same: new customer sharing the number, flagged. The
  existing customer is not changed.
- The agent never says the other person's name first ("Is this Mary?" is not allowed); it only uses a name the
  caller said.

## 6. Consent for follow-up messages

- During the call, before any follow-up, the agent asks once: "Is it OK if we text you about this?" (or email). Only
  a clear yes sets `sms_consent` / `email_consent` in `create_or_update_customer`.
- Stored through the existing `consent(owner, channel, address, { status: 'granted', source: 'receptionist_call',
  evidence, customer_id }, null)` in `src/comms/service.js`, which writes `marketing_consents` (`owner_key` =
  organisation id, `channel` `sms`/`email`, normalised address) and clears earlier unsubscribe-type suppressions.
  `evidence` = `"Said yes on a call <call_session_id> at <ISO time>: '<caller's words, ≤120 chars>'"`.
- A "no" is not stored as a withdrawal (they may have consented elsewhere); the agent simply does not send. If the
  caller says "don't text me", the agent calls `create_or_update_customer` with `sms_consent=false` and the server
  calls the existing `suppress(org, 'sms', phone, 'manual', 'receptionist_call', null)`.
- STOP replies and unsubscribe links keep working exactly as today (`onInbound` → `suppress`).
- Scope note: this consent covers messages about the caller's own enquiry. It does not opt them into marketing
  campaigns; the campaign audience rules are unchanged.

## 7. De-duplication and the review queue

- Inbox-level duplicates are already detected by the existing `duplicates()` in `src/comms/ai.js`
  (`same_person_other_channel`, `repeated_message`, `several_customers`) and stored in
  `comms_thread_meta.duplicates_json` by `analyse()`. The receptionist reuses this: after `merge_to_unibox`, a phone
  that matches several customers already produces a `several_customers` entry.
- Customer-level candidates from §2 step 3 and §5 are written to a new table `receptionist_duplicate_candidates`
  (`id, organisation_id, customer_id, other_customer_id, reason ('shared_phone','similar_name_suburb','email_multi'),
  call_control_id, status ('open','merged','dismissed'), decided_by, decided_at, created_at`; unique on the ordered
  pair). Listed under NEW NAMES.
- Review: Customers screen shows "Possible duplicates (n)". Staff choose **Merge** or **Not the same**.
- Merge is a new endpoint `POST /api/saas/customers/:id/merge` (senior roles; there is no merge today): moves
  `tenant_documents.customer_id`, `work_orders.customer_id`, `comms_thread_meta.customer_id`,
  `marketing_consents.customer_id`, `receptionist_followups.customer_id` and `voice_calls.customer_id` from the
  removed record to the kept one in one transaction, fills the kept record's empty fields, appends the removed record's
  notes, keeps the higher status (`current` > `past` > `lead`), deletes the removed row and audits both ids. It needs
  the same tenant check on both ids.
- "Not the same" sets `status='dismissed'`; the pair is never suggested again.

## 8. Audit trail

Every write uses the existing `saasAudit(req, eventType, entityType, entityId, detail)` with the system actor
`receptionistActor(org)` (`04` §1.2), so it lands in the audit log and the governance ledger like any staff action.

| Event | Entity | Detail |
|---|---|---|
| `receptionist.customer_created` | `customer` | `call_control_id`, fields set |
| `receptionist.customer_updated` | `customer` | `call_control_id`, field → old/new (notes: appended line only) |
| `receptionist.consent_recorded` | `customer` | channel, granted/suppressed, evidence |
| `receptionist.duplicate_flagged` | `customer` | other id, reason |
| `customer.merged` (staff action) | `customer` | kept id, removed id, moved references count |

Personal data in audit detail is limited to field names and the changed values needed to undo a mistake; transcripts
are never copied into the audit log.

## 9. Tests that must exist before go-live
1. Caller ID matching one customer → no new row; notes gain one dated line; name/phone unchanged.
2. Same number, different spoken name → new customer + one `receptionist_duplicate_candidates` row; the original
   customer is untouched.
3. Name + suburb similar, different phone → new customer + candidate; never merged.
4. Withheld ID, caller gives a number that matches → existing customer used; note says "not verified by caller ID".
5. `status='past'` customer calls → stays `past` until a booking, then `current`; never set to `lead`.
6. Consent yes → `marketing_consents` row with evidence; "don't text me" → suppression; no follow-up SMS is queued.
7. Merge moves every reference listed in §7 and leaves no row pointing at the removed id; cross-tenant merge is refused.
