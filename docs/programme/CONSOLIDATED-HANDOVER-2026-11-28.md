# Oprun — consolidated programme handover, 28 November 2026

**Release remains blocked. No integration merge, deployment, production data deletion, recovery-ref upload or claim-adapter work was performed.** Claude owns implementation; Grok owns research; ChatGPT owns independent review/coordination and its existing payment candidate.

## Verified revisions and preservation

| Item | Actual verified state |
|---|---|
| Canonical repository | Umerfaizan92/Oprun; historical fleet-office-ai references are aliases |
| main | 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd at final remote check |
| Render production | Fresh read-only deploy lookup confirms a691cf5e4ec37fcd554f3671d512b5468dd4780e LIVE, dep-dc4rgrg473hc73a0sdgg; no new deployment |
| Claude PRG-02 | Remote head b85ef4cfcfbc07108d5f8db9f57848bf5afb8378; parent 99e27ae472c7bde0b448f00e4c026a672aba35b4; its parent is base 234f56d. Two commits/eight files |
| Independent queue review | codex/prg02-independent-review-20261128 at 8d0349c7879b27ffc3b716414ac411ef3091c620. Remote/local tree match verified. Parent b85ef4c; no Claude runtime/test/report edits. Own changes: strict QA test, review, regenerated manifest and generated tenant-sweep evidence |
| Payment/coordination candidate | codex/programme-audit-20261128 at 1def04bf74e9ca1a75f17948bb88ad98495bc9dd before this final handover/checkpoint update; source/evidence tree matches the local tested candidate. The final documentation checkpoint commit is reported in the delivery receipt |
| User-supplied Grok original copy | codex/prg06-user-supplied-research-20261128 at 28b889f737d992dde63e9beabb46e4f1d957d20d, parent verified 234f56d; exactly one file added: docs/programme/GROK-PRG06.md. Exact provenance marker precedes the unchanged supplied body; one file-ending newline added |
| Marked research file SHA256 | 7e8e17f591534fce75c8d54e03eddb95ae7366c3120bee05575df2c5d2047dc9; captured/local/remote bytes matched |
| Grok original/addenda Git claims | Original 27a7e0f72dae4fb0cc5766cda8e4c5af543d3335 unavailable locally/remotely; claimed addenda 8b18364 likewise not retrieved. Their provenance was not reconstructed. R01/R02 bodies are not accessible in this conversation |

The new user-copy publication does not verify the preserved report's internal claim that Grok created/pushed a branch. Grok's original Git provenance remains unverified; the new ChatGPT preservation commit is verified and separate.

## Actual test evidence

All executable results below use Node 22.23.5 and synthetic/local data, not production accounts or provider payment calls.

| Scope | Actual result | Limitation |
|---|---|---|
| T-272 payment precision + finance + country rules | 29/29 PASS | Local provider stand-ins; no real Stripe sandbox/payment or UI acceptance |
| T-272 full npm test | 73/73 PASS, 131 contract files; contract stage 521.1s | Payment/finance runtime stayed stable during run; separate metadata helper label update subsequently tested |
| Final focused payment/finance/country + project-memory run | 35/35 PASS | Includes 6 existing memory-system tests on the corrected repository label |
| Claude original queue test on fixed source | 9/9 PASS | Original assertions are too permissive and need strengthening |
| Same original test bodies against base queue | Expected 4 PASS / 5 FAIL | Isolated import relocation only; reproduces defect, not a new regression failure |
| Claude queue tests + named target regressions | 88/88 PASS = 9 new + 79 regressions | Do not count these as 88 extra regressions |
| Independent strict queue QA | 8/8 PASS fixed; expected 1 PASS / 7 FAIL base | Includes exact conflict contract, unchanged rows, no foreign details, savepoints, rollback, HTTP and real worker contention |
| Independent queue full npm test | 73/73 PASS, 131 contract files; contract stage 516.9s | Separate candidate; final QA-only changes also rerun independently |
| Claude published branch manifest | FAIL: src/job-queue.js hash mismatch | Actual outstanding integration gate; npm test alone does not prove manifest validity |
| Regenerated independent review manifest | PASS, 924 files | Covers the reviewer tree; final approved integration tree must regenerate again |
| Secret scans | Review PASS 905 tracked files; audit candidate PASS after staging (count in final checkpoint) | Pattern scans, not universal secret-absence certification |

No combined queue-plus-payment integration tree was merged or tested. Separate passing candidate runs are not integrated-release evidence.

## PRG-02 acceptance and corrections for central coordinator

The core queue fix passes the independent tests and preserves schema, key strings and rows. It fails closed on a foreign tenant/type/platform collision with generic IDEMPOTENCY_KEY_CONFLICT / 409. The table-wide UNIQUE constraint remains: this is not yet true scoped key-space idempotency.

Independent QA uses two worker threads, separate WAL SQLite connections and an Atomics start barrier, three rounds for same-scope and three for cross-scope contention. It is genuine overlapping writer contention, not the original sequential two-connection test; it is not multi-host or unbounded-load certification. Nested rollback and catch/savepoint behaviour pass. An injected collision through the real studio route returned HTTP 409 and no orphan export, correcting the report's blanket HTTP-500 statement. That injection is not proof of a current client exploit path.

Six enqueue callers were independently traced, including optional receptionist follow-ups omitted by the earlier five-caller census. They construct queue keys on the server; a raw client-controlled cross-tenant collision path was not established. Do not call collisions impossible or infer that every caller has a tested JSON error envelope or retry policy.

**Return these bounded corrections to Claude; do not edit its implementation on its behalf:**

