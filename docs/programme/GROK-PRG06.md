User-supplied research; original Git provenance unverified.

GROK-PRG06 — Official-source industry and integration research

Status: research only. Not release approval, not legal advice, not clinical advice, not a compliance certificate.
Owner: Grok. Programme ID: PRG-06 only.
Repository: Umerfaizan92/Oprun.
Base: 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd.
Branch: grok/prg06-industry-research-20261128 (created from that exact SHA).
Checked date: 2026-11-28 (AWST). Page “last updated” dates below are the dates printed on those pages, not this check date.
Runtime edits: none. Shared coordination files: not modified. No accounts, credentials, calls, posts, messages, spending, deployment or deletion.

ChatGPT must validate every primary-source claim against the live page before implementation. This report does not authorise a claiming, trust-accounting, clinical-record or AML build.

How to read labels

Label	Meaning

FACT	Sentence was read from the named official page on 2026-11-28, or from source at the base SHA.
CODE	Observation of source at the base SHA. Not evidence that a live provider is connected.
INFERENCE	A product conclusion drawn from facts. Not itself a legal rule.
UNKNOWN	Not established in this batch. Do not fill the gap from memory.
REVIEW	A qualified lawyer, clinician, accountant, auditor or the regulator must decide before anyone relies on it.


Checkpoint — batch 1 of PRG-06

Completed in this batch:

- Read the programme checkpoint assignment and inspected, at the base SHA: src/industry-registry.js, src/onboarding-questions.js, src/onboarding-proposal.js, src/country-profile.js, src/country-rules.js, src/channel-providers.js, docs/release/INTEGRATIONS.md.
- Searched src/**/*.js for Medicare, Easyclaim, HICAPS, myplace, PRODA, ECLIPSE, NDIA and DVA integration names. The only hits were the letters dva inside the unrelated word “advance”, plus NDIS as an industry/question label. No claiming client was found.
- Searched for Uber, DoorDash, Menulog, PEXA, Landgate and trust-account integrations. The only hit was an expense-category regex in src/finance/service.js that mentions “uber” among travel merchants. That is not a delivery integration.
- Read the official pages cited in the matrix. Did not open developer portals, accept agreements, or download NDA-gated specifications.

Not done, and not to be invented:

- Re-reading the MBS, My Health Record conformance rules, PBS item rules, WA medicines/poisons premises rules, Residential Tenancies Act, Settlement Agents Act, Home Building Contracts Act, Food Standards Code allergen schedules, Spam Act, or every other state’s licensing statute.
- Re-validating the foreign tax rates stored in src/country-rules.js (that file says they were reviewed 2026-11-20 and must be re-checked).
- Any implementation, test run, or production inspection.

Blocker: none for this research file. External blockers for later build work are the approval gates in recommendations R2 and R3.

Exact next action: ChatGPT validates this file against the primary URLs, then PRG-05 may turn the interview recommendations into questions. Do not start a Medicare, DVA, private-health or NDIS claim adapter. No automatic continuation exists; resume by reopening this file and git rev-parse HEAD on this branch.

1. What the baseline product actually contains

CODE. The industry registry has 34 entries. Relevant codes and the regulators attached to them:

Code	Registry sources at this SHA	What that does not prove

healthcare, nursing_midwifery, allied_health, dental, pharmacy	Ahpra, and TGA on healthcare and pharmacy	Not a Medicare, DVA, PBS, ECLIPSE or private-health claim path
ndis	NDIS Commission registration and worker-screening pages	Not a myplace or NDIA API client
aged_care	Aged Care Quality and Safety Commission provider page	Not Aged Care Online claiming. Adjacent only; not fully researched here
real_estate	none	Licence and trust-account law is not wired in
construction_trades	WA Building and Energy licensing URL; WorkSafe WA	Other states and motor repair are not covered by these two links
repair_automotive	none	WA repair licensing still exists; the empty list must not be read as “no licence”
retail_ecommerce	none	
hospitality_food	FSANZ business page only	Not WA local-government food registration and not a liquor licence
veterinary	none, but the question family treats it as clinic	Veterinary surgeons are not an Ahpra profession on the register list read below


CODE. src/onboarding-questions.js asks one generic set: business, services, pricing, service area, job flow, team, staff checks, customers, hours, channels, payments, tax, marketing, tools, compliance, goals. The only industry-specific extra question is ndis_registration, and only when the industry code is ndis and the country is AU. Australian regulator names shown in the compliance hint are at most three authorities, national or matching the business’s state. A state source is hidden unless jurisdiction equals that state. The only state-specific entries in the registry are WA (Building and Energy, WorkSafe WA, Legal Practice Board WA). An NSW electrician therefore does not see an NSW licence source.

