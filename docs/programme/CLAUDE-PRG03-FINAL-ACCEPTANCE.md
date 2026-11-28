# PRG-03 — Final independent acceptance of G1–G3 (Claude)
Reviewer: Claude (independent; did not write the corrections). Implementer: Codex.
Correction branch: `codex/prg03-g1-g3-20261128`, remote head `fb855ce9c8e7a81853403f1e66ce29896a41dcb6` (checked: exact match).
Tested candidate: `8d7f8dfffb54793f5f2d9585a1ba05f5fa7b1487` (parent of fb855ce; `src/`, `qa/`, `scripts/` identical).
Ancestry (verified): `0b86b34` → `09fcd0b` → `3d00fec` → `431b448` (my re-acceptance) → `2dba1d6` → `8d7f8df` → `fb855ce`.
Review branch: `claude/prg03-final-acceptance-20261128`, created from `fb855ce`. Codex's runtime code and branches are not modified.
Previous evidence preserved: my original review, re-acceptance suite, worker, characterisation and reports are byte-identical at fb855ce (`git diff --quiet 431b448 fb855ce -- …`).

## Changed files (431b448..8d7f8df)
`src/payments.js` (+119), `src/finance/stripe-refunds.js` (+78), `src/finance/service.js` (+106), `src/finance/routes.js` (+12: discrepancy list and
resolve routes, legacy account fields), `qa/programme/prg03-g1-g3-acceptance.test.mjs` (new), one line in Codex's earlier acceptance suite,
`SHA256SUMS.txt`; then `docs/programme/PRG03-FINANCIAL-CHECKPOINT-025.md` and project memory (fb855ce).

## Disposition
**Technical acceptance: CONDITIONALLY ACCEPTED.** G1, G2 and G3 are met on the **production code path** (separate processes,
`NODE_ENV=production`, default `fetch`, no synthetic compatibility path available), F1–F4 remain intact, and no defect moves
money wrongly, crosses tenants or accounts, or sends an extra financial POST. Conditions H3 (availability) and H1 (fail-open
test fallback) must be fixed before integration; H2 and E1 are lower-severity items to fix or record.
**Production release readiness: NOT READY.** See "Release gates": real Stripe test-mode verification, combined-tree run,
restricted-key permissions, Connect exclusion and the conditions below.

## Findings
| ID | Severity | Summary | Affected files | Evidence |
|---|---|---|---|---|
| H3 | **Medium (availability)** | When recording a G3 discrepancy fails (storage error), the error is thrown inside the webhook's `catch` block of an `async` Express 4.22.3 handler. No `unhandledRejection` handler exists, so Node 22 terminates the **whole server process**; every tenant on the instance loses service until restart. Integrity holds: nothing is acknowledged, the event row keeps `outcome IS NULL`, and redelivery records the discrepancy once. The same pattern affects the statements after the `try` (pre-existing). | `src/payments.js` (Stripe webhook handler) | characterisation H3 (real server); mandatory G3 storage test shows integrity |
| H1 | **Medium (latent, fail-open)** | The synthetic compatibility fallback is enabled by `fetchImpl !== globalThis.fetch`, not by an explicit test flag. Today `server.js` passes no `fetchImpl` and the AI shim replaces `globalThis.fetch` at import time, before `installPayments`, so production cannot reach it (verified). But any future caller passing a wrapper (tracing, proxy) would make every account-identity failure (403 restricted key, 5xx) fall back to the key fingerprint **in production**, and a financial POST is then sent without a verified account. | `src/payments.js` (`legacyFixture`, `refundAccount`, refund webhook continuity) | characterisation H1 |
| H2 | Low | Lifecycle ordering ignores any event whose Stripe `created` second is `<=` the last recorded one. Two genuine transitions in the same second (e.g. requires_action then succeeded) drop the second; it is acknowledged as `ignored` and the request stays reserved until an owner reconciles from the authoritative list (which works). | `src/finance/stripe-refunds.js` (`transition`) | characterisation H2 |
| E1 | Low (evidence) | Codex's reported 26/26 and 135/135 hold **only with `NODE_ENV=test`**, which the checkpoint does not record. Without it the separate-process tests fail because the stand-ins lack `/v1/account` and the candidate correctly refuses. In `NODE_ENV=test` (and in every in-process fixture, because a custom `fetchImpl` is passed) G2 runs through the synthetic fingerprint path, so those suites are F1–F4 regression evidence, **not** G2 evidence. G2 is established by the new production-path suite. | `docs/programme/PRG03-FINANCIAL-CHECKPOINT-025.md` | runs below |

## Requirement verification (production path unless noted; `qa/programme/prg03-final-acceptance-independent.test.mjs`)
**G1** — failure after success: an exact signed `refund.failed` (and a concurrent `refund.updated` failed) compensates payment and job balances once, in the
same transaction as the status change and an append-only lifecycle row; owner in-app notice and `finance.refund_failed_after_success` audit; replay is a
duplicate; a delayed older success and a later conflicting success cannot undo it (conflict notice); a lower charge total never reverses by itself; the
request row is retained, the journal refuses UPDATE and DELETE, the audit chain verifies; no financial POST. `requires_action` without a next action is
not a reversal (chronology notice); with `next_action` it reopens the reservation and a later success settles it exactly once. An undated failure is held
and the owner reconciles it from the authoritative provider record. Same-second ordering: H2.

