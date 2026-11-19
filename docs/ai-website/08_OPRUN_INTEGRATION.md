# 08 Oprun integration points and approval gates

## 1. Data that flows into the site

| Oprun source | Site use | Refresh |
|---|---|---|
| `organisations` (name, ABN, logo, colour, timezone) | Header, footer, schema, theme | On change → low-risk draft |
| `onboarding_profiles` (services, service area, phone, brand voice) | Service pages, areas, tone | On change → draft |
| `tenant_receptionist_profiles` (hours, knowledge, appointment type, WhatsApp and photo links) | Hours, FAQ facts, "how it works", contact options | On change → draft |
| AI Receptionist number (`receptionist_provider.number_e164`) | Click-to-call everywhere; `telephone` in schema | On change → low-risk |
| `customer_reviews` (Oprun review links) + `seo_reviews` (Google) | Reviews block, `aggregateRating` only when shown reviews are on the page | Nightly → low-risk |
| Completed `work_orders` the owner ticks "show on website" (photos, suburb, service; never customer names) | Projects block | On tick |
| Unibox / receptionist enquiry questions (anonymised) | FAQ suggestions | Monthly → draft |

## 2. Data that flows from the site into Oprun

| Site event | Oprun record |
|---|---|
| Quote form submitted | Existing path: `pipeline.createEnquiry(org, 'website_form', …)` + Unibox website thread + customer match/create; with T-143 the enquiry gets its `ENQ-` number and the reply drafts go to Approvals |
| Call from the site's number | AI Receptionist intake (T-143): customer, enquiry, approval drafts |
| Visit | Privacy-friendly daily counts (existing `website_visit_counts`) |
| Quote accepted from a link (T-146) | Booking + job in the Job Allocator |

## 3. Approval gates (D-W10)

| Change | Who approves | Mechanism |
|---|---|---|
| First publish of a site or page | Owner / admin / manager with `approvals:approve` | `classifyChange` → automation run `awaiting_approval` |
| Design change, address change, > 20 % words, new claims, sensitive wording | Same | Same |
| Low-risk text fixes, new review, new project, hours | Auto when the business turned on the low-risk rule; otherwise approval | Existing rule `low_risk_site_updates` |
| DNS writes, primary domain switch, email DNS | Owner or admin only | `workspace_approvals` with the record diff |
| Outreach email (Growth) | Owner / admin / manager | `outbound_message` approval, sent from the business's email |
| Export to GitHub | Owner or admin | Explicit button |

## 4. Navigation merge (D-W1)

| Today (B06 item) | Becomes |
|---|---|
| SEO Command Centre, Search visibility | Website → **Search & AI visibility** (top) |
| Technical Audit, Keyword Clusters, Local SEO, Google | Website → Search & AI visibility (sub-tabs) |
| Website Builder, Website Content Studio | Website → **Build** and **Pages** |
| SEO Analytics, SEO Reports | Website → **Reports** |
| Website & Domain (placeholder), Search Connection Request (placeholder) | Website → **Domain & email**; Search Console connect inside Search & AI visibility |
| Backlink Suggestions (placeholder) | Website → **Growth** |
| Connections → Website (TXT verify, form embed, visits) | Stays in Connections (it is a connection); Website → Overview links to it |

All old view ids and `#b06/...` addresses open the new tab; UI test `test:ui` gets a check that every old address
resolves and that B06 shows one item.
