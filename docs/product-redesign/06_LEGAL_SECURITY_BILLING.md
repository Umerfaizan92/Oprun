# 06 · Legal, security and billing checklist

I am not a lawyer or an accountant. Items marked **Adviser** need a qualified professional to confirm them
before launch outside Australia.

## 1. Legal

| # | Item | State | Action |
|---|---|---|---|
| L1 | Terms of Service governing law and venue | Australian | Keep Australian law (Western Australia). Add a clause for customers outside Australia. **Adviser** |
| L2 | Privacy Notice | Privacy Act 1988 / APPs | Add sections for EU/UK customers (GDPR/UK GDPR: lawful basis, data subject rights, international transfer), the US (state privacy laws where they apply) and a general "other countries" section. **Adviser** |
| L3 | Data Processing Agreement for business customers | Not found as a separate document | Publish a DPA (Oprun = processor for the business's customer data). **Adviser** |
| L4 | Subprocessors list (`saas/subprocessors.html`) | Exists | Keep it complete: Render (Singapore), the storage backup provider, Telnyx, Resend, AI providers, Cloudflare (when switched on), the payment provider. Date every change. |
| L5 | Data location statement | Not clear on public pages | State where data is stored (Render Singapore + backup region) and that providers may process data elsewhere |
| L6 | Marketing messages | STOP/unsubscribe handling exists | Campaigns add sender ID + an opt-out to every marketing message; marketing goes only to customers with permission (Spam Act 2003 in AU; similar rules elsewhere) |
| L7 | AI disclosure | Approval-first exists | Customer-facing AI messages are approved by a person. The receptionist says it is an AI assistant at the start of a call. Keep this. |
| L8 | Call recording / transcripts | Receptionist transcribes | Announce the recording at the start of the call. Recording consent rules differ by state and country. **Adviser** |
| L9 | Worker data (visa, VEVO) | AU pack | Collect only with the worker's consent; keep only as long as needed; non-AU businesses never collect visa data |
| L10 | Sanctions | No country controls | Block comprehensively sanctioned jurisdictions at sign-up. **Adviser** confirms the list. |
| L11 | Consumer law wording | ACL references exist | Keep for AU. Elsewhere use neutral wording: "your local consumer rights still apply". |
| L12 | Accessibility statement | Not found | Publish a statement with the WCAG 2.2 AA target and a contact for issues |
| L13 | No invented testimonials | Standing rule | Keep. Reviews shown only from real customers via review links. |

## 2. Security

| # | Item | State | Action |
|---|---|---|---|
| S1 | Tenant isolation | Tested | Keep. Every new table has `organisation_id`, and every query is scoped by it. Never trust a client-supplied `workspace_id`. |
| S2 | Passwords | 14+ characters, hashed with a salt | Keep. Add breached-password checking (k-anonymity range query). |
| S3 | MFA | Exists | Recommend MFA to owners at first sign-in; require it for Founder/Operator |
| S4 | Founder TOTP | `OPERATOR_TOTP_SECRET` not set (diagnostics warning) | The owner sets it in Render |
| S5 | Non-AU sign-up abuse | New risk | Controls in doc 02 §3 (rate limits, disposable email block, Telnyx geo-permissions, outbound off until paid) |
| S6 | Shell detection | New | Layout only. The server never uses the shell or device for authorisation. |
| S7 | Custom domains | Built | Only verified domains are served; an HMAC edge key; no cookies through the Worker; the app is not reachable on business domains (PR #144 tests) |
| S8 | Secrets | Scanned | Never in the repo or memory; the owner enters keys in Render or in the app's Connections screen |
| S9 | CSP / headers | Present | Keep `script-src` without `unsafe-inline` on workspace pages. Public site pages have no scripts. |
| S10 | Rate limits | Present on auth, OTP, public forms | Add the same to the new voice-code resend |
| S11 | Audit log | Present | Every setting change, approval, send, publish, domain and billing action |
| S12 | Backups | Litestream to S3 (logs show WAL shipping) | Test a restore every quarter and record the result |

## 3. Billing

| # | Item | State | Action |
|---|---|---|---|
| B1 | Currency | AUD only | Bill everyone in **AUD**; show an approximate local amount for information ("about £25, your bank sets the rate"). Accept cards in any country. Simplest and correct for now; local currency pricing later. **Owner decision** |
| B2 | Tax | "+ GST" for everyone | AU customers: price + 10% GST, with a tax invoice that includes Oprun's ABN. Non-AU business customers: GST treatment of exports of services to businesses outside Australia. **Adviser** (often GST-free, but it depends on the facts). Show "Tax: none charged by Oprun; you may need to account for local tax" only after the adviser confirms. |
| B3 | Plan display | Hard-coded in HTML | Plans and prices come from the server (`subscription-policy.js`), so the sign-up page, the billing page and the public site always match |
| B4 | Trial | 14 days | Same for all countries. Outbound customer messaging needs a payment method for non-AU accounts (doc 02 §3). |
| B5 | Cancellation and refunds | In the Terms | One clear "Cancel plan" step in Plans & billing, with the end date shown before confirming |
| B6 | Third-party costs | Each business pays its providers | Every screen that uses a paid provider (SMS, domains, email, social ads) says who charges for it, before setup |
| B7 | Invoices from Oprun | AUD tax invoices | Non-AU: an "Invoice" (not a "Tax invoice") unless the adviser says otherwise |
| B8 | Payment links for subscribers' customers | Built (T-166) | Uses the business's own payment provider; Oprun never holds the funds |

## 4. Required wording (insert as written, after adviser review where marked)
- Sign-up, non-AU verification: "We verify your email and mobile number. Oprun does not verify business
  registrations outside Australia."
- Worker documents, non-AU: "Upload the documents your business asked for. Only your business and you can see them."
- Paid providers: "<Provider> charges you directly for this. Oprun does not add a fee."
- AI drafts: "Written by Oprun AI. Check it before you send it."
- Campaign footer (SMS): "<Business name>: Reply STOP to opt out." Email: sender name, postal address,
  unsubscribe link.
