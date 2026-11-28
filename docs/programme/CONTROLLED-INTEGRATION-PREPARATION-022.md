# Checkpoint 022 — controlled integration preparation

Status: source compatibility reviewed. Integration awaits the coordinator's explicit authorisation and independent findings. No candidate was assembled or tested in this checkpoint.

## Preserved refs and reservations

| Remote ref or commit | Exact SHA |
| --- | --- |
| main | 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd |
| Claude queue candidate | 44fb79c30e5a36fc998cb4401f5bd39a6a3f81cf |
| PRG-02 bounded acceptance | a88d777605480fba58aeff2e07f8981773b6a7bc |
| Preserved combined candidate | 22ef8fd95a7772db2a2b688d41b796d7af7a53e8 |
| Prior integration branch receipt | a026c680903d06b06ca00932e038cf9d360a7a4f |
| Independent PRG-03 baseline | 0b86b34c165537862bc0a8053dbfb83f88ec2c47 |
| Tested PRG-03 correction | 09fcd0b2fdd36f1cdb008731fec0f6177eab4685 |
| Frozen PRG-03 checkpoint | 3d00fec369c27924f51f0a2d8bad0dfbb41fe622 |
| Readiness checkpoint | f1db00e50335d401f7c6bfe14373b4a55e49bbb6 |
| Frozen PRG-04 implementation | e8ee5228575d171c1667ec87c2b542df7e68864e |

Git verified the four existing worktrees were clean and tracking their remote heads. Queue acceptance descends directly from the Claude queue candidate. The prior receipt is a direct child of the combined candidate. PRG-03 descends from that candidate through the independent baseline and tested correction. PRG-04 is a direct child of readiness. PRG-03 and PRG-04 share ancestor 9c6cf3edb279ca7200032547f970913425610547. The programme audit checkpoint 85f722449774a43d1d16f19ad21e6b9236bf8c05 adds documentation and its manifest on the readiness line.

PRG-02 bounded acceptance is complete. Claude is reviewing PRG-04, with PRG-03 independent acceptance next. Financial, foundation and review refs remain frozen during review. This preparation owns only its documentation branch. PRG-05 and PRG-07 remain reserved, PRG-06 paused, PRG-09 deferred, and PRG-10–PRG-32 outside scope. T-274 remains design-only.

## Compatibility assessment

| Area | Evidence and future gate |
| --- | --- |
| Files and provenance | The common-ancestor diff comparison found only SHA256SUMS.txt changed on both sides. At 22ef8fd all five accepted queue source, test and evidence paths match a88d777 byte for byte, and PRG-03 preserves them. Financial runtime is confined to payments and finance. PRG-04 owns the two server registration lines, workspace configuration module and test. Readiness adds four documents and a generated manifest. Keep review and receipt artifacts, preserve memory history, and regenerate the manifest after all selected paths are staged. |
| Schema and startup | PRG-02 keeps the existing queue schema. Payments and finance both initialise the same two additive refund tables with idempotent DDL. Finance creates fin_refunds and the refunded_cents column before refund execution. The workspace revision table and triggers are additive. The installer must stay after module rules and onboarding proposal setup because its prepared queries use their legacy columns. Keep the boot graph and validate fresh and pre-change SQLite fixtures. Verify queue timers cannot act on partially initialised finance services. Exercise repeated startup, recovery of in-flight refund claims, and preservation of existing configuration. |
| Mixed versions and recovery | A binary without the new financial claim logic cannot be relied on to honour a durable refund hold. Runtime rollout and rollback require explicit worker/version and lease checks, even though startup DDL is additive. The refund tables reference tenant and payment by stored IDs, while workspace revisions use a tenant foreign key and guarded delete triggers. Verify restoration, table coverage, tenant lifecycle compatibility and receipt preservation with synthetic fixtures. No destructive database action belongs to this plan. |
| Audit | Both features use the existing chained audit store. Verify interleaved staff, owner, automation and provider events on the same synthetic tenant, plus chain verification after restart/restore. Confirm request actor versus approval actor attribution, one authoritative financial effect under replay, and separation by tenant. Test that a failed local state write cannot leave a successful financial or workspace audit assertion. |
| Permissions | Workspace configuration uses authenticated tenant context, owner-only access and a transactional owner recheck. Rollback restores descriptive metadata while live module, staff and provider authority stays in existing stores. Refund reconciliation is owner-only with a membership recheck after provider read. Approval engine and tenant-scoped finance rules stay authoritative. Test denied non-owner and foreign-tenant actions, revocation between read and write, and provider capability metadata without authority or external operation. |

## Integration sequence after authorisation

