# 06 Domain and business email

## 1. Registrar recommendation (D-W5)

| Extension | Recommended | Why | API for Oprun |
|---|---|---|---|
| `.com.au`, `.net.au`, `.au` | **VentraIP** (Australian, auDA-accredited; also the retail arm of Synergy Wholesale) | auDA eligibility needs an Australian presence (ABN/ACN); Cloudflare Registrar does not support `.au` | None needed in MVP (deep link). Later, only with owner approval: Synergy Wholesale reseller API (includes ABN/ACN lookup at registration), which would make Oprun a reseller with payment and support liability |
| `.com`, `.net`, `.io`, `.dev`, `.ai` and other gTLDs | **Cloudflare Registrar** (at-cost pricing, free WHOIS privacy) | Cheapest renewals; DNS on Cloudflare makes connection automatic | **Buy inside Oprun (D-W15):** Registrar API beta in the business's own account: `GET /accounts/{id}/registrar/domain-search`, `POST …/registrar/domain-check` (live price), `POST …/registrar/registrations` (billed to that account's default payment method, non-refundable). Not yet by API: transfers in, renewals, contact updates, some extensions → deep link (Cloudflare docs, checked 23 Nov 2026) |
| Alternative for gTLDs and `.au` | **Porkbun** | Simple JSON API open to every account; sells `.au` | API v3 for DNS; availability check |
| Namecheap | **Deep link only (D-W16)** | API is enabled only with 20+ domains or US$50 balance, needs a whitelisted IPv4 per account, and bills only from account balance (Namecheap API FAQ, checked 23 Nov 2026) | — |
| General buy link (built) | **Spaceship** (owner's choice, in `src/website/hub.js`) | Kept as the simple "search and buy" link | — |

## 2. Flows

**Buy a new domain inside Oprun (D-W15, Cloudflare account connected)**
1. Owner types a name. Oprun calls `domain-search` and `domain-check` with the business's token and shows up to 6 names with the live yearly price and renewal price, in the currency Cloudflare returns, plus the approximate A$ amount.
2. Owner taps **Buy `name` for US$x/year**. The confirmation states: billed to your Cloudflare account, non-refundable, renews automatically at US$y. Tapping **Confirm and buy** records an approval (owner only).
3. Oprun calls `registrations` once with an idempotency key (a repeated tap never buys twice); a `pending` result is polled on `registration-status`.
4. On success: Oprun adds the zone, writes the website records (Connect step 2) and, if chosen, the email records (§3), then starts hosting. Every step is in the audit log.
5. Failure (`extension_not_supported_via_api`, card declined, name taken in the meantime): plain message plus the deep link with the name filled in. Nothing is retried automatically after a payment error.
6. The token is stored encrypted, write-only, and can be removed at any time in Connections; removing it never touches the domain.

**Buy a new domain (any registrar, deep link)**
1. Owner types a name; Oprun suggests options (`business name`, `name + service`, `name + suburb`) and checks availability by DNS-over-HTTPS (`NS`/`SOA` lookup) plus RDAP where the registry offers it. Results say "looks available, confirm at the registrar".
2. Button opens the registrar with the name pre-filled: VentraIP for `.au`, Cloudflare Registrar for gTLDs (account owned by the business). Payment happens there.
3. Owner returns and enters the domain; Oprun continues with **Connect**.

**Transfer a domain to a new registrar** (optional; not needed for the website to work)
1. Checklist: unlock the domain at the current registrar, get the auth code (for `.au` the "domain password"), make sure the registrant email works, domain older than 60 days for gTLDs.
2. Button opens the new registrar's transfer page. Oprun stores nothing secret; it only tracks status by WHOIS/RDAP.
3. DNS records are copied first (export from the old DNS, compare after), so the website and email stay up during the transfer.

**Connect a domain the business owns (all paths end here)**
1. Owner adds `www.example.com.au` (primary) and the apex `example.com.au`.
2. Oprun creates a Cloudflare for SaaS **custom hostname** for `www…` and shows the records:
   - `www` CNAME → `sites.oprun.ai` (the SaaS fallback target)
   - apex: if DNS is on Cloudflare, CNAME `@` → `sites.oprun.ai` (CNAME flattening); otherwise the registrar's URL forwarding to `https://www…`, or an apex A record to Oprun's redirect host (value confirmed at implementation)
3. **DNS connection (D-W6):** with a Cloudflare zone-scoped token or Porkbun key, Oprun shows the exact before/after records, the owner approves, Oprun writes them, then verifies by public DNS lookup.
4. Status moves `dns_pending → verifying → ssl_pending → active`, polled every minute for 1 hour, then hourly for 48 hours. The owner gets a notification when it is active.
5. Switch-over: when `www` is active, the site's primary address changes, `/sites/:slug` 301s to the domain, and the sitemap uses the new address.

## 3. Business email (D-W7)

| Provider | Price shown to the owner | Records Oprun writes or shows |
|---|---|---|
| Google Workspace | Business Starter A$9.90 per user per month on an annual plan, A$11.80 flexible (Google, Nov 2026) | Verification TXT `google-site-verification=…`; MX `@ → smtp.google.com` (priority 1); SPF `v=spf1 include:_spf.google.com ~all`; DKIM TXT `google._domainkey` (value copied from Google Admin); DMARC |
| Microsoft 365 | Shown from Microsoft's page at set-up time | Verification TXT `MS=…`; MX `@ → <domain-with-dashes>.mail.protection.outlook.com`; CNAME `autodiscover → autodiscover.outlook.com`; SPF `include:spf.protection.outlook.com`; DKIM CNAMEs `selector1/selector2._domainkey`; DMARC |
| **Free forwarding (D-W17)**: Cloudflare Email Routing | A$0. Receive-only: mail to `info@`, `quotes@` etc. is forwarded to an inbox the business already has. Replies from the business address need one of the paid providers | MX and TXT records Cloudflare provides for Email Routing (written with the business token after approval); SPF merged; destination address verified by Cloudflare's own email |
| Zoho Mail (Australian data centre) | Shown from Zoho's page at set-up time | Verification TXT/CNAME; MX `mx.zoho.com.au`, `mx2.zoho.com.au`, `mx3.zoho.com.au`; SPF `include:zoho.com.au`; DKIM TXT from Zoho; DMARC |

Rules:
- SPF is **merged**, never duplicated: one `v=spf1` record containing every sender (mail provider, Resend if connected).
- DMARC starts at `v=DMARC1; p=none; rua=mailto:dmarc@<domain>`; Oprun suggests `p=quarantine` after 30 days with no failures.
- Existing MX records are never deleted without showing what will stop working and getting approval.
- Verification is by public DNS lookup; the provider's own "verify" button is linked, not automated.
- Offer: "Also send Oprun emails from this domain" → existing Resend connection (Connections → Email & SMS).

## 4. Direct links (opened in a new tab)

- VentraIP domain search: `https://ventraip.com.au/domain-names/` (name passed as a query when supported)
- Cloudflare Registrar: `https://dash.cloudflare.com/?to=/:account/domains/register`
- Cloudflare API token (Zone DNS edit; add Registrar write to buy inside Oprun): `https://dash.cloudflare.com/profile/api-tokens`
- Cloudflare Email Routing: `https://dash.cloudflare.com/?to=/:account/:zone/email/routing`
- Spaceship domain search (built): `https://www.spaceship.com/domain-search/?query=<name>`
- Porkbun API access: `https://porkbun.com/account/api`
- Google Workspace sign-up: `https://workspace.google.com/intl/en_au/business/signup/welcome`
- Microsoft 365 business: `https://www.microsoft.com/en-au/microsoft-365/business`
- Zoho Mail: `https://www.zoho.com/au/mail/`

Every link is re-checked at implementation (W-12) and stored in one constant so a broken link is fixed in one place.
