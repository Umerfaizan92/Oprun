# Oprun independent audit — batch 1, 27 November 2026

Status: PARTIAL AUDIT. No implementation, merge, deployment, infrastructure changes, paid AI calls or customer communications authorized by this checkpoint. Current user requires consolidated implementation scope approval and separate explicit production release approval. Prior standing release permissions do not override this request.

## Verified repository and deployment

- Main: 7b3d0946c7aa1e442087fa4f588680c0c275513c.
- Render Oprun AI srv-dbuq98ojo6nc73aro66g: deploy dep-dc42kulbedkc73d1fi9g LIVE, same SHA. Health check /healthz, one Singapore 512 MB instance, persistent /var/data disk. Auto-deploy main: never push audit work there.
- https://oprun.ai redirects in browser to https://www.oprun.ai/; homepage and Business sign-in visually inspected at desktop 1363x936. Actual screenshots included. Render domain ownership/routing binding has NOT yet been independently inspected, so service-to-domain SHA equivalence is not conclusively established.
- Domain read-only deploy check: 6/6 PASS (health, readiness, security header presence, signed-out Business 401, Founder 401, sign-in/public load). Header presence is not a complete security review.
- Existing staging oprun-test suspended. Legacy paid Oprun service still active, auto-deploy off; old preview suspended. Do not resume/suspend/delete services without approval.
- Claude transformation-phase1 two commits ahead of main, documentation/memory only: 79600d2 rejected performance experiment, abb8525 legacy-backup report. No unmerged application implementation found there.
- CP-AUDIT-002 absent from Markdown/text/JSON across 173 unique remote branch tips and commit-message search. It was NOT recovered.

## Authority and reconciliation

ONE task register remains .claude/project-memory/PENDING_TASKS.md, exactly 60 pending tasks. This checkpoint is evidence, not a competing task register. docs/transformation/07_MASTER_BACKLOG.md maps MB scope. Historical handovers are stale; resume this checkpoint and current Git state first.

| Existing requirement | Audit status | Evidence / next action |
|---|---|---|
| T-258 MB-23 whole-platform simplicity | PARTIAL | Four shipped steps and T-265/266 contradict NOT_STARTED parent; independently check all remaining pages before closure |
| T-260 MB-25 codes/email | PARTIAL | T-267 shipped child work; DNS report records missing DMARC and send subdomain issue on 26 Nov; fresh DNS and actual received-message headers still needed |
| T-262 MB-27 translations | PARTIAL | T-268 adds 8 dictionaries; drafts explicitly unreviewed; verify flow coverage/RTL/native speakers |
| T-263 MB-28 industry onboarding | PARTIAL | T-269 reports five-industry tests; independent signed-in browser acceptance needed |
| T-259 MB-24 versioned feature demos | FAIL | No completion evidence; no universal feature-demo registry acceptance |
| T-236/T-261 MB-26 performance | FAIL | Latest existing report 77–84 vs 85 target; independent measurement pending. D095 lazy-script experiment failed to improve and must not be repeated blindly |
| MB-01 Render health path | PASS | Current Render config /healthz; historical A5 is outdated |
| MB-06 old preview suspension | PASS | Current Render service suspended; historical A18 is outdated |
| MB-05 legacy retirement | PARTIAL | Still active; newer branch reports preserved backup, not independently verified here |

## Requirement coverage

| User section | Status | Remaining evidence |
|---|---|---|
| 1 reconciliation | PARTIAL | 60 tasks located; missing CP-AUDIT-002, full historical prompt archive not recovered |
| 2 every-page independent live audit | PARTIAL | Homepage/sign-in screenshots; protected workflows require authorized test accounts; native devices untested |
| 3 complete visual transformation | NOT TESTED | Gold/Black currently visible; approved historical before/after comparisons and competitor benchmarking pending |
| 4 functional transformation | NOT TESTED | Do not infer workflow correctness from builds or code |
| 5 supervisor/specialists | PARTIAL | Root coordinator; reconcile agent read-only; security_review agent read-only; no simulated persistent agent activity or automatic restart configured |
| 6 security/performance | PARTIAL | Findings below; broad tenant/API/webhook/storage tests and restore evidence pending |
| 7 fix/test/release | BLOCKED | Audit incomplete; current consolidated implementation scope and release gates apply |
| 8 continuity | PARTIAL | This Git-backed checkpoint; exact next action below; no unsupported cross-model failover claim |
| 9 safety | PASS for this batch | Read-only production access; docs/evidence only on isolated audit branch |

