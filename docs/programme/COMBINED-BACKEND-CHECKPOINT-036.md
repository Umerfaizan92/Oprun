# Checkpoint 036 — controlled backend integration

The combined branch is `codex/combined-backend-20261128`. Its pinned executable candidate is `5afff00f6d9f1f3173f855ceb39af1e9c283a12e`. This checkpoint records local synthetic verification for independent combined acceptance. Production release approval is a separate decision.

## Source provenance

| Source | Exact commit |
|---|---|
| Main baseline | `234f56d9818da0590d5dabf1a4fa7b7a8139a7dd` |
| PRG-02 accepted queue implementation | `44fb79c30e5a36fc998cb4401f5bd39a6a3f81cf` |
| PRG-02 independent acceptance | `a88d777605480fba58aeff2e07f8981773b6a7bc` |
| PRG-03 published implementation | `a92db4a45f4a9d672e23d86fbcf2a8c4293db86f` |
| PRG-03 final independent acceptance | `a0a341a1315661788afc23c5edc5adb4b905e0d9` |
| PRG-04 published implementation | `766fa582406347bd77da1a42dedaaac726534586` |
| PRG-04 final independent acceptance | `d232b4340006c8900ff8a0a9d239eda19d91d5d7` |
| Original PRG-04 server for adoption | `e8ee5228575d171c1667ec87c2b542df7e68864e` |
| Integration preparation | `3ecea1d5ecafd493864f75c50a9bef6e0adada21` |
| Earlier combined candidate | `22ef8fd95a7772db2a2b688d41b796d7af7a53e8` |
| Earlier combined verification receipt | `a026c680903d06b06ca00932e038cf9d360a7a4f` |

Merge `8941df9e81230943d6521e3e0254558b231d1455` has the final PRG-03 review as first parent and the final PRG-04 review as second parent. Those parents share `9c6cf3edb279ca7200032547f970913425610547`. The PRG-02 source and final acceptance both diverge at main. The financial parent already contains all five accepted queue implementation, regression and report blobs through the earlier combined tree. Their content hashes match the accepted queue commits. There was no duplicate queue application. The preparation branch and PRG-04 share readiness checkpoint `f1db00e50335d401f7c6bfe14373b4a55e49bbb6`. The older preparation and verification receipt remain available at their original refs and are represented by their documents in the combined tree.

Blob comparison covered every non-memory, non-generated-manifest path changed since the PRG-03/04 common ancestor on either side (33 financial-side and 20 foundation-side paths). All matched the designated source. The separate queue checks covered three implementation-side paths and two acceptance-side paths. The older verification receipt, package manifest, lockfile and Render blueprint likewise matched their sources. The only new executable edits after assembly are synthetic test code. The commits add a combined Litestream drill and modernise the existing finance browser test's loopback Stripe stand-in to return authenticated Account, Balance, PaymentIntent and Refund objects. The browser test retains all original assertions.

## Conflicts and records

| Conflict | Resolution |
|---|---|
| `.claude/project-memory/CHECKPOINTS.md` | Kept the PRG-03 ledger, appended both PRG-04 review entries, and qualified their duplicate CP-254 and CP-255 headings by programme. Appended source and publication corrections for CP-254, CP-255 and CP-258. PRG-03 CP-257's prior appended correction remains. The unmodified originals are reachable from the review commits. |
| `.claude/project-memory/PROGRESS.md` | Kept the PRG-03 history and appended both PRG-04 review progress entries. |
| `.claude/project-memory/SESSION_HANDOVER.md` | Updated the active block for Checkpoint 036. Previous generated blocks remain available in the parent commits. |
| `SHA256SUMS.txt` | Regenerated against the staged combined tree and verified. |

No runtime, schema source, or independent assertion conflicted. Branch-local PRG-02 T-271, shared queue T-280, and PRG-03 T-271 are qualified by programme and source branch in the memory annex. Queue decision D-095 is carried forward. Historical task statuses are read with the independent dispositions above. The original `e8ee522` checkout ran the pre-operability server and created the original database for the unchanged adoption test.

