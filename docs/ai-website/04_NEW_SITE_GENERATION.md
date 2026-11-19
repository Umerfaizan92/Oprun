# 04 New website generation

## 1. Prompt structure (one call per page, JSON out)

System prompt (fixed, versioned in `src/website/prompts.js`):

```
You write website copy for an Australian small business. Australian English. Plain, specific, friendly.
Use ONLY the facts provided. If a fact is missing, leave the field empty; never invent prices, years in business,
numbers of customers, awards, licences, guarantees, reviews or testimonials.
Return JSON matching the schema for each block. No HTML. Headings under 60 characters, meta description 140-155.
Every page answers: what you do, where, for whom, how to get a quote, and one reason to trust you (from the facts).
Write 2-4 FAQ answers only from the FAQ facts given.
```

User content (data, delimited, never instructions):

```json
{ "business": {"name","abn","phone","email","address","mobile_service":true,"hours","licences":[],"difference"},
  "services": [{"name","description","price_from_cents","gst_included"}],
  "areas": [{"suburb","state","unique_fact"}],
  "reviews": [{"source":"google|oprun","rating","text","first_name"}],
  "faq_facts": [{"q","a_owner"}],
  "page": {"template","target_phrase","style":"clean_trade"} }
```

Output is validated with zod per block type; anything that fails validation is regenerated once, then left empty for the owner.

## 2. Cinematic options (D-W3)

| Preset | Look | Used by |
|---|---|---|
| `polished_metal` | Slow camera move across a brushed-metal surface catching light, ending on the headline | Detailing, fabrication, automotive |
| `light_trails` | Headlight streaks resolving into the logo | Transport, fleet, mobile services |
| `blueprint` | Line drawing assembling into a building or room | Builders, electricians, plumbers |
| `soft_particles` | Calm particles settling into the brand colour | Clinics, cleaning, professional services |

Rules: plays once (≤ 4 s) on first view or scroll into view; stops on the final frame; respects
`prefers-reduced-motion`; disabled on `saveData`, low device memory (< 4 GB) and when WebGL is unavailable; the poster
(a rendered still of the final frame, AVIF) is the LCP image. Scenes are code presets with brand colour and logo as
parameters, so they are always licence-clean.

## 3. Default pages for Australian trades and service businesses

| Page | Template + blocks | Notes |
|---|---|---|
| Home | `cinematic_hero` or `hero`, services, process, projects, reviews, areas, cta, quote_form | One H1 with service + main area |
| One page per service | service: hero, text, pricing (if given), process, faq, quote_form | Target phrase: "{service} {main area}" |
| Service areas | areas list page + **optional** one page per main suburb with a unique fact | No thin doorway pages; max 10 at launch |
| Projects | projects (completed jobs the owner ticked, photos + suburb + service) | Customer names never shown |
| Reviews | reviews (real only, source named) + link to leave a review | Hidden if there are no reviews |
| About | hero, text, logos (licences/associations uploaded), stats (owner numbers only) | |
| FAQ | faq_ai from real enquiries, answers by the owner | |
| Contact / Get a quote | quote_form, map, hours, phone (receptionist number), emergency_banner if 24/7 | Form posts to the existing `/api/public/contact/:slug` |
| Privacy policy | Generated from Oprun's template for the Australian Privacy Principles, filled with the business's details | Owner must approve; marked "check with your adviser" |
| Terms (optional) | Owner text | Never generated as legal advice |

Structured data on every page: `LocalBusiness` (or a more specific type) with `name, telephone, address or
areaServed, openingHoursSpecification, priceRange` only if given, `sameAs` (Business Profile, socials), and
`identifier` with the ABN; `Service` per service page; `FAQPage` where FAQs exist; `BreadcrumbList`.

## 4. Live data from Oprun (after publish)

| Oprun change | Site effect | Approval |
|---|---|---|
| New 4–5★ review with consent to show it | Added to Reviews block | Low risk (auto under the low-risk rule) |
| Owner ticks a finished job for the site | New project card | Low risk |
| Hours or phone changed in Oprun | Contact block and schema updated | Low risk |
| New service added | Draft service page created | Needs approval (first release) |
| Price list changed | Pricing block updated | Needs approval (claims) |
| AI Receptionist set to 24/7 | Emergency banner offered | Needs approval |

A nightly job compares facts with the published version and queues these updates as drafts; nothing goes live silently
except low-risk changes the owner allowed in Settings → Approvals.