CODE. src/onboarding-proposal.js proposes one industry profile. Stages are enquiry, quotation, booking, allocation, execution, completion, invoice, payment. Clinic and care families turn quotation off. Retail turns quotation and allocation off. A solo team turns allocation off. Enquiry and payment cannot be removed. Nothing is applied until an owner or admin ticks consent version 2026-11-24. There is no hybrid field and no second industry code anywhere under src/.

CODE. src/country-profile.js is the international switch that exists today: ISO country, Australia-only ABR / ABN / VEVO / worker-compliance pack, and a tax label. It does not contain health, NDIS, licensing or claim rules for any country. src/country-rules.js holds invoice/tax presentation for many countries, with RULES_REVIEWED_AT = '2026-11-20' and an in-file warning to re-check. Australia’s tax-invoice retention figure in that file is 5 years. That figure is a code constant. It was not re-validated against an ATO record-keeping page in this batch, and it is not a health-record retention period.

CODE. docs/release/INTEGRATIONS.md at this SHA lists evidence limits, not new audit results: Stripe test-mode settlement remains open as T-057; Telnyx live-call evidence remains T-055; WhatsApp/social is draft/approval support and must not be described as direct replies or external publishing where that is not implemented; Google live credentials are not certified. src/channel-providers.js names meta, WhatsApp, YouTube, Gmail, TikTok, X, Google Business Profile, Google Search & Analytics, Snapchat, website, and email/SMS. channelCapabilities() sets ads_launch: false for every provider. Snapchat is named, but it is not in the sync/post provider list; src/integration-insights.js says Snapchat Public Profile insights need separate approved API access. Resend and Telnyx HTTPS calls exist in source. Presence of a call site is not a live approval, a sandbox result, or permission to send.

INFERENCE. Registry presence is a setup catalogue. It is not a functioning clinical, claims, trust or food-safety system.

2. Jurisdiction model to configure, not a world survey

FACT, product scope. This batch researched Australia, with Western Australia where the rule is state or local. It did not research other countries’ health, disability, property, trade, retail or food rules.

Layer	What was checked	What must stay configurable

Federal	Medicare/DVA/PBS channels, Ahpra, Privacy Act, GST, Fair Work coverage, NDIS, AUSTRAC, FSANZ	A non-AU business must not inherit these rules
State	WA repair licensing, WA liquor, WA food enforcement, WA real-estate trust handbook, WA industrial-relations coverage for some employers	Each AU state needs its own source list. WA URLs must not show for VIC, NSW, QLD, SA, TAS, ACT or NT
Local	WA food registration/notification is administered by the local enforcement agency	Local government is not stored as a first-class place in the question builder
International	Country code, tax label and invoice warning only, and those foreign rates were not re-checked today	Do not claim HIPAA, NHS, GST of another country, or any foreign claim API was researched


INFERENCE. The data needed later is (country, state_or_region, locality) plus an activity pack. Country alone is not enough inside Australia. Activity packs for other countries stay empty until a later dated research batch.

3. Healthcare specialties, Medicare, DVA and private health

Industry: medical, nursing, midwifery, dental, pharmacy and the Ahpra allied-health specialties in the registry. Jurisdiction: Commonwealth claiming and privacy; Ahpra is national; premises, drugs and public hospitals also have state rules that were not fully read.

3.1 Registration is not a claim

FACT. Ahpra’s public register UI lists these professions: Aboriginal and Torres Strait Islander Health Practitioner, Chinese medicine practitioner, chiropractor, dental practitioner, medical practitioner, medical radiation practitioner, midwife, nurse, occupational therapist, optometrist, osteopath, paramedic, pharmacist, physiotherapist, podiatrist, psychologist. An Ahpra page also says the Ministerial Council appoints the Ahpra Board and the 15 National Boards. Checked 2026-11-28. Register professions: https://www.ahpra.gov.au/Registration/Registers-of-Practitioners/Professions-and-Divisions.aspx. Board count: https://www.ahpra.gov.au/About-Ahpra/Ministerial-Directives-and-Communiques/Announcements-appointments-to-National-Boards.

FACT. Speech pathologist does not appear in that profession list. The registry still attaches only Ahpra to allied_health, whose specialties include speech pathology. CODE plus FACT. That source link is incomplete for speech pathology.

UNKNOWN. Which non-Ahpra professions DVA will pay, and under what credentials. A DVA allied-health page lists a wider set of provider types, including dietitian, exercise physiologist, social worker and speech pathologist. That page was seen in search results and was not line-read in full. Do not treat the search snippet as the rule. REVIEW.

