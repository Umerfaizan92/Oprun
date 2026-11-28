# Checkpoint 024 — PRG-04 operability corrections

Tested candidate a1e97ada316b50cf0a31b991e3f0df438f23c9be is a direct child of Claude's review dc32b68d6d20be024bbace3551cf8d648a2b18d7, itself a direct child of e8ee5228575d171c1667ec87c2b542df7e68864e. Correction ownership covers only workspace configuration, its schema guard, diagnostic reporting, its business export entry, synthetic tests and documentation. Integration preparation 3ecea1d5ecafd493864f75c50a9bef6e0adada21 stays separate. Financial corrections remain frozen at 3d00fec369c27924f51f0a2d8bad0dfbb41fe622.

**O4:** The installer explicitly requires the database bootstrap, module rules and onboarding proposal schema setup. It checks required columns and SQLite foreign-key enforcement before writing and reports missing prerequisites. Initialisation is transactional and repeatable. The existing installer order and subscriber settings are preserved. A drifted server refuses to start, and a synthetic restart after verified trigger restoration retained its revision and audit history.

**O3:** The dedicated guard compares the revision table and all three immutability trigger definitions and checks that approvals for existing tenants have matching revision rows. A version marker records prior installation, allowing the guard to distinguish a clean installation from lost schema. The earlier valid layout can be adopted without rewriting records. Startup and the existing diagnostic reporter surface missing or altered definitions. Generic schema repair does not recreate the protected history or silently reinstate triggers. Recovery requires verified schema and data.

The existing owner-only business export includes tenant-local revision history in JSON and CSV, ordered by revision, with configuration, jurisdiction metadata, owner and time attribution, and rollback ancestry. New revision exports exclude internal context hashes and project only defined configuration and metadata fields. Existing audit exports retain their original representation. No credential store is consulted for revision exports. User-entered labels remain user content.

PRG-08::ACCOUNT-DELETION-P1 is separately registered in the source-analysis document. No account-deletion or governance-ledger runtime path changed. The original independent report, tests and project memory remain byte-identical. Historical checkpoint IDs are qualified as **PRG-04 / claude/prg04-independent-review-20261128 / CP-254** at dc32b68 and **PRG-03 / claude/prg03-independent-review-20261128 / CP-254** at 0b86b34c165537862bc0a8053dbfb83f88ec2c47. Both records remain in their original histories.

## Verification

Linux x86_64, Node 22.23.5, npm 11.19.1, synthetic data and isolated SQLite. `npm ci --no-audit --no-fund --fetch-retries=0` installed 266 packages, exit 0. The lockfile was unchanged.

| Command | Observed result |
| --- | --- |
| `node --test --test-concurrency=1 qa/programme/prg04-independent-backend-review.test.mjs` on dc32b68 | 10 passed, exit 0. Baseline O3 and O4 observations reproduced. |
| Same unchanged independent command on a1e97ad | 8 passed, 2 failed, 0 skipped, 0 TODO, exit 1. Tests 8 and 10 assert obsolete failure and export-absence behaviour. Their replacements are mandatory in the operability suite. |
| `node --test --test-concurrency=1 scripts/workspace-configuration-operability.test.mjs scripts/workspace-configuration.test.mjs scripts/onboarding-interview.test.mjs scripts/onboarding-proposal.test.mjs scripts/module-rules.test.mjs scripts/country-rules.test.mjs scripts/db-schema.test.mjs scripts/tenant-isolation.test.mjs scripts/release-security.test.mjs` | 55 passed, 0 failed, 0 skipped, 0 TODO, exit 0. The five new mandatory O3/O4 cases passed. |
| `npm run test:fast` | 69/69, exit 0. |
| `node scripts/verify-manifest.mjs`, `node scripts/secret-scan.mjs`, `node scripts/memory/validate.mjs` | All exited 0. |

Independent correction review and a later authorised combined-tree run remain pending. Current schema drift handling is fail-closed and requires a verified recovery when history or guards are missing. The P1 retention and deletion design requires separate allocation and qualified acceptance. No candidate assembly, production change, real deletion, migration execution or deployment occurred.
