# 07 SEO, AI visibility and white-hat link growth

The engine already exists (audit, keywords, Search Console, GA4, CWV, local SEO, five-pillar visibility cluster). This
project wires it into the generated site and adds Growth. Nothing here guarantees rankings.

## 1. On-page automation (at generation and every publish)

- One H1 per page with the page's target phrase; titles ≤ 60 characters, descriptions 140–155; unique per page.
- Clean addresses (`/services/bull-bar-polishing`), breadcrumbs, internal links between each service and its areas.
- Structured data as in [04](04_NEW_SITE_GENERATION.md) §3, validated before publish.
- Image alt text from the owner's photo descriptions; never stuffed with keywords.
- AEO/GEO: each service page has a 40–60 word direct answer near the top, real FAQs, clear facts (price-from, area, hours), and an `llms.txt` summary file listing pages and facts.
- `checkClaims` on every text; sensitive wording sends the page to approval.

## 2. Technical SEO (automatic)

- `sitemap.xml` (only 200, indexable, canonical pages) and `robots.txt` per domain; sitemap resubmitted to Search Console on publish when connected.
- Canonicals, `hreflang` not used (single `en-AU`), 301 map ([05](05_TRANSFER_REDESIGN.md)), no redirect chains.
- Core Web Vitals budget enforced before publish ([02](02_ARCHITECTURE.md) §5); field data from the existing CWV link.
- IndexNow ping to Bing on publish (optional key per domain).
- AI crawlers (D-W18): `llms.txt` served at the site root; `robots.txt` has an owner setting **Let AI answer engines read my site** (on by default) and **Block AI training crawlers** (off by default), written as named user-agent rules. Built (T-199): three choices (all / no training / none), owner or admin only, every change in the audit log; `none` also removes `llms.txt`.
- Weekly audit (existing) with fixes offered as drafts.

## 3. Content refresh schedule

| When | What | Approval |
|---|---|---|
| Weekly | Visibility cluster re-run; Search Console queries with impressions but no page → "new FAQ or page" suggestions | Draft only |
| Monthly | One suggested article or service-page improvement per main service, from real enquiry questions | Needs approval |
| Quarterly | Check every page's facts against Oprun (prices, hours, services) and refresh projects/reviews | Low-risk parts auto, others approval |
| Yearly | Privacy policy and About review reminder | Owner |

## 4. White-hat link growth (D-W11)

| Opportunity | How Oprun finds it | What the owner approves |
|---|---|---|
| **Citations** (Google Business Profile, Bing Places, Apple Business Connect, Yelp, True Local, Yellow Pages, Hotfrog, StartLocal, Word of Mouth, industry associations) | Checklist per business type; NAP consistency check (name, address, phone) against each listing the owner links | Owner creates or claims each listing (links provided); Oprun drafts the description |
| **Unlinked brand mentions** | Web search for the business name (Firecrawl/search API) excluding its own site | Polite email asking to add a link |
| **Suppliers, partners, associations, local clubs the business sponsors** | Owner lists them; Oprun finds the right contact page | Outreach email |
| **Broken-link fixes** | Pages on relevant local sites linking to dead pages about the same service (search + HTTP check) | Outreach suggesting the business's page |
| **Digital PR** | Story ideas from real jobs (with customer consent), local news contacts | Pitch email |
| **Lost links** | Comparison of link snapshots | Outreach to restore |

Monitoring sources: Search Console Links export uploaded as CSV (the Search Console API has no links report), and
optionally the business's own DataForSEO key (pay per request, about US$0.024 per Backlinks API task plus a per-row fee,
Nov 2026). Snapshots stored in `growth_link_snapshots`; new and lost links reported monthly.

Outreach rules: from the business's own email connection; only to an address the recipient published for this kind
of contact, with a message relevant to their role (the Spam Act 2003 "conspicuous publication" basis; owner confirms);
the sender's identity and an unsubscribe line in every email; max 10 outreach emails per day per business; at most one
follow-up; every message approved. Oprun is not giving legal advice; the wizard says so and links ACMA's guidance.

Never: buying or exchanging links, private blog networks, automated comments or forum posts, AI-written reviews,
directory spam.
