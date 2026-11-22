# 04 · Progress (single checkpoint for this wave)

Updated: 23 Nov 2026

- Branch: `claude/transformation-phase1` (not merged; nothing deployed)
- Production: `srv-dbuq98ojo6nc73aro66g`, live commit `6cbbe20` (T-202), verified 23 Nov 2026

## Completed
- [x] Phase 1 read-only audit → [01](01_PHASE1_AUDIT.md)
- [x] Backlog → [02](02_BACKLOG.md)
- [x] Visual blueprint draft → [03](03_VISUAL_BLUEPRINT.md)

- [x] TR-01 owner approvals (D-055): full plan approved; palette to be chosen from samples; free test site; Claude in
  Chrome allowed for live oprun.ai screenshots
- [x] TR-02 register tidy: T-194 closed (superseded by T-202); T-141/T-142 wait for the owner's live call test
- [x] Palette samples sent (gold vs purple/cyan on home, Command Centre, Media Studio, sign-in; laptop and phone)

- [x] TR-10/TR-12 (T-204): gold scale `--sp-gold-100…800`; 533 hard-coded golds replaced; screenshot diff on 105
  page shots shows no change above 0.1%. Correction (22 Nov): the light-theme workspace shots in that run were
  signed-out screens (the server's per-account request limit returned HTTP 429 after ~39 fast page loads), so the
  light-theme part was not verified then. Re-checked under T-206 with signed-in light pages: no gold change found.

- [x] TR-11 (T-205): design-system catalogue `saas/design-system.html` (test site: /saas/design-system.html); shared
  styles for link/danger buttons, badge and table; two unstyled live buttons fixed

- [x] TR-20 (T-206): one button standard: primary, secondary, portal and danger buttons are 44px high with 16px side
  padding in dark and light (before: 44/40/42px). Screenshot diff, 105 shots (signed in, dark 1440/390, light
  1440): 6 pages above 0.5%, all from taller buttons moving content down a few pixels

- [x] TR-13 (T-207): brand check. Favicon, install icons (192/512/SVG), Android and iOS app icons all show the Oprun
  mark; platform emails draw the mark in HTML on purpose (T-189). Fixed: 21 app pages now declare the Oprun tab and
  phone home-screen icons; the workspace links the install manifest; outbound website checks now say "Oprun"
  instead of "SuperPro". Browser check: icon links load on all 25 pages; new test scripts/brand-assets.test.mjs

## Pending (in order)
- [x] Palette decided (D-056): keep the gold identity; purple/cyan rejected after side-by-side samples
- [x] TR-03 test site: new free Render service **oprun-test** (`srv-dc1keajl550s73eolqk0`,
  https://oprun-test.onrender.com), branch `claude/transformation-staging`, auto-deploy, build `npm ci --include=dev`
  (~1 build minute; tests run before each push), isolated preview mode (`SUPERPRO_ISOLATED_PREVIEW=1`: temporary
  synthetic data under /tmp, registration/webhooks/customer intake blocked, refuses to start with any storage or
  provider key). Test logins: `owner.alpha@preview.invalid`, `employee.alpha@preview.invalid`,
  `owner.beta@preview.invalid`; password = the `PREVIEW_BUSINESS_PASSWORD` value in Render → oprun-test →
  Environment (never written to the repository). Live 22 Nov 19:49 UTC on commit `675c13d` (Render logs).
- [ ] Phase 3: TR-10 tokens v2 → TR-11 components → TR-12 CSS consolidation → TR-13 brand assets → TR-14 public
  website → TR-15 sign-in pages

## Tests and evidence
- Audit only: no code changed. Evidence: Render service list and deploy history, GitHub PR list, repository
  measurements in [01](01_PHASE1_AUDIT.md).

## Known failures / blockers
- Reference screenshot not received (no longer blocking: gold kept).
- Live oprun.ai screenshots not possible from this workspace (network); needs Claude in Chrome or domain access.
- 4 production security warnings need Render settings from the owner.

## Exact next action
TR-14 public website v2, then TR-15 sign-in pages.
