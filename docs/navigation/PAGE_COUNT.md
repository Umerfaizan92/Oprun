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