## Environment and commands

The primary runtime was Node 22.22.0 and the second runtime was Node 22.23.5. Both reported npm 11.19.1 and Node native-module ABI 127. `npm ci --cache /tmp/oprun-ci-0 --no-audit --no-fund --fetch-retries=0` ran on Node 22.22.0, installed 266 packages and exited 0. The checkout was isolated. The adoption checkout was detached at the exact original SHA and reused the same installed dependencies.

Local verification commands began with `env -i` and the following values. The registry dependency audit and initial dependency install used the host registry environment with Node 22.22.0 prepended to the path.

```text
PATH=/tmp/<runtime>/node_modules/.bin:/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/local/bin:/usr/bin:/bin
HOME=/tmp/oprun-c36-home
SUPERPRO_SKIP_DOTENV=1
LITESTREAM_BIN=/tmp/oprun-restore-tool/litestream
```

`<runtime>` was `oprun-node22220` for 22.22.0 and `oprun-node22` for 22.23.5. Explicit command prefixes below list the compatibility, browser and original-tree overrides. `NODE_ENV` and `OPRUN_TEST_STRIPE_COMPAT` were absent in both full builds' parents. The existing build runner sets `NODE_ENV=test` for its test subprocesses and isolates their home. The local servers used generated test credentials and temporary databases. Production-path fixtures explicitly use production settings within their synthetic harnesses.

The Linux amd64 Litestream v0.3.13 archive SHA-256 was `eb75a3de5cab03875cdae9f5f539e6aedadd66607003d9b1e7a9077948818ba0`, matching the repository pin. The extracted binary SHA-256 was `bbd8b9baa5bd9ae35318bececace384247b71fed4269a3e3cb8a8ac3f6c957bb`. The combined drill verifies the binary digest and version, replicates to a local filesystem path, restores both tenants, compares selected rows exactly, verifies SQLite and audit integrity, and proves a foreign queue collision and authenticated exports remain tenant-scoped after recovery. Pending refunds remain submitted with unchanged balances and durable attempt/lifecycle records. These fixtures exercise held-state preservation. The unchanged financial acceptance suites separately exercise reconciliation and provider dispatch protections.

## Verification evidence

| Gate | Runtime | Actual result | Exit |
|---|---|---|---:|
| PRG-02 independent and contract queue tests | Both | 22/22 on each | 0 |
| PRG-03 strict production-path and closure tests | Both | 24/24 on each | 0 |
| PRG-03 finance and currency files | Both | 29/29 on each | 0 |
| PRG-04 final independent, foundation and operability suites | Both | 15/15 on each, including 9 independent tests and original-database adoption | 0 |
| Historical PRG-03 mandatory and ten-file regression suites with explicit compatibility | 22.22.0 | 26/26 and 135/135 | 0 each |
| Tenant isolation, integration tenant, release security, database schema, country rules, module rules and onboarding | 22.22.0 | 59/59 | 0 |
| Local baseline and combined backup/restore | 22.22.0 | 2/2 | 0 |
| Browser smoke, onboarding and finance | 22.22.0 | 37, 5 and 12 checks passed respectively | 0 each |
| Reel Maker browser | 22.22.0 | Upload, suggested words, generation, playback, draft, layouts and accessibility passed | 0 |
| Module browser and API sweep | 22.22.0 | 66 checked, zero problems | 0 |
| Site consistency, synthetic integration runtime, API smoke and main-baseline preservation | 22.22.0 | All passed, zero unexpected functional removals | 0 each |
| Production dependency registry audit | 22.22.0 | Zero reported vulnerabilities | 0 |
| `npm test` with compatibility unset | 22.22.0 | 73/73 checks, including 134 contract test files | 0 |
| `npm test -- --manifest` with compatibility unset | 22.22.0 | 74/74 checks, including 134 contract test files | 0 |
| Manifest, secret scan and project-memory validation | 22.22.0 | Passed on the candidate and rerun on the checkpoint tree | 0 each |

