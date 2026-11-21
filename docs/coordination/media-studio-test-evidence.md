# Media Studio evidence ledger

Append-only evidence entries. Tests marked historical were not rerun in T195. No secret-bearing output, raw subscriber audio or private database data belongs here.

## E-MS-00 — production/branch recovery (T195,21Nov2026)

- GitHub connector: latest main58fc72b597666c637a7fefb19af5962bb1980a80; precedingcfcae59,4945c147,efda7cb. Current Render dep-dc0nunmc6qcc73bonn2g LIVE at exact58fc72b. Previouscfcae59 deploy deactivated, available candidate rollback. No deployment initiated.
- Existing final handover: CP151; codex/t193-unified-media-studio-audit remote8f6ef9a1727614fb3d86cf8fc6a50a3a7fc43a6b/localfef2e17 tree equivalence recorded. Current task isolated on codex/t195-media-studio-blueprint. No active Claude files edited.
- Fresh read-only `node scripts/post-deploy-check.mjs https://oprun-ai.onrender.com`:6/6 PASS. Health, database/queue readiness, security headers, business401, founder401, sign-in/public pages. Does not prove authenticated media generation, speech or publishing.

## E-MS-01 — live source comparison (T195)

Read-only anonymous fetch with SHA256 comparison against released application source; all five HTTP200 and exact-byte matches:

| Path | Cache-Control | Result |
|---|---|---|
|/saas/workspace.html |public,max-age=0 |MATCH105608bytes |
|/saas/workspace-ai-video.js?v=20261121.duration |public,max-age=300,stale-while-revalidate=3600 |MATCH34813bytes |
|/saas/workspace-video-dictation.js?v=20261121 |public,max-age=300,stale-while-revalidate=3600 |MATCH9829bytes |
|/saas/workspace-ai-runtime.js?v=20261121.dictation |same static policy |MATCH14180bytes |
|/saas/sw.js |public,max-age=0 |MATCH3738bytes |

No authenticated device DOM/screenshot or service-worker cache inspection inside the owner's actual browser. Source confirms old/new interfaces both remain. No implemented unified redesign expected in this release. Source hashes are captured by census where those files are in scope; byte-match results above are this session's observed evidence, not a browser behavior test.

## E-MS-02 — historical candidate acceptance (reuse, not T195 rerun)

Released candidate6dd2a0e/local42c7ed3, tree834275b, squash main58fc72b. CI44870894755 and Security44870894658 all six checks successful. Hosted verify job136744943466 reports73/73 and82 contract files. Hosted UI job136744943252 covers AI-video camera/narration, custom30-second playback, Unlimited consent/Finish, web phone, meetings, localization/mobile and broader navigation/redesign/comms/finance/reliability.

Focused prior regressions23/23: actual synthetic60/300/600-second media assembly, duration/continuous Finish/reservation/tenant guards, dictation and runtime. Language strings in unit tests are not recorded-speech accuracy tests. Hosted mic test captures fake-device audio then mocks transcription; explicit browser recognition is mocked. No funded Google/Runway video or live STT recognition is proven by this evidence. New regressions must be added for current user-reported failures before claiming fixes.

## E-MS-03 — static census and research (T195)

`python docs/media-studio/master-inventory-generator.py`:347 entries across50 source/test files;59 route declarations (incl public bearer /m),20 table declarations,26 tests plus components/controls/bindings/pipeline references. Inventory records file/line and SHA256 per source. Regex/static parser limitations are explicit; runtime role/device inventory remains PARTIAL.

Seventeen named competitors researched through official docs/product/help pages; current public facts separated from product inference. Source register in master-research.md. Kling/Hootsuite dynamic API detail partly inaccessible; no performance, proprietary security or pricing superiority claim. No accounts created or paid operations run.

## E-MS-04 — release-blocking verification still NOT PERFORMED

- Owner device reproduction of Speak Idea/Prompt and actual authenticated failure trace.
- Recorded Hindi/Urdu/English and mixed-language recognition, pause/stop/cancel under native Android/iOS/PWA contexts.
- Correct tenant/provider billing project, balance/model access and controlled funded minimal generation.
- New complete two-tenant adversarial tests across jobs/workers/assets/previews/credentials/cache/notifications/campaign/publishing/analytics.
- New timeline/edit/export/preview parity, accessibility/performance targets and full responsive device matrix.
- Live official publishing receipts for approved test destinations; no social post was made.
- Fresh production backup integrity/freshness, isolated restore and compatible app rollback rehearsal. Code/runbook existence is not backup recovery proof.

## Planned acceptance matrix (after blueprint approval)

| Test group | Repeatable fixture | Separate real acceptance | Release gate |
|---|---|---|---|
|Credential/billing |402/429/401/403/5xx/nonJSON; no extra paid submission |Owner-authorized funded tenant provider |Typed recovery, saved inputs, honest readiness |
|Speech |Fake audio/browser events, permission/error/late result/typing conflict |Labeled audio + native devices + approved funded STT |Editable correct-script result and graceful fallback |
|Generation |Deterministic vendor jobs, malformed media, interruption/cancel/resume |Minimal paid job per enabled provider within agreed cap |Playable file, accepted schema, traceable cost |
|Preview/edit |Seek/range/expiry, graph operations, duration/audio/caption assertions |Real target-device playback |Proxy/export parity, no fake play controls |
|Tenant A/B |Adversarial ID/replay/queue/cache/worker/publishing payloads |Separate authorized staging tenants, never real subscriber exploitation |No critical isolation breach |
|Publishing |Official API contract mocks, refresh expiry, uncertain send and processing states |Approved test account/content, confirmed receipt |No false published status or double post |
|Recovery |Killed worker, stale lease, assembly retry, storage exhaustion |Approved isolated staging restore and rollback |No discarded original/accepted task or stale DB overwrite |
|Performance/accessibility |Agreed mobile network, memory/CPU limits, axe + keyboard/RTL |Android/iPhone/tablet/desktop and assistive review |Targets measured, limitations recorded |

Only documentation/manifest/memory/secret checks are appropriate for this documentation batch. No reason to re-run expensive full application CI with unchanged runtime source; full suite remains mandatory at implementation/release gates.

## E-MS-05 — documentation quality gate (T195)

PASS five required coordination files,17 competitor rows,347 census records and all50 source SHA256 matches, Python inventory-generator syntax, relative artifact links, `git diff --check`, manifest749-file verification, project-memory validation and repository secret scan (739 eligible tracked files). Application/runtime files unchanged. No new application unit/browser suite was claimed or needed for this docs-only gate. Final publication receipt is appended to journal/handover after branch commit.

## E-MS-06 — first implementation candidate and follow-up

Candidate e0a2974 (locald46e67a), tree58e9a47, draftPR167. Node22 focused50/50 and local full73/73 pass. Hosted CI44906040895 verify job136851708489 passes; Security44906040911 green; legacy AI-video browser passes. New guided test creates/plays actual synthetic60-second video, then fails Library visibility because old focus-section observer hides it. This run is NOT a guided UI pass.

Follow-up fixes legacy section disposal/restoration and ARIA, adds explicit guided source reuse, shared media state/capture guards and private no-store previews.27 targeted regressions pass, including stale workspace responses, old recording permissions, library selection, full-preview clearing and picker clearing. New final full/browser/security checks remain required on follow-up commit. Local Chromium cannot launch due Unix socket policy; not counted as pass. No real vendor credit or social publication used.
