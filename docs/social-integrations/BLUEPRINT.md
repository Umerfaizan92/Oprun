# Connections Manager blueprint — proposed, not built

Date: 10 November 2026. Task: T-068. Status: proposal for the owner's approval. No code has been changed.
Read `STATUS.md` first: it holds the audit findings (F1–F9) and blockers (B1–B6) this blueprint depends on.

Goal: every subscriber business connects its own accounts through the provider's official login, stays connected,
and runs posts, replies, local campaigns and lead capture from one organised place, with a human approving every
outgoing action and no link to any other business, including Fleet Parlour.

## 1. Design rules

1. **One business, one vault.** Tokens, accounts, messages, leads and campaigns belong to one workspace. A Page,
   number, channel or ad account can be bound to only one workspace at a time.
2. **No passwords in SuperPro.** Sign-in happens on the provider's page. SuperPro holds a revocable permission.
3. **Nothing goes out without approval.** AI drafts; an owner or an assigned approver releases. Approval is the
   default on every plan and is recorded with name and time.
4. **Say only what works.** Each card lists the actions that work today for that provider and that plan.
5. **Problems are found by SuperPro, not by the subscriber.** Every connection is checked daily and before each
   scheduled action.
6. **Existing pages keep working.** Every current route, button and element ID stays (standing rule).
7. **The subscriber pays the provider for provider charges** (ad spend, WhatsApp messages), from their own
   account. SuperPro never holds or spends a subscriber's ad budget.

## 2. How the section is organised

The Manager is one hub with six tabs. Five of them already exist as separate pages; the hub links them and adds
the missing pieces. Current page IDs are in brackets.

| Tab | Purpose | Built on |
|---|---|---|
| 1. Accounts | Connect, confirm, health, reconnect, disconnect | Connections (`b08/connections`) |
| 2. Inbox | Messages, comments and reviews from every connected account | Unified Inbox (`b04/unified`) |
| 3. Publish | Calendar, posts, videos, per-network preview | Growth (`b05/growth`), Media Studio (`b05/studio`) |
| 4. Campaigns | Local-area campaigns, organic and paid | Campaign Studio (`b05/campaign-studio`), Campaign Drafts (`b05/campaigns`), Local SEO (`b06/local`) |
| 5. Leads | Every lead with its source, into the pipeline | Enquiries (`b02/enquiries`) |
| 6. Approvals & Activity | Queue of drafts, and a log of everything sent | Approvals (`b01/approvals`) |

### Tab 1 — Accounts

Each provider card moves through visible stages: **Not connected → Signing in → Choose account → Confirm →
Connected → Needs attention**.