UNKNOWN. Provider numbers. A Medicare provider number is a separate Services Australia identifier from Ahpra registration. The application steps were not re-read in this batch. Do not invent them.

3.2 Medicare Online, DVA and private health are gated software channels

FACT. Services Australia, “Get started as a software developer”, last updated 15 September 2025, printed from the site on 28 November 2026: https://www.servicesaustralia.gov.au/get-started-software-developer?context=20.

- Developing integrated software requires registration for the Health Systems Developer Portal.
- Steps named on the page: individual PRODA account; a legally authorised officer registers the organisation; Services Australia reviews eligibility and then issues sign-in details; invite staff; read and accept the Interface Agreement before development resources; preliminary testing; integration testing. “Your software must pass all tests.” “We’ll issue a Notice of integration (NOI) when we approve your software.”
- Channels named: Aged Care Online claiming, AIR, Healthcare Identifiers Service, ECLIPSE, Medicare Online, MyMedicare web services, PBS Authorities, PBS Online.
- OTS development advice also names Medicare Easyclaim and My Health Record.
- The page mentions a vendor environment for technical issues. It does not say the public internet offers an unauthenticated sandbox.

FACT. “Medicare Online for software developers”, last updated 26 November 2024: https://www.servicesaustralia.gov.au/medicare-online-for-software-developers?context=20. Medicare Online covers patient claiming (real-time and store-and-forward), same-day delete for real-time patient claims only, bulk bill, DVA medical and pathology, AIR notifications, online patient verification for Medicare and private health insurers, ECLIPSE, in-hospital claims to Services Australia and private health insurers, and online eligibility checks. No sandbox is mentioned on that page.

FACT. “Integrating online claiming applications”, as returned in search and consistent with the developer page, says Medicare Easyclaim development is done together with a financial institution, and to contact that institution. ECLIPSE includes in-patient medical claims to both Medicare and private health insurers. Web services replaced adaptors for PBS Online, Medicare Online (including DVA and AIR) and ECLIPSE from 31 March 2023. Checked via https://www.servicesaustralia.gov.au/integrating-online-claiming-applications?context=20 and https://www.servicesaustralia.gov.au/web-services-for-digital-health-channels?context=20.

FACT. DVA “Provider claims”, last updated 28 September 2026: https://www.dva.gov.au/providers/fees-claims/provider-claims.

- Claims are processed by the Veterans’ Affairs Processing Team at Services Australia.
- There is a strict 2-year time limit. The same page says that from 1 July 2027 the limit becomes 1 year.
- Three methods are named: DVA Webclaim (free, through HPOS via PRODA); practice-management software; and Medicare Online claiming for DVA contracted community nursing, only with compatible software.
- Some services need prior financial authorisation.
- The page does not describe a developer API or a sandbox. Software access is the Services Australia path above, not a DVA-specific public API found in this batch.

UNKNOWN. MBS and DVA fee-schedule item numbers were not extracted. Catalogue location for MBS is the public MBS site; this batch did not re-read it. Do not hardcode items or fees. REVIEW for any item-number logic.

UNKNOWN. My Health Record conformance, NASH certificates and the My Health Records Act were not re-read. The developer page only shows that OTS will talk about My Health Record. No Oprun upload path exists in source. CODE.

UNKNOWN. Commercial health-fund terminals (including names such as HICAPS, Tyro Health or HealthPoint) were not found in Oprun source and were not read as government APIs. Easyclaim’s own instruction is to contact the financial institution. Do not mark any of them available.

3.3 Privacy, roles, retention

FACT. OAIC: a health service provider is covered by the Privacy Act even if annual turnover is $3 million or less, and even if health is not its primary activity. Examples include GPs, private hospitals, dentists, pharmacists, allied health, complementary therapists, disability providers who handle health information, and telehealth. Small-business page: https://www.oaic.gov.au/privacy/privacy-for-organisations/small-business. Health-service definition: https://www.oaic.gov.au/privacy/health-information/what-is-a-health-service-provider. Both pages were published/reviewed material current on the OAIC site when read 2026-11-28; the copies inspected show a 10 March 2023 publication line. REVIEW before treating any edge business (gym, massage, beauty) as outside the definition.

UNKNOWN. There is no single retention period in the material read here. The 5-year figure in country-rules.js is a tax-invoice constant, not a clinical-record rule. Professional boards, Medicare claim records and state public-sector rules can differ. REVIEW.

