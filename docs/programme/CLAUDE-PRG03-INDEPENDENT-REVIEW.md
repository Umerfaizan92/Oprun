# PRG-03 — Independent financial integrity review (Claude)
Reviewer: Claude (independent; did not write the payment code). Implementer: Codex.
Candidate reviewed: `22ef8fd95a7772db2a2b688d41b796d7af7a53e8` (combined integration candidate).
Payment correction: `86f4589cb1b80a84b457eba49ba122b63f34ee45` (ancestor of the candidate; parent `1c5eff7`). Earlier
payment fixes in the same line, read for context: `fc8c433` (Stripe refund units), `1def04b` (exact precision guards).
Audit checkpoint `85f7224` and receipt `a026c68` (docs and SHA256SUMS line only, on top of the candidate) were read, not tested separately.
Review branch: `claude/prg03-independent-review-20261128`, created from `22ef8fd`. Codex's branches and implementation are not modified.

## Disposition
**NOT ACCEPTED as complete financial integrity: returned to the coordinator.**
What 86f4589 set out to do holds: an ambiguous refund cannot trigger a second financial operation before
reconciliation, receipts are matched exactly, and no balance moves on an uncertain answer (all verified below).
Acceptance criterion 4 fails: a legitimate refund that hits an uncertain outcome **cannot** be reconciled without
manual database changes, and the payment stays locked permanently (F1, High). Three further defects (F2 to F4) are
returned for allocation. No defect found lets money leave twice or lets one tenant affect another.

