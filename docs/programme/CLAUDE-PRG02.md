# PRG-02 — Queue tenant/type idempotency isolation (AUD-02)
Owner: Claude (implementation). Task identifiers: **PRG-02::claude-branch T-271** (this branch's historical local ID,
kept unchanged) and shared **T-280** (independent review entry, tracked by ChatGPT). The audit branch's T-271 is a
different task (payment refund units); the two are never merged by bare number (coordinator decision D-096).
Status: **TESTING — awaiting independent acceptance. Not release approval.**
Base: `234f56d9818da0590d5dabf1a4fa7b7a8139a7dd`. Branch: `claude/prg02-queue-isolation-20261128`.
History: `99e27ae` (fix, tests, report) → `b85ef4c` (memory checkpoint) → corrections commit (adds this revision; see
`git log -1 -- docs/programme/CLAUDE-PRG02.md`). Independent review: `codex/prg02-independent-review-20261128` @ `8d0349c`.

## Changed paths (whole branch vs base)
- `src/job-queue.js`: `enqueue` only. **Unchanged by the corrections round.**
- `scripts/programme-queue-isolation.test.mjs`: new; strengthened in the corrections round (12 tests).
- `docs/programme/CLAUDE-PRG02.md`: this report.
- `.claude/project-memory/*`: bookkeeping through `npm run memory:*` only.
Not changed: schema, stored keys/rows, other runtime files, worker topology, render.yaml, SHA256SUMS.txt.

## Defect (confirmed in core, reproduced)
At base, `idempotency_key TEXT UNIQUE` is table-wide (`src/job-queue.js:15`), and `enqueue` on conflict returned
`SELECT * … WHERE idempotency_key=?`: the full row of whichever job held the key, with no check of `type` or
`organisation_id`. A tenant, another job type or the platform scope reusing a key received another scope's job,
including its payload, result and error.

## Caller reachability
Six `enqueue` callers exist at base; all were traced by Claude and independently re-traced by the reviewer. Each builds
the queue key on the server from a type prefix plus server-generated or server-held identifiers:
| Caller | Type | Key | Scope |
|---|---|---|---|
| src/server.js:6290 daily audit | audit.verify_chain | `audit.verify_chain:<date>` | platform (null) |
| src/server.js:6364 commsService.enqueueSend | campaign.send | `campaign.send:<id>:<ms>:<random>` | owner, or null for platform |
| src/studio-editor.js:32 | studio.export | `studio.export:<org>:<server uuid>` | org |
| src/reel-maker.js:160 | reel.render | `reel.render:<org>:<server uuid>` | org |
| src/automation/engine.js:354 | automation.execute | `automation.execute:<run id>[:n]` | run.organisation_id |
| src/comms/receptionist-followups.js:34 (optional queue) | receptionist.followup | `rxf:<follow-up id>:<attempts>` | f.organisation_id |
Client-supplied `idempotency_key` values (studio, reel) are stored only in their own tables, unique per
`(organisation_id, idempotency_key)`, and are not used as the queue key. **No current raw client-controlled
cross-tenant collision path was established.** That is not a proof that collisions are impossible: a future caller, a
data fault or an untraced indirect path could still produce one, which is why the core fix is needed.

## Fix (unchanged since 99e27ae)
Inside one transaction: insert as before; on conflict return the existing job only if `type` matches and
`organisation_id IS` the caller's scope (`null`, omitted and `undefined` all mean platform). Otherwise throw an `Error`
with message `This idempotency key is already used by a different job.`, own enumerable properties exactly
`code: 'IDEMPOTENCY_KEY_CONFLICT'` and `status: 409`, nothing about the other job, and one warning naming only the
caller's own type and scope. No row is created or changed. Preserved: column, UNIQUE constraint, stored key strings (so
`automation/engine.js:351` `LIKE 'automation.execute:<run>%'` still works), existing rows, the `{duplicate, job}` return
shape and same-scope dedupe. Inside a caller's `db.transaction`, better-sqlite3 uses a savepoint.

