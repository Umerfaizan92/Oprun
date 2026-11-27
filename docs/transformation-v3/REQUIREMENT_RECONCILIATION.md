# Transformation v3 — requirement reconciliation and acceptance crosswalk

27 November 2026 (Perth). Scope owner: requirements agent under root Supervisor. Baseline: main `7b3d0946c7aa1e442087fa4f588680c0c275513c`. Work branch: `codex/transformation-v3-preview`.

**This is a crosswalk into the existing register, not a second backlog.** `.claude/project-memory/PENDING_TASKS.md` remains authoritative. Its status values are preserved here as recorded, not re-certified. No canonical register file was edited because its memory CLI/runtime is unavailable. New discoveries must be registered through that CLI when restored, retaining existing IDs. This document does not declare implementation, testing, staging or live acceptance complete.

## Authorization and evidence precedence

The current owner prompt authorizes isolated implementation, synthetic/local tests, previews, documentation/checkpoints and non-production branch publication. It expressly excludes production merges/deployments, infrastructure changes/spending, deletion, credential change, production record mutation, real messages/publishing and payments. Those exclusions supersede earlier D-093 standing release permission. Root coordinates visual approval of the five-screen comparison before broad visual rollout; safe independent security/backend work can continue.

Read sources: CLAUDE.md; current SESSION_HANDOVER/PROGRESS/MASTER_PLAN/DECISIONS; PENDING_TASKS/COMPLETED_TASKS; docs/transformation/07_MASTER_BACKLOG.md; docs/navigation/MAPPING.json; audit BATCH3 and PROMPT_DELIVERY_COMPARISON on codex/audit-20261127. Earlier main handover references old repository names, verified commit and next action; do not resume it blindly. The durable audit branch has newer operational findings but is not proof of new tests today.

Evidence grades:
- **Source verified:** file contents, task/route definitions and recorded decisions read through GitHub.
- **Prior independent audit:** inherited 27-Nov browser/testing evidence, reusable with exact original scope; not freshly repeated.
- **Historical reported:** Claude completion entries or owner-reported checks, not independent proof this session.
- **NOT TESTED/BLOCKED:** no execution or browser runtime available for this branch.

## Eighteen-section crosswalk

