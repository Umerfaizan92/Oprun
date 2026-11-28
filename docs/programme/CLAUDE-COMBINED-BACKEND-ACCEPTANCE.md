# Combined backend acceptance (PRG-02 + PRG-03 + PRG-04), Checkpoint 037 — Claude

Reviewer: Claude (independent; did not assemble the integration). Integrator: Codex.

| Item | Value |
|---|---|
| Combined branch | `codex/combined-backend-20261128`, remote head `e648524ca6a62d6114049610ab77d5168054a900` (exact match) |
| Tested executable candidate | `5afff00f6d9f1f3173f855ceb39af1e9c283a12e` |
| Integration merge | `8941df9e81230943d6521e3e0254558b231d1455` |
| Review branch | `claude/combined-backend-acceptance-20261128`, from `e648524` |

`e648524` adds only documentation and memory to `5afff00`; `src/`, `scripts/`, `qa/`, `package.json`, `package-lock.json` and `render.yaml` are identical. No runtime code was modified by this review.

## Disposition

**Combined technical acceptance: ACCEPTED.**

- No integration defect was found.
- Every accepted runtime, test and report blob matches its designated source.
- PRG-02 was applied exactly once.
- Every mandatory suite passes with zero failures, cancellations, skips and TODOs on Node 22.22.0 and 22.23.5.
- Plain `npm test` and `npm test -- --manifest` pass on Node 22.22.0 with `NODE_ENV` and `OPRUN_TEST_STRIPE_COMPAT` unset.
- Two new independent cross-programme tests pass (restore and subscriber upgrade).

**Production release readiness: NOT READY.** The preserved gates are listed below, and two observations go to the coordinator (X1, D1-note).

## 1. Integration provenance

### Heads and ancestry

- The merge `8941df9` has first parent `a0a341a` (PRG-03 final acceptance) and second parent `d232b43` (PRG-04 final acceptance).
- The only merge base is `9c6cf3edb279ca7200032547f970913425610547`.
- `a92db4a` is reachable only through `a0a341a`. `766fa58` and `e8ee522` are reachable only through `d232b43`. Main `234f56d` and `9c6cf3e` are reachable through both.
- Post-merge commits:
  - `20b0a8c`: combined restore test.
  - `d88e2e4`: qualifies the PRG-04 checkpoint headings.
  - `5afff00`: finance browser fixture.
  - `e648524`: checkpoint 036 document.

### Blob comparison

Every non-memory, non-manifest path that changed since `9c6cf3e` was compared at the candidate:

- 33 financial-side paths against `a0a341a`;
- 20 foundation-side paths against `d232b43`.

All 53 match exactly, and no path changed on both sides.

The post-merge executable changes are limited to:

- `qa/programme/combined-backend-restore.test.mjs` (new);
- `scripts/test-finance-ui.mjs` (fixture only).

Two documents in the merge came from neither parent:

- `PRG08-INTEGRATION-VERIFICATION-2026-11-28.md` matches receipt `a026c68` exactly.
- `CONTROLLED-INTEGRATION-PREPARATION-022.md` is preparation `3ecea1d` plus an appended "Checkpoint 036 integration sequence" section. The change is 12 added lines and no removals.

### PRG-02 was applied once

- PRG-02's commits are not ancestors, by design. The content entered the PRG-03 side once, through `22ef8fd`.
- `src/job-queue.js`, `scripts/programme-queue-isolation.test.mjs` and `docs/programme/CLAUDE-PRG02.md` match `44fb79c` exactly.
- `qa/programme/queue-independent-review.test.mjs` and `docs/programme/PRG02-ACCEPTANCE-2026-11-28.md` match `a88d777` exactly.
- `git log` shows `src/job-queue.js` changed in exactly one programme commit (`22ef8fd`). It is not touched on the PRG-04 side.

### Conflict resolutions