CODE / INFERENCE. Patient identifiers, claim payloads, clinical notes and referral documents would be sensitive information. The current workspace stores ordinary onboarding, jobs and finance against organisation_id. That tenant key is necessary and not sufficient for health information. There is no separate clinical consent, break-glass, or claim-audit partition in the files inspected.

Roles to ask about, not to invent authority for: practice owner, practitioner with a provider number, receptionist, billing clerk, clinical reviewer. A receptionist role that can export every clinical note is a product defect even if the tenant id matches. REVIEW with PRG-03.

3.4 Interview questions (product recommendations, not a legal form)

Ask only after the owner confirms the country is AU. Do not ask these of a non-health business.

1. Which activities do you perform (GP, specialist, telehealth, nursing, midwifery, dental, pharmacy, named allied health)?
2. Is each practitioner currently on the public Ahpra register for that profession? Speech pathology and other non-Ahpra professions must not be forced through the Ahpra question alone.
3. Do you bulk bill, patient-claim, bill DVA, bill a private fund, or take private fees only?
4. Who is allowed to see patient details, and who is allowed to prepare a claim?
5. Do you want Oprun to store clinical notes, or only appointments and invoices?

Evidence to record as the customer’s own documents, not as Oprun-verified truth: Ahpra registration evidence the customer uploads, insurance, privacy notice, and a statement of who may access records. Do not scrape the Ahpra register or call Medicare in this phase.

Workflow that is safe to configure now: enquiry, appointment, invoice, private payment. Workflow that is unsupported: submitting a Medicare, DVA, PBS, ECLIPSE, Easyclaim or fund claim.

Acceptance scenarios:

- A healthcare workspace has no control that says a claim was lodged, paid or rejected by Services Australia.
- Tenant A cannot read tenant B’s patient or invoice rows (this remains a PRG-03 test, not a result of this batch).
- A speech-pathology answer does not display “Ahpra registration” as if it were the sole legal source.
- Non-AU country: these questions do not appear, and no Australian claim rule is copied into that workspace.

4. NDIS

Industry: disability supports. Jurisdiction: Commonwealth (NDIA and NDIS Commission). Worker screening is administered by the state or territory unit. The WA application portal was not re-read.

4.1 Registration, screening, claiming, price

FACT. NDIS Commission, “About registration”, read 2026-11-28: https://www.ndiscommission.gov.au/about-registration. A registered provider has been checked and audited against the NDIS Practice Standards, key personnel and workers in risk-assessed roles need an NDIS worker screening clearance, and the provider needs complaint and incident systems. The apply page requires an ABN and evidence of ability to deliver the registration groups: https://www.ndiscommission.gov.au/provider-registration/apply-registration.

FACT. Worker screening, read 2026-11-28: https://www.ndiscommission.gov.au/workforce/worker-screening. Checks are done by the state or territory unit, are national, and last up to 5 years. Registered providers must screen risk-assessed roles and key personnel. From 12 October 2026, registered and deregistered providers use the new NDIS Commission Portal for worker screening. Unregistered providers are not legally required to screen, though the Commission recommends it, and self-managed or plan-managed participants may require it: https://www.ndiscommission.gov.au/workforce/worker-screening/worker-screening-unregistered-providers.

FACT. How payment works, pages read 2026-11-28:

- https://www.ndis.gov.au/providers/working-provider/getting-paid and https://www.ndis.gov.au/providers/pricing-and-payments/payments/how-make-payment-request: all claims for payment are submitted in the myplace provider portal, as a single payment request or a bulk CSV upload. Plans in the new computer system must use the bulk upload. Being recorded as “my provider” is required for some of those claims.
- Self-managed participants are invoiced and pay the provider; they claim in the participant portal or app. Plan managers receive the invoice and claim in the provider portal. NDIA-managed claims are payment requests by the provider.
- “Guide to getting paid” says payment requests must be submitted within 2 years after the support was delivered, that claims more than 90 days after full delivery get extra checks, and that valid claims from my providers are usually paid within 2 to 3 business days: https://www.ndis.gov.au/providers/pricing-and-payments/payments/guide-getting-paid.
- An older “Getting paid” wording also says “from 3 October 2025 you have 2 years” and that the rule came into effect on 3 October 2024. Both pages were live on the check date. Do not pick a silent winner. Use the page that applies on the service date after ChatGPT re-reads it. REVIEW.

