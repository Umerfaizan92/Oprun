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

## MS-04A / MS-04B / MS-05A final hosted acceptance — 21 November 2026

Status: TESTED first implementation batch; T194 remains PARTIAL. Owner: Codex. Candidate branch codex/t194-media-studio; draft PR167 https://github.com/Umerfaizan92/Oprun/pull/167. Remote candidate b67d3dcaaa407d53386fd00ca4d92f1387f91e55 equals local7a28df0c07b43e5c2761c8bdb507efede91eace1 tree d0646d306fb07fa2175ccb2d8bfd072539172345.

Verified: CI44906994554 and Security44906994542 completed SUCCESS; all six checks successful. Hosted npm test73/73,84 contract files; recovered-release-ui136854599798 passes legacy AI video, guided creator,60-second actual assembled playback, shared Library/source reuse, mobile layouts and accessibility; broader UI/navigation/comms suites pass. Local follow-up27/27 and final focused8/8 pass. These are synthetic-provider tests, not funded vendor generation or native microphone acceptance.

Screenshots from artifact14708302312 (oprun-redesign-visual-evidence), archive SHA256 b64aed609f7ed8e27d0f405334f3f152b53764b56f704580da6188c31b834b6c, visually inspected and preserved in docs/media-studio/previews: guided-brief-phone.png, guided-production-phone.png, guided-output-phone.png. Synthetic model names/color-bar video are test fixtures. Mobile tabs/steps scroll horizontally; toast overlays are transient. No signed artifact URL is retained.

Production remains main58fc72b597666c637a7fefb19af5962bb1980a80 / Render dep-dc0nunmc6qcc73bonn2g. No merge, deployment, settings change, paid provider call or external publication performed. Default-off STUDIO_UNIFIED_UI / STUDIO_UNIFIED_WORKSPACES must be explicitly activated during an approved rollout for redesign visibility.

Remaining: native Android/iOS microphone/language acceptance; exact funded account billing recovery and cost-controlled real generation; fresh backup/isolated restore evidence; wider tenant/security acceptance. MS05B script/storyboard/autosave/versioning, MS05C timeline/audio editing, MS06 campaign/publishing/analytics remain NOT_STARTED. No blanket isolation or end-to-end production completion claim.

Exact next action: review PR167's green candidate and preserved mobile evidence; continue approved next implementation batch in a separate branch after checking concurrent ownership. Production deployment requires separate owner approval and release gates. Resume from this handover, not historical WAIT FOR APPROVAL text above. CP158 was inadvertently created by the checkpoint CLI accepting --help as an ordinary invocation; the following explicit checkpoint supersedes it without removing history.

## T194 / MS05B–MS06A implementation candidate — 22 November 2026 (Perth)

Owner explicitly requested completion of missing Studio tasks followed by push/merge/Render deployment for live testing (D048). Prior deployment-gate text is historical; authorization persists. Agent Codex, branch codex/t194-studio-completion from local8adc8ae / remote handovere6f209. Main/live still58fc72b; no deployment yet.

Implemented candidate: tenant-scoped creative planning documents with optimistic version checks, idempotent saves, immutable revision history, editable multilingual scripts/storyboard and explicit application to prompt; autosave and saved creation settings/attachment IDs. Editor reuses the existing private library and produces real FFmpeg MP4 exports with trim/split/reorder, text/captions, source volume and additional audio, undo/redo and saved edit compositions. Durable export queue is separate from campaign queue, workspace bound, checks membership before/during processing, supports cancellation and protects original files. Output preview and download use existing authenticated private/range file route. Social handoff creates idempotent drafts with attached video in existing growth calendar; approvals and provider delivery remain existing authorities. No social post was sent.

Focused API/DOM tests8/8 PASS including actual two-second MP4, tenant A/B, idempotent export, private seeking, versions/conflicts and calendar drafts; final permission-guard follow-up2/2 PASS. Full local run after environment restart and expanded hosted browser acceptance PENDING. Previous temporary full log disappeared during environment restart and is not counted as a pass. Source is not release-ready until final checks pass.

