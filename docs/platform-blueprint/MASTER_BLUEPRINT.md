# Oprun — global platform and operator blueprint

Prepared for Faizan • 12 November 2026 • Candidate and roadmap, not production certification

## 1. Outcome, scope and evidence

Oprun should become a dependable operating system for service businesses: capture an enquiry, qualify it, quote, book, allocate eligible staff, complete the job, invoice, collect payment and follow up, with one consistent customer history. More menu entries alone do not establish superiority.

This blueprint combines the earlier read-only HighLevel trial audit with current repository inspection and Render metadata. The initial baseline was main ff4efc84cb817fdca596addfda3935a25406b91e, matching Render at the inspected snapshot. During work, main advanced to 7310f6c6033dcda0caaa8d0dd174091f340e8d93 (frontend density batch 2). The candidate incorporates that newer main; deployment of that newer main was not reverified here. Auto-deploy was off at the inspected snapshot. No production deployment, provider purchase, credential rotation or live campaign occurred.

The inspected HighLevel trial showed a broad CRM/marketing ecosystem, draft workflows and disconnected or unconfigured services. Those account states describe this trial, not all HighLevel customers. HighLevel mobile was examined through official documentation and the agency mobile options screen; the native mobile app was not operated on a phone.

Evidence levels: source present, candidate tested, signed-in UI observed, provider sandbox verified and production journey verified are separate. No item becomes Done merely because a route, checkbox, credential or successful HTTP response exists. The finite register is the acceptance baseline; new provider changes and findings must add versioned rows.

## 2. Benchmark choices and how to beat them

Use HighLevel as the primary CRM/marketing/agency benchmark. Use HubSpot, Salesforce and Zoho One as three broad platform benchmarks, selected for relevance, not represented as an objective world ranking. Also use Jobber, ServiceTitan and Housecall Pro for field-service/mobile standards.

HighLevel: benchmark the complete social/inbox/calendar/website/reputation/automation/agency/mobile experience and provisioning visibility. HubSpot: benchmark a unified CRM, integration ecosystem and governed agents. HubSpot already advertises AI guardrails and approvals; those are not unique Oprun claims.

Salesforce: benchmark customizable data, automation, reporting and extensibility, observing edition entitlements. Zoho One: benchmark breadth across sales, service, finance, people and operations and coherent navigation. Field-service products: benchmark dispatch, job evidence, mobile technician tasks and customer self-service.

Differentiation hypothesis: faster service-business onboarding; truthful connection/action readiness; excellent field workflows; one controlled AI action system; transparent all-in costs; global language access; and an operator console that proves recovery and service health. Validate with equivalent scripted tasks, equal budgets and customers, rather than an invented competitor score.

Proposed acceptance targets, not current measurements: at least 95% successful unassisted core task completion in pilot tests; WCAG 2.2 AA review; p75 LCP <=2.5s and INP <=200ms on agreed devices; 99.9% core availability objective; no unresolved critical/high release-blocking security defects; no duplicate financial/provider side effects in injected-failure tests. Propose RPO <=15min and RTO <=4h for the initial service, then prove and price the architecture to meet them.

## 3. Current implementation and what remains

Existing source includes durable jobs, approval-oriented automation, tenant integrations, website builder/publish routes, SEO, communications, finance, workforce, operator permissions, reliability/backup functions and Web Push. Preserve these and their routes, IDs, tenant guards, data and approvals. Do not rebuild a working module merely to adopt another frontend framework.

Specific gaps: registrar purchasing and managed number/assistant provisioning are not complete self-service products; TikTok read/metrics is not public video publishing; Snapchat is not implemented in the reviewed connection health; a single catalogue action workflow is not a general visual branching engine; store build assets are not an approved mobile release.

The new candidate adds per-person, per-workspace language preference storage; a broad language/locale catalogue; pilot English/Hindi/Urdu/Arabic text for the language panel and selected header controls; safe English fallback; default script direction and shell RTL overrides; locale formatting helpers; and an operator coverage page. Whole-workspace translation, native-speaker signoff and all-device RTL certification remain pending.

Provider readiness currently contains some Boolean configuration flags and an operator overview hardcoded preview version. Treat these as findings: future health reports must distinguish configured, authorized, eligible, verified and last-successful action, and the release label must come from the build/deploy artifact.

## 4. Product structure and original design direction

Business sidebar: Today; Work; Customers; People; Communications; Growth; Money; Setup. Keep current aliases and nested navigation. Today is a compact command centre: one command bar, priorities requiring action, today’s jobs, operational status and recent outcomes. Business identity stays clear without repeated large cards.

Setup includes a Connection & Services Hub with search and filters: Social; Email & Calendar; Phone & AI Receptionist; Website & Domains; Payments; Accounting; Storage & Documents; Other apps. Each card shows supported actions, current business account, last successful check, cost/limits and one appropriate next action. Do not show a working-green indicator merely because an OAuth flow completed.

Visual direction preserves the current graphite/midnight base, gold actions, cyan live signals and violet AI cues. Use a restrained 4/8px spacing system, compact 14-16px body text, clear hierarchy, 44px touch targets, accessible contrast and reduced-motion support. Responsive tables collapse to purposeful mobile cards; critical totals and actions stay visible.

Language is a globally reachable preference, not a buried founder setting. Keep preference language, content language, voice language, legal jurisdiction, timezone and billing currency separate. A person can choose Urdu without changing the currency, permissions, tax rules or customer message language.

Design states required for every page: first-use empty, loading, normal, permission denied, plan limited, reconnect needed, pending provider review, stale data, partial outage, error recovery and success with evidence. Include keyboard/focus states and screen-reader descriptions. Original screen sketches in this report are proposals, not screenshots of working functionality.

## 5. Backend architecture and safe evolution

Retain the current modular Node/Express application and durable SQLite queue while the single-instance design is supported. All requests derive tenant identity from verified session membership. Extend modules behind explicit contracts, separate business and operator authorities, and enforce action-level grants server-side. Do not introduce a new database/queue fleet just to look enterprise.

