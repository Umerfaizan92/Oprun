# 02 One-section self-service setup wizard

Owner of this file: the AI Receptionist section in the Subscriber Workspace and its setup wizard.
Names, columns, states and approval types come from [00_CONTRACT.md](00_CONTRACT.md). Architecture is in
[01](01_ARCHITECTURE.md), the voice prompt in [03](03_NATURALNESS_PROMPT.md), tools in [04](04_TOOLS.md), the lead and
follow-up flow in [05](05_LEAD_TO_BOOKING_FLOW.md), customers in [06](06_CUSTOMER_MANAGEMENT.md), knowledge in
[07](07_KNOWLEDGE_AUTOLOAD.md), security and metering in [08](08_SECURITY_COMPLIANCE_METERING.md).

## 1. One section replaces five views

Today the receptionist is spread over five workspace views in `saas/workspace-nav.js`. They become one section,
**AI Receptionist**, with one new view id `aireceptionist` and path `communications/ai-receptionist`.

| Old view | Old label | Old paths and aliases (all keep working) | Opens in the new section |
|---|---|---|---|
| `assistant` | AI Assistant & Receptionist | `today/assistant`, alias `operations/receptionist`, `b01/assistant` | Receptionist part → Overview tab. The AI Assistant chat itself is **not** part of this project and stays where it is; only the receptionist half of the label moves |
| `voiceflow` | Call Handling | `communications/call-handling`, `b04/voice` | Settings tab, "When calls come in" |
| `receptionist` | Receptionist | `communications/receptionist`, `b04/receptionist` | Overview tab (or the wizard if `status='draft'`) |
| `phone` | Phone Numbers | `b04/numbers` | Numbers tab |
| `calls` | Calls & SMS | `b04/calls` | Calls tab |

Rules:
- Every old path, alias, hash link and element ID listed above keeps resolving (standing rule in `CLAUDE.md`). The
  router maps each one to `communications/ai-receptionist` plus the tab shown in the table.
- The "Communications setup" and "Connections & setup" groups in `workspace-nav.js` list `aireceptionist` once,
  replacing `voiceflow`, `receptionist`, `phone` and `calls`. No view appears twice in a menu.
- The `assistant` view keeps its AI Assistant label without "& Receptionist" once the new section ships; the change
  happens in the same commit as the redirect so the tests and the label change together.
- Feature gating: the section uses the existing `featureFor` key `settings` for owners and admins; `calls` read
  access follows the inbox permission (`inbox`).

When the business has no `receptionist_config` row, or `status='draft'`, the section opens the wizard. After go-live
(`status='live'` or `'paused'`) it opens the Overview tab and the wizard is reachable from Settings → "Run setup
again".

## 2. Layout rules (all wizard screens and tabs)

- **Mobile first, one hand.** One question per screen on phones. The primary button sits in a fixed bottom bar in the
  thumb zone (bottom 25% of the screen), full width on phones, right-aligned on iPad and laptop. "Back" is a text link
  top left. Swiping is never required.
- **One primary button per screen**, gold (`--sp-gold`, text `--sp-on-gold`). Secondary actions are text links.
- **Fits phone, iPad and laptop** without horizontal scroll: single column under 720 px, two columns (form + live
  preview) from 1024 px. Touch targets at least 44 × 44 px.
