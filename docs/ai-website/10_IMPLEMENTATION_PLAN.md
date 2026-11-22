# 10 Implementation plan, MVP scope and metrics

Each work item becomes one task in `.claude/project-memory/PENDING_TASKS.md` (IDs recorded in [11](11_PROGRESS_STATE.md)).
One pull request per item; `npm test`, unit tests and `test:ui` must pass; Render deploys from `main`.

## 1. Phases

### Phase A: One section, no new behaviour (safe first push)

| ID | Work | Acceptance |
|---|---|---|
| W-01 | `saas/workspace-website.js`: **Website** section with 7 tabs that mount the existing SEO views; B06 shows one item; every old view id and `#b06/...` address opens the right tab; placeholders `website`, `searchconsole`, `backlinks` show what is coming instead of a request form, and existing requests stay listed | `test:ui`: every old address resolves; B06 has one item; no element id removed; phone/tablet/laptop screenshots |
| W-02 | Data migration: new columns on `seo_sites` and new tables ([00](00_CONTRACT.md) §5), lazy and additive | `npm test` migration check; no existing row changed |

### Phase B: Generate and publish on the free address

| ID | Work | Acceptance |
|---|---|---|
| W-03 | Wizard steps 1–4 and 8–9 for **new** sites, pre-filled from Oprun | A test business with services and areas reaches Review in under 10 minutes |
| W-04 | Generation service (`src/website/generate.js`): page plan, per-block JSON, zod validation, claim checks, metering `website_generation` | Unit tests: no invented facts with empty inputs; invalid JSON retried once; usage counted |
| W-05 | New blocks ([00](00_CONTRACT.md) §6) in the renderer with escaping and accessibility | Renderer tests for each block; one H1; axe-clean in `report:a11y-perf` |
| W-06 | Cinematic island: Three.js bundled, 4 presets, plays once, poster fallback, reduced-motion and low-power rules | LCP is the poster; no animation after 4 s; reduced-motion shows the poster only; budget check passes |
| W-07 | Live Oprun data sync (nightly diff → drafts / low-risk updates) | A changed phone number appears after approval; a new review appears automatically when allowed |
| W-08 | Speed budget check added to `prePublishChecks` | Over-budget pages cannot publish without the owner accepting the warning |

### Phase C: Domains and email

| ID | Work | Acceptance |
|---|---|---|
| W-09 | Cloudflare for SaaS: custom hostnames API, host middleware, status polling, cache purge on publish | A test domain goes `added → active`; unknown hosts get 404; another business's host never serves this site |
| W-10 | DNS connections (Cloudflare token, Porkbun key), diff + approval + write + verify | Write only after approval; wrong token gives a plain error; records verified by lookup |
| W-11 | Email set-up for Google, Microsoft and Zoho: record templates, SPF merge, DMARC, verification | SPF never duplicated; MX never removed without approval; verified state reached in a test zone |
| W-12 | Domain search + registrar deep links + link checker for every external link | All links return 200 in CI weekly |

### Phase D: Transfer and redesign

| ID | Work | Acceptance |
|---|---|---|
| W-13 | Ownership gate + crawl inventory + keep/merge/drop screen | Unverified host refused; robots.txt respected |
| W-14 | Redesign from inventory + redirect map + pre-switch check + 30-day watch | Every old URL → 200 or one 301; no chains; watch report produced |

### Phase E: Growth, export, launch

| ID | Work | Acceptance |
|---|---|---|
| W-15 | Growth: citations checklist + NAP check, mention finder, outreach drafts through approvals, Links CSV import, optional DataForSEO key | No message sent without approval; daily cap enforced |
| W-16 | Export to GitHub and ZIP (static bundle, `_redirects`, sitemap) | Exported bundle deploys on Cloudflare Pages and the form still posts to Oprun |
| W-17 | Help article, public page wording, pricing line for the Website add-on, monitoring of generation cost | Owner approves wording; no claims beyond what is built |
| W-18 | `llms.txt` per published site + owner AI-crawler setting in `robots.txt` (D-W18) — repo task T-199 | `/llms.txt` lists summary, services, areas, contact and pages; robots rules follow the setting; change needs approval |
| W-19 | Buy a domain inside Oprun with the business's own Cloudflare account (D-W15) — T-200 | Live price shown; owner confirm recorded; one registration per idempotency key; unsupported extension → deep link; Oprun never pays |
| W-20 | Free email forwarding with Cloudflare Email Routing (D-W17) — T-201 | Records written only after approval; SPF merged; screen says receive-only |

## 2. MVP scope (first live test: a test business on the free oprun.ai address and a spare test domain)

Standing rule: **the Fleet Parlour website (`fleetparlour.com.au`) is not touched.** Fleet Parlour can try the builder on
the free `oprun.ai/sites/...` address only; moving its real domain needs the owner's explicit instruction.

In: W-01 to W-10, W-12 (new site, cinematic optional, own domain via DNS connection or manual records, approval-first
publishing, live Oprun data). Out of MVP: email automation beyond showing records (W-11 follows next), transfer
(W-13/14), Growth (W-15), export (W-16).

## 3. Success metrics

| Metric | Target |
|---|---|
| Wizard start → published | ≤ 30 minutes median, ≤ 10 minutes of the owner's own time |
| Mobile Lighthouse performance on generated pages | ≥ 90 (≥ 85 with Cinematic) |
| LCP (field, p75) | ≤ 2.5 s |
| Accessibility (axe) | 0 serious issues |
| Claims published without approval | 0 |
| Domain added → active | ≤ 1 hour median when DNS is automatic |
| Transfer: old URLs without a working destination | 0 |
| Website enquiries reaching Unibox | 100 % (form test daily) |
| Outreach sent without approval | 0 |

## 4. What to push to GitHub first for live testing

**Status 23 Nov 2026 (brief v2):** items 1 and 2 below are done (spec pack, W-01 Website section live, W-02 tables partly). W-09 custom-domain hosting is built (T-155) and switches on when the Cloudflare items in §5 are set. **Next push, in this order:** W-18 (small, free, raises AI visibility for every published site) → W-03/W-04/W-05 behind `website_builder_v2` → W-08 speed budget → W-06 cinematic → W-19/W-20 (needs a test Cloudflare account) → W-13/W-14 transfer.

Original order:

1. This spec pack (`docs/ai-website/`) — done in this pull request.
2. W-01 + W-02 (one section, migrations) — safe, no behaviour change, proves navigation on phone/tablet/laptop.
3. W-03 to W-06 behind the business flag `website_builder_v2` so one test business tries it first.
4. W-09 + W-10 once the owner has provided the Cloudflare items below.

## 5. What the owner must provide (cannot be done from code)

| Item | Why |
|---|---|
| A Cloudflare account for Oprun with a zone for the site target (recommend a separate domain such as `oprunsites.com`, so `oprun.ai` DNS does not move) and Cloudflare for SaaS enabled | Custom hostnames and SSL (D-W4) |
| A Cloudflare API token for that zone (Custom Hostnames + Cache Purge), saved in Render as `CLOUDFLARE_SAAS_TOKEN`, plus `CLOUDFLARE_SAAS_ZONE_ID` | Server-side hostname management |
| Decision: Website as part of plans or a paid add-on, and its price | Pricing page and metering |
| For W-19/W-20 tests: a Cloudflare account of a test business with a payment method and an API token (Registrar write + Zone DNS edit), entered in the app, never in chat | One-step purchase and free forwarding can only be proven against a real account |
| A spare test domain the owner buys (any cheap gTLD) | First live custom-domain test without touching Fleet Parlour's website |
