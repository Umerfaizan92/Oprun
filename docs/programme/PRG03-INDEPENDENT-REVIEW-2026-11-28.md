# PRG-03 / T-272 independent review — 28 November 2026

Reviewer: separate read-only review agent, not the implementation author. Candidate: 1def04bf74e9ca1a75f17948bb88ad98495bc9dd against 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd. Five scoped source/test files matched the current audit candidate. No reviewer tracked edits or provider network operations.

Recommendation: accept the bounded exact-conversion correction; HOLD payment release readiness. No introduced arithmetic defect established. T-271 payment and T-272 remain TESTING; this is not end-to-end provider acceptance.

## Independent evidence

Reviewer-authored assertions exercised 170,008 conversion/roundtrip cases, including hundredth parsing from 0–100000 ledger units and AUD, JPY, ISK, UGX, HUF, IDR, KWD matrices. Invalid whole-currency granularity rejected. Nine malformed incoming refund amounts preserved balances and returned amount_precision_review. Synthetic fixture construction was transparently reused from the author test; new assertions and scenarios were independent. Node 22.23.5 author regression suites also passed 29/29 as supporting evidence, not independent acceptance by themselves.

Source review confirmed checkout and saved-card invalid amounts rejected before invoice/payment/provider operations and outgoing refund granularity checked at request and execution. Temporary reviewer scripts were /tmp/oprun-review-independent.mjs and /tmp/oprun-review-fixture.mjs; these paths are ephemeral, not durable reproducibility artifacts. Preserve these scenario specifications; convert to portable regression tests in a bounded follow-up.

## Reproduced residual defects — pre-existing, release blockers

1. P1: src/payments.js around line 581 updates every submitted refund for a payment to completed without matching provider refund ID or amount. A validly signed charge.refunded event with amount_refunded=0 returned refund_already_applied, left balances unchanged, yet changed a submitted refund to completed.
2. P2: refund handling around lines 570–578 validates incoming precision but not legacy stored totals. JPY amount_cents=5050 with cumulative provider total 51 produced refunded_cents=5050/status refunded instead of review. ISK/UGX provider total 5100 similarly clamped against legacy 5050. Checkout settlement has a stored-total precision guard; refund path lacks its equivalent. No historical repair performed.
3. P2 compatibility gap: missing/null signed refund currency falls back to stored currency. JPY amount 50 with null currency changed refund ledger to 5000. This behaviour predates the correction and is not schema validation.

Inspected, not comprehensively tested: successful invalid provider JSON becomes {}; refund execution does not validate returned amount/status beyond comparison to succeeded. Require malformed-success, unknown-status, timeout and ambiguous-provider-outcome tests before lifecycle acceptance.

## Bounded next assignment — coordinator allocation required

Keep implementation ownership unchanged. Reserve only after checking active file ownership: payment webhook/refund lifecycle source and focused payment tests. Reproduce the three scenarios above; match refund completion to authoritative provider identity/outcome; guard legacy precision without rewriting rows; explicitly decide missing-currency compatibility. Preserve balances on ambiguous evidence. No migration, real provider calls, automatic replay, or historical repair. Return exact SHA, targeted tests and portable fixtures for fresh independent review. These findings remain under existing PRG-03 payment T-271 / T-272 scope, not queue T-271; no programme IDs renumbered.
