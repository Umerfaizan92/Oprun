# 04 · Advanced AI-assisted features architecture

Shared rules:
- AI drafts; a person approves anything customer-facing or public before it is sent or published.
- Each business pays its providers directly (domains, email, SMS, social ads). Oprun never holds their money.
- Every action is written to the activity log (`audit_logs`), with the module and the actor.
- Keys are stored encrypted per business (`organisation_integrations`, `INTEGRATION_ENCRYPTION_KEY`), never in the
  browser, and never written to the repo or project memory.

## 1. Website: generation, redesign, domain, migration

Already built and live (T-147, PR #142, #144). Spec in `docs/ai-website/`:

| Capability | State |
|---|---|
| AI build from business facts and style choice | Live (`src/website/hub.js` `buildNew`) |
| Page editor, publish with approval, sitemap, robots | Live (`src/seo/*`) |
| Transfer an existing site (crawl up to 30 pages, import as drafts, keep old URLs with 301 redirects) | Live, needs a verified site connection |
| Domain: Spaceship / VentraIP / Cloudflare links, TXT ownership check | Live |
| Business email setup (Google, Microsoft, Zoho), with checks of the MX, SPF and DMARC records | Live |
| Custom domain hosting (Cloudflare for SaaS + Worker) | Built in PR #144, **off** until the owner adds `CLOUDFLARE_SAAS_TOKEN`, `CLOUDFLARE_SAAS_ZONE_ID`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_SAAS_DOMAIN` in Render |
| Activity log | Live |

Still to build (from `docs/ai-website/11_IMPLEMENTATION_PLAN.md`):
- **Redesign an existing Oprun site**: "Redesign" makes a new draft version of every page in a chosen style. The
  old version stays live until the owner publishes, and one click rolls back.
- **Cinematic 3D option (W-05/06)**: an optional hero section that plays once (2–4 s) and ends on a still frame.
  - Built with CSS 3D transforms or a small WebGL scene, loaded only on devices that pass a capability check.
  - A static image is used on low-power devices, with `prefers-reduced-motion`, and on the first paint.
  - Budget: under 150 KB extra JavaScript, LCP under 2.5 s on a mid-range phone. No looping.
- **Domain purchase inside Oprun (W-10)**: optional Spaceship API (the business's own key). Search → price →
  owner confirms → the purchase is made in the business's Spaceship account. DNS records are written only after
  the owner approves them. The Spaceship link-out stays as the default.
- **Domain transfer**: a guided checklist (unlock, auth code, transfer at the registrar). Oprun never holds auth
  codes after the step is done.
- **Global listings for non-AU countries** (doc 02 §5).

## 2. Social Studio (replaces "Media studio" + parts of the Growth Hub)

### Flow (one screen per step on phone)
1. **Brand kit**: logo, colours, fonts, voice and example posts. Made once, used everywhere.
2. **Plan**: AI builds a 2- or 4-week calendar from the business's services, season, reviews and completed jobs
   (jobs only with photos the customer allowed) (existing `POST /api/saas/growth/calendar/generate`).
3. **Create**: for each post, AI writes the caption and suggests images. Templates render branded images; video
   uses the existing render queue (`/api/saas/video-renders`). The owner can edit everything.
4. **Approve**: approve one post, a week, or the whole plan (existing `calendar/approve`).
5. **Publish**: automatic where the channel's API allows it; otherwise "ready to post" with a copy and download
   button and a phone share sheet.
6. **Learn**: reach, clicks, enquiries per post (from provider insights and Oprun's own enquiry sources).

### Channel plan
| Channel | Today | Target | Needed from the owner |
|---|---|---|---|
| Facebook Page | Auto (text) | Auto: text, image, video | Meta app review for page publishing permissions |
| Instagram (business/creator) | Ready to post | Auto: image, carousel, reel via Instagram Graph API content publishing | Same Meta app, Instagram permissions approved |
| X | Auto (text) | Auto: text + image | X API plan that allows posting |
| LinkedIn Page | Ready to post | Auto via LinkedIn's organisation posting API | LinkedIn approval for organisation posting |
| TikTok | Ready to post | Auto via TikTok Content Posting API | TikTok audit (unaudited apps can only post privately) |
| Google Business Profile | Not available | Posts and review replies | Google Business Profile API access approval |
| WhatsApp | Inbox only | Unchanged (no broadcast without opt-in) | — |

Alternative if the provider approvals take too long: an aggregator such as Ayrshare, with the business's own
account and key. This is a decision for the owner (cost per business), not a default.

## 3. Campaigns (merges Growth Hub, Campaign Studio, older drafts)

- **Campaign** = goal + audience + channels + messages + schedule + budget note.
- Goals: win back old customers, ask for reviews, fill quiet days, promote a service, seasonal reminder.
- Audience comes from Customers, filtered by job history, last visit and suburb/city, and **marketing permission
  only**. Opt-outs (STOP, unsubscribe) are always excluded (the `marketing_suppressions` table).
- Channels: SMS, email, social posts, and website banner.
- Each message is AI-drafted, and the owner approves the whole campaign once. Sends are spread out, with quiet
  hours by the business's time zone.
- Required wording is added automatically: sender identification and an opt-out ("Reply STOP" / unsubscribe
  link). This meets Australian Spam Act rules and similar rules elsewhere.
- Results: delivered, replies, bookings, revenue linked through the pipeline.

## 4. Integration with existing features
- Enquiries from the website form, receptionist calls, social messages and campaign replies all land in the one
  Inbox, and then in the Work pipeline (existing `src/comms/outbound.js`, `src/pipeline.js`).
- Completed jobs can trigger a review request (live) and a "job showcase" post draft in the Social Studio, if
  the customer allowed photos.
- Website analytics and campaign results show on Today → Home "Business pulse".

## 5. Recommended tools, plugins and agents

| Need | Recommendation | Why |
|---|---|---|
| Custom domains + SSL | Cloudflare for SaaS (already chosen, D-W) | 100 hostnames included, automatic certificates |
| Domain registrar | Spaceship (link-out, optional API); VentraIP/Synergy Wholesale for .au | Cloudflare Registrar does not sell .au |
| Business email | Google Workspace, Microsoft 365, Zoho (guided, the business pays) | Already in the Website hub |
| SMS / voice / verify | Telnyx (already used); Telnyx Verify for international sign-up codes, with voice fallback | One provider, many countries |
| Transactional email | Resend (already used) | Already used |
| Social publishing | Official APIs first; Ayrshare as an optional fallback | Fewer approvals |
| AI text | Current `generateAiText` provider shim | Already abstracted |
| AI images | One provider behind the same shim, with brand-kit constraints; every image is labelled AI-generated in the editor | Swappable |
| Testing | Existing Puppeteer UI tests + add **axe-core** (accessibility) and **Lighthouse CI** budgets per device class | Measurable quality |
| Visual regression | Existing `npm run test:visual`, extended to the 5 device classes in doc 05 | Catches layout breaks |
| Error monitoring | Sentry (a connector is already available in this workspace) | Live errors with context |
| Product analytics | PostHog (connector available), cookie-less mode for public pages | Measures whether the new flows work |
| Dev agents (for future sessions) | Claude Code with this repo's memory system; use `Explore` for searches and a separate review agent for high-stakes changes (security, billing) | The work is checked by someone who didn't write it |
