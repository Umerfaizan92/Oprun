# PRG-03: Final R1 acceptance by Claude

Reviewer: Claude, independent of the fixture correction. Implementer: Codex.

| Item | Value |
|---|---|
| Correction branch | `codex/prg03-r1-20261128`. The remote head matches `a92db4a45f4a9d672e23d86fbcf2a8c4293db86f` exactly. |
| Tested candidate | `17997456759f97007e60b66a3662395800865d75`. `src/`, `scripts/`, `qa/`, `package.json`, `package-lock.json` and `render.yaml` are identical in a92db4a. |
| Ancestry (verified) | `556ecb6` (my closure review) → `1799745` → `a92db4a` |
| Review branch | `claude/prg03-r1-acceptance-20261128`, created from `a92db4a` |

Codex's runtime code and branches were not modified.

## Disposition

**Isolated PRG-03 technical acceptance: ACCEPTED.** R1 is resolved, and the Render build command passes on Node 22.22.0 with no compatibility opt-in. No regression was shown. H1–H3, E1, F1–F4 and G1–G3 still pass their strict production-path suites. PRG-03 technical acceptance is closed.

**Production release readiness: NOT READY.** The separate gates are listed below. This acceptance does not approve a release.

## Scope of the change (556ecb6..a92db4a)

Changed files:

- `scripts/finance.test.mjs`: +9/-2
- `scripts/programme-payment-currency.test.mjs`: +36/-9
- `SHA256SUMS.txt`
- `docs/programme/PRG03-R1-CHECKPOINT-034.md` (new)
- `.claude/project-memory/CHECKPOINTS.md`: +4 lines, append-only

Nothing in `src/`, `package.json`, `package-lock.json`, `render.yaml`, `scripts/verify-all.mjs` or `scripts/test-server.mjs` changed. No production runtime, deployment configuration or dependency changed.

## Fixture review

**Finance mock:**

- Answers `GET /v1/account` (`acct_FinanceFixture`) and `GET /v1/balance` (`livemode: false`) only for the business key's Bearer header.
- Answers `GET /v1/payment_intents/{pi_test_2, pi_ambiguous}` (AUD, `livemode: false`, succeeded) the same way.
- The refund, checkout and ambiguous-refund responses are unchanged.
- Both signed `charge.refunded` events now carry `livemode: false`, which matches the test-mode account.
- Every balance, idempotency, approval and authorisation assertion is unchanged.

**Currency fixture:**

- Serves realistic Account, Balance and PaymentIntent reads, with the PaymentIntent in each currency under test.
- Records those reads separately from financial calls.
- Returns 404 for any unexpected request.
- Its refund helper calls the production export `refundAccount(org)` and passes the verified binding to `refundStripe`, the same route the approval workflow uses.
- Signed events carry `livemode: false`.
- Assertions are preserved or strengthened:
  - minor-unit amounts are unchanged;
  - the approved refund must now have read the PaymentIntent;
  - the foreign-tenant refusal must make zero identity reads and zero calls;
  - fractional and inexact refusals still dispatch nothing.
- The test "fractional JPY refund is rejected before any provider request" was renamed to "…without dispatching a provider refund". This is accurate: identity reads now come before the precision refusal, but no refund POST is made.

**No authentication bypass:**

- With the parent `NODE_ENV` and `OPRUN_TEST_STRIPE_COMPAT` unset, `syntheticCompatibility` and `legacyFixture` are false.
- The fixtures therefore pass the real `refundAccount` Account and Balance validation, not the fallback.
- No webhook signature, role or tenant check is relaxed.

## Commands and results

All runs were on Linux x86_64 with synthetic data. `package-lock.json` is identical to the installed dependency tree (better-sqlite3 12.4.1).

Clean environment for the Render-equivalent runs, launched with `env -i`:

```text
PATH=<node 22.22.0 bin>:/opt/node22/bin:/usr/local/bin:/usr/bin:/bin
HOME=<temp>
SUPERPRO_SKIP_DOTENV=1
LITESTREAM_BIN=<isolated v0.3.13>
```

I confirmed that `NODE_ENV` and `OPRUN_TEST_STRIPE_COMPAT` were absent inside npm script subprocesses. Litestream v0.3.13 was installed into an isolated tool directory with the repository's own installer, which verified the pinned SHA-256.

