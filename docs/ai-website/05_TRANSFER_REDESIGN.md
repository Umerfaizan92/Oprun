# 05 Existing website transfer and redesign

## 1. Process

1. **Ownership check (D-W8).** The site's hostname must be verified in Connections → Website (TXT `_superpro.<host>`) or by a file `/.well-known/oprun-verify.txt` containing the business's code. No verification, no crawl.
2. **Crawl.** Existing `crawlSite`: HTTPS only, public IPs only, robots.txt honoured, 1 request/second, max 300 pages, `sitemap.xml` first, then internal links. Stored per URL: status, canonical, title, meta description, H1/H2s, main text, images (URL, alt), structured data, internal links, word count, and Search Console clicks if connected.
3. **Inventory and keep/merge/drop.** Each old URL is classified: `keep` (has clicks, links or unique content), `merge` (thin or duplicate → merged into the best page), `drop` (empty, tag archives, test pages). The owner sees the list and can change any line.
4. **Redesign.** Content from `keep`/`merge` pages is rewritten into the block model using the same prompt rules as [04](04_NEW_SITE_GENERATION.md), keeping facts from the old page and Oprun. Images are reused only if they come from the verified site; otherwise replaced.
5. **Redirect map (D-W9).** Every old URL that changes gets a 301 to the closest new page; `drop` URLs go to the closest parent, never all to the home page. Stored in `website_redirects`; served by the host middleware and included in exports as `_redirects`.
6. **Metadata carry-over.** Titles and descriptions of pages with search clicks are kept unless the owner approves a change; H1 keeps the main phrase.
7. **Pre-switch check.** New site served on the free address; automated check: every old URL returns 200 or a single 301 to a 200 page, no redirect chains, canonical tags correct, sitemap lists only 200 pages, structured data valid, CWV budget met.
8. **Switch.** Domain moved to Oprun (see [06](06_DOMAIN_EMAIL.md)); Search Console sitemap resubmitted; URL inspection for the top 20 pages.
9. **Watch for 30 days.** Daily Search Console comparison of clicks and indexed pages versus the 28 days before; any page losing > 50 % clicks is flagged with its redirect.

## 2. Automated migration checklist (shown to the owner, ticked by the system)

- [ ] Ownership verified
- [ ] Old site crawled (pages found / skipped with reasons)
- [ ] Keep / merge / drop reviewed by the owner
- [ ] New pages generated and approved
- [ ] Every changed URL has one 301 (no chains, no loops)
- [ ] Contact forms on the new site post to Oprun; old form endpoints redirected
- [ ] Tracking: Search Console verified for the domain; GA4 kept if the owner uses it
- [ ] Email DNS records untouched or improved (MX never removed during a website move)
- [ ] DNS change approved and applied; certificate active
- [ ] Sitemap submitted; top pages inspected
- [ ] 30-day watch running

## 3. What is never done

- Crawling or copying a site the business does not own.
- Removing MX, SPF or DKIM records while moving the website.
- Pointing every old URL at the home page.
