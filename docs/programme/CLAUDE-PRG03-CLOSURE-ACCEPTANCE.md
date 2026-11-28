# PRG-03 — Final closure acceptance of H1–H3 and E1 (Claude)
Reviewer: Claude (independent; did not write the corrections). Implementer: Codex.
Correction branch: `codex/prg03-closure-20261128`, remote head `40fbc4e28bafffb7192574c54a73cf0927c88712` (checked: exact match).
Tested candidate: `e247fefc47595e0809773435b59b5636f029ce82` (parent of 40fbc4e; `src/`, `qa/`, `scripts/` identical).
Ancestry (verified): `8d7f8df` → `fb855ce` → `f9d4928` (my final acceptance) → `7fad948` → `e247fef` → `40fbc4e`.
Review branch: `claude/prg03-closure-acceptance-20261128`, created from `40fbc4e`. Codex's runtime code and branches are not modified.
Previous evidence preserved: every earlier PRG-03 review file (original review, re-acceptance, final acceptance, workers, characterisations, reports) is byte-identical at 40fbc4e.

## Changed files (f9d4928..e247fef)
`src/payments.js` (+132: webhook promise boundary, outcome persistence, H1 opt-in gate, H2 order-conflict handling, settings read checks),
`src/finance/stripe-refunds.js` (+12: same-second conflict, expected-predecessor check), `src/finance/service.js` (+9: order-conflict resolution),
`scripts/test-server.mjs` (+1: pass opt-in), `scripts/verify-all.mjs` (+1: pass opt-in to contract-test env), `qa/programme/prg03-closure-acceptance.test.mjs`
(new, 6 tests), `SHA256SUMS.txt`; then checkpoint 030 and an E1 note on checkpoint 025 (40fbc4e).

