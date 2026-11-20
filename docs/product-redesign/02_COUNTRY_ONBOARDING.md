# 02 · Country-based onboarding specification

Goal: anyone in any country can open an Oprun account. Australia keeps 100% of today's verification. Other
countries verify by email and phone only. Existing accounts are not changed.

## 1. One source of truth: the country profile

`src/country-profile.js` (built, T-168) is the server's single source. The browser gets the country list from
`GET /api/saas/registration/countries` and the business's country from `/api/saas/me` (`organisation.country`):

```js
countryProfile('AU') → {
  code: 'AU', name: 'Australia', dial: '+61',
  business_verification: 'abr',          // 'abr' only for AU; 'none' everywhere else
  worker_compliance: 'au',               // 'au' (VEVO, visa, licences) | 'documents'
  address: ['unit','street_number','street_name','suburb','state','postcode'],
  states: ['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'], postcode: /^\d{4}$/,
  tax: { label: 'GST', rate: 0.10, id_label: 'ABN' },
  currency_display: 'AUD', date: 'dd/mm/yyyy', week_starts: 1,
  features: { au_directories: true, au_domains: true, vevo: true }
}
countryProfile('GB') → { code:'GB', business_verification:'none', worker_compliance:'documents',
  address:['line1','line2','city','region','postal_code'], tax:{label:'VAT', rate:null, id_label:'VAT number (optional)'}, … }
```

- Countries come from ISO 3166-1 alpha-2 (the full list). Each country gets a dial code, an address format
  (a generic line1/line2/city/region/postal_code shape, with `region` only where the country uses one), and a
  tax label. Australia is the only country with `business_verification: 'abr'`.
- Every screen that is Australia-specific asks this module, never `if (country === 'AU')` scattered around.
  Australia-specific items: ABN/ACN, GST, VEVO/visa, Australian directories, .au domain advice, Australian
  mobile formatting, and Australian legal text.

## 2. Database changes (additive only, no data loss)

| Table | Change | Existing rows |
|---|---|---|
| `organisations` | `country TEXT NOT NULL DEFAULT 'AU'`, `verification_level TEXT NOT NULL DEFAULT 'business_verified'` (`business_verified` \| `contact_verified`), `region TEXT`, `address_line1`, `address_line2`, `city`, `postal_code` | Every existing org becomes `AU` + `business_verified`. Nothing else changes. |
| `pending_registrations` | `country`, `phone_e164`, the generic address columns. `business_identifier` becomes nullable for non-AU rows. | none |
| `users` | `phone` keeps E.164. Australian numbers are already +61. | unchanged |
| `workers` / compliance records | `compliance_pack TEXT DEFAULT 'au'` | existing = `au` |

`idx_organisations_identifier_unique` already ignores NULL identifiers, so non-AU businesses without a number do
not collide. Duplicate-business check for non-AU: same normalised name **and** same country **and** same verified
email domain or phone → "already exists, sign in".

## 3. Sign-up flow (sequential, one decision per screen)

### Screen 1 — Where is your business?
- One searchable country list. The default guess comes from the browser language/time zone (for example
  `Australia/Perth` → Australia). It is only a suggestion; IP address never forces a country.
- Primary button: **Continue**. The choice can be changed until the account is created.

### Australia (unchanged rules, new layout)
2. **Your business**: name, ABN/ACN/Other, state, postcode, address. **Check business** (ABR) must pass, as today.
3. **Your plan**: Starter / Operations / Scale in A$ + GST, as today.
4. **You**: name, work email, Australian mobile, password (14+), terms.
5. **Verify**: email code + SMS code (as today, `POST /api/saas/registration/verify`).
6. Account created → sign in.

The server keeps `verifyAustralianBusinessIdentifier`, the state/postcode check against ABR, and every existing
error message.

### Any other country
2. **Your business**: business name. Optional registration/tax number, stored as entered and clearly labelled
   "not verified by Oprun". Address in that country's format.
