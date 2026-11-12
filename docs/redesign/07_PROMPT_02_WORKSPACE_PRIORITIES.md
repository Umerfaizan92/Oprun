# Prompt 02: Your Workspace and Priorities (12 Nov 2026)

Branch `claude/workspace-and-priorities` (stacked on Prompt 01, PR #89). Task T-092.

## Changes
- **Your Workspace** (new Command Centre section, directly after Business overview, `?section=your-workspace`):
  every page the person's role and grants allow, grouped like the main navigation (Today, Work, Customers, People,
  Communications, Growth, Money, Setup), secondary pages under "More in …". Live counts on Enquiries, Unified Inbox,
  Approvals, Jobs and Workers. Instant "Find a feature" filter (Enter opens the first match; no match offers "Ask AI
  where to find it"). Phones: four-per-row app launcher. Tiles open the real pages, so each uses its own authorised API.
- **Priorities** (renamed from "Attention items"; target icon; `?section=attention-items` still opens it): only
  - Your next step: the same three permitted cards, now with live status (new enquiries, jobs today/to allocate,
    conversations needing a reply);
  - AI Operations Brief: existing summary, ranked live priorities (approvals, replies, enquiries, allocation,
    compliance, monthly loss for owner/admin) each with Open/Review, "Needs your approval" tags, live time,
    Refresh, and an on-demand **Generate AI plan** using the existing `POST /api/saas/ai/threads` (senior roles;
    saved to AI Operations; graceful error if no AI provider).
- Both sections hide the greeting/header, the AI command bar and the Ask Oprun launcher (the Ask Oprun panel still
  opens when asked). Business overview, Readiness and Workflow guide are unchanged.
- Bottom bar: five sub-sections fit one row on common phones; narrower screens wrap (no sideways scroll).

## Data and security
Read-only calls: `GET /api/saas/command-centre` (senior roles, grant-filtered server-side) and
`GET /api/saas/pipeline/overview` (only if Enquiries is permitted). No new endpoints, no schema changes,
no records deleted. Protected actions remain behind existing approvals.

## Verification
- `npm test` 73/73; `test:redesign-ui` (320/390/768/1440) with new checks for both sections, tab order, hidden
  header/AI bar/launcher, filter, three cards, live pill, old-alias redirect, axe dark/light on both sections;
  `test:mobile-workspace-ui`, `test:comms-ui`, `test:pipeline-ui`, `security:secrets` pass.
- `test:ui` (jobs hover) and `test:navigation-ui` (finance reports tab) fail exactly as on `main` (pre-existing).
- Not verified: Generate AI plan against a live AI provider (no provider in the test environment); real devices.

## Continuation
"Repo Umerfaizan92/Oprun, branch `claude/workspace-and-priorities`, task T-092. Prompt 02 done and tested; PR awaits
owner review on top of PR #89. Do not merge/deploy without approval. Await Prompt 03."
