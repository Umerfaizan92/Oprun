# MB-25: email codes and oprun.ai mail records

Checked 26 November 2026 with public DNS (dns.google). Nothing was changed in DNS: that needs the owner.

## What changed in the product

- Plain-text emails with a code (sign-up verification, account recovery) now start with the code line, so phone
  previews and screen readers show it first. The HTML version is unchanged. Test: `scripts/email-templates.test.mjs`.
- Website ownership (Connections → Website): "Copy" buttons next to the TXT record name and value.
- Two-step sign-in setup: a "Copy key" button next to the authenticator key.
- If the browser blocks copying, the text is selected so the person can copy it by hand.

## oprun.ai records found

| Record | Found | Meaning |
|---|---|---|
| SPF `oprun.ai` TXT | `v=spf1 include:spf.spacemail.com ~all` | Mailbox mail (Spacemail) is allowed. |
| DKIM `resend._domainkey.oprun.ai` | Present (RSA key) | Emails sent through Resend are signed. This is what passes DMARC. |
| `send.oprun.ai` | CNAME to `send.forge.rmta.net` (its SPF lists three Forge IP ranges) | Resend normally expects `send.oprun.ai` to have an MX record to `feedback-smtp.<region>.amazonses.com` and TXT `v=spf1 include:amazonses.com ~all`. A CNAME here blocks those records. |
| DMARC `_dmarc.oprun.ai` | **Missing** (NXDOMAIN) | Gmail and Yahoo expect a DMARC record for bulk senders; without it codes are more likely to land in spam. |

## Owner steps (Spaceship DNS, about 5 minutes)

1. Add TXT record: host `_dmarc`, value `v=DMARC1; p=none; rua=mailto:hello@oprun.ai; adkim=r; aspf=r`.
   Start with `p=none` (monitor only); after two clean weeks change to `p=quarantine`.
2. In Resend → Domains → oprun.ai, compare the records Resend lists for `send` with DNS. If Resend shows the `send`
   records as not verified, the `send.oprun.ai` CNAME (to Forge) must be replaced by the MX and TXT records Resend
   shows. Check first whether anything else (Spaceship "Forge" mail) uses `send.oprun.ai`; if it does, choose a
   different custom return path in Resend instead of removing it.
3. Send a code to a Gmail address and open "Show original": SPF, DKIM and DMARC should all say PASS.
