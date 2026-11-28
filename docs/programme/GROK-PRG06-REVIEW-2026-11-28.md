# PRG-06 / T-273 — independent preservation and recommendation review

UPDATE: The user subsequently supplied the original text and authorised a new documentation-only preservation commit. See GROK-PRG06-VERIFICATION-2026-11-28.md for current preservation, actual commit, source results and corrections. The missing-original findings below are retained as historical observations, not current blockers. Original Grok Git provenance remains unverified.

Status: PARTIAL / BLOCKED on original report and Grok-local Git objects. This is a separate correction/review record, not a substitute for Grok's report.
Reviewer: ChatGPT. Checked 28 November 2026. Stated research base: 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd.
User supplied instructions and four recommendations to challenge, but no report body, attachment, bundle or patch was available in this session. Original contents cannot be preserved or reviewed byte-for-byte until received. No claim adapters were started. Claude's assigned files and ownership remain unchanged.

## 1. Preservation findings

| Item | Observed evidence | Conclusion |
|---|---|---|
| Local branch in this ChatGPT checkout | git branch --list '*grok*' and git branch -a --list '*grok*' returned none | Absent here; Grok's separate local checkout is not accessible and may still contain it |
| Designated remote branch | git ls-remote origin refs/heads/grok/prg06-industry-research-20261128 and wildcard refs/heads/*prg* returned no matching ref | No remote research branch observed at check time |
| Research path on that remote branch | GitHub fetch docs/programme/GROK-PRG06.md returned 404, no commit found for ref | Cannot retrieve original from designated path/ref |
| Claimed commit 27a7e0f72dae4fb0cc5766cda8e4c5af543d3335 | Local git cat-file -t failed; GitHub commit API returned 422 no commit found; git fetch origin <SHA> returned not our ref | Commit inaccessible in this checkout and from repository remote; not proof it never existed in Grok's local Git |
| Claimed parent 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd | Base object exists locally and is a commit; origin/main still names it | Base existence verified; parent relationship to missing Grok commit NOT verified |
| Earlier alleged 403 | Described by owner; original response/log not available | Historical reported failure, not reproduced or independently verified here |
| Connected GitHub access | Reads work; earlier audit-branch publication succeeded in this session history | This does not prove Grok's credentials can write; no dummy branch created to test permissions |
| File search | No matching report found in scoped workspace or Library search; unrelated search results not read | Original remains missing; do not use old Grok workspace archives as a guessed substitute |

Resolution: local branch creation and a rejected remote push can both be true. The assertion that the research was published remains unverified. Current publication blocker is missing original bytes/provenance, not a demonstrated current 403 on ChatGPT's connection. No research branch/file was created, overwritten or published by this review.

When supplied, retain the original unchanged and record its SHA256. If a bundle is supplied, inspect its advertised refs and verify the commit object and parent with git show --format=fuller and git cat-file -p; do not execute bundled scripts. Check that its diff from the stated parent contains only docs/programme/GROK-PRG06.md. If the bundle contains other files/changes, preserve it and report the discrepancy rather than publishing them. Do not fabricate the original commit SHA by recreating its contents: a new publication commit, if needed, must be identified as a different commit.

## 2. Independent code observations at the stated base

These are this review's observations, not verification of Grok's unavailable wording.

- src/industry-registry.js contains medical/allied-health/dental/NDIS, property, hospitality and repair/automotive profiles. Profile names and workflow suggestions are not implemented claim or trust-account adapters.
- The base src/industry-registry.js:50 includes trust/accounting records in real-estate evidence guidance. That label is not a client trust ledger or a verified trust-accounting workflow.
- A text-only search over source JavaScript for Medicare/DVA and trust-ledger/account terms found profile guidance but no Medicare/DVA adapter in that bounded search. This is not an exhaustive absence proof over every file, branch or external service.
- src/onboarding-proposal.js applies choices only through an approved, tenant-scoped proposal with consent, stale-answer hash checks, transaction and audit record. This is business setup approval, not patient consent or universal regulatory permission.
- src/module-rules.js contains industry module recommendations plus server API refusal for disabled optional modules. Do not recommend rebuilding this as an absent foundation.
- src/workforce-compliance.js distinguishes declared work status and authorised/official-source review requirements. This does not establish that every upload API enforces all evidence transitions; that remains an acceptance/test requirement.
- Diff between stated base and published audit candidate fc8c43365a7187b3f5da5a2e494fec502109968b is empty for industry-registry, onboarding-questions, onboarding-proposal, module-rules and workforce-compliance. The above observations are therefore historical-base findings that also match those inspected files on that candidate. No assertion is made about unpublished Claude work or production runtime state.

## 3. Recommendation decisions — bounded design constraints, not implementation approval

| Recommendation presented by owner | Decision | Required correction / acceptance | Programme mapping and existing owner |
|---|---|---|---|
| Strictest privacy rule wins | REJECT as a blanket rule; accept explicit policy evaluation | Evaluate applicable jurisdiction, entity/contract scope, data class, purpose, lawful basis, retention and actor/action permissions. Combine compatible restrictions only after applicability is established. Record rule provenance/version and explicit precedence. Conflicts must block the affected automated action and escalate for authorised resolution; no silent broader collection, cross-tenant access, permanent retention or deletion. Workspace-owner approval is not a substitute for an individual's consent or other applicable lawful authority. | PRG-04 shared backend policy design, ChatGPT; PRG-05 interview inputs remain Claude-reserved, not assigned for implementation now |
| Uploaded evidence becomes verified | REJECT | Upload only means received/submitted. Keep declared, pending review, reviewed, authority-verified, expired and revoked distinct. Verification needs an authorised actor or approved source, subject match, source/method/date/scope/expiry and audit trail. Never label a manually reviewed document regulator-verified. Test that upload cannot grant verified status or work eligibility, including cross-tenant attempts. | PRG-03 independent security acceptance, ChatGPT; PRG-05 future evidence workflow stays Claude-reserved |
| One approval covers integrations/channels | REJECT | Readiness must be per provider/product/version/environment/API/action/channel/workspace. Record legal organisation registration, provider access, software testing/approval, tenant authority and scopes separately. Medicare Online generic integration process is not proof of DVA, HI, ECLIPSE or unrelated channel approval. No production claim until exact service evidence is supplied. | PRG-06 research, Grok; PRG-06/PRG-08 validation, ChatGPT. No claim-adapter assignment |
| Trust transactions stored as invoice warning notes | REJECT | Operational invoices may reference an external trust record but cannot represent trust-money accounting. Require a separately reviewed design for client trust ledgers, authorised entries, auditability and bank/trust/client-balance reconciliation; keep trust and operational/platform funds distinct. Until then mark trust handling unavailable and use an approved external process. No trust implementation is authorised by this review. | PRG-04 architecture and PRG-08 release gates, ChatGPT; later PRG-07 platform operations must preserve subscriber/platform separation |

## 4. Official-source rechecks and limitations

Checked 28 November 2026; facts below support only the stated narrow design constraints. The absent original source list has not been checked in full. No legal or clinical compliance certification is made.

1. [OAIC — collecting health information](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/health-service-providers/guide-to-health-privacy/chapter-2-collecting-health-information): collection generally needs consent and necessity; specified exceptions can apply. This supports explicit purpose/lawful-authority evaluation, not a universal strictness ranking.
2. [WA OIC — PRIS commencement](https://www.wa.gov.au/organisation/office-of-the-information-commissioner/what-parts-of-the-pris-act-have-commenced): most privacy obligations commenced 1 July 2026; notifiable-information-breach provisions commence 1 January 2027. Treat these as separate effective dates.
3. [WA OIC — contracted service providers](https://www.wa.gov.au/organisation/office-of-the-information-commissioner/how-pris-applies-contracted-service-providers): scope depends on State services contracts and PRIS compliance clauses; obligations cannot be applied indiscriminately to every private WA business. This page also discusses different accountability mechanisms and other applicable obligations.
4. Historical-source warning: the [OAIC state/territory overview](https://www.oaic.gov.au/privacy/privacy-legislation/state-and-territory-privacy-legislation), updated December 2025, still contains wording that WA has no specific privacy legislation. Do not copy that blanket statement into a November 2026 readiness matrix. Use the current WA OIC commencement/scope material and preserve this source-date conflict explicitly.
5. [Services Australia — get started as a software developer](https://www.servicesaustralia.gov.au/get-started-software-developer?context=20): describes portal registration, integration testing, Notice of Integration and customer claiming-channel registration. These are distinct steps, not a single account-connect permission.
6. [Services Australia — HI software developers](https://www.servicesaustralia.gov.au/healthcare-identifier-hi-service-for-software-developers?context=20): states mandatory connection/conformance testing and production-access prerequisites. Do not infer an HI approval from another channel's notice. DVA-specific approval details remain open; a generic Medicare page does not close that row.
7. [NDIS Commission — worker screening](https://www.ndiscommission.gov.au/workforce/worker-screening): employers can confirm current check status through the official database; uploading a document is not that confirmation. Current page also reports an October 2026 portal change for registered/deregistered providers. Do not assume older portal instructions apply to every provider category.
8. [WA Consumer Protection — trust account handbook](https://www.consumerprotection.wa.gov.au/sites/default/files/documents/2025-01/realestatebusinessagentstrustaccounthandbook.pdf): describes separate client trust ledger records, transaction records and reconciliation. Supports rejecting invoice-warning notes as a trust ledger. This is regulatory guidance; no assertion that Oprun implements or is approved for these controls.

## 5. Next bounded assignments (proposed; active owners unchanged)

### Grok — PRG-06 provenance recovery and research addendum only

Keep PRG-06 ownership. Do not start adapters or change code. Return the exact original docs/programme/GROK-PRG06.md, its SHA256 and the raw local Git evidence for commit 27a7e0f72dae4fb0cc5766cda8e4c5af543d3335: git status --short, git branch --show-current, git show --no-patch --format=fuller <SHA>, git cat-file -p <SHA>, git diff --name-status <parent> <SHA>, and git ls-remote origin refs/heads/grok/prg06-industry-research-20261128. A local Git bundle carrying that ref is preferred if pushing failed. Do not print credentials. If an operation fails, retain its actual error and distinguish local preservation from remote publication.

Preserve the original unchanged. Provide a separate addendum (text for review, not another committed path on the research branch) correcting privacy conflicts, evidence status, service/channel approvals and trust-money separation; address WA 2026 effective dates and NDIS portal changes, and identify the exact DVA service/approval sources or mark them unknown. Base code observations must reference 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd and distinguish newer/unpublished work. Only the original research file may be published on grok/prg06-industry-research-20261128 once exact bytes/provenance are available and authorized access succeeds. No force push, merge, deploy, account signup or spending.

### Claude — existing ownership only

Continue the already accepted bounded assignment. Do not infer that absent remote branches mean the local task is idle. PRG-02 is reserved T-280 with src/job-queue.js, scripts/programme-queue-isolation.test.mjs and docs/programme/CLAUDE-PRG02.md only, per the existing assignment. Report accepted task/base/head and actual active file boundaries before any change of ownership. No claim adapters, industry runtime changes or research-file edits are assigned here. When ready, publish the bounded result for independent ChatGPT review; no main/staging push or deployment.

### ChatGPT — PRG-03/04/08 and review gate

Own this separate review and preserve the in-flight T-272 payment candidate. Once the original report arrives, verify its SHA256, commit parent and changed paths; review all source references and recommendations, then publish only the exact research file on its designated research branch. Preserve corrections on the audit branch. No recommendation becomes an implemented/compliant feature by being accepted as a design constraint. Keep T-273 BLOCKED until original report/provenance is available; keep payment candidate TESTING pending final local regression and independent review.