| Current prompt section | Existing requirement anchors | Class / priority | Dependencies and responsible scope | Acceptance before closing |
|---|---|---|---|---|
| 1 Recover state | T-035, T-246; audit batches1–3 | KEEP/UPGRADE P0 | Root + continuity M; current Git/Render, no production mutation | Verify main/work heads, branch ownership, latest checkpoints, outstanding external actions and changed-state delta. CLI/local Git check BLOCKED until runtime exists. |
| 2 One register | T-035, T-246, MB-04 | UPGRADE P0 | Requirements A; root integrates | Correct stale parents with dated evidence; reference one register and preserve history. Do not turn this crosswalk into another status authority. |
| 3 Specialist ownership | T-225–227, T-252; development ownership separate | KEEP/UPGRADE P0 | Root Supervisor assigns actual agent IDs/files | Actual agents, bounded concurrency, non-overlapping paths and independent high-risk reviewer. Agent scopes are not invented production agents. |
| 4 Visible comparison | T-258/MB-23 plus T-251/MB-12 | BUILD/UPGRADE P1 | Brand B + frontend C/D/E/F; QA L | CURRENT/PROPOSED homepage, sign-in, Command Centre, Studio, Founder at390/768/1440; matched synthetic data; concrete layout/hierarchy/graphics difference; one owner design decision. |
| 5 Shared premium system | T-003/005, T-204–209, T-251, T-258 | KEEP/UPGRADE/BUILD P1 | Approved direction, B/C/D/E | Exact existing tokens preserved, original proposed artwork and icons, typography/components/states, dark/light where supported, contrast/keyboard/touch/reduced-motion verified. Existing mark/library is not new artwork. |
| 6 Every surface | T-039; T-208–224; T-258, T-076 | UPGRADE P1 | Approved system, route/control inventory; C/D/E/L | Each discovered route/control/state/role mapped; screenshot and functional coverage. Source route count is not completion. Staff portal included. |
| 7 Navigation/links/SEO | T-211, T-224, T-249, T-255–257; T-158–162 | KEEP/MERGE/UPGRADE P1/P2 | C/D/E/I, current mapping/aliases | Discover and exercise links/deep links/back-forward, canonical/redirect/sitemap/robots/assets/404 and provider destinations. External backlinks only reported where not controlled. |
| 8 Business lifecycle | T-039, T-217–219, T-230, T-257; T-123–142 | KEEP/UPGRADE P1 | G/D/E/L; isolated fixtures and role policies | Enquiry→customer→quote→acceptance→booking→allocation→completion→invoice→payment/reconciliation with relationships, amounts/tax/timezone, approvals/idempotency/audit. No real money or customers. |
| 9 Onboarding/languages | T-228–230, T-262/268, T-263/269; T-270 | KEEP/UPGRADE P1/P2 | D + I + L; country/industry packs | Saved editable interview, stale-version/approval guards, fitting proposals, RTL/locales; expand coverage into forms/settings/errors. Machine drafts marked; language catalogue is not translated-screen coverage. |
| 10 Media Studio | T-188–194, T-202, T-232; D-053 | KEEP/UPGRADE P1 | F/G/H/L, approved direction, provider-safe fixtures | Preserve current decision/working IDs; private library/preview/edit/export; brief/script/storyboard/voice/camera/duration/versioning/cancel/recovery/campaign handoff; actual output verified. Native/paid tests separately blocked. |
| 11 Demo engine | T-259/MB-24 | BUILD P2 | B/F/G/L; actual supported workflows | Versioned feature→demo registry; deterministic synthetic rendering, invalidation, five initial distinct demos, responsive/pause/lazy/offscreen/reduced-motion controls and optional narration. Existing hero is not completion. |
| 12 Communications | T-055, T-260/267, T-157; T-231 | KEEP/UPGRADE P1 | H/G/J/L; template/trigger inventory | Every email/SMS/notification type, brand/sender/plain-text/OTP/preferences/consent/quiet-hours/opt-out/retry/audit. Template versus provider delivery versus inbox appearance separated. DNS changes excluded. |
| 13 Integrations/sites | T-067/068/072/073/079/080, T-233/243, T-242, T-156–163/200/201; W-series completed parts | KEEP/UPGRADE/BUILD P1/P2 | I/G/H/J/L; provider access/approval | Per-provider configured→authenticated→permitted→tested→operational matrix; tenant OAuth/webhook/replay/reconnect tests; site preview/ownership/edit/publication/rollback/export in isolated modes. Do not redo verified W03–08. |
| 14 Security/storage/performance | T-002, T-235, T-236/261, T-060/238/241/245; SEC01–06 audit findings pending CLI registration | KEEP/UPGRADE P0/P1 | G/J/K + independent reviewer L | Caller-owned guide context/reset tests, disk readiness semantics, current-prefix policy tests, tenant/RBAC/AI/job/cache/file boundaries; reproducible mobile85+; operational encryption/restore evidence separately blocked. |
| 15 Genuine agent ops | T-046/048, T-225–227/237/252/253/264 | KEEP/UPGRADE P1 | G/J/K/L; architecture changes require approval | Actual action capability, durable schedule/leases/dedup/retry/timeout/restart/escalation/audit and outcome verification. Default level1 reports are not autonomous business execution. |
| 16 Independent acceptance | T-006/234/235/237/239; all task acceptance | KEEP/UPGRADE P0 | L independent of implementer; execution/browser runtime | Matching before/after, controls, access, a11y/responsiveness/perf; state committed SHA and raw evidence; physical device versus emulation distinguished. No test count substitutes for requirements. |
| 17 Durable continuation | T-035/246 | KEEP/UPGRADE P0 | Root/M + actual agent checkpoints | Git-backed batch resume with scope, SHA, approvals, ownership, evidence, blockers and exact next action. No credentials; no claim reset automatically restarts execution. |
| 18 Release/final comparison | T-240 and current explicit gate | UPGRADE P0 | All candidate gates, owner explicit release approval, K/L/M | Reviewable candidate, rollback/recovery, costs/blockers, requirement matrix; after approved release verify domain/service/SHA/assets/cache/roles and workflows. Never merge/deploy from this checkpoint alone. |

