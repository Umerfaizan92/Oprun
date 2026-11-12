# ChatGPT coordination — CP-117 / T-094

## Current handover

- Status: REVIEW_BATCH_1_COMPLETE; T-094 remains TESTING, visual acceptance BLOCKED.
- Branch: `codex/cp117-t094-review-20261112`; separate worktree based on `da37f0587e5866dbccc2cc1f2a7dd59eee538727`.
- Ownership: requirements, acceptance, security/product review and independent evidence. This batch changes only `docs/coordination/**` plus the required release manifest. No application fixes are assigned to ChatGPT; no Claude application or memory files were changed.
- Source: `Oprun_Master_Implementation_Package_2026-11-12.zip`, CP-117, base `7310f6c6033dcda0caaa8d0dd174091f340e8d93`. The older Continuation archive is CP-115 and is superseded. Package identity/hash: `evidence/package-integrity.json`.
- Coordination reads: neither `docs/coordination/chatgpt.md` nor `docs/coordination/claude.md` existed in either saved archive, current main, or Claude batch-5 tree. Do not fabricate Claude's log. Read main's existing project-memory handover (CP-114/T-092), CP-117 saved handover and `docs/redesign/09_FRONTEND_TRANSFORMATION_PROGRESS.md` on Claude batch 5 instead. Main's memory handover is historical, not the current assigned task.
- Verified published heads: main `da37f05` (merged batch 4), Claude batch 5 `62d07df` on `claude/frontend-transformation-b5`. Batch 5 is one commit ahead of this main. Do not substitute older channel-content/communications branches for the latest frontend batch or apply their whole-tree diff.

## Batch 1 results

- Verified every entry in the saved package SHA256 manifest. Kept archived full-suite evidence (73/73) separate from new execution; did not repeat that unchanged full suite.
- New Node 22.23.0 runs: localization DOM 1/1; localization/API/two-portal focused tests 11/11. Combined 12/12 PASS on the unchanged CP-117 candidate, not on main or Claude batch 5.
- Ran CP-117 browser script: application started, Chromium failed before page assertions (`process_singleton_posix.cc`, socket operation not permitted). No visual, RTL layout, keyboard or real-device acceptance claimed.
- Reproduced stale language-save response after workspace switch (CG-001). Reproducer success confirms a bug, not product acceptance.
- Non-mutating patch check against main failed for `office/console.html`, `saas/workspace.html`, `SHA256SUMS.txt`; nothing applied. Preserve batch-3/4 density changes during any later integration.
- Inspected Claude batch-5 targeted source diff and its published check results. At observation: verify/security checks succeeded; recovered-release-ui was still running. Main's own UI job failed in connections test line 54 because the Resend key field was hidden. Full job had passed redesign/navigation/channels before stopping; later commands in that shell step were not run. Details in `REVIEW_CP117_T094.md` and evidence JSON. No rerun, merge or deployment initiated.
- Review findings/acceptance: `REVIEW_CP117_T094.md`; remaining cross-surface/product gates: `ACCEPTANCE_T094.md`.

## Blockers and ownership

1. CG-001: CP-117 locale UI race; implementation owner must be explicitly assigned before ChatGPT edits `saas/workspace-locale.js`.
2. CG-002: saved browser script has a previous workspace's absolute screenshot path; replace with a created output directory when that script is assigned.
3. CG-003: main UI failure and uncompleted batch-5 UI checks prevent an all-green release claim.
4. CG-004: candidate cannot be applied wholesale onto main; integrate only assigned hunks, preserving current density work and recomputing manifest.
5. Local Chromium launch restricted; real browser/device tests require a supported runner. No attempt to weaken environment restrictions.
6. Credentials/provider approvals remain deferred. No external provider action was performed or repeated.

## Exact next action

Read both coordination files if present on remote, then fetch current main and Claude's announced head once. Read CG-001's reproduction and obtain explicit file ownership through the shared assignment record before a code fix. The implementation owner should capture request/workspace generation for PUT and ignore stale completion/error/finally effects after switching; add a regression asserting workspace B retains `ja` when A's delayed `ur` response arrives. Separately repair CG-002, integrate assigned candidate hunks, then run localization + operator coverage browser checks on a supported runner. Inspect the already-running batch-5 UI job outcome once at that point; do not start a duplicate workflow/deploy. Resume the next unverified gate in `ACCEPTANCE_T094.md`.

## Preservation

All review files and sanitized evidence are committed together on this branch; the containing commit is the evidence receipt (`git log -1 -- docs/coordination/chatgpt.md`). Publish through the connected GitHub app if local git cannot authenticate. Keep the CP-117 package intact; it remains the authoritative unmerged candidate. No independent deployment, provider purchase, message send, infrastructure change or credential change is authorized by this log.
