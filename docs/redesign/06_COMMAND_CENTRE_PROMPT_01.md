# Prompt 01: Final Command Centre refinement (12 Nov 2026)

Branch `claude/command-centre-refinement`, task T-091. Scope: Command Centre (`#dashboard-view`) plus the shared bottom
bar, navigation drawer block, footer and one top-bar accessibility fix. No new dependencies, no data or API changes.

| # | Requirement | Implementation |
|---|---|---|
| 1 | Greeting only | `#user-line` hidden on the Command Centre (element kept; identity still in drawer/profile) |
| 2 | Job pool + Ask AI side by side | `.heading-actions` two-column grid, 44 px buttons, all widths |
| 3 | Status line | `<name> right now` heading removed; "Figures refresh by themselves" + live badge showing last refresh time, or "Reconnecting…" after a failed refresh |
| 4 | Five live sections compact | Same five tiles and data; smaller padding, gaps, icons and numbers. Desktop page fits one 900 px viewport (was 1151 px); 390 px phone page 1281 px (was 2033 px) |
| 5 | Workspace menu moved | Shortcut collection rendered as **All features** at the top of the navigation drawer (`#all-features`), permission-filtered each time it opens; no routes changed |
| 6 | Your next step removed | `#workspace-start` hidden on the Command Centre; builder and links kept |
| 7 | AI command bar | Compact layout, `enterkeyhint=send`, Esc clears, Send disabled state, working spinner, "Answer ready" / error / slow states via new `superpro:ask-status` event from the Ask Oprun panel; approvals unchanged |
| 8 | Footer | Reusable `.oprun-footer`: one slim row on desktop, two compact rows on phones; links unchanged |
| 9 | Bottom bar movement | Root causes: bar lived inside `.app-main` (transformed/animated ancestors made `position:fixed` relative to them) and its `bottom` followed `visualViewport` offsets that differ from `innerHeight` while the address bar animates. Fix: bar is a child of `<body>`, own compositing layer, `bottom:0` + safe-area padding, hidden only while typing with the keyboard open, single bottom reserve so it never covers content |
| 10 | All Features | Bottom "Menu" renamed "All Features" (same drawer), clearer active state |

Also fixed: top-bar search button accessible name mismatch (pre-existing axe failure from PR #86).

## Verification (local, Chromium)
- `npm test` 73/73 (incl. updated `mobile-workspace.test.mjs` keyboard contract).
- `test:redesign-ui` (320/390/768/1440, axe dark + light) pass, with new checks for all ten requirements, bar pinned across scroll, footer not covered.
- `test:mobile-workspace-ui`, `test:comms-ui`, `test:pipeline-ui`, `security:secrets` pass.
- Overflow sweep 320–1920 px: no horizontal scroll or clipped elements.
- `test:ui` (jobs hover) and `test:navigation-ui` (finance reports tab) fail exactly as on `main` 44f2800; not touched (outside this page).

## Not verified
- Real iOS/Android on-screen keyboard and address-bar behaviour (headless Chromium has no on-screen keyboard).
- Live production data volumes on the five tiles.

## Continuation prompt (if another tool continues)
"Repository Umerfaizan92/Oprun, branch `claude/command-centre-refinement`, task T-091 in `.claude/project-memory`.
Prompt 01 (Command Centre) is implemented and tested; PR awaits owner review. Do not merge or deploy without the owner's
approval. Wait for Prompt 02 before changing any other page."