For scale, plan an isolated migration to PostgreSQL with tenant keys, tested transactions and optional row-level defense, plus durable workers and object storage. Multiple app instances cannot share the current local SQLite file as if it were a distributed database. Migration requires backup/restore evidence, data reconciliation, cutover and rollback plans before approval.

Business objects: contacts, organizations, locations, opportunities, quotes/revisions, bookings, work orders, staff assignments, job evidence, invoices/credit notes, payments, conversations/messages, consent records, workflows/versions/runs, approvals, integration accounts/resources, service orders, localized templates and audit events. Persist currency in integer minor units with its currency exponent metadata; use explicit timezones and UTC instants.

Every consequential action follows authorization -> validated immutable payload -> cost/consent checks -> approval where needed -> durable job -> provider call with idempotency -> receipt -> webhook/poll reconciliation -> verified outcome -> audit. Provider timeout is an unknown outcome, not automatic failure that licenses an immediate second purchase.

Record event schema version, event ID, tenant, actor, subject, correlation ID, timestamp, payload hash and causation. Use a transactional outbox for post-commit events. Maintain per-provider rate budgets and per-tenant concurrency. Treat queue leases, duplicate callbacks, out-of-order delivery and cancellation as normal operating cases.

## 6. Provider connections and provisioning journeys

Self-service connections use the subscriber’s provider consent screen, not collection of social passwords. Oprun still needs a registered platform app and client credentials; each subscriber authorizes their own assets and scoped tokens. Tokens are encrypted, resource selection is tenant-bound and disconnect revokes/cleans only that connection. Refresh is maintained when the provider permits; no permanent authorization promise.

Connection states: not configured -> ready to connect -> authorization pending -> authorized -> resource selection -> verification -> active. Side states include scope missing, account ineligible, provider review pending, reconnect required, rate limited, degraded and disconnected. An action capability has its own readiness independent of a connection label.

Domain flow: search -> live eligibility/availability -> expiring quote with renewal price -> registrant details and agreement -> owner approval/payment authority -> registrar order -> reconciliation -> ownership binding -> DNS -> TLS -> publish -> renew/transfer/cancel controls. The registrant keeps their rights and transfer path. Do not buy a domain before price and consent confirmation.

Phone flow: country/type/search -> recurring and per-use quote -> identity/regulatory documents -> consent -> order/porting -> dedicated tenant number mapping -> route -> test call -> live. Receptionist flow: knowledge/services/hours/languages -> draft assistant -> provider provision -> verified number assignment -> synthetic call -> human transfer -> budgets -> activation.

Contracts proposed for future provisioning: GET services/capabilities; POST service-quotes; POST service-orders with quote ID, approval ID, payload hash and idempotency key; GET service-orders/:id; POST service-orders/:id/cancel where reversible. Callbacks map internal resource IDs to provider resource IDs; never accept a client-supplied provider ID as ownership evidence.

Order states: draft, quoted, awaiting_approval, awaiting_verification, approved, provisioning, pending_provider, reconciling, active, failed, cancellation_pending, cancelled and manual_review. Paid registration may be irreversible; failure compensation must distinguish refund, credit, retry and manual resolution. These contracts are planned architecture, not endpoints claimed to exist in this candidate.

## 7. Global language and mobile requirements

The candidate catalogue covers ISO 639-1 base languages plus selected regional/script variants. It is not every language on earth or every BCP 47 combination. Extend the catalogue from reviewed IANA/CLDR data with searchable native names and region/script variants; keep translation certification separate from selection. User-requested languages become explicit translation work items.

Move every interface string, validation message, generated email, push template and PDF label into versioned dictionaries using stable keys and ICU-compatible plural/interpolation rules. Maintain fallback count by screen, locale, role and release. Preserve user-authored text exactly; offer explicit translation with source and translated copy.

Set correct language metadata on translated strings. Since most current pages remain English, the candidate keeps their document language English and marks translated controls individually. Apply default script direction explicitly; test mixed-script names, numbers, URLs and addresses. Allow direction overrides for genuinely mixed-script content; don’t infer all content direction from account language.

Test long labels, German/French expansion, Hindi/Urdu font fallback, Arabic/Hebrew RTL, Chinese/Japanese wrapping, 200% zoom and mobile keyboards. Currency/timezone remain independent; invoices and legal terms require reviewed terminology. A language dropdown is not acceptance of localized legal obligations.

Native/PWA acceptance: app signing and store identity; verified links; camera/microphone/files; background/foreground push; permission timing; iOS installation constraints; offline task sync; biometric reentry if implemented; logout/device revocation; deletion/export; crash recovery. Web Push cannot guarantee that an operating system will play every alert or permit continuous voice when an app is closed.

## 8. Security, privacy and commercial controls

Use OWASP ASVS 5.0 Level 2 as the proposed baseline and add higher assurance controls for operator and money flows. Maintain a threat model, evidence per control and tested abuse cases. Independent penetration testing and remediation are required before broad commercial scale; dependency audit alone is insufficient.

Enforce object-level tenant and role checks; opaque identifiers; CSRF/origin defenses; HttpOnly secure sessions; bounded OTP/recovery; MFA for privileged identities; scoped OAuth state and PKCE where applicable; least privilege; encrypted tokens; redacted logs; secret-manager access; audited rotation and recovery. Block SSRF into private/metadata networks and scan/quarantine untrusted uploads.

Store only required data. Define retention by record class and jurisdiction; protect backup copies and legal holds; implement deletion propagation and support-access expiry. Review applicable Australian privacy obligations and overseas processing before promising residency. Current service metadata reported Singapore; an Australian business focus does not establish Australian data residency.

Licences are separate categories: proprietary Oprun rights; open-source licences and notices; paid software subscriptions; developer/app approvals; reseller/merchant contracts; domain licences; telecom obligations; and conditional regulatory authorizations. They cannot all be “installed” by adding API keys.

