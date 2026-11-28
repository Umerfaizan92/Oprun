# PRG-04 backend foundation implementation

The implementation branch starts directly at the accepted readiness checkpoint f1db00e50335d401f7c6bfe14373b4a55e49bbb6. The combined candidate 22ef8fd95a7772db2a2b688d41b796d7af7a53e8 remains the direct parent of verification receipt a026c680903d06b06ca00932e038cf9d360a7a4f. The frozen audit branch remains at 85f722449774a43d1d16f19ad21e6b9236bf8c05. This slice owns the new configuration installer, its server registration and synthetic regression. PRG-03 financial review remains with Claude. This branch does not include the independently accepted queue changes. T-274 remains design-only.

## Service contract

| API | Behaviour |
| --- | --- |
| GET /api/saas/workspace-configuration | Returns the effective revision and context to the active owner. Revision zero is an unsaved legacy projection and creates no rows. |
| GET /api/saas/workspace-configuration/revisions/:revision | Returns a tenant-local approved revision and historical jurisdiction metadata. The response also shows current context and provider evidence. |
| POST /api/saas/workspace-configuration/approve | An active owner submits expected_revision, expected_context and a complete configuration containing packs and activities. Pack keys and activity keys are unique within the revision. Each activity points to a pack in the same revision. |
| POST /api/saas/workspace-configuration/rollback | An active owner submits the same expected fields and target_revision. The operation appends a new revision based on the earlier activity configuration, using current jurisdiction context. It rejects revision zero, a missing tenant-local target or a current target. |

The authenticated membership supplies tenant and actor. A SQLite immediate transaction rechecks the active owner and both expectations, writes an immutable approved revision and appends a hashed audit record. A stale expectation returns HTTP 409. Context also detects changes in legacy industry, jurisdiction, services, stages and module settings. Approval provides the decision boundary for the submitted configuration. PRG-05 can later supply a proposal workflow without changing that boundary.

Activity packs describe tenant-local activities and references. They grant no authority and have no execution hooks. Existing module settings, onboarding, subscription entitlements, staff grants and provider connections retain their existing stores and enforcement. Unsupported regulated capabilities have no activation field. Jurisdiction metadata references the existing catalogue and flags missing or uncovered context. Existing currency metadata remains separately available where present. A provider catalogue entry or connection record conveys no approval. The provider approval state stays unknown when evidence is unavailable. Provider references are described from live state rather than restored from a historical revision. Rollback cannot restore revoked permissions or connections.

The additive table and append-only rules run at isolated server startup in these tests. Existing tenant deletion can cascade through this table. This work does not deploy the schema, import production data, run T-274 migrations, or start PRG-05, PRG-06 or PRG-07.

## Verification

Linux x86_64 and Node 22.23.5. The focused seven-file run passed 43/43, exit 0, covering the new endpoint, onboarding interview and proposal, module rules, country rules, tenant isolation, and release security. The configuration regression used two real processes and independent SQLite connections to submit concurrent approvals against the same tenant revision. Exactly one returned 201 and the other returned 409. It also verified stale jurisdiction context, cross-tenant isolation, owner demotion and revocation, legacy settings preservation, strict payload validation, immutable history, unknown and unsupported capability metadata, and rollback with revoked staff grants preserved. The separate database-schema suite passed 7/7, exit 0. The fast verification runner passed 69/69, exit 0. No full integration rerun was performed on the preserved candidate.

Release remains subject to independent integration review and the production evidence gates in the accepted readiness checkpoint. Provider approval evidence and regulatory adoption are outside this metadata contract.