3. **Your plan**: same plans; price shown per doc 06 §3.
4. **You**: name, work email, mobile with that country's dial code (validated as E.164 for the country),
   password (14+), terms.
5. **Verify**: email code + SMS code. If SMS is not available for that country through Telnyx Verify, offer a
   **voice call code** (Telnyx Verify supports voice). An account is never created without both email and phone
   verified.
6. Account created with `verification_level='contact_verified'` → sign in.

### API
- `POST /api/saas/registration/start` takes `country` (default `AU` so the old form keeps working).
  - `country === 'AU'` → exactly today's schema and checks.
  - otherwise → a non-AU schema: generic address, E.164 phone for that country, no ABR call.
- `POST /api/saas/registration/resend` gains `channel: 'voice'`.
- `POST /api/saas/registration/verify` is unchanged.
- `POST /api/saas/register` keeps returning 410. Its message changes to say country-based sign-up is on the
  Create Account page.

### Abuse controls for non-AU sign-ups (no business check, so these matter more)
- The existing rate limits (`registrationStartLimiter`, `otpResendLimiter`, `otpVerifyLimiter`) stay as they are.
- Block disposable email domains. One account per verified phone (already enforced).
- Telnyx Verify's fraud/geo-permission settings: allow only the countries the owner switches on (Telnyx portal).
- A new workspace starts on the trial with outbound customer messaging **off** until a payment method is added.
  This stops spam from free accounts. Inbound, the receptionist and drafting all work.
- Countries under comprehensive sanctions are blocked at Screen 1. The owner confirms the list with an adviser
  (doc 06 §1).

## 4. Worker onboarding by country

| | Australia (`compliance_pack='au'`) | Other countries (`'documents'`) |
|---|---|---|
| Identity | As today | Full name, email, mobile |
| Work rights | Citizen / permanent resident / visa holder; visa subclass and expiry; VEVO check with the worker's consent; VEVO links | **Not shown** |
| Documents | Licences, white card, police check, etc., as today | Simple upload: "ID", "Licence or certificate", "Other". Each has an optional expiry date. |
| Reminders | Expiry and VEVO recheck | Expiry reminders only |
| Wording | Australian | Neutral: "documents your business asked for" |

The pack follows the **business's** country, not the worker's. The owner can add their own document types in
either pack. The worker link (`saas/worker-onboarding.html`) reads the pack from the invitation, so the worker
never chooses it. Screens are sequential on every device: 1 details → 2 documents → 3 review and send.

## 5. What changes inside the workspace for a non-AU business

| Area | Australia | Other countries |
|---|---|---|
| Invoices | ABN, GST, tax invoice wording | Business name, optional tax number, tax label from the profile (VAT, sales tax, or none). "Tax invoice" only where the profile says so. |
| Website hub | AU directories, .au advice | Global listings (Google Business Profile, Bing Places, Apple Business Connect); the domain search uses the country TLD |
| Receptionist / SMS | Australian numbers | The business buys a local number in Telnyx for its country; Oprun shows Telnyx's per-country rules |
| Dates, phone display | AU formats | From the profile |
| Workers | AU pack | Documents pack |

## 6. Tests required before release

1. The existing AU registration tests pass unchanged (they send no `country`, so they get the AU path).
2. AU with `country:'AU'` gives the same results; ABR mismatch errors are unchanged.
3. A GB sign-up without a business number is created with `contact_verified`. It cannot be created without
   email and SMS/voice verification.
4. A non-AU sign-up never calls the ABR mock (the test asserts zero calls).
5. Duplicate checks: same phone, same email, and same name+country+email-domain are all refused.
6. A non-AU worker invitation shows no visa/VEVO fields. An AU invitation shows them all.
7. Outbound customer messaging is blocked for an unpaid non-AU trial and allowed after a payment method is added.
8. Tenant isolation and staff-access tests still pass.
