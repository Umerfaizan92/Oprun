# PRG-08 production readiness checkpoint

Read-only evidence gathered 28 November 2026 (Perth) using the previously authorised Primary Render connection for My Workspace and anonymous HTTPS checks. No customer financial records or secret values were retrieved.

## Exact branches and reservations

| Ref or checkpoint | SHA |
| --- | --- |
| main | 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd |
| codex/programme-audit-20261128 | 85f722449774a43d1d16f19ad21e6b9236bf8c05 |
| codex/programme-integration-20261128 receipt | a026c680903d06b06ca00932e038cf9d360a7a4f |
| Combined candidate, direct parent of receipt | 22ef8fd95a7772db2a2b688d41b796d7af7a53e8 |
| claude/prg02-queue-isolation-20261128 | 44fb79c30e5a36fc998cb4401f5bd39a6a3f81cf |
| codex/prg02-acceptance-20261128 | a88d777605480fba58aeff2e07f8981773b6a7bc |
| codex/prg02-independent-review-20261128 | 8d0349c7879b27ffc3b716414ac411ef3091c620 |
| codex/prg06-user-supplied-research-20261128 | 9b024fb2c670f7634d0979880c815ae6840ab196 |

PRG-02 bounded technical acceptance is acknowledged. The audit branch contains the frozen PRG-03 payment candidate 86f4589cb1b80a84b457eba49ba122b63f34ee45. Claude owns independent PRG-03 review. No separate PRG-03 review ref appeared in the remote programme/PRG branch query. Codex owns T-274 and PRG-04 design plus PRG-08 release verification. PRG-05 and PRG-07 implementation remain reserved, PRG-06 is paused pending the archive, and PRG-09 is deferred. This checkpoint is on a separate docs-only readiness branch.

## Observed production state

- Render service Oprun AI, srv-dbuq98ojo6nc73aro66g, is active in Singapore on one 0.5c-512mb instance. It has a 10 GB disk mounted at /var/data, HTTP check /healthz, and auto-deploy on commits to main. Render deploy dep-dc4rgrg473hc73a0sdgg is live at a691cf5e4ec37fcd554f3671d512b5468dd4780e, finished 28 November at 01:17:57 Perth. Git reports only the browser test and manifest differ between the deployed SHA and current main.
- Public smoke passed 6/6, exit 0, with NODE_USE_ENV_PROXY=1. The initial direct Node run returned six transport failures. Independent curl checks returned HTTP 200 for /healthz, /readyz, home and sign-in, and 401 for subscriber session, operator overview, admin integration readiness and operator backup storage. Readiness returned database=true and jobs=true. CSP, Referrer-Policy and X-Content-Type-Options were present. These results establish sampled availability and unauthenticated denial.
- Render app logs for deployment startup reported the S3 backup target selected and Litestream replication starting at 01:17:51 Perth. No bucket or credential values are reproduced. The later backup-log filter returned zero rows, so it yielded no freshness receipt. Readiness reports a database check and queue registration, with no lease or backlog inventory.
- Primary design is on-disk SQLite with continuous off-site Litestream replication and an upload mirror. Secondary designs include daily validated SQLite snapshots, configuration snapshots, monthly copies and Render disk snapshots. The repository runbook describes them, and the attached disk was confirmed. Current scheduled runs, target independence, object timestamps, retention, encryption, access policy and Render snapshot history were not verifiable from these findings. The app's daily and monthly paths can share the primary bucket.
- The Render connector provides service and deployment metadata, not a redacted inventory of effective environment variables. The template specifies expected disk, session, encryption, origin and provider configuration. Running startup and public probes establish only those checks. Operator backup and integration readiness endpoints require authentication. Obtain redacted operator evidence showing effective configuration and missing key names only. Record provider capabilities separately as presence, registered callback/scope, authorised feature and verified operation. No provider was contacted or activated for this review.

## Recovery evidence and release gates

The combined candidate's local synthetic Litestream restore passed within the prior 86/86 focused run. It established local file replica recovery, integrity, audit-chain validation and count checks. There is no current production recovery receipt in the accessible evidence. For operations acceptance obtain a dated redacted object freshness and retention summary for DB, uploads, daily and monthly copies, plus a recent isolated recovery receipt with matching deployment/schema, integrity, audit results, data and upload coverage, and measured RPO/RTO. Runbook targets are DB RPO one minute for recent changes, backup RPO 24 hours for older snapshots, uploads RPO two minutes, DB RTO one hour and full-service RTO four hours. These are targets.

| Gate | Outstanding evidence |
| --- | --- |
| Technical | Claude's independent PRG-03 result and disposition of findings. Record supported currency/provider behavior and validate any resulting candidate change. T-274 implementation gates apply only if a later release includes the migration. |
| Operational | Verified backup freshness and secondary configuration, production recovery evidence, effective environment completeness, provider configuration and capability receipts, plus release capacity/performance sign-off. Startup replication is weaker evidence than successful recoverability. |
| Regulatory | Jurisdiction rules, consent and retention, claims/clinical/trust boundaries and provider review obligations need qualified review where applicable. PRG-06 remains paused. Unverified industry caveats cannot become enabled product claims. |
| Owner approval | Release/deploy approval and separate approval for any live reconciliation, production recovery, migration or provider operation. |

No integration tests were repeated. No protected diagnostics were accessed, production data changed, or runtime implementation modified.
