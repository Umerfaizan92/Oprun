# 09 Tools, plugins and agents

| Need | Choice | Why | Alternative |
|---|---|---|---|
| Copy and structure | Existing `generateAiText` (OpenAI / Gemini) with JSON schemas | Already integrated, metered, provider-switchable | Claude via an OpenAI-compatible host |
| 3D / cinematic | **Three.js** bundled locally, four code presets ([04](04_NEW_SITE_GENERATION.md) §2) | Licence-clean, small, no third-party runtime, works in a static export | VULK or Spline generate React Three Fiber or proprietary scenes; useful for designing new presets offline, not as a runtime dependency |
| Rendering | Existing server-side block renderer | Static HTML, fastest, exportable | Next.js only if a future app-like site needs it (not MVP) |
| Hosting | Render origin + **Cloudflare for SaaS** custom hostnames and CDN | Automatic SSL per domain; 100 hostnames included | Render custom domains (manual per domain); Cloudflare Pages or Vercel for exported copies |
| Domains | **Cloudflare Registrar API in the business's own account** for one-step purchase (D-W15); deep links: **VentraIP** (`.au`), **Spaceship** (built), **Cloudflare Registrar** (gTLDs), Namecheap link only (D-W16); DNS automation with **Cloudflare** or **Porkbun** tokens | Business owns and pays; `.au` needs auDA accreditation | Synergy Wholesale reseller API (later, only with owner approval) |
| Email | **Google Workspace** (A$9.90/user/month annual, A$11.80 flexible, checked 23 Nov 2026), **Microsoft 365**, **Zoho Mail (AU)** with Oprun DNS help; **Cloudflare Email Routing** for free forwarding (D-W17) | Business owns mailboxes; Oprun removes the DNS pain | Google Workspace reseller programme (later; liability) |
| Technical SEO | Existing audit, Search Console, GA4, CWV, URL inspection | Already built | — |
| Content and AI visibility | Existing visibility cluster and keyword plans | Already built | — |
| Link data | Search Console Links CSV; optional business-owned **DataForSEO** key | Free baseline; pay-per-use upgrade with no subscription | Ahrefs or Semrush APIs (expensive tiers) |
| Web search for mentions | Search API through the platform research provider | Finds unlinked mentions | Manual |
| Export | GitHub REST API (business's own GitHub connection) + ZIP | Full ownership | — |
| Testing | `npm test`, node unit tests, `test:ui` (Playwright, system Chrome), `report:a11y-perf` for the speed and accessibility budget | Existing pipeline | — |

## Agents inside Oprun (server jobs, each with approval gates)

Each agent is a queued job on the existing job queue (`src/job-queue.js`), scoped to one organisation, metered (D-W14) and written to the audit log. None publishes, buys, sends or changes DNS without the approval named.

| Agent | Does | Uses | Approval before |
|---|---|---|---|
| **Site Director** | Turns wizard answers and Oprun facts into a page plan, then per-block JSON (zod-validated), style tokens and the cinematic preset | `generateAiText`, `checkClaims`, block renderer | First publish, design changes (D-W10) |
| **Content Keeper** | Nightly diff of Oprun facts (services, hours, areas, reviews, finished jobs) against the site; drafts updates | W-07 sync | Anything beyond low-risk updates |
| **Migration Agent** | Ownership check, polite crawl, inventory, keep/merge/drop proposal, redirect map, pre-switch check, 30-day watch | W-13/W-14, Firecrawl-style crawl via the platform research provider | DNS switch-over |
| **Domain & Email Agent** | Search, live price, purchase (D-W15), DNS diff, email records, verification polling | Cloudflare API with the business token, DNS-over-HTTPS | Purchase, every DNS write |
| **SEO & AI-visibility Agent** | Weekly audit, Search Console gaps, FAQ and page suggestions, llms.txt and schema upkeep | Existing SEO cluster | Content changes |
| **Growth Agent** | Citations checklist, NAP consistency, unlinked mentions, partner and broken-link opportunities, outreach drafts | Search provider, Links CSV, optional DataForSEO key | Every outreach message (daily cap) |

## Tools for building Oprun itself (development time, not runtime)

| Need | Tool |
|---|---|
| Research and competitor checks | Firecrawl (owner's default) |
| Page design quality | `frontend-design` skill, existing design system `saas/ds/` |
| Optional design source | Figma MCP if the owner keeps designs in Figma |
| 3D scene authoring | Three.js code presets; VULK or Spline only as design-time references, never a runtime dependency (licence, cost, speed) |
| Deploy and logs | Render MCP (`list_deploys`, `list_logs`) |
| Browser checks | Playwright with system Chrome (`test:ui`), axe-core, `report:a11y-perf` |
