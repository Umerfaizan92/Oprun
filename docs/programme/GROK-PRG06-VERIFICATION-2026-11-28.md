# PRG-06 / T-273 — verification update after original report receipt

This supersedes the missing-report blocker in GROK-PRG06-REVIEW-2026-11-28.md. That earlier review is retained as history; its recommendation corrections still apply.
Status: TESTING / conditional acceptance of bounded design constraints only. No claim, trust, clinical or AML implementation is authorised.

## Preservation and provenance

- User supplied the full report in this conversation and explicitly instructed preservation without waiting for Grok's inaccessible commit.
- New documentation-only branch: codex/prg06-user-supplied-research-20261128.
- New actual commit: 28b889f737d992dde63e9beabb46e4f1d957d20d; verified parent 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd.
- Verified branch diff: exactly one added file, docs/programme/GROK-PRG06.md. No runtime, configuration, manifest or shared coordination file is on that research branch.
- First line is exactly: “User-supplied research; original Git provenance unverified.” The supplied report body follows unchanged; one final file newline was added. Marker is preservation metadata, not an edit to the research text.
- SHA256 of marked file: 7e8e17f591534fce75c8d54e03eddb95ae7366c3120bee05575df2c5d2047dc9. Local captured-text comparison passed and remote git-show bytes produced the same SHA256.
- Neither the branch claim inside the preserved report nor its author/FACT labels become verified by this new publication. Claimed Grok original commit 27a7e0f72dae4fb0cc5766cda8e4c5af543d3335 remains unavailable here and on the repository API; its parent relationship is not established.
- Additional claimed addenda commit 8b18364: local object lookup failed and GitHub returned 422 no commit found. R01/R02 addenda text has not been supplied in this conversation, so no addendum body or source claim is asserted preserved/reviewed. Do not reconstruct those Git objects or start overlapping research; request the already completed addenda text.
- Therefore “Grok original Git provenance remains local/unverified” and “the user-supplied report copy is now remotely preserved” are different, compatible statements. No waiting for the original commit is required.

## Source recheck scope and material corrections

32 literal URLs were extracted from the supplied report and independently requested. 28 returned content (some redirects); four exact URLs were blocked. Retrieval is not blanket validation of every sentence. Search/index corroboration is labelled separately; no NDA or developer portal was entered. Sources were checked on 28 November 2026.

| Finding | Correction / independent evidence | Adoption status |
|---|---|---|
| NDIS claim deadline omission | The current guide includes a notice for a 90-day timeframe from 1 December 2026 while retaining older two-year text. The linked NDIA notice dated 18 November 2026 explicitly announces the new timeframe, exception enquiries and review of outstanding claims. Do not encode the report's two-year summary as an evergreen deadline or alter service dates. | Material correction; effective-date/transition review before workflow wording or calculations |
| NDIS portal blanket statement | “How to make a payment request” states ordinary claims use myplace but separately names approved replacement-support claims in my NDIS. Manual-claim routes are also described on the guide. “All claims” cannot be adopted as an exhaustive universal integration rule. | Qualify by claim type and channel; no adapter |
| NDIS pricing two-page discrepancy | At recheck the older pricing-arrangements-and-price-limits URL redirects to the current pricing page. That page includes current schedules and historical documents. Its current-as-of date is 24 September 2026; a 26 November print header is not automatically a last-updated date. Grok's described earlier two-page conflict is not independently reproduced now. | Retain dated source/version selection; no hardcoded prices |
| NDIA access | The public source confirms gated access, DPO process, provider partnership, cyber review, discretionary early testing and later technical pack. It expressly says contact DPO before beginning documents/cyber assessment. No endpoint list or Oprun approval is established. | Accept gate, not permission to apply/contact/build |
| DVA “three methods” | Current page also lists mail as a fallback. It distinguishes hospital/community nursing routes and shows the future 1 July 2027 window change alongside current two-year wording. A software channel summary cannot erase service-specific routes or approvals. | Correct summary; do not hardcode deadlines or infer blanket NOI coverage |
| Ahpra exact cited pages | Both exact URLs returned 403. An alternative official Ahpra indexed page corroborates 15 National Boards, but this does not independently verify the complete cited register UI, its exact profession list or every specialty credential. | Exact-page claims remain unverified; no scraping or automatic practitioner status |
| GST exact cited page | Old ATO URL returned 403. An official indexed current ATO page corroborates the thresholds/turnover distinction, but an indexed excerpt is not a completed live-page audit of all exceptions. | Basic corroboration only; detailed tax determination remains outside this batch |
| WA food/local government exact page | Retrieval failed. FSANZ guidance/enforcement links were retrieved, but they do not by themselves verify the quoted WA form/process or its old printed date. | WA-specific instruction wording remains blocked on primary-page recheck |
| WA motor repair/detailing | Official page distinguishes a business licence from a repairer's certificate and activity exemptions. Vehicle washing/cleaning are listed as exempt activities; vehicle detailing appears in accessory work that may not require a certified repairer. Do not convert that into a blanket finding that every detailing business/work scope is exempt. | Tailored source guidance only, not a licence decision |
| WA employment coverage | FWO broadly supports the report's state/national distinction, but expressly includes a partnership/company/trading-activity qualification. Entity form alone is not a complete classification engine. | Ask contextual questions; no automatic award/system determination |
| WA liquor | General licence requirement is supported, but the official guide includes specified exemptions. A recorded external evidence number alone cannot confer authority-verified status. | Preserve licence/food distinction and evidence review |
| AUSTRAC | Official pages corroborate reform/enrolment dates and the activity-specific checker. This does not classify any Oprun subscriber as a reporting entity or verify its programme. | Guidance only; no KYC/reporting build |
| WA privacy scope (review addition) | Current WA OIC guidance distinguishes PRIS effective dates and State-service-contract applicability. Older OAIC blanket WA wording must not be adopted without the current scope/commencement context. | Explicit applicable-rule/conflict design; no “strictest rule wins” automation |

