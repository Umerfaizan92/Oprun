# 04 Tool definitions (live-call function calling)

Output #4. Exact schemas and server behaviour for the tools the voice agent may call. Names, approvals, message
classes and states come from `00_CONTRACT.md` (§7, §8, §10, §6). Architecture is in `01`, the agent's speaking rules
in `03`, the follow-up machine in `05`, customer matching rules in `06`.

## 1. Rules that apply to every tool

### 1.1 Transport
- The agent (in `oprun-voice`) calls a tool. The worker sends
  `POST {OPRUN_WEB_BASE_URL}/api/internal/voice/tools/<tool_name>` with headers `X-Voice-Service-Key` and
  `Authorization: Bearer <call token>` (contract §11). Body: `{ "args": {...}, "turn_index": n, "idempotency_key": "..." }`.
- `idempotency_key = sha256(call_control_id + tool_name + turn_index)`. `oprun-web` stores the first response for
  each key in `voice_calls`-scoped memory (table `receptionist_tool_calls`, see NEW NAMES) for 24 h and returns the
  same response for a repeat. A retry can never create a second customer, enquiry, approval or message.

### 1.2 Security
- The organisation and the call come **only** from the call token. Nothing in `args` names an organisation.
- Tools never accept record ids from the model, except two that are validated: `slot_id` (signed by `oprun-web`,
  see §4) and `target_user_id` (must be a member of the token's organisation and listed in `transfer_targets_json`).
  The customer and enquiry for the call are read from `voice_calls.customer_id / enquiry_id`, which only `oprun-web`
  sets.
- All text from the caller is untrusted data. Server code treats `args` as data; it never follows instructions found
  in them (existing rule in `src/comms/voice.js` `instructions()`).
- Internal actor: server-side writes run as the system actor returned by the new helper `receptionistActor(org)`, a
  request-shaped object `{ saas: { organisation_id: org, user_id: null, full_name: 'AI Receptionist', role: 'system' },
  ip: null, get: () => 'oprun-voice' }` so the existing `createWorkspaceApproval(req, …)` and `saasAudit(req, …)`
  (both in `src/server.js`) work unchanged. `created_by` text columns use `'ai_receptionist'`, the same pattern as
  `'website_form'` in `src/comms/service.js`.

### 1.3 Response envelope (what the agent receives)

```json
{ "ok": true, "code": "OK", "data": { }, "speak": "short plain-English hint, at most 20 words" }
```

`speak` is a hint the agent paraphrases in its own words (rules in `03`). It never contains internal ids, private
phone numbers, prices that are not in the approved knowledge, or the word "tool".

### 1.4 Error codes (shared)

| `code` | Meaning | What the agent says (paraphrased) |
|---|---|---|
| `ERR_TOKEN` | Call token missing, wrong or expired | Nothing technical. Switch to `take_message` behaviour: "Let me grab your details and someone will call you back." |
| `ERR_VALIDATION` | Arguments missing or wrong | Ask the caller for the missing detail named in `data.missing` |
| `ERR_PRECONDITION` | A required earlier step is missing (for example no customer yet) | Ask for the missing detail ("Can I grab your name first?") |
| `ERR_CONFLICT` | The slot was taken or the hold expired | "Ah, that one's just gone. The next one I have is…" then offer `data.alternatives` |
| `ERR_NOT_ALLOWED` | The business has switched this off (for example booking or transfer) | "I can't lock that in myself, but I'll get the team to call you to confirm." |
| `ERR_TIMEOUT` | Server did not answer within the tool budget | Same as `ERR_TOKEN` path; the worker records the failure on the call |
| `ERR_INTERNAL` | Anything else | Same as `ERR_TOKEN` path |

A failed tool never makes the agent say that something was booked, saved or sent. Success is claimed only when
`ok:true` (same rule as `BUSINESS_RECEPTIONIST_AI_INSTRUCTIONS` today).

### 1.5 Time budgets
The worker starts a filler phrase ("Let me check that for you…", rules in `03`) the moment a tool with a budget over
300 ms starts. If the budget passes, the worker abandons the call and treats it as `ERR_TIMEOUT`.

| Tool | Budget | Runs |
|---|---|---|
| `check_availability` | 1200 ms | Live |
| `create_or_update_customer` | 800 ms | Live |
| `create_enquiry_lead` | 1000 ms | Live |
| `propose_booking` | 1500 ms | Live |
| `warm_transfer` | 800 ms to start; ringing runs asynchronously (25 s) | Live |
| `take_message` | 800 ms | Live |
| `end_call` | 300 ms | Live |
| `merge_to_unibox` | 1000 ms | Normally after the call (contract §10) |
| `draft_followup` | 1500 ms | Normally after the call (contract §10) |

## 2. Order the agent follows

```
greeting → understand need → create_or_update_customer (once a name is known)
        → create_enquiry_lead (once the need is clear)
        → check_availability → caller picks a time → propose_booking
        → (if needed) warm_transfer or take_message
        → end_call
after the call (oprun-web): merge_to_unibox → draft_followup / follow-up machine (05)
```

`create_enquiry_lead` needs a customer on the call. For `urgency = emergency` it does not wait: the server creates
the customer from the caller ID (rules in `06`).

## 3. Schemas and behaviour

All schemas are JSON Schema 2020-12 objects used as the `parameters` of an OpenAI- or Bedrock-style function
definition. Every object has `"additionalProperties": false`.

### 3.1 `check_availability`

**When:** the caller wants a visit or appointment and the service is known. Not before `create_enquiry_lead`.

```json
{
  "name": "check_availability",
  "description": "Find up to three open appointment times for a service. Use after the caller says what they need and roughly when.",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "service_id": { "type": "string", "description": "Service id from the business knowledge, if known." },
      "service": { "type": "string", "maxLength": 120, "description": "Service in the caller's words, if no id." },
      "date_from": { "type": "string", "format": "date", "description": "Earliest day, YYYY-MM-DD, business time zone." },
      "date_to": { "type": "string", "format": "date", "description": "Latest day, YYYY-MM-DD. At most 21 days after date_from." },
      "suburb": { "type": "string", "maxLength": 80 },
      "duration_minutes": { "type": "integer", "minimum": 15, "maximum": 600 }
    },
    "required": ["date_from", "date_to"],
    "anyOf": [ { "required": ["service_id"] }, { "required": ["service"] } ]
  }
}
```

**Server (`oprun-web`):**
1. Read `receptionist_config` for the token's organisation. If `booking_rules_json` has no bookable services or
   `status != 'live'`, return `ERR_NOT_ALLOWED`.
2. Resolve the service: `service_id` against the services in `booking_rules_json` (written by the wizard, `02`);
   else match `service` to a service name or alias (case-insensitive, then the closest name). No match →
   `ERR_VALIDATION` with `data.missing = ["service"]` and `data.services` = the speakable list.
3. If `suburb` is given and the business has service areas, check it is covered. Not covered →
   `ok:true, data.slots = [], data.out_of_area = true`.
4. Duration = `duration_minutes`, else the service's duration from `booking_rules_json`, else 60.
5. Candidate slots = `booking_rules_json.bookable_hours` (or, when null, `receptionist_config.hours_json`) in
   `receptionist_config.timezone`, cut into the service duration plus `buffer_min`, within `date_from…date_to` and
   `window_days`, not earlier than now + `lead_time_hours` (shape: [00_CONTRACT.md §5.1](00_CONTRACT.md#51-receptionist_configbooking_rules_json-one-shape-used-by-02-04-and-07)).
6. Remove busy time, all filtered by `organisation_id`:
   - `tenant_documents` where `kind='booking'` and `status` not `cancelled`: `start_at` + duration. A booking with a
     `work_order_id` is counted through its job instead, so it is not counted twice.
   - `work_orders` (not `cancelled`): `start_at` to `start_at + estimated_hours` (default the service duration).
   - `receptionist_slot_holds` where `expires_at > now`.
   - Capacity: the number of crews in `booking_rules_json` (default 1). For **today only**, also reduce capacity by
     members whose `staff_availability.status` is `unavailable`, `on_leave` or `day_off`
     (`staff_availability` is a current status, not a calendar).
7. Pick up to 3 slots: honour `preferred_times` from the call's enquiry if present, then spread them (not three
   back-to-back on one morning).
8. Each slot gets `slot_id = base64url(payload) + "." + HMAC-SHA256(payload, VOICE_CALL_TOKEN_SECRET)` where
   payload = `{ org, call_control_id, service_key, start_at, end_at, exp: now + 15 min }`. Opaque to the agent.
9. Nothing is held yet. Holds are created by `propose_booking`.

**Returns:**
```json
{ "ok": true, "code": "OK",
  "data": { "service": "Blocked drain", "slots": [
    { "slot_id": "eyJ…", "label": "Tuesday the 24th at 9 am", "start_at": "2026-11-24T09:00:00+08:00", "end_at": "2026-11-24T10:00:00+08:00" } ],
    "out_of_area": false },
  "speak": "I've got Tuesday at 9, Tuesday at 2, or Wednesday at 10." }
```
`label` is written for speech: day name, date as "the 24th", time as "9 am" / "half past 2", no year, no time zone
unless the caller is in a different one.

### 3.2 `create_or_update_customer`

**When:** as soon as the caller gives a name, and again when they give or correct contact details or agree to be
texted or emailed. Matching and update rules are owned by `06_CUSTOMER_MANAGEMENT.md`.

```json
{
  "name": "create_or_update_customer",
  "description": "Save or update the caller's details. Call once you know their name, and again if they give or correct a detail.",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "name": { "type": "string", "minLength": 1, "maxLength": 160 },
      "phone": { "type": "string", "maxLength": 40, "description": "Only if different from the caller ID or the caller ID is hidden. Read it back first." },
      "email": { "type": "string", "maxLength": 254 },
      "address": { "type": "string", "maxLength": 300 },
      "notes": { "type": "string", "maxLength": 1000, "description": "Facts the caller stated that help the business. No guesses." },
      "sms_consent": { "type": "boolean", "description": "True only if the caller said yes to being texted about this enquiry." },
      "email_consent": { "type": "boolean", "description": "True only if the caller said yes to being emailed about this enquiry." }
    },
    "required": ["name"]
  }
}
```

**Server:**
1. Normalise the caller ID and `phone` with the existing `normPhone()` (`src/comms/service.js`, gives `+61…`).
2. Find the customer with the match order in `06` §2 (phone, then email, then flag-only name match).
3. New → insert `tenant_customers` (`status='lead'`, `source='receptionist'`, `created_by_user_id=NULL`). Existing →
   apply the field rules in `06` §3 (fill empty fields, append dated notes, never overwrite or downgrade).
4. Set `voice_calls.customer_id`.
5. Consent → existing `consent(org, 'sms'|'email', address, { status:'granted', source:'receptionist_call',
   evidence, customer_id }, null)` in `src/comms/service.js` (details in `06` §6).
6. `saasAudit(receptionistActor(org), 'receptionist.customer_created' | 'receptionist.customer_updated',
   'customer', id, { call_control_id, fields })`.

**Returns:** `{ ok, data: { known_customer: bool, first_name, needs_phone: bool }, speak }`. `needs_phone` is true
when the caller ID is withheld and no `phone` was given. The agent may greet a known customer by first name; it never
reads out stored details the caller has not said in this call.

### 3.3 `create_enquiry_lead`

**When:** once the caller's need is clear (service and a short description). Exactly once per call; a second call
updates the same enquiry.

```json
{
  "name": "create_enquiry_lead",
  "description": "Record what the caller needs as an enquiry for the business. Call once the need is clear.",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "service": { "type": "string", "minLength": 2, "maxLength": 120 },
      "details": { "type": "string", "maxLength": 4000, "description": "What the caller said, in plain words. No guesses." },
      "urgency": { "type": "string", "enum": ["normal", "soon", "emergency"] },
      "suburb": { "type": "string", "maxLength": 80 },
      "preferred_times": { "type": "string", "maxLength": 300, "description": "The caller's words, e.g. 'weekday mornings'." }
    },
    "required": ["service", "details", "urgency"]
  }
}
```

**Server:**
1. Precondition: `voice_calls.customer_id` set. If not: `urgency='emergency'` → create the customer from the caller
   ID as in `06` §4; otherwise `ERR_PRECONDITION` with `speak: "Can I just grab your name first?"`.
2. If `voice_calls.enquiry_id` is already set → update that enquiry's `body` (append) and return it. No second
   enquiry from one call.
3. De-duplication across calls: if the customer has an enquiry with `kind='enquiry'`, `status IN ('open','quoted')`
   and the same service created in the last 14 days, append a dated "Called again" note to its `body` and reuse it.
4. Otherwise call the existing `pipeline.createEnquiry(org, 'ai_receptionist', { title, details, channel:
   'receptionist', customer_id })` (`src/pipeline.js`). `title = "<service> – <suburb>"` (max 240).
   `details` = caller details + `Urgency: …` + `Preferred times: …` + `Source: AI receptionist call <time>`.
   This creates the `tenant_documents` row (`kind='enquiry'`, `status='open'`) and emits `enquiry.created` (existing).
5. Set `voice_calls.enquiry_id`. Insert `receptionist_followups` (`state='QUALIFYING'`, `enquiry_id` UNIQUE,
   `customer_id`) — transitions in `05`.
6. Lead: the customer row already has `status='lead'` if new. `lead_score/lead_band` are filled after the call by
   the existing `analyse()` when the call is written to the Unibox (`merge_to_unibox`).
7. `urgency='emergency'`: urgent push now via `notifications.notifyRoles(org, ['owner','admin'], { kind:
   'receptionist_emergency', urgent: true, … })` and the follow-up moves to `HANDED_TO_STAFF` at call end (`05`).

**Returns:** `{ ok, data: { reused_existing: bool }, speak: "Got it, I've noted that down." }`.

### 3.4 `propose_booking`

**When:** the caller has clearly agreed to one slot from `check_availability` in this call.

```json
{
  "name": "propose_booking",
  "description": "Book the time the caller agreed to. Only use a slot_id returned by check_availability in this call.",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "slot_id": { "type": "string", "maxLength": 1000 },
      "service": { "type": "string", "maxLength": 120 },
      "address": { "type": "string", "maxLength": 300, "description": "Where the work happens. Read it back first." },
      "notes": { "type": "string", "maxLength": 1000 }
    },
    "required": ["slot_id", "service", "address"]
  }
}
```

**Server:**
1. Verify the `slot_id` HMAC, `exp`, and that `org` and `call_control_id` equal the token's. Any mismatch →
   `ERR_VALIDATION`.
2. Precondition: `voice_calls.enquiry_id` set, else `ERR_PRECONDITION`.
3. In one SQLite transaction: re-check the slot is free (same rules as §3.1 step 6). Taken → `ERR_CONFLICT` with
   `data.alternatives` = up to 2 fresh slots.
4. Insert `receptionist_slot_holds` (`start_at, end_at, call_control_id, enquiry_id`). Hold expiry: 15 min if the
   approval is not created; once the approval exists, `expires_at` = the approval's `expires_at`
   (default: 24 h, or 2 h before the slot if sooner).
5. Branch on `receptionist_config.booking_mode`:
   - `approve` (default): `createWorkspaceApproval(receptionistActor(org), { approval_type: 'receptionist_booking',
     source_module: 'receptionist', title: 'Book <service> for <customer name>', summary: '<spoken label>, <address>',
     entity_type: 'enquiry', entity_id: <enquiry_id>, risk_level: 'normal', draft_payload: { start_at, end_at,
     address, notes, hold_id }, required_role: 'senior', expires_at })`; set `hold.approval_id`. Follow-up →
     `BOOKING_PENDING_APPROVAL`. `speak`: "I've pencilled you in for Tuesday at 9. The team will confirm by text
     shortly."
   - `auto`: call `pipeline.createBookingFromEnquiry(org, 'ai_receptionist', enquiryId, { start_at, end_at,
     address, notes })` (below), delete the hold, follow-up → `BOOKED`. `speak`: "You're booked in for Tuesday at 9."
6. `saasAudit(receptionistActor(org), 'receptionist.booking_proposed' | 'receptionist.booking_created', …)`.

**New pipeline helper (add to `installPipeline` in `src/pipeline.js` and to its return object, next to
`createJobForBooking`):**

```
createBookingFromEnquiry(org, actor, enquiryId, { start_at, end_at, address, notes })
  1. enq = doc(org, enquiryId, 'enquiry'); require enq.status IN ('open','draft','quoted') else throw CONFLICT.
  2. In one transaction:
     a. INSERT tenant_documents (id, organisation_id, kind='booking', customer_id=enq.customer_id,
        title=enq.title, body=notes||'', amount_cents=0, gst_applies=1, gst_cents=0,
        start_at=ISO(start_at), source_id=enq.id, status='booked', channel='receptionist',
        created_by=actor, created_at, updated_at).
        (Price is 0 until a quote or invoice sets it; the job price is set later by the existing job routes.)
     b. jobId = createJobForBooking(org, actor, quoteLike, bookingId, { start_at, address,
        estimated_hours: (end_at - start_at) / 3600000 }), where
        quoteLike = { title: enq.title, customer_id: enq.customer_id, amount_cents: 0, gst_cents: 0,
                      gst_applies: 1, source_id: enq.id }.
        The existing function creates the work_orders row, links tenant_documents.work_order_id and marks the
        enquiry 'booked' (it does so when quote.source_id is set and the enquiry is open/draft/quoted).
     c. UPDATE tenant_customers SET status='current' WHERE id=enq.customer_id AND status IN ('lead','past').
  3. events.emit(org, 'job.booked', { booking_id, work_order_id: jobId, via: 'receptionist' }, { key: bookingId })
     (existing event name; `via` lets the follow-up machine ignore its own bookings, 05 row 18)
  4. return { booking_id, work_order_id: jobId }.
```

The approval route (`POST /api/saas/approvals/:id/decision` in `src/server.js`) gets one new call inside its
transaction, next to `applyApprovalToComms`: `applyApprovalToReceptionist(db, row, status, edited)`. For
`approval_type='receptionist_booking'`: approved → `createBookingFromEnquiry` with the edited payload if the owner
changed the time (the new time is re-checked for conflicts; a conflict fails the decision with 409); rejected or
expired → delete the hold and move the follow-up (`05`).

### 3.5 `warm_transfer`

**When:** the caller asks for a person, the matter is urgent, a complaint needs a person, or the agent cannot help;
and `transfer_when` allows it (contract §5).

```json
{
  "name": "warm_transfer",
  "description": "Connect the caller to a team member after briefing them. Use when the caller asks for a person or it is urgent.",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "reason": { "type": "string", "enum": ["caller_asked", "urgent", "complaint", "cannot_help", "existing_job"] },
      "summary": { "type": "string", "minLength": 5, "maxLength": 200, "description": "One sentence the team member hears before connecting." },
      "target": { "type": "string", "enum": ["owner", "team", "specific"] },
      "target_user_id": { "type": "string", "description": "Only with target=specific; must be in the business's transfer list." }
    },
    "required": ["reason", "summary", "target"]
  }
}
```

**Server:**
1. Rules: `transfer_when='never'` → `ERR_NOT_ALLOWED`. `transfer_when='urgent'` → allowed only for
   `reason IN ('urgent','complaint')`. Outside business hours (existing `openNow(hours, timezone)` in
   `src/comms/voice.js`) → `ERR_NOT_ALLOWED` unless `reason='urgent'` and the owner allowed after-hours urgent
   transfers in `transfer_targets_json`.
2. Pick numbers from `transfer_targets_json` (`owner` → the owner entry; `team` → the team list in order;
   `specific` → `target_user_id`, which must be listed). The numbers never leave `oprun-web`.
3. Return immediately `{ ok:true, data:{ status:'ringing' }, speak: "I'll just see if they're free, one moment." }`.
   The agent keeps the caller company (short check-ins every ~8 s, rules in `03`).
4. Asynchronously, with Telnyx Call Control (endpoint names to be confirmed on a staging number, as for Phase 07):
   a. Dial the team member: `POST /calls` with `connection_id=TELNYX_CONNECTION_ID`, `to=<target>`,
      `from=<business primary number>`, `timeout_secs=25`, `client_state={purpose:'rx_whisper', parent:<call_control_id>}`.
   b. On `call.answered` of that leg: speak the whisper "AI receptionist: <customer first name> about <summary>.
      Press 1 to take the call, or hang up to let me take a message." and gather one DTMF digit (8 s).
   c. Digit `1` → stop the media stream on the caller leg and bridge the two legs (`actions/bridge`); set
      `voice_calls.transferred_to_human=1`, `stage='transferring'`; tell the worker `transfer_connected` (the worker
      says "Putting you through now" just before the bridge).
   d. No answer, voicemail detected, hang-up or any other digit → hang up that leg, try the next target in the team
      list, then tell the worker `transfer_failed`. The agent says "They're tied up right now. Let me take a message
      and they'll call you straight back." and calls `take_message`.
5. The existing blind `transfer()` in `src/comms/voice.js` stays as the fallback when the worker is down (contract §6.2).

### 3.6 `take_message`

**When:** a transfer failed or is not allowed, the caller wants a call back, or the agent cannot answer.

```json
{
  "name": "take_message",
  "description": "Leave a message for the team and promise a call back. Read the callback number back first.",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "message": { "type": "string", "minLength": 3, "maxLength": 1000 },
      "callback_window": { "type": "string", "maxLength": 120, "description": "The caller's words, e.g. 'after 3 today'." }
    },
    "required": ["message"]
  }
}
```

**Server:** stores the message on `voice_calls.summary_json.message` and sets `voice_calls.outcome='message_taken'`;
push now to owner/admin (`kind:'receptionist_message'`). The message itself reaches the Unibox once, in the call-log
entry written by `merge_to_unibox`. If no enquiry exists yet, none is created (a message is not an enquiry); staff
can create one from the Unibox with the existing link action. Returns `speak: "Done, I'll pass that straight on."`

### 3.7 `end_call`

```json
{
  "name": "end_call",
  "description": "End the call after saying goodbye, or straight away for spam or a wrong number.",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "reason": { "type": "string", "enum": ["completed", "caller_hung_up", "spam", "wrong_number", "transferred", "silence"] }
    },
    "required": ["reason"]
  }
}
```

**Server:** sets `voice_calls.outcome = reason`; `spam` sets `spam_score = 1.0` and `billable = 0` (contract D-R8).
The worker waits for the goodbye audio to finish playing, then hangs up through Telnyx (`actions/hangup`).
`merge_to_unibox` runs from the hang-up event, not from this tool.

### 3.8 `merge_to_unibox`

**When:** normally never by the agent; `oprun-web` runs it once from `POST /api/internal/voice/call-ended` (or
the Telnyx `call.hangup` event, whichever comes first). The agent may call it only to add a note the caller asked
for ("can you note that the dog will be out").

```json
{
  "name": "merge_to_unibox",
  "description": "Add a note the caller asked for to this call's record. The call itself is filed automatically.",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "note": { "type": "string", "maxLength": 500 }
    },
    "required": []
  }
}
```

**Server, live use:** appends `note` to `voice_calls.summary_json.notes`. Nothing is written to the Unibox yet.

**Server, after the call (the one and only Unibox write):**
1. Extends the existing `onHangup()` in `src/comms/voice.js`, which already calls `recordInbound(db, { channel:
   'voice', kind: 'call_log', contact_address: from_number, external_message_id: call_session_id, … })`. The
   `external_message_id` makes it idempotent: `recordInbound` returns the existing message on a repeat.
2. Body: kind line, duration, caller notes, message taken, transcript. Summary: the post-call LLM summary
   (`generateAiText`), falling back to the existing rule-based `summarise()`.
3. Withheld caller ID: `contact_address = 'withheld:' + call_session_id` (rules in `06` §4).
4. Link the thread: existing `comms.link(org, thread_id, { customer_id, enquiry_id }, 'ai_receptionist')` so
   `comms_thread_meta.customer_id / enquiry_id` are set; `recordInbound`'s inbound hook runs the existing
   `analyse()` (category, sentiment, `lead_score`, `lead_band`).
5. Set `voice_calls.thread_id`, then hand over to the follow-up machine (`05`, event `call_ended`).

### 3.9 `draft_followup`

**When:** normally run by the follow-up machine (`05`). The agent calls it live only when the caller asks for
something in writing now ("can you text me the address?") and has consented.

```json
{
  "name": "draft_followup",
  "description": "Prepare a text or email to the caller. It is sent only if the business's approval settings allow.",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "message_class": { "type": "string", "enum": ["post_call_ack", "booking_confirmation", "followup_nudge", "free_text_reply"] },
      "channel": { "type": "string", "enum": ["sms", "email"] },
      "intent": { "type": "string", "maxLength": 500, "description": "What the message should say, in plain words." }
    },
    "required": ["message_class", "channel", "intent"]
  }
}
```

**Server:**
1. Requires a customer on the call with an address for `channel` and granted consent in `marketing_consents`
   (and no row in `marketing_suppressions`). Missing → `ERR_PRECONDITION` ("Is it OK if I text that to you?").
2. Body: the fixed template for `post_call_ack`, `booking_confirmation`, `followup_nudge`; LLM text for
   `free_text_reply`. Every SMS ends with the business name and "Reply STOP to opt out"; emails carry the existing
   unsubscribe footer.
3. Thread: the customer's `sms`/`email` thread in `comms_threads` (created if missing, `status='open'`), linked with
   `comms.link(…)` to the same `customer_id` and `enquiry_id`.
4. Auto or draft: contract §8 decides from `message_class` and `receptionist_config.approval_level`. Any body that
   contains a price, a promise or a complaint answer is forced to `free_text_reply` (draft).
   - Auto: insert `comms_messages` (`direction='outbound'`, `status='approved'`, `ai_generated=1`,
     `provider='super_pro'`) and `comms_message_schedule` (`send_at` = now, or 8 am if inside quiet hours). The
     existing `sendDue()` (every 30 s) sends it.
   - Draft: insert the message with `status='pending_approval'` and `createWorkspaceApproval(receptionistActor(org),
     { approval_type: 'outbound_message', source_module: 'receptionist', entity_type: 'comms_message', entity_id:
     <message id>, draft_payload: { body, channel, to, message_class } })`, plus a `comms_message_schedule` row so
     that once approved, `sendDue()` sends it. The existing `applyApprovalToComms()` flips the message to
     `approved`/`rejected`.
5. Returns `speak: "I'll get that text out to you."` for auto, `"The team will send that through shortly."` for draft.

## 4. Data written per tool (summary)

| Tool | Writes |
|---|---|
| `check_availability` | nothing |
| `create_or_update_customer` | `tenant_customers`, `marketing_consents`, `voice_calls.customer_id`, audit |
| `create_enquiry_lead` | `tenant_documents` (enquiry) via `createEnquiry`, `receptionist_followups`, `voice_calls.enquiry_id` |
| `propose_booking` | `receptionist_slot_holds`, `workspace_approvals` **or** booking + job via `createBookingFromEnquiry` |
| `warm_transfer` | `voice_calls` stage/flags; Telnyx legs |
| `take_message` | `voice_calls.summary_json`, `outcome` |
| `end_call` | `voice_calls.outcome`, `spam_score`, `billable` |
| `merge_to_unibox` | `comms_threads` / `comms_messages` via `recordInbound`, `comms_thread_meta` via `link` |
| `draft_followup` | `comms_messages`, `comms_message_schedule`, maybe `workspace_approvals` |

## 5. Tests that must exist before go-live
1. Replaying any tool with the same `idempotency_key` returns the first response and writes nothing new.
2. A token for business A can never read or write business B's records (every tool).
3. Two calls proposing the same slot at the same moment: one gets `ERR_CONFLICT`.
4. `propose_booking` with `booking_mode='approve'` never creates a `kind='booking'` document before approval.
5. Approving a `receptionist_booking` creates exactly one booking and one job and marks the enquiry `booked`.
6. A `free_text_reply` is never sent without an approval, at every `approval_level`.
7. `warm_transfer` never puts the private number in any response, log line or transcript.
