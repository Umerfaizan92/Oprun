# Resume social integrations work

Current task: **T-068**, read-only audit of subscriber social connections. Audit delivered 9 November 2026.
No code, configuration, data, provider account or deployment was changed. Nothing is committed or pushed.

Audited source: `main` at `6c548cf705849938cbcbc298ba576c6f2a9af945`.
Production: Render `srv-dan4rdqjnfac73fceor0`, deploy `dep-dbos5d67bikc73a4hd90`, same commit, auto-deploy off.
Live URL: https://super-pro-ai-office-manager.onrender.com/saas/workspace.html#b08/connections

## Start here

1. Read `CLAUDE.md`, run `npm run memory:resume`, and read `.claude/project-memory/SESSION_HANDOVER.md`,
   `PROGRESS.md`, `PENDING_TASKS.md`, `MASTER_PLAN.md` and `DECISIONS.md`.
2. Read `STATUS.md` in this directory in full. It holds the findings (F1–F9), the capability matrix, the blockers
   (B1–B6) and the plan (P0–P4).
3. Read `docs/connections/AUDIT-2026-11-01.md`, `OWNER-SETUP.md` and `VALIDATION.md` for the T-067 work this
   builds on.
4. Check `git status`, `git log --oneline -10` and the Render deploy list yourself. Do not assume `main` is live.

## Corrections to older notes

- `SESSION_HANDOVER.md` and `docs/connections/HANDOVER.md` say the connections branch is unpublished and
  production is `d19a257`. That is out of date. `9a4226f` was pushed and deployed on 1 November 2026, and
  production has since moved to `6c548cf`.
- T-067 is still marked TESTING. Its live acceptance checklist (`docs/connections/OWNER-SETUP.md`) has no recorded
  result. Do not mark it complete from this audit.

## What is established

- Subscribers have one Connect path. Tokens and selected resources are stored per workspace and encrypted. No
  code copies one workspace's token, or the global token, into another workspace.
- A separate single-business layer remains: account-level variables and a global TikTok token file, reachable
  through `/api/tiktok/login` (no sign-in), `/api/social-stats` and `/api/tiktok/status` (public). See F1, F2.
- Redirect-address variables are used unvalidated (F3). No provider is asked for an account chooser (F4).
- Meta, WhatsApp and inbound messaging are only partly built for multi-business use (F5, F6, F7).
- No Fleet Parlour link, handle or account ID is hard-coded.

## What is not established

- The cause of "Invalid application". The text is not in the repository. No log, URL or screenshot was available.
  Candidates and the evidence that would separate them are in `STATUS.md` section 4 and blocker B2. Do not present
  any candidate as the cause.
- Which mechanism sent subscribers to Fleet Parlour details: consent-screen branding of the platform app, a
  redirect variable, or the tester's own browser login.
- Any Render environment value, any provider dashboard setting, any live behaviour.

## Exact next action

1. Ask the owner for blockers B1, B2 and B3 from `STATUS.md` section 6. B1 is one read-only Founder Console
   request (`/api/admin/integration-readiness`) and returns no secrets.
2. With the owner's approval, implement P0 items 1 and 2 only (guard the legacy TikTok login and the two public
   endpoints). Before changing `/api/social-stats`, confirm whether the separate Fleet Parlour website reads it.
3. Add a test that an anonymous request to `/api/tiktok/login` does not redirect to TikTok, and update
   `scripts/route-guards.test.mjs` if the public list changes.
4. Run `npm test`, `node --test scripts/integration-security.test.mjs scripts/integration-tenant.test.mjs`,
   `npm run test:connections-ui`, `npm run security:secrets`, `npm run manifest:update`,
   `npm run verify:manifest`, `npm run memory:validate`.
5. Decide P1 only after B1–B3 are answered.

## Rules for this work

- Preserve Fleet Parlour's existing provider authorisations, the global TikTok token file, production data, the
  Render disk, the integration encryption key and session secrets.
- Do not rotate keys, reset databases, push, merge, deploy, publish content, send messages or spend money without
  the owner's explicit approval for that action.
- Never ask for or record a password, token, app secret or authenticator code. Mask client IDs and OAuth state in
  anything written down.
- Do not touch the Fleet Parlour website.
- WhatsApp and X usage is charged by the provider. Any live test that sends a message or creates a post needs the
  owner's approval first.

## Environment notes

- Node 22 is required. This audit ran no test suite and installed no dependencies.
- The audit workspace could not open the production site or Meta's manual-login documentation page. Render log
  retrieval returned nothing for requests and failed for ranges older than 2 November.
- Documentation in the capability matrix was read on 9 November 2026. Provider rules and prices change; re-check
  before relying on them.