- **Design system:** `saas/ds/tokens.css` and `components.css` (`sp-` classes), midnight base, gold for actions and
  the approval gate, cyan only for "live" (the test call's live transcript and the Live badge). No new colours.
- **Motion:** one entrance per screen, skipped under `prefers-reduced-motion`. **No looping animation** anywhere,
  including the test-call screen (the "listening" state is a static cyan dot, not a pulse).
- **Progress:** a six-step indicator ("Step 2 of 6") with step names; completed steps are tappable to edit.
- **Plain English**, Australian spelling, no jargon ("number", not "DID"; "moving your number", not "porting", with
  "porting" in brackets once).
- **Never blocks on the network:** every step saves on "Continue"; a failed save keeps the screen with an inline
  error and a "Try again" link. Nothing typed is lost.

## 3. Resume and saving

- `receptionist_config.wizard_step` holds the furthest completed step (0–6). Opening the section resumes at
  `wizard_step + 1`.
- Each step is saved by its own `PUT` when the owner taps the primary button. A step counts as complete only when its
  save succeeds; `wizard_step` is then set to that step number in the same transaction.
- Steps that start outside work (number purchase, port order, knowledge build, test call) store their own record
  (`receptionist_numbers`, `receptionist_port_orders`, `receptionist_knowledge`, `voice_calls`) so a reload shows the
  real state, never a guess.
- Two people editing at once: every `PUT` sends the `updated_at` it loaded; a stale value gets `409` and the screen
  reloads the latest values with a notice "Someone else changed this. Here is the latest version."

## 4. The six steps

### Step 1 · Number

**Heading:** "Which number should customers call?"
**Purpose:** give the business a working Oprun number within minutes, whichever path it chooses (contract §3, D-R2).

Three choices (cards, one tap each):

| Card | Copy |
|---|---|
| Get a new number | "Pick a local, 1300 or 1800 number. Ready in minutes." |
| Keep my number (forward) | "Your calls divert to Oprun. Nothing to move. Live today." |
| Move my number to Oprun | "Your number moves to Oprun for good. Takes 3 days to 5 weeks. We answer from today while it moves." |

**A) Get a new number**
1. Number type: local (02, 03, 07, 08), 1300, 1800. Area defaults to the business suburb from `organisations.postcode`
   and `state`.
2. Oprun shows five available numbers from Telnyx; the owner picks one.
3. Identity check (once per business): business name, ABN (`organisations.abn`), contact phone and Australian street
   address prefilled; owner uploads proof of address dated within the last 3 months (PDF, JPG or PNG, scanned by the
   existing file-safety check). Oprun creates one Telnyx Requirement Group per business and stores its id in
   `receptionist_numbers.requirement_group_id`; later numbers reuse it.
4. Price confirmation screen: setup and monthly price in A$ incl. GST. Primary button **"Buy this number"** creates
   the `receptionist_number_purchase` approval and approves it in the same tap when the person is the owner (one tap,
   recorded with who and when). A manager without billing rights sees "Ask the owner to approve" and the approval
   waits in Approvals.
5. After approval: `receptionist_numbers` row `origin='bought'`, `status='provisioning'` → `active`; the first active
   number gets `is_primary=1` and is mirrored into the `comms_channels` `voice` row.

**B) Keep my number (forward)**
1. Oprun buys a hidden number for the business (`origin='forward_target'`) through the same approval as A. It is never
   shown to callers.
2. Forwarding mode (`receptionist_config.forward_mode`):
   - `always`: "The AI answers every call."
   - `busy_no_answer`: "Your team gets first go. The AI answers after about 20 seconds or if you're busy." (default)
   - `after_hours`: "The AI answers outside your opening hours."
3. Phone type: mobile, landline/NBN, or VoIP/phone system. Oprun shows the exact steps for that type. Mobiles get
   the dial code (for example `**61*<hidden number>#` for no answer, `**67*` for busy, `**21*` for always, `##002#`
   to remove all); landlines and VoIP get the carrier portal steps from the help article.
4. **"Check it works"**: Oprun places a test call to the business's existing number. Success when the call arrives on
   the hidden number with forwarding information from that number; then `forwarded_from_e164` and
   `forward_verified_at` are saved. Failure shows "We couldn't reach the AI through your number" with the three most
   common causes and "Try again".

**C) Move my number to Oprun**
1. Number kind and current carrier.
2. Documents: Letter of Authority (generated by Oprun, filled from the business record, signed in the app), ABN, and a
   carrier invoice dated within the last 30 days. Mobiles also need: prepaid or postpaid, and an SMS code sent to each
   number entered on the next screen.
3. Warnings (must be ticked): "Other services on this number (for example extra lines or internet) will be
   cancelled when the move completes." "Linked numbers must be separated by your carrier first, or moved together."