ACMA states CSPs do not need an ACMA licence but must follow applicable rules. A telecom reseller operating model still needs classification, compliant supplier contracts and customer obligations. ASIC payment-facility requirements depend on the financial service and exemptions. Own acquiring or a member wallet requires qualified legal/compliance assessment and banking/settlement partners before enabling custody or payouts. No AFSL, telecom approval or store approval has been obtained here.

PCI obligations must be scoped with the acquirer/QSA even when card collection is outsourced; do not store raw PAN/CVC. Marketing channels require consent/suppression/opt-out controls. .au registration requires applicable registrant eligibility and allocation checks. Recheck current official rules at activation; the register does not substitute for a determination for Oprun’s legal entity and operating model.

## 9. Operator Console: management A to Z

Use the operator control matrix below as the management acceptance baseline. Existing Tasks & releases, Incidents, Reliability & backups, AI automation, provider readiness, billing, compliance and configuration pages must be extended where the control is missing. Do not replace mature controls with decorative “healthy” cards.

Operator action pattern: show current evidence and last update; show impact and scope; require specific permission; collect reason and approval for sensitive action; execute a bounded command; record correlation/job/receipt; verify outcome and display recovery path. Secret values never appear in diagnostics, exports, screenshots or audit payloads.

Daily: review core journey health, critical incidents, queue failures, provisioning exceptions, call/message failures, spend anomalies and backup age. Weekly: sample conversation/call quality, permission changes, stale connections, failed automations and unit costs. Monthly: restore drill, access review, dependency/provider deprecations, licence expiry, billing reconciliation, locale coverage and support trends. Frequency is a proposed operating cadence, not scheduled jobs created here.

Records must be durable and exportable: product requirements; architecture decisions; change/release log; source SHA; migration records; verification results; incidents; supplier agreements; legal decisions; credential metadata; backup/restore evidence; consent; billing; support-access logs. Each has owner, revision, scope, timestamps, retention and access policy.

Add operation-specific runbooks: provider outage; expired OAuth; failed number/domain order; payment mismatch; stale backup; restore; stuck queue; credential compromise; tenant export/deletion; mobile notification failure; broken localization; rollback and emergency founder recovery. Record safe commands and expected evidence rather than storing secret values.

## 10. Delivery sequence, prompts and release gates

Complete ordered implementation prompts in the supplied PROMPTS.md. Each prompt starts by reading current memory, comparing the deployed SHA, inspecting existing code and updating the requirements register. Finish with tests, a resumable checkpoint and exact next action. No prompt is marked complete merely because a plan was generated.

Sequence: baseline and evidence -> security/identity -> complete localization migration -> Connection & Services Hub -> provider lifecycle -> domains/website -> numbers/receptionist -> inbox/social -> visual automation -> field/client/mobile -> finance/commercial model -> complete operator control plane -> performance/accessibility/security -> pilot and controlled release.

Credentials are collected only after the credential-free adapter/schema/UI/test work is reviewable. Acquire accounts and approvals one by one, bind test credentials securely, prove a sandbox journey, then request production activation where needed. Provider review may require working app URLs, screencasts, privacy/deletion policies and verified business identity.

Release gate: feature acceptance evidence; two-tenant and full permission tests; webhook replay/timeout recovery; budget/consent/approval checks; visual/a11y/device signoff; vulnerability triage; no sensitive logs; backup and restore; migration/rollback; operator visibility and runbook; provider approval; disclosed commercial costs; owner-approved rollout. The candidate is not production-certified while required visual checks remain blocked.

Continuation rule: preserve code and patch/bundle, base SHA, branch, tests with runtime, known blockers, requirement statuses and one next action. At resume, verify artifact hashes and current remote state before applying changes. A reset does not authorize redoing a purchase, migration or already-completed external side effect.

## 11. Complete registered feature baseline

All 96 items require their own acceptance evidence. Existing-source labels do not certify complete feature parity.

### Identity & tenancy

Evidence: `src/platform-identity.js;src/staff-access.js`. Baseline: Existing controls; expand tests.

- **R01-01** Email verification, password recovery and secure session lifecycle — REQUIRES_ACCEPTANCE_TEST.
- **R01-02** Owner/admin/manager/worker/contractor permissions and custom grants — REQUIRES_ACCEPTANCE_TEST.
- **R01-03** Server-bound workspace switching and object-level authorisation — REQUIRES_ACCEPTANCE_TEST.
- **R01-04** Operator identity, MFA, support grants and emergency access — REQUIRES_ACCEPTANCE_TEST.
- **R01-05** SAML/OIDC SSO, SCIM provisioning and enforced MFA policies — REQUIRES_ACCEPTANCE_TEST.
- **R01-06** Account closure, privacy requests, legal holds and deletion propagation — REQUIRES_ACCEPTANCE_TEST.

### CRM & pipeline

Evidence: `src/business-hub.js;src/server.js`. Baseline: Existing; parity not fully tested.

- **R02-01** Contacts, companies, sites, custom fields, tags and deduplication — REQUIRES_ACCEPTANCE_TEST.
- **R02-02** Enquiry capture, source attribution, consent and lead assignment — REQUIRES_ACCEPTANCE_TEST.
- **R02-03** Configurable opportunities, pipeline stages, tasks and forecasts — REQUIRES_ACCEPTANCE_TEST.
- **R02-04** Versioned quotes, approvals, signatures, deposits and expiry — REQUIRES_ACCEPTANCE_TEST.
- **R02-05** Bookings, services, availability, cancellations and no-shows — REQUIRES_ACCEPTANCE_TEST.
- **R02-06** Client portal with request, quote, appointment, payment and document history — REQUIRES_ACCEPTANCE_TEST.

### Field operations

Evidence: `src/server.js`. Baseline: Existing; expand field workflows.

- **R03-01** Dispatch board, availability, skills, service zones and routing — REQUIRES_ACCEPTANCE_TEST.
- **R03-02** Job acceptance, allocation eligibility, checklists and safe handover — REQUIRES_ACCEPTANCE_TEST.
- **R03-03** Job photos, documents, signatures and completion evidence — REQUIRES_ACCEPTANCE_TEST.
- **R03-04** Time tracking, expenses, materials, stock and job profitability — REQUIRES_ACCEPTANCE_TEST.
- **R03-05** Recurring jobs, maintenance plans, warranties and equipment history — REQUIRES_ACCEPTANCE_TEST.
- **R03-06** Offline mobile jobs with conflict resolution and tenant-safe sync — REQUIRES_ACCEPTANCE_TEST.

