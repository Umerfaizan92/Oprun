# Oprun — prompt versus delivered work audit
27 November 2026, Perth. Read-only findings; no implementation or deployment.

## Verdict
Substantial incremental engineering work exists. The complete visual/functional transformation requested in the master prompts is NOT established as complete. Unchanged appearance is substantially explained by tasks being narrowed to polishing and consolidation while retaining existing layouts, plus unfinished graphics/demo work. No evidence currently establishes browser caching as the principal cause.

## Sources and limits
Read exact archived briefs docs/transformation/PROMPT_ORIGINAL.txt (23 Nov) and PROMPT_FINAL_2026-11-26.txt (26 Nov). Read the two 12-Nov prompt PDFs: Oprun_Final_Redesign_Audit_Prompts_2026-11-12.pdf and Oprun_Master_Senior_Prompts_with_Continuation_2026-11-12.pdf. Personal-context retrieval recovered prior discussion excerpts and execution confirmation, not the complete preceding conversation verbatim. Therefore this is not a claim to have read every historical chat or reconstructed every Claude execution. User confirmed running all prompts in Claude; task/commit records independently show substantial implementation but are not per-prompt execution transcripts.
Repository main freshly fetched: 7b3d0946c7aa1e442087fa4f588680c0c275513c. Same-session earlier independent Render check found this commit LIVE. Signed-in Business and Founder surfaces were inspected in audit batches1–3, not every route/control/device. 31 public destinations had stable desktop DOM/title/H1 checks. Local before/after evidence inspected directly. Existing Claude tests/completion claims are labelled reported unless independently rerun.

## Which prompts and what they actually asked for
| Prompt family | Asked for | Audit implication |
|---|---|---|
| 12 Nov Prompt1 | Remapped navigation, roles, page mapping, aliases | Specification output alone does not change UI |
| 12 Nov Prompt2 | Design tokens/component examples and before/after descriptions | A design-system document is not proof of live redesign |
| 12 Nov Prompt3 | Security checklist/sample code and CI ideas | Checklist is not independent security certification |
| 12 Nov Prompt4 | 90-day AI/growth/compliance roadmap | Roadmap is future scope, not implemented functionality |
| 12 Nov senior master | Production-ready redesign/implementation specification and deliverables | Body mostly specifies artefacts; applying/redeploying is a separate final instruction |
| 23 Nov transformation | Complete pre-login, workspace, Founder/agents/onboarding/communications redesign with live proof | Goes materially beyond the earlier planning pack |
| 26 Nov final master | Exact Gold/Black, new assets, all surfaces/devices, demo engine, Supervisor, security, measured performance, actual before/after/live verification | Primary basis for unfinished transformation findings |
| Current master audit | Read-only audit, reconcile, scope approval then fixes and separate release approval | Latest instruction now asks findings first; no fixes authorized by this report |

Older prompts themselves contain an inconsistency: “maximum7” top-level groups but list8 named groups. The current8-group implementation cannot fairly be called a simple violation of an unambiguous brief. Use explicit final navigation mapping to resolve, rather than blaming implementation for contradictory text.