FACT. Pricing pages disagree in presentation and the site warns that pages are being updated for new legislation. “Pricing arrangements”, page stamp 26/11/2026, says the Minister’s determination sets 2026–27 maximum prices and links a schedule effective 24 September 2026: https://www.ndis.gov.au/providers/pricing-and-payments/pricing/pricing-arrangements. “Pricing arrangements and price limits”, stamp 11/06/2026, still offers a 2025–26 PAPL effective 24 November 2025: https://www.ndis.gov.au/providers/pricing-and-payments/pricing/pricing-arrangements-and-price-limits. “Pricing updates” says the page is current as of 3 November 2026. INFERENCE. Oprun must not embed a dollar amount from either PDF. The provider enters a price; a person checks the schedule in force on the day of support.

UNKNOWN. Which support types legally require registration (for example behaviour support or SDA) was not tabulated from the rules. The registry specialties include behaviour support, SIL and plan management. Do not assume an unregistered provider may claim NDIA-managed funding. REVIEW.

4.2 NDIA APIs are real and closed

FACT. “Connecting with NDIA systems”, last updated 19 June 2024: https://www.ndis.gov.au/providers/working-provider/connecting-ndia-systems.

- The NDIA has APIs for registered providers, plan managers and software developers, for “controlled and secure access to specific NDIA data”.
- “Applying for access to these APIs does not guarantee we will grant you access.”
- Direct applicants complete a Digital Provider questionnaire, cyber-clearance evidence, an architecture, a recent ASIC extract, and API terms, then send them to the Digital Partnership Office.
- Entities must test against all NDIA APIs. Early testing is not approval.
- If approved, the NDIA sends a technical pack, the applicant registers a PRODA test account, and specifications are read inside the vendor developer portal.
- “Software developers or aggregators must partner with a registered provider if they want to access the NDIA APIs” and complete extra cyber activities.
- The public page does not list endpoints. It does not say that payment requests are in the API. UNKNOWN until an approved technical pack says so.

CODE. Oprun has no NDIA client, no PRODA client, and no bulk-payment CSV writer.

4.3 Sensitive data

Participant name, NDIS number, plan dates, support notes, incident reports and screening status are sensitive. Disability providers who hold health information are inside the OAIC health-service examples. Screening results must not be copied into a general staff note that every role can export. REVIEW for retention of incidents, complaints and screening evidence. The Commission pages read here require records and systems; they do not state a single year count.

Interview questions (recommendations):

1. Are you registered, applying, or unregistered? Which registration groups?
2. Do you support NDIA-managed, plan-managed, self-managed, or a mix?
3. Which staff are in risk-assessed roles, and will you record clearance identifiers rather than document images?
4. Who may see participant details, incidents and complaints?
5. Do you want Oprun to prepare an invoice the participant or plan manager can pay, with no statement that NDIA has been claimed?

Acceptance scenarios:

- No button submits a payment request to myplace or an NDIA host.
- An exported “claim pack” is labelled “not lodged”.
- A worker in tenant A is not visible to tenant B.
- Price fields do not auto-fill a dollar cap from this report.
- Unregistered plus “NDIA-managed” shows “check whether registration is required” rather than a claim form. REVIEW the wording.

5. Real estate (start WA)

Industry: sales, property management, buyer’s agency, commercial, strata, rentals. Jurisdiction split: WA licensing and trust accounts; Commonwealth privacy and, for designated services, AML/CTF; bonds, tenancies and settlement were not re-read.

FACT. Consumer Protection WA, trust-account handbook page, last updated 28 August 2026: https://www.consumerprotection.wa.gov.au/publications/real-estate-and-business-agents-trust-account-handbook. Agents who hold or receive money on behalf of others in a WA real-estate transaction must keep trust accounts. The page names the Real Estate and Business Agents Act 1978, the General Regulations 1979, and a section 70 audit. The handbook says it is not a full accounting text. The page still names the Department of Energy, Mines, Industry Regulation and Safety. Other WA pages use other department titles. Do not hardcode one department string as the only legal name. REVIEW.

FACT. AUSTRAC, read 2026-11-28:

- Reforms commence 31 March 2026 for already regulated businesses and 1 July 2026 for newly regulated legal, accounting, real estate and jeweller services: https://www.austrac.gov.au/austrac-regulatory-expectations-implementation-amlctf-reforms.
- Enrolment for those new professions opened 31 March 2026: https://www.austrac.gov.au/news-and-media/media-release/austrac-opens-enrolment-new-professions-next-step-aml-reforms.
- From 1 July 2026 the law extends to certain services of real estate agents and property developers, among others. Not every task an agency performs is necessarily a designated service. AUSTRAC tells businesses to use the checker: https://www.austrac.gov.au/new-austrac/check-if-youre-regulated-and-need-enrol/check-if-you-may-be-regulated.
- This check date is after 1 July 2026. That does not let Oprun decide that a particular customer is a reporting entity. REVIEW.

