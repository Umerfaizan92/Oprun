# Oprun initial programme checkpoint — 28 November 2026
Status: initial source audit; NOT release approval. Owner: ChatGPT (programme/security/independent QA).
Base: 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd (main at clone).
Branch: codex/programme-audit-20261128. No runtime edits, deployments, deletions, paid calls or production writes.
User's current brief supersedes earlier delivery ordering: safety audit → shared backend → adaptive interview/workspaces → industry workflows/integrations → Operator Console → release verification → graphical refinement.

## Evidence and reconciliation
Read CLAUDE.md, project-memory MASTER_PLAN, PROGRESS, PENDING_TASKS, DECISIONS, SESSION_HANDOVER, coordination/chatgpt.md and claude.md, transformation/HANDOVER_FOR_CHATGPT.md and 07_MASTER_BACKLOG.md. No tracked AGENTS.md found; session AGENTS instructions apply.
Main latest commit is "[skip render] Stabilize public website browser tests for streaming film"; main is NOT proof of the live revision.
Historical handovers are stale: SESSION_HANDOVER CP-245 refers to T-261, verified 83832c6 and a timed legacy-log check. Do not execute that old operational instruction automatically. Transformation handover cites b4880d3 live; NOT independently verified today.
Existing pending register remains authoritative for legacy T IDs; do not duplicate or close them by inference. This document is the current programme requirements/ownership index, cross-referencing that register and MB backlog.
Local remote-tracking claude/transformation-phase1 = abb85256cdbb6961fd28b9ab22c6b30ddfc37025. Many existing Claude branches; active ownership is unknown until Claude reports it.
Both Render links list My Workspace tea-dajtb13m8hqs739l6v50. Connector requires owner confirmation before service inspection. Live settings, deployed SHA and backups unverified today.
render.yaml contains healthCheckPath /healthz, numInstances 1, persistent SQLite disk and autoDeployTrigger off. This contradicts older audit A5's missing health path at source level, but does not establish live configuration.

## Initial findings (source evidence, not a penetration-test certificate)
| ID | Priority | Finding / evidence | Gate |
|---|---|---|---|
| AUD-01 | P1 | Continuity evidence is stale across generated and narrative handovers; resume command reports old verified SHA despite many newer commits | Reconcile logs against commits and CI before treating historical completion as current |
| AUD-02 | P0 investigation | src/job-queue.js:15 global UNIQUE idempotency_key; :46 duplicate lookup checks key only, returns full row without tenant/type check. Actual caller reachability and cross-tenant exposure not established | Reproduce with synthetic two-tenant queue tests and inspect all enqueue callers; confirmed isolation/integrity defect blocks release |
| AUD-03 | P0 verification | Authentication, role and tenant boundaries have existing tests, but no fresh executable evidence here yet | Node22 isolated tests must pass; tenant A/B and operator/subscriber negative tests |
| AUD-04 | P0 verification | Payments contain Stripe signature and tenant-role mechanisms; T-057 real test-mode lifecycle still open in register | Verify replay/idempotency, amount/currency/tenant matching, refunds and reconciliation without live spending |
| AUD-05 | P1 verification | src/object-storage.js and durable disk/backup configuration exist; current restore evidence not retrieved | Restore into isolated location, integrity/count/file checks; never replace live DB |
| AUD-06 | P1 verification | Industry registry/interview/proposal already exist; T-269 five-industry evidence appears in recent git log | Extend verified coverage, do not rebuild. Medicare/DVA workflows and hybrid semantics remain unverified |
| AUD-07 | P1 verification | Operator modules exist, but console presence is not authorization/isolation evidence | Route-by-route staff permission matrix, tenant support access audit and revocation tests |
| AUD-08 | P1 verification | Existing integration adapters and pending provider checks are separate evidence levels | Distinguish implemented/mocked/sandbox/live/blocked, with receipt and scope evidence |

## One requirements and prioritised ownership register
These programme IDs index existing tasks; legacy PENDING_TASKS is retained, not overwritten. One owner per row. Claude assignments are proposed until accepted in its own session.
| ID | Priority/order | Owner | Scope / legacy reference | Acceptance |
|---|---|---|---|---|
| PRG-01 | P0 now | ChatGPT | Audit/reconcile, AUD-01, MB-04 | Current SHA, branch state, evidence links, pending/WIP mapped; no stale instruction executed |
| PRG-02 | P0 now | Claude | Queue tenant/type idempotency investigation AUD-02 | Synthetic duplicate within same tenant/type deduplicates; other tenant/type never returns another job; null platform scope explicitly tested; old queued jobs preserved; caller compatibility reviewed |
| PRG-03 | P0 next | ChatGPT | Auth/session/RBAC/tenant/storage/payment independent review | Two tenants plus anonymous/worker/manager/owner/operator tests; forged IDs, exports/media/jobs, webhook replay, support access; findings reproducible with file/line |
| PRG-04 | P1 phase2 | ChatGPT | Shared backend architecture, T-048/MB-14 | Tenant context, capability checks, audit events, scoped jobs, recovery contract; topology decision before new worker/migration |
| PRG-05 | P1 phase3 | Claude (reserved, not yet assigned) | Interview/configurable workspaces, MB-28/T-269 | Text/voice correction, owner approval, hybrid business composition, country/state, accessible resumable interview; disabled modules cannot bypass backend permissions |
| PRG-06 | P1 phase4 | Grok | Official-source industry/integration research | Country/state/version/source/date matrix, implemented vs gap vs unsupported; no compliance certification claims |
| PRG-07 | P1 phase5 | Claude (reserved) | Owner/staff Operator Console | Subscribers; employees/roles; support assignment/follow-up; Oprun CRM; website/phone intake; calling/keypad; meetings; marketing; billing/reconciliation; platform operations. Separate platform identity/data from subscriber access; permission/revocation/audit evidence per action |
| PRG-08 | P0 release gate | ChatGPT | Security/recovery/performance/release, T-057/060/236 etc. | No known security/isolation/integrity/payment defects; exact candidate CI, restore drill, performance budgets and regression evidence; owner deploy approval |
| PRG-09 | last | Claude (reserved) | Premium graphical refinement | Approved visual direction plus responsive/accessibility/regression checks after functional gates |