Every mandatory TAP acceptance suite reported zero failures, cancellations, skips and TODOs. The browser and build runners report their own top-level checks. The synthetic tenant sweep made 4,555 requests with zero data leaks, cross-tenant row changes, and server errors.

The unchanged PRG-04 original reviewer file reported 8 pass and 2 obsolete assertions, exit 1. Cases 8 and 10 expected an implicit installer prerequisite and missing revision export respectively. Their current behaviour is covered by the mandatory O3/O4 acceptance suite. PRG-04's two L1/L2 limitation characterisations passed (exit 0), documenting remaining limits rather than release acceptance. The PRG-03 G1–G3 and H1–H3 defective-behaviour characterisations each reported 0 pass and 3 historical failures, exit 1. Their six assertions describe defects that the mandatory financial suites exercise on the corrected paths. The older F1–F4 reviewer TODOs remain historical evidence. None of these characterisations counted toward mandatory acceptance.

During preparation, project-memory validation exited 1 on duplicate bare CP-254 and CP-255 headings. The historical PRG-04 headings were then qualified. The initial finance browser command exited 1 because its stub could not supply verified account identity and no refund POST was issued. The corrected browser fixture passed all 12 checks. Earlier interrupted build attempts on superseded trees were discarded. Both full builds completed on the final candidate.

### Exact test and verification commands

- Node versions — `bash -c node\ --version\ \&\&\ npm\ --version\ \&\&\ node\ -p\ process.versions.modules`
- Queue, both runtimes — `node --test --test-concurrency=1 qa/programme/queue-independent-review.test.mjs scripts/programme-queue-isolation.test.mjs`
- Strict finance, both runtimes — `node --test --test-concurrency=1 qa/programme/prg03-final-acceptance-independent.test.mjs qa/programme/prg03-closure-acceptance.test.mjs qa/programme/prg03-closure-independent.test.mjs`
- R1, both runtimes — `node --test --test-concurrency=1 scripts/finance.test.mjs scripts/programme-payment-currency.test.mjs`
- Foundation and original adoption, both runtimes — `env PRG04_ORIGINAL_TREE=/workspace/Oprun-c36-original node --test --test-concurrency=1 qa/programme/prg04-final-acceptance-independent.test.mjs scripts/workspace-configuration.test.mjs scripts/workspace-configuration-operability.test.mjs`
- Historical 26 — `env NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1 node --test --test-concurrency=1 qa/programme/prg03-reacceptance-independent.test.mjs`
- Historical 135 — `env NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1 node --test --test-concurrency=1 qa/programme/prg03-g1-g3-acceptance.test.mjs qa/programme/prg03-financial-corrections-acceptance.test.mjs qa/programme/queue-independent-review.test.mjs scripts/programme-queue-isolation.test.mjs scripts/finance.test.mjs scripts/programme-payment-currency.test.mjs scripts/country-rules.test.mjs scripts/db-schema.test.mjs scripts/release-security.test.mjs scripts/tenant-isolation.test.mjs`
- Backend — `node --test --test-concurrency=1 scripts/tenant-isolation.test.mjs scripts/integration-tenant.test.mjs scripts/release-security.test.mjs scripts/db-schema.test.mjs scripts/country-rules.test.mjs scripts/module-rules.test.mjs scripts/onboarding-interview.test.mjs scripts/onboarding-proposal.test.mjs`
- Synthetic restoration — `node --test --test-concurrency=1 scripts/restore-drill.test.mjs qa/programme/combined-backend-restore.test.mjs`
- Historical PRG-04 original report — `node --test --test-concurrency=1 qa/programme/prg04-independent-backend-review.test.mjs`
- PRG-04 limitation characterisation — `node --test qa/programme/prg04-final-characterisation.test.mjs`
- Historical G — `env NODE_ENV=test OPRUN_TEST_STRIPE_COMPAT=1 node --test --test-concurrency=1 qa/programme/prg03-reacceptance-characterisation.test.mjs`
- Historical H — `env node --test --test-concurrency=1 qa/programme/prg03-final-characterisation.test.mjs`
- Site consistency — `npm run check:site`
- Integration runtime — `npm run integration:test`
- Runtime smoke — `npm run smoke:test`
- Preservation audit — `node scripts/release-audit.mjs --base 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd --json /tmp/oprun-c36/release-audit.json`
- Business and founder UI — `env PLAYWRIGHT_BROWSERS_PATH=/tmp/oprun-playwright npm run test:ui`
- Onboarding UI — `env PLAYWRIGHT_BROWSERS_PATH=/tmp/oprun-playwright npm run test:onboarding-ui`
- Finance UI — `env PLAYWRIGHT_BROWSERS_PATH=/tmp/oprun-playwright npm run test:finance-ui`
- Reel Maker UI — `env PLAYWRIGHT_BROWSERS_PATH=/tmp/oprun-playwright npm run test:reel-maker-ui`
- Module sweep — `env PLAYWRIGHT_BROWSERS_PATH=/tmp/oprun-playwright npm run verify:modules`
- Plain build — `npm test`
- Manifest build — `npm test -- --manifest`
- Manifest check — `npm run verify:manifest`
- Secret scan — `npm run security:secrets`
- Project memory — `npm run memory:validate`
- Dependency registry check — `npm audit --omit=dev --json --fetch-retries=0`
- Source ancestry and verification — `git fetch origin`, `git merge-base`, `git rev-parse <ref>:<path>` compared with `git rev-parse HEAD:<path>`, `sha256sum /tmp/oprun-restore-tool/litestream /tmp/oprun-restore-tool/litestream.tar.gz`, and `node scripts/update-manifest.mjs`.

