# PRG-03 — Independent financial RE-ACCEPTANCE (Claude)
Reviewer: Claude (independent; did not write the corrections). Implementer: Codex.
Correction branch: `codex/prg03-financial-corrections-20261128`, remote head `3d00fec369c27924f51f0a2d8bad0dfbb41fe622` (checked: exact match).
Tested implementation: `09fcd0b2fdd36f1cdb008731fec0f6177eab4685` (parent of 3d00fec; `src/`, `qa/`, `scripts/` identical between them).
Ancestry (verified with `git merge-base --is-ancestor`): `22ef8fd` → `0b86b34` (my original review) → `09fcd0b` → `3d00fec`. The branch
also contains the accepted PRG-02 queue change; it does **not** contain PRG-04 (`e8ee522`).
Review branch: `claude/prg03-reacceptance-20261128`, created from `3d00fec`. Codex's runtime code and branches are not modified.

## Preservation of the original review evidence
`qa/programme/prg03-independent-financial-review.test.mjs` and `docs/programme/CLAUDE-PRG03-INDEPENDENT-REVIEW.md` are
byte-identical between `0b86b34` and `3d00fec` (`git diff --quiet`). They are not edited by this review.

## Changed files (0b86b34..3d00fec)
`src/finance/stripe-refunds.js` (new, 130), `src/finance/service.js` (+206/−), `src/payments.js` (+125/−), `src/finance/routes.js` (+5: owner-only
`POST /api/saas/finance/refunds/:id/reconcile`), `qa/programme/prg03-financial-corrections-acceptance.test.mjs` (new, 706),
`docs/programme/PRG03-FINANCIAL-CORRECTIONS-2026-11-28.md`, `SHA256SUMS.txt`.

## Disposition: **NOT ACCEPTED**
The four original defects are corrected and independently verified (F1 lock, F2 reservation, F3 stale totals, F4 partial
writes). Two **mandatory requirements of this assignment remain unmet** and are demonstrated by failing mandatory tests:
G1 (a refund that Stripe fails after success is silently kept as refunded) and G2 (a routine same-account key rotation
strands held and pending refunds with no recovery path). The mandatory suite exits 1. G3 is a lower-severity limitation.
Re-acceptance requires G1 and G2 fixed (or G2 formally descoped by the coordinator with an operational release gate),
and the mandatory suite passing with no todo or skip.

## Remaining findings
| ID | Severity | Summary | Affected files | Mandatory evidence (fails) | Characterisation (passes, current behaviour) |
|---|---|---|---|---|---|
| G1 | **Medium** | Stripe documents that a refund can move from `succeeded` to `failed` (bank returns funds, up to 30 days) and sends `refund.failed`. `transition()` only changes rows in `submitted`, so a `completed` request stays completed, the payment stays refunded and the job stays reduced. The webhook even records outcome `refund_completed` for the `refund.failed` event; no owner flag. The charge floor (`max(before.charge_cents,total)`) also prevents a lower provider total from correcting it. Effect: Oprun reports a customer as refunded when the money is back in the merchant's Stripe balance. | `src/finance/stripe-refunds.js` (transition, recordCharge), `src/payments.js` (refund events) | `F2 conflicting: a succeeded refund that Stripe later fails…` | `G1 current behaviour…` |
| G2 | **Medium** | The account binding is `sha256(secret key)`, not the Stripe account. Stripe's documented "Rotate key" issues a replacement key **for the same account** and recommends rotation when staff leave or by policy. After rotation: the reconcile route refuses ("Complete evidence from the original Stripe account is unavailable"), so a held refund keeps the payment locked; and a signed, exact `refund.updated` for a pending refund is ignored (`claim.account_binding !== binding`), so the reservation never releases. No supported path recovers without database changes. Codex's checkpoint states rotation is outside this candidate. | `src/finance/stripe-refunds.js` (transition), `src/finance/service.js` (reconcileStripeRefund), `src/payments.js` (stripeBinding, listStripeRefunds, refundStripe) | `F1 credential rotation: a routine key rotation…` and `…signed refund.updated…after a key rotation` | `G2 current behaviour…` |
| G3 | Low | `update()` now requires `work_orders.paid_cents >= delta` (previously clamped at zero). An admin can lower `paid_cents` through `PUT /api/saas/finance/jobs/:id`; a later valid Stripe refund then makes the webhook return 500 on every redelivery, with no owner flag. Balances stay unchanged (safe), but the condition is invisible. | `src/finance/stripe-refunds.js` (update), `src/payments.js` (charge.refunded) | — (limitation, not a mandatory requirement) | `G3 current behaviour…` |