1. Obtain the independent PRG-04 and PRG-03 dispositions, any follow-up candidate SHAs, and the coordinator's exact integration authorisation. Repeat ancestry and path checks for any changed head. Stop on unexplained code, ownership or schema drift.
2. In a fresh isolated worktree, create a new candidate from preserved combined code 22ef8fd. Bring forward the PRG-03 review and correction line through the independently accepted financial head, using confirmed ancestry. For the currently pinned line this is a fast-forward through 0b86b34, 09fcd0b and 3d00fec. Preserve the old verification receipt as historical evidence and retain its direct parent identification.
3. Apply the readiness delta from 9c6cf3e through f1db00e as documentation, including the earlier audit continuation document. Apply the independently accepted foundation delta from f1db00e through e8ee522 to the server registration, workspace module, test and implementation documentation. Compare each selected path to its source commit. Bring along the prior verification receipt as historical documentation if publishing the new candidate record. Include this preparation record by exact path if needed. Generate the checksum file from the final staged tree. Keep review assertions and original reports intact, and resolve overlapping documentation deliberately.
4. Confirm the final tree still contains the five byte-matched PRG-02 paths, the exact accepted PRG-03 payment/finance code and mandatory checks, and the exact PRG-04 server bootstrap registration, module and tests. Check package-lock identity, reviewed change limits and clean status. Pin the exact candidate SHA before running combined checks. A subsequent executable change creates a new candidate requiring fresh verification.

## Verification matrix for that candidate

Use Node 22.23.5, npm ci, clean environment, synthetic tenants and in-memory or temporary SQLite. Use signed synthetic events and loopback provider stand-ins. Record per-command exit status, counts, skips, faults, exact source and environment.

| Gate | Run and required evidence |
| --- | --- |
| Financial and queue | Run the mandatory PRG-03 suite at qa/programme/prg03-financial-corrections-acceptance.test.mjs, scripts/finance.test.mjs and scripts/programme-payment-currency.test.mjs. Verify refusal, uncertainty, read-only recovery, concurrency, legacy classification and atomicity, with no critical TODOs or skips. Run qa/programme/queue-independent-review.test.mjs and scripts/programme-queue-isolation.test.mjs for strict 409, no disclosure, row preservation, races and Reel Maker rollback. Keep the original reviewer run informational and its historical negative assertions distinct from acceptance. |
| Foundation, database and access | Run scripts/workspace-configuration.test.mjs, scripts/db-schema.test.mjs, scripts/tenant-isolation.test.mjs, scripts/release-security.test.mjs, scripts/country-rules.test.mjs, scripts/module-rules.test.mjs and onboarding interview/proposal suites. Add exact combined synthetic checks where overlap requires them, especially approval revocation, chain verification across both features, restore/restart preservation, and existing tenant behaviour. |
| Whole tree and UI | Run npm test -- --manifest, npm run check:site, release preservation audit against the pinned main baseline, integration and runtime smoke, and Playwright test:ui, test:onboarding-ui, test:finance-ui, test:reel-maker-ui and verify:modules. Exercise existing onboarding proposal approval, portal permissions and tenant export behaviour. Keep generated reports out of the reviewed code diff unless intentionally included. |
| Manifest and secrets | Run npm run verify:manifest, npm run security:secrets and npm run memory:validate on the final staged tree, plus the existing production dependency audit. Record the final manifest scope and clean status. |
| Synthetic backup and recovery | Run scripts/restore-drill.test.mjs with the repository-pinned, checksum-verified Litestream and a local replica. Require no skip. Restore a fixture containing approved workspace revisions, pending and completed refunds and an unacknowledged effect. Verify all expected tables, fingerprints and balances, database and audit integrity, plus no second provider POST after reopening. This is local recovery evidence. Production backup freshness, secondary independence, measured restore evidence and owner approval remain separate gates. |

## Outstanding financial boundaries

- **Credential rotation.** The durable binding fingerprints the original credential, not a stable Stripe account identifier. Rotation can block reconciliation even on the same account. Independent review should decide whether a separately verified re-binding design is required.
- **Stripe Connect.** The contract is for direct accounts. Refund webhook handling excludes Connect events carrying an account identifier. No connected-account routing or approval evidence exists for this candidate.
- **Legacy refunds.** Linkage requires an owner-provided provider refund ID, an evidence reference, matching tenant/payment metadata and no plausibly competing request. Missing metadata, conflicting identities or ambiguous totals can leave a conservative hold. No migration or history rewrite is proposed.
- **Owner attestations.** The owner can attest a separately verified provider rejection after the in-flight interval and complete read exclusion checks. The app cannot authenticate the external support reference. Independent review must assess whether operational verification and segregation of duties suffice.

Next authorised action: await Claude's independent findings. Update only the integration plan if those findings change the required evidence. Assembly requires a separate coordinator instruction.
