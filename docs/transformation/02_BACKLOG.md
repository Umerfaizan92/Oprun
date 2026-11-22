# 02 · Implementation backlog (proposed; needs owner approval)

Order follows the brief's phases. IDs are `TR-nn`; each becomes a repo task (`T-…`) when approved. Every task
runs PLAN → IMPLEMENT → TEST → VISUALLY VERIFY → SECURITY CHECK → COMMIT → CHECKPOINT on a
`claude/transformation-*` branch. **No merge to `main` and no production release without the owner's approval of
that release.**

**Done means** (every UI task): `npm test` and `npm run test:ui` pass; the page is opened in a browser at
phone (390), tablet (768) and laptop (1440) widths with screenshots saved under `qa/visual/transformation/`;
axe shows no serious issues; old UI is not visible; role checks pass (owner, admin, manager, staff); after an
approved release, the same page is screenshotted **on oprun.ai** and the live commit SHA is recorded.

## Phase 2 · Inventory, duplicates and master design (this audit + approvals)

| ID | Task | Acceptance |
|---|---|---|
| TR-01 | Owner approves scope, visual direction and release process (questions in the reply to this audit) | Decisions recorded in `DECISIONS.md` |
| TR-02 | Tidy the task register: close superseded T-194; T-141/T-142 stay TESTING until the owner's live call test | `memory:validate` passes |
| TR-03 | Staging: a non-production service for live-like review (proposal: reuse the free `superpro-ai-v2-preview` service, pointed at the transformation branch, no production data) | Owner approval; staging URL loads the branch; production untouched |

## Phase 3 · Public website and unified design system

| ID | Task | Acceptance |
|---|---|---|
| TR-10 | **Design tokens v2** (`saas/ds/tokens.css`): palette per [03](03_VISUAL_BLUEPRINT.md) §2, both themes, AA contrast pairs | Contrast test passes for every pair; screenshots of the token sheet |
| TR-11 | **Component library v2** (`saas/ds/components.css`): buttons, inputs, cards, tabs, tables, badges, stat cards, charts, dialogs, toasts, empty states | One reference page `saas/ds/catalogue.html` (not public) with every component in both themes |
| TR-12 | **CSS consolidation**: page stylesheets folded into the system; target ≤ 8 stylesheets on `workspace.html` | Stylesheet count recorded; no visual regressions in the existing UI tests |
| TR-13 | **Brand assets**: logo, mark, favicon, PWA/app icons, email header, notification icon in the approved palette; keep the `superpro-*` copies (D-022) in step with the new icon | All references resolve; manifest and both app projects use the new icons |
| TR-14 | **Public website v2**: home, product overview, features with real product screenshots, industries, AI capabilities, pricing (server prices), new Integrations and Security pages, help, contact/enquiry, sign-in/registration entry, mobile navigation | Lighthouse SEO and accessibility ≥ 90 on mobile; every claim matches a built feature |
| TR-15 | Sign-in, create account, verify, recover pages in the new system (keep `#signin-operator-link`; no Install option on sign-in) | Existing auth tests pass; screenshots |

## Phase 4 · Business Workspace

| ID | Task | Acceptance |
|---|---|---|
| TR-20 | Workspace shell v2 (top bar, side navigation, phone dock) on the new components | Nav tests pass; every old route still opens |
| TR-21 | **Merge the 31 secondary pages** (audit §3) into their main pages as tabs or filters; aliases kept | No "(older)" label anywhere; alias test passes |
| TR-22 | Dashboard (Command Centre): compact cards, real analytics, no permanent suggestion panels | Screenshots; card count on phone ≤ 3 above the fold |
| TR-23 | Work pipeline (enquiries, quotes, bookings, jobs), Customers, Money, People, Communications, Growth, Setup pages restyled module by module | Per-module screenshots and role checks |
| TR-24 | **Modules shown by industry, plan and permission** (one rule table, server-enforced) | A cleaning business and a trades business see different module sets; hidden modules return 403 |
| TR-25 | **Temporary AI suggestions** (brief §11): contextual, dismissible, remembered per user; critical security, billing and compliance warnings never auto-hidden | Unit tests for dismissal memory and critical-warning rule |

## Phase 5 · Operator Console and staff management