UNKNOWN. Residential tenancies, bond lodgement, strata rules, settlement-agent licensing, and any PEXA or Landgate developer API were not read. CODE shows no such integration. Do not invent one.

CODE. real_estate has an empty sources array. Ordinary finance invoices are not a trust ledger.

Interview questions (recommendations): WA first; other states need their own statute before the same questions are shown.

1. Sales, property management, buyer’s agent, settlement, or a mix?
2. Will you hold other people’s money? If yes, Oprun must say it is not the trust-account book.
3. Which state is the property in? A WA handbook must not appear for a Victorian trust account.
4. Have you checked AUSTRAC’s “may be regulated” questions? Oprun does not enrol the agency.

Acceptance: no trust-receipt balance is stored in the ordinary invoice table; no AUSTRAC report is sent; tenant isolation applies to vendor and tenant personal information; identity-document images are not requested until a later privacy design. REVIEW before any KYC feature.

6. Tradies and mechanics (start WA)

6.1 Motor repair is still licensed in WA

FACT. Consumer Protection, “Motor vehicle repairers licensing”, last updated 8 January 2025: https://www.consumerprotection.wa.gov.au/motor-vehicle-repairers-licensing. The page names the Motor Vehicle Repairers Act 2003. It says a repair business licence is required for an owner, a self-employed repairer, a mobile operator, or an employer of a certified repairer. A repairer’s certificate is required to repair unsupervised, supervise others, or do work the supervisor is not certified for. Parts manufacturing without fitting is exempt; repairing, modifying or servicing is not. Detailing and some accessory fitting are among the listed exemptions; the page says the accessory list is not exhaustive and that work affecting performance, safety or security (airbags are the example) needs a certified repairer.

CODE. repair_automotive has no regulatory source, while its specialties include mechanic, auto electrical, panel beating and detailing. INFERENCE. Showing no regulator is more dangerous than showing the Consumer Protection URL, because a reader can mistake silence for “no licence”. Detailing must not be given the same mandatory-certificate wording as mechanical repair. REVIEW the exemption boundary.

6.2 Construction trades

CODE. construction_trades points only at https://www.wa.gov.au/organisation/service-delivery/building-and-energy-licensing-and-registration and https://www.worksafe.wa.gov.au/. Those pages were not re-read in this batch. UNKNOWN: whether that department URL is still the current form after later machinery-of-government changes. Do not describe electrician, plumber, gas, painter or builder classes from memory.

UNKNOWN. Home Building Contracts Act thresholds, insurance and owner-builder rules were not read.

FACT. Fair Work Ombudsman, “The Fair Work system”, read 2026-11-28: https://www.fairwork.gov.au/about-us/legislation/the-fair-work-system. In Western Australia the state system covers state public sector employers, sole traders, partnerships, other unincorporated entities and non-trading corporations. A WA sole trader who incorporates may move to the national system. A separate FWO page says a WA sole trader is generally outside the national system except for an employee based in another state or territory. From 1 January 2023, WA local government is in the state system. National-system coverage is the default for proprietary companies and other constitutional corporations. INFERENCE. A single modern award rate must not be applied to every WA tradie, retailer or restaurant. REVIEW which industrial instrument applies.

Interview questions (recommendations):

1. Trade: building, electrical, plumbing, gas, mechanical repair, auto electrical, panel, detailing, or several?
2. State of the work, and whether the business is a sole trader, partnership or company?
3. Will you upload licence or certificate numbers as your own evidence, without Oprun calling a register?
4. Do you hold deposits or progress payments? That is not the same as a real-estate trust account, and the home-building rules were not researched here.

Acceptance: a mechanic in WA sees the repair-licensing source; a detailing business sees the exemption warning; a NSW builder does not see the WA Building and Energy link as if it were NSW law; no award rate is calculated.

7. Retail and restaurants

7.1 Retail

FACT. ATO “Registering for GST”, read 2026-11-28: https://www.ato.gov.au/Business/GST/Registering-for-GST/. GST registration is required at a GST turnover of $75,000 or more ($150,000 for non-profit organisations). The page also records the taxi and ride-sourcing exception. Turnover is not profit. Voluntary registration exists. This is not a retail “licence”.

UNKNOWN. Australian Consumer Law refund rules and the General Retail Industry Award text were not re-read. Do not hardcode remedy periods or pay rates. REVIEW.

