# Claude coordination log (Oprun)

Claude writes only this file in `docs/coordination/`. ChatGPT/Codex keeps its own log (suggested
`docs/coordination/chatgpt.md`); neither tool edits the other's log or branches. Coordination happens through
committed work and pull requests. No tool merges or deploys without the owner.

## Ownership (proposed 2026-11-12, owner to confirm)

| Owner | Scope | Branch prefix |
|---|---|---|
| Claude | T-094 reconcile and browser verification (done); Prompt 03 localization migration of Business Workspace and Console views; T-095 Founder Console tables (density batch 3 follow-up) | `claude/` |
| ChatGPT | (out of usage until about 2026-11-16; Claude covers its open findings meanwhile) Prompt 02 security and identity review; Prompt 04 Connection and Services Hub; next prompts in `docs/platform-blueprint/PROMPTS.md` order unless reassigned | `codex/` |

Shared files that need care (touch only in small, rebased commits): `saas/workspace.html`, `office/console.html`,
`SHA256SUMS.txt` (regenerate with `npm run manifest:update`, never hand-merge), `.claude/project-memory/*` (append via
`npm run memory:*` on your own branch only).

## Batch log

### 2026-11-12 Batch R1: T-094 package reconciled onto current main (CP-117 → CP-118)

- PR #98 (open, not merged). Commits `65d9992` (reconcile) and `7021df8` (merge of main `ad2713f`).