## Additional acceptance and release gates

Independent combined acceptance should verify the two merge parents, source blob comparisons, the mandatory synthetic suites, and the full normal build at the pinned candidate. The coordinator retains the integration and release decision.

Open gates remain PRG-08 P1 account deletion integrity, W1 webhook resilience and its restart decision, L1/L2 revision and export hardening, and the D1 startup recovery runbook. Production backup freshness, secondary backup independence and tested production recovery still require operational evidence. Stripe test-mode capability, restricted-key grants, production runtime alignment and owner release approval require separate authority and verification. T-274 is design-only. PRG-05 and PRG-07 remain reserved. No deployment, production migration, provider operations or recovery uploads were part of this evidence.

## Complete changed-file inventory

Compared with main at `234f56d9818da0590d5dabf1a4fa7b7a8139a7dd`. The last entry is this documentation checkpoint. The inherited tenant-sweep report is historical evidence. Reports generated during verification were kept in temporary storage.

```text
M	.claude/project-memory/CHECKPOINTS.md
M	.claude/project-memory/DECISIONS.md
M	.claude/project-memory/PENDING_TASKS.md
M	.claude/project-memory/PROGRESS.md
M	.claude/project-memory/SESSION_HANDOVER.md
M	SHA256SUMS.txt
M	docs/coordination/chatgpt.md
A	docs/programme/CLAUDE-PRG02.md
A	docs/programme/CLAUDE-PRG03-CLOSURE-ACCEPTANCE.md
A	docs/programme/CLAUDE-PRG03-FINAL-ACCEPTANCE.md
A	docs/programme/CLAUDE-PRG03-INDEPENDENT-REVIEW.md
A	docs/programme/CLAUDE-PRG03-R1-ACCEPTANCE.md
A	docs/programme/CLAUDE-PRG03-REACCEPTANCE.md
A	docs/programme/CLAUDE-PRG04-FINAL-ACCEPTANCE.md
A	docs/programme/CLAUDE-PRG04-INDEPENDENT-REVIEW.md
A	docs/programme/CONSOLIDATED-HANDOVER-2026-11-28.md
A	docs/programme/CONTINUATION-CHECKPOINT-2026-11-28.md
A	docs/programme/CONTROLLED-INTEGRATION-PREPARATION-022.md
A	docs/programme/ENGINEERING-CONTINUATION-2026-11-28.md
A	docs/programme/GROK-PRG06-REVIEW-2026-11-28.md
A	docs/programme/GROK-PRG06-VERIFICATION-2026-11-28.md
A	docs/programme/INITIAL-CHECKPOINT-2026-11-28.md
A	docs/programme/PAYMENT-AUDIT-2026-11-28.md
A	docs/programme/PRECISION-CHECKPOINT-2026-11-28.md
A	docs/programme/PRG02-ACCEPTANCE-2026-11-28.md
A	docs/programme/PRG03-FINANCIAL-CHECKPOINT-025.md
A	docs/programme/PRG03-FINANCIAL-CHECKPOINT-030.md
A	docs/programme/PRG03-FINANCIAL-CORRECTIONS-2026-11-28.md
A	docs/programme/PRG03-INDEPENDENT-REVIEW-2026-11-28.md
A	docs/programme/PRG03-R1-CHECKPOINT-034.md
A	docs/programme/PRG04-BACKEND-FOUNDATION-2026-11-28.md
A	docs/programme/PRG04-BACKEND-IMPLEMENTATION-2026-11-28.md
A	docs/programme/PRG04-OPERABILITY-CHECKPOINT-024.md
A	docs/programme/PRG08-ACCOUNT-DELETION-P1-2026-11-28.md
A	docs/programme/PRG08-INTEGRATION-VERIFICATION-2026-11-28.md
A	docs/programme/PRG08-PRODUCTION-READINESS-2026-11-28.md
A	docs/programme/PRG08-REFUND-RECONCILIATION-PLAN-2026-11-28.md
A	docs/programme/RENDER-CHECKPOINT-2026-11-28.md
A	docs/programme/T274-DESIGN-ACCEPTANCE-2026-11-28.md
A	docs/programme/T274-DESIGN-REVIEW-2026-11-28.md
A	docs/programme/T274-SCOPED-KEY-DESIGN-2026-11-28.md
A	qa/programme/combined-backend-restore.test.mjs
A	qa/programme/prg03-closure-acceptance.test.mjs
A	qa/programme/prg03-closure-independent.test.mjs
A	qa/programme/prg03-final-acceptance-independent.test.mjs
A	qa/programme/prg03-final-characterisation.test.mjs
A	qa/programme/prg03-final-worker.mjs
A	qa/programme/prg03-financial-corrections-acceptance.test.mjs
A	qa/programme/prg03-g1-g3-acceptance.test.mjs
A	qa/programme/prg03-independent-financial-review.test.mjs
A	qa/programme/prg03-reacceptance-characterisation.test.mjs
A	qa/programme/prg03-reacceptance-independent.test.mjs
A	qa/programme/prg03-reacceptance-worker.mjs
A	qa/programme/prg04-final-acceptance-independent.test.mjs
A	qa/programme/prg04-final-characterisation.test.mjs
A	qa/programme/prg04-independent-backend-review.test.mjs
A	qa/programme/queue-independent-review.test.mjs
M	qa/reports/tenant-sweep.json
M	scripts/finance.test.mjs
M	scripts/memory/checkpoint.mjs
A	scripts/programme-payment-currency.test.mjs
A	scripts/programme-queue-isolation.test.mjs
M	scripts/tenant-isolation.test.mjs
M	scripts/test-finance-ui.mjs
M	scripts/test-server.mjs
M	scripts/verify-all.mjs
A	scripts/workspace-configuration-operability.test.mjs
A	scripts/workspace-configuration.test.mjs
M	src/diagnostics.js
M	src/finance/routes.js
M	src/finance/service.js
A	src/finance/stripe-refunds.js
M	src/job-queue.js
A	src/payment-precision.js
M	src/payments.js
M	src/saas-platform.js
M	src/server.js
A	src/workspace-configuration-schema.js
A	src/workspace-configuration.js
A	docs/programme/COMBINED-BACKEND-CHECKPOINT-036.md
```