## Correct stale statuses rather than repeat completed work

| Register/evidence conflict | Reconciled treatment and next action |
|---|---|
| T-037 BLOCKED labels vs later T-210 accessible-name work | Historical blocker may be superseded. Check current label-content-name test and exact labels before assigning a duplicate fix; do not close based only on title. |
| T-258 NOT_STARTED vs partial MB23 and T-265/T-266/T-270 | Correct parent to PARTIAL/IN_PROGRESS in register after evidence review. Existing rows, icon and compacting changes retained; approved all-page transformation still pending. |
| T-260 IN_PROGRESS vs T-267 completed | Keep delivered copy/code-first changes; remaining actual inbox/provider/DNS acceptance not established. Do not rebuild controls already present. |
| T-262 NOT_STARTED vs T-268 completed | 559 keys for extra languages is delivered subset. Parent remains PARTIAL until real forms/settings/validation coverage expands and RTL/native review is recorded. |
| T-263 NOT_STARTED vs T-269 completed | Core interview/proposal exists and five-industry tests are reported; parent acceptance must separate text proposal from native voice/production adoption. |
| T-236 and T-261 | Same mobile85+ budget; one implementation/measurement owner, link both IDs. Reuse rejected-experiment records D094 and later D095 before retrying. |
| T-248 NOT_STARTED vs prior independent Render audit | Old preview was observed suspended. Verify still suspended read-only, then correct status/evidence rather than suspend again. |
| T-247 NOT_STARTED vs newer Claude branch backup report | Backup reportedly preserved, old paid service observed active; do not suspend/delete or treat report as new approval. |
| T-060/T-245 vs T-238 completed + live restore panel | Completed/recorded restore evidence is useful but not a fresh independent recovery/RPO/RTO proof. Define exact missing acceptance, including monthly record. |
| T-251 completed vs new artwork absent | Brand library/reference changes delivered; record explicitly keeps existing mark. Register expanded artwork requirement as an additive child through memory CLI, not retroactively falsify old evidence. |
| T-232 completed vs complete Media redesign request | CSS-only style pass delivered. Broad new approved layout remains under current MB23/Studio scope; do not count minor CSS as transformation. |
| T-252 completed vs historical audit “Supervisor absent” | Prior live audit saw Supervisor, findings and heartbeat. Reuse it; validate actual recovery/capability rather than rebuild an existing Supervisor. |
| T-255/T-256 complete despite older counts | Current mapping includes secondary routes; rendered menu has fewer main entries. Do not count raw routes as duplicate menu failures. |
| T-240 IN_PROGRESS + old D093 | Current owner explicitly reinstates production release approval; no inherited blanket authorization. |
| Some completion evidence says “Not released” | Those were written at commit time. Check ancestry and current deployment; do not infer present non-release from old prose. |

## Coverage artifacts and exact counting

`docs/navigation/MAPPING.json` declares baseline `6615f960c357009a409a912b89e02b3af8fa617d`, 62 Business entries (31 primary,31 secondary),113 Business aliases and42 Founder entries in10 groups. This is a preserved source inventory; no runtime assertion made.