4. Expected time shown before submitting: simple local or 1300/1800 move 3–6 business days, complex move 5+ weeks,
   mobile 1–5 business days. Moves usually complete on a weekday morning.
5. Primary button **"Send for approval"** creates the `receptionist_port_order` approval; the order moves
   `draft → documents_uploaded → awaiting_owner_approval` and, once approved, `submitted` (contract §6.3).
6. **While it moves**, the wizard also sets up path B so calls are answered from today. On `ported`, the ported number
   becomes `is_primary=1`; the forward target stays active as a backup until the owner releases it in the Numbers tab.

**Fields:** `receptionist_numbers.*`, `receptionist_port_orders.*`, `receptionist_config.forward_mode`.
**Validation:** Australian E.164 numbers only; ABN 11 digits with checksum; proof of address ≤ 3 months, invoice ≤ 30
days (dates read from the owner's entry, documents kept in tenant documents storage); file ≤ `MAX_FILE_MB`.
**Saved when:** the step completes (`wizard_step=1`) as soon as at least one number is `active` (A or B). A port
order alone does not complete the step, because it cannot answer calls yet.
**Errors:** Telnyx has no numbers in that area → offer the nearest areas and 1300; Requirement Group rejected → show
Telnyx's reason in plain words and let the owner replace the document; purchase failed after approval → the
approval stays approved, the number row shows `provisioning` with "Retry" (never buys twice: the purchase call carries
an idempotency key).
**Approvals:** `receptionist_number_purchase`, `receptionist_port_order`.

### Step 2 · What the receptionist knows

**Heading:** "Here's what your receptionist will tell callers"
**Purpose:** show the facts Oprun pulled from the business's records and get the owner's approval. How the facts are
built is in [07](07_KNOWLEDGE_AUTOLOAD.md); this step only shows and approves them.

- On entering the step Oprun starts a knowledge build (a `receptionist_knowledge` row, `status='draft'`). A progress
  line reads "Reading your services, hours and past jobs…" (static, no looping spinner; it updates when the build
  finishes, usually under a minute).
- Facts appear as short cards grouped by topic: Business, Hours, Services, Service area, Common questions, Transfers.
  Each card shows where it came from ("From your onboarding profile", "From 42 past jobs") and has **Edit** and
  **Remove**.
- Greeting preview: "Thanks for calling {business name}, this is the reception assistant. How can I help?" with
  Edit. Stored in `receptionist_config.greeting`. The recording notice line is added automatically when
  `recording_notice=1` (see 08) and cannot be removed here.
- Hours come from the existing profile and are stored in `receptionist_config.hours_json` with `timezone`
  (default from `organisations.timezone`).
- Primary button **"Approve what it knows"** creates the `receptionist_knowledge` approval and, for the owner,
  approves it in the same tap. The revision becomes `approved`, its number is written to
  `receptionist_config.knowledge_revision`.

**Validation:** greeting 10–300 characters; at least the business name, hours and one service must be present.
**Saved when:** approval succeeds → `wizard_step=2`. Edits before approval are saved to the draft revision on every
card change.
**Errors:** build failed or AI unavailable → the owner can fill the cards by hand ("Add a fact") and continue.
**Approvals:** `receptionist_knowledge`.

### Step 3 · Voice

**Heading:** "Choose how your receptionist sounds"
- A curated list of 6–8 Australian-English voices (female, male, neutral), each with a name, a one-line description
  ("Warm and calm", "Bright and quick") and a **Play** button that plays the business's own greeting in that voice.
- Speaking speed: Slower, Normal (default), Quicker.
- Extra languages the receptionist may switch to when a caller speaks them (English always on). Stored in
  `receptionist_config.languages_json`.
- Voices are provider-licensed synthetic voices only; there is no voice cloning in the MVP.
- Primary button **"Use this voice"**.

**Fields:** `receptionist_config.voice_id`, `voice_provider` (`elevenlabs`; the Cartesia fallback voice is the paired
voice in the curated list, chosen automatically), `receptionist_config.voice_speed` (`slower`, `normal`, `quicker`;
**new column, pending addition to the contract**), `languages_json`.
**Defaults:** the first female Australian voice, Normal speed, English only.
**Validation:** voice must be in the curated list.
**Saved when:** `wizard_step=3`.
**Errors:** preview fails to load → "Couldn't play the sample. You can still choose this voice."

### Step 4 · Booking rules

**Heading:** "When can callers book?"
- Services that can be booked on a call (picked from the Step 2 service list), each with: duration, optional
  "from" price the receptionist may say (owner-entered only), and whether it needs a site visit first.
- Buffer between bookings (default 30 min), earliest booking (lead time, default next business day), latest booking
  window (default 14 days ahead), days and hours that can be booked (defaults to opening hours).
- Service area: suburbs or postcodes, or a radius from the business postcode. Callers outside it are offered a
  message instead of a booking.
- How bookings are confirmed (`receptionist_config.booking_mode`):
  - `approve` (default): "The receptionist holds the time and you approve it. The caller hears 'I'll lock that in and
    confirm by text shortly.'"
  - `auto`: "The receptionist books it straight into your jobs. Use this only if your diary is always up to date."
- Primary button **"Save booking rules"**.

**Fields:** `receptionist_config.booking_rules_json` (exact shape in [00_CONTRACT.md §5.1](00_CONTRACT.md#51-receptionist_configbooking_rules_json-one-shape-used-by-02-04-and-07): `services[] {id, name, aliases, duration_min, price_from_cents, needs_visit}`,
`buffer_min`, `lead_time_hours`, `window_days`, `bookable_hours`, `service_area`, `crews`), `booking_mode`.
**Validation:** each bookable service needs a duration 15–600 min; window 1–90 days; at least one bookable hour block.
A business may also choose "No bookings on calls, take a message instead" (empty `services[]`).
**Saved when:** `wizard_step=4`.
**Approvals:** none here; bookings themselves create `receptionist_booking` approvals (see 05).

### Step 5 · Approvals

**Heading:** "What can go out without you checking?"
Three choices (`receptionist_config.approval_level`, contract §8):

| Choice | Plain-words copy |
|---|---|
| `approve_all` (default) | "Check everything. Every text and email waits for your OK." |
| `auto_confirmations` | "Send standard confirmations. The 'thanks for calling' text and booking confirmations go out by themselves. Everything else waits for you." |
| `auto_followups` | "Also send reminders. Standard follow-up reminders go out by themselves too. Anything the AI writes freely, any price and any complaint reply still waits for you." |

A fixed note under the choices: "Texts never go out between 8 pm and 8 am, and every text has an opt-out."
Also on this screen: who gets transferred calls (`transfer_targets_json`: up to 5 team members or numbers, tried in
order; private numbers are never spoken and show only their last three digits) and when
(`transfer_when`: `on_request` default, `urgent`, `never`).
Primary button **"Save approvals"**.

**Validation:** transfer numbers must be Australian E.164; a team member must have a mobile on record.
**Saved when:** `wizard_step=5`.

### Step 6 · Test call and go live

**Heading:** "Hear it answer"
- Two options: **"Call my mobile"** (Oprun calls the owner's verified mobile from the business number) or "Test in
  this browser" (WebRTC test from the page, same pipeline).
- During the call: live transcript (cyan "Live" badge, static), each reply's delay in milliseconds, and a summary at
  the end: p50 and p95 delay, interruptions handled, what the receptionist would have created (customer, enquiry,
  booking hold). **Test calls create nothing real**: tools run in test mode against the business's data but write only
  to the call record (`voice_calls.outcome='test'`), are never billed and never message anyone.
- If p95 delay is over 1000 ms the screen says so plainly and offers "Test again"; the owner can still go live.
- Primary button **"Go live"** sets `receptionist_config.status='live'`, `wizard_step=6`, and (if forwarding)
  reminds the owner to switch forwarding on. A secondary link "Not yet" keeps `status='draft'`.

**Errors:** call not answered → "We rang but no one picked up. Try again or use the browser test." Worker unreachable
→ the fallback chain from 01 answers instead and the screen says "Your receptionist answered in backup mode".

## 5. After go-live: the section's tabs

| Tab | Shows |
|---|---|
| **Overview** | Live/Paused switch (`status`), today's calls, bookings held for approval (link to Approvals), enquiries created this week, follow-ups running, average and p95 response delay, billable calls this month against the spend cap |
| **Calls** | Every call from `voice_calls`, newest first: caller, time, length, intent, outcome, language, Transferred/Voicemail/Spam badges, summary, transcript, recording (if enabled), links to the customer, enquiry and Unibox thread. Filter by outcome and date. Replaces the old Calls & SMS call list; SMS stays in the Unibox |
| **Settings** | Greeting, voice, languages, booking rules, approval level, transfers, "When calls come in" (old Call Handling: `forward_mode`, voicemail greeting, recording notice), spend cap, Pause receptionist, Run setup again |
| **Numbers** | All `receptionist_numbers` with type, origin, status, primary flag; forwarding check status; port orders with their state and expected date; "Get another number", "Release" (needs approval-style confirm) |
| **Knowledge** | Current approved revision, a draft if one is waiting ("3 changes since you last approved"), sources, Edit and Approve |

## 6. API (all in `oprun-web`)

All routes: `requireSaasUser` + senior roles (`owner, admin, manager, super_admin, director`); organisation from
the session only; every write is audited with `saasAudit` and returns the updated object; writes send the loaded
`updated_at` and get `409` when stale.

| Method and path | Does |
|---|---|
| `GET /api/saas/receptionist` | Config (with `wizard_step`, `status`), numbers summary, current knowledge revision, port orders |
| `PUT /api/saas/receptionist/config` | Saves one step's fields (`step` 3, 4 or 5) and advances `wizard_step` |
| `GET /api/saas/receptionist/numbers/search?type=&area=` | Five available numbers from Telnyx |
| `POST /api/saas/receptionist/numbers` | Buy (`origin='bought'`) or create the forward target (`origin='forward_target'`); creates the `receptionist_number_purchase` approval |
| `POST /api/saas/receptionist/numbers/:id/forward-check` | Places the forwarding test call; result via `GET /api/saas/receptionist` |
| `POST /api/saas/receptionist/numbers/:id/release` | Starts `releasing` (owner only) |
| `POST /api/saas/receptionist/identity` | Creates or updates the Telnyx Requirement Group with the uploaded proof of address |
| `POST /api/saas/receptionist/port-orders` | Creates a port order draft; documents attach to it |
| `POST /api/saas/receptionist/port-orders/:id/submit` | Moves to `awaiting_owner_approval` and creates the `receptionist_port_order` approval |
| `POST /api/saas/receptionist/port-orders/:id/verify-mobile` | Checks the SMS codes for mobile ports |
| `POST /api/saas/receptionist/knowledge/build` | Starts a draft knowledge build (see 07) |
| `PUT /api/saas/receptionist/knowledge/:revision` | Edits facts in a draft revision |
| `POST /api/saas/receptionist/knowledge/:revision/approve` | Creates (and for the owner, approves) the `receptionist_knowledge` approval |
| `GET /api/saas/receptionist/voices` | Curated voice list with sample URLs |
| `POST /api/saas/receptionist/test-call` | Body `{mode:'mobile'|'browser'}`; starts a test call |
| `POST /api/saas/receptionist/go-live` | `status='live'`; requires `wizard_step ≥ 5`, an active number and an approved knowledge revision |
| `POST /api/saas/receptionist/pause` and `/resume` | `status='paused'` / `'live'`; paused calls follow `forward_mode` or voicemail |
| `GET /api/saas/receptionist/calls?outcome=&from=&to=` | Calls tab list |

The existing `GET/PUT /api/saas/receptionist-profile` and `GET /api/saas/comms/voice` stay as compatibility routes
that read from and write to `receptionist_config` (see 09).
