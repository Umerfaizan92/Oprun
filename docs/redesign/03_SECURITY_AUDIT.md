# Prompt 3 — Security and isolation audit

Scope: repository-level audit on baseline 6615f960 and this PDF implementation. Automated checks use synthetic businesses/provider responses. This is not a certificate of production configuration, provider approval, bank custody security or zero vulnerabilities.

## Prioritised findings and evidence

| Priority | Requirement / finding | Evidence and treatment | Status |
|---|---|---|---|
| P0 | Current membership and tenant context | Existing server authentication and `src/staff-access.js` determine organization and grants; client workspace identifiers are not authority | Existing controls retained; regression tests required in CI |
| P0 | Scoped channel grant could authorize the older broad Growth publisher | Added `canEveryResource` in channel operations and wired legacy Growth authority to it. Resource-restricted staff use the exact-resource Channel Operations draft flow | Fixed; scoped grant, other-business and revoked grant checks |
| P0 | Permission could be revoked while awaiting token refresh / Page token | Recheck approval authority and manual sender publish authority immediately before external POST; selected Facebook Page and confirmed connection must still be current | Fixed; refresh, token and selection race tests for Facebook and X |
| P0 | Missing approval callback must not allow a send | Growth fails closed when current channel authority is absent | Fixed; explicit denial test |
| P0 | Lost response could result in duplicate post on retry | Growth holds unknown delivery as `uncertain`; no timer/manual retry or edit. Network errors, 5xx and successful responses lacking an acknowledgement are held for provider review | Fixed; send-once and uncertain delivery tests |
| P0 | Reviewed payload must not change before send | Existing edits invalidate approval; publishing/published/uncertain records cannot be edited. Exact-resource Channel Operations already uses immutable approval/revision controls | Existing control strengthened; do not treat generic drafts as executable campaigns |
| P1 | Tenant-scoped channel data, drafts, access and campaigns | Existing `scripts/channel-operations.test.mjs`, tenant integration tests and real-server permission matrix exercise cross-tenant denial, selected resources, revision conflict and revocation | Retained, extended and mandatory CI |
| P1 | Founder isolation | Business grants do not authorize Founder routes. Public Operator link retains separate operator authentication | Retained; mobile sign-in and restricted-role tests |
| P1 | Credential encryption | Existing integration token encryption and owned transport secret encryption stay server-side; no credential changes in this release | Source evidence; verify deployed key custody separately |
| P1 | Sensitive notes and bank-detail encryption | Do not infer application-level encryption from encrypted provider tokens. Inventory each sensitive column and deployment disk/backup encryption, then design versioned encryption and key recovery before migration | Open operational/data-classification task; no unreviewed production migration |
| P1 | Audit integrity | `appendAuditLog` in `src/db.js` chains per-business hashes and records actor/time/entity. New blocked/uncertain/published outcomes use it | Existing tamper detection retained; stronger approval payload binding remains next enhancement |
| P1 | Offshore safeguards | Existing workforce eligibility excludes offshore from on-site work; staff scopes remain separate from work-rights records | Preserve existing checks; test actual data access policy before granting sensitive-data scopes |
| P1 | Rate limits / anomalies | Existing auth/OTP/operator/channel/provider limiters; channel operations bind limits to business and member | Existing limits retained. Approval/export-specific anomaly detection and alert thresholds remain roadmap work |
| P1 | MFA and sessions | Existing email/SMS/authenticator flows and separate operator identity retained | No verification bypass or account credential changes; live recovery/provider billing checks still required |
| P1 | Backup / restore | Existing restore drill and Founder Reliability present | Synthetic checks do not prove production recovery. Owner must verify correct primary/backup targets, latest snapshot, restore result, RPO/RTO and key custody |
| P2 | External API reviews / capabilities | Provider and grant checks remain capability-specific; unsupported upload/ads paths stay gated | External review, billing and real consent are separate release gates |

## Concrete server patterns

These illustrate the existing architecture; they are not a second authentication implementation.

```js
// Only a verified server session and current membership establish tenancy.
const org = req.saas.organisation_id;
const row = db.prepare('SELECT * FROM jobs WHERE id=? AND organisation_id=?')
  .get(req.params.id, org);
if (!row) return res.status(404).json({ok:false,error:'Record not found.'});
// Apply feature action permission and record assignment before returning data.

// A role, feature grant and channel grant are distinct evaluations.
requireFeature(req, 'jobs', 'update');
requireAssignment(req, row);
channelOperations.can(req, provider, 'publish', approvedResourceId);

// Recheck after every awaited authorization/preparation step, immediately
// before dispatch. Fail closed and claim the exact approval once.
await prepareProviderCredentials();
assertCurrentMembershipAndResourceGrant();
assertSameApprovedPayloadAndRevision();
claimForDispatch();
await sendExactApprovedPayload();
// Persist confirmed acknowledgement; uncertain responses require reconciliation.
```

All writes need an organization predicate or a previously tenant-validated immutable ID. A request body must not reassign tenant ownership. Bulk IDs must be selected within the tenant; mismatched IDs should not disclose another tenant's metadata. Joins, exports, attachments, search, caches, sockets, signed URLs and worker assignment need the same policy.

For new approvals record actor, membership revision, tenant, action, canonical payload SHA-256, selected provider resource, decision time, execution time, acknowledgement and final outcome. Never store provider access tokens or full secrets in audit metadata. Approval is not an external API acknowledgement. Unknown delivery should require explicit reconciliation rather than a new blind retry.

Encryption changes must use versioned authenticated ciphertext, a separate server key, authenticated tenant/field context, key backup and a tested restore/migration path. Do not expose keys in frontend bundles, errors, logs, project memory or pull requests. TLS is controlled by deployed host and proxy settings; verify it on the live service.

## CI attack and regression matrix

1. Business A cannot read/edit/export/delete B's customer, job, invoice, message, attachment or campaign by substituting IDs or headers.
2. A staff account cannot grant itself permissions or act as owner; a revoked/recreated membership cannot reuse old channel grants.
3. A permitted channel viewer cannot draft/approve/send; a grant for resource X cannot act on Y or use the broad legacy publisher.
4. Approval for draft revision N cannot authorize N+1. Concurrent publish calls dispatch once. Approval revocation during token refresh blocks dispatch.
5. Unknown delivery cannot be retried automatically. Provider errors never show successful delivery.
6. Founder endpoints reject subscriber cookies. Worker UI omits finance/staff management and APIs reject direct requests.
7. OTP expiration, attempt limits, secure cookies, CSRF/origin handling, webhook signatures, replay retention and token redaction stay enabled.
8. Restore a synthetic backup into a fresh isolated database and verify integrity. Never restore test fixtures over production.

Executed evidence is recorded in `VALIDATION.md` and project-memory checkpoints. `npm test` automatically discovers the added `.test.mjs` cases. GitHub CI also runs responsive navigation, existing provider UI, sign-in, finance, SEO, communications and pipeline suites before promotion.
