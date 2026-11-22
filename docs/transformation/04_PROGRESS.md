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
  page shots shows no change above 0.1%

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
TR-11 component catalogue (one reference page of every shared component, both themes), then TR-13 brand assets
(remove unused superpro-* files, check icons everywhere), then TR-14 public website.