Render Primary / My Workspace tea-dajtb13m8hqs739l6v50 is the previously owner-confirmed workspace. Read-only logs show hourly offsite snapshots written through21Nov15:58:18UTC (23:58Perth), plus uploaded-file backup at11:32UTC. This verifies recent replication, not an isolated restore drill. Browser live access attempt was automatically rejected because approval review hit a usage limit; no browser action or live microphone verification occurred. No workaround around that browser denial was attempted.

Remaining product gaps: native mobile speech acceptance and funded provider generation, fresh isolated restore proof, advanced drag timeline/transitions/logo/brand templates/waveform/automatic transcription and caption translation, media folders/retention/sharing, deeper optimization analytics and LinkedIn/Pinterest adapters. Those are not implemented by this candidate and must not be reported complete. Existing supported channel integrations remain. Google credit balance cannot be fixed in code. No zero-bug promise.

Exact next action: finish current Node22 full regression, publish candidate branch/PR with exact tree, run expanded hosted browser acceptance (project reload, editor playback, social draft workflow, accessibility), fix any failures, then close remaining release gates before the authorized rollout. Preserve all handovers, no secrets/data deletion or unapproved provider charges.

### MS05C security follow-up — 22 November 2026

Full local candidate regression73/73,86 contract files PASS (qa/studio-completion-full.log; runtime source changed during the run, so final hosted exact-SHA acceptance remains authoritative). Candidate remote d5b1274ef0e35a9110676a0d72951871e158def5 / localad69a2233afe73df7397b556792572a47a5e2f0b, identical tree3013cee312ca0a58d29b53165ff7cc862bc7b88a; draft PR168 published. CI44924586196 / Security44924586213 running; four security checks successful, verify/browser pending.

Follow-up seals FFmpeg network protocols to local file/pipe and validates editor source magic bytes before decoding. Adversarial test rejects fake MP4 playlist and blocks queued export after membership revocation; new draft DOM test preserves attachment/narration metadata and multilingual text and discards late save response after disposal. Targeted source/video regressions3/3 and adversarial2/2 PASS. No paid external call, main merge or deploy. Remaining master-scope gaps still apply; no whole-transformation completion claim.

## MS05–MS06 candidate continuation — CP163–CP165 /22Nov2026

Published library/voice candidate d70b2a193ca743dbdcfde603ed9a758a1e185acb (local4d1b9c1,tree0e6f844) and caption/audio candidate455a272a409ba097301ddf4e82b48dda8a833afc (local3dc8a4f,treee344159) to PR168. Source additionally implements logos, fade transitions, drag/reorder, explicit playback speed, edit revision restoration, stable preview nodes, private folder/label/notes/usage/version metadata, retention review dates without automatic deletion, expiring/revocable owner-only shares, pause/cancel narration, consented idempotent transcription, reviewable estimated caption timing, translation and real waveform preview. No external paid calls or posts were performed.

Tests: branding+adversarial2/2; library/voice/dictation17/17; caption/privacy/library4/4; final focused10/10; processing7/7; malicious playlist boundary4/4; deterministic Finish-before-submit1/1 PASS. Hosted security checks pass on published candidates; hosted legacy AI video passes. Expanded guided UI first stopped on an Organize accessible-name mismatch (fixed), then an ambiguous summary selector introduced by adding audio tools (fixed in follow-up, rerun pending). These were test selectors, not proof the entire new library/audio browser workflow passed.

Security follow-up extends file-magic checks to all common FFmpeg input paths and denies network protocols; preserves legacy QuickTime atoms. Found real Finish race: reservation could precede Finish while async frame preparation preceded actual paid dispatch. New last-moment database stop gate cancels the reserved unsubmitted job and joins existing footage. Held-frame synthetic test proves no second provider request. Ordinary stop assertion now measures after acknowledgement, allowing an already-submitted request while Finish travels over HTTP. No real account charged during tests.

Still outstanding: exact final hosted CI/browser acceptance and screenshot review; funded Google generation/native mobile speech; fresh isolated restore proof; deeper publishing adapters/permissions and analytics/optimization. No production/main changes or deployment yet. Owner deployment approval persists (D048); no need to request it again. Keep limits and unsupported provider capabilities explicit. Do not mark whole T194 complete.