| Surface | Source of route/control discovery | Required evidence artifact when execution resumes |
|---|---|---|
| Public | Generated pages and scripts/site source, src/public-site.js, live crawl; prior audit public-routes.json has31 homepage-linked destinations | URL/status/redirect/title/canonical/assets/links inventory + screenshots and click/form coverage |
| Auth/staff | saas sign-in/create/verify/recover/operator pages, invitations/session/MFA flows; staff role mappings | Isolated user/role fixture matrix; no secret values in screenshots/reports |
| Business | docs/navigation/MAPPING.json and saas/workspace-nav.js including aliases/merged view rules | Every registered route + discovered dynamic tabs/dialogs;390/768/1440, role/plan/industry cases, populated/empty/error states |
| Founder | Mapping founder42 entries and office navigation/modules, authenticated read-only audit | Every main/secondary route, tab, modal and restricted action with synthetic platform fixtures |
| Communications | src/email-templates.js, comms/notification send triggers, marketing, recovery/invitation/billing callbacks | Template→trigger→recipient scope→consent→provider receipt matrix; offline previews first |
| Integrations | Existing provider registry/configuration/actions/webhooks and site/domain flows | Capability/permission/state matrix, safe mocks, real-provider blockers separately |
| Visual regressions | scripts/test-visual.mjs, UI suites, previous678 reported baselines | Per-requirement before/after file and review outcome, not only a pass count |
| Security/perf | Current focused tests and Lighthouse scripts; prior audit20 tests/517 routes | Raw logs bound to candidate SHA/runtime; full relevant suite and85+ representative measurements |

Example acceptance record shape (to attach to canonical task, not a new task store):
`task_id, requirement_refs, route/component/API, owner, reviewer, commit, fixture, viewport, theme, role/plan/industry, state, before, after, functional_cases, security_cases, a11y, perf, result, blockers, next_action`.

Current work blockers: execution environment unavailable; no local Git/status/manifest/memory CLI, rendered previews, new tests or screenshots possible in this subtask. Provider/native-device/production acceptance remains separate. No production/app edits by requirements agent.

## Sixty-entry canonical register traceability index

This is a read-only index of existing IDs and recorded statuses. It intentionally does not duplicate full task descriptions, allocate new IDs, or replace register status. Section numbers refer to the current eighteen-section owner prompt.