### Inbox & communications

Evidence: `src/comms/routes.js;src/mail-centre.js`. Baseline: Existing; provider coverage varies.

- **R04-01** Unified conversations, contacts, channel identities and assignment — REQUIRES_ACCEPTANCE_TEST.
- **R04-02** Email threads, attachments, approved replies and bounce handling — REQUIRES_ACCEPTANCE_TEST.
- **R04-03** SMS, opt-outs, templates, segmentation and delivery evidence — REQUIRES_ACCEPTANCE_TEST.
- **R04-04** WhatsApp templates, messaging windows and tenant phone binding — REQUIRES_ACCEPTANCE_TEST.
- **R04-05** Social comments and direct messages by approved channel capability — REQUIRES_ACCEPTANCE_TEST.
- **R04-06** Message queued/sent/delivered/read/failed states with retries and reconciliation — REQUIRES_ACCEPTANCE_TEST.

### Voice & receptionist

Evidence: `src/comms/voice.js;src/business-hub.js`. Baseline: Existing voice adapter; managed provisioning planned.

- **R05-01** Number search, price quote, purchase, porting and ownership verification — REQUIRES_ACCEPTANCE_TEST.
- **R05-02** Per-business call routing, opening hours, voicemail and forwarding — REQUIRES_ACCEPTANCE_TEST.
- **R05-03** AI receptionist knowledge, booking rules, qualification and summaries — REQUIRES_ACCEPTANCE_TEST.
- **R05-04** Barge-in, interruption handling, language choice and human transfer — REQUIRES_ACCEPTANCE_TEST.
- **R05-05** Recording disclosure, retention, redaction and call access permissions — REQUIRES_ACCEPTANCE_TEST.
- **R05-06** Per-tenant call cost caps, fraud prevention, call quality and failover — REQUIRES_ACCEPTANCE_TEST.

### Automation & AI

Evidence: `src/automation/engine.js;src/job-queue.js`. Baseline: Existing bounded engine; visual graph planned.

- **R06-01** Versioned visual trigger/condition/action graph with validation — REQUIRES_ACCEPTANCE_TEST.
- **R06-02** Waits, schedules, timezones, branching and cancellation semantics — REQUIRES_ACCEPTANCE_TEST.
- **R06-03** Sandbox simulation with no live sends, charges or publishing — REQUIRES_ACCEPTANCE_TEST.
- **R06-04** Approvals tied to payload hash, actor, expiry and reapproval on edit — REQUIRES_ACCEPTANCE_TEST.
- **R06-05** Durable queue, leases, idempotency, retries, dead letters and replay — REQUIRES_ACCEPTANCE_TEST.
- **R06-06** AI evaluation sets, retrieval isolation, prompt injection controls and spend limits — REQUIRES_ACCEPTANCE_TEST.

### Websites & domains

Evidence: `src/seo/builder.js;src/seo/routes.js;src/business-hub.js`. Baseline: Builder exists; registrar ordering planned.

- **R07-01** Accessible page builder, responsive templates and reusable blocks — REQUIRES_ACCEPTANCE_TEST.
- **R07-02** Forms, surveys, funnels, booking embeds and consent capture — REQUIRES_ACCEPTANCE_TEST.
- **R07-03** Blog/CMS, assets, redirects, SEO metadata and structured data — REQUIRES_ACCEPTANCE_TEST.
- **R07-04** Domain connect, DNS challenge, tenant binding and TLS lifecycle — REQUIRES_ACCEPTANCE_TEST.
- **R07-05** Registrar search/register/renew/transfer with registrant rights and recovery — REQUIRES_ACCEPTANCE_TEST.
- **R07-06** Approval-controlled publishing, preview isolation, revision history and rollback — REQUIRES_ACCEPTANCE_TEST.

### Social & marketing

Evidence: `src/channel-providers.js;src/integration-health.js`. Baseline: Existing adapters; multiple channels partial.

- **R08-01** Social calendar, drafts, media library and channel-specific previews — REQUIRES_ACCEPTANCE_TEST.
- **R08-02** Meta Facebook/Instagram publishing and supported comment/message actions — REQUIRES_ACCEPTANCE_TEST.
- **R08-03** YouTube videos/comments, TikTok posting, LinkedIn, X and Pinterest adapters — REQUIRES_ACCEPTANCE_TEST.
- **R08-04** Snapchat, Threads and other channels only with actual approved capability — REQUIRES_ACCEPTANCE_TEST.
- **R08-05** Email/SMS journeys, consent segments, suppression and unsubscribe — REQUIRES_ACCEPTANCE_TEST.
- **R08-06** Ad account connection, approved budgets, lead forms and attribution reconciliation — REQUIRES_ACCEPTANCE_TEST.

### Search & reputation

Evidence: `src/seo/google.js;src/seo/local.js;src/seo/audit.js`. Baseline: Existing; verify live grants.

- **R09-01** Google Business Profile locations, posts, review inbox and reply approvals — REQUIRES_ACCEPTANCE_TEST.
- **R09-02** Review requests, response templates and reputation monitoring — REQUIRES_ACCEPTANCE_TEST.
- **R09-03** Search Console, GA4 and Google Ads scoped data integrations — REQUIRES_ACCEPTANCE_TEST.
- **R09-04** Technical SEO, crawl/index checks, content briefs and local pages — REQUIRES_ACCEPTANCE_TEST.
- **R09-05** Source-labelled reports, attribution caveats and data freshness — REQUIRES_ACCEPTANCE_TEST.
- **R09-06** Listings consistency and directory integrations with partner permission — REQUIRES_ACCEPTANCE_TEST.

### Money & commerce