| File | What I found |
|---|---|
| `CHECKPOINTS.md` | Zero lines removed relative to either parent. The only later edit is `d88e2e4`, which renames the two PRG-04 headings to `PRG-04 / CP-254` and `PRG-04 / CP-255`. The originals are reachable in `d232b43`. |
| `PROGRESS.md` | Zero lines removed relative to either parent. |
| `SESSION_HANDOVER.md` | The active block was replaced, as documented. Previous blocks are reachable in the parents. |
| `SHA256SUMS.txt` | `verify-manifest` passes (979 files) and the `--manifest` build check passes. |

### Preserved evidence

All earlier Claude and Codex PRG-02, PRG-03 and PRG-04 review files, characterisations and reports are among the matching blobs. No accepted security control or assertion was removed. The finance UI change leaves all 25 assertion calls and 10 `check(...)` lines byte-identical. Only the loopback Stripe stand-in changed: it now requires the business key's Bearer header and serves Account, Balance and PaymentIntent reads in test mode.

## 2. Combined runtime review

**Runtime coupling:**

- PRG-03 touches `payments.js`, `finance/*` and `stripe-refunds.js`. PRG-02 touches `job-queue.js`. PRG-04 touches `workspace-configuration*`, plus one line each in `server.js`, `saas-platform.js` and `diagnostics.js`.
- No runtime file is shared between the programmes.
- Payments, finance, revisions and exports do not use the job queue.
- The programmes interact only through the shared SQLite database, the startup sequence and the tenant data export.

**Startup and schema:**

- `installWorkspaceConfiguration` runs before `installPayments`, `createJobQueue` and `createFinance`, and their tables are disjoint.
- A database written by the current production baseline (main `234f56d`) upgrades cleanly under the combined server (test 2 below). Every legacy row and stored credential is unchanged.
- The audit chain verifies, no revision is invented, and `refunded_cents` is added with zero.
- The legacy industry appears as revision 0.
- Stored Stripe settings still work and now verify stable account identity.
- Separately, the original-tree adoption test runs against the exact checkout `e8ee522`.

**Owner authority and staff:**

- Revision approval and rollback re-check active ownership inside a synchronous `BEGIN IMMEDIATE` transaction.
- Staff are refused (403) for workspace read and approval and for data export, before and after restore. Staff cannot request a refund.
- Finance roles are owner, admin and super_admin.

**Concurrency:** revision writes are synchronous transactions with no await inside them. Refund flows keep the PRG-03 attempt, lifecycle and outcome guards. The queue's dedupe and conflict check is a single transaction. No cross-programme lock ordering exists to deadlock.

**Financial holds and reconciliation (test 1 below):**

- A refund made through the real approval path that Stripe answers with `pending` stays `submitted`, with no balance change. It survives restore.
- A restored server makes zero provider writes on start.
- After restore, the refund settles exactly once from a signed `refund.updated` event. A redelivery is reported as a duplicate, and the later cumulative `charge.refunded` total adds nothing. Balances end exact (A: 4000/6000; B untouched at 0/10000).
- An event signed with A's webhook secret is refused for B.

**Queue confidentiality and idempotency:** A's key remains A's after restore. B gets `IDEMPOTENCY_KEY_CONFLICT`, and the same tenant and type dedupes to the restored row. This holds for keys created by the main baseline too.

**Workspace revisions:** approval 1, approval 2 and rollback to 1 (revision 3, `restored_from` 1) survive restore. They export with their provenance.

**Exports:**

- After restore, each owner's export contains no identifier of the other tenant.
- Every exported row that has an `organisation_id` belongs to the exporting tenant.
- Export requires the owner role.

