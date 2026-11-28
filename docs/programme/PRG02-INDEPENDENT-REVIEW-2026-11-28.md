# PRG-02 independent review — 28 November 2026

Reviewer: ChatGPT. Implementation owner: Claude. **Status: TESTING; not accepted, merged or deployed.**
Canonical repository: Umerfaizan92/Oprun. Review branch codex/prg02-independent-review-20261128. Historical fleet-office-ai references are aliases, not current repository targets.

## Exact ancestry and boundaries

- Stated/verified base: 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd.
- Implementation 99e27ae472c7bde0b448f00e4c026a672aba35b4 has exactly that base as parent.
- Checkpoint/head b85ef4cfcfbc07108d5f8db9f57848bf5afb8378 has 99e27ae as parent.
- Two commits, eight changed files confirmed. Runtime diff is enqueue in src/job-queue.js only; remaining changes are the new test, Claude report and five project-memory files. SHA256SUMS.txt is not updated by Claude's branch.
- Review uses a separate worktree pinned at b85ef4c. No Claude-owned implementation/test/report was edited. Own additions are qa/programme/queue-independent-review.test.mjs, this review and the required regenerated manifest. Generated tenant-sweep evidence may also be preserved separately.

## Results and limits

Node 22.23.5, isolated synthetic in-memory/temp-file databases, no production data or provider calls:

| Check | Actual observation |
|---|---|
| Claude original 9 tests on fixed implementation | 9/9 PASS |
| Same original test bodies against base queue module | Expected 4 PASS / 5 FAIL; imports relocated only for isolated baseline execution |
| Original 9 plus named queue/tenant/agent/caller regressions | 88 tests PASS, zero failed; equals the 9 new cases plus 79 regression assertions, not 88 additional regressions |
| Reviewer strict suite against fixed module | 8/8 PASS |
| Reviewer strict suite against base module | Expected 1 PASS / 7 FAIL; confirms original permissive behaviour fails exact rejection/rollback expectations |
| Full npm test | PASS, exit 0, 73/73 checks including 131 contract files; contract stage 516.9 seconds under Node 22.23.5 |
| Secret scan on Claude tracked branch files | PASS, 903 tracked files; pattern scan only, not a proof no secrets exist |
| Original branch manifest | FAIL: Hash mismatch src/job-queue.js |
| Regenerated review-worktree manifest | PASS after including reviewer test; regenerate again after all final review artifacts |

Reviewer strict tests require explicit IDEMPOTENCY_KEY_CONFLICT, status 409 and the exact generic message, no enumerable job/payload/result/error fields, no foreign identifiers or sentinel content anywhere on the error or warning log, and byte-equivalent row objects after refusal. Same-tenant wrong type and null-platform/tenant collisions are covered separately.

Nested/savepoint tests show: propagated inner failure rolls back outer caller writes; a caller that catches the conflict can commit its own unrelated outer write; a successful enqueue is rolled back by a later outer failure; connection remains usable afterward.

Concurrent verification uses two separate Node worker threads and two SQLite connections to a pre-initialised WAL database, released by a SharedArrayBuffer/Atomics barrier. Three rounds each: same-scope produces one row and one duplicate; cross-scope produces one inserted row and exactly one 409 refusal with no winner details in the error. This is genuine simultaneous writer contention, not two sequential connection calls. It is bounded local concurrency evidence, not multi-host/load/failure-recovery certification. SQLite serialises writes; enqueue's first transactional SQL is an INSERT, avoiding a read-before-write snapshot upgrade in this function. Long-held locks, SQLITE_BUSY handling and outer caller transactions need broader PRG-04 recovery design.

The real installed studio-export route was exercised on a local Express app with synthetic identity/media metadata and a queue-key collision deliberately injected. It returned **HTTP 409**, not 500, and rolled back the export row while leaving the existing queue row unchanged. This tests fault handling, not an end-user exploit path. The default Express response is HTML; a uniform JSON error envelope is a separate caller-integration concern. Other callers' HTTP/error paths were reviewed statically, not all fault-injected.

## Independent caller inventory — six, including the optional call missed by the earlier ChatGPT census