## MS-07 acceptance receipt — 22 November 2026 (Perth)

Status TESTED candidate / PARTIAL overall transformation. Agent Codex. Runtime candidate PR168 head bb10e0689165730c5b073d7315e359da2d51da85 equals local a318e36, tree 6efdf455dc2a32f78d0a0ce332bb7728e8b76dd6. CI44928655323 and Security44928655284 SUCCESS; all six checks SUCCESS. Hosted verify136920309991: npm test73/73 and90 contract files PASS. Hosted recovered-release-ui136920310224 PASS: legacy AI video, guided workflow,60-second assembled playback, saved creative project reload, actual2-second editor export/playback, waveform, private library metadata/shares and calendar drafts; responsive390/768/1440 and accessibility; broader navigation616 checks and regression suites PASS. Synthetic providers do not establish funded vendor success or native microphone accuracy.

Artifact14716469212 archive SHA25620653ac09841e64b696785f8078b96b1fe86150240d4a7e75f653bd50752500b; four release-guided-*-phone.png screenshots preserved under docs/media-studio/previews. Editor screenshot visually reviewed: actual video player, audio controls and export available at phone width. No signed download URL retained. Historical recovery snapshot differs only in memory/checksum files: runtime work is already committed; do not restore over newer source.

Production remains main58fc72b597666c637a7fefb19af5962bb1980a80 / Render dep-dc0nunmc6qcc73bonn2g. PR168 draft, mergeable; no production change. D048 authorizes finalized live-testing deployment. PR167 is superseded by168, do not merge independently. Intended initial rollout is owner-workspace allowlist, global unified flag off, preserving settings. Fresh isolated backup verification needs authenticated Operator Console: current browser shows operator sign-in; business owner authentication is insufficient. No key read, typed or recorded. Recent offsite replication is not fresh restore proof.

Remaining: isolated restore drill; staged deployment and exact-SHA live verification; funded Google account and explicit cost-controlled real generation; native Android/iOS speech acceptance. Account billing cannot be repaired by frontend code. Further master scope still partial: advanced brand/template/thumbnail features, LinkedIn/Pinterest adapters, deeper creative analytics/optimization. Existing officially supported publishing paths remain authoritative; no real post sent. No zero-defect/all-languages guarantee.

Exact next action: securely authenticate Operator Console without enabling account-link shortcut, run isolated backup verify (never live restore); update PR168 final scope/evidence; check release gates, read current Render deployment docs, then staged owner-only rollout and monitor main auto-deployment. Do not spend generation credits or publish real content without concrete authorization. Preserve receipt, tests, SHAs and next action before interruption.

## MS-08 staged release started — 22 November 2026 (Perth)

Owner Codex; D048 deployment authorization persists. Secure operator authentication succeeded; no key visible or retained and no private account-link shortcut enabled. Existing Reliability > Backups > Test a restore executed an isolated drill:22Nov19:31Perth Passed1.3s, checksum OK, integrity ok. Production database was not restored/replaced. Latest daily snapshot1.4MB/244tables/audit-chain verified. Continuous replication running.

Current official Render deploys.md, health-checks.md and configure-environment-variables.md read: persistent disk precludes zero-downtime; autoDeploy on commit; environment updates merge existing variables and need deployment. Confirmed existing service Primary/My Workspace, main, persistent10GB /var/data. Only two nonsecret Studio flags changed (merge, never replace): unified UI globally off; signed-in owner workspace explicitly allowlisted. No credentials/settings outside those keys changed. Env update itself started old-source deploy dep-dc1d5qqjnfac738er7dg; no manual duplicate trigger.

PR168 made ready and squash-merged at expected headbb10 as main8573c88ae1d3eb1aa05967c395954ec399aa5693. Automatic deploy dep-dc1d5ut9uf1s73e05840 QUEUED at11:33UTC. This is not yet live. Older PR167 closed as superseded, branch retained. Rollback source58fc72b597666c637a7fefb19af5962bb1980a80 / prior live dep-dc0nunmc6qcc73bonn2g. Additive application changes preserve old-source compatibility; never roll back disk/data.