## Findings (all reproduced with synthetic data; evidence: `qa/programme/prg03-independent-financial-review.test.mjs`)
| ID | Severity | Summary | Affected files | Evidence (test numbers in the file's TAP output) |
|---|---|---|---|---|
| F1 | **High** (operational lock; no money loss) | An uncertain refund is held as `status='submitted', provider_ref=NULL, error=…`. Nothing in `src/` ever clears that state: the webhook completes only rows whose `provider_ref` equals the receipt id (NULL never matches), `completeManualRefund` accepts only `awaiting_manual`, `syncRunStates` acts only on `pending_approval`, and no route or engine path resolves it. The amount stays reserved and **every later refund on that payment is refused with 409 for good**, even after Stripe's signed receipt has moved the ledger. Also, `providerJson` reports every provider failure as status 502, so a definitive Stripe rejection (HTTP 400) is treated as uncertain and locks the payment the same way. | `src/finance/service.js` (refundNeedsReview, executeRefund, completeManualRefund), `src/payments.js` (providerJson, refundStripe, charge.refunded handler) | #16, #17 (todo, fail); #15, #18, #32 (characterisation, end to end through the real server and approval engine) |
| F2 | Medium (refundable amount understated) | (a) The webhook completes submitted requests only from `charge.refunds.data`. Since Stripe API 2022-11-15 the Charge object does not include `refunds` unless expanded, and Oprun neither pins a Stripe-Version nor expands it; so a **pending** refund that later succeeds is applied to the ledger once the charge total includes it, but its request stays `submitted`, counted again as "waiting". With 100.00 paid and 40.00 refunded, only 20.00 more can be requested instead of 60.00. (b) No handler exists for a refund that fails or is cancelled after `pending` (`charge.refund.updated` is `ignored`), so its amount stays reserved for good. | `src/payments.js` (charge.refunded handler), `src/finance/service.js` (requestRefund waiting sum) | #20, #21 (todo, fail); #22 (characterisation) |
| F3 | Medium (ledger understated until the next provider total) | `executeRefund` reads the payment before the provider call and later applies `stale refunded_cents + amount`. Two different refunds for one payment that execute concurrently keep only the larger total (30.00 + 20.00 recorded as 30.00; job balance shows 20.00 too much paid). This is reachable in production on one instance: `jobQueue.start()` (server.js:6289) and the engine's `kick()` drain the same queue under separate flags, and each claims a different job. The next `charge.refunded` total corrects it; without a configured webhook it persists. Stripe caps refunds per charge, so an inflated "refundable" figure cannot over-refund; the excess call would be rejected (then F1 applies). | `src/finance/service.js` (executeRefund → applyRefundTotal) | #26 (todo, fail); #27 (characterisation) |
| F4 | Low (self-healing with webhook) | After a provider success, `executeRefund` writes the request as `completed` and then applies the ledger in a separate transaction. A local write failure between them leaves the request completed but the payment and job unchanged; a retry returns "already completed" and does not repair it. Only the next `charge.refunded` total recovers it. | `src/finance/service.js` (executeRefund) | #31 (characterisation) |

The coordinator allocates implementation. Suggested direction, not prescriptive: reconcile uncertain refunds by
re-issuing the same idempotent request or querying the refund list for `metadata.payment_id` plus a reconcile action
with audit; record the provider refund id and match on it in `charge.refund.updated`/`refund.*` events; compute the
ledger total inside one transaction from the refund rows or the provider total; distinguish definitive 4xx rejections.

## Verified (passing) — criterion by criterion
| Requirement | Result | Tests |
|---|---|---|
| Exact provider receipt matching (id, amount, currency, tenant, payment, succeeded only) | Holds. Pending, failed, canceled, wrong amount, string amount, missing currency, wrong currency, unknown or empty id, null and junk entries never complete a request; uppercase currency accepted | #1 |
| Refund identity, amount, currency, tenant | Holds | #1, #2, #28 |
| Partial and multiple refunds | Holds (each delta once; full refund sets `refunded`, job paid to 0) | #3, #19 |
| Duplicate and replayed events | Holds (event id dedupe) | #3, #30 |
| Delayed and out-of-order events | Holds (older or zero totals never reduce) | #3 |
| Concurrent refund requests | Same request twice: one idempotency key, applied once (#25). Different requests: **F3** | #25, #26, #27 |
| Pending, failed, cancelled, succeeded | Succeeded and pending→succeeded-with-receipt hold (#19, #23, #24). Failed/cancelled after pending: **F2** | #19–#24 |
| Malformed and ambiguous provider responses | Ten response shapes, including HTTP 500/429 and network failure, mark for review, change no balance, are permanent (no engine retry) | #4, #5–#14 |
| Network timeouts and uncertain outcomes | Socket drop simulated (the 15 s `AbortSignal.timeout` path shares the same catch). No balance change, no second call | #14, #32 |
| Historical inexact ledger totals | No provider call, no balance change, webhook flagged for review | #29 |
| Payment and work-order balance preservation | Holds in every passing case; F3/F4 understate refunded until the provider total arrives | #1, #3, #19, #23–#30 |
| Cross-tenant provider reference collisions | Holds: same payment_intent and refund id in two tenants never cross; forged signature rejected; foreign payment/refund refused before any call | #2 |
| Transaction atomicity | Webhook payment + job update is atomic and the event is released for redelivery (#30). executeRefund: **F4** | #30, #31 |
| Reconciliation and safe recovery | Webhook replay recovery holds (#30). Uncertain refunds: **F1** | #16–#18, #30, #32 |
| Approval and audit attribution | `finance.refund_needs_review` and `finance.refund_submitted` are attributed to the approver; the held run ends `failed` with its approver recorded | #5–#14, #23, #24, #32 |
| **Item 3**: an ambiguous refund cannot trigger a second financial operation before reconciliation | **Holds.** A second request already queued before the outcome was known, approved afterwards, makes no provider call; new requests get 409; re-running the held request makes no call | #5–#14, #32 |
| **Item 4**: a legitimate refund can eventually be reconciled without manual database changes or permanent lockout | **Fails: F1** | #16, #17, #18, #32 |

## Tests run (Node v22.23.5; dependencies from the unchanged `package-lock.json`; synthetic data; provider stand-ins only)
| Command | Result | Exit |
|---|---|---|
| `node --test qa/programme/prg03-independent-financial-review.test.mjs` (3 runs) | each: 32 tests, 27 pass, 0 fail, 5 todo (the 5 todo tests fail as expected and name F1–F3) | 0 |
| `node --test --test-concurrency=1 scripts/finance.test.mjs scripts/programme-payment-currency.test.mjs` (existing Codex/phase tests, unchanged) | 29 tests, 29 pass, 0 fail | 0 |
| `npm test` (scripts/verify-all.mjs) on candidate 22ef8fd plus the two review files | ALL CHECKS PASSED 73/73; 132 contract files (`scripts/*.test.mjs` only; the review file under `qa/programme/` is not part of `npm test` and is reported above); 10m48s | 0 |
| `npm run security:secrets` (review files staged) | PASS: 920 tracked files (including both review files), 13 credential kinds | 0 |
`todo` tests do not fail a run; they are listed here so the exit code is not read as acceptance.
No live refund, provider account, production data, network provider call, migration, deploy or spending.

## Limits of this review
- Stripe behaviour was represented by stand-ins built from Stripe's public documentation (including the 2022-11-15 changelog: Charge `refunds` no longer returned by default). No live or test-mode Stripe account was used, so exact production webhook payloads are not verified.
- PayPal and bank refunds were exercised only as far as the manual path appears in existing tests; not independently reviewed here.
- Concurrency was tested within one process (overlapping async executions); multi-instance behaviour was not tested (production runs one instance).
- The 15-second timeout path was represented by a dropped connection, which uses the same error branch; a real 15-second wait was not run.

## Next action
Coordinator: allocate F1 (first: it blocks criterion 4), then F2 and F3, then F4. Claude has not changed Codex's code,
does not restart PRG-02, and does not merge, deploy, run migrations, upload recovery snapshots or spend.