| Existing ID | Recorded status | Prompt sections | Triage priority | Reconciliation note |
|---|---|---|---|---|
| T-037 | BLOCKED | 5,6,16 | P2 | Accessibility/native readiness; check later completed child evidence before resuming |
| T-048 | NOT_STARTED | 14,15,18 | P1 | Architecture/region choice; proposal only until explicit infrastructure/spend approval |
| T-053 | NOT_STARTED | 8,12,13,16 | P1 | Operational provider acceptance; controlled test-mode approval/access needed |
| T-055 | NOT_STARTED | 8,12,13,16 | P1 | Operational provider acceptance; controlled test-mode approval/access needed |
| T-057 | NOT_STARTED | 8,12,13,16 | P1 | Operational provider acceptance; controlled test-mode approval/access needed |
| T-060 | NOT_STARTED | 1,14,18 | P1 | Operational/infrastructure evidence or approval; account for audit corrections |
| T-067 | TESTING | 7,12,13,16 | P2 | Provider connection/content acceptance; do not infer operational from configured |
| T-068 | TESTING | 7,12,13,16 | P2 | Provider connection/content acceptance; do not infer operational from configured |
| T-072 | BLOCKED | 7,12,13,16 | P2 | Provider connection/content acceptance; do not infer operational from configured |
| T-073 | TESTING | 7,12,13,16 | P2 | Provider connection/content acceptance; do not infer operational from configured |
| T-076 | BLOCKED | 5,6,16 | P2 | Accessibility/native readiness; check later completed child evidence before resuming |
| T-079 | TESTING | 7,12,13,16 | P2 | Provider connection/content acceptance; do not infer operational from configured |
| T-080 | TESTING | 7,12,13,16 | P2 | Provider connection/content acceptance; do not infer operational from configured |
| T-121 | NOT_STARTED | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-122 | NOT_STARTED | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-123 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-124 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-125 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-126 | NOT_STARTED | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-127 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-128 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-129 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-130 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-131 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-132 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-133 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-134 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-135 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-136 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-137 | NOT_STARTED | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-138 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-139 | NOT_STARTED | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-140 | NOT_STARTED | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-141 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-142 | TESTING | 8,12,13,14,16 | P1 | Receptionist R-series; preserve existing implementation; distinguish isolated tests from real calls |
| T-156 | NOT_STARTED | 7,12,13,16 | P2 | Website W-series; provider/infrastructure writes remain approval-gated |
| T-157 | NOT_STARTED | 7,12,13,16 | P2 | Website W-series; provider/infrastructure writes remain approval-gated |
| T-158 | NOT_STARTED | 7,12,13,16 | P2 | Website W-series; provider/infrastructure writes remain approval-gated |
| T-159 | NOT_STARTED | 7,12,13,16 | P2 | Website W-series; provider/infrastructure writes remain approval-gated |
| T-160 | NOT_STARTED | 7,12,13,16 | P2 | Website W-series; provider/infrastructure writes remain approval-gated |
| T-161 | NOT_STARTED | 7,12,13,16 | P2 | Website W-series; provider/infrastructure writes remain approval-gated |
| T-162 | NOT_STARTED | 7,12,13,16 | P2 | Website W-series; provider/infrastructure writes remain approval-gated |
| T-163 | NOT_STARTED | 7,12,13,16 | P2 | Website W-series; provider/infrastructure writes remain approval-gated |
| T-200 | NOT_STARTED | 7,12,13,16 | P2 | Website W-series; provider/infrastructure writes remain approval-gated |
| T-201 | NOT_STARTED | 7,12,13,16 | P2 | Website W-series; provider/infrastructure writes remain approval-gated |
| T-236 | IN_PROGRESS | 14,16 | P1 | Same workspace performance outcome; measure once;85+ not yet independently met |
| T-240 | IN_PROGRESS | 16,18 | P2 | Current prompt requires fresh explicit release approval; historical standing release permissions do not apply |
| T-241 | NOT_STARTED | 1,14,18 | P1 | Operational/infrastructure evidence or approval; account for audit corrections |
| T-242 | NOT_STARTED | 8,12,13,16 | P1 | Operational provider acceptance; controlled test-mode approval/access needed |
| T-245 | NOT_STARTED | 1,14,18 | P1 | Operational/infrastructure evidence or approval; account for audit corrections |
| T-247 | NOT_STARTED | 1,14,18 | P1 | Operational/infrastructure evidence or approval; account for audit corrections |
| T-248 | NOT_STARTED | 1,14,18 | P1 | Operational/infrastructure evidence or approval; account for audit corrections |
| T-253 | NOT_STARTED | 14,15,18 | P1 | Architecture/region choice; proposal only until explicit infrastructure/spend approval |
| T-258 | NOT_STARTED | 4,5,6,7,16 | P1 | Parent NOT_STARTED is stale; partial MB23/T265/T266/T270 exist; all-page acceptance incomplete |
| T-259 | NOT_STARTED | 11,16 | P2 | Versioned demo engine remains unimplemented |
| T-260 | IN_PROGRESS | 12,16 | P2 | Parent IN_PROGRESS plus completed T267; delivery/DNS scope still partial |
| T-261 | IN_PROGRESS | 14,16 | P1 | Same workspace performance outcome; measure once;85+ not yet independently met |
| T-262 | NOT_STARTED | 9,16 | P2 | Parent NOT_STARTED plus completed T268;559-key subset != full translations |
| T-263 | NOT_STARTED | 8,9,16 | P2 | Parent NOT_STARTED plus completed T269; core proposal exists; native voice acceptance open |
| T-264 | NOT_STARTED | 14,15,18 | P1 | Architecture/region choice; proposal only until explicit infrastructure/spend approval |

## Exact next integration action

Root uses this crosswalk for agent handoff without editing the canonical register through the connector. On runtime restoration: read latest branch heads, run memory:resume and inspect local Git, register the approved transformation/security additions through memory CLI, correct stale parent statuses with dated source evidence, then build/render the five-screen comparison and run independent checks. Preserve working production code and keep current release restrictions. The requirement-to-evidence coverage gate must include every existing task above, all eighteen prompt sections, and newly discovered controls before any whole-platform completion claim.