Key current sources:
- [NDIA dated 90-day notice](https://www.ndis.gov.au/news/11764-new-90-day-claiming-timeframe-starts-1-december-2026)
- [NDIA payment guide](https://www.ndis.gov.au/providers/pricing-and-payments/payments/guide-getting-paid)
- [NDIA payment requests](https://www.ndis.gov.au/providers/pricing-and-payments/payments/how-make-payment-request)
- [NDIA pricing](https://www.ndis.gov.au/providers/pricing-and-payments/pricing/pricing-arrangements)
- [NDIA API access](https://www.ndis.gov.au/providers/working-provider/connecting-ndia-systems)
- [DVA claims](https://www.dva.gov.au/providers/fees-claims/provider-claims)
- [WA repair licensing](https://www.consumerprotection.wa.gov.au/motor-vehicle-repairers-licensing)
- [FWO current system page](https://www.fairwork.gov.au/about-us/workplace-laws/fair-work-system)
- [WA PRIS commencement](https://www.wa.gov.au/organisation/office-of-the-information-commissioner/what-parts-of-the-pris-act-have-commenced)
- [WA contracted providers](https://www.wa.gov.au/organisation/office-of-the-information-commissioner/how-pris-applies-contracted-service-providers)

## Independent code observations at the stated base

Inspected with git show/git grep at 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd, not inferred from current chat or the report's FACT labels.

- Counted 34 registry entries; the named empty/source-bearing rows, WA-only state sources, generic interview plus AU NDIS question, consent version and default stage rules are corroborated in the named files.
- The country-profile function covers country/business verification/worker pack/tax presentation; it is not an industry claim-rule system. AU retain_years:5 exists in country-rules but was not validated as a legal retention rule.
- Onboarding-proposal uses one industry profile and a tenant-scoped, hash-checked owner/admin approval. It also permits services/module choices; lack of a structured multi-pack model is not proof that every hybrid business activity is impossible to configure manually.
- channelCapabilities has ads_launch:false and excludes Snapchat from sync/post capability. Actual source execute() paths include WhatsApp replies and multiple social publishing/reply adapters. The older release inventory cannot be read as evidence that only drafts are implemented at this base. Implemented source, provider permission and live account proof remain separate statuses.
- Bounded JavaScript searches and inspected files did not establish Medicare/DVA/NDIA, marketplace-delivery or trust-account adapters. This is not a formal proof over every possible external service or unpublished branch.
- No clinical-information access-control certification, PAN-storage certification or live-provider connection is established by these source observations.
- Industry/onboarding files inspected here are unchanged between stated base and the published audit candidate fc8c433. Unpublished work and production may differ; no assertion about them is made.

## Recommendation disposition and existing ownership

| Report ID | Disposition before any implementation | Existing programme owner |
|---|---|---|
| R1 | Accept truthful unsupported-claim boundaries and negative isolation acceptance; no claim adapter project authorised | PRG-03/08 ChatGPT; PRG-06 research Grok |
| R2 | Modify to a readiness matrix by product/version/environment/API/action/channel and tenant authority; no single NOI assumed to cover all services | PRG-04/08 ChatGPT |
| R3 | Accept gated NDIA access and no guessed endpoints; no contacts, signup or external application authorised | PRG-06 Grok; PRG-04/08 ChatGPT |
| R4 | Defer implementation until scoped question wording/source review and Claude's existing task checkpoint; not blanket acceptance of all report prose | PRG-05 remains Claude-reserved |
| R5 | Accept jurisdiction-aware design, distinguishing business/work/property locality and researched applicability; do not blindly copy WA packs internationally | PRG-04 ChatGPT; PRG-05 remains Claude-reserved |
| R6 | Accept classification and role/action export checks. Uploads remain submitted until authorised review; authority-verified requires actual source evidence | PRG-03 ChatGPT |
| R7 | Reject “stored only as a warning note” for a trust transaction. Educational warnings may exist, but trust funds/receipts require separate approved accounting or an external supported process | PRG-04/08 ChatGPT; no trust build |
| R8 | Conditional source/copy design only; retain business-licence versus certificate and activity-exemption distinctions | PRG-05 remains Claude-reserved |
| R9 | Separate food/liquor/GST/employment evidence. A number or upload alone must not mark a licence granted/verified; food wording awaits the blocked source | PRG-05 remains Claude-reserved; PRG-03 acceptance ChatGPT |
| R10 | Reject blind question union/strictest privacy ranking. Use necessary scoped questions, explicit grants, purpose/applicable rules and documented conflict escalation | PRG-04 ChatGPT; PRG-05 remains Claude-reserved |

## Next bounded assignments

Grok retains PRG-06. Deliver the already completed preservation clarification and R01/R02 addenda text separately, including their original stated dates/sources and declared local paths. Do not rewrite this preserved original, fabricate remote provenance, start new overlapping research or modify runtime/coordination files. After those addenda are reviewed, the central coordinator can bound the unresolved source/date follow-up; no new research ownership is reassigned here.

Claude retains its active implementation ownership and current accepted boundaries. No PRG-05 implementation, claim adapter, trust ledger or research-file modification is assigned by this review. Queue corrections are routed through the central coordinator in the PRG-02 independent review.

ChatGPT owns the separate verification/correction notes and security acceptance. Remaining gates: four blocked source rechecks, full specialty/per-channel approval mapping where required, review of supplied addenda once received, and independently tested future acceptance criteria. Preservation is complete for the user-supplied original copy; research is not globally validated or implementation-approved.

## URL retrieval ledger

| # | Original URL | Retrieval result | Redirect observed |
|---|---|---|---|
| 1 | [Source](https://www.ahpra.gov.au/Registration/Registers-of-Practitioners/Professions-and-Divisions.aspx) | Fetch blocked; not live-verified | — |
| 2 | [Source](https://www.ahpra.gov.au/About-Ahpra/Ministerial-Directives-and-Communiques/Announcements-appointments-to-National-Boards) | Fetch blocked; not live-verified | — |
| 3 | [Source](https://www.servicesaustralia.gov.au/get-started-software-developer?context=20) | Retrieved; claim-specific checks below | — |
| 4 | [Source](https://www.servicesaustralia.gov.au/medicare-online-for-software-developers?context=20) | Retrieved; claim-specific checks below | — |
| 5 | [Source](https://www.servicesaustralia.gov.au/integrating-online-claiming-applications?context=20) | Retrieved; claim-specific checks below | — |
| 6 | [Source](https://www.servicesaustralia.gov.au/web-services-for-digital-health-channels?context=20) | Retrieved; claim-specific checks below | — |
| 7 | [Source](https://www.dva.gov.au/providers/fees-claims/provider-claims) | Retrieved; claim-specific checks below | — |
| 8 | [Source](https://www.oaic.gov.au/privacy/privacy-for-organisations/small-business) | Retrieved; claim-specific checks below | Redirect → https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/small-business |
| 9 | [Source](https://www.oaic.gov.au/privacy/health-information/what-is-a-health-service-provider) | Retrieved; claim-specific checks below | Redirect → https://www.oaic.gov.au/privacy/your-privacy-rights/health-information/what-is-a-health-service-provider |
| 10 | [Source](https://www.ndiscommission.gov.au/about-registration) | Retrieved; claim-specific checks below | — |
| 11 | [Source](https://www.ndiscommission.gov.au/provider-registration/apply-registration) | Retrieved; claim-specific checks below | — |
| 12 | [Source](https://www.ndiscommission.gov.au/workforce/worker-screening) | Retrieved; claim-specific checks below | — |
| 13 | [Source](https://www.ndiscommission.gov.au/workforce/worker-screening/worker-screening-unregistered-providers) | Retrieved; claim-specific checks below | — |
| 14 | [Source](https://www.ndis.gov.au/providers/working-provider/getting-paid) | Retrieved; claim-specific checks below | Redirect → https://www.ndis.gov.au/providers/pricing-and-payments/payments/guide-getting-paid |
| 15 | [Source](https://www.ndis.gov.au/providers/pricing-and-payments/payments/how-make-payment-request) | Retrieved; claim-specific checks below | — |
| 16 | [Source](https://www.ndis.gov.au/providers/pricing-and-payments/payments/guide-getting-paid) | Retrieved; claim-specific checks below | — |
| 17 | [Source](https://www.ndis.gov.au/providers/pricing-and-payments/pricing/pricing-arrangements) | Retrieved; claim-specific checks below | — |
| 18 | [Source](https://www.ndis.gov.au/providers/pricing-and-payments/pricing/pricing-arrangements-and-price-limits) | Retrieved; claim-specific checks below | Redirect → https://www.ndis.gov.au/providers/pricing-and-payments/pricing/pricing-arrangements |
| 19 | [Source](https://www.ndis.gov.au/providers/working-provider/connecting-ndia-systems) | Retrieved; claim-specific checks below | — |
| 20 | [Source](https://www.consumerprotection.wa.gov.au/publications/real-estate-and-business-agents-trust-account-handbook) | Retrieved; claim-specific checks below | — |
| 21 | [Source](https://www.austrac.gov.au/austrac-regulatory-expectations-implementation-amlctf-reforms) | Retrieved; claim-specific checks below | Redirect → https://www.austrac.gov.au/news-and-media/article/austrac-regulatory-expectations-implementation-amlctf-reforms |
| 22 | [Source](https://www.austrac.gov.au/news-and-media/media-release/austrac-opens-enrolment-new-professions-next-step-aml-reforms) | Retrieved; claim-specific checks below | — |
| 23 | [Source](https://www.austrac.gov.au/new-austrac/check-if-youre-regulated-and-need-enrol/check-if-you-may-be-regulated) | Retrieved; claim-specific checks below | Redirect → https://www.austrac.gov.au/new-austrac/check-if-you-may-be-regulated |
| 24 | [Source](https://www.consumerprotection.wa.gov.au/motor-vehicle-repairers-licensing) | Retrieved; claim-specific checks below | — |
| 25 | [Source](https://www.wa.gov.au/organisation/service-delivery/building-and-energy-licensing-and-registration) | Retrieved; claim-specific checks below | — |
| 26 | [Source](https://www.worksafe.wa.gov.au/) | Retrieved; claim-specific checks below | — |
| 27 | [Source](https://www.fairwork.gov.au/about-us/legislation/the-fair-work-system) | Retrieved; claim-specific checks below | Redirect → https://www.fairwork.gov.au/about-us/workplace-laws/fair-work-system |
| 28 | [Source](https://www.ato.gov.au/Business/GST/Registering-for-GST/) | Fetch blocked; not live-verified | — |
| 29 | [Source](https://ww2.health.wa.gov.au/Articles/N_R/Registration-licensing-and-notifications-by-local-governments) | Fetch blocked; not live-verified | — |
| 30 | [Source](https://www.foodstandards.gov.au/business) | Retrieved; claim-specific checks below | — |
| 31 | [Source](https://www.wa.gov.au/government/multi-step-guides/applying-liquor-licence) | Retrieved; claim-specific checks below | — |
| 32 | [Source](https://www.wa.gov.au/service/business-support/business-registration-and-licensing/advertised-liquor-licence-applications) | Retrieved; claim-specific checks below | — |