| ID | Task | Acceptance |
|---|---|---|
| TR-30 | Console shell and executive dashboard in the new system | Screenshots; founder-only access test |
| TR-31 | **Departments, teams, staff roles, availability and workload** for Oprun's own staff (separate from subscriber staff) | Data never shares tables or routes with subscriber workspaces (isolation test) |
| TR-32 | **Assignment and tracking**: owner assigns enquiries, tickets, tasks and projects; deadlines, status, completion evidence | Assign → staff sees it → completes → owner sees completion (end-to-end test) |
| TR-33 | Merge crowded groups (Marketing 7, Operations 7) into tabbed pages | Page count recorded; aliases kept |

## Phase 6 · AI Agent Manager

| ID | Task | Acceptance |
|---|---|---|
| TR-40 | **Agent registry** on top of `src/automation/` and `src/job-queue.js`: each agent has an owner, responsibilities, allowed catalogue actions (permissions), schedule, deadline, retry/timeout, escalation contact | Agent cannot run an action outside its list (test) |
| TR-41 | Agents: platform health, security, enquiries, onboarding, staff allocation, support, communications, UI quality, automated testing, media, integrations, billing monitoring, release coordination | Each agent has at least one real scheduled job and a visible last-run result |
| TR-42 | **Agent Command Center** (operator): queue, running, failed, escalated, performance; human approval controls | Failure → escalation notification (test); approvals required for level 3–4 |
| TR-43 | Hard limits: no production deploys, destructive changes or financial actions without a recorded human approval | Engine refuses them by name (test) |

## Phase 7 · Intelligent onboarding

| ID | Task | Acceptance |
|---|---|---|
| TR-50 | Voice + text multilingual onboarding (reuses the existing dictation and translation) with save/resume and correction | Resume after closing the browser (test) |
| TR-51 | Questions per country, industry, operations, services and pricing, customers, staff, scheduling, communications, finance, marketing, integrations, compliance | Country rules from `src/country-profile.js` |
| TR-52 | **Proposed workspace** (modules, pipeline stages, templates) shown for review; nothing activates before the owner approves | Approval required (test); consent recorded |

## Phase 8 · Communications, Media Studio and integrations consolidation

| ID | Task | Acceptance |
|---|---|---|
| TR-60 | One Phone & SMS setup page (merges two), Call handling as a Receptionist step, one inbox with filters | Old routes alias to the new pages |
| TR-61 | Media Studio and Reels restyled in the new system (structure from T-202 kept) | Existing studio UI tests pass |
| TR-62 | Integrations page: one list with live status, test button and reconnect for every provider | Status matches the provider test |
| TR-63 | Continue the website plan (W-03 wizard and W-04 generator first, T-149/T-150) | Per its own spec |

## Phase 9 · Complete QA, security and visual verification

| ID | Task | Acceptance |
|---|---|---|
| TR-70 | Visual baseline: screenshots of every final page at three widths, both themes | Stored and compared on every PR |
| TR-71 | Security pass: tenant isolation across records, files, jobs, agent contexts, caches and logs; dependency alert fixed | All isolation tests pass; zero open high/critical alerts |
| TR-72 | Performance: workspace first load budget; Lighthouse mobile ≥ 85 on main pages | Report saved |
| TR-73 | Backup restore drill before release | Restore verified; time recorded |

## Phase 10 · Staging validation and production release

| ID | Task | Acceptance |
|---|---|---|
| TR-80 | Full review on staging by the owner | Owner sign-off |
| TR-81 | Approved release: merge, confirm live SHA on `srv-dbuq98ojo6nc73aro66g`, check caching, screenshot oprun.ai public site, Business Workspace and Operator Console on phone and laptop | Live screenshots match staging; discrepancies fixed through a new approved release |

## Owner inputs needed (cannot be done from code)

| Item | For |
|---|---|
| The reference dashboard screenshot | TR-10, TR-13 |
| Approval of the palette change (gold → purple/cyan) and of logo/icon redesign | TR-10, TR-13 |
| Release process approval (branch → staging → owner approval → merge) and staging service choice | TR-03, every release |
| Browser access for live checks: Claude in Chrome on your computer, or allow oprun.ai for this workspace | Live-UI verification |
| Render settings: `OPERATOR_TOTP_SECRET`, `SESSION_MAX_AGE_DAYS=30`, `STRICT_PASSWORD_MATCH=1` (entered by you in Render) | Security warnings |
| Decision on the legacy "Oprun" service and its disk (inspect first) | Cost (~US$9.50/month) |