**G2** — identity is `stripe:<account id>:<test|live>` from `GET /v1/account` and `GET /v1/balance`; restricted (403), failing (500) and unknown keys yield no
identity and **no fallback** in production, and send no POST. Same-account rotation: a held refund (response lost) reconciles, and a pending refund completes
from a signed `refund.updated`, with no second POST. A different account or the live mode of the same account cannot settle, reconcile or add refunds to a
bound payment, and nothing is posted to the substituted account; a live event against a test binding is refused. The payment intent must belong to the
verified account before any POST. Webhook authentication is independent of the API key: a forged signature is refused before any provider read, and events
still verify after API-key rotation. Tenant isolation: bindings and claims are scoped by organisation (unchanged queries; F1 tests). Legacy fingerprint claims
and owner-authorised upgrade (account, mode, refund ID, evidence reference, exact metadata) were reviewed in code and are exercised by Codex's G2 case
(synthetic). Connect events remain ignored (unchanged; F1 test). Ambiguous provider evidence keeps holds (re-acceptance suite).

**G3** — admin-lowered `paid_cents`: the webhook returns 200 only after a transaction stores the provider evidence, the discrepancy and an owner notice;
payment and job are unchanged; duplicate delivery adds nothing; new refunds are blocked; the owner cannot resolve while balances still conflict; after the
authorised local correction the owner resolves it from read-only provider evidence, the refund completes, totals are exact, the resolution is audited to the
owner, and no financial POST is sent. Storage failure is never acknowledged and redelivery recovers (integrity), but crashes the server (H3).

**F1–F4** — unchanged 26-test re-acceptance suite passes 26/26 (with `NODE_ENV=test`; see E1); separate-process overlap on the production path posts once
per request and settles exactly.

## Commands and results (Linux x86_64, Node v22.23.5, `package-lock.json` unchanged from the installed tree, synthetic data)
| Command | Env | Tests | Result | Exit |
|---|---|---|---|---|
| `node --test --test-concurrency=1 qa/programme/prg03-reacceptance-independent.test.mjs` (unchanged) | `NODE_ENV=test` | 26 | 26 pass, 0 fail, 0 todo, 0 skip | 0 |
| same | unset | 26 | 22 pass, 4 fail (separate-process tests: stand-in has no `/v1/account`) | 1 |
| Codex's ten-file set (`qa/programme/prg03-g1-g3-acceptance.test.mjs … scripts/tenant-isolation.test.mjs`, as in his checkpoint) | `NODE_ENV=test` | 135 | 135 pass, 0 fail, 0 todo, 0 skip | 0 |
| same | unset | 135 | 132 pass, 3 not ok (separate-process tests) | 1 |
| `node --test --test-concurrency=1 qa/programme/prg03-final-acceptance-independent.test.mjs` (new, production path; workers run with `NODE_ENV=production`; 4 runs) | unset in parent | 12 | 12 pass, 0 fail, 0 todo, 0 skip, every run | 0 |
| `node --test --test-concurrency=1 qa/programme/prg03-final-characterisation.test.mjs` (H1–H3 current behaviour) | unset | 3 | 3 pass | 0 |
| `npm test` (scripts/verify-all.mjs) | unset | 73 checks; 132 contract files | ALL CHECKS PASSED 73/73, 10m43s | 0 |
| `node scripts/verify-manifest.mjs` | — | 948 listed files | PASS (review files are not listed; coordinator regenerates on the integration tree) | 0 |
| `node scripts/memory/validate.mjs` | — | — | PASS | 0 |
| `node scripts/secret-scan.mjs` (review files staged) | — | 933 tracked files | PASS | 0 |
`npm test` runs only `scripts/*.test.mjs`; every `qa/programme/` suite above was executed explicitly.

## Stripe contracts checked (official documentation; simulated, no provider account used)
Account retrieval (`GET /v1/account` returns the account `id`), balance (`livemode`), payment intent retrieval, refund object and lifecycle (failure after
success, `requires_action` with `next_action`), list refunds pagination, API keys (rotation keeps the account; restricted keys have per-resource
permissions), errors. All behaviour in the tests is a stand-in.

## Release gates
1. **H3** fixed: the Stripe webhook handler never lets a storage error escape (catch, log, return 500 without acknowledging), and a process-level guard is decided for the server.
2. **H1** fixed: the compatibility fallback is gated on an explicit test-only flag (for example `NODE_ENV==='test'`), with a test that a wrapped `fetchImpl` under `NODE_ENV=production` gets no fallback.
3. H2 tie-break (same-second events) fixed or recorded as accepted; E1 corrected in the checkpoint (record `NODE_ENV`).
4. Restricted-key permissions documented and checked at connection time (account read, balance read, payment-intent read, refunds write and read), since an under-permissioned key now blocks refunds.
5. Stripe test-mode verification of rotation, failure after success, `requires_action` and list pagination on a real account before live use; Connect remains unsupported.
6. Combined-tree run with PRG-02 and PRG-04 and `SHA256SUMS.txt` regeneration by the coordinator; Render's `NODE_VERSION` (22.22.0 in `render.yaml`) versus the tested 22.23.5 noted.

## Next action
Coordinator: allocate H3 and H1 (and H2, E1) to Codex; Claude re-runs `prg03-final-acceptance-independent.test.mjs` and the characterisation file on the
next head. No merge, deployment, migration, Stripe account operation, real refund, recovery upload, deletion or expenditure.
