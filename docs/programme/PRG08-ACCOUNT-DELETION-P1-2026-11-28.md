# PRG-08::ACCOUNT-DELETION-P1

Status: registered for separate allocation and independent acceptance. Source review only, at the PRG-04 independent review baseline dc32b68d6d20be024bbace3551cf8d648a2b18d7. PRG-04 corrections preserve existing governance protections.

## Current workflow and failure

The authenticated owner starts an email verification challenge, confirms the code and explicit deletion phrase, and may cancel during the seven-day window. The scheduled processor selects up to 25 eligible requests. In one SQLite transaction it revokes sessions, removes the organisation, deletes users only when they have no remaining memberships, and records completion. After commit it attempts scoped cleanup of studio and job-evidence uploads. A failed transaction rolls back and leaves a scheduled request with a failure message for retry. See `src/server.js` account deletion handlers and `completeScheduledAccountDeletion`.

`governance_ledger.organisation_id` cascades on organisation deletion. Its unconditional BEFORE DELETE trigger aborts the cascade whenever ledger rows exist. Registration and legal activity can create rows via the shared audit paths. The actor foreign key uses ON DELETE SET NULL, which can also conflict with the unconditional UPDATE trigger when a user is removed while referenced elsewhere. Account deletion requests use SET NULL links. PRG-04 revisions use tenant cascade with a parent-exists guard. Other dependent tables, shared users, files, jobs, provider references and references without SQL foreign keys need a full inventory before any later implementation.

## Retention, privacy and recovery questions

The governance ledger is append-only without a row-level expiration policy in the inspected DDL. Its event hash includes tenant and actor identifiers, entity identifiers and predecessor hash. Changing those fields can invalidate historical proof. The separate audit_logs chain has no tenant or user foreign keys and uses a code-level seven-year retention rule, with some personal fields. The existence of that rule does not settle which governance or audit data must be retained, whether an event hash is still personal data, or how chain verification handles expiration. Legal and contractual review must establish applicable retention classes, lawful basis and minimum scope for employment, money, consent, disputes and legal holds. Review the deletion promise, controller and processor roles, operator access, provider responsibilities and customer disclosures.

Database snapshots, Litestream point-in-time replication, uploads, object versions and Render disk snapshots can outlive active records. Document where each copy exists, lawful and contractual retention, purge/expiration ownership, access restrictions and proof of completion. A restore path needs an approved way to prevent deleted tenants, sessions, uploads and queued effects from becoming active again. Local file cleanup alone cannot establish deletion across replicas. These questions require approved redacted operational evidence and qualified legal review.

## Designs for later review

- Retain a minimal, access-restricted ledger under a documented lawful purpose, with an independently verifiable chain and approved expiration policy. Preserve original hashed content where legally required and isolate any re-identification mapping.
- Use a deliberately specified erasure or anonymisation workflow, with a durable deletion receipt, protected chain anchors and approval for any retention boundary. Prove whether the result is genuinely anonymous and how predecessor and actor references remain verifiable.
- Where deletion is lawful and required, use a bounded lifecycle operation that first quiesces tenant activity and external work, then removes scoped live records and independently tracks asynchronous file and replica treatment. The mechanism needs a separate authorisation design that preserves normal direct-write protections.

## Independent acceptance required

Verify owner authority, challenge and cancellation, scoped effects and truthful request status. Cover synthetic ledger-backed tenants, shared users, actor references, foreign-key and undeclared dependencies, and protection of other tenant rows and permissions. Inject database and storage failures, concurrency and restarts. Require idempotency, audit-chain and legal-hold evidence, separate completion status for storage obligations, and a synthetic restore showing no resurrection or external replay. Obtain sign-off on retention and backup treatment and an independent review before any production action.

No ledger protection, account deletion runtime, production record or backup was changed.
