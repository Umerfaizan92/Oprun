# 01 Competitor gap analysis: Framer, Webflow, Wix Harmony / Lovable vs Oprun

Researched 2026-11-20, refreshed 2026-11-23 for brief v2 (§0 below; sources in [SOURCES.md](SOURCES.md)). Vendor terms change often; re-check before quoting them to customers.

## 0. November 2026 refresh (brief v2)

Checked on 23 Nov 2026 against vendor pages and an independent 12-builder review dated 2 Nov 2026 (prices are the cheapest plan with a custom domain, billed annually).

| | Framer | Webflow | Wix Harmony | Lovable |
|---|---|---|---|---|
| AI | Agents generate and edit pages on the canvas | AI site builder: up to 5 pages with a design system | Prompt to site, then the Aria agent or drag-and-drop | Chat to code (sites and apps) |
| From | US$10/mo | US$15/mo (site) + workspace, seats, credits | US$17/mo | US$25/mo for 100 credits |
| Export | None (third-party React export plugin US$50–250/mo) | HTML/CSS on paid workspace plans, **without CMS content** | None | Full code, GitHub sync |
| SEO / AI engines | Meta from CMS, canonicals, 301s, sitemap, **llms.txt** | Meta, schema, robots.txt, **llms.txt, AI-crawler access** | Server-rendered, per-page JSON-LD, editable robots.txt; **sitemap not editable** | SSR only for projects since 13 May 2026; older projects serve empty HTML to normal visitors; sitemap not always generated |
| Weakest point for a trade business | Lock-in, no business data | Price complexity, partial export | Lock-in | Generic metadata, no business tools |

**What changed since 20 Nov:** nothing that removes an Oprun advantage. Two things raised the bar, now answered in the contract: `llms.txt` and AI-crawler controls are standard (D-W18), and Cloudflare now sells domains by API, so buying a domain can happen inside Oprun (D-W15).

**Oprun's lead, in one line each**
1. The only builder whose content comes from the business's live records (services, areas, real reviews, finished jobs) and whose enquiries flow straight into customers, Unibox and the AI Receptionist.
2. Full ownership like Lovable (static export with redirects and sitemap, D-W13), with the business tools Lovable does not have.
3. Domain bought, connected, emailed and verified in one screen, including `.com.au` guidance (D-W5, D-W15).
4. Cinematic 3D that cannot break Core Web Vitals (island, poster first, plays once, budget enforced at publish, D-W3).
5. Transfer that keeps rankings: every old URL mapped, checked before switch-over and watched for 30 days (D-W9).
6. White-hat growth with approvals, never bought links (D-W11).

## 1. What each leader does best

| | **Framer** | **Webflow** | **Wix Harmony** (and **Lovable** for code generation) |
|---|---|---|---|
| Positioning | Design-led marketing sites with an on-canvas AI design agent; CMS, hosting, SEO tools and analytics built in | Visual builder with deep layout and CMS control; AI site builder plus SEO/AEO audits, A/B testing and localisation | Wix Harmony: hybrid editor (AI prompting plus drag-and-drop) with the Aria agent and built-in business tools. Lovable: prompt to full-stack code, synced with GitHub |
| Generation | Prompt to editable layers; agents for layout, copy, CMS, SEO | Prompt to site with a design system, new pages and CMS items | Wix: prompt to business-ready site; Lovable: prompt to React code |
| Ownership / export | Hosted only; Framer's help centre says there is no supported export to self-host | Code export exists but leaves out CMS, e-commerce, user accounts and code components (per Webflow's help centre, as reported) | Wix: no code export. Lovable: two-way GitHub sync on all plans; server-side rendering for projects since May 2026 |
| Pricing (2026) | Basic US$10/mo, Pro US$30/mo, AI agent usage by credits (framer.com/pricing) | Per-site plans plus workspace seats (not re-checked for this spec) | Wix premium plans; Lovable credit plans (not re-checked for this spec) |
| SEO | Meta, redirects, indexing controls, analytics | Strongest native SEO controls, SEO + AEO suggestions | Wix: SEO-ready setup; Lovable: SSR helps crawlers |
| Business operations | None after publish (third-party plugins) | None (integrations) | Wix: bookings, stores, Symphony agents; Lovable: none |
| Australia | Generic | Generic | Generic |

## 2. Where all three are weak

1. **The site is separate from the business.** None of them knows the business's real jobs, customers, reviews, enquiries or phone calls. Content goes stale; enquiries land in a separate inbox.
2. **Domain + email is left to the user**, and `.com.au` (auDA eligibility, ABN) is handled poorly or not at all.
3. **Ownership versus convenience:** Framer and Wix lock you in; Lovable gives code but no business tooling; Webflow's export is partial.
4. **"Cinematic" costs speed.** Heavy 3D hurts Core Web Vitals and accessibility unless it is engineered as a progressive add-on.
5. **Backlinks are absent or left to agencies**, and much of the market sells spammy link schemes.
6. **Redesigning an existing site** usually loses rankings because redirects and metadata are not mapped.

## 3. Oprun target: where Oprun wins

| Capability | Framer | Webflow | Wix / Lovable | **Oprun** |
|---|---|---|---|---|
| Prompt to site in minutes | Yes | Yes | Yes | **Yes, pre-filled from Oprun data, so the prompt is mostly already answered** |
| Real business data on the site (services, hours, areas, reviews, projects) | No | No | Partial (Wix apps) | **Yes, live: changes in Oprun flow to the site after approval** |
| Enquiries → customer → quote → job | No | No | Wix forms only | **Yes: quote form → enquiry → Unibox → AI Receptionist follow-up → quote link → booking** |
| Cinematic 3D without slowing the site | Effects, not engineered for CWV | Interactions | Lovable can generate it | **3D island, plays once, poster fallback, CWV budget enforced at publish** |
| Code ownership | No export | Partial | Wix no, Lovable yes | **Static export to the business's GitHub or ZIP, includes redirects and sitemap** |
| `.com.au` domains | Generic connect | Generic connect | Generic | **ABN-aware guidance to an auDA registrar, automatic DNS with the business's own token** |
| Business email | No | No | Wix sells Google Workspace | **Google/Microsoft/Zoho set-up with all DNS records written and verified** |
| SEO / AEO / GEO | Good | Best of the three | OK | **Existing audit + 5-pillar visibility cluster + Search Console + local SEO, plus Australian schema (ABN, areas served)** |
| White-hat link growth | No | No | No | **Citations, mentions, partner links, broken-link fixes, approved outreach** |
| Transfer and redesign with SEO kept | Manual | Manual | Manual | **Ownership-checked crawl, redirect map, metadata carry-over, before/after check** |
| Approval-first changes | Roles | Roles | Roles | **Risk-scored approvals on every publish (existing `classifyChange`)** |
| Phone answering for the site's number | No | No | No | **AI Receptionist already built** |

## 4. Honest limits (do not claim these)

- Oprun will not match Framer or Webflow's freeform canvas in the MVP. Oprun edits are section-based with AI help; pixel-level freeform editing is not planned.
- E-commerce stores are out of scope (Oprun takes payments for quotes and invoices, not catalogues).
- Rankings, traffic or AI citations are never guaranteed.
