# Oprun PDF redesign — release handover

Owner authorised implementation of the uploaded PDF, source publication, merge and deployment to the existing Render service after passing checks. The PDF's four prompts are implemented as the complete mapping, design system, security audit and specified 90-day roadmap, with the additive UI/security foundation in production source. A roadmap specification does not mean every future enhancement is built.

## Source and evidence

- Implementation PR: https://github.com/Umerfaizan92/Oprun/pull/75
- Tested candidate: `699f6a62af02d5b2533140bcb5b086bfb7e78179`.
- Merged production source: `1cbe8e1fb20b4bcb349eca384883f60ce5324c99`.
- Tested and merged tree: `a63860f23d4d6a1e17378e5081732fb4c8decbf8` (identical).
- CI: https://github.com/Umerfaizan92/Oprun/actions/runs/43093033069 — success.
- Security: https://github.com/Umerfaizan92/Oprun/actions/runs/43093033333 — success.
- Build checks 73/73; general UI 34/34; navigation 584 checks covering 60 Business and 34 Founder destinations at phone/desktop, role isolation, save lifecycle, history and keyboard.
- Additional three-width (390/768/1440) dark/light component and workflow accessibility checks; channel/connection/mobile/public-site/pipeline/console/automation/SEO/comms/finance/reliability suites all passed. Dependency gate reported zero vulnerabilities.
- Fresh navigation coverage is preserved in `qa/reports/navigation-coverage.json`; browser screenshot artifact 13890122007 belongs to the passing CI run. Screenshots were visually inspected on phone, tablet and desktop.
- Deployment is confirmed live at 2026-11-11 20:18:09 UTC. Readiness/auth/header checks passed; nine live source hashes match; a live browser workspace visit redirects to sign-in with Operator visible and no Install option. Full evidence is in `RELEASE_RECORD.json`, `LIVE_ACCEPTANCE.json` and `VALIDATION.md`.

## Preserved implementation

Seven Business navigation groups with all old routes/aliases and controls retained; secondary tools under More; permission-filtered Work, Inbox, campaign, SEO, documents and setup context links; guided Command Centre; responsive tokens and shared command entry. Existing live overview cards remain; the workforce metrics panel retains expiry detail. Founder identity and all 34 destinations remain separate. Operator sign-in remains visible on Business sign-in, which has no Install option.

Legacy Growth publishing now fails closed without current channel authority, rejects resource-restricted grants for its broad destination model, independently checks manual publisher authority, rechecks approver/connection/account selection immediately before dispatch, and holds unknown delivery without automatic retry. Scoped staff retain the exact-resource Channel Operations flow. Background regulatory and presence requests no longer affect form save acknowledgement. Failed saves and edits after submission retain unsaved-change protection. Footer placement and wrapped header height were corrected after browser evidence.

No database reset, credential rotation, production-data migration, infrastructure replacement or store submission was performed. Tests used isolated synthetic businesses and provider fixtures; no real customer send/post/ad-spend acceptance test was performed.

## Exact continuation procedure

1. Check out `codex/redesign-release-evidence-20261112`; read `CLAUDE.md`, run `npm run memory:resume`, and read `.claude/project-memory/SESSION_HANDOVER.md`, this file and `RELEASE_RECORD.json`.
2. Verify remote main and the current Render deployment before retrying any external action. Existing service `srv-dan4rdqjnfac73fceor0`, deploy `dep-dbqcp1c9v7es73c7bu4g`, uses main and has automatic deployment off. Do not trigger a duplicate deploy or replace its disk/configuration.
3. This branch adds documentation/memory/QA evidence after the tested source merge. It requires no extra application deployment. Start new application work from current main and carry this evidence forward.
4. Resume the first agreed unfinished roadmap item rather than repeating T-081. Read `04_ROADMAP_90_DAYS.md`, `03_SECURITY_AUDIT.md` and the existing pending-task list. Do not silently reinterpret older unrelated tasks as complete.
5. Save full source and checkpoints before limits. Publish recoverable work on its own branch; local recovery refs alone are not portable. Never put credentials in a bundle, commit, test output or handover.

## Deliberate follow-ups / open questions

- Real inbox and document-store unification, canonical financial migration, archive-filter migration and a transactional communications setup wizard need reconciled, reversible data migrations; context links do not pretend to perform them.
- Unified customer timeline, expanded AI task orchestration, more detailed eligibility explanations, health summaries, field/offline job improvements and heavy-bundle splitting remain specified roadmap work.
- Sensitive-note/bank-field encryption classification and migration, production backup restore evidence, and approval/export anomaly detection remain explicit audit follow-ups.
- Provider scopes/review/billing and real subscriber consent are external gates. Unsupported uploads and paid-ad launches remain gated. Native signing, signed-device acceptance and app-store review are separate release steps.
- Owner-arranged 3–5 subscriber usability sessions remain recommended; no customers were contacted.
- No new user decision is required to preserve or resume this completed foundation. Select the next roadmap epic before starting a separate record migration or provider rollout.
