# Command Centre master prompt: four sections (12 Nov 2026)

Sections on `#today/home`: **Business overview → Your Workspace → Action Centre → Workflow Guidance**.

- **Action Centre** (was Priorities / Attention items; icon `i-target`): only "Your next step" (three permitted cards with
  live status) and the AI Operations Brief. Element id `#priorities` kept. Old links `?section=priorities` and
  `?section=attention-items` open it.
- **Workflow Guidance** (`#workflow-guidance`, icon `i-route`) replaces the Readiness panel and the static workflow strip.
  Old links `?section=readiness` and `?section=workflow-guide` open it. Aliases apply only when a page has no section with
  the old key, so other pages are unaffected.
  - A. Core workflow: Enquiry → Quotation → Booking → Allocation → Execution → Completion → Invoice → Payment. Each stage
    shows one live figure (pipeline overview stages `enquiries, quotes, bookings, allocated, to_invoice, unpaid, paid`;
    Allocation uses `command-centre.jobs.awaiting`). Select a stage for what it does, what it needs, what follows, an
    Open link (only when the role may open that page) and "Ask AI about this step". Figures the role cannot read show
    "Not available for your role"; nothing is invented. One-shot reveal animation, disabled with reduced motion.
  - B. Setup checklist, the same component as Brand & Settings (`saas/workspace-setup.js`, `window.OprunSetupChecklist`).

## Setup Checklist root cause and fix

1. The Command Centre "Setup checklist" was a decorative `<span class="status-pill">`, not a button, beside three
   hard-coded statuses (Tenant security, Workforce engine, Production integrations) that never read real data.
2. On Brand & Settings, every profile step's "Open" button used `data-jump="onboarding"` while already on that page, so
   `showView('onboarding')` changed nothing (hash stayed `#setup/settings`).
3. "Connect a channel" counted only `status === 'connected'`, missing integrations reported as `active`.

Fix: one checklist builder rendered in both places. Each step opens its real page, selects the right settings or finance
tab and focuses the field (also when already on that page); loading, error with "Try again", empty (role with no
steps), success and "Refresh" states; status re-checked after saving the profile, a job or an overhead; a step whose
data could not be read is shown as "?"/"Check", never as done. RBAC: steps link only to pages in the role's navigation;
overheads only for owner/admin; every endpoint still enforces permissions and organisation scope on the server.

## Verification

`npm test` 73/73, `test:redesign-ui` (320/390/768/1440 px, four tabs, 8 stages, stage expand + link, checklist click
navigates and focuses, old section links, axe dark/light), `test:mobile-workspace-ui` 354 checks, `verify:manifest`,
`security:secrets`.
