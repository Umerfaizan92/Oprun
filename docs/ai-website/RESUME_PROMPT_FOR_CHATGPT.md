# Resume prompt (paste into ChatGPT or another coding agent)

```
You are continuing the Oprun AI Website project in the GitHub repository Umerfaizan92/Oprun.

1. Read CLAUDE.md fully and follow it (memory commands, git rules, standing rules).
2. Read docs/ai-website/00_START_HERE.md, then 00_CONTRACT.md (it wins over every other file),
   then 10_IMPLEMENTATION_PLAN.md and 11_PROGRESS_STATE.md.
3. Run: git status; git log --oneline -10; npm run memory:resume. Compare the notes with the code.
4. Take the next item in the order given in 10_IMPLEMENTATION_PLAN.md §4 "Status 23 Nov 2026" (T-199 / W-18 first). Record it with
   npm run memory:task -- add (or status) before editing. One pull request per W-item.
5. Do not invent provider behaviour: re-check provider docs listed in SOURCES.md before coding against them.
6. Verify with npm test, node --test scripts/*.test.mjs, and npm run test:ui (UI_CHROMIUM_PATH if needed).
7. Update 11_PROGRESS_STATE.md and checkpoint (npm run memory:checkpoint) after each item.
Never: buy a domain without the owner's recorded confirmation of name and price, write DNS without owner approval, crawl a site the business has not verified, publish unapproved claims,
add looping animation, touch the Fleet Parlour website, or put secrets in the repository.
Reply to the owner (Faizan) in English.
```
