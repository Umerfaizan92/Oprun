# Navigation preservation map

Baseline: PDF implementation baseline main/live 6615f960 verified on 12 November 2026. Public website, APIs, storage and credentials unchanged.

Implementation: group → submenu in the left rail; existing page sections/tabs at the top. Canonical routes and legacy aliases are preserved. Default roles below are supplemented by existing custom grants; the server remains authoritative.

| Portal | Group | Page | Canonical route | Default roles | Implementation / sections |
|---|---|---|---|---|---|
| Business | Today | Command Centre | /saas/workspace.html#today/home | Existing default access | Existing view and API preserved; contextual sections enhanced in place |
| Business | Today | AI Assistant | /saas/workspace.html#today/assistant | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Today | Approvals | /saas/workspace.html#today/approvals | Existing default access | Existing view and API preserved; contextual sections enhanced in place |
| Business | Today | AI Automations | /saas/workspace.html#today/automations | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Work | Enquiries | /saas/workspace.html#work/enquiries | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Work | Quotes | /saas/workspace.html#work/quotes | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Work | Bookings | /saas/workspace.html#work/bookings | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Work | Jobs & Dispatch | /saas/workspace.html#work/jobs | Existing default access | Existing view and API preserved; contextual sections enhanced in place |
| Business | Work | Stock & Supplies | /saas/workspace.html#work/stock | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Work | Archived records | /saas/workspace.html#work/archive | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Customers | Customer Directory | /saas/workspace.html#customers/directory | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | People | Workers & Compliance | /saas/workspace.html#people/workers | Existing default access | Existing view and API preserved; contextual sections enhanced in place |
| Business | People | Staff Accounts & Roles | /saas/workspace.html#people/staff | owner | Existing view and API preserved; contextual sections enhanced in place |
| Business | People | Hiring | /saas/workspace.html#people/hiring | owner, admin | Existing view and API preserved; contextual sections enhanced in place |
| Business | People | Offshore Staff | /saas/workspace.html#people/offshore | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Communications | Unified Inbox | /saas/workspace.html#communications/inbox | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Communications | Call Handling | /saas/workspace.html#communications/call-handling | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Communications | AI Receptionist | /saas/workspace.html#communications/receptionist | owner, admin, manager, super_admin, director | Service request/profile draft; activation separate |
| Business | Communications | Video Meetings | /saas/workspace.html#communications/meetings | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Communications | Team Chat | /saas/workspace.html#communications/team-chat | Existing default access | Existing view and API preserved; contextual sections enhanced in place |
| Business | Communications | Email folder | /saas/workspace.html#communications/email | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Communications | Channel inbox (classic view) | /saas/workspace.html#communications/channels | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Communications | Phone numbers setup | /saas/workspace.html#communications/numbers | owner, admin, manager, super_admin, director | Service request/profile draft; activation separate |
| Business | Communications | Calls & SMS setup | /saas/workspace.html#communications/calls-sms | owner, admin, manager, super_admin, director | Service request/profile draft; activation separate |
| Business | Growth | Growth Hub | /saas/workspace.html#growth/hub | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | Campaign Studio | /saas/workspace.html#growth/campaigns | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | Media Studio | /saas/workspace.html#growth/media | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | Consent & Unsubscribes | /saas/workspace.html#growth/consent | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | SEO Command Centre | /saas/workspace.html#growth/seo | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | Website Builder | /saas/workspace.html#growth/website-builder | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | SEO · Audit | /saas/workspace.html#growth/seo-audit | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | SEO · Keywords | /saas/workspace.html#growth/seo-keywords | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | SEO · Google | /saas/workspace.html#growth/seo-google | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | SEO · Content | /saas/workspace.html#growth/seo-content | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | SEO · Local | /saas/workspace.html#growth/seo-local | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | SEO · Analytics | /saas/workspace.html#growth/seo-analytics | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | SEO · Reports | /saas/workspace.html#growth/seo-reports | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | Older campaign drafts | /saas/workspace.html#growth/drafts | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | Search readiness (older) | /saas/workspace.html#growth/search-readiness | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Growth | Search connection request | /saas/workspace.html#growth/search-connection | owner, admin, manager, super_admin, director | Service request/profile draft; activation separate |
| Business | Growth | Backlink suggestions | /saas/workspace.html#growth/backlinks | owner, admin, manager, super_admin, director | Service request/profile draft; activation separate |
| Business | Growth | Website & domain request | /saas/workspace.html#growth/website-domain | owner, admin, manager, super_admin, director | Service request/profile draft; activation separate |
| Business | Money | Profit & Payments | /saas/workspace.html#money/ledger | owner, admin, super_admin | Existing view and API preserved; contextual sections enhanced in place |
| Business | Money | Invoices & Quotes | /saas/workspace.html#money/invoices | owner, admin, super_admin | Existing view and API preserved; contextual sections enhanced in place |
| Business | Money | Payments & Refunds | /saas/workspace.html#money/payments | owner, admin, super_admin | Existing view and API preserved; contextual sections enhanced in place |
| Business | Money | Bank Reconciliation | /saas/workspace.html#money/reconcile | owner, admin, super_admin | Existing view and API preserved; contextual sections enhanced in place |
| Business | Money | Reports & GST | /saas/workspace.html#money/reports | owner, admin, super_admin | Existing view and API preserved; contextual sections enhanced in place |
| Business | Money | Finance Settings & Compliance | /saas/workspace.html#money/settings | owner, admin, super_admin | Existing view and API preserved; contextual sections enhanced in place |
| Business | Money | Sales documents (older view) | /saas/workspace.html#money/sales | owner, admin, super_admin | Existing view and API preserved; contextual sections enhanced in place |
| Business | Setup | Brand & Settings | /saas/workspace.html#setup/settings | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Setup | Connections (social, WhatsApp, website) | /saas/workspace.html#setup/connections | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Setup | Plans, Billing & Add-ons | /saas/workspace.html#setup/plans | owner, admin, super_admin | Existing view and API preserved; contextual sections enhanced in place |
| Business | Setup | Trust & Security | /saas/workspace.html#setup/trust | Existing default access | Existing view and API preserved; contextual sections enhanced in place |
| Business | Setup | Automation Settings | /saas/workspace.html#setup/automation | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Setup | Help & Complaints | /saas/workspace.html#setup/help | Existing default access | Existing view and API preserved; contextual sections enhanced in place |
| Business | Setup | User Manual | /saas/workspace.html#setup/manual | Existing default access | Existing view and API preserved; contextual sections enhanced in place |
| Business | Setup | Import Your Data | /saas/workspace.html#setup/import | owner, admin, manager, super_admin, director | Existing view and API preserved; contextual sections enhanced in place |
| Business | Setup | Print & Export Hub | /saas/workspace.html#setup/export | owner | Existing view and API preserved; contextual sections enhanced in place |
| Business | Setup | Support Access | /saas/workspace.html#setup/support-access | owner | Existing view and API preserved; contextual sections enhanced in place |
| Business | Setup | Change Plan | /saas/workspace.html#setup/change-plan | owner, admin, super_admin | Existing view and API preserved; contextual sections enhanced in place |
| Founder | Platform overview | Overview | /office/#f01/overview | overview.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Platform overview | Revenue | /office/#f01/platform/revenue | overview.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Platform overview | Infrastructure | /office/#f01/system | overview.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Platform overview | Storage & backups | /office/#f01/platform/backups | overview.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Platform overview | AI usage | /office/#f01/platform/ai-usage | overview.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Subscribers | Businesses | /office/#f02/subscribers | subscribers.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Billing & usage | Subscription invoices | /office/#f03/invoices | billing.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Billing & usage | Payment providers | /office/#f03/legacy:subpay | billing.read or founder | Retained maintenance link; no migration |
| Founder | Billing & usage | Plans & add-ons | /office/#f03/legacy:subscribers | billing.read or founder | Retained maintenance link; no migration |
| Founder | Billing & usage | Plan prices, renewals & revenue | /office/#f03/platform/finance | billing.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Support & success | Email Centre | /office/#f04/mail | support.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Support & success | Tickets | /office/#f04/records:ticket | support.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Support & success | Support access | /office/#f04/support-access | support.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Oprun team | Team work | /office/#f05/records:staff_task | team.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Oprun team | Hiring requests | /office/#f05/records:hire | team.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Oprun marketing | Prospect CRM | /office/#f06/records:prospect | marketing.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Oprun marketing | Campaign drafts | /office/#f06/records:campaign | marketing.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Oprun marketing | Content drafts | /office/#f06/records:content | marketing.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Oprun marketing | Announcement drafts | /office/#f06/records:announcement_draft | marketing.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Oprun marketing | Website visibility | /office/#f06/legacy:searchvisibility | marketing.read or founder | Retained maintenance link; no migration |
| Founder | Oprun marketing | SEO & website | /office/#f06/platform/seo | marketing.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Oprun marketing | Newsletter campaigns | /office/#f06/platform/campaigns | marketing.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Operations & maintenance | Tasks & releases | /office/#f07/records:task | operations.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Operations & maintenance | Incidents | /office/#f07/records:incident | operations.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Operations & maintenance | Operating costs | /office/#f07/records:cost | operations.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Operations & maintenance | Provider readiness | /office/#f07/legacy:connections | operations.read or founder | Retained maintenance link; no migration |
| Founder | Operations & maintenance | AI automations | /office/#f07/platform/automation | operations.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Operations & maintenance | Reliability & backups | /office/#f07/platform/reliability | operations.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Operations & maintenance | Languages & translation coverage | /office/#f07/platform/localization | operations.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Security & audit | Activity log | /office/#f08/audit | security.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Security & audit | Compliance | /office/#f08/platform/compliance | security.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Founder controls | Complimentary grants | /office/#f09/complimentary | founder.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Founder controls | Operator staff & roles | /office/#f09/staff | founder.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Founder controls | Legacy inventory | /office/#f09/legacy-inventory | founder.read or founder | Existing renderer; native section tabs or heading-based section panels |
| Founder | Founder controls | Feature access & configuration | /office/#f09/platform/configuration | founder.read or founder | Existing renderer; native section tabs or heading-based section panels |