Industry coverage required: healthcare specialties, Medicare/DVA, NDIS, real estate, tradies/mechanics, retail, restaurants, hybrid businesses; jurisdiction-specific requirements. Registry presence is not a functioning clinical/claims system.
Research must state which workflows need regulator/accreditation/provider access and which facts need qualified review. Do not claim legal or clinical compliance from a checklist.

## Tests this batch
- node scripts/memory/validate.mjs: PASS (structure/status consistency only, does not prove factual freshness).
- node scripts/secret-scan.mjs: PASS, 901 tracked files, 13 credential-pattern classes; not proof that no secret exists.
- node scripts/memory/resume.mjs: executed, exposed stale checkpoint and open task inventory.
- node --test scripts/tenant-isolation.test.mjs: failed to load because better-sqlite3 is not installed. No tenant assertions passed.
- Host Node v24.22.3; package engines require 22.x. No npm install or full regression performed.
- No paid generation, email, calls, posts, payment or live mutation tests run.
- Historical 73/73 claims were read, not reproduced.

## Claude assignment — paste exactly
Repository Umerfaizan92/Oprun. Read CLAUDE.md, current project memory, this checkpoint and existing task register. Confirm active work/dirty files before edits; preserve all prior WIP.
Base exactly 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd. Create isolated branch claude/prg02-queue-isolation-20261128 from that SHA; do not reset an existing checkout. Owner PRG-02 only.
Allowed runtime/test files: src/job-queue.js; scripts/programme-queue-isolation.test.mjs (new). Allowed report: docs/programme/CLAUDE-PRG02.md (new). Read any callers/tests; do not edit other files. Use existing memory commands for mandatory task/checkpoint bookkeeping. If manifest generation changes other files, report those paths for coordination before expanding boundaries.
Investigate global idempotency key collision and key-only duplicate lookup in createJobQueue.enqueue. First reproduce using synthetic two-tenant/type/platform-scope tests. Trace all callers to establish reachability; distinguish confirmed core behavior from external exposure. Implement the smallest backward-compatible fix if confirmed. Preserve existing queued rows, existing key semantics where safe and production data; no destructive schema changes. Never return another tenant/type job on collision. Consider null tenant scope, legacy keys and concurrent requests; document tradeoffs. Do not rewrite the queue or change worker topology.
Use Node22 and isolated throwaway databases. Run new tests, existing queue tests and relevant tenant/agent regressions; full npm test before calling implementation verified. Preserve honest failing evidence; no weakened checks. No live provider calls, merges, deploys, deletion or spending. Commit/push only this feature branch when available; no main/staging push. Report base/head SHA, changed paths, reproduced defect, caller reachability, tests/results, WIP/blockers and exact next action. Checkpoint every meaningful batch. ChatGPT independently reviews; your completion is not release approval.

## Grok assignment — paste exactly
Research owner PRG-06 only for Umerfaizan92/Oprun, baseline 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd. Read docs/programme/INITIAL-CHECKPOINT-2026-11-28.md and inspect src/industry-registry.js, src/onboarding-questions.js, src/onboarding-proposal.js and integration docs where accessible. If repository access is unavailable, state that; never infer implemented features.
No runtime edits. If Git access exists use isolated branch grok/prg06-industry-research-20261128 from exact base; only write docs/programme/GROK-PRG06.md. Otherwise return that report text for ChatGPT to preserve. Do not modify shared coordination files.
Produce a dated official-source matrix for Australian healthcare specialties (including Medicare/DVA), NDIS, real estate, tradies/mechanics, retail/restaurants and hybrid businesses. Start Australia/WA, distinguish federal vs state and include a configurable international jurisdiction model without claiming every country's rules researched. For each: business interview questions, required evidence, workflow, roles, sensitive data/retention considerations, provider/API prerequisites, sandbox availability, verification steps, gaps and unknowns. Use current regulator/provider documentation with URLs and checked dates; mark facts vs inferences. Do not invent API availability, approval, certification or legal compliance. Prioritise claims, payments, participant/patient privacy and tenant isolation.
Return maximum ten priority recommendations mapped to PRG IDs, with acceptance criteria and dependencies. No accounts, credential collection, calls/posts/messages, spending, deployment or deletion. Preserve report and exact next action after each batch. ChatGPT validates findings against primary sources before implementation.

## Preservation and exact resume
Current work is documentation only. Publish this checkpoint on codex/programme-audit-20261128, never main/staging (which may auto-deploy). Record publication receipt in final reply and verify content.
Next ChatGPT action: establish Node22/dependencies in isolated clone, run existing tenant/queue/payment/operator suites, inspect all enqueue callers, then verify Claude's PRG-02 diff against base. Ask owner to confirm Render workspace tea-dajtb13m8hqs739l6v50 before service reads; then retrieve live SHA/config and compare with main without mutations.
No supported automatic cross-platform continuation has been configured. Resume requires reopening this checkpoint and checking current Git state; never rely on chat memory. Claude/Grok assignments have not been sent to or accepted by those platforms.
