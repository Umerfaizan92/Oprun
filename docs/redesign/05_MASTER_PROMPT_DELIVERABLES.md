# Oprun — Master Senior Prompt deliverables (merged with the Final Redesign Audit pack)

Sources (12 Nov 2026): `Oprun_Master_Senior_Prompts_with_Continuation_2026-11-12.pdf` and
`Oprun_Final_Redesign_Audit_Prompts_2026-11-12.pdf`. The Final Redesign pack was implemented in PR #75 (docs 01–04 in
this folder, live on Render at `1cbe8e1`). This document adds what the Master prompt requires on top of it, and is
generated from, and checked against, `saas/workspace-nav.js` (the single navigation source of truth).

## Merge decisions

| Topic | Final Redesign pack (PR #75) | Master prompt | Implemented |
|---|---|---|---|
| Group count | 6–7 groups | "max 7" but lists 8 incl. Setup | 7 daily groups + **Setup** rendered as a separated utility group (both constraints met) |
| Group names | Today, Customers & Work, People, Communications, Growth, Money, Setup & Trust | Today, Work, Customers, People, Communications, Growth, Money, Setup | Master names |
| Numbering | `B01 · TODAY` kickers, `#b01/...` routes | Remove all B01/B02 numbering | Removed from labels, page titles, breadcrumbs, finder, links; `#b0x/...` kept only as silent legacy aliases |
| Removals | Fold, never delete stores/forms | "Remove or fold" | Folded (More menu + tab strip); every route, form, API and element ID still works (owner standing rule) |

## Deliverable 1 — Final navigation configuration

| # | Group | Primary pages (clean hash route) | Folded under "More" |
|---|---|---|---|
| 1 | Today | Command Centre `#today/home`, AI Assistant, Approvals, AI Automations | — |
| 2 | Work | Enquiries `#work/enquiries`, Quotes, Bookings, Jobs, Stock & Supplies | Archived records |
| 3 | Customers | Customer Directory `#customers/directory` | — |
| 4 | People | Workers & Compliance, Staff Accounts & Roles, Hiring, Offshore Staff | — |
| 5 | Communications | **Unified Inbox** `#communications/inbox`, Call Handling, AI Receptionist, Video Meetings, Team Chat | Email folder, Channel inbox (classic), Phone numbers setup, Calls & SMS setup |
| 6 | Growth | **Growth Hub** `#growth/hub`, Campaign Studio, Media Studio, Consent & Unsubscribes, **SEO Command Centre** `#growth/seo`, Website Builder | SEO tabs (Audit, Keywords, Google, Content, Local, Analytics, Reports), older drafts, search readiness, search connection, backlinks, website & domain request |
| 7 | Money | Profit & Payments, Invoices & Quotes, Payments & Refunds, Bank Reconciliation, Reports & GST, Finance Settings | Sales documents (older view) |
| 8 | Setup (utility) | Brand & Settings, Connections, Plans/Billing & Add-ons, Trust & Security, Automation Settings, Help, User Manual | Import, Export, Support Access, Change Plan |

Legacy aliases: every `#b01/…`–`#b09/…` hash, bare `#b02` group ids, the older `#customers/…`, `#marketing/…`,
`#operations/…`, `#governance/…` paths and single-word hashes (`#finance`, `#seo`) resolve to the same view. Bare new
group ids (`#work`, `#communications`, `#growth`) open the first page the role may see. Server-generated links
(automation outputs, notifications, OAuth redirects, search results) now emit clean routes; stored old links still work,
and the SEO alerts query accepts both `#b06/%` and `#growth/seo%`.

Tab strips (contextual workflow links above each page): Work pipeline · Unified Inbox · Communications setup · Growth Hub ·
SEO Command Centre (Overview, Audit, Keywords, Google, Content, Builder, Local, Analytics, Reports) · Documents &
payments · Connections & setup · Plans · People.

## Deliverable 2 — Page-by-page mapping (all 60 business views)

| Old inventory ID / route | View | New location | Shown as |
|---|---|---|---|
| b01/home (also operations/command, today) | `dashboard` | Today › Command Centre — `#today/home` | Primary |
| b01/assistant (also operations/receptionist) | `assistant` | Today › AI Assistant — `#today/assistant` | Primary |
| b01/approvals (also governance/approvals) | `approvals` | Today › Approvals — `#today/approvals` | Primary |
| b01/automations (also ) | `automations` | Today › AI Automations — `#today/automations` | Primary |
| b02/enquiries (also work) | `enquiries` | Work › Enquiries — `#work/enquiries` | Primary |
| b02/quotes (also ) | `quotes` | Work › Quotes — `#work/quotes` | Primary |
| b02/bookings (also ) | `bookings` | Work › Bookings — `#work/bookings` | Primary |
| b02/jobs (also customers/jobs, operations/dispatch) | `jobs` | Work › Jobs & Dispatch — `#work/jobs` | Primary |
| b02/stock (also customers/stock, stock) | `stock` | Work › Stock & Supplies — `#work/stock` | Primary |
| b02/archive (also ) | `archive` | Work › Archived records — `#work/archive` | Folded: under More / tab strip |
| b02/customers (also customers/list, customers) | `customers` | Customers › Customer Directory — `#customers/directory` | Primary |
| b03/workers (also workforce/compliance, people) | `workforce` | People › Workers & Compliance — `#people/workers` | Primary |
| b03/staff (also workforce/staff) | `team` | People › Staff Accounts & Roles — `#people/staff` | Primary |
| b03/hiring (also hiring) | `hiring` | People › Hiring — `#people/hiring` | Primary |
| b03/offshore (also ) | `offshore` | People › Offshore Staff — `#people/offshore` | Primary |
| b04/unified (also communications) | `unifiedinbox` | Communications › Unified Inbox — `#communications/inbox` | Primary |
| b04/voice (also ) | `voiceflow` | Communications › Call Handling — `#communications/call-handling` | Primary |
| b04/receptionist (also ) | `receptionist` | Communications › AI Receptionist — `#communications/receptionist` | Primary |
| b04/meetings (also ) | `meetings` | Communications › Video Meetings — `#communications/meetings` | Primary |
| b04/team-chat (also ) | `teamchat` | Communications › Team Chat — `#communications/team-chat` | Primary |
| b04/email (also ) | `mail` | Communications › Email folder — `#communications/email` | Folded: under More / tab strip |
| b04/inbox (also customers/inbox, operations/inbox) | `comms` | Communications › Channel inbox (classic view) — `#communications/channels` | Folded: under More / tab strip |
| b04/numbers (also ) | `phone` | Communications › Phone numbers setup — `#communications/numbers` | Folded: under More / tab strip |
| b04/calls (also ) | `calls` | Communications › Calls & SMS setup — `#communications/calls-sms` | Folded: under More / tab strip |
| b05/growth (also marketing/growth, growth) | `growth` | Growth › Growth Hub — `#growth/hub` | Primary |
| b05/campaign-studio (also ) | `campaignstudio` | Growth › Campaign Studio — `#growth/campaigns` | Primary |
| b05/studio (also marketing/studio, workforce/growth, marketing) | `video` | Growth › Media Studio — `#growth/media` | Primary |
| b05/consent (also ) | `consent` | Growth › Consent & Unsubscribes — `#growth/consent` | Primary |
| b06/seo (also ) | `seocentre` | Growth › SEO Command Centre — `#growth/seo` | Primary |
| b06/builder (also ) | `seobuilder` | Growth › Website Builder — `#growth/website-builder` | Primary |
| b06/audit (also ) | `seoaudit` | Growth › SEO · Audit — `#growth/seo-audit` | Folded: under More / tab strip |
| b06/keywords (also ) | `seoclusters` | Growth › SEO · Keywords — `#growth/seo-keywords` | Folded: under More / tab strip |
| b06/google (also ) | `seogoogle` | Growth › SEO · Google — `#growth/seo-google` | Folded: under More / tab strip |
| b06/studio (also ) | `seostudio` | Growth › SEO · Content — `#growth/seo-content` | Folded: under More / tab strip |
| b06/local (also ) | `seolocal` | Growth › SEO · Local — `#growth/seo-local` | Folded: under More / tab strip |
| b06/analytics (also ) | `seoanalytics` | Growth › SEO · Analytics — `#growth/seo-analytics` | Folded: under More / tab strip |
| b06/reports (also ) | `seoreports` | Growth › SEO · Reports — `#growth/seo-reports` | Folded: under More / tab strip |
| b05/campaigns (also ) | `businesscampaigns` | Growth › Older campaign drafts — `#growth/drafts` | Folded: under More / tab strip |
| b06/search (also marketing/search, seo, visibility) | `visibility` | Growth › Search readiness (older) — `#growth/search-readiness` | Folded: under More / tab strip |
| b06/search-console (also ) | `searchconsole` | Growth › Search connection request — `#growth/search-connection` | Folded: under More / tab strip |
| b06/backlinks (also ) | `backlinks` | Growth › Backlink suggestions — `#growth/backlinks` | Folded: under More / tab strip |
| b06/website (also ) | `website` | Growth › Website & domain request — `#growth/website-domain` | Folded: under More / tab strip |
| b07/ledger (also finance/ledger, money) | `finance` | Money › Profit & Payments — `#money/ledger` | Primary |
| b07/invoices (also ) | `businessinvoices` | Money › Invoices & Quotes — `#money/invoices` | Primary |
| b07/payments-refunds (also ) | `finpayments` | Money › Payments & Refunds — `#money/payments` | Primary |
| b07/reconcile (also ) | `finreconcile` | Money › Bank Reconciliation — `#money/reconcile` | Primary |
| b07/reports (also ) | `finreports` | Money › Reports & GST — `#money/reports` | Primary |
| b07/compliance (also ) | `fincompliance` | Money › Finance Settings & Compliance — `#money/settings` | Primary |
| b07/sales (also ) | `finsales` | Money › Sales documents (older view) — `#money/sales` | Folded: under More / tab strip |
| b08/settings (also governance/settings, setup) | `onboarding` | Setup › Brand & Settings — `#setup/settings` | Primary |
| b08/connections (also marketing/connections, workforce/connections) | `integrations` | Setup › Connections (social, WhatsApp, website) — `#setup/connections` | Primary |
| b09/usage (also money/billing, finance/billing) | `billing` | Setup › Plans, Billing & Add-ons — `#setup/plans` | Primary |
| b08/trust (also governance/trust) | `governance` | Setup › Trust & Security — `#setup/trust` | Primary |
| b08/automation (also ) | `automation` | Setup › Automation Settings — `#setup/automation` | Primary |
| b08/help (also governance/help) | `support` | Setup › Help & Complaints — `#setup/help` | Primary |
| b08/manual (also governance/manual) | `manual` | Setup › User Manual — `#setup/manual` | Primary |
| b08/import (also governance/migration) | `migration` | Setup › Import Your Data — `#setup/import` | Folded: under More / tab strip |
| b08/print (also setup/print, governance/exports) | `exports` | Setup › Print & Export Hub — `#setup/export` | Folded: under More / tab strip |
| b08/support-access (also ) | `supportaccess` | Setup › Support Access — `#setup/support-access` | Folded: under More / tab strip |
| b09/change-plan (also ) | `finplan` | Setup › Change Plan — `#setup/change-plan` | Folded: under More / tab strip |

Founder Console (34 destinations) is unchanged and stays separately authenticated (`docs/redesign/01_NAVIGATION.md`).

## Deliverable 3 — Empty states (one primary action each)

| Area | Shown when (server data, tenant-scoped) | Message | Primary action |
|---|---|---|---|
| Today | Always on Command Centre (`#workspace-start`) | "Start with the work that matters" | First allowed of: Capture an enquiry / Open your jobs / Review conversations |
| Work | `GET /api/saas/pipeline/overview` has zero items in every stage | Pipeline is empty; enquiry → quote → booking → job → invoice with approvals | **Capture an enquiry** → `#work/enquiries` |
| Communications | `GET /api/saas/comms/unified` returns no items and all folder counts 0 | Inbox empty; connect channels; AI drafts need approval | **Connect a channel** → `#setup/connections` (falls back to the inbox for roles without Connections) |
| Growth | `GET /api/saas/growth/overview` has no plans and no calendar items | No growth plan; nothing publishes without approval | **Create a campaign draft** → `#growth/campaigns` |

Implementation: `saas/workspace-empty-guides.js` (read-only GETs the user can already make; never creates or sends).

## Deliverable 4 — Design-system tokens

Existing (PR #75, `saas/workspace-redesign.css`): Inter/system stack, 16 px base (16 px mobile inputs, no iOS zoom),
line-height 1.5, H1 24–28 px, H2 18–20 px, spacing 4/8/12/16/24, radius 12 px, content max 1200 px, 44 px touch targets
on workflow links, sticky AI command bar, focus outline 3 px. Added now:

```css
--status-ok: var(--green); --status-attention: var(--amber); --status-block: var(--red); --touch-min: 44px;
.approval-badge[data-state="pending|approved|blocked"]   /* dot + label, never colour alone */
.view-empty-guide                                          /* dashed brand panel, one full-width button on phones */
.navigation-group:has(> [data-domain="setup"])             /* Setup separated from the 7 daily groups */
```

Desktop: collapsible left rail. Phone/tablet: rail becomes a modal drawer (focus-trapped, Escape closes, background
inert). The black-and-gold theme and light/dark modes are unchanged. No looping animation.

## Deliverable 5 — Role-based visibility matrix (pages visible / pages in group)

Base roles with no custom grants. Non-owners additionally need explicit grants for inbox, email, content, growth and
SEO (`inbox.read`, `mail.read`, `content.read`, `growth.read`, `visibility.read`); Connections needs a channel grant.
"worker" maps to the `employee`/`contractor` roles.

| Group | owner | admin | manager | employee | contractor |
|---|---|---|---|---|---|
| Today | 4/4 | 4/4 | 4/4 | 2/4 | 2/4 |
| Work | 6/6 | 6/6 | 6/6 | 1/6 | 1/6 |
| Customers | 1/1 | 1/1 | 1/1 | 0/1 | 0/1 |
| People | 4/4 | 3/4 | 2/4 | 1/4 | 1/4 |
| Communications | 9/9 | 4/9 | 4/9 | 1/9 | 1/9 |
| Growth | 18/18 | 1/18 | 1/18 | 0/18 | 0/18 |
| Money | 7/7 | 7/7 | 0/7 | 0/7 | 0/7 |
| Setup | 11/11 | 8/11 | 6/11 | 3/11 | 3/11 |

UI filtering is presentation only: every endpoint re-checks role/grant server-side (`can(feature, action)`).

## Deliverable 6 — Security & isolation verification checklist

| Check | Where enforced | Verified by |
|---|---|---|
| Business comes from the server session, never a client `workspace_id` | `requireSaasUser` → `req.saas.organisation_id` | `npm test` isolation suites |
| Every query scoped by `organisation_id` | src routes incl. pipeline, comms, growth | cross-tenant tests in `scripts/*.test.mjs` |
| Approval before external sends, publishing, payments, schedule and permission changes | approvals + automation engine; late re-check before Growth publish (PR #75) | approval/publisher tests |
| Secrets never sent to the browser | provider tokens stored server-side, redacted errors | `npm run security:secrets` |
| UI hiding is not authorisation | `allowed()` only filters menus; APIs gate with `can()` | navigation + API tests |
| Empty-state guide cannot leak data | only GETs the user may already call; booleans only | code review (this change) |
| Operator sign-in kept on Business sign-in; no Install there | `saas/sign-in.html` | UI regression tests |

Open (unchanged, tracked in `03_SECURITY_AUDIT.md`): encryption-at-rest migration, production restore drill, provider reviews.

## Deliverable 7 — Mobile / field-worker notes

- Workers (employee/contractor) see a short menu: Today, Jobs, their own People/Compliance, Team Chat, Help.
- Jobs: one page with status actions; inputs 16 px; 44 px buttons; photo upload uses the device camera via file input.
- Team Chat sits under Communications and is reachable in two taps from the drawer.
- Empty-state buttons become full-width on phones; tab strips scroll horizontally instead of wrapping.

## Deliverable 8 — Implementation sequence

| Priority | Item | Complexity | Status |
|---|---|---|---|
| P0 | Clean 7+Setup navigation, remove B01–B09 numbering, legacy aliases | M | Done (this change) |
| P0 | Fold duplicate surfaces into Unified Inbox, Work Pipeline, Growth Hub, SEO Command Centre | M | Done as navigation/tabs; data stores unchanged |
| P0 | Empty-state primary actions (Today, Work, Communications, Growth) | S | Done |
| P1 | True single inbox store and single quote/invoice document model | L | Not started — needs data migration with parity tests |
| P1 | Single Communications Setup wizard replacing three "Save service request" forms | M | Not started |
| P1 | Unified customer timeline | L | Specified in `04_ROADMAP_90_DAYS.md` |
| P2 | Lazy-load SEO/Media bundles, skeleton loaders | M | Not started |
| P2 | Encryption-at-rest migration, restore drill evidence | L | Tracked in security audit |

## Continuation

If a session stops, resume from `.claude/project-memory/SESSION_HANDOVER.md` and this file; the code, not the chat, is
the checkpoint.