- Source: `Oprun_Master_Implementation_Package_2026-11-12.zip` (package hashes verified OK). Candidate base
  `7310f6c` (density batch 2); current main `da37f05` (density batches 3 and 4, PRs #95, #96).
- Branch: `claude/t094-package-on-main` from `origin/main` at `da37f05`. Candidate patch applied with 3-way merge.
  30 of 33 files byte-identical to the package `source/`. Three expected differences, resolved keeping main's newer
  work: `office/console.html` and `saas/workspace.html` (kept `ds/kit.css?v=20261112.3` from main, added the
  package's locale assets and cache versions), `SHA256SUMS.txt` (regenerated).
- Added: `platform/localization` founder page to `docs/navigation/MAPPING.*` (regenerated with
  `npm run navigation:inventory`) so the console sweep covers it; `scripts/test-localization-ui.mjs` falls back to
  Playwright's Chromium when `/usr/bin/chromium` is absent (`UI_CHROMIUM_PATH` still overrides).
- Package blocker cleared: real-browser localization test now runs and passes.
- Tests on this branch (Node 22.23.4, Chrome for Testing 153):
  - `npm test` ALL CHECKS PASSED 73/73
  - `node scripts/test-localization-ui.mjs` PASS (selector 180+ locales, Urdu RTL, save/reload, English fallback,
    360px panel, keyboard focus, currency format, cross-origin write rejected)
  - localization + two-portal security unit tests 12/12
  - `test:unit` 287 pass, 0 fail
  - `test:console-all` 30 founder pages at 1440/390 (includes the new Languages page); `test:console-ui` 16;
    `test:navigation-ui` 594 checks; `test:ui` 34; `test:redesign-ui`; `test:mobile-workspace-ui` 354
  - `security:secrets`, `verify:manifest` (612 files), `memory:validate` PASS
- Not verified: native-speaker translation, RTL on every screen (only shell and language panel), native mobile apps,
  provider activation. Translation scope remains pilot English/Hindi/Urdu/Arabic for the language panel and selected
  header controls; other screens use English fallback.
- Blockers: none for this batch. Credentials and approvals remain deferred to Prompt 14.

- Main moved during the batch to `ad2713f` (PR #97, density batch 5: response compression, Command Centre load).
  Merged into this branch (no rebase, no force-push). Conflicts: `saas/workspace.html` (kept main's
  `command-centre.css?v=20261112.13` and `workspace-gadgets.js?v=20261112.2` plus the locale assets), generated
  `qa/reports/navigation-coverage.json` and `SHA256SUMS.txt` (regenerated). After the merge: `npm test` 73/73, localization
  browser test PASS, focused 12/12, console-all 30 pages, console-ui 16, navigation-ui 594, ui 34, redesign-ui,
  mobile-workspace-ui 354.
- Coordination note: another session is continuing the density batches on `claude/frontend-transformation-bN`
  (batch 5 merged). T-095 overlaps that plan's "B3 follow-up", so it stays parked until the owner confirms who owns it.

### 2026-11-13 Batch R2: ChatGPT review findings CG-001 to CG-003 fixed (CP-119)

- Input: ChatGPT review on `codex/cp117-t094-review-20261112` (`4b0c1ba`, `docs/coordination/chatgpt.md`,
  `REVIEW_CP117_T094.md`, `ACCEPTANCE_T094.md`). ChatGPT is out of usage for about 3 days, and the owner asked Claude
  to complete everything, so Claude took the implementation of the three findings. ChatGPT's branch and files were
  not edited.
- **CG-001 (P1, R14-01)**, `saas/workspace-locale.js`: the save request now records the request revision and a context
  generation, which bumps on business switch (`superpro:workspace-ready`) and on sign-out click. A response from an
  older save, business or session cannot repaint the page, set a status message or re-enable the save button.
  Switching business clears the status and re-enables Save. Cache version `workspace-locale.js?v=20261113`.
  Regression (`scripts/localization-ui.test.mjs`, 5 new): late success after switch; late failure after switch;
  reverse-order responses (newest wins); older save cannot re-enable the button while a newer save is pending;
  save finishing after sign-out. Negative check: on the unfixed file all 5 new tests fail; with the fix 6/6 pass.
- **CG-002 (P2)**, `scripts/test-localization-ui.mjs`: removed the stale absolute screenshot path. A screenshot is
  saved only when `UI_SCREENSHOT_DIR` is set (folder created), the same as the other UI tests. Urdu phone
  screenshot checked: right-to-left panel at 360px.
- **CG-003 (release gate)**, `scripts/test-connections-ui.mjs`: CI on current main `ad2713f` and on this PR passes, so
  the failure on `da37f05` was intermittent. Two timing weaknesses fixed without hiding anything:
  1. After switching theme the accessibility scan waited a fixed 450ms; on a slow runner it sampled the light
     background with dark-theme text (contrast 1.03). It now also waits for running CSS transitions to finish
     (capped at 3s; looping animations are not awaited). Evidence: under 3 parallel runs the old test failed 3/3 on
     light-theme contrast; the new test passed 3/3.
  2. The Resend form is a `<details>` opened by a summary click after Connect. The test now waits for the email
     section, clicks the summary only if the form is closed, and fails with an explicit CG-003 message if the form
     does not stay open. Limit: the original "form stayed collapsed" failure was not reproduced locally, so its root
     cause is not proven; the new message will identify it if it recurs. No UI behaviour was changed.
- Tests on this branch: `npm test` 73/73; `test:unit` 292 pass, 0 fail; localization browser test PASS;
  `test:connections-ui` PASS (single and 3 parallel); `test:ui` 34; `test:mobile-workspace-ui` 354;
  `test:console-all` 30 pages; `test:navigation-ui` 594; secrets scan and manifest PASS.

### 2026-11-13 Batch R3: batch-5 review checks (PR #99, branch `claude/b5-review-checks`, `0a3cef3`)

- Tests only, no application change. Closes ChatGPT's "Batch-5 checks still needed" items 1 and 2.
- `scripts/compression.test.mjs` (real server; test-only preload `scripts/fixtures/gemini-stream-mock.mjs` intercepts
  only the Gemini streaming URL): streamed voice chunked and uncompressed, first audio before the 1.5s upstream gap;
  authenticated JSON gzip with `Vary` and `no-store` kept; precompressed `kit.css` encoded once; plain body without
  gzip; 401 unchanged. Finding: two independent guards keep voice uncompressed (`application/x-ndjson` is not
  compressible; route sends `no-transform`). Removing both fails the test; either alone does not.
- `scripts/test-command-centre-loading-ui.mjs`: owner, manager and custom role; delayed, 403 and 500; 390 and 1440;
  12/12. Limit: roles simulated client-side, so real manager tile count is not proven (layout-shift risk only, no
  data exposure).
- Tests on that branch: `npm test` 73/73; `test:unit` 285 pass, 0 fail; loading UI 12/12; secrets and manifest PASS.
- Still open from that review: item 3 (repeatable performance runs with budgets and distributions).

### 2026-11-13 Batch R4: T-095 done, merged and deployed to Render (owner-authorised)

- Owner instruction 2026-11-13: "Complete all tasks and prompts accurately then push it to render for live testing".
  This explicitly authorised merge and deploy for this batch.
- T-095 Founder Console tables completed (`5960cf2`) on top of PR #98; console sweep now also checks 768px.
- Integration tested as one tree (`282e07c` = main + #98 + T-095 + #99): `npm test` 73/73; `test:unit` 296 pass,
  0 fail; console-all 30 pages at 1440/768/390; console-ui 16; navigation-ui 594; mobile-workspace-ui 354;
  redesign-ui; connections-ui; Command Centre loading 12/12; localization browser PASS; secrets, manifest, memory PASS.
  GitHub CI on `282e07c`: all 7 checks success.
- Merged: PR #98 -> `cdef42b`; PR #100 (T-095 + PR #99 commits) -> `2e51e02`. GitHub marks PR #99 merged. Main
  tree verified identical to the tested tree.
- Render service `Oprun` (`srv-dan4rdqjnfac73fceor0`, autoDeploy off) deployed manually: deploy
  `dep-dbr7ctec6qcc73d2an5g`, commit `2e51e02`, status live at 02:36 UTC. Render build re-ran `npm test` (62 contract
  files, live RBAC and pipeline checks PASS). Startup: diagnostics 16/16, existing database kept, database snapshot
  written to S3 at 02:35:57. Rollback point: previous live deploy `dep-dbqs1dm7bikc73avofbg` (commit `ad2713f`).
- Not verified: live pages were not opened from this workspace (network allowlist blocks onrender.com for shell,
  fetch and browser). Owner should check the live site on phone, iPad and laptop.

#### Open issues found
1. **S3 upload backup permission (owner action, infrastructure).** Every 2 minutes since at least 2026-11-13 01:50
   UTC (both old and new instance): AWS user `superpro-app` is denied `s3:PutObject` on
   `super-pro-v2/uploads/branding/...` in the production bucket. The file is safe on the Render disk but is not
   copied to S3. Database snapshots to S3 succeed. Fix: allow `s3:PutObject` for `super-pro-v2/uploads/*` on that
   IAM user (owner, in AWS). Claude made no credential or infrastructure change.
2. **Intermittent `test:ui` failure at `scripts/test-ui.mjs:220`** (Staff page, `#team-open-invite` not visible).
   Pre-existing: 1 of 3 runs failed on `ad2713f` before today's changes; 1 of 4 on the integration tree; then 7
   consecutive passes with state capture enabled, so the cause is not yet known. CI passed. Next: capture state on
   failure permanently and fix.

### 2026-11-13 Batch R13: Prompt 03 L7, notifications panel and phrase translator (T-104)

- Live (R12) deploy: `dep-dbreuemi0phs73flknbg`, commit `3ade869`, startup diagnostics 16/16.
- **Phrase translator** in `workspace-locale.js` for older screens built from HTML strings: mark a container with
  `data-i18n-phrases="name"` and register `window.OprunPhraseMaps[name] = { 'Exact English': 'key', 'Prefix ': 'key' }`.
  Exact text nodes and aria-label/placeholder/title are swapped; the English is remembered, so switching back works;
  anything not in the map (customer data, notice titles) is never touched. A MutationObserver per container handles
  re-renders; full re-scans happen only on a language change.
- Notifications panel (header, settings switches, push statuses, tabs, empty states, notice timing and kinds) and
  the footer subscription line (now separate text nodes, same English) use map `notices`: 62 phrases including
  subscription status words. Dictionary `2026-11-13.8`.
- Tests: phrase map English equals the dictionary; browser checks Urdu panel title, settings, close label and
  footer, then en-AU (exact English restored) and back to Urdu; `npm test` 73/73; `test:unit` 307 pass, 0 fail; ui,
  navigation, mobile-workspace, redesign PASS.

### 2026-11-13 Batch R12: Prompt 03 L6, page tabs and Today voice bar (T-103)

- Live (R11) deploy: `dep-dbreg9rbc2fs73crni40`, commit `2ac4f71`, live 10:41 UTC.
- Configured page tabs (28 names in `focused-workspace.js`, 7 pages incl. Today): `page-sections.js` tags each tab
  with `tab.<english-key>` after the English section key is fixed, so `?section=` links never change. Pages whose
  tab names come from panel headings are not covered yet (part of each screen's body migration).
- Today voice bar: title, placeholder, Speak/Send, hint, quick-request chips and 15 status messages (looked up by
  their English; English kept in `data-en` for comparisons). Quick-request questions sent to the AI stay English.
- `translateOne` now skips keys that are not in the English dictionary, so a missing key can never show raw text.
- E-038 (caught before commit): a `//` comment in single-line `page-sections.js` code disabled the rest of the line;
  replaced with `/* */`. Lesson: never use `//` comments inside minified-style lines.
- Dictionary `2026-11-13.7`, screens `tabs` (28) and `voiceBar` (27).
- Tests: dictionary 10 (tab names in sync with the configuration; voice bar English equals the script's text);
  localization browser (Urdu tabs with English keys, link keeps `section=action-centre`, voice bar text, placeholder
  and status); `npm test` 73/73; `test:unit` 306 pass, 0 fail; navigation-ui, ui, mobile-workspace, console-all,
  redesign PASS.

### 2026-11-13 Batch R11: short language picker labels (T-102, owner request)

- Live (R10) deploy: `dep-dbrdpg56e07s73bcn75g`, commit `a3d2450`, startup diagnostics 16/16.
- Owner asked for short, professional language names (was "Australian English — Australian English (en-AU)").
  Now each language once in its own standard name ("English (Australia)", "Español (México)"), with the English name
  added only for non-Latin scripts ("اردو · Urdu"); no codes. Twi overridden (browsers call it Akan). 197 unique
  labels, longest 38 characters. Same names on the Founder Console Languages page.
- Live-site testing: this workspace cannot reach onrender.com (shell, fetch and browser blocked); the Chrome extension
  is not connected from the owner's phone. Owner testing on device, or Claude in Chrome from the owner's computer.
- Tests: label test (unique, short, no codes, capitalised); browser picker check; `npm test` 73/73; `test:unit` 305
  pass, 0 fail; console-ui 16 PASS.

### 2026-11-13 Batch R10: Prompt 03 L5, always-visible chrome (T-101)

- Live (R9) deploy: `dep-dbrcq66i0phs73ffuk8g`, commit `4581eca`, startup diagnostics 16/16.
- `workspace-locale.js`: `translateTree()` handles `data-i18n` (text) and `data-i18n-attr="aria-label=key;placeholder=key;
  title=key;data-tip=key"`; a `MutationObserver` translates tagged elements as scripts add them, so other scripts
  only need to tag elements. `lang` now marks only text really in the reader's language.
- Tagged (English unchanged): top bar search (text, label, tooltip), tour button label and tooltip, User Manual,
  Get paid (text and label), Office chat launcher, Ask Oprun launcher (text, label, placeholder), phone bottom bar
  (All Features, Ask Oprun, Office chat), footer links and copyright. Dictionary `2026-11-13.6`, screen `chrome`, 19
  keys. `support.js` also runs on public pages; there only the tags are added (harmless).
- Still English on Today: section tabs (Workflow Guidance, Action Centre, Your Workspace, Business overview), the
  "What would you like done today?" voice bar, subscription footer line (status word), notification panel.
- Tests: dictionary 8 (new: every key a script tags exists and its English is that script's own text); localization
  browser (Urdu top bar, labels, floating buttons, footer, phone dock); `npm test` 73/73; `test:unit` 304 pass,
  0 fail; ui, mobile-workspace, navigation, redesign, site-ui 16 PASS; no clipping at 390.

### 2026-11-13 Batch R9: Prompt 03 L4, business navigation menu (T-100)

- Live (R8) deploy: `dep-dbrbq7tbedkc73d55hog`, commit `dc42983`, startup diagnostics 16/16.
- Dictionary `2026-11-13.5`, screen `navigation`, 78 keys: 8 menu groups, 60 page names, 9 related-page group names
  (`WORKFLOWS`), and "More {group} tools"; hi, ur, ar machine drafts. "SEO · Google" is brand-only and stays as is.
- `workspace-nav.js` keeps each English label (`enLabel`) and swaps names on `oprun:locale-changed`, then redraws.
  Paths, aliases and view IDs never change, so links and old hashes keep working. The redraw announces
  `superpro:nav-ready`, which rebuilds the side rail, breadcrumb, related-page chips and Today feature tiles.
- Fixes found on the way: `render()` added a click listener on every call (outside its bind guard), now bound once;
  the new listener tolerates the minimal stand-in `window` used by older navigation tests.
- Tests: dictionary 7 (English names equal the live menu, including related-page groups in order); localization
  browser (Urdu rail and chips, page link still routes); `npm test` 73/73; `test:unit` 303 pass, 0 fail;
  navigation-ui, test:ui, mobile-workspace, redesign, console-all PASS. Urdu menu: no overflow at 390.
- Still English: page headings and body text inside individual screens (each screen is its own migration), the
  industry name, top-bar buttons ("User Manual", "Get paid", search), the floating chat buttons and the footer.

### 2026-11-13 Batch R8: T-099 Today sections translated; E-037 render loop fixed

- Live (R7) deploy: `dep-dbrb8j5bedkc73d3lln0`, commit `51fcd07`, startup diagnostics 16/16.
- **E-037 (bug on live main):** opening the Today "Action Centre" tab rebuilt its panel about 20 times a second, and
  "Your Workspace" (feature finder) about 50 times a second, forever: render changes the DOM, the section script
  re-announces the section, and that re-renders again. Constant CPU use, and buttons kept being replaced (clicks
  could miss). Fixed with the same identical-repaint guard Workflow Guidance already had. Measured with the fix: 0
  rebuilds in 2 seconds on both tabs (main: 40 and 99). Regression check in `test-command-centre-loading-ui.mjs`.
- **T-099:** `command-centre-sections.js` text via `OprunLocale.t` with English fallback: Action Centre (next-step
  statuses, priorities, plan buttons and messages), Workflow Guidance (8 stages with name, what, needs, next and
  counted units; summary and chips), feature finder fixed text. Dictionary `2026-11-13.4`, screen `todaySections` 98
  keys in hi, ur, ar (machine draft). Sections redraw on language change and keep right-to-left order. "Generate AI
  plan" adds "Answer in <language>." for non-English readers.
- Still English: navigation-derived names (feature tiles, group names, "Open <page>" page titles come from the
  navigation menu), the industry name, and AI replies when the model ignores the language request.
- Note: counts of 1,000 or more now show a thousands separator ("1,234 jobs"); English is otherwise unchanged.
- Tests: dictionary and locale 12/12; localization browser PASS (Urdu Action Centre and Workflow tabs, stage detail,
  plan asks for Urdu); Command Centre loading 14 cases; `npm test` 73/73; `test:unit` 302 pass, 0 fail; test:ui,
  redesign, navigation, mobile-workspace PASS.

### 2026-11-13 Batch R7: Prompt 03 L3a, industry vocabulary per locale (T-098)

- Live (R6) deploy: `dep-dbrahl49v7es73c16a0g`, commit `8254b6e`, startup diagnostics 16/16.
- Dictionary `2026-11-13.3`: screen `terms`, 72 keys (8 industry groups x job, jobs, customer, customers, team,
  member, revenue, costs, pitch) in hi, ur, ar (machine draft). `member` is the singular team word the board used to
  derive with an English-only rule.
- The board uses a translated word only when the reader's dictionary has it; otherwise the server's English
  (English output unchanged). Test keeps the English dictionary in sync with `src/industry-registry.js` TERMS.
- Still English inside translated text: the industry name in the status line ("tuned for plumbing", about 40
  industry labels).
- Tests: dictionary 6/6; browser test asserts no Jobs/Team/Income/costs on the Urdu board; `npm test` 73/73;
  `test:unit` 302 pass, 0 fail; test:ui, Command Centre loading, mobile-workspace 354 PASS.

### 2026-11-13 Batch R6: Prompt 03 L2, Today greeting and live figures board (T-097)

- Live (R5) deploy: `dep-dbr99nk9v7es73btr7mg`, commit `3ac5a02`, startup diagnostics 16/16.
- `OprunLocale.t(key, values)` for script-drawn text; English fallback kept inline in the scripts.
- Dictionary `2026-11-13.2`: new screen `todayLive` (24 keys: greeting, tile labels, plurals, status line, live badge,
  loading text) in hi, ur, ar (machine draft, unreviewed). Arabic uses all six plural forms; English output is
  word-for-word what the board showed before (tested).
- The board redraws from already-loaded figures when the language changes (no reload, no extra request).
- Tile lines in Urdu/Arabic keep right-to-left order even when they start with a number or an English term
  (`data-i18n-scope` + `lang` on the board).
- **Known gap:** business vocabulary from the server (`terms`: Jobs, Team, Income, costs) stays in English inside
  translated sentences. Next: translate the industry vocabulary on the server per locale, or let owners set it.
- Not yet migrated on Today: workflow track and readiness checklist (`command-centre-sections.js`, about 22 KB).
- Tests: dictionary 5/5; locale UI 6/6; browser test extended (Urdu greeting and board, ur->ar->ur switch without
  reload, RTL isolate on tiles); `npm test` 73/73; `test:unit` 301 pass, 0 fail; test:ui, Command Centre loading,
  redesign, mobile-workspace 354, navigation 594, console-all PASS.

### 2026-11-13 Batch R5: E-036 root cause fixed; Prompt 03 L1 (dictionaries + Today)

- **E-036 fixed (`2213382`).** In-page click tracing under 2x load showed the TikTok "Save selection" click landing on
  the card `<article class="... tilt is-tilting">` instead of the button: the hover tilt renders cards in 3D
  (`preserve-3d`), and coplanar buttons lose hit-testing to their card while it tilts or springs back. No request was
  sent, so the save silently did nothing. This is a real usability defect on slow devices. Cards containing buttons,
  links or form fields no longer tilt (`saas/workspace-fx.js`); display-only cards keep the effect. Probably also
  the root cause of ChatGPT's CG-003 (Resend form not opening; same card type). `test-ui` default wait 8s -> 15s
  (other UI suites use 10-12s); failure state now printed as `DIAG` lines (setting `error.message` after creation
  does not reach the printed stack). Evidence: 2x parallel `test:ui` failed 4/4 before, passed 6/6 after.
- **T-096 Prompt 03 L1:**
  - `saas/locale-catalog.js`: `DICTIONARY_VERSION` 2026-11-13.1; `DICTIONARY_REVIEW` (en source; hi, ur, ar
    `machine-draft-unreviewed`); `SCREENS` (shell 9 keys, today 14); `screenCoverage()`; `formatMessage()` with `{name}`
    and `{n, plural, =0 {} one {} other {}}` via `Intl.PluralRules` (plain text only); base-language fallback
    (ur-PK -> ur).
  - Today screen: 14 static strings tagged; icon buttons keep their icon. Figures strip, greeting, workflow track and
    loading text are re-rendered by scripts and are not yet migrated.
  - Mixed-language reading order: on right-to-left pages, untranslated English keeps its punctuation
    (`unicode-bidi: plaintext`); translated text stays right-to-left even when it starts with "AI" (`isolate`). Before
    this, Urdu users saw ".Good day, Alex" and "?What would you like done today".
  - Founder Console Languages page shows version, review status and screens covered.
  - Tests: `localization-dictionary.test.mjs` 4 (English dictionary equals page text so English users see no change;
    every key assigned to a screen; coverage and fallback; plurals including Arabic's six forms; values never parsed
    as HTML); browser test extended (Urdu Today at 1440/768/390/360, no sideways scroll, bidi computed styles).
- Tests on this branch: `npm test` 73/73; `test:unit` 300 pass 0 fail; connections, console-all, navigation-ui,
  mobile-workspace-ui, redesign-ui, command-centre-loading, console-ui, localization browser: all PASS.
- Translation quality: Hindi, Urdu and Arabic strings are drafts written by Claude, not native-speaker reviewed.

### T-095

Completed and deployed (see Batch R4). Branch `claude/t095-console-tables-wip` is superseded.

## Exact next action

1. Owner: live check on phone, iPad and laptop; S3 upload permission (E-035).
2. Claude next: Prompt 03 L8: screen bodies in menu order, starting with Work: Enquiries. Prefer the phrase
   translator for HTML-string screens (register a map, mark the view), `data-i18n` for static markup.
3. When ChatGPT resumes: CG-001 to CG-003 fixed and deployed; CG-003's probable root cause is E-036 (fixed in R5).
   Re-verify independently and continue `ACCEPTANCE_T094.md`.

### S1 (T-105): Meta sync and comment replies, 2026-11-13
- Owner reprioritised (D-037): connections first, social media first; Prompt 03 L8 paused.
- Facebook Page: posts, comments, followers and Page likes sync with the Page's own token; Instagram (linked to the Page): posts, comments, followers, likes. Ownership is re-checked on every sync and reply.
- Replies only to synced comments, through the existing approval flow. Meta scopes now add pages_read_user_content, pages_manage_engagement and instagram_manage_comments (existing Meta connections must reconnect once).
- Tests: channel-operations.test.mjs 11/11, npm test 73/73, secrets scan passed. Live activation needs Meta app review and credentials (Prompt 14).
- Exact next action: S2 Instagram and Facebook image posting (add optional media_url to channel drafts with migration, https-only, Instagram container publish), then WhatsApp templates, TikTok publishing, website, Google.

### S2 (T-106): Instagram and Facebook image posting, 2026-11-13
- Post drafts take an optional public https image link (new nullable column media_url, additive migration; existing drafts unchanged). Links with credentials, ports, IP addresses or local hostnames are refused.
- Instagram: image required; container created, status checked up to 5 times, published once; errors and timeouts publish nothing. Facebook Page: photo post with caption, or text as before.
- Composer shows the image field only for accounts that support it (required for Instagram).
- Tests: channel-operations 13/13, channel UI 4/4 (390/768/1440), npm test 73/73, secrets scan passed. Live use needs Meta app review and credentials (Prompt 14).
- Exact next action: S3 WhatsApp Business: approved message templates (list from Meta, send a template outside the 24-hour window with approval), then TikTok publishing, website, Google.

### S3 (T-107): WhatsApp approved templates, 2026-11-13
- Lists the selected number's APPROVED UTILITY templates (body text, up to 10 numbered values). Templates with media headers, variable buttons or named values are listed as unavailable for now.
- Inbound WhatsApp conversations stay replyable after 24 hours, but only with a template; free text still needs the 24-hour window. Template drafts need approval, are re-checked as approved at send time, and are refused for opted-out numbers. Marketing templates are excluded (consent-based Campaigns later).
- New nullable column channel_drafts.template_json (additive). Composer shows a template picker for WhatsApp.
- Tests: channel-operations 15/15, channel UI 4/4, npm test 73/73, secrets scan passed.
- Exact next action: S4 TikTok video publishing (Content Posting API: direct post from a public video URL with privacy level from creator_info, approval required, status polling), then website, Google.

- DEPLOY PENDING (13:10 UTC): PRs #112 and #113 are merged (main 6c09513) but not yet deployed; the Render connector timed out. Deploy first on resume.

### S4 (T-108): TikTok video posting, 2026-11-13
- TikTok accounts can post a video from a public https link (TikTok fetches it; the link's domain must be verified with TikTok). Requires the video.publish permission, which TikTok grants only after app review (Prompt 14).
- The creator picks who can see the video; before sending, TikTok's creator_info is checked and only allowed options are accepted. Comment, duet and stitch settings follow the account. One post only: once TikTok accepts the video it is never sent again; status is checked up to 5 times.
- New GET /api/saas/channels/tiktok/creator-info; new nullable column channel_drafts.options_json (additive). Composer shows "Video link" and "Who can see this video" for TikTok.
- Fix: AI growth suggestions no longer offer text-only posts on channels that need an image or video (TikTok, Instagram); they offer a plan instead.
- Tests: channel-operations 16/16, channel UI 4/4, npm test 73/73, secrets scan passed.
- Still pending: Render deploy of PRs #112 and #113 (and this one); the Render connector was unavailable.
- Exact next action: deploy main to Render; then S5 website connection (lead forms and site analytics), then S6 Google (Business Profile, Search Console, Analytics).

### S5a (T-109): contact form on the business's own website, 2026-11-13
- New GET /api/saas/website/contact-form (senior roles): a ready-made HTML form for the verified website, with the bot trap and consent box. Connections > Website shows "Get ready-made form" and a copy button.
- /api/public/contact/:slug: only the verified https origin gets CORS and may be the return address (redirect back to that site); other foreign origins are refused with 403 (previously the global CORS check blocked every external site). Unverifying the site removes access.
- Tests: comms S5 tests pass, Connections UI PASS, npm test 73/73, secrets scan passed.
- DEPLOY STILL PENDING: Render connector returns 502; main not deployed since PR #111. Owner told how to deploy manually.
- Exact next action: S5b privacy-friendly site visit counts (no cookies, no IPs stored, verified origin only), then S6 Google.

### S5b (T-110): website visit counts, 2026-11-13
- New src/website-visits.js: POST /api/public/visit/:slug (always 204, counts only from the verified origin; skips bots, Do Not Track and Global Privacy Control; stores page path without query string and referring site host; daily totals only; 500 keys per business per day, overflow grouped; own rate limit 120 per 10 minutes).
- Owner routes: GET /api/saas/website/visit-script and /api/saas/website/visits?days=. Connections > Website: "Get visit counter" and "Show visit counts".
- New table website_visit_counts (cascade delete with the business). Reviewed and added to the route-guard public list.
- Tests: comms S5 tests 3/3, Connections UI PASS, npm test 73/73, secrets scan passed.
- DEPLOY STILL PENDING (Render connector 502).
- Exact next action: S6 Google: check the existing Business Profile, Search Console and Analytics adapters (src/channel-providers.js google_business, google_seo, src/server.js Phase 06) and close the gaps.

### S6 (T-111): Google Business Profile gaps, 2026-11-13
- Review found Google mostly complete already (Search Console queries, URL inspection, sitemaps; GA4 reports; Tag Manager; Business Profile reviews, review replies, posts, performance).
- Added: direction requests in Business Profile figures; monthly search terms that found the business (Business Profile Performance searchkeywords, previous three complete months, "fewer than N" kept as Google reports it), shown on Connections; Business Profile posts may include a public photo (1,500-character limit).
- Tests: seo-units and channel-operations pass (2 new), Connections UI PASS, npm test 73/73, secrets scan passed.
- Deployed: PRs #112-#116 live at 15:15 UTC (dep-dbrigiuc6qcc73e10g20, startup 16/16).
- Connections batch (owner order: social, WhatsApp, TikTok, website, Google) is complete in code. Live use needs provider app reviews and credentials (Prompt 14).
- Exact next action: owner to choose the next area. Default: resume Prompt 03 L8 (screen bodies in menu order, starting with Work > Enquiries).
