# PRG-04 — Independent backend acceptance (Claude)
Reviewer: Claude (independent; did not write PRG-04). Implementer: Codex.
Candidate: `e8ee5228575d171c1667ec87c2b542df7e68864e` on `codex/prg04-backend-foundation-20261128` (remote head checked: exact match).
Parent: `f1db00e50335d401f7c6bfe14373b4a55e49bbb6` (direct parent; verified with `git merge-base --is-ancestor` and the commit's parent list).
Review branch: `claude/prg04-independent-review-20261128`, created from `e8ee522`. Codex's runtime implementation and branches are not modified.
**Scope note:** this branch does **not** contain the accepted PRG-02 queue change (`src/job-queue.js` has no `IDEMPOTENCY_KEY_CONFLICT`)
and does not contain PRG-03 corrections. This review accepts nothing about the combined candidate.

## Changed files in the candidate (f1db00e..e8ee522)
| File | Change |
|---|---|
| `src/workspace-configuration.js` | new, 218 lines: table, three immutability triggers, owner-only GET/approve/rollback routes |
| `src/server.js` | +2: import and `installWorkspaceConfiguration(...)` after the onboarding installers |
| `scripts/workspace-configuration.test.mjs` | new, Codex regression |
| `docs/programme/PRG04-BACKEND-IMPLEMENTATION-2026-11-28.md` | implementation checkpoint |
| `SHA256SUMS.txt` | manifest lines |
Reservations in the checkpoint match: the slice owns only the new installer, its registration and its regression; T-274 design-only; PRG-05/06/07 not started. Confirmed: no other runtime file changed.

## Disposition: **CONDITIONALLY ACCEPTED**
Every requested behaviour was independently reproduced and holds. No PRG-04 defect breaks tenant isolation, authority,
history integrity, transaction atomicity or legacy preservation. Acceptance is conditional on the items under
"Conditions", which are integration and operability gaps (O3, O4) plus a combined-tree run. P1 is a pre-existing
defect outside PRG-04, reported for separate allocation; it does not block PRG-04.

### Conditions (must be met before PRG-04 is part of an accepted integration candidate)
1. **O4** — make the installer independent of install order, or add a startup check with a clear error (and a test). Today a reordering of `server.js` crashes startup with `no such column`.
2. **O3** — decide and record: add the table and its three triggers to the schema-drift reference (or a dedicated guard like the audit-log trigger check in `diagnostics.js:181`), and decide whether `/api/saas/data-export` must include configuration revisions.
3. Re-run this review file, `scripts/workspace-configuration.test.mjs` and full `npm test` on the combined tree that includes PRG-02 (and PRG-03 corrections when ready), and regenerate `SHA256SUMS.txt` there.

## Findings
| ID | Severity | Summary | Affected files | Evidence |
|---|---|---|---|---|
| P1 | **Medium, pre-existing (outside PRG-04)** | `governance_ledger` has an unconditional `BEFORE DELETE` abort trigger (`db.js:952`) and `ON DELETE CASCADE` to `organisations`. Any tenant with ledger rows (created as early as legal acceptance) cannot be deleted: the account-deletion job's `DELETE FROM organisations` (`server.js:2787`) aborts with "governance ledger is append-only". The transaction rolls back cleanly (nothing partially deleted). PRG-04's own trigger is written correctly (`WHEN EXISTS (organisation)`), so it does not add to this. | `src/db.js`, `src/server.js` (completeScheduledAccountDeletion) | test 5 |
| O4 | Low | The installer prepares statements that read `organisations.modules_json` and `onboarding_profiles.pipeline_stages_json`, columns added by `installModuleRules` and `installOnboardingProposal`. It works only because `server.js` installs those first. On a database without them it throws at install time. | `src/workspace-configuration.js` | test 8 |
| O3 | Low | The table and its immutability triggers are created by the installer, not by `db.js`, so the schema-drift reference (`referenceSchema()`) neither reports nor repairs them if missing; there is no guard check like the audit-log one. The tenant data export does not include configuration revisions. Whole-database snapshots (`reliability/backup.js`) do include them. | `src/workspace-configuration.js`, `src/diagnostics.js`, `src/saas-platform.js` | test 10 |
| O2 | Low (inherent) | Immutability is enforced by triggers. A process with direct database access can drop them; with `foreign_keys` off, deleting a tenant leaves orphaned revisions that are then deletable. No application path does either: `createDb` turns foreign keys on, and no code drops these triggers. | `src/workspace-configuration.js` | test 5 |
| O1 | Informational | The context hash covers country, state, region, module settings, industry, services and pipeline stages. Provider connection state shown in GET is not part of it, so an approval can be made against a provider view that has since changed. Approval grants no provider authority, so this matches the stated contract. | `src/workspace-configuration.js` | test 3 |

## Requirement-by-requirement (all reproduced in `qa/programme/prg04-independent-backend-review.test.mjs`)
| Requirement | Result | Test |
|---|---|---|
| Tenant-scoped activity packs; multiple activities | Holds; packs and activities stored per tenant, multiple activities per pack and across packs | 1, 4 |
| Strict request validation | 32 malformed or over-reaching requests (28 approval payloads, a raw `__proto__` body, 3 rollback payloads) → 400 with no row and no audit: extra fields at every level (organisation_id, approved_by, grants, permissions, regulated activation, execution hooks, provider approval), duplicate and dangling keys, key and label rules, size limits, revision and context types, raw `__proto__` member, rollback shape | 1 |
| Active owner-only approval; demotion; revocation | admin, manager, employee and another tenant's owner get 403 on all four routes with no content leak; demotion is effective on the next request; a second active owner may approve and is refused once revoked; unauthenticated 401 | 2 |
| Stale revision and context rejection | Old, future and replayed bases → 409; each of seven context components → 409; restoring a value restores the context; the existing onboarding route invalidates a stale base | 3 |
| Cross-tenant resource isolation; historical confidentiality | Another tenant sees only its own empty history (404); non-owners cannot read revisions; `Cache-Control: no-store` | 2, 4 |
| Immutable revisions (application and database paths) | No update/delete/approve-over route exists. UPDATE, UPDATE OR REPLACE, re-keying, DELETE, INSERT OR REPLACE, REPLACE, duplicate INSERT, UPSERT and INSERT OR IGNORE are all refused; row byte-identical | 5 |
| Legitimate tenant deletion vs unauthorised revision deletion | PRG-04 trigger: direct delete refused while the tenant exists; tenant cascade removes only that tenant's history (test 9). Real-server tenant deletion blocked by pre-existing P1 | 5, 9 |
| Concurrent approval and rollback | **Three separate server processes**, independent SQLite connections, 6 rounds × 6 concurrent requests (approve and rollback rounds): exactly one 201 per base, the rest 409, no 5xx, no `SQLITE_BUSY`; history contiguous 1–6; audit rows = revisions; chain valid. Readiness deadline 45 s per process, 20 s per request | 6 |
| Approval/rollback failure injection | Audit insert failure, and a failure after insert and audit (provider catalogue throws), roll back both the revision and the audit row; failed rollback leaves history unchanged; no revision gaps afterwards | 7 |
| Audit integrity and actor attribution | One audit row per revision with the approving owner's user id and role, revision as entity id, `restored_from` on rollback; `verifyAuditChain` ok | 4, 6, 7 |
| Legacy settings preservation; onboarding compatibility | modules, onboarding profile, memberships, staff policies, integrations and subscription unchanged by approval or rollback; Codex's onboarding interview/proposal and module-rules suites pass | 3, 4; focused run |
| Module and staff permission enforcement; rollback does not restore revoked permissions | Revoked staff grants stay revoked after rollback to an earlier revision; no permission store touched | 4 |
| Provider approval unknown without evidence; no automatic authority | `approval` is `unknown` or `not_applicable`, never approved; no integration row created; references to unsupported capabilities flagged | 4 |
| Unsupported regulated capabilities | Every pack reports `regulated_capability: 'unsupported'`; any activation field is rejected | 1, 4 |
| Jurisdiction metadata; unsupported countries | Unknown country, NZ (unsupported, NZD), AU with invalid state (subdivision unsupported), lowercase AU/NSW normalised; historical revisions keep their original jurisdiction, rollback recomputes for the current one | 4 |
| Startup schema; existing database compatibility | Installing on an existing database adds exactly one table and three triggers, changes no existing object, is idempotent over three installs, creates no rows (subject to O4) | 8 |
| Transaction boundaries | `apply.immediate` takes the write lock before the owner and head checks; insert, audit and response construction share one transaction | 6, 7 |
| Backup implications | Online snapshot copies the whole file, so revisions are included; drift repair and export do not cover them (O3) | 10 |

## Commands and results (Linux x86_64, Node v22.23.5, `package-lock.json` unchanged from the installed tree; synthetic data only)
| Command | Tests | Result | Exit |
|---|---|---|---|
| `node --test --test-concurrency=1 qa/programme/prg04-independent-backend-review.test.mjs` (3 consecutive runs) | 10 | 10 pass, 0 fail, each run | 0 |
| `node --test --test-concurrency=1 scripts/workspace-configuration.test.mjs scripts/onboarding-interview.test.mjs scripts/onboarding-proposal.test.mjs scripts/module-rules.test.mjs scripts/country-rules.test.mjs scripts/tenant-isolation.test.mjs scripts/release-security.test.mjs` (Codex's focused set) | 43 | 43 pass | 0 |
| `node --test scripts/db-schema.test.mjs` | 7 | 7 pass | 0 |
| `npm test` (scripts/verify-all.mjs) on e8ee522 plus the two review files | 73 checks; 132 contract files (`scripts/*.test.mjs`) | ALL CHECKS PASSED 73/73, 10m50s | 0 |
| `npm run security:secrets` (review files staged) | 924 tracked files, 13 credential kinds | PASS | 0 |
The independent review file is under `qa/programme/` and is **not** run by `npm test` (which runs only `scripts/*.test.mjs`); it was executed explicitly as shown.

## Limits
- Concurrency covers three processes on one host and one SQLite file; not multiple hosts or network filesystems. Barrier-free `Promise.all` requests overlap in practice but the exact interleaving is not proven.
- Failure injection used the real installer with route handlers called directly (and SQLite triggers to force failures); the express error envelope for those failures was not examined.
- No production database, deployment, migration or provider was used.

## Next action
Coordinator: allocate conditions 1–2 to the PRG-04 owner, P1 separately, and schedule condition 3 on the combined tree. Claude does not modify Codex's runtime code, restart PRG-02, implement PRG-03 corrections, or begin PRG-05/PRG-07.
