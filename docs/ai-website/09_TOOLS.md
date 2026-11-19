# 09 Tools, plugins and agents

| Need | Choice | Why | Alternative |
|---|---|---|---|
| Copy and structure | Existing `generateAiText` (OpenAI / Gemini) with JSON schemas | Already integrated, metered, provider-switchable | Claude via an OpenAI-compatible host |
| 3D / cinematic | **Three.js** bundled locally, four code presets ([04](04_NEW_SITE_GENERATION.md) §2) | Licence-clean, small, no third-party runtime, works in a static export | VULK or Spline generate React Three Fiber or proprietary scenes; useful for designing new presets offline, not as a runtime dependency |
| Rendering | Existing server-side block renderer | Static HTML, fastest, exportable | Next.js only if a future app-like site needs it (not MVP) |
| Hosting | Render origin + **Cloudflare for SaaS** custom hostnames and CDN | Automatic SSL per domain; 100 hostnames included | Render custom domains (manual per domain); Cloudflare Pages or Vercel for exported copies |
| Domains | Deep links: **VentraIP** (`.au`), **Cloudflare Registrar** (gTLDs); DNS automation with **Cloudflare** or **Porkbun** tokens | Business owns and pays; `.au` needs auDA accreditation | Synergy Wholesale reseller API (later, only with owner approval) |
| Email | **Google Workspace**, **Microsoft 365**, **Zoho Mail (AU)** with Oprun DNS help | Business owns mailboxes; Oprun removes the DNS pain | Google Workspace reseller programme (later; liability) |
| Technical SEO | Existing audit, Search Console, GA4, CWV, URL inspection | Already built | — |
| Content and AI visibility | Existing visibility cluster and keyword plans | Already built | — |
| Link data | Search Console Links CSV; optional business-owned **DataForSEO** key | Free baseline; pay-per-use upgrade with no subscription | Ahrefs or Semrush APIs (expensive tiers) |
| Web search for mentions | Search API through the platform research provider | Finds unlinked mentions | Manual |
| Export | GitHub REST API (business's own GitHub connection) + ZIP | Full ownership | — |
| Testing | `npm test`, node unit tests, `test:ui` (Playwright, system Chrome), `report:a11y-perf` for the speed and accessibility budget | Existing pipeline | — |
