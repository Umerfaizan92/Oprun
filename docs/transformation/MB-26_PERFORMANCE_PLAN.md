# MB-26: workspace speed, measured and planned

Measured 26 November 2026 (`npm run report:lighthouse`, Lighthouse 12 mobile, local test server, synthetic data;
full table in `qa/reports/LIGHTHOUSE.md`).

| Area | Performance | LCP | TBT |
|---|---|---|---|
| Public pages (7) | 97–100 | 1.5–2.1 s | 0–53 ms |
| Operator Console | 100 | 0.9 s | 10 ms |
| Workspace pages (5, returning visit) | 77–84 (target 85) | 3.8–4.1 s | 180–435 ms |

## Why the workspace is slower (from the full Lighthouse reports, `LH_DUMP=<dir>`)

1. **Styles:** one bundled stylesheet of 92 KB compressed (about 650 KB written across ~50 files). Lighthouse marks
   70 KB of it unused on the Command Centre and counts it as render-blocking (~770 ms).
2. **Page size:** every workspace page is in one HTML document: about 4,100 elements. Style and layout take ~0.9 s of
   main-thread time on a mid-range phone.
3. **Start-up scripts:** two deferred bundles (79 KB and 174 KB, 34 files) run on every page, including modules for
   pages that are not open (billing, plan, legal, receipt, chat, interview, setup). ~0.6 s of script time.
4. `ds/platform.js` must run before the first paint (device detection); as a separate file it costs one round trip
   (~320 ms on slow 4G). The content security policy forbids inline scripts, so it cannot simply be inlined.

## Plan, smallest risk first

1. Load the page-specific scripts of point 3 on first open of their page, the same way the lazy groups already work
   (`type="oprun/lazy"`). Expected: TBT −150 to −250 ms. Risk: low; each page keeps its own tests.
2. Split the stylesheet: shell + Command Centre styles stay blocking; styles of pages that load lazily move into their
   lazy group. Expected: LCP −0.5 s. Risk: medium; needs the full visual regression run (348 screens) to stay clean.
3. Allow `ds/platform.js` inline through a CSP hash of that exact file (inline injection stays blocked). Expected:
   LCP −0.3 s. Needs a security review line in DECISIONS.md.
4. Longer term: render a page's markup when it is first opened instead of keeping every page in the document.

Each step is measured with the same report before release; the target is 85+ on all five workspace pages.
