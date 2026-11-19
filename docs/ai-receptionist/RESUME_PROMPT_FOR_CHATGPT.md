# Resume prompt (paste into ChatGPT, Claude or any AI tool)

Copy everything inside the box into a new chat. If the tool can read GitHub, give it the repository. If it cannot,
upload the `docs/ai-receptionist/` folder (or the zip of it) with the prompt.

```
You are continuing an existing project. Do not start over and do not redo finished work.

PROJECT: Oprun AI Receptionist (oprun.ai), a natural-sounding, self-service AI phone receptionist for Australian
service businesses, built into Oprun's existing approval-first system (Unibox inbox, customers, enquiries, jobs,
approvals).
OWNER: Faizan. Reply in English. Be concise. Use tables where they help.
REPOSITORY: github.com/Umerfaizan92/fleet-office-ai, branch claude/ai-receptionist-spec,
folder docs/ai-receptionist/.

STEP 1 – Read, in this order, before answering anything:
  00_START_HERE.md, 00_CONTRACT.md, 11_PROGRESS_STATE.md, then the files 11_PROGRESS_STATE.md points to.
STEP 2 – Tell Faizan in two sentences where you are resuming and why.
STEP 3 – Continue from "NEXT EXACT ACTION" in 11_PROGRESS_STATE.md.

NON-NEGOTIABLE RULES
1. 00_CONTRACT.md is the single source of names, tables, states and decisions. Use its names exactly. If you need a
   new name, add it to the contract first, then use it. Never create a second name for the same thing.
2. One topic lives in one file. Update that file; never copy its content into another file. No duplicates.
3. Locked decisions (contract §13) change only with measured evidence and Faizan's approval. D-R5 (live-call LLM
   provider) stays open until the Phase 0 bake-off result exists.
4. Approval-first: nothing AI-written reaches a customer unless the owner chose an auto level (contract §8).
5. Honesty: the receptionist never claims to be a person when sincerely asked (D-R7).
6. Never invent facts about the code. If you cannot see the repository, say which facts you could not verify.
7. Never deploy, push to main, change infrastructure, spend money or write secrets without Faizan's explicit yes.
   Secrets are "[stored separately]".
8. A task is complete only with the evidence its acceptance line in 10_IMPLEMENTATION_PLAN.md asks for.

AT THE END OF EVERY RESPONSE, output the PROGRESS STATE block from 11_PROGRESS_STATE.md, updated, with
"NEXT EXACT ACTION" filled in, so the next session (in any tool) can resume from it.
```

## If the repository is not available
Paste the files in this order: `00_CONTRACT.md`, `11_PROGRESS_STATE.md`, then the file for the current task. The
contract alone is enough to keep names consistent; the progress state alone is enough to know what to do next.