Exact next action: monitor dep-dc1d5ut9uf1s73e05840 to terminal state; verify exact deployed SHA, health, static assets and authenticated owner Studio tabs/microphone/preview paths; avoid paid calls/posts without cost/content authorization. Native-device speech and funded vendor generation remain unverified. Overall transformation PARTIAL; no final-live or all-tasks-complete claim until evidence exists.

## MS-09 LIVE verification receipt — 22 November 2026 (Perth)

Status DONE staged release / TESTED core live upload-editor-export / PARTIAL overall T194. Render dep-dc1d5ut9uf1s73e05840 LIVE at11:43:32UTC /19:43Perth, commit8573c88ae1d3eb1aa05967c395954ec399aa5693. Runtime tree6efdf455dc2a32f78d0a0ce332bb7728e8b76dd6 equals tested candidatebb10. Render build73/73 PASS11:42:54UTC. Post-merge GitHub verify, recovered-release-ui, dependencies and codeql SUCCESS; dependency-review skipped on push. Separate automatic Dependabot UUID update job137194113384 failed security_update_not_possible, not a Studio regression. Existing UUID dependency constrained by Telnyx/peermetrics; audit0high/0critical,3moderate entries, follow-up retained. Do not claim every main check green.

HTTP healthz200/ok true. Deployed workspace.html, workspace-media-guided.js, workspace-studio-editor.js, workspace-studio-audio.js and workspace-ai-video.js all200 and SHA256-identical to tested local files. Authenticated owner UI visibly shows one Media Studio with Create/Projects/Library/Edit/Connections & billing and sequential Brief/Attachments/Production/Voice-review; visible Speak idea/prompt beside inputs. Other subscriber workspaces retain original UI via global-off/owner-allowlist rollout.

Controlled live test used only synthetic oprun-studio-live-check-3s.mp4 (33KB) in owner private library. Actual upload and private player passed readyState4/duration3/currentTime3/error null. Editor produced private MP4s, saved edit history, split timeline, and final “Oprun live check · verified 3s split export” succeeded: duration3.021333,currentTime3.021333,error null,controls true. No paid provider request or social post. Earlier two labeled exports were1.021333 seconds because initial trim default1second remained in graph; automation fill alone did not commit change. Native numeric ArrowUp/Tab confirmed graph via split0–1.5/1.5–3, and correct final3.02second output. This is not proof that all device inputs behave identically. Test assets/edit/creative drafts retained, no customer media changed/deleted. Default one-second trim merits future usability improvement.

Mic live check: selected English browser dictation and pressed Speak idea. Browser refused access; app visibly reported “Microphone access was denied. Allow it in your browser settings, then try again.” Controls reset, text preserved, no generation started. No retry around denied permission. This verifies wiring/graceful denial, NOT real speech accuracy/native Android/iOS or all languages. Remaining funded Google generation/account402 recovery requires provider funding and explicit cost-controlled acceptance. No billing balance changed or unapproved paid fallback.

No new Render app-level error logs returned in post-live error query11:43:32–11:45:01UTC. Browser transport had intermittent Input.dispatchMouseEvent timeouts; fresh DOM confirmed completed actions before any follow-up, avoiding duplicate submissions. Only extension metadata errors observed in sampled console, no application failure claimed from them.

Rollback source remains58fc72b / previous dep-dc0nunmc6qcc73bonn2g; persistent data and offsite backups retained, isolated restore previously passed1.3s checksum/integrity. Superseded env-triggered old-source build dep-dc1d5qqjnfac738er7dg cancelled safely before deployment; existing live was preserved until new release.

Exact next action: owner native-phone mic/language acceptance and funded small-budget provider generation; preserve failures without retry charges. Then remaining blueprint batches: provider-specific unsupported capability verification, advanced brand/templates/thumbnails, LinkedIn/Pinterest adapters, creative analytics/optimization, SDK/UUID advisory compatibility repair, wider live tenant/security acceptance. Mocked A/B isolation tests passed; no claim of adversarial production cross-tenant test. All historical tasks/journals remain; do not mark overall transformation COMPLETED. See docs/media-studio/LIVE_TESTING.md and this evidence branch; main contains runtime release, while newer operational handovers are on codex/t194-release-evidence. PR168 points here.