### Observations returned to the coordinator (not integration defects)

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| X1 | Medium; release gate, pre-existing | The tenant data export (`/api/saas/data-export`) omits the finance ledger (`fin_lines`, `fin_refunds` and related tables), `job_payments` and `background_jobs`. This was already true on main `234f56d`. PRG-03's new evidence tables (`fin_stripe_refund_attempts`, `_lifecycle`, `_discrepancies`, `_totals`) are also absent. This is an export-completeness gap, not a combined regression or a tenant leak. I suggest allocating it with the L1/L2 export hardening. | `src/saas-platform.js` export map; `git show 234f56d:src/saas-platform.js` |
| D1-note | Information for the D1 runbook | A restore must use the source's `INTEGRATION_ENCRYPTION_KEY`. With a different key, every signed Stripe webhook for a tenant with stored credentials fails closed: the response is a retryable HTTP 500 with the sanitised log message, and no row changes. This is safe, but webhooks stop until the key is corrected. I found it with a diagnostic copy outside the repository. The caught error was "Stored integration credentials cannot be decrypted with the current integration key". | diagnostic run (scratch copy, not committed) |
| M1 | Low; records | `.claude/project-memory/DECISIONS.md` has two different decisions numbered `D-095` (T-272 precision, and PRG-02 queue scope). `memory:validate` does not detect this. D-096 maps task IDs but not this collision. | DECISIONS.md lines 99 and 101 |
| M2 | Information | PRG-02's branch-local `T-271` pending entry was not carried into `PENDING_TASKS.md`. The shared register uses T-280 for the queue under D-096, and the PRG-02 acceptance is recorded in `PRG02-ACCEPTANCE-2026-11-28.md`. | PENDING_TASKS.md |

## 3. New independent tests