## Visual/frontend requirement comparison
| Area | Actual change | What remains / verdict |
|---|---|---|
| Public homepage | Existing Phase03 website retained; T208/TR14 added Integrations/Security, server prices and a11y/performance checks | Original complete pre-login redesign narrowed to “already redesigned, so no rewrite”; broad new homepage graphics/layout NOT demonstrated |
| Sign-in/create/verify/recovery | T209 field alignment, registration intro, footer overlap and labels | Existing two-column design retained; polish delivered, comprehensive new visual identity not established |
| Gold/Black tokens | T204 replaced533 hardcoded gold values in59 stylesheets; reported105 screenshots <0.1% change | Real technical cleanup designed to preserve appearance |
| Shared components | T205 catalogue/classes, reported screenshot change <0.06%; T206 44px button height/16px side padding | Consistency improved, most screens intentionally look similar |
| Logo/icon library | T251 centralized files/references, manifests and email tokens | Completion record explicitly says “New logo artwork not drawn (existing mark kept)”; new artwork requirement incomplete |
| Command Centre | T265 replaces five tiles with compact rows/round icons; directly inspected before/after | Real visible localised redesign; shell/header/AI panel largely retained |
| Bookings | Before/after removes repeated pipeline counters, brings calendar higher | Real compacting improvement, not new overall visual language |
| Workspace overall | T21131 secondary pages become tabs/aliases; T215 headings; T213 mobile summary; some MB23 reductions | MB23/T258 whole-platform simplicity remains PARTIAL; original NOT_STARTED parent is stale |
| Media Studio | Guided UI released8573c88, deliberately removed by T202/PR174/6cbbe20/D053; current Library/Reels/Editor/AI video | Earlier design is gone by recorded decision, not waiting behind STUDIO_UNIFIED flag; do not enable obsolete flags |
| Latest Studio styling | e5233ad adds44px controls, chips/cards/field alignment; commit explicitly CSS-only, T202 structure retained | Explains why studio looks largely unchanged |
| Founder Console | Executive dashboard, team/assignment sections, Agent Center and Supervisor added | Real structural/function additions; full all-page visual transformation not independently accepted |
| Feature animations | Existing3D hero, scrolling story and approval-gate demo | New versioned feature→video registry/render pipeline, tailored per-feature demos/narration NOT IMPLEMENTED; T259 NOT_STARTED |
| Emails | Token/logo consistency and code-first plain text; before/after email layout substantially unchanged | Not a complete new email layout; inbox sender/delivery still need actual received headers |
| Responsive/mobile | Reported screenshot/a11y/overflow suites and bottom navigation;31 public routes desktop no overflow in our sample | Android/iOS physical-device mic/camera/install/native behavior NOT VERIFIED |
| Full visual acceptance | Claude reports678 baseline screenshots | A regression baseline proving unchanged pixels/no overflow is not proof of redesign or approved visual quality |

## Technical changes and verification
| Area | Evidence | Assessment |
|---|---|---|
| Tenant isolation/RBAC | Our Node22 isolated tests:20 PASS; sweep517 routes/4508 requests/23 cross-tenant tables/0 server errors | Meaningful independent evidence for tested boundaries, not perfect isolation certification |
| Module control | src/module-rules.js; industry recommended sets, owner switches, hidden module route/API guards | Implemented; no mutative production test performed |
| Onboarding | Guided16-question interview visible live; proposal tests for trades/cleaning/dental/retail/NDIS/vet reported | Implemented core; all languages/native speech/full live onboarding not independently accepted |
| Translations |559 dictionary keys;8 added languages plus earlier dictionaries | Most forms/settings hardcoded text still outside dictionary;185 catalogue languages fallback to English; drafts unreviewed |
| Quotes/approvals/timezones | Commit/test records show quote flow, approval counts, business timezone and customer status fixes | Real operational changes with source/recorded test evidence; full live enquiry→payment not tested |
| Media capabilities | Live duration/voice/guide/camera controls visible | Presence verified; provider generation/mic/native camera/full continuous rendering not independently tested |
| Generation funding | Live UI reported provider billing attention | Real-provider generation acceptance blocked; no billing or paid retry attempted |
| Integrations | Connection list/status/reconnect implementation/tests reported | OAuth/provider approval, publishing, messaging, webhooks require controlled live acceptance; cannot mark all working |
| Agents |13 registered agents/15 schedules in records; live last-run data and Supervisor timestamp seen | Real reporting/monitoring jobs. src/automation/agent-actions.js explicitly says level1 reports/alerts from counts; not evidence of broad autonomous engineering/business execution |
| Supervisor | Live findings/escalation/queue/performance panels | Exists, contrary to old audit saying absent; crash-recovery/independent worker operation not proven |
| Scheduler architecture | T048 and MB14 pending; web-process scheduler + durable queue | Independent resilient worker architecture unfinished; not claim of unsupported always-on orchestration |
| Backups | Live UI: bucket configured, files included, persistent DB; recorded22Nov drill244 tables/1.333s | Application-recorded recovery evidence; fresh independent AWS restore/KMS/policy/RPO/RTO not established |
| File readiness UI | Live disk mode reports Ready No | Source ready boolean only true in S3 mode (object-storage.js:37); misleading generic diagnostic, not proven upload outage |
| Performance | Existing latest local LH report77–84 workspace vs85 target; public97–100/console100 reported | Workspace target unmet; numbers are prior lab evidence, not freshly rerun live scores |
| Continuity | Task register, Git checkpoints, audit branch exist |60 pending entries include stale parents/duplicates; handovers stale; CP-AUDIT-002 not found in branch-tip files despite chat reference |

