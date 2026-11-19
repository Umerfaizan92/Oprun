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
- [x] W-01 one Website section (T-147): nav group `website/*`, old `b06/*` and `growth/seo*`/`growth/website-*` addresses kept; placeholder screens point to it
- [~] W-02 data (T-148): website_domains, website_email_setups, website_transfers, website_redirects, website_listings, website_link_snapshots built; DNS connections, exports, generation runs still to come
- [~] W-03/W-04 build from Oprun facts with AI wording (drafts only; no cinematic yet)
- [~] W-09 domains: add + TXT ownership check + live DNS check built; serving on the custom domain waits for Cloudflare for SaaS (owner input)
- [~] W-11 email: Google/Microsoft/Zoho records + MX/SPF/DMARC checks built; automatic writes later
- [~] W-12 buy links: Spaceship (owner's choice), VentraIP for .au, Cloudflare
- [~] W-13 transfer: ownership-gated crawl → draft pages + redirect map built; keep/merge/drop screen and switch-over later
- [~] W-15 growth: listings checklist + Search Console links import built; outreach drafts later
- [ ] W-05/06/07/08/10/14/16/17 not started. Repo tasks: W-01 = T-147 … W-17 = T-163
- Current focus: first Website section shipped (T-147); next W-09 custom-domain hosting once the owner provides Cloudflare
- Next: W-01 (one Website section, no behaviour change) and W-02 (migrations), after the pending quote-link / review-link work (T-145, backend WIP on branch `wip/quote-accept-review`) is finished and deployed

## Code status (honest)

Built so far is marked above and in [00_CONTRACT.md](00_CONTRACT.md) §5 ("built"). Everything else is still a plan.

## Owner inputs still needed

See [10](10_IMPLEMENTATION_PLAN.md) §5: Cloudflare account + SaaS zone + token, pricing decision, a spare test domain.
