# T-274 / PRG-04 — scoped idempotency and recovery DESIGN

Status: IN_PROGRESS, design proposed for review only. Owner: ChatGPT architecture. Reference queue candidate b85ef4cfcfbc07108d5f8db9f57848bf5afb8378; deployed/base main 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd. No migration executed or implementation ownership changed.

## Contract

Retain existing IDs, literal idempotency keys, organisation/type, payload/result/error, attempts, leases, timestamps and domain links. Current PRG-02 contract deliberately rejects cross-scope collisions with 409. Proposed future contract permits equal literal keys in different tenant/type scopes; this is a versioned behaviour change, not a transparent index swap. Automation prefix lookups must continue to work.

Proposed uniqueness: partial tenant index on (organisation_id,type,idempotency_key) where organisation_id and key are non-null; separate partial platform index on (type,idempotency_key) where organisation_id is null and key non-null. Null keys retain no-deduplication behaviour. No sentinel tenant/coalesce collision. Review empty-string key/type normalization explicitly; do not silently alter historic values.

Enqueue must insert first within transaction, then resolve uniqueness conflict by exact same scope. Nested callers require savepoints and rollback isolation. Specify bounded SQLITE_BUSY handling separately from semantic conflict; never return foreign rows. Genuine two-writer tests must demonstrate two cross-scope rows, one same-scope row, unchanged winning payload, rollback and crash recovery.

## Prerequisites and migration gates

Before any approved build, inventory actual sqlite_master schema, foreign keys, indexes, triggers/views, SQLite versions and all queue producers/readers, including optional followups. Source search alone does not establish production schema. Existing global UNIQUE likely requires reviewed table rebuild. No SQL migration is supplied or authorised here.

Use an expand/contract compatible binary with explicit schema-capability/version startup checks before changing uniqueness. Pause producers and workers, reconcile active leases and external side effects, capture a coherent recovery point, and establish RPO/RTO with owner approval. Transactional copy must preserve every column and row. Verify schema, foreign keys, exact frozen-point row fingerprints, indexes, sequences where relevant, audit chain and domain links before resuming. Do not count a restore that tolerates missing rows as exact migration proof.

The existing synthetic restore drill demonstrates local-file recovery only. The general restore comparison allows a row gap and iterates restored tables, so it cannot independently prove a complete frozen-point migration: require expected table/schema enumeration and exact fingerprints.

## Rollback and recovery

After scoped writes produce duplicate literal keys, old global-unique binaries cannot safely run. Never delete or rewrite jobs merely to restore old uniqueness. Prefer compatible forward repair after new writes; snapshot rollback requires separately approved reconciliation of all post-snapshot writes and external effects. Preserve provider receipts/IDs; never blindly replay payments, messages or claims. Exercise interrupted rebuild, disk exhaustion, worker crash, nested rollback, busy writers and restore before execution approval. No production data copied, migrated, deleted or uploaded by this design.

## Integration verification plan

Await corrected Claude SHA and fresh independent queue acceptance. Keep queue and payment candidate evidence separate. Resolve payment release blockers and independent review first. Then create an authorised isolated combined candidate from exact accepted SHAs, without merging main: run exact conflict/no-leak and true concurrent-writer tests, payment precision/lifecycle tests, authenticated role/export checks, synthetic restore and full Node 22 suite. Regenerate SHA256SUMS.txt after all candidate files/reports; verify manifest and secret scan on that exact final tree. New manifest does not retroactively certify Claude's old tree. No deployment follows automatically.

Next: coordinator reviews contract, compatibility/rollback gates and active file reservations; assign bounded implementation only in a later authorised task. T-274 remains IN_PROGRESS pending design review.