Evidence: `src/finance/routes.js;src/billing-ops.js`. Baseline: Existing ledger; provider and legal gates apply.

- **R10-01** Invoices, credit notes, discounts, recurring billing and PDF receipts — REQUIRES_ACCEPTANCE_TEST.
- **R10-02** Merchant onboarding, secure hosted card and direct-debit collection — REQUIRES_ACCEPTANCE_TEST.
- **R10-03** Signed settlement webhooks, refunds, disputes and reconciliation — REQUIRES_ACCEPTANCE_TEST.
- **R10-04** Multi-currency ledger, FX disclosure and country-specific tax configuration — REQUIRES_ACCEPTANCE_TEST.
- **R10-05** Products, subscriptions, checkout, order fulfilment and inventory — REQUIRES_ACCEPTANCE_TEST.
- **R10-06** Own acquiring/wallet/custody feasibility, licences and partner settlement design — REQUIRES_ACCEPTANCE_TEST.

### People & compliance

Evidence: `src/server.js;src/staff-access.js`. Baseline: Existing workforce functions; jurisdiction review needed.

- **R11-01** Staff invitations, designations, attendance and availability — REQUIRES_ACCEPTANCE_TEST.
- **R11-02** Skills, work-right evidence, expiry reminders and allocation rules — REQUIRES_ACCEPTANCE_TEST.
- **R11-03** Contractor onboarding, agreements, insurance and role privacy — REQUIRES_ACCEPTANCE_TEST.
- **R11-04** Recruitment, applications, consent and document retention — REQUIRES_ACCEPTANCE_TEST.
- **R11-05** Training, knowledge base, courses, community and membership access — REQUIRES_ACCEPTANCE_TEST.
- **R11-06** Country-specific employment/tax rules reviewed before automated decisions — REQUIRES_ACCEPTANCE_TEST.

### Platform & ecosystem

Evidence: `src/saas-platform.js;src/operator-console.js`. Baseline: Existing platform; marketplace expansion planned.

- **R12-01** Plans, trials, entitlements, add-ons and metered usage reconciliation — REQUIRES_ACCEPTANCE_TEST.
- **R12-02** Agency/business hierarchy, branding and controlled white-label options — REQUIRES_ACCEPTANCE_TEST.
- **R12-03** Public API, scoped API tokens, pagination and versioned contracts — REQUIRES_ACCEPTANCE_TEST.
- **R12-04** Signed webhooks, delivery history, replay and schema versioning — REQUIRES_ACCEPTANCE_TEST.
- **R12-05** Integration marketplace, templates/snapshots and safe install permissions — REQUIRES_ACCEPTANCE_TEST.
- **R12-06** Import/export, migration preview, duplicates, rollback and portability — REQUIRES_ACCEPTANCE_TEST.

### Mobile & accessibility

Evidence: `saas/workspace.html;saas/workspace-push.js;src/web-push.js`. Baseline: PWA/push exists; store/device certification pending.

- **R13-01** Phone/tablet/desktop navigation, compact density and reachable actions — REQUIRES_ACCEPTANCE_TEST.
- **R13-02** iOS/Android distribution, signing, deep links and verified app links — REQUIRES_ACCEPTANCE_TEST.
- **R13-03** Foreground/background push with device permissions and preference controls — REQUIRES_ACCEPTANCE_TEST.
- **R13-04** Accessibility keyboard flow, screen readers, contrast and reduced motion — REQUIRES_ACCEPTANCE_TEST.
- **R13-05** Camera/files/audio permissions, upload recovery and secure local storage — REQUIRES_ACCEPTANCE_TEST.
- **R13-06** Device test matrix, crash diagnostics, staged releases and account deletion — REQUIRES_ACCEPTANCE_TEST.

### Languages & localization

Evidence: `src/localization.js;saas/locale-catalog.js;saas/workspace-locale.js`. Baseline: Candidate partial; full translation not released.

- **R14-01** Subscriber language selector with native names and server-saved preferences — CANDIDATE_PARTIAL.
- **R14-02** Complete string extraction, pluralisation, interpolation and fallback reports — REQUIRES_ACCEPTANCE_TEST.
- **R14-03** Script-aware RTL/LTR layouts and mixed-language content isolation — CANDIDATE_PARTIAL.
- **R14-04** Locale dates, numbers, timezone, money and independent currency choice — CANDIDATE_PARTIAL.
- **R14-05** Localized emails, notifications, client portal, legal copy and support content — REQUIRES_ACCEPTANCE_TEST.
- **R14-06** Voice/STT/TTS capability matrix, native-speaker review and locale release gates — REQUIRES_ACCEPTANCE_TEST.

### Security & privacy

Evidence: `src/staff-access.js;src/platform-identity.js;src/object-storage.js`. Baseline: Existing controls; independent assessment required.

- **R15-01** Threat model and OWASP ASVS 5.0 Level 2 control evidence register — REQUIRES_ACCEPTANCE_TEST.
- **R15-02** Token encryption, least privilege, key rotation and redacted diagnostics — REQUIRES_ACCEPTANCE_TEST.
- **R15-03** CSRF, XSS, SQL injection, SSRF, file scanning and egress controls — REQUIRES_ACCEPTANCE_TEST.
- **R15-04** Rate limits, abuse detection, session revocation and suspicious-action alerts — REQUIRES_ACCEPTANCE_TEST.
- **R15-05** Data residency, data processor register, retention, DSAR and breach response — REQUIRES_ACCEPTANCE_TEST.
- **R15-06** Dependency/SBOM review, SAST/DAST and independent penetration test — REQUIRES_ACCEPTANCE_TEST.

### Reliability & operations

Evidence: `src/reliability/index.js;src/job-queue.js;src/platform-health.js`. Baseline: Existing controls; live restore proof pending.