`qa/programme/combined-acceptance-independent.test.mjs` has 2 mandatory tests. It needs `LITESTREAM_BIN` (it checks the binary's SHA-256 and version) and `OPRUN_MAIN_TREE` pointing at a detached `234f56d` checkout. It asserts that `NODE_ENV` and `OPRUN_TEST_STRIPE_COMPAT` are unset.

1. **Real pending refund, rollback history and tenant-bound queue across a Litestream file restore.** Covers no provider write on restart, exactly-once settlement afterwards, staff refusal, and tenant-pure exports.
2. **Main-baseline subscriber database upgraded by the combined server.**

## 4. Commands and results

### Environment

| Item | Version |
|---|---|
| Node | 22.22.0 (primary, Render pin) and 22.23.5, both ABI 127 |
| npm | 10.9.9 (Codex reported 11.19.1) |
| better-sqlite3 | 12.4.1 |
| Express | 4.22.3 |
| Playwright | 1.62.1 |
| Lockfile | identical to main and to the installed tree |
| Litestream | v0.3.13, installed with the repository installer (archive SHA-256 pinned). Binary SHA-256 `bbd8b9ba…6f957bb`, matching the combined test's pin. |

Suites ran with the parent environment unset (`env -u NODE_ENV -u OPRUN_TEST_STRIPE_COMPAT`) unless stated otherwise. The builds ran from a clean `env -i` (PATH, temporary HOME, `SUPERPRO_SKIP_DOTENV=1`, `LITESTREAM_BIN`) in a detached checkout of `5afff00`. I confirmed `NODE_ENV` and `OPRUN_*` were absent inside the npm subprocesses. Each run's generated `qa/reports` files were restored.

### Mandatory suites

All rows: 0 fail, 0 cancelled, 0 skipped, 0 todo, exit 0.

| Suite | Files | Node 22.22.0 | Node 22.23.5 |
|---|---|---|---|
| Queue | `qa/programme/queue-independent-review.test.mjs`, `scripts/programme-queue-isolation.test.mjs` | 22/22 | 22/22 |
| Strict financial | `prg03-final-acceptance-independent`, `prg03-closure-acceptance`, `prg03-closure-independent` | 24/24 | 24/24 |
| Finance and currency | `scripts/finance.test.mjs`, `scripts/programme-payment-currency.test.mjs` | 29/29 | 29/29 |
| Foundation and operability | `PRG04_ORIGINAL_TREE=<e8ee522 checkout>` with `prg04-final-acceptance-independent`, `workspace-configuration`, `workspace-configuration-operability` | 15/15 | 15/15 |
| Additional backend | tenant-isolation, integration-tenant, release-security, db-schema, country-rules, module-rules, onboarding-interview, onboarding-proposal | 59/59 | 59/59 |
| Restore drills | `scripts/restore-drill.test.mjs`, `qa/programme/combined-backend-restore.test.mjs` (with `LITESTREAM_BIN`) | 2/2, executed, not skipped | 2/2 |
| New Claude combined tests | `OPRUN_MAIN_TREE=<234f56d checkout>` with `qa/programme/combined-acceptance-independent.test.mjs` | 2/2 | 2/2 |

### Historical compatibility

These ran with `NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1`. They are regression evidence only, not production-path proof.

| Suite | Node 22.22.0 | Node 22.23.5 | Exit |
|---|---|---|---|
| 26-test re-acceptance suite | 26/26 | 26/26 | 0 |
| Ten-file 135 set | 135/135 | 135/135 | 0 |

### Build and static checks

| Command | Result | Exit |
|---|---|---|
| `npm test` (Node 22.22.0, clean, unset) | **73/73**; 134 contract files pass (11m23s) | **0** |
| `npm test -- --manifest` (Node 22.22.0, clean, unset) | **74/74**; manifest matches (11m35s) | **0** |
| `npm audit --omit=dev --json` (Node 22.22.0) | 0 vulnerabilities (217 production dependencies) | 0 |
| `node scripts/verify-manifest.mjs` | passed, 979 files | 0 |
| `node scripts/secret-scan.mjs` (review files staged) | passed | 0 |
| `node scripts/memory/validate.mjs` | valid | 0 |

### Browser checks

These ran on Node 22.22.0, see the limitation note below.

| Command | Result | Exit |
|---|---|---|
| `npm run test:ui` | 37 checks passed | 0 |
| `npm run test:onboarding-ui` | 5 checks passed | 0 |
| `npm run test:finance-ui` | 12 checks passed | 0 |
| `npm run test:reel-maker-ui` | Upload, suggested words, generation, playback, draft, layouts and accessibility passed | 0 |
| `npm run verify:modules` | 66 modules checked, 0 with problems | 0 |

## 5. Historical characterisations (classified; not counted)

All ran on Node 22.22.0.

| File | Env | Result | Classification |
|---|---|---|---|
| `qa/programme/prg04-independent-backend-review.test.mjs` | unset | 8 pass, 2 fail | Cases 8 and 10 are obsolete expectations (implicit installer prerequisite; revision export missing). The corrected behaviour is covered by the O3/O4 acceptance suite. Matches Codex's report. |
| `qa/programme/prg04-final-characterisation.test.mjs` | unset | 2/2 pass | Documents the L1/L2 limitations. They are **not** resolved. |
| `qa/programme/prg03-reacceptance-characterisation.test.mjs` | compat | 0 pass, 3 fail | G1–G3 defects, corrected on the mandatory paths. |
| `qa/programme/prg03-final-characterisation.test.mjs` | unset | 0 pass, 3 fail | H1–H3 defects, corrected on the mandatory paths. |
| `qa/programme/prg03-independent-financial-review.test.mjs` (original F1–F4 review) | compat | 9 pass, 18 fail, 5 TODO | Pre-correction review. The result is **identical** on the accepted PRG-03 tree `a0a341a`, so it is not an integration regression. The F1–F4 behaviour is covered by the mandatory financial suites. |

## 6. Limitations

- **Browsers:** the pinned Playwright Chromium (151, revision 1234) could not be downloaded. The checks used the preinstalled Chrome for Testing build mapped to that revision directory; the headless shell reported version 158.0.8127.36.
- **npm:** 10.9.9 here, not 11.19.1.
- **Data:** all evidence is synthetic and local. It includes no real Stripe account, no production database and no remote backup target.
- The D1-note was observed with a scratch diagnostic copy whose catch boundary was changed to log the error. That copy was not committed and is not acceptance evidence.

## 7. Preserved release gates

1. PRG-08 P1: account-deletion integrity.
2. PRG-08 W1: webhook resilience (PayPal, platform Stripe and Square, Resend) and the restart decision.
3. L1/L2 revision and export hardening (suggested to include X1).
4. D1 startup recovery runbook, including the integration-key requirement in the D1-note.
5. Production backup and recovery evidence.
6. Authorised Stripe test-mode verification.
7. Restricted-key permissions, including Refunds write.
8. Runtime alignment of Node and npm across Render, CI and local.
9. Owner release approval.

T-274 remains design-only. PRG-05 and PRG-07 remain reserved. No main merge, deployment, production migration, provider operation, real refund, deletion, recovery upload, expenditure or production configuration change took place.
