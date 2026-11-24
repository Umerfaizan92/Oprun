# Operator Console page count (TR-33)

Crowded console groups were merged into tabbed pages. Every old address still opens the same page directly
(for example `/office/#f07/records:incident`), so bookmarks, links in the dashboard and links in notifications keep working.

| Group | Menu pages before | Menu pages after | Merged pages (main page → tabs) |
|---|---|---|---|
| Oprun team | 6 | 3 | People & teams → People & workload, Departments & teams · Work & assignments → Assignments, Projects, Team work |
| Oprun marketing | 7 | 3 | Prospects & drafts → Prospect CRM, Campaign drafts, Content drafts, Announcement drafts · SEO & website → SEO & website, Website visibility |
| Operations & maintenance | 7 | 4 | Tasks & incidents → Tasks & releases, Incidents, Operating costs · Reliability & backups → Reliability & backups, Provider readiness |
| All founder groups | 40 | 30 | 10 pages became tabs; no page or route removed |

Later additions: TR-42 added an "AI agents" menu page in Operations (Command center tab, Agents tab), so there are now 42 pages, 31 in the menus, and Operations has 5.

Checked by `scripts/console-page-merge.test.mjs` and `npm run test:navigation-ui`.

## Business workspace: communications pages (TR-60)

| Before | After | What the old address does now |
|---|---|---|
| Phone Numbers setup (`communications/numbers`) | AI Receptionist, step 1 "Your number" | Opens AI Receptionist at step 1 |
| Calls & SMS setup (`communications/calls-sms`) | AI Receptionist, step 3 "Call handling" | Opens AI Receptionist at step 3 |
| Call Handling (`communications/call-handling`, `b04/voice`) | AI Receptionist, step 3 "Call handling" (same form and recent calls) | Opens AI Receptionist at step 3 |
| Channel inbox (`communications/channels`) | Unified Inbox with channel filters; "Where messages arrive" sits below the conversations for owners and admins | Opens the Unified Inbox |

The business menu goes from 62 to 58 pages. Every old address, legacy view name and alias still opens the page it became
(`MERGED` in `saas/workspace-nav.js`); the old page sections and their element IDs stay in the page. If a role cannot open
the new page, the old page shows as before. The Email folder stays a tab of the Unified Inbox (TR-21).

Checked by `scripts/redesign-preservation.test.mjs`, `scripts/mobile-workspace.test.mjs`, `npm run test:ui`,
`npm run test:comms-ui`, `npm run test:mobile-workspace-ui` and `npm run test:navigation-ui`.