## Preliminary security findings (source-derived, not exploited live)

| ID | Priority | Status | Finding / affected files |
|---|---|---|---|
| SEC-01 | P1 | FAIL | Workspace clear removes transcript but retains conversation ID; provider can retain same-ID history 6h. saas/product-guide.js:197–200; saas/ai-operations.js:152; src/ai-provider-shim.js:73–77,138–150 |
| SEC-02 | P2 | FAIL | Public Fresh conversation resets UI but not transcript memory/ID. saas/intro.js:384 |
| SEC-03 | P1 | PARTIAL | Public guide accepts client conversation ID with guide prefix but no caller ownership binding; workspace guide also uses public endpoint. src/server.js:2835–2840; saas/product-guide.js:208. Requires synthetic cross-caller reproduction; no breach claim |
| SEC-04 | P1 | BLOCKED | Sensitive-column encryption/key custody inventory not verified against production; historical security audit open |
| SEC-05 | P1 | NOT TESTED | Fresh production backup recovery, RPO/RTO and AWS prefix/key-policy evidence needed |
| SEC-06 | P2 | PARTIAL | scripts/release-security.test.mjs:149–159 checks legacy prefixes; does not prove deployed Oprun AWS policy |

Positive source evidence: active membership checks and selected-organisation membership validation in src/server.js:2250–2271; browser workspace guide memory keys contain org and user; operational AI thread IDs server-generated with organisation namespace. These do not prove complete tenant isolation.

## Independent checks this batch

- Public generated pages current: 23.
- Project memory validator PASS, but only structural; stale handover contents remain a finding.
- Manifest PASS: 918 files.
- AI-memory isolation test 1/1 PASS. It does not test guide endpoint ownership/reset findings.
- npm ci --ignore-scripts installed 266 packages. Runtime Node24 differs from required Node22; native install scripts intentionally not run. Full suite NOT RUN; obtain Node22 isolated runtime before treating native/full-suite results as representative.
- Browser public-page sample navigated 12 destinations; rapid title/URL observations were inconsistent during transitions. That sample is invalid for route correctness and is NOT counted as PASS or a site defect. Recheck stable rendered URLs individually.

## Unchanged-design investigation

No confirmed single root cause yet. Live Render deployment is current main. Main includes incremental improvements, while the major MB23 programme is only partial and MB24 is unfinished. Two newest Claude branch commits are documentation only. Historical Media Studio default-off flags require current production flag and rendered-component verification; do not assert they are off now. Current homepage uses Gold/Black and a geometric hero; Business sign-in uses a separate two-column visual treatment. No cached-asset or service-worker defect proven. Historical screenshots exist under docs/media-studio/previews; compare corresponding current authenticated page, not unrelated homepage.

## Proposed staged scope (not yet an approval request)

1. Finish read-only audit: authenticated Business/Operator/staff, public pages, synthetic tenant security tests, DNS, storage/recovery evidence, actual performance baseline and device coverage. Estimate 2–4 engineering days depending on accounts/provider access.
2. Reconcile parent statuses in canonical register; remediate SEC01–03 with reset/ownership regression coverage. Estimate 1–2 days plus QA, design-dependent.
3. Complete approved MB23 design coverage using exact existing tokens; deliver MB24 versioned demos; measured CSS/performance work for 85+. Estimate must follow page inventory; previous MB estimates are historical, not a fixed quote.
4. Provider/native-device and security acceptance, consolidated release evidence, explicit release approval, safe deployment and live SHA/visual verification.

No additional spend authorized or incurred by app/infrastructure changes. Provider, hosting upgrades and narration costs require a separately priced proposal. No reliable total cost/timeline until authenticated scope is inspected.

## Exact continuation

Securely request an existing authorized Business test-account login on https://www.oprun.ai/saas/sign-in.html (email/password; optional MFA appears only when opened). Do not request credentials in chat. Continue read-only signed-in audit; separately request Operator access later. Do not use real-customer actions. Preserve this branch; do not modify Claude files. Then stable public-page checks, current flags, Render domain binding, synthetic security reproduction and approved-requirement mapping. Present ONE consolidated implementation approval only after reviewable scope exists. Production release needs separate explicit approval.