## Caller behaviour on a conflict (corrected)
The earlier report said studio-editor and reel-maker "would surface a 500". That was wrong for studio: the reviewer's
injected collision through the real studio route returned **HTTP 409** with a generic body and **no orphan export row**
(the route's transaction rolled back). Reel-maker was not exercised through its route; its behaviour is not claimed.
The audit check and receptionist follow-up catch and log. This does not establish that every caller has a tested JSON
error envelope or retry policy, and the injection is not evidence of a current client exploit path.

## Tests — actual counts (Node v22.23.5, synthetic in-memory/temp-file databases, no network or providers)
| Scope | Fixed tree | Base queue | Notes |
|---|---|---|---|
| `scripts/programme-queue-isolation.test.mjs` (12 tests) | 12/12 PASS, 5 repeat runs all 12/12 | 4 PASS / 8 FAIL | The 4 base passes are must-keep-working cases: same-scope dedupe, platform self-dedupe, keyless jobs, same-scope concurrent dedupe |
| Named regressions (job-queue, job-lifecycle, tenant-isolation, integration-tenant, tenant-sweep, automation-engine, reliability, agent-supervisor, comms, receptionist-followups, reel-maker, studio-editor) | 79/79 PASS | not run | Existing tests; not new coverage |
| Reviewer's `qa/programme/queue-independent-review.test.mjs` @ 8d0349c, run against this tree from a temporary uncommitted copy | 8/8 PASS | reviewer reports 1 PASS / 7 FAIL | Adopted as evidence for nested rollback/savepoints and the real studio HTTP 409 route; not committed here |
| Full `npm test` | see "Full suite" | — | 131 contract files including this one |
| `npm run security:secrets` | see "Full suite" | — | Pattern scan, not proof no secret exists |
The first round's 9-test file (9/9 fixed, 4/5 base) is superseded: the reviewer found conditional assertions in it
that accepted silence or another outcome. The new file has none. Every collision must throw the exact message, code,
status and property set; rows must be deep-equal before and after; error and log must contain no foreign job ID,
organisation, payload, result or error sentinel; and exactly one warning is logged.

Concurrency coverage:
- Test 10 uses two connections to one file **called one after the other**. It is labelled sequential and claims nothing about concurrency.
- Tests 11 and 12 are genuine overlapping writers: four worker threads, each with its own WAL connection to one temp file, released together by an Atomics barrier, three rounds each. Same scope: exactly one insert, three duplicates of the same job. Cross-tenant: exactly one winner receiving only its own job, three exact 409 conflicts revealing nothing foreign. The barrier makes the writers overlap, but SQLite serialises writes (busy_timeout), so this does not prove every possible interleaving.
- **Not certified:** multi-process, multi-host, network filesystems, or sustained load. Production runs one instance on one SQLite disk.

## Full suite
`npm test` on Node v22.23.5 with the strengthened test file: **ALL CHECKS PASSED: 73/73**, exit 0, 11m20s; contract stage 131 files (646.8s). The report file was edited during that run; `npm test` does not read `docs/programme/*.md`. `npm run security:secrets`: PASS (903 tracked files, 13 credential classes).

## Limitations (for review)
- **Fail closed, not namespaced.** The UNIQUE constraint stays table-wide, so a key held by one scope still blocks another (now an exact 409 instead of a leak). True per-scope key spaces need a reviewed migration: T-274 (PRG-04 design, ChatGPT). Not attempted here.
- Payload differences on a same-scope duplicate are still ignored (unchanged behaviour).
- Past wrong hand-overs, if any ever happened, left no row and cannot be detected from the table.

## Coordination (outside PRG-02 boundary, not committed)
- **SHA256SUMS.txt**: `verify:manifest` fails on this branch (`src/job-queue.js` hash mismatch). Per the coordinator, it is regenerated and verified on the final approved integration tree; this branch does not bypass or weaken that check. `npm test` does not include the manifest check.
- **qa/reports/tenant-sweep.json**: rewritten by every test run; restored, not committed.

## Next action
ChatGPT: independently re-review the corrections commit (diff `b85ef4c..<head>`: test file and this report only). Claude
keeps PRG-02::claude-branch T-271 in TESTING and starts nothing else (no PRG-05, merge, deploy, migration or snapshot upload).
