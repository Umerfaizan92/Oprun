# Oprun multi-agent ownership (initial provisional allocation)

Last reconciled: 2026-11-14; source main 7742dec.

| Agent | Scope | File ownership | Rules |
| --- | --- | --- | --- |
| ChatGPT | Coordination, P0 backup investigation, security and backend architecture | docs/coordination/chatgpt.md, docs/coordination/ownership.md, docs/coordination/master-plan.md, docs/coordination/task-registry.json | Read-only production; changes on chatgpt/* branch; no app source modifications until allocated |
| Grok | Product comparison, subscriber self-service journeys, premium UX specs | docs/coordination/grok.md (proposed), design/spec docs on separate grok/* branch | No backend/source edits until assigned; no access assumed |
| Claude | After reset: Messenger/Instagram DM replies and assigned implementation | Separate claude/* branch, exact paths to be reserved per task | Inspect latest main and handovers first; no overlap |
| Independent QA | E2E, security and regression verification | Evidence only, separate qa/* branch | Cannot self-approve; no production mutation |

File ownership is provisional and must be checked against any in-progress external work before new code changes. Do not merge/deploy without owner approval. No destructive operations.
