# Oprun PDF redesign implementation — T-081

Source: `Oprun_Final_Redesign_Audit_Prompts_2026-11-12.pdf`, read in full. Exact extracted prompt text is preserved in `SOURCE_PROMPTS.txt`. Baseline: main and deployed Render commit `6615f960c357009a409a912b89e02b3af8fa617d`.

## PDF prompt outputs

1. `01_NAVIGATION.md`: seven groups; all 60 Business pages with purposes, working, controls, panels, empty guidance, mobile behaviour and permissions; explicit legacy/deprecation and route migration decisions. All 34 Founder destinations are also mapped with purpose, controls, guidance and mobile rules; their authentication remains separate.
2. `02_DESIGN_SYSTEM.md`: implemented CSS tokens and component examples; before/after Command Centre and Inbox; disclosure, keyboard and mobile rules.
3. `03_SECURITY_AUDIT.md`: prioritised concrete findings, implemented publisher hardening, server/query patterns, attack matrix and honest operational follow-ups.
4. `04_ROADMAP_90_DAYS.md`: user stories, acceptance, security and complexity for all six requested enhancement areas and dependencies.

## Implemented foundation

Seven primary Business groups; retained tools progressively disclosed under More; permission-filtered links connect Work, Inbox, communications setup, campaigns, SEO/site, documents and connections. Unified Inbox is first in Communications. Every existing canonical hash, alias, view, API, form and element ID remains. Context links preserve original controls and unsaved state. Command Centre adds actionable guidance, four key metrics and a shared command entry; the unmeasured hardcoded 7/10 readiness score becomes Setup checklist. Readable responsive typography and spacing are additive.

Older Growth publication now rejects resource-restricted grants, requires independent current approver/manual publisher authority, rechecks access immediately before dispatch, checks confirmed connection and selected Page, fails closed without authority, and holds unknown delivery without blind retries. Existing exact-resource Channel Operations remains available to scoped staff. No external customer message, social post or ad spend is performed by tests.

## Deliberately retained, not falsely marked complete

Real inbox/document-store unification, unified transactional provisioning, full customer timeline, heavy frontend bundle splitting, encryption migration, production backup restoration, real provider reviews/consent, subscriber usability interviews and signed-device/store publication are not completed by relabeling menus. They are explicitly specified with gates in the roadmap and audit. Existing records and legacy interfaces stay usable until those migrations prove parity. No DB reset, credential rotation or infrastructure replacement occurs.

## Resume in ChatGPT or Claude

Read `CLAUDE.md`, run `npm run memory:resume`, then read `.claude/project-memory/SESSION_HANDOVER.md`, `PENDING_TASKS.md`, `PROGRESS.md`, this folder and current git status. Work on branch `codex/redesign-pdf-20261112`, task T-081. Checkpoints retain exact completed steps, tests, remaining steps and recovery refs. The source branch and PR are the portable handover; a local-only recovery ref is not sufficient until the source is published.

Before any retry of a GitHub merge or Render deployment, inspect remote main and existing deploys. Do not recreate infrastructure, duplicate deployment or replay a provider action. Owner explicitly authorizes this source publication/merge/Render deployment after checks. Preserve visible Business-page Operator sign-in and keep Install off that sign-in page. Secrets are stored separately.