## Security findings still requiring remediation
- P1: clear workspace guide removes local transcript but retains conversation ID; server history can persist6h (product-guide.js:197–200, ai-provider-shim.js:73–77,138–150).
- P2: public Fresh conversation resets displayed UI without transcript/ID reset (intro.js:384).
- P1 investigation: guide endpoint accepts client conversation ID without authenticated caller ownership binding; namespace prefix is not caller authorization (server.js:2835–2840). No live cross-account exploit attempted or breach claimed.
- Production sensitive-column encryption/key custody and current AWS policies require operational evidence.
- Historical26Nov DNS report says DMARC missing and send subdomain conflict. Not freshly revalidated in this pass; do not label current DNS as conclusively broken from that old result alone.

## Main causes of the mismatch
1. Public-site requirement was narrowed from complete redesign to additions/polish because existing site was treated as already redesigned.
2. Token/catalogue/accessibility work intentionally preserved appearance; “task completed” often means a small technical acceptance passed.
3. New logo artwork and animated guide engine were not delivered.
4. Major earlier Studio UI was replaced by later owner-recorded direction; later styling retained replacement structure.
5. All-page MB23 acceptance incomplete; parent/child status and old handovers obscure what remains.
6. Some “agents” are real scheduled diagnostic reports, much narrower than expected specialist workforce.
7. Full translation and native/provider acceptance remain incomplete despite impressive catalogue/test counts.
8. No current evidence proves cache/service worker as primary reason. Render being current does not by itself certify domain/assets/every role/device.

## Whole26Nov brief coverage
| Section | Status |
|---|---|
| 1 mission/full world-class platform | PARTIAL |
| 2 master consolidation/backlog | PARTIAL: register exists, stale statuses |
| 3 verified global benchmark leading to measured improvement | PARTIAL: research exists, no comprehensive superiority proof |
| 4 brand/design/new artwork | PARTIAL |
| 5 every surface/device transformation | PARTIAL / remaining NOT TESTED |
| 6 visual guide engine | FAIL / NOT IMPLEMENTED |
| 7 industry workspace/core features | PARTIAL |
| 8 complete Founder headquarters | PARTIAL |
| 9 branded communications/delivery/compliance | PARTIAL |
| 10 permanent specialist workforce | PARTIAL: monitoring reports/supervision, not all requested autonomy |
| 11 every pipeline/security/storage/performance | PARTIAL |
| 12 one implementation/cleanup | PARTIAL |
| 13 every changed page actual before/after live proof | PARTIAL; not universal acceptance |
| 14 sequential economical execution | PARTIAL; no exact cost efficiency certification |
| 15 checkpoints/limit recovery | PARTIAL; stale records |
| 16 accurate emergency cross-model handover | PARTIAL; not automatic transfer |
| 17 production safety approval | Preserved in our audit; historical releases require individual decision records |
| 18 start read-only audit, plan and execute approved scope | Audit underway; complete transformation unverified |

## Evidence locations
- docs/transformation/evidence/command-centre-before-after.jpg
- docs/transformation/evidence/MB-23_bookings_before-after_390.jpg
- docs/transformation/evidence/MB-12_email-before-after_390.jpg
- docs/transformation/evidence/MB-13_before-after_390.jpg
- .claude/project-memory/COMPLETED_TASKS.md (T204–T235,T251,T265–T270)
- .claude/project-memory/PENDING_TASKS.md (T048,T236,T258–T263)
- docs/transformation/MB-27_TRANSLATION_COVERAGE.md
- docs/transformation/MB-26_PERFORMANCE_PLAN.md
- docs/audit/2026-11-27/CHECKPOINT.md, BATCH2.md, BATCH3.md

## Decision
Do not treat the platform-wide transformation as completed, and do not rebuild verified working features. The next decision should distinguish (a) a genuinely new visual design with approved sample screens and measurable all-page acceptance, (b) security/technical remediation, and (c) operational/provider/native tests. No new implementation scope or release has been approved in this report-only turn.
