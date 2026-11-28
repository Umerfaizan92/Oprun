# PRG-02 — Queue tenant/type idempotency isolation (AUD-02)
Owner: Claude. Legacy task: T-271. Status: implementation complete on feature branch; **awaiting ChatGPT independent review. Not release approval.**
Base: `234f56d9818da0590d5dabf1a4fa7b7a8139a7dd` (main HEAD when checked, 2026-11-28). Branch: `claude/prg02-queue-isolation-20261128`.
Head: see the commit that adds this file (`git log -1 -- docs/programme/CLAUDE-PRG02.md`).

## Changed paths
- `src/job-queue.js`: `enqueue` only (one function).
- `scripts/programme-queue-isolation.test.mjs`: new, 9 synthetic tests.
- `docs/programme/CLAUDE-PRG02.md`: this report.
- `.claude/project-memory/*`: mandatory bookkeeping through `npm run memory:*` (T-271 task, checkpoints).
Not changed: schema, other runtime files, worker topology, render.yaml. `qa/reports/tenant-sweep.json` is rewritten by
`scripts/tenant-sweep.test.mjs` on every test run; it was restored to base and is **not** part of this change. Coordinator to decide whether that generated report should stay tracked.

## Defect (confirmed in core, reproduced)
`src/job-queue.js` (base): column `idempotency_key TEXT UNIQUE` is table-wide (line 15). `enqueue` inserted with
`ON CONFLICT(idempotency_key) DO NOTHING` and on conflict returned `SELECT * … WHERE idempotency_key=?`, the full row
of whichever job held the key, with no check of `type` or `organisation_id`.
Reproduced on base with the new test file (`node --test scripts/programme-queue-isolation.test.mjs` with base
`src/job-queue.js`; TAP summary `# tests 9 # pass 4 # fail 5`). Reviewers can repeat it with
`git show 234f56d:src/job-queue.js > src/job-queue.js` on a scratch checkout. **5 of 9 tests failed:**
- tenant B reusing tenant A's key received tenant A's full job row (payload included);
- the same tenant reusing a key for another job type received the other type's job;
- platform scope (null tenant) and a tenant received each other's jobs in both directions;
- the legacy-row and two-writer cases showed the same cross-tenant hand-over.
The 4 that passed on base (same-scope dedupe, null/omitted org dedupe, no-key jobs, and "a refused collision creates no
row", which base satisfied by handing back the other job instead of inserting) guard the behaviour that must keep working.

## Caller reachability (external exposure)
Every `enqueue` caller at base, all building keys on the server:
| Caller | Type | Key | Tenant |
|---|---|---|---|
| src/server.js:6290 daily audit | audit.verify_chain | `audit.verify_chain:<date>` | null (platform) |
| src/server.js:6364 commsService.enqueueSend | campaign.send | `campaign.send:<id>:<ms>:<random>` (effectively unique) | owner or null for platform |
| src/studio-editor.js:32 | studio.export | `studio.export:<org>:<server uuid>` | org |
| src/reel-maker.js:160 | reel.render | `reel.render:<org>:<server uuid>` | org |
| src/automation/engine.js:354 | automation.execute | `automation.execute:<run uuid>[:n]` | run.organisation_id |
| src/comms/receptionist-followups.js:34 | receptionist.followup | `rxf:<followup id>:<attempts>` | f.organisation_id |
Client-supplied `idempotency_key` values (studio, reel) are stored only in their own tables, which are already unique per
`(organisation_id, idempotency_key)`; they never reach the queue key. **Conclusion:** the defect is real in the core,
but no current caller can trigger a cross-tenant collision (keys are type-prefixed and carry server-generated IDs).
It is a latent isolation/integrity defect that any future caller passing a client or shared key would expose.

## Fix (smallest backward-compatible)
In `enqueue`, inside one transaction: insert as before; on conflict return the existing job **only if**
`type` matches and `organisation_id IS` the caller's scope (`undefined`/`null` both mean platform). Otherwise throw
`Error` with `code: 'IDEMPOTENCY_KEY_CONFLICT'`, `status: 409`, a generic message, no job attached, and a warning log
naming only the caller's own type and scope. No row is created on refusal.
Preserved: column, UNIQUE constraint, stored key strings (so `automation/engine.js:351` `LIKE 'automation.execute:<run>%'` still works), existing rows, return shape `{duplicate, job}`, same-scope dedupe semantics.
Nested use inside `db.transaction` (studio-editor) is fine: better-sqlite3 uses a savepoint.

## Trade-offs and limits (for review)
- **Fail closed, not namespaced.** Because the UNIQUE constraint stays table-wide, a key held by tenant A still blocks tenant B (now with an error instead of a leak). With today's callers this cannot happen. True per-scope key spaces need a table rebuild/migration (non-destructive copy + swap) and belong with the PRG-04 backend/scoped-jobs work; not done here per "no destructive schema changes".
- Callers that do not catch: studio-editor and reel-maker would surface a 500 (transaction rolled back, no orphan export/reel row); audit check and receptionist follow-up already catch and log. No caller can reach this today.
- Payload differences on a same-scope duplicate are still ignored (unchanged behaviour).
- Concurrency: single SQLite file, `numInstances: 1`; test covers two connections to one file. A true multi-process race was not load-tested.
- Existing legacy rows are not inspected for past collisions. A read-only check for reviewers: `SELECT idempotency_key FROM background_jobs WHERE idempotency_key IS NOT NULL GROUP BY idempotency_key HAVING COUNT(*)>1` is always empty due to UNIQUE; a past wrong hand-over would not have left a row, so it cannot be detected from the table.

## Tests (Node v22.23.5, isolated in-memory or temp-file databases, no network)
- `node --test scripts/programme-queue-isolation.test.mjs`: base 4 pass / 5 fail (reproduction); after fix 9/9 pass.
- Queue/tenant/agent regressions: job-queue, job-lifecycle, tenant-isolation, integration-tenant, tenant-sweep, automation-engine, reliability, agent-supervisor: 59/59 pass.
- Callers' suites: comms, receptionist-followups, reel-maker, studio-editor: 20/20 pass.
- Full `npm test`: see "Full suite" below.

## Full suite
`npm test` (scripts/verify-all.mjs) on Node v22.23.5, with the fix applied: **ALL CHECKS PASSED: 73/73**, exit 0,
10m54s; the suites stage ran 131 contract test files, including the new one (621s). This replaces the "historical 73/73"
claim for this candidate only. A first attempt was cut off by this session's 10-minute background limit while still
running (no failure); it was rerun to completion.
Also: `npm run security:secrets` PASS (901 files).

## Coordination needed (outside PRG-02 boundary, not committed)
- **SHA256SUMS.txt**: `npm run verify:manifest` fails on the branch with `Hash mismatch src/job-queue.js` because the
  manifest is outside the allowed files. `manifest:update` changes only 3 lines (job-queue.js hash, plus entries for the
  two new files), after which `verify:manifest` passes (922 files); that was checked and reverted. `npm test` does not run
  the manifest check (it needs `--manifest`). Whoever merges should run `npm run manifest:update` on the merge commit, or approve adding SHA256SUMS.txt to this branch.
- **qa/reports/tenant-sweep.json**: rewritten by every test run (generated timestamps); restored and not committed.

## Next action
ChatGPT: independently review the diff `234f56d..claude/prg02-queue-isolation-20261128` for `src/job-queue.js` and the new test; decide whether to schedule the scoped-key migration under PRG-04. Claude does not merge, deploy or start PRG-05 until assigned.
