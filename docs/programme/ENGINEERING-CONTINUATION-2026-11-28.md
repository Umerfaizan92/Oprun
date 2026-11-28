# Engineering continuation checkpoint

The checkout resumed from programme audit commit 1c5eff7722cbfdaad7107abc02834e237874177b and main 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd. Node 22.23.5 satisfies the package and CI requirement for Node 22.x. The repository's default pin remains 22.22.0. Locked installs completed in the audit, queue and integration worktrees using isolated test environments.

| Scope | Evidence |
| --- | --- |
| PRG-02 | a88d777605480fba58aeff2e07f8981773b6a7bc was verified on origin, directly based on Claude candidate 44fb79c30e5a36fc998cb4401f5bd39a6a3f81cf. Independent 10/10 and both queue suites 22/22, exit 0. Candidate manifest's stale queue hash was regenerated on the combined tree. |
| PRG-03 | 86f4589cb1b80a84b457eba49ba122b63f34ee45. Final focused payment, finance and country suites 33/33, exit 0. Exact currency guards remain. Signed charge totals reconcile once and only matching succeeded receipts complete submitted requests. Ambiguous provider responses preserve balances and hold further refund requests for reconciliation. |
| Authenticated export | 80ac23302635c40097eae31ae8261e751d16ffc0. Synthetic real-server JSON and CSV downloads, owner-only access, tenant identifier override, table allowlist, representative credential-field exclusions, attachment headers and audit attribution passed. |
| PRG-04 | 9c6cf3edb279ca7200032547f970913425610547. T-274 reviewed as design only. |
| PRG-08 combined candidate | 22ef8fd95a7772db2a2b688d41b796d7af7a53e8. Selected queue paths match the accepted source byte for byte. Combined focused run 86/86 including local synthetic Litestream v0.3.13 restore, exit 0. Manifest 937 files, secret scan 918 tracked files, release preservation audit and production dependency audit exit 0. Full release run tracked separately on the integration branch. |

Payment remains in TESTING pending fresh independent review. When a webhook has no usable receipt or a provider response gives no identity, the system cannot establish which request completed from the charge total alone. The current hold requires provider reconciliation. Live provider support, actual historic totals, missing provider receipts and timeouts spanning a process crash require separate evidence. Export acceptance uses synthetic tenants and representative fields. It does not attest all customer data or live configuration.

No merge to main, migration for T-274, deployment, live provider operation, or recovery upload occurred. PRG-05 remains reserved, PRG-06 paused, PRG-07 separate, and PRG-09 deferred.
