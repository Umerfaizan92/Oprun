# Task T-087 — mobile workspace navigation and footer

Current instruction (12 November): undo the Claude visual replacement from PR #82 and restore the saved ChatGPT design from f039490. Deployment is authorised by the subsequent live-testing request.

Base: main `41600c615d45e755a3c1cf05c58b59b499c7d1c7`. Original branch: `codex/mobile-workspace-navigation-20261112`. Restoration branch: `codex/restore-chatgpt-workspace-20261112`, based on main `791da15`.

## Implemented

- Official Oprun icon/name moved from the business top bar into the existing app footer. Business identity/menu stays in the header.
- Compact footer: brand, copyright, four policy links and existing subscription status. Repeated marketing/security/AWS wording removed from the signed-in workspace footer; policy pages remain available.
- Original sign-out element moved to the end of the business drawer, after Setup and account security. Its original event handler remains attached.
- At 760px and below: fixed bottom current-area pages, with icons/labels and a horizontally scrollable section row. Extra nested section lists share the section row in named groups. All permitted pages, including More tools, remain reachable.
- Original section controls/forms stay in their original DOM. Bottom buttons invoke existing handlers; dynamic rerenders rebind references. Hidden parent panels are excluded. Desktop retains original in-page controls.
- Mobile Ask Oprun / Office chat entry points move into the bottom page row when those controls are available. Existing panels sit above the dock, with a measured safe-area/content offset.
- Shared mobile typography, focus indicators, panel corners and input sizes; touch targets at least 44px (dock controls 56px).

## Duplicate/control audit

| Finding | Decision |
|---|---|
| Header search and footer “Ask or find a workspace feature” opened the same finder | Removed the footer duplicate; retained the header finder |
| Contextual workflow rows repeated page links on mobile | Hide the rows on mobile; expose all current-area peers through the dock and other areas through Menu |
| App footer brand plus separately appended global trust copy | One signed-in app footer with official brand and policy links |
| Connections management vs Channel operations | Retained: authorisation/resource management and operational content/approval screens have different functions |
| Classic channel inbox vs Unified Inbox vs Email folder | Kept routes/data; existing labels and More disclosure distinguish retained tools |
| Sales documents, campaign drafts, search requests vs newer modules | Kept existing distinct records and permissions; accessible under current areas without duplicate top mobile toolbars |

## Validation and limits

- `npm run test:fast`: 69/69 checks passed (syntax, schema/storage, tenant isolation, permissions, approval pipeline and synthetic real-server workflows).
- `node --test scripts/mobile-workspace.test.mjs scripts/navigation-save-state.test.mjs scripts/workspace-context.test.mjs`: 16/16 passed. Includes all 60 route/alias mappings, group peers, custom employee grants, original section handlers, unsaved field retention, identical-label rerenders, hidden nested panels, desktop fallback, moved branding/sign-out unsaved navigation guard, unread badge updates, staff-chat permission changes and keyboard viewport offsets.
- The all-page browser regression script is saved as `npm run test:mobile-workspace-ui`. Browser execution is blocked in this environment: Chromium process socket creation is not permitted. No browser-layout/visual PASS is claimed.
- The managed local preview starts after local-only dependency/runtime configuration. Its normal sign-in page was observed; authenticated mobile screens were not visually verified.
- Desktop/mobile visual checks, iOS/Android keyboard/safe-area behaviour, contrast and real provider operations still need a working authenticated browser runner. No production connection or business data was changed.
- Existing navigation/redesign/logout tests were updated for the new controls; their browser execution is pending.
- Founder Console and public website are outside this business-workspace presentation change.

## Review fixes

- Fixed the AI panel itself above the dock; an older fixed 72px offset ignored the parent offset.
- Made AI log flex and shrink in short viewports so the composer remains reachable.
- Preserved unread counts/accessible notification labels in the Office chat and page badge controls.
- Suppressed the Office chat action when its permission-controlled source shell is hidden; observe grants and badge updates.
- Measure the visual viewport for keyboard-aware dock/panel offsets. Real device layout still needs visual verification.

## Page-by-page source and DOM routing audit

Every canonical route and its aliases were checked against the current route registry in DOM tests. Section names below are from the repository section inventory; dynamic API-rendered sections are bridged at runtime and require browser verification. These are not fresh visual PASS claims.

