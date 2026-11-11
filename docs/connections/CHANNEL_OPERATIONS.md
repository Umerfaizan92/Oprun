# Subscriber channel operations — T-077

This release adds an owner-controlled operations hub above the existing Accounts
cards. Existing routes, customer data and provider credentials are preserved.
The owner authorised implementation, publication, deployment and live checks on
11 November 2026. No real customer message, post or paid campaign is sent during QA.

## Workflow

1. The owner connects on the provider's official authorisation screen, confirms
   the account and selects verified resources. Gmail is a separate Google OAuth
   connector; existing Resend/Telnyx transport is not described as Gmail sync.
2. Overview shows connection health and source-labelled measured counters.
3. Explicit sync imports a bounded recent sample for an assigned account.
4. Content & replies shows text safely; it does not execute provider HTML.
5. A post or reply becomes a pending draft. Approval fixes the exact body,
   account and reply target. A separate human action sends the approved draft.
6. Local campaign plans persist goal, suburbs/postcodes/radius, offer and budget.
   Approval records a plan, never starts spend or silently publishes content.
7. AI guidance uses only the authorised channel's sample and measurements. It
   is labelled AI-assisted or guided rules and has no publishing tools.
8. Team access assigns view, sync, draft, approval, publish, reply and campaign
   actions per provider, optionally limited to a selected resource.

## Implemented adapter boundary

| Channel | Recent data / overview | Outgoing workflow |
| --- | --- | --- |
| YouTube | Upload-list sample, top-level comments, subscribers/views/video counters | Approval-controlled comment replies |
| Gmail | Up to 20 inbox messages and mailbox count | Approval-controlled replies to a synced recipient/thread |
| Google Business Profile | Reviews and local posts; existing Search/Maps reporting remains | Reviewed text local posts and review replies |
| X | Recent posts and provider public metrics | Reviewed text posts and replies; account API access tier applies |
| Facebook | Existing account insights and selected Page | Reviewed Page text posts using a derived Page token |
| Instagram | Existing selected professional-account insights | Publishing, comment and messaging adapters remain gated |
| TikTok | Recent public videos with returned counters | Direct upload/posting and comments remain gated |
| WhatsApp | Signed recorded inbound/outbound messages; selected verified phone auto-binds its inbox | Reviewed replies inside the standard 24-hour service window |
| Email / SMS | Recorded messages for verified workspace-owned transport | Reviewed replies through that workspace's Resend/Telnyx account |
| Website | Recorded website enquiries after domain ownership verification | Use existing enquiry/pipeline workflow |
| Google Ads | Approved accessible customer discovery and bounded 30-day campaign reporting | Paid-ad launch remains in the provider dashboard |
| Snapchat | Existing Marketing API identity readiness | Public Profile publishing/insights remain gated |

Video preparation and the existing Growth calendar remain available. This
release must not claim direct video upload, Instagram publishing, universal
social messaging, paid-ad execution or full provider history where an adapter
is not implemented. Google, Meta, TikTok and other provider app reviews and
subscriber consent remain independent external gates. A working OAuth login
alone is not proof every provider permission has been approved.

## Security

- Organisation identity comes only from a validated session membership. Platform
  operator keys cannot substitute for subscriber sign-in.
- Managers/admins do not inherit channel access. Accounts and credentials remain
  owner-only. Existing business-wide feature grants remain explicit owner choices;
  narrow channel grants do not grant the whole legacy inbox or media library.
- Worker/employee provider grants use their own scoped API; unrelated worker role
  ceilings stay intact. Resources, cached insights, content, drafts and metrics
  are filtered on the server. Grants are tied to membership creation and revision.
- Membership, resource ownership, actor authority and approver authority are
  checked again before dispatch. Remote IDs come from verified resources and
  synced items. Reply targets are copied into the immutable draft for review.
- A compare-and-set claim prevents concurrent duplicate sends. Ambiguous delivery
  is held as `uncertain` and never automatically replayed. Crash-interrupted
  `sending` rows also stay held; check the provider before any replacement draft.
- Provider destinations are fixed official origins. No client-supplied network
  URL is fetched. Private APIs use `Cache-Control: no-store`.
- Channel tables reference the organisation with cascading deletion. Account
  deletion is still the existing verified, scheduled, owner-approved procedure.
- Tokens stay encrypted in existing storage and are never returned by hub APIs.
  Provider failure text is not echoed as an unrestricted error payload.

## Provider documentation reviewed

- YouTube comments: https://developers.google.com/youtube/v3/guides/implementation/comments
- Gmail REST and scopes: https://developers.google.com/workspace/gmail/api/reference/rest
  and https://developers.google.com/workspace/gmail/api/auth/scopes
- Business Profile local posts/reviews: https://developers.google.com/my-business/reference/rest
- X posts: https://docs.x.com/x-api/posts/create-post
- Google Ads targeting: https://developers.google.com/google-ads/api/docs/targeting/location-targeting
- Google Ads release/sunset: https://developers.google.com/google-ads/api/docs/release-notes
  and https://developers.google.com/google-ads/api/docs/sunset-dates
- TikTok Direct Post: https://developers.tiktok.com/doc/content-posting-api-get-started

Google Ads reporting defaults to REST `v26`, based on the current official
release notes, rather than the old `v21`. A deliberate environment override is
retained. Meta documentation retrieval was unavailable in this session; the
existing Facebook text-post implementation is reused in shape, without claiming
new unverified Meta capabilities. Elementor plugin discovery returned no result;
no Elementor integration was installed or used.

## Verification and resumption

Focused tests: `scripts/channel-operations.test.mjs`. Browser checks:
`npm run test:channels-ui` at 390, 768 and 1440 pixels, including assigned-worker
visibility. Full regression/CI and actual live evidence must be recorded before
calling this release deployed. Real provider accounts are not available in the
synthetic tests, so live consent, API grants and delivery require separate evidence.

Local verification: `npm test` passed 73/73 checks; the focused channel, tenant,
connection-health and signed-webhook suites passed 22/22. Manifest, secret scan
and project-memory checks passed. Local Playwright execution is unavailable
because Chromium is absent; responsive browser verification is required in CI.
No real provider write or ad spend was executed.

T-077 checkpoints are in `.claude/project-memory/SESSION_HANDOVER.md`. Resume
from its exact next action; do not reset customer data or repeat a provider write
after a timeout without checking whether it already succeeded.
