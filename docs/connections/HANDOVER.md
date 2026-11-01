# Resume subscriber connections work

Current task: **T-067**, `TESTING`. Implementation is a locally verified candidate; production account consent and live acceptance are outstanding. Do not mark every provider fixed or operational from configuration alone.

Branch: `codex/subscriber-connections-20261101`.
Source base: `83b3066331fd7ba8e14913c1f64661fc50a79d3b`.
Verified live source: `d19a2574e918990e7f4d4836d4c42f53dea34666`.
Live URL: https://super-pro-ai-office-manager.onrender.com/saas/workspace.html#b08/connections

## Start here

Read `CLAUDE.md`, run `npm run memory:resume`, and read `.claude/project-memory/SESSION_HANDOVER.md`, `PROGRESS.md`, `PENDING_TASKS.md`, `MASTER_PLAN.md`, and `DECISIONS.md`. The memory identifies the latest candidate commit and checkpoint; verify `git status` and `git log` independently.

Read `AUDIT-2026-11-01.md`, `OWNER-SETUP.md`, and `VALIDATION.md` in this directory. The audit lists every current card in sidebar/page order, observed live status, supported functions, actual metrics and remaining prerequisites. The screenshots show synthetic local accounts, not production metrics.

## Implemented

- Durable opaque OAuth state bound to browser cookie, active user/session/membership, current permissions, provider and exact callback. Single-use expiry, superseded attempt rejection, PKCE for X and legacy TikTok callback support; Strict main session cookie preserved.
- Correct issued-token expiry handling; refresh and honest reconnect failures. Timeout/redaction/error-envelope handling; partial provider service errors surface instead of being swallowed.
- Independent GSC, GA4 and GTM discovery. Saved Google resources reconcile the existing SEO links, including removal when deselected/disconnected.
- Owner/admin workspace Resend/Telnyx setup, provider ownership verification, encrypted write-only credentials and safe public metadata. Outbound business replies, campaigns, business mail and follow-ups resolve owned credentials; separate legacy platform transport is not labelled as subscriber ownership.
- Signed tenant email/SMS webhook routes with recipient and message ownership checks. Verified out-of-order receipts are queued by workspace, applied idempotently only to matching owned records, and retained seven days. Existing tracking worker retries pending receipts.
- Website HTTPS domain setup and workspace-specific DNS TXT proof, with existing contact-form endpoint and recorded activity.
- Redesigned responsive cards, resource selection, guided redacted troubleshooting, manual/cached sourced figures, unavailable metrics and stale successful figures. Secret inputs clear after successful saving; workspace switching reloads the document.
- Local disconnect never revokes a shared provider grant that could break another workspace or sibling connector.

## Exact next action

1. Review the candidate diff and `VALIDATION.md`. Confirm final commit/tree matches the delivered bundle and patch.
2. Obtain the owner's explicit permission before pushing. The repository rule says: “Never push unless the owner has authorised it and the session has permission.” Do not repeat an automatically rejected publication through another transport.
3. If authorised, push only this feature branch and prepare a reviewable draft PR with the actual support limits. Do not merge or deploy automatically.
4. After the owner reviews and manually deploys, verify the new Render commit and complete the live acceptance checklist in `OWNER-SETUP.md` using separate test workspaces. Preserve the existing Fleet Parlour TikTok authorisation and all existing production data.
5. Record actual provider results and remaining approval/configuration blockers. Keep T-067 in TESTING until the acceptance scope is honestly satisfied.

## Import the delivery artifacts

The delivery includes an incremental Git bundle containing this branch (requires the exact source base in the receiving repository) and a mailbox-format patch relative to the source base. Keep an existing working tree clean; do not overwrite another agent's work.

```sh
git bundle verify /path/to/superpro-connections.bundle
git fetch /path/to/superpro-connections.bundle codex/subscriber-connections-20261101
git switch -c review/subscriber-connections FETCH_HEAD
```

Alternatively, from a clean checkout of the exact source base, apply `superpro-connections.patch` with `git am`. Never apply the patch to an unrelated older deployment. A fresh-clone import and patch/tree comparison are required before delivery and recorded in validation.

## Environment notes

Node 22 is required (native SQLite binding). Dependencies were reused from an existing clean install; no production dependency was added. A temporary external Chromium 153 binary was used for browser checks after the pinned Playwright download repeatedly returned invalid ZIP archives. `UI_CHROMIUM_PATH` supports that fallback without modifying project dependencies or assertions.

The broader `test:ui` stops at a pre-existing sign-in tall-desktop footer assertion, identically reproduced on untouched base 83b3066 with the same browser. Do not weaken it or change the excluded public site to conceal this. Connections-specific checks and the full navigation suite pass; the pinned-browser full UI run remains an acceptance limitation.

Secrets, OAuth grants and provider registration values are stored separately. Never request account passwords in chat or put them in these files. Snapchat Public Profile analytics, Gmail/Outlook mailbox sync and complete per-content analytics for every network are not implemented by this candidate.
