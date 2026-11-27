# Transformation V3 — execution contract and resume
27 November 2026, Perth. Owner pasted the full18-section implementation instruction in ChatGPT Work and explicitly authorized isolated implementation, synthetic testing, design previews, documentation/checkpoints and non-production branch publication.

## Current authority
This contract preserves scope, not a competing task register. Existing .claude/project-memory/PENDING_TASKS.md remains authoritative. REQUIREMENT_RECONCILIATION.md maps its60 task IDs to the new scope; CLI-based reconciliation is pending environment recovery.

## Confirmed baseline
- Main and latest live Render commit:7b3d0946c7aa1e442087fa4f588680c0c275513c.
- Render service Oprun AI srv-dbuq98ojo6nc73aro66g; latest deploy dep-dc42kulbedkc73d1fi9g LIVE, finished26Nov13:00UTC.
- Non-production branch codex/transformation-v3-preview from that exact base.
- Prior audit branch codex/audit-20261127 retains reports through PROMPT_DELIVERY_COMPARISON.md, commit9248a422d1856397fdb9f4ef23c2ff6253e8ea00.
- No live app/runtime/configuration modifications in this batch.
- Current connector combined-status query returned no statuses; this does not mean CI passed.
- Open PRs inspected: historical#170 self-hosted video spec and#129 build diagnostics remain open; no changes made to them.

## Actual agents and exclusive ownership
| Agent | Scopes | Owned paths | Review |
|---|---|---|---|
| /root | Central Supervisor; integration, testing, checkpoint/release; scopesK/L/M | README/RESUME, verifier and preview-only workflow | requirements read-only QA |
| /root/requirements | ScopeA, all18-section traceability,60 existing task IDs, coverage | REQUIREMENT_RECONCILIATION.md | root; subsequent independent preview QA |
| /root/design_preview | ScopesB/C/D/E/F representative design SOURCE | preview.html only | root + requirements; browser acceptance pending |
| /root/security_patch_review | ScopesG/J security source review | SECURITY_PATCH_REVIEW.md only | root; runtime implementation not yet assigned |
Remaining implementation scopesH/I, communications/integrations, and complete per-surface/backend scope are retained in the18-section crosswalk, not silently dropped. Assign runtime files only after dependency/design review and collision check. Current agent processes may not survive a new session; reuse when alive, otherwise recreate these ownership scopes without claiming old agents running.

## Design deliverable
Standalone browser-renderable prototype source for homepage, Business sign-in, Command Centre, Media Studio, Founder Console; synthetic data only. Exact existing gold#E6B455 and midnight#070B14 plus token graphite/text/status variants. Original proposed SVG wordmark/icon artwork, no font/library downloads and no real authentication/provider/payment actions.

It is a design proposal, not application integration. Full rollout requires owner review of real current/proposed screenshots. Never request owner approval of merely unrendered source as though visual acceptance is ready.

## Safe verification fallback
Work execution environment is unavailable. exec_command failed: No usable execution environment is available. No starting environment is selected, so no wait_for_environment call is appropriate until state changes. Browser tools are also not exposed.
GitHub and Render connectors work. Thus work continues with durable source/requirement/security review through connectors.

Preview-only GitHub workflow uses existing package lock/Playwright/axe, Node22, minimal contents:read, pull_request (not pull_request_target), no secrets or deployment. Renderer serves only preview.html on127.0.0.1 and blocks non-local requests; checks five views at390/768/1440, keyboard activation, serious/critical axe findings, horizontal overflow and JS errors. Artifact has15 proposed screenshots and checks.json if all views reach rendering.
Workflow source committed, but actual invocation/results must be recorded after draft PR creation. Source review alone is NOT a PASS.

It does not provide current/proposed image matching, owner design approval, real-device tests, full runtime acceptance or live deployment. Existing CI workflows may also run on the draft PR; inspect actual outcomes, do not infer success.

## Security retained scope
SECURITY_PATCH_REVIEW.md contains source-reviewed containment/reset/ownership changes and18 regression cases. No runtime fix committed. Public guide stateless server containment plus protected tenant/user/session-bound workspace guide is recommended; reset/cancellation/generation fencing and cross-tab/workspace-switch handling remain required. Never mark these fixed from the proposal.

## Approval boundaries
Authorized: this branch, proposal source, ordinary isolated tests, docs/checkpoints, draft PR.
Required separately: consolidated visual direction before platform-wide rollout; explicit production release approval after verified candidate; additional costs, infrastructure changes, destructive operations and customer/provider actions as specified by owner.
No production-connected merge, deployment, DNS, credentials, paid generation, customer contact or financial action.

## Exact next steps
1. Verify preview source has been saved and inspect independent review.
2. Open draft PR from codex/transformation-v3-preview to main without merge/auto-merge; run existing and preview-only hosted checks. Record exact headSHA/run IDs/artifacts/results and remedy failures.
3. Recover usable Work environment; fetch existing branch instead of recreating work. Preserve unrelated work before switching.
4. Read this RESUME, reconciliation and SECURITY_PATCH_REVIEW; run memory resume and inspect diff/current remote.
5. Render current synthetic baseline and proposed previews at same390/768/1440 widths and matched fixture states. Inspect actual images; produce side-by-side comparison and fix layout/a11y faults.
6. Present ONE consolidated five-screen visual decision only when screenshots are reviewable. Continue isolated verified security work independently while waiting.
7. Register runtime implementation tasks using existing CLI; follow complete18-section crosswalk and owner approval gates.
8. Save verified evidence/checkpoint after each batch; preserve incomplete work on branch. Do not repeat earlier audit/competitor research unless new state invalidates it.

## Ready-to-run continuation
Resume Oprun transformation V3 from docs/transformation-v3/RESUME.md on codex/transformation-v3-preview. Reverify remote head and current main/Render; inspect existing draft PR/check results. Preserve preview/requirements/security work. First resolve the first incomplete exact step above, render and inspect the five-screen current/proposed comparison, then proceed through approved independent tasks. Do not restart discovery, merge/deploy, claim proposals tested or treat a reset usage limit as an automatic restart mechanism.