| Area | Page | Canonical route | Existing section inventory | Current evidence |
|---|---|---|---|---|
| Today | Command Centre | `today/home` | Business overview → Attention items → Readiness → Workflow guide | DOM route/alias/peer PASS; visual pending |
| Today | AI Assistant | `today/assistant` | How AI works → Ask AI → Save an operational task → Saved tasks | DOM route/alias/peer PASS; visual pending |
| Today | Approvals | `today/approvals` | Decision overview → Queue & history → Approval policy | DOM route/alias/peer PASS; visual pending |
| Today | AI Automations | `today/automations` | Automations → Activity → Suggestions & reports → Rules & safety → Audit report | DOM route/alias/peer PASS; visual pending |
| Work | Enquiries | `work/enquiries` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Work | Quotes | `work/quotes` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Work | Bookings | `work/bookings` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Work | Jobs & Dispatch | `work/jobs` | Create work order → Open work orders | DOM route/alias/peer PASS; visual pending |
| Work | Stock & Supplies | `work/stock` | Reorder → Most used → Stock on hand | DOM route/alias/peer PASS; visual pending |
| Work | Archived records | `work/archive` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Customers | Customer Directory | `customers/directory` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| People | Workers & Compliance | `people/workers` | Add worker → People | DOM route/alias/peer PASS; visual pending |
| People | Staff Accounts & Roles | `people/staff` | Business members → Invitation history | DOM route/alias/peer PASS; visual pending |
| People | Hiring | `people/hiring` | Roles and adverts → Applicants | DOM route/alias/peer PASS; visual pending |
| People | Offshore Staff | `people/offshore` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Communications | Unified Inbox | `communications/inbox` | Inbox → Sent → Drafts → Scheduled → Archived → Failed → Spam | DOM route/alias/peer PASS; visual pending |
| Communications | Call Handling | `communications/call-handling` | Section: Your number → Section: Call handling → Section: Recent calls | DOM route/alias/peer PASS; visual pending |
| Communications | AI Receptionist | `communications/receptionist` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Communications | Video Meetings | `communications/meetings` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Communications | Team Chat | `communications/team-chat` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Communications | Email folder | `communications/email` | All mail → Received → Drafts & approved → Sent → Scheduled → Marketing → Campaigns → Enquiries → Invoices → Support | DOM route/alias/peer PASS; visual pending |
| Communications | Channel inbox (classic view) | `communications/channels` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Communications | Phone numbers setup | `communications/numbers` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Communications | Calls & SMS setup | `communications/calls-sms` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Growth | Growth Hub | `growth/hub` | Plan → Calendar → Reuse a post → About you → Activity | DOM route/alias/peer PASS; visual pending |
| Growth | Campaign Studio | `growth/campaigns` | Section: New campaign → Section: Campaigns | DOM route/alias/peer PASS; visual pending |
| Growth | Media Studio | `growth/media` | Start from anything you already have → AI Render Specification → Platform suggestions → Creative readiness → Saved specifications | DOM route/alias/peer PASS; visual pending |
| Growth | Consent & Unsubscribes | `growth/consent` | Section: Marketing consent → Section: Unsubscribed and suppressed | DOM route/alias/peer PASS; visual pending |
| Growth | SEO Command Centre | `growth/seo` | Section: Google → Section: Scheduled SEO jobs → Section: Your sites | DOM route/alias/peer PASS; visual pending |
| Growth | Website Builder | `growth/website-builder` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Growth | SEO · Audit | `growth/seo-audit` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Growth | SEO · Keywords | `growth/seo-keywords` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Growth | SEO · Google | `growth/seo-google` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Growth | SEO · Content | `growth/seo-content` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Growth | SEO · Local | `growth/seo-local` | Section: Checks → Section: Reviews → Section: Service-area and location pages | DOM route/alias/peer PASS; visual pending |
| Growth | SEO · Analytics | `growth/seo-analytics` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Growth | SEO · Reports | `growth/seo-reports` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Growth | Older campaign drafts | `growth/drafts` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Growth | Search readiness (older) | `growth/search-readiness` | Score → Business facts → Content library → AI answers → Schema & files | DOM route/alias/peer PASS; visual pending |
| Growth | Search connection request | `growth/search-connection` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Growth | Backlink suggestions | `growth/backlinks` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Growth | Website & domain request | `growth/website-domain` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Money | Profit & Payments | `money/ledger` | Overview → Jobs & payments → Get paid → Costs & overheads → Reports | DOM route/alias/peer PASS; visual pending |
| Money | Invoices & Quotes | `money/invoices` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Money | Payments & Refunds | `money/payments` | Section: Receipts → Section: Refunds | DOM route/alias/peer PASS; visual pending |
| Money | Bank Reconciliation | `money/reconcile` | Section: Import → Section: Bank lines | DOM route/alias/peer PASS; visual pending |
| Money | Reports & GST | `money/reports` | Section: Summary → Section: Profit and loss → Section: GST (BAS draft) → Section: Owed to you → Section: Overdue: suggested follow-ups | DOM route/alias/peer PASS; visual pending |
| Money | Finance Settings & Compliance | `money/settings` | Section: Finance settings → Section: Compliance review → Section: Flagged for checking → Section: Audit trail | DOM route/alias/peer PASS; visual pending |
| Money | Sales documents (older view) | `money/sales` | Section: New quotation, estimate or invoice → Section: Documents | DOM route/alias/peer PASS; visual pending |
| Setup | Brand & Settings | `setup/settings` | Business profile → Contact details → Address → Workspace design → Appearance → Services & area → Approvals → AI preferences | DOM route/alias/peer PASS; visual pending |
| Setup | Connections (social, WhatsApp, website) | `setup/connections` | Secure connection policy → Your business connections | DOM route/alias/peer PASS; visual pending |
| Setup | Plans, Billing & Add-ons | `setup/plans` | Current access → Compare plans → Payment connections → Usage & add-ons → Billing safeguards → Plan features | DOM route/alias/peer PASS; visual pending |
| Setup | Trust & Security | `setup/trust` | Owner control centre → Governance follows the business profile → AI routes. Authorised people decide. → Policies relevant to your role → Protected case management → Owner & senior notifications → Audit & governance ledger | DOM route/alias/peer PASS; visual pending |
| Setup | Automation Settings | `setup/automation` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Setup | Help & Complaints | `setup/help` | Get contextual help → Policies and escalation | DOM route/alias/peer PASS; visual pending |
| Setup | User Manual | `setup/manual` | Workspace map → Current area → Your role → Next steps → Connections guide → Help | DOM route/alias/peer PASS; visual pending |
| Setup | Import Your Data | `setup/import` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Setup | Print & Export Hub | `setup/export` | Activity log → Worker master sheet → Financial summary → Full workspace backup | DOM route/alias/peer PASS; visual pending |
| Setup | Support Access | `setup/support-access` | Single content view; no additional tablist observed | DOM route/alias/peer PASS; visual pending |
| Setup | Change Plan | `setup/change-plan` | Section: Choose a plan → Section: Plan changes | DOM route/alias/peer PASS; visual pending |