## Label reconciliation

| Before | After | Reason |
|---|---|---|
| Content Studio (B05) | Media Studio | Separate media specifications from website content |
| Content Studio (B06) | Website Content Studio | Clarify website/SEO drafting |
| Campaigns (B05) | Campaign Drafts | Generic draft records, separate from Campaign Studio |
| Automation (B08) | Automation Settings | Routine settings, separate from workflow builder |
| Search Console request (B06) | Search Connection Request | Request form is separate from actual Google integrations |

No database, route or permission changes accompany these labels. Seven business groups share role-filtered workflow links. Retained legacy tools use More disclosure; inbox and financial record stores remain distinct to preserve their data.

## Existing section sources

- focused-workspace.js: fourteen page-specific section configurations; now rendered as accessible top tabs rather than a section dropdown.
- Existing Finance, Growth, Visibility, Automation, Hiring and Settings controls remain attached to the original forms/panels; page-sections.js enhances keyboard/section deep links.
- Founder: console.js is the single group/page list; console-platform.js, console-reliability.js and shared module renderers own the content. Context tabs are generated only for real multi-section pages.

## Known operational findings carried forward

Daily snapshot/restore readiness was Not ready in the live audit; tenant channel activation, Google evidence and GST setting require separate verification. Navigation changes do not claim to repair these. All business actions still require their existing permissions and approval gates.
