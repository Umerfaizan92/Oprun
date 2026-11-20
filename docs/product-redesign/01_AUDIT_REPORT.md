# 01 · Complete audit report

Audited: `main` at `4f60bcc` (PR #144, live on Render since 20 Nov 2026 04:52 UTC). Method: the code was read and
checked directly. File and line references are to that commit. "Verified" means it was seen in the code or in a
passing test, not assumed. Owner instructions in `CLAUDE.md` section 4 apply to every recommendation here. In
particular, every existing route, button, form, API endpoint and element ID keeps working, and the Operator
sign-in link `#signin-operator-link` stays.

## 1. Summary of what is wrong

| # | Finding | Evidence | Severity |
|---|---|---|---|
| A1 | **Sign-up only works for Australian businesses.** It needs an ABN/ACN, an Australian state, a 4-digit postcode and an Australian mobile. Nobody outside Australia can create an account. | `saas/create-account.html:7,15`; `src/server.js` `POST /api/saas/registration/start`: the zod schema has `state: z.enum(['ACT',…,'WA'])` and `postcode: /^\d{4}$/`, then `normalizeAuMobile` and `verifyAustralianBusinessIdentifier` | High (blocks growth) |
| A2 | **Worker onboarding is Australian-only.** It asks for visa holder status, visa subclass and expiry, and checks through VEVO. | `saas/worker-onboarding.html:25-27`; `src/workforce-compliance.js:4-8,149-168` | High (wrong for non-AU) |
| A3 | **Prices, currency and tax are hard-coded to Australia**: "A$49 / month + GST". All payment providers check `AUD`. | `saas/create-account.html:6`; `src/platform-pay.js`, `src/billing-setup.js` (`currency: 'AUD'`) | Medium |
| A4 | **The legal pages cite Australian law only** (Privacy Act 1988 / APPs, Australian Consumer Law). Nothing covers customers in other countries (for example GDPR/UK GDPR when serving EU/UK residents). | `saas/privacy.html`, `saas/terms.html` | Medium (must fix before opening to other countries) |
| A5 | **The navigation is built from three layers stacked on each other**: the original 6 groups, then the "B01–B09" inventory, then the current 8 groups. That gives 61 pages, and the old layers are only used as alias sources. | `saas/workspace-nav.js:10-44`, `:48-58`, `:66-75` | Medium (hard to maintain, causes duplicates) |
| A6 | **Duplicate or overlapping pages in the live menu** (detail in section 3): two inboxes plus an email folder, two phone-setup pages, three campaign areas, two invoice areas, two plan pages, two automation pages, and five "older" Website/SEO views. | `saas/workspace-nav.js:66-75` | High (confusing) |
| A7 | **The workspace loads 44 stylesheets and 66 scripts**, with 117 different width breakpoints across 54 CSS files. Device behaviour is inconsistent because rules override each other. | `saas/workspace.html`; `grep max-width/min-width saas/*.css` | High (cause of layout bugs) |
| A8 | **There is no single device/platform signal.** CSS guesses from width. The Android app (Trusted Web Activity) and the iOS app (WKWebView) do not tell the page they are apps, so the page cannot adapt to them. | `mobile/README.md`; no `data-platform` / app user-agent hook in `saas/*.js` | Medium |
| A9 | **Social publishing is partly manual.** Only Facebook Pages and X are published automatically. Instagram, LinkedIn, TikTok and Google Business Profile posts are marked "ready to post". | `src/growth.js:3-4`, `AUTO_PUBLISH` | Medium |
| A10 | **Customer SMS failures were silent.** Fixed in PR #144: the provider's reason now shows, there is a Try again button, and numbers are sent in +61 format. Remaining risk: a business's Telnyx number may not be able to send SMS (Australian landline numbers usually cannot). | `src/saas-platform.js` dispatch | Fixed in code; setup still depends on the owner |
| A11 | **Custom domains are built but switched off** until the Cloudflare for SaaS settings are added in Render. | `src/website/edge.js`, PR #144 | Waiting on owner |
| A12 | **The app stores are not published.** The Android TWA and iOS projects build, but publishing needs developer accounts, signing and real-device tests. | `mobile/RELEASE_STATUS.md`, `mobile/README.md` "Release gates" | Waiting on owner |

## 2. What works well and is kept as is

- The AI Receptionist, the Unified Inbox and the approval-first customer messaging (T-143, T-144). The approval
  gate is never bypassed.
- The work pipeline: Enquiry → Quote → Booking → Job → Invoice, with acceptance links, review requests,
  reminders, worker choice and invoice + payment link (T-145, T-164–T-166).
- The Website section (T-147): build, transfer, domain checks, business email, growth, and activity log.
- Security foundations: hashed one-time tokens, tenant isolation tests, rate limits, CSP on public pages, a staff
  access matrix (`src/staff-access.js`), the Founder/Operator separation, and secret scanning.
- The design tokens (`saas/ds/tokens.css`): one gold action colour, WCAG AA pairs in both themes. They become the
  base of the adaptive system in `05_ADAPTIVE_UI_SYSTEM.md`.

## 3. Page-by-page findings (current live menu)

Key: **Keep** = stays as is; **Merge → X** = its content moves into X, and its route becomes an alias of X (it
still opens, it just leaves the menu); **Fix** = needs work.

### Today
| Page (route) | Finding | Action |
|---|---|---|
| Command Centre `today/home` | Good starting point. Shows too many cards on mobile. | Keep. Mobile shows the 3 most urgent items and "See all". |
| AI Assistant `today/assistant` | Fine | Keep |
| Approvals `today/approvals` | The core safety gate | Keep. Pin it to the mobile tab bar. |
| Automations `today/automations` | Duplicates Setup → Automation `setup/automation` | Merge `setup/automation` → here |

### Work
| Page | Finding | Action |
|---|---|---|
| Enquiries, Quotes, Bookings, Jobs | One pipeline split over 4 pages; works | Keep, shown as one "Work" page with 4 stages (tabs on desktop/tablet, a stage switcher on mobile) |
| Stock & Supplies | Fine | Keep |
| Archived records | A secondary view | Keep as a filter inside Work, not a menu item |

### Customers
| Customer Directory | Fine | Keep |

### People
| Page | Finding | Action |
|---|---|---|
| Workers & Compliance | Australian checks are shown to every business | Fix: rules depend on the country (`02_COUNTRY_ONBOARDING.md`). Use sequential screens. |
| Staff Accounts & Roles, Hiring | Fine | Keep |
| Offshore Staff | Overlaps with Workers | Merge → Workers, as a "Location: offshore" filter |

### Communications (9 items, the most confusing group)
| Page | Finding | Action |
|---|---|---|
| Unified Inbox `communications/inbox` | The main inbox | Keep |
| Channel inbox (classic view) `communications/channels` | A duplicate inbox, still linked from the mobile action bar (owner screenshot, 20 Nov) | Merge → Unified Inbox; remove it from the mobile action bar |
| Email folder `communications/email` | A third inbox | Merge → Unified Inbox as the "Email" filter |
| Phone numbers setup + Calls & SMS setup | Two pages for one job | Merge both → one "Phone & SMS" setup screen |
| Call handling + AI Receptionist | Closely related | Keep the Receptionist; Call handling becomes its "Call rules" step |
| Meetings, Team chat | Fine | Keep |

### Growth (19 items)
| Page | Finding | Action |
|---|---|---|
| Growth Hub, Campaign Studio, Older campaign drafts | Three campaign areas | Merge into one **Campaigns** page; older drafts become a filter |
| Media studio `growth/media` | The content tool | Becomes the **Social Studio** (`04_ADVANCED_FEATURES.md`) |
| Consent | Belongs with customers/marketing permissions | Keep, under Customers → Marketing permissions |
| Website + 8 SEO tool pages + 4 "older" pages | The Website hub already exists (T-147); the old pages still show | Menu shows **Website** only; the tools become tabs inside it; "(older)" pages merge → Website and drop out of the menu |

### Money
| Page | Finding | Action |
|---|---|---|
| Ledger, Payments, Reconcile, Reports, Settings | Fine | Keep, as tabs of one Money page |
| Invoices & Quotes `money/invoices` | Quotes also live in Work | Keep invoices; quotes link to Work |
| Sales documents (older view) | Duplicate | Merge → Invoices |

### Setup
| Page | Finding | Action |
|---|---|---|
| Brand & Settings `setup/settings` (Business Setup) | A long single form | Fix: sequential screens (`03_PAGES_AND_DEVICES.md` §4) |
| Connections | Fine | Keep |
| Plans, Billing & Add-ons + Change plan `setup/change-plan` | Duplicate | Merge Change plan → Plans as one step |
| Automation `setup/automation` | Duplicate of Today → Automations | Merge |
| Trust, Help, Manual, Import, Export, Support access | Fine | Keep; Help and Manual combine under "Help" |

**Result:** the menu drops from **61 pages in 8 groups** to **28 pages in 8 groups** (7 work groups plus Setup). All 61 routes still resolve
(aliases), so no bookmark, link, test or element ID breaks.

### Public and account pages (`saas/*.html`, 21 files)
| Page | Finding | Action |
|---|---|---|
| `create-account.html` | Australian-only; plan prices hard-coded | Fix: country first (doc 02); prices come from the server per country |
| `sign-in.html` | Must keep `#signin-operator-link`; must not show Install | Keep (rule in CLAUDE.md) |
| `worker-onboarding.html` | Australian visa fields for everyone | Fix (doc 02 §4) |
| `terms.html`, `privacy.html` | Australia-only law | Fix (doc 06) |
| `apply.html`, `join-team.html` | Both are for joining a team | Check during Phase 2; keep both routes |
| `offline.html`, `pay.html`, `payment-thanks.html`, `verify-account.html`, `recover-account.html` | Fine | Keep; apply the new adaptive system |

## 4. Function check (non-working items found)

| Function | State | Action |
|---|---|---|
| Sending an approved customer SMS | Failed silently (fixed in PR #144) | Done in code. The owner must confirm the Telnyx number can send SMS. |
| Custom domains for websites | Switched off | Owner adds the Cloudflare settings (doc 04 §1) |
| Auto-publish to Instagram, LinkedIn, TikTok, Google Business Profile | Not built | Doc 04 §2 |
| Sign-up outside Australia | Not possible | Doc 02 |
| Native app adaptation | No signal | Doc 05 §2 |

Items not checked in this audit (they need the live environment or the owner): provider dashboards (Telnyx, Meta,
Google), Render environment values, real-device app runs, and the production database.
