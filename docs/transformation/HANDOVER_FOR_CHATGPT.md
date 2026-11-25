# Handover: Oprun transformation (for ChatGPT or any other assistant)

Written 24 Nov 2026 by Claude at the end of a long session (updated after TR-43 and the TR-73 local drill). Owner: Faizan (reply in English; he may write in Hindi).
Read this whole file, then `CLAUDE.md` (standing rules), then `.claude/project-memory/SESSION_HANDOVER.md`.

## 1. Where things are

| Item | Value |
|---|---|
| Repository | GitHub `Umerfaizan92/Oprun` |
| Working branch (all new work) | `claude/transformation-phase1` (latest commits are here) |
| Test site branch | `claude/transformation-staging` → Render service **oprun-test** `srv-dc1keajl550s73eolqk0`, https://oprun-test.onrender.com (auto-deploys; every deploy wipes its temporary test data) |
| Live site | Render `srv-dbuq98ojo6nc73aro66g` (oprun.ai), branch `main`. **Do not merge to main or deploy production without the owner's written approval.** |
| Test site state | Commit `c2a7cb2` live since 24 Nov 11:42 UTC; owner is testing it. Do not push to the staging branch until he asks |
| Plan | `docs/transformation/02_BACKLOG.md` (36 items), progress `docs/transformation/04_PROGRESS.md` |
| Task register | `.claude/project-memory/` (PENDING_TASKS, COMPLETED_TASKS with evidence, DECISIONS, ERROR_LOG, CHECKPOINTS) |

## 2. Status of the 36-item plan

- **Done (32):** TR-01–03, TR-10–15, TR-20–25, TR-30–33, TR-40–43, TR-50–52, TR-60–63, TR-70, TR-71.
  TR-43 (24 Nov, after the test-site push): `deploy_to_production`, `reset_or_drop_database`, `make_payment` are
  restricted actions refused by name; `scripts/agent-hard-limits.test.mjs`.
- **In progress (1):** TR-72 performance (task T-236). Part 2 stages 1–4 done 25 Nov (workspace 75–83, layout shift 0; see section 3). Part 1 done: `src/asset-bundles.js` joins the workspace/console
  stylesheets and self-contained deferred scripts into bundles at request time. Lighthouse mobile (lab):
  public pages 97–100, Operator Console 100, **Business Workspace 35–48 (target 85, not met)**. Report:
  `qa/reports/LIGHTHOUSE.md`.
- **TR-73 restore drill (T-238, in progress):** local drill passed (0.19 s, `qa/reports/RESTORE-DRILL.md`);
  production backups confirmed running in the live logs. Remaining: the owner runs
  `npm run backup:restore-drill -- --compare /var/data/super-pro.sqlite` in the live service's Render Shell and
  shares the output; then record it and complete T-238.
- **Not started (2):** TR-80 (owner review on the test site), TR-81 (approved release).
- Note: Render logs on 22 Nov showed builds paused by the workspace build spend limit; the test-site deploy on
  24 Nov built fine. Check the build spend limit before the release (TR-81).

Estimated remaining work: TR-72 part 2 6–10 h, TR-73 15 min after the owner's output, TR-81 1–2 h after approval.

## 3. Next exact action (TR-72 part 2)

**Stage 1 done (25 Nov, D-072):** page scripts load on first open. `saas/workspace-lazy.js` holds the page → group
table; 39 scripts in `saas/workspace.html` are `<script type="oprun/lazy" data-lazy="<group>" src="…">`; `showView` in
`saas/app.js` loads a page's group before showing it; pages not in the table load every group; the server bundles each
group (`src/asset-bundles.js`). Test: `scripts/workspace-lazy.test.mjs`. Lighthouse workspace now 59–74 (was 35–48).
**Stages 3–4 done (25 Nov, D-074, D-075):** quieter start-up (hidden countdown, bounded animations, no forced layouts, English-only text download), layout shift 0 everywhere, honest opening screen (logo only). Workspace 75–83 returning, 69–82 first visit; 85 not met. Next: load non-first-page start-up scripts (assistant, guide, chat, notices, support, tour) after the first page shows; see `qa/reports/LIGHTHOUSE.md` → "What is left".
**Stage 2 done (25 Nov, D-073):** navigation table and dialog queue no longer block the page; a static opening screen
replaces the blank page; the Lighthouse report measures a returning visit plus first-visit rows and a Ready (TTI)
column. Workspace now 63–77 (returning visit), target 85 **not met**. What is left, in order: drawing the first page in fewer
steps (measured: ~1 s of style recalculation in ~170 passes while start-up scripts add their parts; `:has()` rules
ruled out), drawing the frame before the start-up data calls, reserved space for
panels that cause layout shift (Enquiries, Inbox, Money). Details: `qa/reports/LIGHTHOUSE.md` → "What is left". The
notes below are the original plan.