| Caller | Key/scope source | Error handling / residual assessment |
|---|---|---|
| server.js daily audit | audit.verify_chain plus server date, null platform scope | catches/logs enqueue failure |
| server.js campaign enqueueSend | campaign id plus server time/random suffix; tenant or null platform | no local catch in this helper; continued sends run inside the registered queue handler, whose runner catches failures. No blanket claim about every caller response |
| studio-editor.js | studio.export plus organisation and server UUID; outer transaction | exception propagates; injected HTTP test returned 409 and no orphan export |
| reel-maker.js | reel.render plus organisation and server UUID; outer transaction | synchronous exception propagates; outer rollback expected from transaction semantics and covered generically, but no dedicated reel fault-injection HTTP result claimed |
| automation/engine.js | automation.execute plus generated run id and resume suffix; run organisation | may propagate to caller/runner. Preserve literal stored key semantics because resume counts use LIKE on that key |
| comms/receptionist-followups.js | rxf plus follow-up id/attempt; follow-up organisation; optional queue?.enqueue?. | catches/logs; next_action_at is updated before enqueue. No claim that a collision is operationally retried correctly in every caller; include schedule/error policy in PRG-04 |

No inspected caller forwards its raw client request idempotency key to this queue. Reel/editor client keys remain in their tenant-scoped domain tables. The latent core defect is reproduced, but a directly controllable external cross-tenant collision path was not established. Do not say collisions are impossible: corrupted/imported data, UUID collision, future callers and different topologies were not exhausted.

## Core assessment and required corrections returned through central coordinator

The core fix passes these independent functional checks. It keeps existing schema, global UNIQUE constraint, stored key strings and rows. A conflicting foreign key is refused rather than namespaced; another tenant can still be denied that same global key. No migration or full tenant/type key-space isolation is claimed. Shared backlog T-274 schedules PRG-04 design subject to migration/recovery review, not execution.

1. **Required test correction — Claude owns it:** replace conditional error checks and permissive alternatives in scripts/programme-queue-isolation.test.mjs with mandatory assert.throws predicates checking code, status 409, exact generic rejection, all rows unchanged and no foreign payload/result/identifier/error details. The current suite can accept silence/no result in multiple cases and is not sufficient on its own to define this contract.
2. **Required test/report correction — Claude owns it:** rename the sequential two-connection test accurately. Add genuine contention coverage or cite/adopt the independent reviewer barrier evidence under coordinator-approved file boundaries. Do not label sequential calls concurrent writers.
3. **Required report corrections — Claude owns it:** qualify “no caller can trigger” to bounded reachability findings; correct the blanket HTTP-500 statement (representative injected studio route actually returned 409); distinguish 79 regressions plus 9 new tests; record namespace-aware task alias below. Do not claim more HTTP routes or load shapes tested than the evidence covers.
4. **Mandatory integration gate — coordinator owns integration manifest:** regenerate SHA256SUMS.txt on the final approved candidate tree, run verify:manifest and preserve evidence. The branch currently fails as published. If the coordinator assigns manifest regeneration to Claude, explicitly add that path to its boundary. Do not weaken/skip checks or call npm test alone proof of manifest validity.
5. Preserve keys/rows. Do not start a scoped-key migration, worker topology change, merge, deployment or production query. PRG-04 owns any later migration/restore/rollback design.

Until these acceptance items are addressed and reviewed, PRG-02 remains TESTING. Core runtime implementation ownership remains Claude. No automatic acceptance is inferred from this report or a green suite.

## Task-ID reconciliation without rewriting history

Actual register inspection confirms both branches independently allocated local T-271 from base T-270:

- claude/prg02-queue-isolation-20261128::T-271 = PRG-02 queue isolation, TESTING.
- codex/programme-audit-20261128::T-271 = PRG-03 Stripe refund units, TESTING.
- Existing shared T-280 reservation is the PRG-02 review/coordination entry, TESTING; it is not a retroactive renumbering of Claude's committed T-271.

Use programme ID plus branch-qualified local task ID in reviews, checks and handovers. PRG-02 and PRG-03 IDs are unchanged. Do not merge duplicate task blocks by bare T-271 or alter historical completed/pending entries to hide the collision.

## Exact next action

Full independent regression is complete. Refresh manifest and secret scan after final review artifacts; publish this reviewer-only branch without moving Claude/main/staging. Central coordinator returns the bounded test/report corrections above to Claude; review its next exact SHA and rerun affected checks. Keep original implementation and current review pinned until then. Retain T-272 evidence and separate PRG-06 provenance/corrections; no recovery refs are uploaded. QA test changes only were independently rerun (8/8); no Claude runtime file changed during or after full regression. A fresh remote check still showed Claude head b85ef4c after testing.