## Resume exactly here

1. Check out this branch; read this document and task T-087 in `.claude/project-memory/SESSION_HANDOVER.md`.
2. Finish any review findings documented after this checkpoint.
3. In a browser-capable environment run `npm ci`, `npx playwright install chromium` if needed, then `npm run test:mobile-workspace-ui`, `npm run test:navigation-ui` and `npm run test:redesign-ui`. Use throwaway synthetic fixtures only.
4. Verify 320/390/760/768/1440 widths, light/dark, bottom safe area, long labels, native keyboard, chat panels, drawers, deep links and unsaved fields. Fix observed failures and update evidence here.
5. The user has now explicitly requested live testing and restoration of the ChatGPT version. Merge the reviewed restoration and deploy it to the existing Oprun service; record its exact commit and deploy result.

## Restoration comparison with PR #82

| Presentation | Claude replacement | Restored ChatGPT version |
|---|---|---|
| Mobile navigation | Main area shortcut bar | Current area pages plus its section controls, fixed at bottom |
| Chat access | Separate floating round buttons | Ask Oprun and Office chat in bottom bar; panels above it |
| Footer | Six policy links, tagline and longer legal line | Original four links, copyright, logo/name and subscription status |
| Sign out | Inside security footer | Original button last in sidebar after security/Setup |
| Finder | Header only | Header only; no duplicate footer finder |

The visual code and matching tests are restored from f039490. Later chat session/grant guards, immediate unread updates and reduced animation are retained because they are independent correctness/accessibility fixes and do not replace the restored mobile layout. No backend routes, storage or secrets are changed.

Restoration regression fix: the bottom Menu button stops the original click from reaching the outside-click dismissal after it opens the drawer. A regression verifies drawer visibility and content inert state.

Restoration release verification: full `npm test` passed 73/73 checks, including 57 contract test files, final validation, quality checks and synthetic end-to-end/RBAC checks. Targeted tests passed 16/16. Manifest verification passed 579 files; secret scan passed. Public GitHub push was rejected by automatic approval review pending explicit permission for code/progress-note publication, so the live site remains on 791da15.
