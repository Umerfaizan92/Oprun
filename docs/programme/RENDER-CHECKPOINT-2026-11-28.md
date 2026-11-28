# Render verification checkpoint — 28 November 2026
Owner: ChatGPT. Parent: INITIAL-CHECKPOINT-2026-11-28.md.
Owner explicitly confirmed My Workspace tea-dajtb13m8hqs739l6v50 for read-only inspection. Primary Render connection used.

## Verified current state
- Production Oprun AI: srv-dbuq98ojo6nc73aro66g, not suspended.
- Latest deploy: dep-dc4rgrg473hc73a0sdgg, status live, exact commit a691cf5e4ec37fcd554f3671d512b5468dd4780e.
- Deploy finished 2026-11-27 17:17:57 UTC / 28 November 01:17:57 Perth.
- Live URL https://oprun-ai.onrender.com.
- Repository Umerfaizan92/Oprun, branch main; automatic deploy on commit ENABLED.
- Build npm ci --include=dev && npm test; start npm start.
- Health check /healthz configured: older A5 is no longer a current finding.
- One Singapore instance, plan 0.5c-512mb, persistent disk 10 GB mounted /var/data.
- main still 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd. Diff from live: scripts/test-site-ui.mjs and SHA256SUMS.txt only (8 insertions, 4 deletions); no runtime code difference in that diff.
- Source render.yaml autoDeployTrigger off does NOT describe current production setting. Do not push main to preserve the no-deploy constraint.
- oprun-test srv-dc1keajl550s73eolqk0 suspended; branch claude/transformation-staging, automatic deploy on commit configured. Do not push staging.
- Legacy paid Oprun srv-dan4rdqjnfac73fceor0 remains not suspended, with its own 10 GB disk. Its data is not inventoried here. No retirement or data operation authorized by workspace confirmation.
- Legacy preview superpro-ai-v2-preview-20261029 is suspended. Older claim that it is running is stale.
- Other unrelated services were not investigated.

## Fresh read-only checks
node scripts/post-deploy-check.mjs https://oprun-ai.onrender.com: exit 0, 6/6 PASS:
health HTTP200; ready database/queue OK; public security headers present; subscriber signed-out HTTP401; operator signed-out HTTP401; sign-in/public pages HTTP200.
No operator token supplied; no full authenticated diagnostics. These six checks do not prove complete RBAC, tenant isolation, backup restoration, payment correctness or live integration operation.
node scripts/memory/validate.mjs PASS; git diff --check PASS before this report.
No deploy, configuration mutation, service suspension, deletion, customer messages, provider generation or payment occurred.

## Remaining / next exact action
PRG-03 source and executable audit continues: establish isolated Node22 dependencies, run tenant/queue/payment/operator tests, inspect queue enqueue callers. PRG-02 remains assigned to Claude; do not edit its runtime/test files concurrently.
Review Claude and Grok reports when provided. Keep old handovers for history; use this checkpoint to supersede their live-state claims.
AWS backup freshness, encryption configuration, production restore drill currency, secret/security-setting values, domain aliases and authenticated integration receipts remain unverified today.
Preserve subsequent batches on codex/programme-audit-20261128 only. No automatic resumption mechanism configured.
