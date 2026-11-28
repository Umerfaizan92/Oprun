# PRG-04 — Final independent acceptance of the O3/O4 corrections (Claude)
Reviewer: Claude (independent; did not write the corrections). Implementer: Codex.
Correction branch: `codex/prg04-operability-20261128`, remote head `766fa582406347bd77da1a42dedaaac726534586` (checked: exact match).
Tested candidate: `a1e97ada316b50cf0a31b991e3f0df438f23c9be` (parent of 766fa58; `src/`, `qa/`, `scripts/` identical).
Ancestry (verified): `f1db00e` → `e8ee522` → `dc32b68` (my original review) → `a1e97ad` → `766fa58`.
Scope note: this branch contains neither the PRG-02 queue change (`src/job-queue.js` has no `IDEMPOTENCY_KEY_CONFLICT`) nor the PRG-03 corrections. This is not a combined-candidate acceptance.
Review branch: `claude/prg04-final-acceptance-20261128`, created from `766fa58`. Codex's runtime code and branches are not modified.
Original evidence preserved: `qa/programme/prg04-independent-backend-review.test.mjs` and `docs/programme/CLAUDE-PRG04-INDEPENDENT-REVIEW.md` are byte-identical at 766fa58.

## Changed files (dc32b68..a1e97ad)
`src/workspace-configuration-schema.js` (new: definitions, guard, prerequisites, transactional initialisation), `src/workspace-configuration.js` (uses it; adds `exportWorkspaceConfiguration`), `src/diagnostics.js` (+6: `database.workspace_configuration` check), `src/saas-platform.js` (+2: export entry), `scripts/workspace-configuration-operability.test.mjs` (new, 5 tests), `docs/programme/PRG08-ACCOUNT-DELETION-P1-2026-11-28.md`, `SHA256SUMS.txt`; then the checkpoint document (766fa58).

## Disposition: **ACCEPTED** (technical, PRG-04 slice only)
O4 and O3 are corrected and independently verified, all previously accepted PRG-04 behaviour remains intact, and no
mandatory test fails, skips or is marked todo. Two low-severity limitations (L1, L2) are recorded; they need direct
database access with the triggers removed, so they do not block acceptance. **Release readiness** still depends on the
gates below (combined tree, manifest regeneration, P1 under PRG-08).

## Classification of original tests 8 and 10 (unchanged suite on a1e97ad: 8 pass, 2 fail, exit 1)
| # | Failing assertion | Classification | What the rest of the test covered, and where it is now verified |
|---|---|---|---|
| 8 | `assert.throws(... /no such column/, 'O4: installer depends on columns added by other installers')` | **Obsolete defective-behaviour assertion.** The installer now throws an explicit prerequisite diagnostic naming `organisations.modules_json, onboarding_profiles.pipeline_stages_json` (seen in the failure output). | The test stopped at its first assertion. Its later checks (additive, idempotent, no rows) would also now differ, because a marker table is added by design. Re-verified as mandatory tests O4-1 to O4-4. |
| 10 | export/diagnostics absence (`expected false, actual true`) | **Obsolete defective-behaviour assertion.** The export now includes revisions, and diagnostics use the dedicated guard. | Re-verified as mandatory O3 guard and export tests. The table is still outside the generic `db.js` reference by design, and generic repair does not rebuild it (verified). |
Both failures reflect only the corrected historical behaviour; neither is counted as acceptance evidence. The other 8 original tests pass unchanged
(validation, authority and revocation, stale context, rollback without restoring revoked permissions, immutable history and tenant deletion, three-process
concurrency, transactional failure injection, cascade). They are the regression evidence for previously accepted behaviour.

## Verification (`qa/programme/prg04-final-acceptance-independent.test.mjs`, 9 mandatory tests)
**O4** — missing prerequisites: clear diagnostic, no schema or subscriber-data change, no open transaction. Foreign keys off: fail closed before any write.
Fresh install: exactly the four objects plus the marker, existing objects byte-identical, subscriber rows unchanged, idempotent over three runs. A failure
injected at the marker step rolls back the table and triggers created in the same transaction; a clean retry verifies. Real servers: a database created by
the **original e8ee522 server** (two approvals and a rollback through its API) is adopted by **two candidate servers starting concurrently**; history and
audit rows are byte-identical and the marker is added. Dropping a trigger makes the candidate refuse to start, with
`integrity failure … missing workspace_configuration_no_update` in its log. Restoring the exact definition lets it restart with revision 3 intact.

**O3** — the guard reports each of the three triggers missing and altered, the table missing (with approval evidence) and altered, an invalid marker row, and
a deleted revision row referenced by audit ("approved revision history is missing"). In each case startup refuses, and neither the installer nor generic
`checkSchema(apply)` rebuilds anything; the audit chain stays valid. Lost schema after a prior installation (marker present) is not taken for a clean
install; only a database with no table, no marker and no approval evidence is "uninitialised". Legitimate tenant deletion (cascade, audit rows retained)
keeps the guard verified.

