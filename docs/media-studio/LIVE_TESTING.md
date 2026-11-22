# Media Studio staged live testing — 22 November 2026

Release source: main8573c88ae1d3eb1aa05967c395954ec399aa5693. Tested candidatebb10e0689165730c5b073d7315e359da2d51da85 has identical tree6efdf455dc2a32f78d0a0ce332bb7728e8b76dd6. Render target dep-dc1d5ut9uf1s73e05840, LIVE at19:43Perth. Owner-workspace allowlist only; global unified flag off. This document records a staged test, not blanket completion.

| Check | Status | Evidence / next step |
| --- | --- | --- |
| Candidate automated gate | PASS | Six checks,73 verification checks,90 contract files and expanded hosted UI; Render build73/73 at11:42:54UTC |
| Fresh isolated restore | PASS |22Nov19:31Perth,1.3seconds,checksum OK,integrity ok; live database not replaced |
| Main merge | DONE | PR168 squash merge8573c88; PR167 closed as superseded |
| Superseded env rebuild | CANCELLED | Old-source dep-dc1d5qqjnfac738er7dg cancelled via Render Dashboard; intended release now building |
| Private upload | PASS | Labeled oprun-studio-live-check-3s.mp4,33KB uploaded only to owner workspace |
| Private playback before rollout | PASS | Actual video readyState4,duration3,currentTime3,error null,controls true |
| Actual release live/SHA | PASS | target deploy LIVE,exact8573c88,health200/ok,5assets SHA256 match |
| New navigation/settings | PASS | Authenticated owner shows Create/Projects/Library/Edit/Connections and sequential creation,one active creator |
| Real editor export/playback | PASS | Explicit3second split timeline produced3.021333second MP4; playback reached end,error null |
| Microphone controls | PARTIAL | Live button responds/graceful permission denial; real native speech unverified |
| Funded Google generation | UNVERIFIED | Requires provider billing recovery and explicit test budget; no paid call during this batch |
| Social publication | NOT PERFORMED | Existing approval and delivery pipeline remains authority; no test post sent |

## Owner acceptance sequence

1. Open Growth > Media Studio in the allowlisted owner workspace after deployment; reload once to fetch current assets.
2. Confirm one creator, prominent mic beside idea/prompt, attachment step, model/shape/quality/duration choices, voice/review step. Custom or continuous final video is assembled from provider-sized clips; provider limits and charges still apply.
3. On the actual Android/iOS device, choose language, permit microphone, speak a short Hindi/Urdu/English instruction, stop, review/edit text. No automatic generation should occur. Test denial and cancellation. Cloud-browser capture is not native-device proof.
4. Use the labeled synthetic clip for editor preview/export and private download. Do not overwrite customer media or publish it. Keep fixture labeled until owner authorizes cleanup.
5. Before real generation, check the chosen provider account funding/model support and agree a small maximum cost. Generate one short clip, inspect result, then test longer assembly only within the approved budget. Never silently switch providers.
6. Prepare campaign/calendar drafts, review exact content, channels, schedule and permissions. Actual publication requires a separately authorized concrete post; success is only confirmed from platform delivery evidence.

## Known limits and remaining work

Native speech and funded video remain unverified. Caption timing is estimated and reviewable. Further advanced brand/templates/thumbnails, LinkedIn/Pinterest publishing adapters and deep creative analytics/optimization remain partial master scope. npm audit --omit=dev reported0high/0critical and3moderate entries in the existing Telnyx/UUID dependency chain (GHSA-w5hq-g745-h8pq); suggested automatic repair downgrades Telnyx and was not applied during this frozen release. Investigate compatibility in a separate tested batch.

Rollback source58fc72b / previous live dep-dc0nunmc6qcc73bonn2g. Application rollback must preserve persistent disk and all subscriber data. Do not perform a live restore or destructive migration for this rollout. Feature flag rollback can hide the new interface independently of source rollback.

