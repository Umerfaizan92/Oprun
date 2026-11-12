# Frontend transformation: progress file (both portals)

Owner prompt: "OPRUN — COMPLETE SAAS FRONTEND TRANSFORMATION" (12 Nov 2026). Executed in small verified batches.
Branch per batch `claude/frontend-transformation-bN`; this file records state so any session or model can continue.

## 1. Inventory (baseline main e90b34b)

- Business Workspace: 60 pages in 8 groups (Today, Work, Customers, People, Communications, Growth, Money, Setup);
  full route/role/section map in `docs/navigation/MAPPING.md`, sections in `docs/navigation/SECTIONS.md`.
- Operator/Founder Console (`/office/`, separate operator sign-in, owner-only server RBAC): 34 tabs (F01–F09),
  mapped in the same file. Generate again with `npm run navigation:inventory`.
- Command Centre: Business overview → Your Workspace → Action Centre → Workflow Guidance (PR #90, live).

## 2. Baseline audit (automated, before batch 1)

| Suite | Result |
|---|---|
| npm test (release, 73 checks) | PASS |
| test:console-ui (founder tabs 1440/390) | PASS 16 |
| test:console-all (new: all 29 non-legacy founder pages, 1440/390) | PASS, no errors, failed calls, raw values or sideways scroll |
| report:a11y-perf (public site) | 0 serious/critical, 0 over Web Vitals budget |
| test:redesign-ui, test:mobile-workspace-ui | PASS |
| test:ui | FAIL: Jobs card hover blocked |
| test:navigation-ui | FAIL: finance Reports tab "hidden" on phone |

## 3. Batch 1: verified defects fixed

1. **Drawer scrim stayed over the page** after moving to another page by link, notification, Back/Forward or
   hash while the desktop drawer was open; every click on the new page hit the invisible "Close navigation" scrim.
   Fix: `saas/navigation-shell.js` closes an open drawer on `hashchange` (both portals use this shell).
2. **Card hover jitter**: a lifted `.sp-surface-card` could unhover at its lower edge and shake. Fix: hover keeps a
   5px hit strip below the lifted card (`saas/unified-ui.css`); sticky panels keep `position: sticky`.
3. **Stale tests** (product was right, tests used removed controls): finance tab checks assert selection state on
   phones where the single section bar replaces native tabs; `☰ Menu` → the business identity trigger / phone Menu
   button; Billing tabs on phones via the section bar.

Result: test:ui 34/34, test:navigation-ui, test:console-ui, test:redesign-ui, test:mobile-workspace-ui all PASS.
Also stale on phones (fixed the same way): test:channels-ui and test:automations-ui. Every step of the CI
"recovered-release-ui" job now passes locally (connections-ui and site-ui are timing-sensitive when run in parallel;
both pass when run one at a time).

## 4. Batch 2: shared density layer (done)

`saas/ds/tokens.css` and `retheme.css` were already shared by both portals. What was missing was one final answer for
page headings, panels and empty-state guides (seven competing `.page-heading h1` rules across six sheets).
New `saas/ds/kit.css` (loaded last on the Business Workspace) sets them from tokens: sizes and spacing only, no
colours, nothing hidden, touch targets kept at 44px. Measured with `node scripts/report-density.mjs` on all 60 pages:

| Width | Page heading (avg) | Content starts (avg, px from top) | Pages worse | Sideways scroll |
|---|---|---|---|---|
| 1440 | 110 → 76 px | 297 → 259 | 0 | 0 |
| 390 | 148 → 106 px | 306 → 256 | 0 | 0 |

All 14 browser suites and npm test 73/73 pass (navigation-ui consent sections once timed out at 390px and passed on
rerun; it is timing-sensitive, not layout-related).

## 4b. Batch 3: Founder Console compaction (done, first pass)

Measured with `node scripts/report-console-density.mjs` on all 29 non-legacy founder pages. Desktop was already compact
(content starts at 157px on average). On phones the top bar wrapped into four rows (232px): title, search, four
buttons, then Sign out alone. `saas/ds/kit.css` (now also loaded by `office/console.html`) lays it out as title row,
full-width search, and all five actions on one row: 232 → 174px; content starts 299 → 245px on average; no page
worse; no sideways scroll. Same controls, order and IDs; operator RBAC untouched. Suites: console-ui, console-all,
navigation-ui, automations-ui, reliability-ui, ui, redesign-ui, mobile-workspace-ui all pass.

## 4c. Batch 4: Business Workspace phone top bar (done)

Two rows (111px: business name, then six action icons) → one row (70px): logo and name with an ellipsis, then the
same six actions, tighter. Below 375px only the logo shows (name stays at the top of the menu). All 60 pages: content
starts 256 → 215px on phones (cumulative since baseline: 306 → 215); desktop unchanged; no page worse; no sideways
scroll. Suites ui, navigation-ui, redesign-ui, mobile-workspace-ui, mobile-readiness, channels-ui, comms-ui,
pipeline-ui and console-ui pass (console-ui once timed out on "Feature access" and passed twice on rerun).

## 5. Pending batches (next actions, in order)

- B3 follow-up: Founder Console tables (sticky headers, dense rows, phone card layout) and filters on shared components.
- B4 Workspace pages group by group (Work → Customers → People → Communications → Growth → Money → Setup): compact
  headers, consistent loading/empty/error/retry states, AI help per page, axe per page.
- B5 Performance: defer non-critical scripts in `workspace.html`, remove unused CSS, measure LCP/CLS signed-in.
- Owner actions outside code: S3 uploads IAM `s3:PutObject` on `super-pro-v2/uploads/*`.

## Continuation prompt

"Continue docs/redesign/09_FRONTEND_TRANSFORMATION_PROGRESS.md from the first pending batch (B3 next). Read CLAUDE.md first.
Work in a new branch, keep every route, permission and element ID, run npm test plus the browser suites listed in
section 3, update this file, open a PR, merge when green, deploy Render service srv-dan4rdqjnfac73fceor0 and verify
the build log shows ALL CHECKS PASSED and startup diagnostics 16/16."