**Export** — real server: the owner's JSON export lists revisions 1, 2, 3 in order with `restored_from` 1 on the rollback, `approved_by` the owner, the
configuration and metadata. No context hash, 64-hex value, organisation id, password, secret or token appears. All existing export tables are kept. CSV has
header `revision,schema_version,approved_by,approved_at,restored_from,configuration,metadata` and three rows. Another tenant's owner sees an empty list; an
admin of the tenant gets 403 for JSON and CSV; unauthenticated gets 401; each export is audited to the owner.

## Limitations
| ID | Severity | Summary | Affected files | Evidence |
|---|---|---|---|---|
| L1 | Low | The guard checks presence and definitions, not content. A revision edited after dropping and restoring the update trigger (needs direct database access) stays "verified". Content hashes recorded in the approval audit entry would detect it. | `src/workspace-configuration-schema.js` | characterisation L1 |
| L2 | Low | `exportWorkspaceConfiguration` parses every row strictly; one malformed stored row makes it throw, so the tenant's whole data export fails rather than that table alone. Only reachable by bypassing the triggers. | `src/workspace-configuration.js`, `src/saas-platform.js` | characterisation L2 |
| D1 | Design note | Fail-closed startup stops the whole server, not just this feature, when its schema is damaged. This matches the assignment ("fail-closed startup") and the recovery path was verified; operators need the runbook. | `src/workspace-configuration-schema.js` | mandatory O4 real-server test |

## P1 analysis review (`docs/programme/PRG08-ACCOUNT-DELETION-P1-2026-11-28.md`)
Complete for a source-only registration. It correctly identifies the unconditional `governance_ledger` delete trigger and cascade, the second conflict
(`actor_user_id ON DELETE SET NULL` against the unconditional update trigger when a user is deleted), retry behaviour, backups and replicas, and leaves
legal retention to qualified review. Suggested additions for PRG-08: the user-visible status when the job keeps failing (currently retried with a failure
message), queued background jobs and outbound provider effects for a tenant being deleted, and whether the pre-deletion data export now covers
configuration revisions (it does, as of this candidate). No account-deletion or ledger runtime was changed (verified by the diff).

## Commands and results (Linux x86_64, Node v22.23.5, `package-lock.json` unchanged from the installed tree, synthetic data)
| Command | Tests | Result | Exit |
|---|---|---|---|
| `node --test --test-concurrency=1 qa/programme/prg04-independent-backend-review.test.mjs` (original, unchanged) | 10 | 8 pass, 2 fail (tests 8, 10: obsolete, classified above) | 1 |
| `PRG04_ORIGINAL_TREE=<e8ee522 checkout> node --test --test-concurrency=1 qa/programme/prg04-final-acceptance-independent.test.mjs` (new mandatory; 3 runs) | 9 | 9 pass, 0 fail, 0 todo, 0 skip, every run | 0 |
| `node --test qa/programme/prg04-final-characterisation.test.mjs` | 2 | 2 pass (reproduces L1, L2) | 0 |
| `node --test --test-concurrency=1 scripts/workspace-configuration-operability.test.mjs scripts/workspace-configuration.test.mjs scripts/onboarding-interview.test.mjs scripts/onboarding-proposal.test.mjs scripts/module-rules.test.mjs scripts/country-rules.test.mjs scripts/db-schema.test.mjs scripts/tenant-isolation.test.mjs scripts/release-security.test.mjs` (Codex's 55-test set) | 55 | 55 pass, 0 fail, 0 todo, 0 skip | 0 |
| `npm run test:fast` | 69 checks | ALL CHECKS PASSED 69/69 | 0 |
| `npm test` (scripts/verify-all.mjs) | 73 checks; 133 contract files | ALL CHECKS PASSED 73/73, 11m10s | 0 |
| `node scripts/verify-manifest.mjs` | 947 listed files | PASS (review files not listed; coordinator regenerates) | 0 |
| `node scripts/memory/validate.mjs` | — | PASS | 0 |
| `node scripts/secret-scan.mjs` (review files staged) | 931 tracked files | PASS | 0 |
`npm test` runs only `scripts/*.test.mjs`; the `qa/programme/` suites were executed explicitly.

## Release gates
1. Combined-tree run with PRG-02 and the accepted PRG-03 corrections, including this mandatory suite, the original suite (tests 8 and 10 classified as obsolete) and full `npm test`; `SHA256SUMS.txt` regenerated by the coordinator.
2. An operator runbook for the fail-closed startup (diagnostic → verified restore → restart), as exercised here.
3. P1 handled under PRG-08 with the additions above; no governance protection is removed without that review.
4. Optional hardening: L1 content hashes, L2 per-table export isolation.

## Next action
Coordinator: record PRG-04 as technically accepted for integration; schedule the combined-tree run. Claude does not modify Codex's branches, assemble the
combined candidate, or begin PRG-05/PRG-07. T-274 remains design-only.