Make each Business Workspace page load its code when the page is first opened, so the first load runs only the
navigation, the Command Centre and shared code. Facts found:
- `saas/workspace.html` has 85 scripts; 78 are deferred self-contained IIFEs (see `selfContained()` in
  `src/asset-bundles.js`). `app.js`, `ai-operations.js` (top-level declarations) and `workspace-locale.js` (module)
  must stay as they are.
- Router: `saas/app.js` `showView(name)` hides all `.view` sections and shows `#<name>-view`, then dispatches
  `gds:viewchange`. Many modules create their own `#<view>-view` section at load and render on `gds:viewchange`.
- Navigation and route data: `saas/workspace-nav.js` (`DOMAINS`, `resolve`, `MERGED`, `pathFor`).
- Suggested design: a view → script map; scripts for other views get `data-lazy-view="…"` and are not loaded at
  start; `showView` loads missing scripts for the view first, then shows it and dispatches `gds:viewchange`.
  Keep every route, element ID and button working.
- Safety net (all must pass): `npm test`, `npm run test:ui`, `test:mobile-workspace-ui`, `test:navigation-ui`,
  `test:comms-ui`, `test:connections-ui`, `test:website-wizard-ui`, and `npm run test:visual` (678 screenshots;
  baselines are made locally with `npm run test:visual:update` on the commit before the change, then compared).
- Measure with `npm run report:lighthouse` (needs `npm i --prefix ~/.cache/oprun-lighthouse lighthouse@12
  chrome-launcher puppeteer-core`, and `UI_CHROMIUM_PATH=/usr/bin/google-chrome` in this kind of container).

## 4. How to work in this repo (short)

- Browser tests need `UI_CHROMIUM_PATH=/usr/bin/google-chrome` in the sandbox.
- After CSS changes: `node scripts/build-design-catalogue.mjs`; after `saas/ds/*` edits: `npm run build:ds`.
- After navigation/console changes: `npm run navigation:inventory`.
- Before each commit: `npm run manifest:update && npm run verify:manifest`, `npm run security:secrets`,
  `node scripts/memory/validate.mjs`.
- Register work with `node scripts/memory/task.mjs add|status|complete|decision` (the `complete` evidence text must
  not contain words like "failed"/"failing").
- Checkpoint: `npm run memory:checkpoint -- --task T-xxx --status … --done … --todo … --next … [--snapshot]`.
- Commits end with the session's attribution lines; push only to `claude/transformation-phase1` unless the owner
  asks for the test site.

## 5. Owner inputs still open

1. Render settings on the live service: `OPERATOR_TOTP_SECRET`, `SESSION_MAX_AGE_DAYS=30`, `STRICT_PASSWORD_MATCH=1`.
2. Decision on the old "Oprun" Render service and its disk (~US$9.50/month).
3. Pricing for AI website generation (current cap: 10 site generations and 100 section rewrites per business per month).
4. Sign-off after testing (TR-80), then approval to release (TR-81).

## 6. Standing rules (from CLAUDE.md, never break)

No destructive changes, database resets, credential rotation, production deploys or infrastructure changes without
approval. Never expose secrets. Keep every route, button, API and element ID working. Keep `#signin-operator-link`
on the Business sign-in page. Do not touch the Fleet Parlour website or the `enquiries` legacy table data. No invented
testimonials. Pages fit phone, iPad and laptop. No looping animation. Never force-push or rewrite history.