1. In owned scripts/programme-queue-isolation.test.mjs, require exact throws/code/status/message, unchanged rows and absence of foreign identifiers/payload/result/error details. Remove conditional checks that accept silence or another unintended outcome.
2. Label the sequential two-connection case accurately; add genuine contention coverage within approved boundaries or accurately cite/adopt the independent evidence. Do not label sequential calls concurrent writers.
3. In owned docs/programme/CLAUDE-PRG02.md, correct HTTP-500/reachability overstatements and task alias; distinguish the exact test counts and tested scope.
4. Coordinator regenerates SHA256SUMS.txt on the final approved integration tree and verifies it. If Claude is to do that, explicitly add the manifest to its file boundary. No bypass/weakened check.
5. Keep keys/rows/schema and implementation ownership unchanged. Return the next exact SHA, diff and actual tests for independent re-review. Keep branch-local T-271 TESTING.

Review details: [PRG02-INDEPENDENT-REVIEW](https://github.com/Umerfaizan92/Oprun/blob/codex/prg02-independent-review-20261128/docs/programme/PRG02-INDEPENDENT-REVIEW-2026-11-28.md).

## PRG-06 findings and bounded next assignment

The supplied original remains unchanged, including statements that need correction. Corrections are in GROK-PRG06-VERIFICATION-2026-11-28.md; the earlier partial review is retained as history.

32 original URLs requested; 28 returned content, four exact URLs blocked (two Ahpra, old ATO and WA Health). This is not validation of every sentence. Material corrections: current NDIA notice announces a 90-day timeframe from 1 December 2026; older two-year text must not be treated as evergreen. Older pricing URL now redirects; print headers are not necessarily page-update dates. DVA includes a mail fallback and service-specific routes. Current source includes direct social/reply adapters despite older release-inventory wording; live provider authority remains unverified.

Reject blanket “strictest privacy wins”, self-verifying uploads, universal approval assumptions and trust transactions stored as invoice warning notes. Accept only bounded design constraints mapped to existing PRG-03/04/05/06/08 ownership. Licence numbers alone must not produce authority-verified status. No claim/trust/clinical/AML build was started.

**Grok next:** deliver the already completed preservation clarification and R01/R02 addenda text separately with its stated source/date context and any observed Git evidence. Do not rewrite the preserved original or fabricate commit provenance. Do not start overlapping new research until the central coordinator maps those addenda and unresolved source checks. No runtime or shared coordination edits.

## Current programme register and task collision

The authoritative shared T-task register remains .claude/project-memory/PENDING_TASKS.md. These rows summarise this batch; legacy tasks are retained and not marked complete by inference.

| Programme / qualified task | Owner | Status | Next gate |
|---|---|---|---|
| PRG-01 audit/coordination | ChatGPT | IN_PROGRESS | Continue evidence-based audit and durable checkpoints |
| PRG-02::claude-branch T-271 | Claude | TESTING | Test/report corrections and independent acceptance |
| Shared T-280 PRG-02 review entry | ChatGPT review; Claude implementation | TESTING | Tracks existing reservation/review, not a renumbering of Claude's history |
| PRG-03::audit-branch T-271 refund units | ChatGPT implementation/review pending | TESTING | Independent payment review and provider/readiness gates |
| T-272 exact precision (PRG-03/04) | ChatGPT | TESTING | Independent review; exact service/currency support and historical reconciliation constraints |
| T-273 PRG-06 review | ChatGPT review; Grok research | TESTING | Addenda bodies, blocked source checks and qualified adoption; original-copy preservation complete |
| T-274 PRG-04 scoped queue migration/recovery DESIGN | ChatGPT architecture | NOT_STARTED | Preserve legacy keys/rows; migration, restore, rollback and concurrency review; no migration execution |
| PRG-05 adaptive interview/workspaces | Claude reserved | NOT_STARTED for this new programme scope | No takeover of current Claude work; bounded source/permission design first |
| PRG-07 Operator Console | Claude reserved | NOT_STARTED for this new programme scope | Separate platform/subscriber roles/data and action acceptance |
| PRG-08 release verification | ChatGPT | IN_PROGRESS | No known integrity/security/payment defect; final integrated proof and owner approval |
| PRG-09 premium refinement | Reserved, last | NOT_STARTED | Functional/security/release gates first |

Actual register inspection confirms two branches independently allocated T-271 from the old base. Use PRG ID plus branch-qualified local ID; neither PRG ID nor historical T-271 block was overwritten. Existing T-280 is a coordination/review entry, not an arbitrary retroactive rename. Do not merge task blocks by bare numeric ID. D-096 records this reconciliation.

## Exact resume order and blockers

1. Central coordinator returns the bounded queue corrections to Claude; independently review its next exact SHA. No source takeover. Recheck manifest on the final integration tree.
2. Obtain/review existing Grok addenda bodies; preserve them separately. Do not wait for or reconstruct 27a7e0f/8b18364. Four exact official-source rechecks remain unresolved; do not promote uncertain claims into question text or code.
3. Independently review T-271/T-272 payment changes. Safe hundredths boundaries do not certify all providers/currencies or reconcile past data. Known live payment defects and unverified support block release.
4. Continue PRG-03 authenticated role/export/storage/recovery and effective production security-posture evidence. Fresh AWS configuration/restore currency, complete integration receipts, performance budgets and combined-candidate regressions are not established by this batch.
5. Prepare T-274 design only after queue contract review; no destructive schema work, worker topology change or data migration.

No automatic cross-platform resumption or failover is configured. Resume from this file, current Git refs, coordination log and task register; do not rely on chat memory. Local recovery checkpoints exist, but no recovery refs/objects were uploaded. Final preservation receipt must verify the current audit/reviewer/research remote refs and matching artifacts before reporting completion of this checkpoint.
