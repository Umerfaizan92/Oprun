# Checkpoint 034 — PRG-03 R1 build compatibility

## Candidate and scope

- Frozen runtime: `e247fefc47595e0809773435b59b5636f029ce82`.
- Published H1–H3/E1 correction: `40fbc4e28bafffb7192574c54a73cf0927c88712`, a direct child of the frozen runtime.
- Independent closure review: `556ecb6af9bb552512912f9c1497f8ae703f84f1`, a direct child of the published correction. Its branch is `claude/prg03-closure-acceptance-20261128`.
- Tested R1 candidate: `17997456759f97007e60b66a3662395800865d75`, a direct child of the review on `codex/prg03-r1-20261128`. T-271 covers the financial regression. PRG-08 owns W1 separately.

The finance server fixture replies to authenticated Account, Balance and PaymentIntent reads for its synthetic business. Both fixtures supply the mode on signed refund events. The currency fixture obtains a verified stable binding before exercising the refund entry point. Its identity reads are tracked separately from operations. The fractional refund still checks for a precision error and zero refund dispatches. The frozen runtime performs read-only identity verification before rejecting the precision error. The existing financial assertions and independent review evidence are preserved.

## Environment

`npm ci --cache /tmp/oprun-ci-0 --no-audit --no-fund --fetch-retries=0` installed 266 locked dependencies on Node 22.22.0 (exit 0). Both runtimes used npm 11.19.1 and the same locked native SQLite module (better-sqlite3 12.4.1). Render pins Node 22.22.0. Node 22.23.5 is the historical acceptance runtime.

The reported test and static verification commands started with `env -i`. The parent environment contained only the entries below. The historical suites additionally set `NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1`. All other verification commands left both variables unset. The existing contract runner sets `NODE_ENV=test`, `SUPERPRO_SKIP_DOTENV=1`, and temporary `HOME` and `USERPROFILE` in its subprocesses. Test server helpers supply isolated storage, loopback endpoints, synthetic credentials and test-specific fixture settings. The production-path independent suites exercise production settings explicitly within their own harnesses.

```text
PATH=/tmp/<runtime>/node_modules/.bin:/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/local/bin:/usr/bin:/bin
HOME=/tmp/oprun-r1-home
SUPERPRO_SKIP_DOTENV=1
LITESTREAM_BIN=/tmp/oprun-restore-tool/litestream
```

`<runtime>` is `oprun-node22220` for Node 22.22.0 and `oprun-node22` for Node 22.23.5. Litestream v0.3.13 supplies the local synthetic backup and restore checks.

## Verification commands

```sh
node --test --test-name-pattern='adjustment notes and refunds need approval|an ambiguous Stripe refund holds the payment|AUD: approved refund sends' scripts/finance.test.mjs scripts/programme-payment-currency.test.mjs
node --test scripts/finance.test.mjs scripts/programme-payment-currency.test.mjs
node --test qa/programme/prg03-final-acceptance-independent.test.mjs qa/programme/prg03-closure-acceptance.test.mjs qa/programme/prg03-closure-independent.test.mjs
npm test
npm test -- --manifest
NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1 node --test --test-concurrency=1 qa/programme/prg03-reacceptance-independent.test.mjs
NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1 node --test qa/programme/prg03-g1-g3-acceptance.test.mjs qa/programme/prg03-financial-corrections-acceptance.test.mjs qa/programme/queue-independent-review.test.mjs scripts/programme-queue-isolation.test.mjs scripts/finance.test.mjs scripts/programme-payment-currency.test.mjs scripts/country-rules.test.mjs scripts/db-schema.test.mjs scripts/release-security.test.mjs scripts/tenant-isolation.test.mjs
node scripts/update-manifest.mjs
node scripts/verify-manifest.mjs
node scripts/secret-scan.mjs
node scripts/memory/validate.mjs
```

## Results

| Verification | Node | Result | Exit |
|---|---|---|---:|
| Three R1 cases | 22.22.0 and 22.23.5 | 3/3 on each | 0 |
| Complete finance and currency files | 22.22.0 and 22.23.5 | 29/29 on each | 0 |
| Three strict production-path and closure files | 22.22.0 and 22.23.5 | 24/24 on each | 0 |
| Historical independent acceptance, explicit compatibility opt-in | 22.23.5 | 26/26 | 0 |
| Historical ten-file regression, explicit compatibility opt-in | 22.23.5 | 135/135 | 0 |
| Plain `npm test`, compatibility unset | 22.22.0 | 73/73 checks, including 132 contract test files | 0 |
| `npm test -- --manifest`, compatibility unset | 22.22.0 | 74/74 checks, including 132 contract test files and manifest match | 0 |
| Manifest verification, secret scanning, project-memory validation | 22.22.0 | All passed | 0 each |

All targeted, complete-file, strict and historical suites reported zero failures, skips, cancellations and TODOs on the tested candidate. Each build's synthetic tenant sweep completed 4,555 requests with zero leaks, foreign-row changes or server errors. The build runner reports contract files and top-level checks.

Earlier attempts were excluded from acceptance. The first build launch returned exit 127 because the isolated path omitted npm. An intermediate fixture revision passed the three targeted tests but failed six signed Charge cases in the complete files (23/29, exit 1) and in the historical ten-file suite (129/135, exit 1) because the shared currency event omitted `livemode`. Both final build commands used the corrected fixture and a path containing npm.

## Remaining release gates

R1 is ready for independent confirmation on this branch. Combined integration requires coordinator authorisation. PRG-08 retains W1 and the process restart decision. Owner-attested Stripe test-mode capability and credential rotation evidence, restricted permissions, production release approval, and combined-tree verification remain separate gates from the synthetic R1 build. The candidate leaves Render and dependency configuration as inherited.