## Independent classification of every original failure and TODO (unchanged suite on 09fcd0b)
| # | Original test | Result on 09fcd0b | Classification | Basis |
|---|---|---|---|---|
| 7 | ambiguous outcome (failed status) | fail | **Obsolete defective-behaviour assertion** | Treated a well-formed synchronous `failed` refund as uncertain. `failed` is a documented terminal Refund status; the candidate now validates id, amount, object, currency, payment intent and metadata before accepting it, and holds anything mismatched (verified: mandatory `synchronous failed or canceled`). |
| 8 | ambiguous outcome (canceled status) | fail | **Obsolete defective-behaviour assertion** | Same as #7 for `canceled`. |
| 16 | TODO F1: ambiguous refund completed is reconciled by its signed webhook | fail | **Incomplete fixture requiring authoritative evidence** | The fixture's receipt has no `metadata.refund_request_id`. Every corrected POST now sends it, and attribution without it would be unsafe. With realistic evidence the requirement is met automatically (mandatory `…recovered automatically by a signed charge aggregate…`) and by the owner route. |
| 17 | TODO F1: refund Stripe never made can be resolved | fail | **Incomplete fixture** (new route not exercised) | Resolution now exists: owner reconcile with `confirmed_provider_rejection` and an evidence reference, only after the 60 s in-flight window and a complete list read with no conflicting evidence (mandatory `…Stripe never made…`, `…false owner attestation…`). Limitation: the attestation itself cannot be verified by the application. |
| 18 | characterisation F1 (stays locked) | pass | Still true **only** for receipts lacking request metadata; consistent with #16. Not a defect. | |
| 20 | TODO F2: aggregate without embedded list frees nothing twice | fail | **Incomplete fixture requiring authoritative evidence** | The stand-in has no list endpoint, so the conservative hold is correct. With a list the allocation is exact (mandatory `…overlapping a local reservation and a dashboard refund…`, `…list unavailable…later owner reconcile…`). |
| 21 | TODO F2: pending refund that later fails releases | pass | **Resolved** | Also mandatory `pending refund that becomes failed/canceled`. |
| 22 | characterisation F2 (understated) | fail | **Obsolete defective-behaviour assertion** | Asserted the understatement F2 described. |
| 26 | TODO F3: concurrent different refunds both counted | pass | **Resolved** | Also in-process and separate-process mandatory tests. |
| 27 | characterisation F3 (understated, corrected by total) | fail | **Obsolete defective-behaviour assertion** | Asserted the F3 understatement. |
| 31 | characterisation F4 (completed but unapplied) | fail | **Obsolete defective-behaviour assertion** | Asserted the F4 partial write; now status and both balances roll back together and recover with no POST. |
| 15 | HTTP 400 without a code treated as uncertain | pass | Correct by design | Only structured allow-listed codes are definitive. |
No original failure or TODO is a **genuine remaining defect**; the genuine remaining defects (G1, G2) are outside the original suite and were found by the new mandatory suite. No original TODO counts as acceptance evidence.

## F1–F4 verification against the assignment (mandatory suite, `qa/programme/prg03-reacceptance-independent.test.mjs`)
| Area | Requirement | Result |
|---|---|---|
| F1 | Exact account, tenant, payment, currency, amount, refund identity | Holds for tenant, payment, request, currency, amount, payment intent (each mutation → 409, no balance change). Account identity: **G2** |
| F1 | No duplicate financial POST | Holds in every case (unit, in-process concurrency, separate processes, kill/restart) |
| F1 | Safe definitive rejection classification | Holds: only 400 `invalid_request_error` with the four allow-listed codes releases; 10 other shapes (incl. 402, 404 `resource_missing`, 409, 429, 401, 500, card and idempotency errors) stay held |
| F1 | Unknown/malformed evidence; incomplete pagination | Holds: second page found; missing `has_more`, `has_more` without data, looping cursor, malformed amount, unknown status → 409, held |
| F1 | Owner-only; incorrect or malicious attestation | Holds: admin 403, other tenant 404, strict body (8 invalid shapes 400) on the real server; a false "never made" attestation is overridden by exact provider evidence; same-amount unattributed evidence blocks release; evidence reference recorded with the owner in the audit log |
| F1 | Credential rotation | **Fails: G2** |
| F1 | Legacy identity ambiguity | Exact owner-supplied link works with no POST; two plausible local requests stay held (limitation: needs manual review) |
| F1 | Stripe Connect | Events carrying `account` are ignored and change nothing (Connect unsupported; limitation) |
| F1 | Legitimate recovery without DB changes; no permanent lockout with sufficient evidence | Holds for lost responses, lost receipts and process kills; **fails after key rotation (G2)** |
| F2 | Standalone signed refund events; pending/requires_action/succeeded/failed/canceled; delayed/duplicate | Holds |
| F2 | Conflicting events | **Fails: G1** (failure after success) |
| F2 | Aggregates without embedded lists; reservation release; no double accounting; exact allocation | Holds (incl. a dashboard refund overlapping a local one, and list outage then owner reconcile) |
| F3 | Separate processes and connections; overlapping refunds; duplicate approvals; over-capacity; webhook vs local settlement | Holds: two POSTs observed in flight together; duplicates and over-capacity send nothing; webhook + local settlement in separate processes apply once; totals exact |
| F4 | Failure after provider success; before receipt persistence; during settlement; process interruption; restart; atomic status and balances; no extra POST | Holds |

