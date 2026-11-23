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

- [x] TR-14 (T-208): public website v2. The Phase 03 site was already rebuilt (no rewrite). Added /integrations
  (14 connections, each traced to code) and /security (7 built controls, links to the Trust centre); plan prices now
  follow /api/saas/plans; footer links; a11y/perf report now runs with the installed Chrome. Report: 0 serious
  accessibility issues on all 12 public pages, all within mobile Web Vitals budgets (lab, not Lighthouse scores).
  Known, outside TR-14: workspace label-content-name-mismatch (serious, 1–8 per page) for TR-20+ work

- [x] TR-15 (T-209): sign-in pages were already on the new system; fixed what the live check found. Side-by-side
  fields on create account now line up; the registration introduction stays in view while the long form scrolls
  (body overflow-x hidden was blocking it; now clip); footer links no longer sit under the Help & complaints button on
  phones (create account, verify, recover); jargon labels reworded (Email OTP → Email code, Tenant isolation → Your data
  kept separate, MFA → Two-step sign-in). Sign-in still fits one phone screen; #signin-operator-link visible; no
  Install option. Note: the a11y report flags one contrast item on sign-in only when it forces light theme, which the
  sign-in pages do not offer (dark-only); already present before this change

- [x] T-210: workspace screen-reader names now contain the visible label (WCAG 2.5.3): business menu button, Home
  tiles, Office chat, Ask Oprun, phone keypad keys, media upload area. axe scan of all 31 workspace sections at 1440
  and 390: 17 → 0 mismatches; screenshot diff shows no visual change (only clock text)

- [x] TR-21 (T-211): the 31 secondary pages are now tabs of 14 main pages (e.g. Money › Profit & Payments ›
  Bank Reconciliation, Reports & GST; Inbox › Email folder, Channel inbox; Website › 13 SEO/site tools). Wider
  screens: a second tab row under the main row; phones: nested under the main page in the menu. The "More … tools"
  lists and the Command Centre "More in …" lists are gone (merged pages still appear when searched). Labels no
  longer say older/classic (English, Hindi, Urdu, Arabic). Routes, aliases, grants, element IDs and data unchanged.
  Browser check: all 31 at 1440 and 390 pass; screenshot diff changes only the 14 main pages at laptop width.
  Fixed two stale test inputs found on the way (Media Studio sections after T-202; redesign UI test now uses
  UI_CHROMIUM_PATH). Follow-ups for owner decision: possible duplicates to retire after a data check (Channel inbox
  vs Unified Inbox, Sales documents vs Invoices & Quotes, Campaign drafts vs Campaign Studio, Website & domain and
  Search readiness vs Website; Profit & Payments has its own Reports tab beside Reports & GST)

- [x] T-212: test site fixed and test sign-up added. The owner had uploaded the production .env to oprun-test to make
  ABN checks work; the safety check then refused to start. The check now names blocked settings (names only); the
  22 production keys (AI, email, SMS, social tokens, disk requirement) were blanked on oprun-test only and its own
  test settings restored. PREVIEW_ALLOW_SIGNUP=1: accounts can be created there with on-screen email/SMS codes; ABN
  is checked against the official register when ABR_GUID is set. Live on oprun-test 23 Nov 02:50 UTC (6465914),
  which also carries TR-21

- [x] TR-22 (T-213): Command Centre already had compact live tiles and tabbed sections on laptop. Phones now show the
  five figures as one summary card with a tappable row each (first screen: figures card + request box = 2 cards,
  was 5 + 1). Action Centre "Start with the work that matters" shortcuts now appear only while there is work there
  (e.g. "2 conversations need a reply"); nothing permanent when queues are clear

- [x] TR-23 part 1 (T-215): audit of all 31 main pages (contact sheets at 1440 and 390, measured widths, headings)
  found the same width (1168px), cards, tabs and buttons everywhere. The one inconsistency: 17 pages opened with a
  small-caps label and a slogan ("Profit on every job, without the spreadsheet", "Simple plans. Start with 14 days
  free."). Every page now has its own name as the title, matching the top bar; access notes (Owner only, Owner &
  admin only) kept. Remaining TR-23 work: per-module checks of forms and empty states with real data

- [x] TR-23 part 2 (T-216, T-217): modules reviewed with a sample plumbing business built through the API
  (scripts/visual/sample-data.mjs: 6 enquiries at every pipeline stage, 3 workers, stock, overheads). Fixed:
  booking card, calendar and Jobs showed the same booking at different times (now the business time zone,
  one format); the profit trend charged overheads to months before they existed; Workforce defaulted to
  "Active" so newly added workers were hidden (now "Current team"); Stock figures ran into their labels (now
  tiles); "-$0.00" for empty costs. Test site now warns that its data is erased on restart

- [x] TR-23 part 3 (T-218): with sample data, Approvals and the Home tile said nothing was waiting while a quote
  awaited approval (quotes and invoices are approved on their own pages and were not counted). They are now listed
  on Approvals ("Documents waiting for approval", link to approve) and counted on Home ("1 item waiting for your
  decision", 4 languages). Customers with a booked or completed job now show Current instead of Future (a status set
  by hand is kept). Reviewed with data and fine: Enquiries, Quotes, Bookings, Jobs, Invoices, Customer detail,
  Inbox, Campaigns, Website, Settings, Payments, Receptionist (no script errors on any page)

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
TR-24 modules by industry, plan and permission. Hold pushes to claude/transformation-staging while the owner
is testing (each deploy wipes the test site); push to claude/transformation-phase1 only until he says done.
