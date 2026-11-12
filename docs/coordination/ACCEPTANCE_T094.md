# T-094 remaining acceptance and product priorities

Use the 96 IDs in CP-117 `docs/platform-blueprint/requirements.json` unchanged. This is a review overlay, not a replacement status register. Every row below remains OPEN or BLOCKED until its stated evidence exists. Generic requirement wording and menu presence alone are insufficient acceptance.

## Competitive gaps

Reuse CP-117's preserved HighLevel trial audit and source register. Do not repeat external research for this review batch. Benchmarks below are saved comparison goals; no fresh competitor capability, price or universal entitlement is asserted. Revalidate official sources only when implementing or activating a changing contract.

| Saved benchmark | Oprun requirement IDs | Product gap to close | Demonstrable acceptance |
|---|---|---|---|
| HighLevel marketing/agency journey | R04-01–06, R06-01–05, R08-01–06, R12-01–06 | Complete connected journeys, not more channel icons | One contact progresses enquiry → approved campaign/reply → booked job → invoice; consent, provider IDs and status reconciliation retained. Rejected grants and partial outages have recovery. |
| HubSpot governed CRM/agents | R01-02–04, R06-04–06 | Payload-bound approvals and explainable bounded AI actions | Editing approved content invalidates approval; revoked actor cannot send; retrieval excludes another tenant; model/provider unavailable leads to safe draft/error. No unsupported unique-AI claim. |
| Salesforce / Zoho extensibility and coherent suite | R02-01–06, R12-03–06 | Consistent objects, portable history and scoped contracts | Import preview/duplicates/rollback; token scopes; paginated export; signed replay-safe webhook; staff cannot retrieve owner-only objects. |
| Jobber / ServiceTitan / Housecall Pro field/client journeys | R02-06, R03-01–06, R13-01–06 | Reliable field/mobile self-service | Dispatch → worker acceptance → evidence → completion; offline conflict resolution; customer sees only their records. Prove phone/device flows rather than infer them from build assets. |

## Security and server acceptance

R01-01–06 / R15-01–06: test anonymous, owner, admin, manager, worker, contractor, custom grant, revoked grant and operator identities against two tenants. Bind every object to session membership; reject foreign IDs, stale sessions and CSRF. Cover token lifecycle, OAuth state/PKCE as applicable, webhook signature/replay, SSRF/egress, uploads and redacted diagnostics. Preserve exact endpoint, policy, request and result evidence; never include tokens. New locale tests cover only their documented endpoints. SSO/SCIM, penetration testing and restore evidence remain unverified, not implied by baseline labels.

R06-04–05 / R16-02–04: approval covers immutable payload/version/expiry; unknown provider timeout triggers reconciliation, not duplicate purchase/send. Exercise duplicate/out-of-order callbacks, leases, poison jobs and bounded retries. Prove restore and rollback using isolated data. No production drill or migration is authorized here.

## Content and social workflow

R08-01–06 / R04-03–06 / R09-01–05: implement and verify brief → draft → per-channel preview → human approval → schedule → durable execution → provider receipt → delivery/publication reconciliation → analytics with source and freshness. Model content language separately from operator UI language. Keep media rights/alt text/captions, timezone/DST, channel length/media constraints and consent/suppression decisions with the versioned content.

Required failure cases: edit after approval; approval expires; wrong asset/business; grant or staff permission revoked while queued; disconnect between approval and send; invalid media; quota/rate limit; provider timeout with unknown result; duplicate callback; deleted post; partial success across channels. Retry only unresolved destinations with safe idempotency. A local draft/scheduled flag is never evidence of provider publication, paid-ad execution, delivered message or read receipt. Unknown/not-supported statuses stay visible. Do not run live campaigns during verification.

## Integrations

R12-05 / R15-02 / R04–05 / R07–09: distinguish platform app configuration, subscriber consent, selected account/assets, action scope, plan entitlement and last successful capability test. Test account switching, grant expiry/revocation, reconnect, disconnect and deletion. Redact secrets from UI, logs and export. Never ask subscribers for social account passwords. Use the saved 24-entry provider register; credentials/approvals remain deferred and must not be treated as acquired. Each channel/action receives its own capability receipt; connection success does not establish every action.

## Languages and responsive business workspace

R14-01: fix CG-001; two users × two businesses, save/reload, revoked membership, delayed switch and failed saves. Candidate focused tests are evidence only for their current cases.

R14-02–06: extract remaining strings and emails/push/client/legal templates; plural/interpolation tests; per-screen key coverage; explicit fallback metadata; script-aware RTL; mixed-language names/phone/numbers isolated; currency independent of locale; reviewed translations and voice/STT/TTS capability gates. 197 choices must never be described as 197 translated applications.

R13-01 / R13-04 / R14-03: after candidate integration, verify 320/360/390/768/1440, long business/native language names, RTL/LTR, 200% text, keyboard/focus and screen-reader naming. Verify menus, language trigger, notification dialog, bottom sections, form keyboard/safe area, no obscured actions/sideways page overflow. Use current main's density CSS and real pages. Local visual execution is BLOCKED by Chromium launch restrictions.

R13-02–06 / R03-06: actual Android/iOS background push and permission denial/re-enable, muted/urgent settings, sign-out device revocation, deep links, file/audio/camera permissions, secure local data and offline conflict tests. Browser push/code signing assets alone do not prove closed-app voice alerts or store approval. Record device/OS/browser and permission state for every result.

## Operator Console

R01-04 / R15-01–06 / R16-01–06 and CP-117's 15-domain operator-control matrix: evidence-led overview, subscribers/entitlements, billing/usage, connections/provisioning, queues/AI, reliability/backups, releases, incidents/security/privacy, languages/configuration and durable records. Every action has explicit permission, tenant/platform impact, approval where needed, correlation ID, receipt, verified outcome and recovery runbook.

Verify language coverage read permission, subscriber denial, restricted operator denial, no user IDs/secrets in aggregates, honest partial coverage and loading/error states. Test stale configured-only health badges and build SHA accuracy. Destructive/release/provider actions must not execute merely because an operator page exists. Do not replace existing console controls with illustrative health cards.

## Completion gate

Each requirement needs source SHA, surface/route, role/tenant matrix, test result, provider evidence level, unresolved limitation and owner. Separate SOURCE_PRESENT, CANDIDATE_TESTED, UI_OBSERVED, PROVIDER_SANDBOX_VERIFIED and LIVE_VERIFIED. Pilot success/performance/recovery targets in CP-117 are proposed budgets until measured. This review closes no implementation requirement and authorizes no deployment.
