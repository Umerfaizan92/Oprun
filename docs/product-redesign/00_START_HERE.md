# Oprun product redesign: start here

The owner's brief (20 Nov 2026) is kept word for word in `PROMPT_ORIGINAL.txt`. Repository task: **T-167**.
This folder is the complete specification. It is plain Markdown in the repository, so Claude, ChatGPT, or any
cloud session can pick it up from GitHub with nothing lost.

| # | File | Required output |
|---|---|---|
| 1 | `01_AUDIT_REPORT.md` | Complete audit: issues by page, what to remove, merge or keep |
| 2 | `02_COUNTRY_ONBOARDING.md` | Australia vs other countries; worker onboarding differences |
| 3 | `03_PAGES_AND_DEVICES.md` | Page-by-page redesign, sequential flows, per-device behaviour |
| 4 | `04_ADVANCED_FEATURES.md` | Website, domain, migration, Social Studio, Campaigns; tools and agents |
| 5 | `05_ADAPTIVE_UI_SYSTEM.md` | Typography, spacing, buttons, sidebar, footer, dropdowns per device and app |
| 6 | `06_LEGAL_SECURITY_BILLING.md` | Legal, security and billing checklist with required wording |
| 7 | `07_IMPLEMENTATION_PLAN.md` | Phases, success criteria, what is pushed first, what the owner provides |
| 8 | This file | Progress state and how to continue |

Related earlier work: `docs/ai-website/` (Website section), `docs/ai-receptionist/`, `docs/design/DESIGN_SYSTEM.md`,
`docs/navigation/`, `mobile/README.md`.

## PROGRESS STATE (updated 20 Nov 2026)

- [x] AI Receptionist section completed (T-143/T-144; send-failure reasons and retry added in PR #144)
- [x] Country-based account creation logic **designed** (doc 02). Code: not started.
- [x] Full product audit completed (doc 01, against commit `4f60bcc`)
- [x] Page-by-page redesign plan, including device adaptation (doc 03)
- [x] Business Setup + Worker Compliance reorganisation **designed** (doc 03 §4–5, doc 02 §4)
- [x] Advanced AI features architecture (doc 04). Website section live; custom domains built but off; Social
      Studio/Campaigns upgrades not started.
- [x] Fully adaptive UI/UX system **designed** (doc 05). Code: not started.
- [x] Legal, security, billing audit (doc 06). Adviser review pending.
- [x] Tool / plugin / agent recommendations (doc 04 §5)
- [x] Final implementation plan + GitHub-ready specs (doc 07)
- **Current focus:** Phase 1 (country-based sign-up and worker documents)
- **Next:** build Phase 1 on a branch, test, push for live testing, then Phase 2 (navigation clean-up)

What is true today: the specification is complete and in the repository. The product is **not yet** adaptive to
the five device classes or open to other countries. Those are built in Phases 1–5. This file is updated at the
end of every phase.

## How to continue in any tool
1. Clone `Umerfaizan92/Oprun` and read `CLAUDE.md` (standing rules) and this file.
2. Run `npm run memory:resume` (Claude Code) or read `.claude/project-memory/PENDING_TASKS.md`.
3. Start at the first unticked item under "Current focus" and follow its phase in `07_IMPLEMENTATION_PLAN.md`.
4. Prompt for ChatGPT or another tool:

> You are continuing the Oprun product redesign. Read `CLAUDE.md` and `docs/product-redesign/00_START_HERE.md` in
> the repository Umerfaizan92/Oprun. Follow its standing rules (no destructive changes, keep every route and
> element ID, approval before customer messages, no secrets in the repo). Implement the phase named under
> "Current focus" exactly as specified, with tests, then update the PROGRESS STATE in that file.
