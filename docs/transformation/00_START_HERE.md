# Oprun AI master transformation (second wave): start here

**Latest (26 Nov 2026): the owner's FINAL MASTER TRANSFORMATION brief ([PROMPT_FINAL_2026-11-26.txt](PROMPT_FINAL_2026-11-26.txt))
supersedes earlier instructions. Its audit and the one master backlog are in [07_MASTER_BACKLOG.md](07_MASTER_BACKLOG.md).
Production is read-only until the owner approves (D-088).**

Brief: [PROMPT_ORIGINAL.txt](PROMPT_ORIGINAL.txt) (owner, 23 Nov 2026). This wave builds on the first redesign
programme in [`docs/product-redesign/`](../product-redesign/00_START_HERE.md) (T-167 audit, T-168–T-176 delivered).
It does not repeat that work.

Read in this order:

1. [01_PHASE1_AUDIT.md](01_PHASE1_AUDIT.md): verified current state (Render, Git, memory, pages, security,
   backups) and the KEEP / MERGE / UPGRADE / BUILD / RETIRE classification.
2. [02_BACKLOG.md](02_BACKLOG.md): the implementation backlog, phase by phase, with acceptance criteria that
   include live-UI verification.
3. [03_VISUAL_BLUEPRINT.md](03_VISUAL_BLUEPRINT.md): the visual direction, tokens, components and page patterns.
4. [04_PROGRESS.md](04_PROGRESS.md): the single checkpoint for this wave (what is done, next action, blockers).

Release rule for this wave (from the brief): work happens on `claude/transformation-*` branches. Nothing merges
to `main` (Render auto-deploys it) and nothing reaches production without the owner's explicit approval of that
release.
