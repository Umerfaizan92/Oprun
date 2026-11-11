# Oprun navigation and branding release acceptance

Source release: `10c79e5478167e90bf62855012c4647bf5673159` (PR #78), tree `457e4a4e216bcfd4c4b996cba689186d248a4d86`.

The exact requested T-083 main commit is `3a2efa5e7c2281a543a0b08b5f0f681694026f39`: “Tighten secondary navigation and reduce density for legacy and SEO sub-pages”. All 22 existing secondary flags remain in place, More starts closed and stays under user control, and Today retains its live metrics and actions.

T-084 adds prominent Oprun branding, larger logos, shorter workspace header titles and one subscriber identity in the sidebar. The original business selector, role/designation and restricted Founder shortcut remain. Business navigation opens by click and dismisses on close, outside click, Escape or permitted page selection. Founder desktop collapse remains independent. Legacy section query strings survive alias canonicalisation only when they resolve to the same authorised page.

## Verified source evidence

- [CI 43118785983](https://github.com/Umerfaizan92/Oprun/actions/runs/43118785983): both jobs passed on candidate `68aa0146f1c3b7f34f73f3e48ecc181daaab4e51`.
- [Security 43118785978](https://github.com/Umerfaizan92/Oprun/actions/runs/43118785978): passed.
- Full build: 73/73 checks, including 56 contract test files; responsive interface: 34 checks; integration/runtime smoke checks passed; dependency scan: zero vulnerabilities.
- Navigation coverage: 584 checks, zero runtime errors, zero missing sections. Business/Founder roles, drawer focus/background inertness, More disclosures, section deep links/history/reload and unsaved-save protection tested.
- Phone/tablet/desktop at 390/768/1440px, dark/light accessibility, overflow, Today and drawer screenshots reviewed. Visual evidence artifact ID `13900720448`, digest `sha256:c7eb79dc65f3b3c35320ae181230390ea702fcc6be3fe744c25d02fdf60b3dd8` (GitHub artifact retention 14 days; scripts reproduce it).
- Preservation audit: 645 HTTP routes, 45 HTML pages, 60 business views, 34 Founder sections, 780 static IDs, and all existing forms retained. Server, stores, tenant isolation, role filtering and approval policies unchanged.
- Merge tree verified identical to the tested candidate. One manual deployment requested for existing Render service `srv-dan4rdqjnfac73fceor0`; automatic deployment remains off.

## Live acceptance

Deploy `dep-dbqfk3tg1s2s73e6n9tg` became **live** at 2026-11-11 23:32:37 UTC (12 November 2026, 07:32:37 Perth). Deployed commit matches `10c79e5478167e90bf62855012c4647bf5673159`.

- All six `deploy:check` checks passed: health, database/queue readiness, security headers, Business 401, Founder 401, sign-in/public loading.
- Eight runtime assets match tested source byte for byte; SHA256 values saved in `qa/reports/branding-live-acceptance.json`.
- Public home branding and Business sign-in verified in a live browser. Operator sign-in is visible; no Install option on Business sign-in.
- Storage endpoint reports `persistent_storage_detected=true`. The acceptance helper initially checked a nonexistent `persistent` key; corrected to the repository's actual response field and verified successfully, without changing application code.
- Render error-level logs from live time through 23:34 UTC returned no entries.
- Authenticated business/Founder interaction was verified in isolated CI, not using production subscriber credentials. Live public/security checks were read-only.

Runtime changes are on main and live. This final evidence branch only updates documentation, reports and continuation memory; it does not need a second deployment.

Tests use isolated synthetic fixtures; no real messages, campaigns, provider actions or payments were sent by this audit. Live checks are read-only. Existing provider credentials/approvals and native store publication are outside this presentation update.
