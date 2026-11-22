# 11 Progress state

PROGRESS STATE (2026-11-23, brief v2 — [PROMPT_V2_2026-11-23.txt](PROMPT_V2_2026-11-23.txt)):
- [x] Top 3 competitor analysis (Framer, Webflow, Wix/Lovable) completed → [01](01_GAP_ANALYSIS.md) §0 (refreshed 23 Nov) and §1–4
- [x] Architecture for AI website generator designed → [02](02_ARCHITECTURE.md) (text + mermaid)
- [x] Cinematic 3D / WebGL pipeline specified → [00](00_CONTRACT.md) D-W3, [02](02_ARCHITECTURE.md) §5, [04](04_NEW_SITE_GENERATION.md) §2
- [x] SEO + automated white-hat backlink system designed → [07](07_SEO_BACKLINKS.md), D-W11, D-W18
- [x] New site generation flow specified → [04](04_NEW_SITE_GENERATION.md)
- [x] Existing site transfer + redesign flow specified (SEO equity kept) → [05](05_TRANSFER_REDESIGN.md), D-W8, D-W9
- [x] Domain buy / transfer integration designed (Cloudflare API buy, Namecheap decision) → [06](06_DOMAIN_EMAIL.md), D-W5, D-W15, D-W16
- [x] Business email setup designed (paid mailboxes + free forwarding) → [06](06_DOMAIN_EMAIL.md) §3, D-W7, D-W17
- [x] One-section self-service wizard designed → [03](03_WIZARD.md)
- [x] Oprun integration points defined → [08](08_OPRUN_INTEGRATION.md)
- [x] Security, compliance, performance covered → [02](02_ARCHITECTURE.md) §4–5, [07](07_SEO_BACKLINKS.md) §4, [00](00_CONTRACT.md) §7
- [x] MVP scope + implementation plan written → [10](10_IMPLEMENTATION_PLAN.md)
- [x] Recommended agents, tools, plugins nominated → [09](09_TOOLS.md) (agents table added 23 Nov)
- Current focus: specification complete; 3 of 20 build items done (W-01, W-09, W-18)
- Next: W-03/W-04/W-05 behind `website_builder_v2` (T-149, T-150, T-151)

## Code status (honest, checked in the repository 23 Nov 2026)

| Item | State | Evidence |
|---|---|---|
| W-01 one Website section | **Built, live** | T-147; `saas/workspace-website.js`, `src/website/hub.js` |
| W-02 data | Partly built | `website_domains`, `website_email_setups`, `website_transfers`, `website_redirects`, `website_listings`, `website_link_snapshots`; still to add: generation runs, DNS connections, exports |
| W-03/W-04 build from Oprun facts | Partly built | `POST /api/saas/website/build` writes draft pages from Oprun facts; full wizard, generation service and metering not yet |
| W-09 custom domains | **Built**; switched on only when `CLOUDFLARE_SAAS_*` are set in Render (not confirmed from here) | T-155; `src/website/edge.js` |
| W-11 email | Partly built | Google/Microsoft/Zoho records + MX/SPF/DMARC checks; automatic writes later |
| W-12 buy links | Partly built | Spaceship, VentraIP, Cloudflare links; link checker not yet |
| W-13 transfer | Partly built | Ownership-gated crawl → draft pages + redirect map; keep/merge/drop and switch-over later |
| W-15 growth | Partly built | Listings checklist + Search Console links import; outreach drafts later |
| W-18 llms.txt + AI-crawler setting | **Built** (23 Nov), goes live with the next deploy | T-199; `src/seo/ai-visibility.js`, Website → Growth → AI answer engines |
| W-05, W-06, W-07, W-08, W-10, W-14, W-16, W-17, W-19, W-20 | Not started | Repo tasks T-151…T-163, T-200, T-201 |

Nothing in the "not started" rows may be described to customers as available.

## Owner inputs still needed

See [10](10_IMPLEMENTATION_PLAN.md) §5: Cloudflare account + SaaS zone + token (custom domains), pricing decision, a spare test domain, and for W-19/W-20 a test business's Cloudflare account and token (entered in the app, never in chat).

## Resume

Next session: read [00_START_HERE.md](00_START_HERE.md), then this file, then `PENDING_TASKS.md` (T-149 next).
