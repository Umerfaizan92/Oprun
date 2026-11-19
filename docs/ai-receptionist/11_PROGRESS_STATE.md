# 11 Progress state

Update this file at the end of every work block. Keep the block below exact so any tool can parse and continue it.

```
PROGRESS STATE (updated 2026-11-19, Perth)
- [x] Research & stack locked (Telnyx Sydney + Pipecat self-hosted Australia + Deepgram Flux + ElevenLabs Flash v2.5 / Cartesia fallback)
- [x] Number provisioning flow
- [x] Competitor gaps (Upfirst, Rosie, Smith.ai)
- [x] Architecture diagram (Sydney media plane)                    → 01_ARCHITECTURE.md
- [x] Knowledge auto-load from Oprun records                       → 07_KNOWLEDGE_AUTOLOAD.md
- [x] Booking + warm transfer tools                                → 04_TOOLS.md
- [x] Naturalness prompt + barge-in rules + 10 call scenarios      → 03_NATURALNESS_PROMPT.md
- [x] One-section self-service wizard                              → 02_SETUP_WIZARD.md
- [x] Inquiry → Lead → Unibox → Follow-up until booking flow       → 05_LEAD_TO_BOOKING_FLOW.md
- [x] Customer create/update logic                                 → 06_CUSTOMER_MANAGEMENT.md
- [x] Security, compliance, usage metering                         → 08_SECURITY_COMPLIANCE_METERING.md
- [x] Merge with existing OpenAI features                          → 09_MERGE_WITH_EXISTING.md
- [x] MVP scope + implementation plan                              → 10_IMPLEMENTATION_PLAN.md
- [ ] Spec reviewed and approved by Faizan (group audit)
- [ ] R-01 (T-121) oprun-voice skeleton (Phase 0)
- [ ] R-02 (T-122) Sydney latency + naturalness bake-off; close D-R5
- [ ] R-03 … R-20 (T-123 … T-140, see 10_IMPLEMENTATION_PLAN.md and .claude/project-memory/PENDING_TASKS.md)
- Current focus: Spec complete; waiting for owner/group audit
- Next exact action: Faizan reviews the spec pack (or gives it to the audit group). Then: open the PR for branch
  claude/ai-receptionist-spec (docs only), and start R-01 in a new folder voice/ once Telnyx staging number and
  Deepgram/ElevenLabs/Cartesia/AWS access are provided.
- Blockers: Owner must provide: Telnyx staging number + Call Control app; Deepgram, ElevenLabs, Cartesia keys; AWS
  Sydney access; add-on price and included calls per plan.
- Decisions made: D-R1 … D-R10 in 00_CONTRACT.md §13 (D-R5 open until the bake-off)
- Repository: Umerfaizan92/fleet-office-ai, branch claude/ai-receptionist-spec (docs only, not pushed yet)
```

## Change log
| Date | What changed | By |
|---|---|---|
| 2026-11-19 | Full spec pack written (00–11), contract created, merge plan against the real code, tasks R-01…R-20 | Claude |
| 2026-11-19 | Audit: unified tool enums, booking_rules_json shape (contract §5.1), retention/cap/block-list/caller_note names, fixed broken links, stopped the booking event being handled twice; tasks recorded as T-121…T-140 | Claude |