## Stripe contracts checked (official documentation; simulated, **no provider account used**)
- Errors: HTTP 400/402/404/409/429/5xx meanings; error `type` and `code` fields (docs.stripe.com/api/errors; docs.stripe.com/error-codes). `resource_missing` is typically returned with 404, which the allowlist (400 only) treats as uncertain: conservative, not unsafe.
- Refund object statuses `pending`, `requires_action`, `succeeded`, `failed`, `canceled`; `metadata`; `payment_intent` (docs.stripe.com/api/refunds/object).
- Refund lifecycle: failure after success with `refund.failed`; `requires_action` re-entry; 45-day insufficient-balance failure; `charge.refund.updated` deprecated in favour of `refund.updated` (docs.stripe.com/refunds). Basis for G1.
- List refunds: newest first, `limit` 1–100, `starting_after` cursor, `payment_intent` filter (docs.stripe.com/api/refunds/list).
- API keys: rotation issues a replacement key on the same account, old key valid up to 7 days, rotation recommended when staff leave or by policy (docs.stripe.com/keys). Basis for G2.
All provider behaviour in the tests is a stand-in built from these documents. Production payloads, real timing, Connect accounts and live idempotency windows are **not** verified.

## Commands and results (Linux x86_64, Node v22.23.5, `package-lock.json` unchanged from the installed tree, synthetic data)
| Command | Tree | Tests | Result | Exit |
|---|---|---|---|---|
| `node --test qa/programme/prg03-independent-financial-review.test.mjs` (original, unchanged) | 0b86b34 | 32 | 27 pass, 0 fail, 5 todo | 0 |
| same | 09fcd0b | 32 | 22 pass, 5 fail, 5 todo | 1 |
| Codex's nine-file mandatory set (`qa/programme/prg03-financial-corrections-acceptance.test.mjs … scripts/tenant-isolation.test.mjs`, as listed in his checkpoint) | 09fcd0b | 129 | 129 pass, 0 fail, 0 todo, 0 skipped | 0 |
| `node --test --test-concurrency=1 qa/programme/prg03-reacceptance-independent.test.mjs` (new mandatory suite, no todo/skip; 3 consecutive runs) | 09fcd0b | 26 | each run: 23 pass, **3 fail** (G2 ×2, G1), 0 todo, 0 skipped | **1** |
| `node --test qa/programme/prg03-reacceptance-characterisation.test.mjs` | 09fcd0b | 3 | 3 pass (reproduces G1–G3) | 0 |
| `npm test` (scripts/verify-all.mjs) | 3d00fec + review files | 73 checks; 132 contract files | ALL CHECKS PASSED 73/73, 10m54s | 0 |
| `npm run security:secrets` (review files staged) | 3d00fec + review files | 927 tracked files | PASS | 0 |
The two review files under `qa/programme/` are not run by `npm test` (`scripts/*.test.mjs` only); they were executed explicitly.

## Required release gates
1. G1 fixed: failure (or `requires_action` re-entry) after success reverses or holds the ledger and flags the owner, with tests.
2. G2 fixed (bind to the Stripe account, e.g. the account id from the API, not the key hash) or formally descoped by the coordinator with an operational gate (no key rotation while any Stripe refund is held or pending) and a documented recovery.
3. Mandatory suite `qa/programme/prg03-reacceptance-independent.test.mjs` passes with no todo or skip; Codex's 129-test set still passes.
4. Combined-tree run (with PRG-04) and `SHA256SUMS.txt` regeneration by the coordinator; real Stripe test-mode verification before live use.

## Next action
Coordinator: allocate G1 and G2 (and G3 if wanted) to Codex. Claude re-runs this mandatory suite on the next correction
head. Claude has not modified Codex's runtime code or branches, has not restarted PRG-02 and has not begun PRG-05 or PRG-07.
