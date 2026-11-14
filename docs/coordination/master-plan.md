# Oprun safe delivery master plan

## Invariants
1. Preserve existing code, customer data, production configuration and secrets. No resets, force pushes, destructive migrations or production deployments without explicit owner approval.
2. Git SHA + tests + independent reviewer constitute completion evidence; never rely solely on agent assertions.
3. One agent/branch/file ownership per implementation batch. Review each other's PRs without modifying active files.
4. Commit and push durable checkpoints after each batch, recording exact next action.

## Priority and release gates
P0-001: Fix/verify production S3 uploads backup (E-035), including least-privilege IAM and non-destructive restore drill; blocked on owner AWS authorization.
P0-002: Independently verify tenant isolation, RBAC, auth, token storage, OAuth callback and media fetch protections.
P0-003: End-to-end core enquiry-to-payment workflow with synthetic data.
P1-001: Subscriber self-service integrations via provider-authorized OAuth without requiring subscriber developer API keys; backend APIs remain necessary.
P1-002: Domain search/buy/transfer/DNS/SSL and phone number search/buy/port/AI receptionist, subject to provider agreements and compliance.
P1-003: Full UI inventory and mobile/accessibility/language QA; social/AI/Operator Console completeness.
P1-004: CI, staging, performance, rollback and release approval.
P2-001: Competitor differentiation versus GoHighLevel, HubSpot and Zoho One, without compromising launch gates.

Release NO-GO if P0 defects, unverified backup recovery, critical auth failures or core workflow failures remain.
