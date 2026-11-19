# AI Receptionist: start here

This folder is the complete, implementation-ready specification for Oprun's AI Receptionist. It is written so that
work can stop at any moment (usage limit, new session, another tool) and resume without losing or repeating anything.

## Read in this order

| File | Brief output | What it holds |
|---|---|---|
| [00_CONTRACT.md](00_CONTRACT.md) | Foundation | **The single source** of names, tables, states, decisions. Wins over every other file |
| [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | #1 | Sydney media plane, Singapore control plane, call sequence, fallbacks, latency |
| [02_SETUP_WIZARD.md](02_SETUP_WIZARD.md) | #2 | One AI Receptionist section and the six-step wizard |
| [03_NATURALNESS_PROMPT.md](03_NATURALNESS_PROMPT.md) | #3 | Voice agent prompt, barge-in and backchannel rules, phrase bank, 10 call scenarios |
| [04_TOOLS.md](04_TOOLS.md) | #4 | Exact function-calling schemas and server behaviour |
| [05_LEAD_TO_BOOKING_FLOW.md](05_LEAD_TO_BOOKING_FLOW.md) | #5 | Enquiry → lead → Unibox → follow-up until booked |
| [06_CUSTOMER_MANAGEMENT.md](06_CUSTOMER_MANAGEMENT.md) | #6 | New vs existing customers, fields, de-duplication, consent |
| [07_KNOWLEDGE_AUTOLOAD.md](07_KNOWLEDGE_AUTOLOAD.md) | #7 | What the receptionist knows and how it gets into the prompt |
| [08_SECURITY_COMPLIANCE_METERING.md](08_SECURITY_COMPLIANCE_METERING.md) | #8 | Isolation, Australian law, spam, billing, spend caps |
| [09_MERGE_WITH_EXISTING.md](09_MERGE_WITH_EXISTING.md) | #9 | What stays, merges or is removed from today's code |
| [10_IMPLEMENTATION_PLAN.md](10_IMPLEMENTATION_PLAN.md) | #10 | Tasks R-01…R-20, MVP scope, metrics, what to push first |
| [11_PROGRESS_STATE.md](11_PROGRESS_STATE.md) | #11 | Where the project stands and the exact next action |
| [RESUME_PROMPT_FOR_CHATGPT.md](RESUME_PROMPT_FOR_CHATGPT.md) | Handover | Paste into ChatGPT (or any AI) to continue from the exact point |
| [PRIOR_WORK.md](PRIOR_WORK.md) | Background | Research, competitor gaps and audit checkpoints from the earlier sessions, with sources |
| [PROMPT_ORIGINAL.txt](PROMPT_ORIGINAL.txt) | Brief | The owner's brief, verbatim |

## How progress is saved

1. **This folder** holds the design. It changes only through reviewed commits.
2. **`11_PROGRESS_STATE.md`** is updated at the end of every work block with the exact next action.
3. **Repository memory** (`.claude/project-memory/`, written with `npm run memory:task` and `npm run memory:checkpoint`)
   holds one task per `R-xx` item with status and evidence. `PENDING_TASKS.md` shows the first unfinished one.
4. **Git** is the backup: branch `claude/ai-receptionist-spec`. If pushing is not possible, a `git bundle` and a patch
   are produced and verified, as `CLAUDE.md` requires.

## Rules for anyone continuing (person or AI)
- Read `00_CONTRACT.md` before writing anything. Use its names exactly. Add a name there before using it elsewhere.
- One topic lives in one file. Link to it; never copy it into another file.
- Never mark an `R-xx` task complete without the evidence its acceptance line asks for.
- Never deploy, push to `main`, change infrastructure or spend money without Faizan's explicit approval.
- Reply to Faizan in English.
