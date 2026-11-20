# 07 · Final implementation plan

Each phase is one or more small PRs to `main`, tested with `npm test` (73 checks), `npm run test:ui` and the new
checks listed, then auto-deployed on Render. Nothing in a phase removes a route, element ID or API endpoint.

## Phase 1 — Country-based sign-up and workers (push first)
Why first: it is self-contained, it opens Oprun to every country, and Australian sign-up stays identical.
- `src/country-profile.js` + `/saas/country-profile.js` (doc 02 §1).
- Additive DB columns (doc 02 §2).
- `registration/start`: country branch; voice-code resend; abuse controls.
- `create-account.html`: Screen 1 country + sequential steps.
- Worker documents pack and `worker-onboarding.html` steps.
- Invoice/tax labels from the profile.
- **Done when:** all eight tests in doc 02 §6 pass; the existing AU registration tests pass unchanged; a GB test
  account can be created on the live site with real email + SMS codes (owner test).

## Phase 2 — Navigation clean-up (61 → 28 menu pages)
- One nav table + alias map. Merged pages become aliases (doc 01 §3, doc 03 §1).
- The mobile action bar no longer links to "Channel inbox (classic view)".
- **Done when:** every route in `docs/redesign/BASELINE_ROUTES.json` and every old alias still opens the right
  view (automated); the UI test page count is updated to the new menu; no "(older)" label is visible in the menu.

## Phase 3 — Adaptive foundation
- `saas/ds/platform.js` and `saas/ds/layout.css`; CSS cascade layers; the breakpoint lint (doc 05 §8).
- Android `trusted.DEFAULT_URL` with `?shell=android-app`; iOS `applicationNameForUserAgent`.
- Bottom tab bar on phone and app shells; sidebar and rail on desktop and tablet.
- axe-core + Lighthouse CI + visual snapshots for the five device classes.
- **Done when:** doc 05 §9 passes on Today, Work, Inbox, Website and Setup.

## Phase 4 — Sequential screens: Business setup and Workers
- Business setup in 7 saved steps (doc 03 §4); Worker record and invite steps (doc 03 §5).
- **Done when:** a new owner can complete setup on a phone without scrolling sideways, and progress survives an
  app restart (test).

## Phase 5 — Page redesigns
- Home, Work pipeline, Inbox, Money, Plans & billing, public and account pages (doc 03 §2–§10).
- Remove each legacy stylesheet once its pages are moved; target ≤ 6 stylesheets on the workspace.
- **Done when:** doc 05 §9 passes on every page in the final menu.

## Phase 6 — Social Studio and Campaigns
- Brand kit, Plan → Create → Approve → Publish → Learn (doc 04 §2); Campaigns (doc 04 §3).
- Channel auto-publishing switches on one channel at a time, as each provider approval arrives.
- **Done when:** an approved post publishes to each approved channel in a test account; a campaign excludes
  opted-out customers (automated test).

## Phase 7 — Website extras
- Redesign with rollback; cinematic hero (play once); optional Spaceship purchase with approval; transfer
  checklist; global listings.
- Custom domains go live as soon as the owner adds the Cloudflare settings.

## Phase 8 — Legal, billing and app store release
- Updated Terms, Privacy, DPA, accessibility statement after adviser review (doc 06).
- Server-driven prices; tax wording per country.
- Signed Android and iOS builds, real-device tests (`mobile/README.md` release gates), store listings.

## What the owner needs to provide

| Item | Needed for | Phase |
|---|---|---|
| Decide: bill everyone in AUD (recommended) or local currencies | Pricing display | 1 |
| Decide: outbound customer messages blocked until a payment method is added (recommended for non-AU) | Abuse control | 1 |
| Telnyx Verify: switch on the countries you will accept (Telnyx portal → Verify → Geo permissions) | International codes | 1 |
| A Telnyx number that can send SMS (Australian mobile +61 4…) on a Messaging Profile | Customer SMS | now |
| Cloudflare SaaS settings in Render (4 values) | Custom domains | 7 |
| Meta / LinkedIn / TikTok / Google Business Profile app approvals | Social auto-publishing | 6 |
| Lawyer and accountant review of doc 06 | Launch outside Australia | 8 |
| Google Play and Apple developer accounts and signing | App stores | 8 |
| `OPERATOR_TOTP_SECRET` in Render | Founder security | now |

## Success criteria (whole programme)
1. Anyone in any country can sign up with a verified email and phone; Australia's checks are unchanged.
2. The menu has 28 clear pages in 8 groups; no duplicates; every old link still works.
3. Every page passes the five-device acceptance in doc 05 §9.
4. Business setup and worker onboarding are sequential and saved step by step.
5. Website, Social Studio and Campaigns work end to end with approval before anything goes public.
6. `npm test` and the UI, accessibility and visual checks pass on every PR; nothing is deployed with a failing check.