Dependency follow-up detail: main Dependabot job137194113384 / run45017908502 failed security_update_not_possible because @telnyx/webrtc@2.28.2 depends on UUID^8.3.2 through @peermetrics/webrtc-stats@5.9.0. This is an automatic update failure, separate from the passing candidate verification/security suites; do not report every new main check as green.

## MS-09 LIVE verification receipt — 22 November 2026 (Perth)

Status DONE staged release / TESTED core live upload-editor-export / PARTIAL overall T194. Render dep-dc1d5ut9uf1s73e05840 LIVE at11:43:32UTC /19:43Perth, commit8573c88ae1d3eb1aa05967c395954ec399aa5693. Runtime tree6efdf455dc2a32f78d0a0ce332bb7728e8b76dd6 equals tested candidatebb10. Render build73/73 PASS11:42:54UTC. Post-merge GitHub verify, recovered-release-ui, dependencies and codeql SUCCESS; dependency-review skipped on push. Separate automatic Dependabot UUID update job137194113384 failed security_update_not_possible, not a Studio regression. Existing UUID dependency constrained by Telnyx/peermetrics; audit0high/0critical,3moderate entries, follow-up retained. Do not claim every main check green.

HTTP healthz200/ok true. Deployed workspace.html, workspace-media-guided.js, workspace-studio-editor.js, workspace-studio-audio.js and workspace-ai-video.js all200 and SHA256-identical to tested local files. Authenticated owner UI visibly shows one Media Studio with Create/Projects/Library/Edit/Connections & billing and sequential Brief/Attachments/Production/Voice-review; visible Speak idea/prompt beside inputs. Other subscriber workspaces retain original UI via global-off/owner-allowlist rollout.

Controlled live test used only synthetic oprun-studio-live-check-3s.mp4 (33KB) in owner private library. Actual upload and private player passed readyState4/duration3/currentTime3/error null. Editor produced private MP4s, saved edit history, split timeline, and final “Oprun live check · verified 3s split export” succeeded: duration3.021333,currentTime3.021333,error null,controls true. No paid provider request or social post. Earlier two labeled exports were1.021333 seconds because initial trim default1second remained in graph; automation fill alone did not commit change. Native numeric ArrowUp/Tab confirmed graph via split0–1.5/1.5–3, and correct final3.02second output. This is not proof that all device inputs behave identically. Test assets/edit/creative drafts retained, no customer media changed/deleted. Default one-second trim merits future usability improvement.

Mic live check: selected English browser dictation and pressed Speak idea. Browser refused access; app visibly reported “Microphone access was denied. Allow it in your browser settings, then try again.” Controls reset, text preserved, no generation started. No retry around denied permission. This verifies wiring/graceful denial, NOT real speech accuracy/native Android/iOS or all languages. Remaining funded Google generation/account402 recovery requires provider funding and explicit cost-controlled acceptance. No billing balance changed or unapproved paid fallback.

No new Render app-level error logs returned in post-live error query11:43:32–11:45:01UTC. Browser transport had intermittent Input.dispatchMouseEvent timeouts; fresh DOM confirmed completed actions before any follow-up, avoiding duplicate submissions. Only extension metadata errors observed in sampled console, no application failure claimed from them.

Rollback source remains58fc72b / previous dep-dc0nunmc6qcc73bonn2g; persistent data and offsite backups retained, isolated restore previously passed1.3s checksum/integrity. Superseded env-triggered old-source build dep-dc1d5qqjnfac738er7dg cancelled safely before deployment; existing live was preserved until new release.

Exact next action: owner native-phone mic/language acceptance and funded small-budget provider generation; preserve failures without retry charges. Then remaining blueprint batches: provider-specific unsupported capability verification, advanced brand/templates/thumbnails, LinkedIn/Pinterest adapters, creative analytics/optimization, SDK/UUID advisory compatibility repair, wider live tenant/security acceptance. Mocked A/B isolation tests passed; no claim of adversarial production cross-tenant test. All historical tasks/journals remain; do not mark overall transformation COMPLETED. See docs/media-studio/LIVE_TESTING.md and this evidence branch; main contains runtime release, while newer operational handovers are on codex/t194-release-evidence. PR168 points here.