- **R16-01** Application readiness probes, uptime, saturation and business journey monitoring — REQUIRES_ACCEPTANCE_TEST.
- **R16-02** Primary storage, independent backup, verified restore and disaster recovery — REQUIRES_ACCEPTANCE_TEST.
- **R16-03** Queue lag, poisoned jobs, scheduler locks and controlled manual recovery — REQUIRES_ACCEPTANCE_TEST.
- **R16-04** Releases, migrations, feature flags, canaries, rollback and change evidence — REQUIRES_ACCEPTANCE_TEST.
- **R16-05** Cost/unit economics, provider invoices, usage anomalies and hard budgets — REQUIRES_ACCEPTANCE_TEST.
- **R16-06** Incident ownership, status updates, runbooks, support SLAs and postmortems — REQUIRES_ACCEPTANCE_TEST.

## 12. Operator management cross-check

### OC-01 Platform overview

Current route/reference: `overview / system / platform/ai-usage`. Baseline: Existing.

Release SHA/version, actual readiness, uptime, queue lag, provider incidents, cost and red/amber health. No hardcoded preview version as live truth.

Acceptance: Boot probe and synthetic enquiry-to-invoice; prove failed dependencies surface.

### OC-02 Subscribers & workspaces

Current route/reference: `subscribers`. Baseline: Existing.

Tenant search, lifecycle, plans, entitlements, roles, authorized support grant and export/deletion requests. Impersonation must be explicit, scoped, expiring and audited.

Acceptance: Wrong-tenant read and delegated support expiry tests.

### OC-03 Billing & usage

Current route/reference: `platform/finance / platform/revenue`. Baseline: Existing / extend.

Versioned prices, tax settings, subscriptions, usage meters, partner costs, invoices, refunds, disputes and reconciliation. Separate operational credits from money custody.

Acceptance: Duplicate webhook, wrong amount, failed settlement, refund permissions.

### OC-04 People & operator access

Current route/reference: `operator identity and staff controls`. Baseline: Existing / extend.

Founder recovery, operator roles, MFA, sessions, devices, joiner/mover/leaver workflow and reviewed access grants.

Acceptance: Subscriber owner cannot call operator APIs; revoke operator sessions immediately.

### OC-05 Connections & credentials

Current route/reference: `legacy:connections; proposed typed connection page`. Baseline: Partial.

Provider capability by action and tenant; encrypted credential metadata only, owner, scope, expiry, last verified, reconnect action, test/live distinction and supplier incident.

Acceptance: Never return secrets; invalid/revoked grant disables only affected tenant/action.

### OC-06 Provisioning & domains

Current route/reference: `proposed operations provisioning page`. Baseline: Planned.

Orders, quotes, approvals, number/domain/assistant resources, pending KYC, callbacks, reconciliation, renewals, cancellations and orphan cleanup.

Acceptance: Crash after provider success must reconcile rather than buy twice.

### OC-07 Automation & jobs

Current route/reference: `platform/automation; queue controls`. Baseline: Existing / extend.

Scheduler health, leases, attempts, dead letters, dry-run preview, pause switches and approval-bound recovery actions.

Acceptance: No double sends/charges from replay; operator cannot replay another business unintentionally.

### OC-08 AI governance

Current route/reference: `platform/ai-usage / platform/automation`. Baseline: Existing / extend.

Model/provider catalogue, budgets, knowledge isolation, versioned prompts, eval results, redacted traces, safety escalations and human handoff.

Acceptance: Injection tests, provider outage fallback, language and tool-call evaluation.

### OC-09 Reliability & backups

Current route/reference: `platform/reliability / platform/backups`. Baseline: Existing.

Primary/backup location, backup age/integrity, restore history, recovery owner, RPO/RTO, expiry and verified drill. A backup uploaded is not a restore proven.

Acceptance: Recover a separate temporary environment without production writes.

### OC-10 Releases & updates

Current route/reference: `records:task; proposed release execution page`. Baseline: Partial.

Dependency/SBOM inventory, release artifacts, migrations, approvals, canary, deployment evidence, rollback and flags. Approved human-controlled execution first.

Acceptance: Deploy exact artifact to isolated preview; forward/backward schema checks and rollback rehearsal.

### OC-11 Incidents & support

Current route/reference: `records:incident`. Baseline: Existing / extend.

Severity, owner, affected tenant/services, timeline, communication drafts, escalation, postmortem, corrective actions and support SLA.

Acceptance: Simulated provider outage creates one incident and routes alert without exposing PII.

### OC-12 Security, privacy & audit

Current route/reference: `audit / platform/compliance`. Baseline: Existing / extend.

ASVS evidence, findings, export permissions, consent/retention, subprocessor register, breach workflow, DSAR and legal holds.

Acceptance: Audit access control, redaction, retention/deletion propagation and tamper detection.

### OC-13 Languages & accessibility

Current route/reference: `platform/localization`. Baseline: Candidate partial.

Selectable locale list, pilot dictionary keys, saved preference counts, honest coverage and pending language release gates. Extend to per-screen review and translation workflow.

Acceptance: Operator-only endpoint; no user identifiers; RTL/device/native-speaker signoff required.

### OC-14 Product & configuration

Current route/reference: `platform/configuration`. Baseline: Existing / extend.

Feature ownership, release flags by tenant/plan/country, API versions, regional defaults, template versions, change history and rollback.

Acceptance: Changes require server permission, revision conflict handling and recorded actor.

### OC-15 Records & knowledge

Current route/reference: `records:task / records:cost and operating runbooks`. Baseline: Existing / extend.

Requirements, decisions, releases, approvals, supplier agreements, licence expiries, runbooks, test evidence and resumable checkpoints.

Acceptance: Every completed task links artifact SHA, tests, owner and next action; restore handover on fresh checkout.

## 13. Source register

Official sources checked during this research; provider setup links without an evidenced approval are entry points, not proof of eligibility.

