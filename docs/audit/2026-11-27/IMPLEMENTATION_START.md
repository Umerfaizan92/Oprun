# ChatGPT transformation V3 — implementation batch checkpoint
27 November 2026 (Perth). This continuation record supplements canonical .claude/project-memory/PENDING_TASKS.md; no second task backlog. Current owner authorizes isolated implementation/previews/tests/non-production publication, not production release/infrastructure/spending/customer actions.

## State
- Main/live Render independently rechecked7b3d0946c7aa1e442087fa4f588680c0c275513c, live deploy dep-dc42kulbedkc73d1fi9g.
- Work execution environment unavailable; exec_command failed. No cloud browser exposed. GitHub/Render connectors usable.
- Existing old agents unavailable; created actual /root/requirements, /root/design_preview, /root/security_patch_review with exclusive source/doc ownership; root Supervisor owns integration, verifier, CI and continuity.
- Recovered full archived23Nov/26Nov briefs (472/396lines), current memory/decisions, audit comparison and baseline. Do not restart broad audit.

## Concrete source changes
1. DraftPR176: codex/transformation-v3-preview; current candidate0ea2095e3259772f6f11ed05887edeebf977a487.
   - docs/transformation-v3/preview.html ~71KB original standalone inline SVG/CSS/JS. Five proposed screens, synthetic data only; local UI interactions, exact gold/midnight tokens, original proposed artwork/icons.
   - REQUIREMENT_RECONCILIATION.md maps18prompt sections to60existing tasks,62Business routes/113aliases/42Founder entries. Counts are source inventory, not tested coverage.
   - SECURITY_PATCH_REVIEW.md provides reset/caller-ownership/cancellation design and18synthetic test cases.
   - RESUME.md preserves approvals/ownership/next actions.
   - verify-preview.mjs + preview-only GitHub workflow render15screen-width variants, keyboard switching, a11y/overflow, dialogs, Studio tabs/scenes and bounded motion. Localhost/no production/provider requests.
2. DraftPR175: codex/guide-public-containment; candidate de691c3adb3b4f4d97b613077f2f5969208e86f4.
   - src/server.js exact single-field public guide history selection now null instead of guide:+unowned client ID.
   - scripts/product-guide-public-isolation.test.mjs real endpoint regression with loopback mock provider and throwaway database: sharing ID must not inherit previous caller question/reply; explicit request context/language preserved.
   - GUIDE_PUBLIC_CONTAINMENT.md explicitly StageAonly.
   - SHA256SUMS updated; independent source comparison confirms only intended runtime field/comment change. Checksum helper validated against2standard vectors plus original server manifest.
   - No frontend reset race fix or authenticated workspace history implemented yet. No broad security completion claim.

## Verification observed
- PR175 Security workflow45959822661: SUCCESS.
- PR175 CI45959822587 and Visual45959822582: still in progress at last check. Source/handover consistency and secret scan passed; full npm/UI acceptance not yet established.
- PR176 first renderer45960001548: FAIL, home390 scrollWidth419. Old artifact15180491978 contains only checks.json, NOT screenshots. Do not present as valid preview.
- Independent QA found unnamed dialog, invisible focused skip link,36/38px controls. Designer committed fixes df3b0ba; root strengthened tests. First overflow candidate0ea2095 also reflows header/grid without clipping.
- Current PR176 renderer45960187483 and CI45960187435/Security45960187439/Visual45960187499 started; results pending.
- Proposed screenshots have NOT been independently visually inspected; owner visual approval must wait current/proposed comparison and actual image review. Production untouched.

## Exact next action
1. Inspect current renderer45960187483; if failed fetch job logs and use offender/a11y diagnostics, correct candidate and rerun. Do not weaken acceptance or clip overflow.
2. Inspect PR175 CI/visual results, read new regression outcome; fix genuine failures. Preserve exactSHA/run evidence.
3. Download successful renderer artifact; obtain actual usable environment/browser to inspect15images and capture matched synthetic CURRENT baseline for5screens. Existing artwork source is not visual approval.
4. Present ONE consolidated reviewable current/proposed design decision. Continue approved independent security/backend tasks while waiting.
5. Register runtime tasks/status corrections via existing memory CLI once environment returns. Keep full18section crosswalk; do not close broad tasks for small improvements.
6. Before stopping, update this checkpoint with final observed run states/artifacts and exact next action. No auto-merge/deploy. Usage reset alone does not auto-restart.

## Continuation prompt
Resume Oprun transformation V3. Read docs/audit/2026-11-27/IMPLEMENTATION_START.md from codex/audit-20261127, then docs/transformation-v3/RESUME.md and requirement reconciliation on codex/transformation-v3-preview. Inspect draftsPR175/176 and exact heads/workflow results before making changes. Preserve prepared source and avoid repeating audit. Resolve renderer/regression failures first; inspect proposed/current images before visual approval; proceed through incomplete approved tasks only. Production release remains separately gated.