| Command | Parent env | Node | Result | Exit |
|---|---|---|---|---|
| `node --test --test-concurrency=1 --test-name-pattern='adjustment notes and refunds need approval\|an ambiguous Stripe refund holds the payment\|AUD: approved refund sends' scripts/finance.test.mjs scripts/programme-payment-currency.test.mjs` | unset | 22.22.0 | 3/3; 0 fail, 0 skipped, 0 todo | 0 |
| `node --test --test-concurrency=1 scripts/finance.test.mjs` | unset | 22.22.0 | 8/8; 0 fail, 0 skipped, 0 todo | 0 |
| `node --test --test-concurrency=1 scripts/programme-payment-currency.test.mjs` | unset | 22.22.0 | 21/21; 0 fail, 0 skipped, 0 todo | 0 |
| `npm test` (Render build command) | clean, unset | 22.22.0 | **73/73 checks passed**; 132 contract files pass (11m24s) | **0** |
| `npm test -- --manifest` | clean, unset | 22.22.0 | **74/74 checks passed** (11m36s) | **0** |
| `node --test scripts/restore-drill.test.mjs` (with `LITESTREAM_BIN`) | clean, `NODE_ENV=test` | 22.22.0 | 1/1, not skipped; restore integrity, audit chain and counts verified | 0 |
| `node --test --test-concurrency=1 qa/programme/prg03-final-acceptance-independent.test.mjs qa/programme/prg03-closure-acceptance.test.mjs qa/programme/prg03-closure-independent.test.mjs` | unset | 22.22.0 | 24/24; 0 fail, 0 cancelled, 0 skipped, 0 todo | 0 |
| same | unset | 22.23.5 | 24/24; 0 fail, 0 cancelled, 0 skipped, 0 todo | 0 |
| `node --test --test-concurrency=1 qa/programme/prg03-reacceptance-independent.test.mjs` (historical) | `NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1` | 22.23.5 | 26/26; 0 skipped, 0 todo | 0 |
| Codex's ten-file 135 set (as listed in checkpoint 034) | `NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1` | 22.23.5 | 135/135; 0 skipped, 0 todo | 0 |
| `node scripts/verify-manifest.mjs` | — | 22.23.5 | passed, 957 files | 0 |
| `node scripts/secret-scan.mjs` (review files staged) | — | 22.23.5 | passed | 0 |
| `node scripts/memory/validate.mjs` | — | 22.23.5 | valid | 0 |

Notes on the results:

- The 24 strict tests are my 12 production-path tests, Codex's 6 closure tests and my 6 closure-independent tests.
- In the historical suites, compatibility mode is explicitly enabled. These results are regression evidence only, not production-path identity proof. Production-path verification comes from the 24 strict tests and from the R1 files and `npm test` runs with the variables unset.
- Each run's generated `qa/reports/tenant-sweep.json` was restored with `git checkout`.

**CP-257 correction:** the addition is append-only, with zero lines removed, and leaves the original generated record intact. It is accurate. The generated record captured the pre-commit checkout `40fbc4e` and "tests: none" because the checkpoint was written before the commit and without `--verified`. The signed-off evidence is in `CLAUDE-PRG03-CLOSURE-ACCEPTANCE.md` at `556ecb6`.

**Preserved evidence:** every earlier Claude PRG-03 test, worker, characterisation and report file is byte-identical between `556ecb6` and `a92db4a`.

## Limitations

- npm here is 10.9.9. Codex reported 11.19.1, and Render uses its bundled npm.
- Node 22.22.0 came from the registry package `node@22.22.0` and reused the installed native module, which shares the same ABI.
- The verify-all contract stage does not print subtest skip counts. I ran the one file that skips conditionally, the restore drill, separately to show it is not skipped.

## Remaining gates (separate from this acceptance)

1. PRG-08 P1, W1 (webhook resilience: PayPal, platform Stripe/Square and Resend handlers) and the L1/L2 hardening.
2. Provider verification with real Stripe test-mode evidence, including the restricted-key grants (with Refunds write), rotation, failure after success, `requires_action` and pagination.
3. Recovery: the D1 runbook and an owner-approved recovery upload.
4. The combined candidate with PRG-02 and PRG-04 and a regenerated manifest. The Node patch pin must be consistent across Render, CI and local.
5. Owner release approval.

No main merge, deployment, migration, provider account operation, real refund, deletion, recovery upload or expenditure took place.