CODE. Retail has no industry source. The proposal uses an order-shaped pipeline (no quotation or allocation by default) and still keeps invoice and payment. Card data: no evidence in the inspected files that Oprun stores PAN data. Stripe, as described in docs/release/INTEGRATIONS.md, is the platform payment integration with T-057 still open. It is not a scheme-compliance certificate. CODE.

7.2 Food and liquor

FACT. WA Health says local governments enforce registration, licensing and notification under the Food Act 2008 and Public Health Act 2016. The page inspected was last reviewed 23 September 2021: https://ww2.health.wa.gov.au/Articles/N_R/Registration-licensing-and-notifications-by-local-governments. A WA Health information sheet states that a food business must register with the enforcement agency or notify it, and that local governments keep the register. The sheet is older operational guidance (the PDF inspected carries a 2021 context). Do not collapse “notify” and “register” into one step. The local government decides. FSANZ is already the registry’s only hospitality source and itself says state, territory and local enforcement also apply. CODE plus the FSANZ URL already stored: https://www.foodstandards.gov.au/business.

UNKNOWN. The Food Standards Code allergen schedule was not re-read. Do not ship an allergen checklist from memory. REVIEW.

FACT. WA Government: a liquor licence is required to sell and supply liquor in WA under the Liquor Control Act 1988. Restaurant licence is one of the named types. The Department of Local Government, Sport and Cultural Industries determines applications. https://www.wa.gov.au/government/multi-step-guides/applying-liquor-licence and https://www.wa.gov.au/service/business-support/business-registration-and-licensing/advertised-liquor-licence-applications. A food business is not automatically a licensed venue.

CODE. No Uber Eats, DoorDash, Menulog or other marketplace adapter exists. “Delivery” in this product, where it exists, is email/SMS/voice (Resend, Telnyx), not meal delivery.

Interview questions (recommendations):

1. Shop, online store, cafe, restaurant, takeaway, catering, or several?
2. Which local government would you notify or register a food business with? Oprun does not lodge the form.
3. Will alcohol be sold or supplied? If yes, point to the WA liquor page when the state is WA, and stop there.
4. Are you registered for GST, not registered, or unsure? Unsure must not be stored as a tax determination.

Acceptance: a restaurant workflow can book and invoice; it cannot display “food business registered” or “liquor licence granted” unless a person recorded an external evidence number; no marketplace order is imported; allergen fields stay free text until a reviewed code list exists.

8. Hybrid businesses

CODE. One industry_code is stored. guessIndustry() picks a single best keyword score. Families then change questions and stages. A workshop that also sells parts, or a clinic that also runs an NDIS therapy roster, cannot carry both packs.

INFERENCE. Hybrid is a composition problem, not a new industry code and not a new legal category. The recommended rule, for PRG-05, is: the owner attaches one or more researched activity packs; the workspace shows the union of their questions; the strictest data rule wins (health/NDIS privacy beats ordinary retail CRM); claiming stays off for every pack. A pack that has not been researched for that country/state must appear as “not researched”, not as a silent copy of WA.

Acceptance scenario: test fixture “WA mechanic plus counter retail” shows repair-licence questions and retail GST questions, keeps one tenant, and still has no Medicare or NDIS claim control.

9. Delivery, communications, social and marketing

These are product integrations, not industry regulators. Status is source evidence only.

Path	CODE at base SHA	Official or provider gate	Unsupported claim

Email	Resend call sites exist	Provider account and verified sender are operational facts, not established here	Do not claim inbox placement or that a campaign was sent
SMS	Telnyx message call sites exist	A Telnyx account and number are required. Not checked	Do not claim consent or Spam Act compliance. Spam Act text was not read
Voice	src/comms/voice.js and INTEGRATIONS.md	INTEGRATIONS.md says live staging calls remain T-055	Do not claim a production call was verified in this batch
Social post/reply	Adapters for meta, X, YouTube, TikTok, Google Business, Gmail	Each provider has its own app review. Not inspected	ads_launch is false. Paid ads are not enabled by the adapter
Snapchat	Name and an insights warning only	Public Profile API called out as separate	Do not list Snapchat as a working publisher
Website	Contact/visit paths described in older docs; not re-tested	DNS verification is a product feature, not a regulator API	
Stripe	Named in INTEGRATIONS.md	Test-mode settlement/refund evidence still T-057	Not a Medicare or health-fund settlement rail
Meal marketplaces, ELNO, Medicare, NDIA	Absent	See sections 3, 4 and 5	Absent means unsupported, not “hidden but working”


Marketing quiet hours in country-rules.js are a product control. They are not a determination that a message is legal. REVIEW for health appointment reminders versus commercial promotion, and for WA state-system employers’ separate rules.

10. Ten recommendations