- **Before Connect:** a short checklist per provider ("You need a Facebook Page and full control of it", "You must
  be the YouTube channel owner").
- **Account chooser forced** on every provider, so the browser's existing login is never used silently.
- **Confirm step:** "You are connecting *Page name* to *Business name*. Is this right?" with the profile picture.
- **Already in use:** "This Page is connected to another SuperPro business" with no detail about which one.
- **Health light per connection:** green (working), amber (expires soon or a permission is missing), red
  (reconnect needed), each with the one action that fixes it.
- **What this connection can do:** ticks for Post, Video, Messages, Comments, Reviews, Insights, Lead forms, Ads.
- **Who connected it and when**, last successful check, and Disconnect with a plain statement of what is removed.

### Tab 2 — Inbox

- Selecting an account in Tab 1 subscribes it to live updates and creates the inbox channel automatically (today
  this is manual and needs operator activation — F7).
- One thread per customer across channels where the provider gives a stable identity.
- AI suggests a reply; a person sends it. Auto-send only for rules the owner switches on (for example opening
  hours).
- Reply-window timer shown on each thread where the provider limits replies (Messenger, Instagram, WhatsApp).
- Buying-intent flag ("price?", "available?", "book") turns a comment or message into a lead in one click.
- Notifications in SuperPro, by email and by push, per staff member.

### Tab 3 — Publish

- One composer, per-network preview, and a check against each network's limits before scheduling.
- Calendar with status: Draft, Awaiting approval, Scheduled, Published, Failed.
- If a connection turns red, scheduled posts are **held** and the owner is alerted; nothing is silently dropped.
- Video upload through the provider's official upload flow, with progress and result.

### Tab 4 — Campaigns (local area)

A guided builder: **Goal → Area → Offer → Channels → Budget → Approve → Results**.

- **Area:** suburbs, postcodes or a radius around the business address. The workspace already stores suburb,
  postcode and service area.
- **Organic:** scheduled posts, Google Business Profile posts and offers, review requests to past customers.
- **Paid (later phase):** local-radius ads in the subscriber's own ad account, with a daily cap they set. Nothing
  starts until they approve the budget on screen.
- **Templates by industry**, using the existing industry registry.
- **Results:** reach, clicks, messages, leads and cost per lead, per campaign and per area.

### Tab 5 — Leads and sources

Every lead records where it came from, automatically.

| Source | How it is captured |
|---|---|
| Social message or comment | Marked from the Inbox, tagged with network, post and campaign |
| Provider lead forms | Pulled from the provider when a form is submitted (needs provider approval) |
| Website form | Existing contact form connector, tagged with page and campaign |
| Tracked links | Short link per post and campaign, so clicks and enquiries are attributed |
| QR codes | One per flyer, vehicle or shop sign, tied to a campaign |
| Phone and SMS | Call or text to a business number, tagged by the number dialled |
| Google Business Profile | Calls, direction requests and messages where Google reports them |
| Manual and import | Staff entry or file import, with a required source |

- Leads flow into the existing pipeline: Enquiry → Quote → Booking → Job → Invoice → Payment.
- Duplicate detection by phone and email inside the workspace only.
- Source report: leads, bookings and revenue by source, campaign and area.
- Consent recorded with each lead, feeding the existing Consent & Unsubscribes page.

### Tab 6 — Approvals & Activity

- One queue for posts, replies, campaigns, budgets and review responses, with approve, edit, reject.
- Approver roles set by the owner. Optional second approval for anything that spends money.
- Activity log: who connected, approved, published, replied or disconnected, and when. Exportable.

## 3. Security and isolation

- Tokens encrypted per workspace (in place today). Add: key rotation procedure, token-use log, and automatic
  removal of tokens when a workspace is closed.
- Unique binding for every external account ID across workspaces, enforced in the database.
- Redirect addresses validated at start-up; a wrong one blocks Connect and alerts the Founder Console (F3).
- Legacy single-business endpoints locked behind Founder sign-in (F1, F2), then retired after Fleet Parlour's own
  workspace connection is confirmed.
- Inbound webhooks verified with the provider's signature and routed only by a bound account ID.
- Staff see only the accounts and inboxes the owner assigns. The Founder Console sees connection health and
  counts, never message content or tokens.
- Automated tests that a second workspace cannot read, use or learn of the first workspace's connections.

## 4. Founder Console view

- Health of each platform app: approval status, quota, error rate.
- Count of connections by provider and by state, with no subscriber content.
- Alerts: provider outage, approval expiring, unusual failure rate, redirect misconfiguration.
- Provider cost meter for charges that fall on the platform (X usage).

## 5. Provider reality that limits this

| Item | Constraint |
|---|---|
| Meta (Facebook, Instagram, WhatsApp, lead forms, ads) | App Review and Business Verification for each permission |
| WhatsApp | Meta charges the subscriber per message; Embedded Signup must be built |
| Google (YouTube, Business Profile) | OAuth verification; Business Profile access request; upload quota |
| TikTok | App review; posting audit; comment access to be re-verified (other tools offer it) |
| X | Pay-per-use, charged to the platform |
| Snapchat | Posting needs Snap's allowlist; may be refused |
| Paid ads and lead-form retrieval | Not verified against provider documentation in this audit; verify before design |

No software can guarantee a connection never breaks: providers expire and revoke access. The design answer is
detection, holding work safely, and a one-click reconnect.

## 6. Build order

| Phase | Delivers | Depends on |
|---|---|---|
| A. Safe base | Lock legacy endpoints; redirect checks; account chooser and confirm step; one-workspace binding | Owner approval; B1 |
| B. Accounts tab | Stages, checklists, health lights, daily checks, reconnect alerts, honest capability ticks | A |
| C. Platform apps | SuperPro-named apps; submit Meta, Google, TikTok reviews | B3; owner's provider dashboards |
| D. Inbox | Auto-binding, live comments and messages, AI reply drafts, intent flag to lead | C approvals (works for testers earlier) |
| E. Publish | Composer, calendar states, held posts, video upload, Instagram and Google Business posts | C approvals |
| F. Leads | Source tagging, tracked links, QR codes, source report | A (no provider approval needed) |
| G. Campaigns | Area builder, organic campaigns, results | E, F |
| H. WhatsApp | Embedded Signup, templates, cost notice | C |
| I. Paid ads and lead forms | Ad account connection, budget approval, lead-form retrieval | Separate verification and owner decision |
| J. Retire legacy | Stop using single-business values after Fleet Parlour's workspace is confirmed | D, E |

Phases A, B and F need no provider approval and can start as soon as the owner approves.

## 7. Open decisions for the owner

1. Is the public `/api/social-stats` endpoint used by the Fleet Parlour website?
2. Which plans include which tabs, and whether paid ads are an add-on.
3. Whether LinkedIn and Threads are added after the eight current providers.
4. Who, besides the owner, may approve spending in a workspace.
