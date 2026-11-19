# 01 Competitor gap analysis: Framer, Webflow, Wix Harmony / Lovable vs Oprun

Researched 2026-11-20 (sources in [SOURCES.md](SOURCES.md)). Vendor terms change often; re-check before quoting them to customers.

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