- [S01: HighLevel official pricing and suite](https://www.gohighlevel.com/pricing) — Primary benchmark; earlier trial audit report records observed state.
- [S02: HubSpot governed AI agents](https://www.hubspot.com/products/artificial-intelligence/breeze-ai-agents) — Guardrails/approvals exist in competitor; not a unique Oprun claim.
- [S03: Salesforce AU small-business editions](https://www.salesforce.com/au/small-business/pricing/) — Capabilities and editions, not universal entitlements.
- [S04: Zoho One](https://www.zoho.com/one/) — Cross-department business suite; do not rely on changing app-count marketing.
- [S05: Jobber client hub](https://www.getjobber.com/features/client-hub/) — Client self-service benchmark.
- [S06: ServiceTitan mobile](https://www.servicetitan.com/features/field-mobile-app) — Technician workflows benchmark.
- [S07: Housecall Pro features](https://www.housecallpro.com/features/) — Field service and CSR AI benchmark.
- [S08: Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) — Platform app credentials and tenant refresh/authorization lifecycle.
- [S09: TikTok direct publishing](https://developers.tiktok.com/docs/en/content-posting-api-get-started) — Scope approval, user grant, unaudited private-only restriction.
- [S10: OpenSRS overview](https://domains.opensrs.guide/docs/overview) — Reseller API and test/live prerequisites.
- [S11: W3C HTML direction](https://www.w3.org/International/questions/qa-html-dir) — Explicit direction and language metadata.
- [S12: W3C language tags](https://www.w3.org/International/articles/language-tags/) — BCP 47 language/script/region model.
- [S13: Render health probes](https://render.com/docs/health-checks.md) — Default TCP is different from HTTP application readiness.
- [S14: OWASP ASVS stable releases](https://asvs.owasp.org/downloads/) — 5.0.0 verification baseline, not certification.
- [S15: ACMA CSP classification](https://www.acma.gov.au/about-carriers-and-carriage-service-providers) — No ACMA licence for CSPs does not remove applicable obligations.
- [S16: ASIC non-cash payment guidance](https://www.asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-185-non-cash-payment-facilities) — Financial service model requires case-specific assessment.
- [S17: ASIC 2026 instrument update](https://www.asic.gov.au/about-asic/news-centre/news-items/asic-remakes-non-cash-payment-facilities-instrument) — Current conditional relief and reforms must be assessed.
- [S18: auDA licensing rules](https://www.auda.org.au/au-domain-names/au-rules-and-policies/au-domain-administration-rules-licensing-2/) — Registrant eligibility and licence rules.
- [S19: OAIC Australian Privacy Principles](https://www.oaic.gov.au/privacy/australian-privacy-principles/read-the-australian-privacy-principles) — Privacy obligations including overseas disclosure, where applicable.
- [S20: PCI DSS](https://www.pcisecuritystandards.org/standards/pci-dss/) — Scope and validation with acquirer/QSA.
- [S21: ACMA consent expectations](https://www.acma.gov.au/articles/2024-06/consent-expectations-businesses-using-direct-marketing) — Consent, opt-out and channel governance.

## 14. Credentials and approvals — final activation order

No new licences, paid accounts, app approvals or keys were obtained for this candidate. Review current provider commercial terms and the legal operating model at activation. Secret fields below identify types only.

1. Confirm Oprun legal entity, owner recovery, business contact and applicable jurisdiction; obtain determinations for telecom/payment model.
2. Confirm production/preview identity, DNS, secure secret storage, separate primary/backup and restore owner.
3. Verify business sending domains and transactional delivery.
4. Create/verify platform developer apps and callback/privacy/deletion URLs for each provider.
5. Bind test credentials through secure configuration; complete customer-consent and sandbox journeys.
6. Obtain product/scope reviews, reseller agreements, merchant onboarding and phone/registrant verification as applicable.
7. Set per-tenant resource grants, prices, budgets, retention and approval policies.
8. Obtain signing/store review and device verification for native distribution.
9. Record secret metadata/expiry, agreement owners and renewal reminders in the operator console.
10. Authorize production activation per provider and execute a measured pilot.

### Meta / Facebook / Instagram

Official starting point: https://developers.facebook.com/

Account/authority: Platform app + business verification + applicable permissions; subscriber Page/IG consent.

Current implementation: Facebook text posting partial in reviewed adapter; other actions require implementation and approval.

Credential types: Platform app ID/secret; tenant tokens in encrypted vault.

Gate: App review, data deletion callback, account type and approved assets.

### WhatsApp Business

Official starting point: https://developers.facebook.com/docs/whatsapp/

Account/authority: Meta business app; business phone onboarding and approved messaging templates.

Current implementation: Existing inbound/reply paths; full embedded signup and provisioning need evidence.

Credential types: App secret/webhook verification; tenant WABA/phone mapping.

Gate: Business verification, opt-in, template approval and conversation policy.

### Google Gmail / Calendar / Drive

Official starting point: https://developers.google.com/identity/protocols/oauth2/web-server

Account/authority: Google Cloud app and consent configuration; scope-specific verification.

Current implementation: Gmail adapter exists; each Calendar/Drive action requires explicit contract.

Credential types: Client ID/secret; refresh token scoped to user and business.

Gate: Sensitive/restricted scopes may require verification/security assessment.

### YouTube

Official starting point: https://developers.google.com/youtube/v3

Account/authority: Google project, quota and subscriber channel authorization.

Current implementation: Comment/read paths exist; upload/publishing separate capability.

Credential types: Google OAuth credentials; tenant channel tokens.

Gate: Quota and applicable audit requirements must be checked before production expansion.

### Google Business Profile

Official starting point: https://developers.google.com/my-business/

Account/authority: Approved API project and eligible business/location access.

Current implementation: Existing posts/reviews adapter; test each granted location.

Credential types: Google OAuth client; location binding.

Gate: API access approval and verified/eligible business profile.

### Google Ads / GA4 / Search Console

Official starting point: https://developers.google.com/google-ads/api/docs/start

Account/authority: Ads developer access + OAuth; GA4/GSC property permissions.

Current implementation: Bounded Ads sync and SEO integrations exist; not proof of ad execution.

Credential types: Ads developer token and manager configuration; OAuth grants.

Gate: Developer token access level; property roles; approved budgets.

### TikTok

Official starting point: https://developers.tiktok.com/docs/en/content-posting-api-get-started

Account/authority: Developer app + Login Kit + Content Posting API + user grant.

Current implementation: Reviewed adapter is read/metrics; public direct publishing needs implementation/audit.

Credential types: Client key/secret; scoped tenant token.

Gate: video.publish approval and audit; unaudited clients restricted to private viewing.

### LinkedIn

Official starting point: https://learn.microsoft.com/en-us/linkedin/

Account/authority: Developer app and applicable product access; member/organization authorization.

Current implementation: Planned adapter; access not verified.

Credential types: Client ID/secret; tenant grant.

Gate: Community Management/Marketing products have separate eligibility and review.

### X

Official starting point: https://docs.x.com/

Account/authority: Developer project, appropriate commercial API access and user grant.

Current implementation: Existing text post adapter; scope/tier/rate limits need live tests.

Credential types: App credentials; encrypted tenant grants.

Gate: Current API plan, permissions and automation rules.

### Pinterest

Official starting point: https://developers.pinterest.com/

Account/authority: Business developer app and permitted account grants.

Current implementation: Planned; no verified production access.

Credential types: Client ID/secret; tenant grants.

Gate: App approval and current API terms.

### Snapchat

Official starting point: https://developers.snap.com/

Account/authority: Snap product-specific approval and advertiser authorization.

Current implementation: Not yet supported in reviewed integration health.

Credential types: Product-specific credentials.

Gate: Marketing API does not imply general social posting/inbox access.

### Threads

Official starting point: https://developers.facebook.com/docs/threads

Account/authority: Threads app configuration and required permissions.

Current implementation: Planned; separate capability and app review.

Credential types: Platform credentials; tenant grant.

Gate: Current publishing/insight permissions and limits.

### Microsoft 365

Official starting point: https://learn.microsoft.com/en-us/graph/overview

Account/authority: Entra app registration; delegated permissions and tenant consent.

Current implementation: Planned Outlook/Calendar/Teams adapter.

Credential types: Client ID/certificate or secret; tenant tokens.

Gate: Publisher verification and admin consent where required.

### Telnyx voice / SMS

Official starting point: https://developers.telnyx.com/

Account/authority: Verified funded platform account; number and messaging requirements by country.

Current implementation: Existing voice adapter uses platform environment; per-business purchase/usage isolation incomplete.

Credential types: TELNYX_API_KEY, connection and assistant IDs, webhook validation configuration.

Gate: Country/regulatory documents, phone ownership, consent, fraud limits.

### Registrar reseller / OpenSRS candidate

Official starting point: https://domains.opensrs.guide/docs/overview

Account/authority: Reseller agreement, test/live account, funded balance and network allowlisting.

Current implementation: Existing domain request is not registrar purchase; adapter planned.

Credential types: Reseller username/key; dedicated egress configuration.

Gate: Confirm eligible TLDs, reseller terms, registrant data, renewal/transfer policy.

### DNS / CDN / certificates

Official starting point: https://developers.cloudflare.com/

Account/authority: DNS account/API token scoped to approved zones; tenant domain verification.

Current implementation: Per-domain activation required; no registrar reseller rights implied.

Credential types: Scoped DNS token; infrastructure credentials managed server-side.

Gate: Custom-hostname plan, ownership, TLS issuance, apex and deletion tests.

### Payments / acquiring partner

Official starting point: https://www.asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-185-non-cash-payment-facilities

Account/authority: Merchant/partner underwriting, legal model and settlement agreement.

Current implementation: Ledger exists; own acquiring/wallet is a separate regulated programme.

Credential types: Provider test/live credentials and webhook verification; merchant onboarding.

Gate: User prefers own acquiring: no processor substitution without product decision; custody/AFSL/AML analysis required.

### Email delivery

Official starting point: https://resend.com/docs

Account/authority: Business sending domain, SPF/DKIM and DMARC; funded provider account as needed.

Current implementation: Resend/SMTP adapters exist; per-tenant sender verification required.

Credential types: Server sending credential; tenant sender/domain records.

Gate: Sender reputation, bounce/complaint hooks and suppression.

### AI / speech providers

Official starting point: https://platform.openai.com/docs

Account/authority: Business project/account, billing and approved data processing terms.

Current implementation: Existing AI adapters; no live AI calls made for this candidate.

Credential types: Provider-specific key in server vault; no client secret.

Gate: Model availability, retention, region and language/voice verification; keys deferred by owner.

### AWS primary / backup storage

Official starting point: https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html

Account/authority: Separate bucket permissions and retention policy; recovery access.

Current implementation: Existing S3/Litestream paths; live restore not proven here.

Credential types: Role/least-privilege access; independent backup policy.

Gate: Primary and backup credentials/buckets must remain distinct; restore drill required.

### Apple app distribution

Official starting point: https://developer.apple.com/programs/enroll/

Account/authority: Organization developer enrollment, signing and App Store review.

Current implementation: Build assets do not establish published/reviewed app status.

Credential types: Signing certificates/profiles, App Store Connect access.

Gate: Entity verification, privacy labels, deletion flow and device tests.

### Google Play / FCM

Official starting point: https://support.google.com/googleplay/android-developer/

Account/authority: Verified developer organization; app signing/review and push project.

Current implementation: PWA/Web Push exists; native store rollout not verified.

Credential types: Play signing/access; FCM service identity where native push is used.

Gate: Current testing, data safety, notification permissions and store review.

### Accounting / Xero / QuickBooks

Official starting point: https://developer.xero.com/

Account/authority: Developer app, customer accounting organization grant.

Current implementation: Separate adapters/field mappings and reconciliation required.

Credential types: Provider OAuth credentials; tenant accounting grants.

Gate: Partner terms, rate limits, tax mapping and write approvals.

### Maps / routing / video / e-sign

Official starting point: https://developers.google.com/maps/documentation

Account/authority: Choose licensed suppliers per service and geography; not blanket install.

Current implementation: Evaluate against current built-in meeting and signing functions.

Credential types: Supplier-specific scoped credentials.

Gate: Geocoding caching rules, media licences, TURN costs, evidence retention and signature requirements.
