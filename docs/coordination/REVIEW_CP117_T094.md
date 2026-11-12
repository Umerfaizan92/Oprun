# CP-117 / T-094 independent review — batch 1

Review scope: unchanged saved localization candidate plus published frontend batches 3–5. Main at `da37f05`; unmerged Claude batch 5 at `62d07df`. Evidence is version-specific. This is not production certification.

| ID / priority | Requirements | Finding and evidence | Action / acceptance |
|---|---|---|---|
| CG-001 / P1 | R14-01, R01-03 | Confirmed candidate UI race. `saas/workspace-locale.js:44–46` increments revision for PUT but applies its response unconditionally. Save Urdu in A, switch to B (Japanese loads), release A's delayed response: B displays Urdu. `evidence/localization-race.mjs` and `.log` reproduce it. No server-side cross-tenant data access was demonstrated. | Bind GET/PUT response handling to the active workspace/request generation; suppress stale status and button effects too. Regression: B stays Japanese after A's late success and failure; test reverse response order and sign-out. File remains unassigned for ChatGPT implementation. |
| CG-002 / P2 | R13-06, R14-03 | Saved `scripts/test-localization-ui.mjs:31` writes a screenshot to `/workspace/scratch/88396daa6758/localization-mobile-ur.png`, a previous session's absolute path. Current browser launch fails earlier, so this later error is static evidence, not an observed runtime failure. | Use an environment-selected or repository-relative output directory; create it. Run from a fresh checkout on a supported runner and preserve screenshots with source SHA. |
| CG-003 / release gate | R13-01, R12-05, R16-04 | Main check `recovered-release-ui` failed: `test-connections-ui.mjs:54`, provider card visible but Resend key input hidden for 10s. Job 131193132928. Batch-5 UI job 131209715875 was in progress when inspected; other checks passing do not close this failure. | Determine form/route/render race from trace; explicitly wait for intended form state if correct, otherwise fix UI. Require current-head full UI success. Do not classify it as harmless flakiness or hide the field with forced test interactions. |
| CG-004 / integration gate | R13-01, R14-01, R16-04 | `git apply --check` of CP-117 patch onto main fails on two portal HTML files and manifest. Main added shared density stylesheet/version changes after candidate base. `evidence/candidate-apply-check.log`. | Merge assigned hunks only, keeping current CSS order/version and every control. Regenerate manifest. Test locale trigger alongside one-row header at 320/360/390/768/1440 and operator language navigation; no blind source-tree replacement. |

## Verified positive evidence and limits

- Candidate: 12/12 newly executed focused tests pass, including session-bound identity, active membership, invalid/forged fields, per-user/per-business preferences, revoked membership, real cross-origin denial and operator-only language coverage without user identifiers. Tests use isolated throwaway data and synthetic credentials. These results do not certify unrelated endpoints.
- All saved package manifest entries passed. Archived full suite 73/73 and production dependency scan are preserved historical evidence; no fresh vulnerability database claim is made.
- Browser launch failed with the same environment socket restriction as CP-117. No screenshot, geometry, native-speaker review, screen-reader or live-device result was obtained.
- Batch-3/4 source changes inspected: shared `kit.css`, portal stylesheet inclusion and one-row workspace topbar. No backend permission change appears in those targeted changes. This does not prove every UI/role combination works.
- Batch 5 introduces global compression and Command Centre placeholders. Neither was altered. Published performance figures are Claude's local measurements, not independently reproduced field metrics. The reported throttled-phone LCP of 5.1s still exceeds the blueprint's proposed 2.5s target; neither is a current production field result.

## Batch-5 checks still needed

1. Placeholders predict 5/4 tiles from coarse role; render filters custom permissions. Verify manager/custom grants with delayed, denied and failed responses; no inaccessible figures or false Live status; accessible loading state clears; no layout regression. This is a test gap, not a confirmed access-control bypass.
2. Global compression: exercise authenticated no-store responses, `Vary: Accept-Encoding`, already-encoded assets, clients without encoding support, errors and streaming voice NDJSON (first chunk arrives before completion). Existing source streams with `res.write`; buffering risk needs measurement. No compression security vulnerability is claimed from source inspection alone.
3. Performance reporter has one sample per profile, 3-second observation and no pass/fail budgets. Use repeatable cold/warm runs, settle pending request-size callbacks, report distribution and include all relevant roles. Keep lab and real-user p75 metrics separate.

## Source and CI receipts

- Main: https://github.com/Umerfaizan92/Oprun/commit/da37f0587e5866dbccc2cc1f2a7dd59eee538727
- Claude batch 5: https://github.com/Umerfaizan92/Oprun/commit/62d07dff1b05d489005950668ec5b1e36397c1c7
- Main UI failure: https://github.com/Umerfaizan92/Oprun/actions/runs/43221281130/job/131193132928
- Batch-5 UI observation: https://github.com/Umerfaizan92/Oprun/actions/runs/43226142719/job/131209715875
- Exact check observations: `evidence/main-ci.json`, `evidence/claude-b5-ci.json`. Status can change; these are snapshots, not a promise about future runs.

Review-only ownership: `docs/coordination/**`. No application files changed. Findings are ready for explicit implementation assignment; no release or deployment requested.
