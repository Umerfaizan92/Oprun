# 11 Progress state

PROGRESS STATE (2026-11-20):
- [x] AI Receptionist section complete (spec `docs/ai-receptionist/`; live features T-141, T-142, T-143)
- [x] Top 3 competitor analysis (Framer, Webflow, Wix Harmony / Lovable) → [01](01_GAP_ANALYSIS.md)
- [x] Architecture for AI website generator → [02](02_ARCHITECTURE.md)
- [x] Cinematic 3D / WebGL pipeline → [00](00_CONTRACT.md) D-W3, [02](02_ARCHITECTURE.md) §5, [04](04_NEW_SITE_GENERATION.md) §2
- [x] SEO + automated backlink system (white-hat) → [07](07_SEO_BACKLINKS.md)
- [x] New site generation flow → [04](04_NEW_SITE_GENERATION.md)
- [x] Existing site transfer + redesign flow → [05](05_TRANSFER_REDESIGN.md)
- [x] Domain buy / transfer integration → [06](06_DOMAIN_EMAIL.md)
- [x] Business email setup → [06](06_DOMAIN_EMAIL.md) §3
- [x] One-section self-service wizard → [03](03_WIZARD.md)
- [x] Oprun integration points → [08](08_OPRUN_INTEGRATION.md)
- [x] Security, compliance, performance → [02](02_ARCHITECTURE.md) §4–5, [07](07_SEO_BACKLINKS.md) §4, [00](00_CONTRACT.md) §7
- [x] MVP scope + implementation plan → [10](10_IMPLEMENTATION_PLAN.md)
- [ ] Implementation W-01 … W-17 (not started; spec only). Repo tasks: W-01 = T-147 … W-17 = T-163
- Current focus: spec complete and pushed; implementation not started
- Next: W-01 (one Website section, no behaviour change) and W-02 (migrations), after the pending quote-link / review-link work (T-145, backend WIP on branch `wip/quote-accept-review`) is finished and deployed

## Code status (honest)

Nothing in this pack is built yet. What exists today is listed in [00_CONTRACT.md](00_CONTRACT.md) §1. The live
product still shows the 13 separate B06 items and the three placeholder screens until W-01 ships.

## Owner inputs still needed

See [10](10_IMPLEMENTATION_PLAN.md) §5: Cloudflare account + SaaS zone + token, pricing decision, a spare test domain.
