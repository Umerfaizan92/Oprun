# Connections release — deployed 1 November 2026

This release supersedes the pre-deployment status in the earlier candidate audit and handover. The owner explicitly authorised publication and Render deployment with “push to render”.

- Service: `super-pro-ai-office-manager` / `srv-dan4rdqjnfac73fceor0`.
- Workspace: `tea-dajtb13m8hqs739l6v50`.
- Published and deployed commit: `9a4226fa0eccd0f3ab92827a760ab12cdd1361fe`.
- Exact tested Git tree: `ef7e10c5c984a7d0790f7ed438dbba65b861f7ce`, identical to local candidate `1acc29e`.
- Deployment: `dep-dbjflqc9v7es739vh330`.
- Status verified: **live**.
- Finished: **1 November 2026, 16:43:35 Australia/Perth** (08:43:35 UTC).
- Previous deployment: `dep-dbj02f8ae00c73crpa4g` / `d19a257`.

Git CLI publication lacked command-line write credentials. The connected GitHub integration uploaded the candidate objects; each blob SHA and the final tree SHA matched the local candidate. GitHub assigned a new commit ID because commit metadata changed. Main was advanced without force from `83b3066`, with the expected old SHA checked. The same source was saved on `codex/subscriber-connections-20261101`.

Render auto-deploy remains off. The existing service was manually triggered once, and its returned commit was verified. No service configuration, secrets, disk or infrastructure were changed. Render's build ran `npm ci && npm test` and passed **73/73 checks**. The local candidate additionally passed the optional manifest check (**74/74**), 15 focused security/delivery cases, 576 navigation checks, and the Connections browser/accessibility checks documented in `VALIDATION.md`.

## Post-live checks

All passed:

1. `/healthz` returned HTTP 200.
2. `/readyz` confirmed database/job-queue readiness.
3. Public security headers were present; `x-powered-by` was absent.
4. Signed-out workspace access was refused with HTTP 401.
5. Signed-out founder access was refused with HTTP 401.
6. Sign-in and public home pages loaded successfully.
7. Served `saas/integration-manager.js`, `saas/integration-manager.css`, and `saas/workspace.html` had SHA-256 hashes identical to the tested source files.
8. The post-live error-level application-log query returned zero entries during the verification window.

These checks are read-only. They did not connect/disconnect a provider, send messages, request extra scopes, rotate credentials or inspect subscriber tokens.

## Next work

Deployment task T-068 is complete. Connection/provider acceptance T-067 remains TESTING: subscribers must authorise their own accounts, select resources, and compare available figures with provider dashboards. Platform app approvals/configuration and the explicitly unsupported adapters remain as described in the audit. Preserve the existing Fleet Parlour TikTok authorisation.

Refresh the live Connections page:
https://super-pro-ai-office-manager.onrender.com/saas/workspace.html#b08/connections

Deployment evidence is saved on the separate deployment-record branch so main continues to point to the exact deployed source commit.
