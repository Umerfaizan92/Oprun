# 03 · Page-by-page redesign and device plan

Rules for every page:
- **One primary action per screen**, in gold. Everything else is a secondary (outline) button or a link.
- **Sequential screens on phones**: a task with several parts is a series of short screens (step 1 of 4, with a
  Back and a Continue button). Tablets and desktops show the same steps as a stepper beside the form.
- **The same content on every device.** Layout changes; features never disappear because of screen size.
- **No looping animation.** Motion plays once, and is turned off by `prefers-reduced-motion`.
- Device classes and shells are defined in `05_ADAPTIVE_UI_SYSTEM.md` §2.

## 1. Navigation (final: 8 groups including Setup, 30 main pages; built in T-171)

As built: group names and page labels were kept (they are translated into Hindi, Urdu and Arabic and used by tests). Duplicates and specialist tools moved into each group's "More" list instead of being removed, and Consent moved to Customers. Main menu: Today 4, Work 5, Customers 2, People 3, Communications 4, Growth 3 (Website, Media Studio, Campaign Studio), Money 4, Setup 5. Notifications now open the Unified Inbox, not the classic channel view.

| Group | Pages (route) |
|---|---|
| **Today** | Home `today/home` · AI Assistant `today/assistant` · Approvals `today/approvals` · Automations `today/automations` |
| **Work** | Work pipeline `work/enquiries` (stages: Enquiries, Quotes, Bookings, Jobs; archived = filter) · Stock `work/stock` |
| **Customers** | Directory `customers/directory` · Marketing permissions (was `growth/consent`) |
| **People** | Workers & documents `people/workers` (offshore = filter) · Staff & roles `people/staff` · Hiring `people/hiring` |
| **Messages** | Inbox `communications/inbox` (filters: All, SMS, Email, Calls, WhatsApp, Social) · AI Receptionist `communications/receptionist` (Call rules step) · Phone & SMS setup `communications/numbers` · Meetings · Team chat |
| **Grow** | Website `website/home` (tabs: Overview, Pages, Domain, Email, Search & AI, Growth, Activity) · Social Studio `growth/media` · Campaigns `growth/campaigns` |
| **Money** | Money `money/ledger` (tabs: Ledger, Invoices, Payments, Reconcile, Reports, Settings) |
| **Setup** (utility, bottom of the menu) | Business setup `setup/settings` · Connections · Plans & billing · Trust & security · Import · Export · Support access · Help |

All removed menu entries stay as route aliases in `saas/workspace-nav.js` (doc 01 §3). The three stacked nav
layers are replaced by one table: `{view, path, label, group, roles, aliases[]}`, plus a generated alias map. The
nav test keeps every old path resolving.

**By device:**
- Desktop: left sidebar with the 8 groups expanded, and a search box (Ctrl/⌘K) at the top.
- Tablet: collapsible icon rail; tap a group to open its pages in a flyout.
- Phone browser and both apps: bottom tab bar with **Today, Work, Messages, Approvals, More**. "More" opens a
  full-screen list of the remaining groups. The mobile action bar never links to a merged page (it currently
  shows "Channel inbox (classic view)").

## 2. Today → Home
- Desktop: 3 columns — "Needs you now" (approvals, failed messages, urgent enquiries) · "Today's work" (bookings,
  jobs, reminders) · "Business pulse" (cash in, new leads, reviews).
- Tablet: 2 columns; Pulse moves under Today's work.
- Phone: one column, top 3 items per card, "See all" opens the full list. A sticky primary action shows the most
  urgent approval.

## 3. Work pipeline
- One page, four stages, with a count on each stage.
- Desktop: board (columns) or table toggle; selecting a record opens a right-side panel (no page change).
- Tablet: table with the panel as an overlay sheet.
- Phone: list → tap → full-screen record → actions in a sticky footer (Quote, Send, Book, Allocate, Invoice).
  Stage switcher as a segmented control at the top.

## 4. Setup → Business setup (sequential)
Today this is one long form (`setup/settings`). New order, one screen each:
1. **Business details**: name, country (read-only after sign-up; changing it needs support), contact details, address.
2. **Brand**: logo, colours (with an AA contrast check), voice.
3. **Services & prices**: services, typical durations, price ranges (used by quotes and the receptionist).
4. **Hours & service area**.
5. **Invoices & tax**: from the country profile (ABN/GST for AU; optional tax number and label elsewhere).
6. **Customer messages**: SMS sender, email sender (links to Connections if not set up), reminder settings.
7. **Review**: a summary with an "Edit" link on each section.

Progress is saved after each screen (no data lost if the app closes). The overview shows each section as done or
to-do, and the owner can jump to any section.

## 5. People → Workers & documents (sequential)
- List of workers with a compliance status: OK, expiring in 30 days, missing, expired.
- Worker record screens: 1 Details → 2 Work rights (AU pack only) → 3 Documents → 4 Access (which features they
  can use) → 5 History.
- **Invite worker** flow: name + mobile/email → choose a role → send. The worker completes their own steps on
  the worker link (doc 02 §4).

## 6. Messages → Inbox
- Desktop: three panes — list · conversation · customer & AI summary.
- Tablet: two panes; the customer panel opens as a sheet.
- Phone: list → conversation (full screen). Drafts awaiting approval show **Approve & send** as the single
  primary button. A failed message shows the reason and **Try again** (built in PR #144).

## 7. Grow → Website, Social Studio, Campaigns
See `04_ADVANCED_FEATURES.md`. The layout follows the same pattern: hub overview → one task per screen on phone,
side-by-side editor and preview on desktop.

## 8. Money
- Tabs on desktop/tablet, a section switcher on phone.
- Creating an invoice is sequential on phone: customer → items → tax/terms → preview → **Send invoice & payment
  link** (approval rules unchanged).

## 9. Setup → Plans & billing
One page: current plan, usage, add-ons, invoices from Oprun, payment method. **Change plan** opens a step on
the same page (it replaces the separate `setup/change-plan` page, which stays as an alias).

## 10. Public and account pages
- `create-account.html`: the steps in doc 02 §3, one per screen on phone; on desktop a two-column layout with
  the step list on the left.
- `sign-in.html`: email/phone + password → MFA → workspace. `#signin-operator-link` stays visible and in place.
  No Install option.
- `worker-onboarding.html`: 3 steps (doc 02 §4).
- `pay.html`, `verify-account.html`, `recover-account.html`, `offline.html`: one card, one primary button, the
  same on all devices.
- Legal pages: readable single column, max 72 characters per line, a table of contents on desktop.

## 11. Element and route preservation
Every element ID referenced by tests (`scripts/test-ui.mjs`, `scripts/*-ui.mjs`) and every route in
`docs/redesign/BASELINE_ROUTES.json` is kept. New wrappers are added around existing elements; IDs are not renamed.
