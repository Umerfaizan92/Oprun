# 03 One-section self-service wizard (Website → Build)

One screen, nine steps, a progress bar, and a summary panel that always shows what will be created. Every step can be
saved and resumed (state in `seo_sites.style_json` + `build_status='draft'`). Mobile first: each step fits a phone
without sideways scrolling. Owners and admins can run it; managers can edit pages but not domains, DNS or email.

| # | Step | What the owner sees and does | Pre-filled from Oprun | Checks before Next |
|---|---|---|---|---|
| 1 | **New site or transfer** | Two cards: "Make me a new website" / "Redesign my existing website". Transfer asks for the current address | `onboarding_profiles.website`, Connections → Website | Transfer: ownership proved (TXT already verified in Connections, or the file method) |
| 2 | **Business info** | Name, ABN, phone, email, address or "we come to you", services (chips), areas served (suburbs or radius), hours, licences, what makes you different (one sentence) | `organisations`, `onboarding_profiles`, `tenant_receptionist_profiles`, top suburbs from completed jobs (owner confirms each) | Required: name, phone, at least one service, at least one area. ABN checked for format (11 digits, checksum) |
| 3 | **Design style** | 6 style cards (Clean trade, Bold industrial, Warm local, Premium dark, Medical calm, Retail bright) with live preview, brand colour and logo, font pair, **Cinematic on/off** with 4 scene presets (for example "polished metal", "light trails", "blueprint", "soft particles"), photo choice (own job photos, owner uploads, or licensed stock) | Logo and colour from `organisations` | Contrast ≥ 4.5:1 for text (existing `contrast()`); Cinematic shows its speed cost |
| 4 | **Pages** | Suggested page list for the business type (see [04](04_NEW_SITE_GENERATION.md) §3), toggle pages on/off, add a page per service and per main area | Services and areas from step 2 | Area pages need at least one unique fact each (no doorway pages) |
| 5 | **Domain** | Three choices: **Buy a new domain** (search box shows availability; buttons open the registrar with the name filled in), **Use a domain I own** (enter it), **Transfer my domain** (registrar's own steps, auth code checklist). Or "Use the free oprun.ai address for now" | Existing website hostname | Domain syntax; `.com.au` eligibility reminder (ABN must match) |
| 6 | **Email** | Skip, or choose Google Workspace / Microsoft 365 / Zoho Mail; button opens the provider's sign-up with the domain filled in; "I've signed up" then shows the records | Domain from step 5 | Provider chosen and domain known |
| 7 | **Search & AI visibility** | Main search phrases (suggested from services × areas), Google Business Profile link, Search Console connect, "Let Oprun suggest monthly improvements" (drafts only) | Existing keyword plan and Google links | At least one phrase per service |
| 8 | **Generate → Review** | Generation progress per page (no fake progress). Then a phone/tablet/laptop preview with per-section "Regenerate", "Edit text", "Swap photo", "Remove". Claim warnings shown inline | Everything above | All pre-publish checks pass or are explicitly accepted by the owner |
| 9 | **Publish** | Summary: pages, domain status, email status, redirects (transfer), approvals needed. Button "Send for approval" or "Publish" when the owner can approve | — | Approval rules from D-W10; domain must be `active` before switching the primary address |

## Wizard rules

- Nothing outside Oprun is changed until the owner presses an explicit button that names the change ("Write these 5 DNS records to Cloudflare").
- Leaving the wizard keeps everything as a draft; the Overview tab shows "Finish your website (step 4 of 9)".
- Every external link (registrar, email provider, Cloudflare token page, GitHub) opens in a new tab and says where it goes.
- Costs that the business pays a provider are shown as "paid to Google, not Oprun".