Maximum ten, mapped to programme IDs. None of these is permission to build inside this branch.

ID	Maps to	Recommendation	Acceptance	Depends on

R1	PRG-06, blocks PRG-08	Keep Medicare, DVA, PBS, ECLIPSE, Easyclaim, private-fund and NDIS lodging out of the product until a later approved project	Tests show no UI or route that reports a government claim as sent, paid or rejected. A two-tenant fixture cannot read the other tenant’s health or participant rows	PRG-03 for the isolation test. No external account
R2	PRG-04, PRG-08	Do not design a Services Australia adapter as if it were a normal API key	A design note names PRODA, the Interface Agreement, preliminary test, integration test and NOI. No client is merged without the owner showing an NOI for that product	Owner enrolment. Not this research branch
R3	PRG-04, PRG-08	Treat NDIA APIs as closed	The public page is cited. No endpoint is coded from guesswork. A file the user downloads is labelled “not lodged” if a later story adds an export	Registered-provider partnership, DPO approval, technical pack. REVIEW
R4	PRG-05	Add the interview questions in sections 3–7 as optional, owner-approved questions	Questions render only for the matching activity and country/state. ndis_registration remains the only extra question until this lands. Consent version changes only in a PRG-05 change	This file accepted by ChatGPT
R5	PRG-05	Store country, AU state and, for food, local government. Hide WA sources for every other state	Fixture: NSW builder does not see WA Building and Energy as its regulator. Non-AU business sees no Medicare or NDIS question	Existing countryProfile()
R6	PRG-03	Classify health and NDIS participant data before any new clinical column	A role without an explicit grant cannot export notes, NDIS numbers, claim drafts or screening status. Tax retention of 5 years is not reused as the health retention rule	Security review. REVIEW the retention period
R7	PRG-05	Real estate: show the WA trust-account handbook and the AUSTRAC checker. Do not build a trust ledger or an AUSTRAC filing	Attempting to record “trust receipt” in ordinary invoices is rejected or stored only as a warning note that it is not the legal trust book. No enrolment call	Qualified agent/accountant before any trust feature
R8	PRG-05	Mechanics: attach the Consumer Protection repair page. Do not reuse the construction licence link. Split detailing from repair	WA mechanic fixture shows the Act 2003 page. Detailing fixture shows that some accessory and cleaning work is exempt and that the exemption is not a general “no licence” finding	None beyond copy review
R9	PRG-05	Food, liquor, GST and awards stay separate evidence items. No marketplace connector	Restaurant fixture can require a reminder to check local food notification and, if alcohol is yes, the liquor page. GST “unsure” is not stored as registered. No award dollar figure	Local rules. REVIEW
R10	PRG-05	Hybrid means several activity packs on one tenant, with the strictest privacy rule and claiming still off	“Mechanic plus retail” and “clinic plus NDIS” fixtures keep one organisation id, show both question sets, and create no claim	R1, R4, R6


11. Implemented, gap, or unsupported

Need	Implemented at base SHA	Gap	Unsupported until an external approval

Industry catalogue and owner-approved workspace	Yes, one industry code	Hybrid packs, state-correct sources	
AU vs other country tax label	Yes, as configuration	Foreign rates not re-checked 2026-11-28	
Medicare / DVA / private health / PBS claims	No	Education and negative UI so staff do not think it works	Services Australia NOI; Easyclaim needs a financial institution
NDIS evidence, invoices, incidents	Registry and one question only	Question pack, access control, “not lodged” exports	NDIA API approval; myplace remains the official lodge path
Ahpra as a link	Yes, as a URL on some rows	Wrong or missing for speech pathology and veterinary	Do not scrape the register without a separate decision
WA repair licensing	No	Link and question	
WA real-estate trust and AML	No	Warning and checker link	Trust ledger and AUSTRAC reporting are out of scope
Food and liquor	FSANZ link only	Local food and WA liquor questions	Lodging applications
Email, SMS, voice, social drafts	Code present to the extent in section 9	Live evidence still bounded by INTEGRATIONS.md	Provider app review; ads_launch stays false
Meal delivery and e-conveyancing	No		No official build decision


12. Preservation

This file is the only artefact this assignment may add. Shared coordination files were left untouched on purpose.

Next action for ChatGPT: open this path on grok/prg06-industry-research-20261128, confirm the parent commit is 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd, and re-fetch each URL in sections 3–7 before any PRG-05 question text is written. Next action for Grok, only if a later assignment says so: research one unread gap (MBS schedule rules, My Health Record conformance, WA tenancy bonds, or non-WA licence registers). Do not resume that work from chat memory.
