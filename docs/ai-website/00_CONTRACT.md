# 00 Contract: the single source of names, data and decisions (AI Website)

Every other file in `docs/ai-website/` must use the names, states and decisions below exactly. If a file needs a name
that is not here, add it here first. If a file disagrees with this contract, this contract wins.

Written 2026-11-20 against `main` at `ca0160b` (merge of PR #140). Research sources are listed in [SOURCES.md](SOURCES.md).

## 1. Ground truth: what already exists (verified by reading the code)

| Area | What exists | File |
|---|---|---|
| Page model + renderer | Block pages (`hero, text, services, areas, faq, cta, contact, image, gallery, reviews`), templates (`service, home, location, about, contact, article`), escaped server-side HTML, one `h1`, brand theme with contrast check, `prePublishChecks`, `classifyChange` (first release, design change, >20 % words, new claims, sensitive wording, address change → approval) | `src/seo/builder.js` |
| Sites, pages, versions | `seo_sites(id, owner_key, slug, name, lang en-AU, brand_json)`, `seo_site_pages(…, status, draft_version, published_version, scheduled_*)`, `seo_page_versions`; publish/rollback/schedule through the automation engine action `publish_site_page` (approval rule `low_risk_site_updates`) | `src/seo/service.js`, `src/seo/routes.js`, `src/automation/catalogue.js` |
| Hosting today | Public pages at `https://www.oprun.ai/sites/:site/` and `/sites/:site/:page`, per-site `robots.txt` and `sitemap.xml`. **No custom domains.** | `src/seo/routes.js` |
| SEO platform | Technical audit + crawl (`robots.txt` honoured), keywords + clusters + plans, content drafts with claim checks, Google Search Console / GA4 / CWV / URL inspection / Business Profile links, local SEO, review-reply drafts, reports | `src/seo/*.js` |
| Modern visibility cluster | SEO, AEO, GEO, AIO, SXO pillars, 5 checks each, weekly re-run, AI drafts saved as drafts only | `src/seo-cluster.js` |
| Website connection | Connections → Website: owner enters an HTTPS origin, proves ownership with a TXT record `_superpro.<host>`; embeddable contact form `POST /api/public/contact/:slug` creates a **website enquiry + Unibox thread**; privacy-friendly visit counts `POST /api/public/visit/:slug` | `src/integration-transports.js`, `src/comms/routes.js`, `src/comms/service.js`, `src/website-visits.js` |
| Business facts | `organisations(name, display_name, abn, brand_primary_color, brand_logo_url, timezone)`, `onboarding_profiles(business_type, phone, website, service_area, services[], brand_voice)`, `tenant_receptionist_profiles(greeting, knowledge, hours, timezone, questions, whatsapp_link, upload_link, appointment_type)` | `src/db.js`, `src/business-hub.js` |
| Reviews | Imported Google reviews `seo_reviews` (real source only). Customer feedback from Oprun review links `tenant_customer_reviews` (T-146, in progress on branch `wip/quote-accept-review`) | `src/seo/service.js`, `src/customer-links.js` |
| Email sending | Per-business Resend sender (verified domain) or Oprun's sender; per-business Telnyx SMS | `src/integration-transports.js` |
| AI | `generateAiText` (OpenAI / Gemini / compatible), claim checker `checkClaims`, `draftText` | `src/ai-provider-shim.js`, `src/seo/content.js` |
| Approvals | `workspace_approvals`, automation engine runs with `awaiting_approval` | `src/server.js`, `src/automation/*` |
| Placeholder screens | `website` ("Website & Domain"), `searchconsole`, `backlinks` are **service-request placeholders** (`tenant_service_requests`), not working features | `saas/portal-workspace.js`, `src/business-hub.js` |
| Navigation today | Group **B06 · Website & Visibility** has 13 items: SEO Command Centre, Technical Audit, Keyword Clusters, Google, Website Content Studio, Website Builder, Local SEO, SEO Analytics, SEO Reports, Website & Domain, Search visibility, Search Connection Request, Backlink Suggestions | `saas/workspace-nav.js` |

## 2. Product names (use these words in the UI and docs)

| Name | Meaning |
|---|---|
| **Website** | The one section that replaces the 13 B06 items. Tabs: **Overview, Build, Pages, Domain & email, Search & AI visibility, Growth (links & listings), Reports** |
| **Site** | One business website (`seo_sites` row). A business may have one live site in the MVP |
| **Build** | Generating a new site, or **Transfer & redesign** of an existing one |
| **Cinematic** | The optional 3D/motion style for the hero and section transitions |
| **Domain** | A hostname the business owns, connected to its Site |
| **DNS connection** | The business's own Cloudflare or Porkbun API credentials, used only to write the records it approves |
| **Business email** | Mailboxes the business buys from Google Workspace, Microsoft 365 or Zoho, set up with Oprun's DNS help |
| **Growth** | White-hat links and listings: citations, unlinked mentions, partner and supplier links, broken-link fixes, digital PR. Every outreach message is approved before sending |
| **Export** | A static copy of the Site pushed to the business's GitHub or downloaded as a ZIP |

## 3. Decisions (D-W1 … D-W18; D-W15–D-W18 added 23 Nov 2026 for brief v2)

| ID | Decision | Why |
|---|---|---|
| D-W1 | **One section.** The 13 B06 items become tabs of **Website**. Old routes (`#b06/...`, view ids) stay as aliases that open the right tab. No element id is removed. Placeholder screens `website`, `searchconsole`, `backlinks` are replaced by real tabs; their pending `tenant_service_requests` stay readable | Owner: zero duplicates, one clean section; CLAUDE.md: every route keeps working |
| D-W2 | **Extend the existing builder, do not start a second one.** Generated sites are the existing block model, rendered server-side to static HTML. New blocks are added (§6). No Next.js app per business | Fast (static HTML, no hydration), cheap, exportable, and CLAUDE.md forbids rewriting the frontend to adopt a library |
| D-W3 | **Cinematic is an island, never the page.** One lazy-loaded Three.js island per page for the hero (and optional section reveals). It plays once on load or scroll, never loops (standing rule: no looping animation), shows a static poster under `prefers-reduced-motion`, on low-power devices and before it loads. Content and LCP never depend on WebGL | Keeps Core Web Vitals and accessibility; satisfies the owner's no-loop rule |
| D-W4 | **Custom domains through Cloudflare for SaaS** in front of the existing Render origin: one custom hostname per Domain, certificates issued automatically, `fallback origin` = Oprun. The Domain stays on the business's own registrar and DNS | 100 hostnames included, then US$0.10 per hostname per month (Cloudflare docs, Nov 2026); no change to `render.yaml` |
| D-W5 | **The business owns and pays for its domain.** Oprun does not resell domains in the MVP. Oprun searches availability, then deep-links to the right registrar: `.au` / `.com.au` / `.net.au` → an auDA-accredited registrar (VentraIP recommended); other extensions → Cloudflare Registrar (at cost) or Porkbun. Transfers use the registrar's own transfer page with the auth code | Same rule as D-R12 for phone numbers: no payment risk or liability for Oprun. Cloudflare Registrar does **not** support `.au` (Cloudflare community, 2026) and its Registrar API beta cannot transfer or renew |
| D-W6 | **DNS: automatic only with the business's own credentials, manual otherwise.** Supported: Cloudflare API token scoped to one zone (`Zone.DNS:Edit`), Porkbun API key + secret. Every write is shown as a diff and approved by the owner; records are checked by live DNS lookup afterwards. Everyone else gets copy-paste records with a live "checking…" status | Least privilege; a wrong DNS write can take email down |
| D-W7 | **Business email is bought by the business** from Google Workspace (from A$9.90 per user per month on an annual plan, A$11.80 flexible), Microsoft 365 or Zoho Mail. Oprun deep-links to signup with the domain filled in, then writes or shows the verification TXT, MX, SPF, DKIM and DMARC records and verifies them. Oprun also offers to connect the same domain to Resend for Oprun's own sending | No reseller liability; DNS help is where people get stuck |
| D-W8 | **Transfer & redesign only for a site the business proves it owns** (existing TXT verification or a file at `/.well-known/oprun-verify.txt`). Crawl politely (robots.txt honoured, rate limited, public pages only). Text and images are reused from the business's own site; never copy another business's site or design | Standing rule: avoid copying others' intellectual property |
| D-W9 | **SEO equity is preserved on transfer:** every old URL gets a 301 redirect map, titles/descriptions/H1s carried over unless improved and approved, and the old sitemap is compared with the new one before switching DNS | Avoid ranking loss |
| D-W10 | **Approval-first publishing** uses the existing `classifyChange`: first release, design changes, address changes, >20 % word changes, new claims or sensitive wording → owner/manager approval. Small text fixes can publish under the business's "low risk" rule. DNS writes, domain switch-over and every outreach message always need approval | Owner: approval-first, zero mistakes |
| D-W11 | **Growth is white-hat only.** No buying links, link exchanges, private blog networks, automated comment or forum posting, or reviews written by AI. Oprun finds opportunities, drafts outreach, the owner approves, the message goes from the business's own email. Monitoring uses Search Console (owner uploads the Links export, the Search Console API has no links report) and optionally the business's own DataForSEO key | Google spam policies; owner: no spam |
| D-W12 | **Real content only.** Reviews only from `seo_reviews` or `tenant_customer_reviews`; project photos only from completed jobs the owner ticks; no invented testimonials, numbers, awards or licences. `checkClaims` runs on every generated page | Standing rule: no invented testimonials |
| D-W13 | **Export = static bundle** (HTML, CSS, images, the 3D island, `sitemap.xml`, `robots.txt`, `_redirects`) to the business's GitHub repo (its own GitHub connection) or a ZIP. Deployable to Cloudflare Pages or any static host. The contact form keeps posting to Oprun | Ownership beyond Framer and Wix (no export) and Webflow (export excludes CMS) |
| D-W14 | **AI generation is metered** as `usage_events kind='website_generation'` and limited per plan; regeneration of one section costs less than a full site | Cost control |
| D-W15 | **One-step domain purchase inside Oprun for gTLDs, in the business's own Cloudflare account** (v2, 23 Nov 2026). Cloudflare's Registrar API (beta since April 2026) can search, check live price and register. The business connects its own Cloudflare account with an API token that has Registrar write permission and DNS edit permission for the new zone; the domain is billed to **that account's default payment method**, never to Oprun. Oprun shows the exact name and price, the owner taps **Buy for A$…/US$…** (a recorded approval), then Oprun calls the API, creates the zone, writes website + email records (D-W6) and starts hosting (D-W4). Not covered by the beta: transfers in, renewals, contact changes, and some extensions (`extension_not_supported_via_api`); those fall back to the deep link. `.au` stays with VentraIP (Cloudflare does not sell `.au`) | Brief v2 prefers Cloudflare; this is the only registrar API that lets each business pay its own registrar with no reseller account, IP whitelist or Oprun-held balance. Registrations are non-refundable, so price confirmation is mandatory |
| D-W16 | **Namecheap: deep link only, no API.** Namecheap's API needs 20+ domains or US$50 balance on the account, plus a whitelisted IPv4 address per account, and bills only from the account balance. That cannot be asked of each small business, and a shared Oprun reseller account would make Oprun pay for and own domains (against D-W5). Spaceship stays as the owner's chosen general buy link (built) | Brief v2 names Namecheap; recorded so it is not re-proposed |
| D-W17 | **$0 email option: forwarding.** Businesses that cannot pay for mailboxes yet can turn on Cloudflare Email Routing (free) for addresses such as `info@` and `quotes@`, forwarded to an inbox they already have. Oprun writes the MX/TXT records with the business's Cloudflare token after approval. It is receive-only; the screen says plainly that replying *from* the business address needs Google Workspace, Microsoft 365 or Zoho (D-W7) | Owner has no budget and the same is true of many first-time businesses |
| D-W18 | **AI answer engines are first-class.** Every published site serves `llms.txt` (business summary, services, areas, contact, key pages), keeps full server-rendered HTML (already true), JSON-LD per page, and an owner-controlled setting for AI crawlers in `robots.txt` (default: allow search and answer crawlers, the owner may block training crawlers) | Framer and Webflow now ship `llms.txt` and AI-crawler controls; Oprun must match and then add live business data |

## 4. States

- `seo_sites.build_status`: `draft → generating → review → approved → live` (+ `failed`, `archived`).
- `website_domains.status`: `dns_pending → verified` (built); `hosting_status`: `waiting → ssl_pending → active` once Cloudflare for SaaS is switched on (W-09).
- `website_email_setups.status`: `records_ready → verified` (built; automatic DNS writes come with W-10).
- `website_transfers.status`: `crawling → imported` (+ `failed`) (built); redesign and switch-over come with W-14.
- `growth_opportunities.status`: `found → drafted → awaiting_approval → sent → won | declined | expired`.
- `website_exports.status`: `queued → building → pushed | downloaded | failed`.

## 5. New and changed data (SQLite, oprun-web)

All rows carry `organisation_id` (or `owner_key` for the existing SEO tables) and are never read across businesses.

| Table | Columns (new) |
|---|---|
| `seo_sites` (add columns) | `build_mode` (`new` / `transfer`), `build_status`, `style_json` (palette, fonts, density, cinematic on/off, scene id), `source_url`, `primary_domain`, `generated_at` |
| `website_generation_runs` | `id, organisation_id, site_id, kind (site/page/section), input_json, status, output_json, model, tokens_in, tokens_out, error, created_by, created_at, finished_at` |
| `website_domains` (built, T-147) | `id, organisation_id, hostname (unique across Oprun), is_primary, status (dns_pending/verified), verify_token, verified_at, hosting_status (waiting until Cloudflare for SaaS is on), last_checked_at, last_result_json, created_by, created_at, updated_at`. Ownership proof: TXT `_oprun.<domain>` = `oprun-verify=<token>` |
| `website_dns_connections` | `organisation_id, provider (cloudflare/porkbun), zone, token_bundle (encrypted, write-only), status, verified_at` |
| `website_dns_changes` | `id, organisation_id, domain, records_before_json, records_after_json, approval_id, status, applied_at, error` |
| `website_email_setups` (built, T-147) | `organisation_id, domain, provider (google/microsoft/zoho), status (records_ready/verified), checks_json, checked_at` |
| `website_transfers` (built, T-147) | `id, organisation_id, site_id, source_origin, status (crawling/imported/failed), pages_found, pages_imported, inventory_json, error, created_at, finished_at` |
| `website_redirects` (built, T-147; served once custom domains are live) | `site_id, organisation_id, from_path, to_path, code (301), source`; primary key `(site_id, from_path)` |
| `growth_opportunities` (planned, W-15) | `id, organisation_id, kind (citation/mention/partner/broken_link/pr/listing_fix), target_name, target_url, reason, status, draft_json, approval_id, sent_at, result_url, checked_at` |
| `website_link_snapshots` (built, T-147) | `id, organisation_id, source (gsc_upload), taken_at, referring_domains, links, top_json` |
| `website_listings` (built, T-147) | `organisation_id, listing, status (not_started/in_progress/listed/needs_fix), url, note`: the citations checklist |
| `website_exports` | `id, organisation_id, site_id, target (github/zip), status, repo, commit_sha, file_count, bytes, created_by, created_at` |

## 6. New page blocks (added to `BLOCK_TYPES`)

`cinematic_hero`, `stats` (only numbers the owner enters), `process` (how we work), `projects` (completed-job photos the owner selects), `pricing` (owner's price list, GST stated), `quote_form` (existing contact form with service + suburb fields), `emergency_banner` (only when the AI Receptionist answers 24/7), `map` (static image + link; no tracking embed), `logos` (licences and associations the owner uploads), `faq_ai` (questions from real Unibox/receptionist enquiries, answered by the owner).

## 7. Things Oprun never does

- Buys, sells or pays for domains, mailboxes or links on a business's behalf (MVP).
- Writes DNS without the owner approving the exact records.
- Crawls a site the business has not proved it owns.
- Publishes AI text, reviews, numbers or claims that were not checked and approved.
- Sends outreach automatically.
- Ships a looping animation.
- Touches the Fleet Parlour website (`fleetparlour.com.au`) without the owner's explicit instruction (standing rule).