## Disposition
**Isolated technical acceptance: CONDITIONALLY ACCEPTED.** H1, H2 and H3 are corrected and independently verified on the production path and on a real
server; E1 is correctly documented; F1–F4 and G1–G3 remain intact. One condition, **R1**, must be fixed before integration: the default `npm test`
(Render's build command) now fails.
**Production release readiness: NOT READY.** R1 blocks the Render build; the remaining gates are listed below.

## Findings
| ID | Severity | Summary | Affected files | Evidence |
|---|---|---|---|---|
| R1 | **High for release (fail-safe)** | Regression from the H1 fix. `render.yaml` builds with `npm ci && npm test`. Without `OPRUN_TEST_STRIPE_COMPAT=1`, `npm test` fails 73/74: three contract tests that use historical fixtures without account endpoints fail (`scripts/finance.test.mjs` 2 tests: "adjustment notes and refunds need approval…", "an ambiguous Stripe refund holds the payment…"; `scripts/programme-payment-currency.test.mjs`: "AUD: approved refund sends the currency's minor units"). The previous candidate fb855ce passed plain `npm test` 73/73. Codex's 74/74 used the opt-in. A deploy would be blocked, not broken. Fix by giving those fixtures account and balance endpoints (preferred), or by an owner-approved decision on how the build supplies the opt-in. | `scripts/finance.test.mjs`, `scripts/programme-payment-currency.test.mjs`, `scripts/verify-all.mjs`, `render.yaml` | plain `npm test` run below |
| W1 | Medium, registered separately | **PRG-08::WEBHOOK-RESILIENCE** (source review, not changed here). These are async Express 4 handlers with no promise boundary; with no `unhandledRejection` handler, a storage or provider error can end the process. Subscriber PayPal (`src/payments.js` `/api/webhooks/payments/paypal/:orgId`): admission insert, completion and catch cleanup outside the protected block. Platform Stripe and Square (`src/platform-pay.js` `/api/webhooks/payments/platform-stripe`, `platform-square`): no try around `settleOnce` and updates. Resend receipts (`src/message-delivery.js` `/api/webhooks/communications/resend`; `src/integration-webhooks.js` `/api/webhooks/communications/resend/:organisationId`): storage writes after verification are unguarded. Synchronous handlers (Telnyx, inbound email, social, Meta, WhatsApp) are covered by Express's own error handling. Codex's checkpoint 030 identifies the same set. | as listed | source review |
| N1 | Informational | Fail-fast process strategy in checkpoint 030 (bounded request errors, exit on unexpected fatal errors under a supervisor with readiness gating and restart alerts) is sound; it is not implemented by this candidate. | — | — |

## Historical characterisation (f9d4928 file, unchanged) on the candidate — classified, not acceptance evidence
| Test | Result | Classification |
|---|---|---|
| H1 current behaviour (wrapped fetch in production falls back) | fail ("fingerprint binding returned in production mode") | **Corrected behaviour.** The fallback is gone. Strict replacement H1 tests pass. |
| H2 current behaviour (same-second event dropped) | fail | **Corrected behaviour.** The event is no longer dropped. Strict replacement H2 tests pass. |
| H3 current behaviour (server process terminates) | fail with webhook 409 | **Fixture no longer reaches the fault.** It has no account endpoint, so the candidate refuses at identity before the storage failure. This is *not* evidence of the fix; the strict replacement H3 real-server test (with account endpoints) is. |

## Strict replacements (`qa/programme/prg03-closure-independent.test.mjs`, 6 mandatory tests, parent env unset)
**H1** — all 36 combinations of process `NODE_ENV` (production, test, unset) × `OPRUN_TEST_STRIPE_COMPAT` (unset, `1`, `0`, `true`) × app `NODE_ENV` (unset,
production, test), each with a **wrapped** fetch and a restricted (403) account response. Compatibility is active only for process `NODE_ENV=test` +
opt-in `1` + app env unset or test. In every other combination: no identity, `executeRefund` refused, direct `refundStripe` without a binding refused, and
**zero financial POSTs**. Nine malformed or unavailable identity responses in production (wrong object, bad id, empty, 401, 500, thrown, balance without or
with string `livemode`, balance 403), with the opt-in present: no identity and zero POSTs.
**H2** — distinct same-second events are settled from the authoritative list (completed, balances exact), and the signed evidence is archived as
`event_order_verified` (resolved). Replay is a duplicate; a delayed older event and a later charge total change nothing. With the list unavailable, the
event is acknowledged only after a durable `event_order_conflict` discrepancy and owner notice; there is no invented chronology, refunds are held, and the
owner resolves it exactly once when evidence returns. Evidence superseded during the provider check by a newer committed event is **not** applied over
it: the newer `failed` stands, balances are not restored, and the conflict stays open for the owner.
**H3** — real server (`NODE_ENV=test`, opt-in absent, so the production identity path), two tenants, loopback Account, Balance, PaymentIntent and Refunds:
admission failure, completion (outcome) write failure after the financial effect, and discrepancy storage failure each return HTTP 500. The server stays
up, and tenant B's authenticated request and signed webhook succeed while the fault is active. Redelivery: admitted once, no duplicate financial effect
(3000/7000 exact), one discrepancy, duplicates acknowledged as duplicates. The other tenant's balances are exact. The injected error text never appears
in the log; the fixed message does. Settings check: `{account: verified, balance_mode: test, payment_intent_read: not_checked|verified (with a sample),
refund_read: verified, refund_write: not_checked}`. **Refunds write is explicitly unchecked** and no POST is made.

## E1 documentation
Checkpoint 030 records the environments (`NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1` for historical fixtures; parent unset for production-path suites),
commands, exit codes, Node 22.23.5 and 22.22.0, npm 11.19.1, Express 4.22.3, better-sqlite3 12.4.1. It correctly states that the historical 26/135 results
are compatibility and regression evidence, not identity proof. Checkpoint 025 now carries the E1 note. **Omission:** checkpoint 030 does not report
plain `npm test` without the opt-in (R1).

## Restricted-key connection checks
The route verifies account identity and mode, Refunds read and, with a tenant-local sample payment, PaymentIntent read and mode. It reports PaymentIntent
read as `not_checked` without a sample and Refunds write as `not_checked` always. It never posts. Guidance in checkpoint 030 (Account, Balance and Payment
Intents read; Refunds read and write; webhook secret separate; Connect unsupported) matches the code. No real Stripe account was used.

## Commands and results (Linux x86_64, synthetic data, `package-lock.json` unchanged from the installed tree)
| Command | Env | Node | Tests | Result | Exit |
|---|---|---|---|---|---|
| `node --test --test-concurrency=1 qa/programme/prg03-reacceptance-independent.test.mjs` (unchanged) | `NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1` | 22.23.5 | 26 | 26 pass, 0 fail/todo/skip | 0 |
| same | `NODE_ENV=test` only / opt-in only / both unset | 22.23.5 | 26 | 1 pass, 25 fail each (historical fixtures refused: correct) | 1 |
| Codex's ten-file 135 set | `NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1` | 22.23.5 | 135 | 135 pass, 0 fail/todo/skip | 0 |
| same | unset | 22.23.5 | 135 | 85 pass, 49 fail, 1 cancelled (historical fixtures) | 1 |
| `node --test --test-concurrency=1 qa/programme/prg03-final-acceptance-independent.test.mjs qa/programme/prg03-closure-acceptance.test.mjs` (my 12 + Codex's 6) | unset | 22.23.5 | 18 | 18 pass, 0 fail/todo/skip | 0 |
| same | unset | 22.22.0 | 18 | 18 pass, 0 fail/todo/skip | 0 |
| `node --test --test-concurrency=1 qa/programme/prg03-closure-independent.test.mjs` (new mandatory) | unset | 22.23.5 | 6 | 6 pass, 0 fail/todo/skip | 0 |
| same | unset | 22.22.0 | 6 | 6 pass, 0 fail/todo/skip | 0 |
| `node --test --test-concurrency=1 qa/programme/prg03-final-characterisation.test.mjs` (historical) | unset | 22.23.5 | 3 | 0 pass, 3 fail (classified above) | 1 |
| `npm test -- --manifest` (Render-equivalent, no opt-in) | unset | 22.23.5 | 74 checks | **73/74: contract-test stage failed (R1)**; manifest check passed | **1** |
| `npm test -- --manifest` (documented compatibility env) | `NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1` | 22.23.5 | 74 checks | 74/74 passed (10m59s) | 0 |
| `node scripts/verify-manifest.mjs` | — | 22.23.5 | 954 files | passed | 0 |
| `node scripts/secret-scan.mjs` (review files staged) | — | 22.23.5 | 937 tracked files | passed | 0 |
| `node scripts/memory/validate.mjs` | — | 22.23.5 | — | valid | 0 |
Node 22.22.0 came from the npm registry package `node@22.22.0` and shares the native ABI with 22.23.5, so the installed `better-sqlite3` was reused.
`scripts/verify-all.mjs`: `--manifest` only adds the "file manifest matches" check after the existing stages. The change only adds
`OPRUN_TEST_STRIPE_COMPAT` to the variables passed to contract-test subprocesses (which also get `NODE_ENV=test`); it does not skip any check.

## Remaining gates
1. **R1** fixed and plain `npm test` (no opt-in) passing on the candidate.
2. PRG-08::WEBHOOK-RESILIENCE (W1) allocated and corrected with fault tests; process strategy (N1) decided.
3. Real Stripe test-mode evidence: restricted-key grants including Refunds write, rotation, failure after success, `requires_action`, pagination.
4. Combined-tree run with PRG-02 and PRG-04 and manifest regeneration; Node patch pinned consistently for Render, CI and local (render.yaml 22.22.0; tested 22.22.0 and 22.23.5).
5. Owner release approval.

## Next action
Coordinator: allocate R1 to Codex (small, tests only, unless the owner chooses the build-environment option), and W1 under PRG-08. Claude re-runs plain
`npm test` and the mandatory suites on the next head. No merge, deployment, migration, Stripe operation, refund, recovery upload, deletion or expenditure.
