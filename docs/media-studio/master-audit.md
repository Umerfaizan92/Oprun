# T-195 — recovered state and implementation audit

21 November 2026. Scope: Media Studio and its voice/library/generation/campaign/channel dependencies. Source audit complete within the declared scope; authenticated runtime control census and real-device/vendor acceptance remain PARTIAL/UNVERIFIED. No implementation changes in this task.

## Production and branch reconciliation

| Evidence | Verified state |
|---|---|
| GitHub main |58fc72b597666c637a7fefb19af5962bb1980a80, latest release |
| Render |srv-dbuq98ojo6nc73aro66g; dep-dc0nunmc6qcc73bonn2g LIVE, finished21Nov11:31:50UTC/19:31:50Perth |
| Previous deploy/rollback candidate |cfcae59 / dep-dc0ghqbrjlhs739ukbt0, now deactivated; rollback not executed |
| PR166 |Squash merged to58fc72b; tested tree834275b22a1dba8587325bde67b7f6434284c906 |
| T193 audit branch |codex/t193-unified-media-studio-audit, remote8f6ef9a1727614fb3d86cf8fc6a50a3a7fc43a6b; local equivalentfef2e17; documentation only beyond the released source |
| T195 ownership |Codex, separate codex/t195-media-studio-blueprint; documentation/census only |
| Claude preserved contributions |T188fa7f1a6/T1890073830 and T1900768ccb recovered and released through PR165; preserved branches untouched |
| Active concurrent agents |No active ownership asserted from old logs. Claude log last checked; do not assume an old branch is idle. Recheck branch heads/ownership before implementation |
| Local metadata |No upstream tracking ref means memory tool says "not on GitHub yet"; remote connector verification/tree mapping supersedes that local label. No code loss inferred |

T185 generation/preview, T186 meetings and T187 Telnyx were already released. T188–190 released via PR165cfcae59. T191 dictation and T192 duration released via PR16658fc72b. T193 is a completed specification, not completed redesign. T194 implementation is NOT_STARTED and now approval-gated by the current master brief. T195 is the expanded phases0–3 recovery/research/audit/blueprint, not a second implementation system. Earlier unrelated backlog items are not reassigned.

## Issue A — redesign absent

**Identified, not a cache fix.** Current source retains old `#video-form` alongside dynamically inserted `#ai-video-panel`; T193 only authored a specification. No unified redesign implementation was included in PR166. Live workspace HTML, generator JS, dictation JS, runtime JS and service-worker bytes match local released source. HTML cache header is `public,max-age=0`; generation/runtime assets use versioned URLs and five-minute stale-while-revalidate policy. Service worker explicitly excludes API/workspace paths and uses network-first public/static behavior. No Media Studio redesign flag or alternate redesigned route was found in the inspected modules. Existing old stepper scrolls to panels, not a hidden new screen.

Conclusion: missing implementation is confirmed; a stale-tab/device cache can still affect an individual session, but is not the reason a nonexistent redesign is absent. Responsive source/hosted regression exists; authenticated production layout in the owner's device/session remains UNVERIFIED. Fix after approval: implement unified UI behind a server-controlled tenant flag, verify actual served assets/route/role and screenshot Android/iOS/tablet/desktop; do not promise hard refresh alone changes the interface.

## Issue B — Speak Idea / Speak Prompt

**PARTIAL diagnosis; reported live failure not resolved.** Sources: `workspace-video-dictation.js:70–111`, `workspace-ai-runtime.js:164–241`, `server.js:transcribeVoice` and `/api/saas/voice/transcribe`.

Two actual paths exist:

- Auto: direct user click → getUserMedia/MediaRecorder → authenticated multipart voice/transcribe → server service. In free-AI mode server uses configured Gemini or returns503. A Gemini failure becomes a generic502 with no actionable browser fallback. Exhausted platform Gemini funding is therefore a plausible upstream failure even if the tenant video key is different; the actual failing request has not been captured.
- Chosen language: SpeechRecognition/webkitSpeechRecognition when available. Browser support, vendor recognition service/network, language and microphone permission can independently fail. Without recognition support, selected language also goes through server recording.

Bindings, stop/cancel, stale-result guards and text protection exist; this is not an absent onclick handler in source. Stop during permission waiting, last interim recognition results, mobile MIME selection, embedded-browser permissions, audio focus and service response all require reproduction. Pause control is not present in current dictation; do not advertise it.

Earlier UI tests used a real fake-device audio capture but intercepted transcription; chosen-language recognition was mocked. Unicode insertion tests do NOT prove recognition accuracy on recorded Hindi/Urdu speech. Add deterministic browser integration and separate approved real audio/device runs. Preserve existing text on every failure; expose sanitized error class with Retry/Language/Type. Independent STT is an architectural choice, not silently enabled paid fallback.

Evidence needed before marking fixed: device/browser/PWA context; permission status; recording/stop/transcription timeline; sanitized response status/error/request ID; actual editable transcript; cancellation/late-response check; native Android Chrome and iOS Safari recordings. Capture no keys or unnecessary audio/PII.

## Issue C — Google402

**Provider meaning established; account-specific root cause UNVERIFIED.** Official Google billing docs say zero prepaid balance returns402. The owner reported exhausted credits, but neither tenant key's billing project nor its balance was inspected. The video adapter uses a tenant-encrypted Google key; speech/text paths can use separate platform configuration. These must not be conflated.

Confirmed code defects: `checkKey()` in ai-video.js rejects400/401/403 and5xx but can accept402/429; `ready` derives from stored connection, not funding/model success. `start()` maps unsuccessful vendor response to generic502 and text; failure does not persist a consistent typed provider-readiness state. `transcribeVoice` also hides actionable upstream classes. No funded real render was attempted in this audit. Do not call402 solved or change billing settings.

After approval: reject/classify all non2xx checks; distinguish credential-valid from generation-verified; typed `billing_required`, quotas, access, unsupported parameters, moderation, outage, submission uncertainty; save brief/footage; stop automatic continuations; show billing/recheck/explicit alternate model/finish footage. Never auto-purchase credits or re-submit an ambiguous paid request.

## Inventory and decisions

`master-inventory.json` is a reproducible347-record source census across50 files:59 API declarations (including public bearer media),20 table declarations,26 test files, static/dynamic controls,76 event bindings and pipeline/storage references. Generator: `master-inventory-generator.py`. Each row has kind, file, line, classification and available guard evidence. Static discovery does not expand global middleware/router factories or enumerate every role-dependent DOM option. Runtime role/device census is a mandatory follow-up, not hidden under a completion claim.

| Subsystem / current surface | Class | Keep/merge/improve decision |
|---|---|---|
| Sidebar Growth/Media route, workspace view and bottom navigation |KEEP/IMPROVE |One Media Studio route; no second AI Generator menu |
| Old Source/Organize/Frame/AI Edit/Optimize/Render ribbon |MERGE/REMOVE |Replace scrolling decoration with actual stages; preserve legacy deep links through redirects |
| Source library/grid/search/filter/upload/picker |KEEP/IMPROVE |One private library; add folder/version/retention/usage later |
| Import from connected accounts button |UNVERIFIED/IMPROVE |Currently explanation, not asset ingestion; label accurately or add explicit authorized import |
| Old AI specification/style prompt/media ID/settings |MERGE |Import saved specs as drafts; no manual IDs in final creator |
| video_render_jobs draft queue |MERGE |Not an executing renderer; migrate references idempotently, keep records; remove competing visible queue only after cutover |
| Old AI captions/music/logo/reframe/highlights toggles |BROKEN expectation/IMPROVE |Saving intent is not applying an effect; only expose after real processing exists |
| Trend suggestions/completeness score |KEEP optional/REMOVE primary score |No unsupported live-trend or predicted-performance claims |
| New idea/director prompt and AI enhancer |KEEP/IMPROVE |One prompt authority; explicit accept/undo and stored user original |
| Google/Runway provider keys/catalogue |KEEP/IMPROVE |Encrypted tenant keys retained; billing/model access are separate readiness states |
| Photo/video guides and camera capture |KEEP/IMPROVE |Video currently supplies a still; Runway uses first reference; no motion-conditioning claim |
| Custom/full/ongoing duration and Finish |KEEP/IMPROVE |Released, tested synthetic assembly; explicit cost cap and estimate still ADD |
| Recorded/uploaded/ElevenLabs-cloned narration |KEEP/IMPROVE |Add real trimming/mixing, timing and provider-policy consent; separate dictation from narration |
| Existing inline video and full preview |KEEP/IMPROVE |Real playback exists; scene compare/waveform/speed UI and proxy pipeline incomplete |
| API jobs/projects, sweep, join and leases |KEEP/IMPROVE |Persisted state; web-process orchestration, not an independently deployed worker queue |
| FFmpeg assembly/private file helpers |KEEP/IMPROVE |Sequential normalization exists; implement editing graph, memory budget and all-path safety audit |
| Growth calendar and channel drafts/publish adapters |MERGE/IMPROVE |One publishing orchestrator; preserve approvals and uncertainty state |
| Campaign media attachments and signed bearer delivery |KEEP/IMPROVE |Shared asset IDs; add purpose/expiry/revocation/cache rules to current non-expiring links |
| Metrics/AI recommendations |PARTIAL/ADD |Existing social stats not proof of end-to-end media attribution/optimization |
| Timeline/drag/drop/split/text/audio/undo/autosave/version history |ADD |Not implemented by saved editing form; stage working features |
| Library folders/versions/storage policy UI |ADD |Preserve underlying originals; no destructive retention action |
| LinkedIn/Pinterest studio publishing |UNVERIFIED/ADD |Listed export target is not working adapter; app permissions/approval required |
| RBAC/tenant queries/private storage |KEEP/UNVERIFIED scope |Several guards/tests present; complete adversarial matrix still required |

### Security and storage observations needing verification

- ai-video studio role alias includes owner/admin/manager/super_admin/director; connection changes restricted to owners/admins; continued Unlimited spending restricted to owners/admins. These are baseline roles, not complete per-project scoped permissions.
- Media/project queries use server organisation context; tests include another tenant. Workers, caches, notification recipients and publishing need end-to-end adversarial expansion.
- Media originals currently resolve under uploadRoot/studio/<sanitized-org>; object-storage helper generates tenant prefixes, but not proof every studio operation uses primary S3. Inspect actual production mode through authorized diagnostics before migration.
- `/m/:token` is intentionally bearer-accessible for approved content sharing. Token is scoped to tenant+asset but lacks expiry; response permits public cache24h. Do not equate bearer access with an authenticated preview, and do not silently invalidate already-approved sends.
- Authenticated preview route overrides cache to private300sec; specify no-store/logout/workspace-switch checks for sensitive previews. This is a review risk, not a demonstrated cross-tenant leak.
- Google download branch and legacy single-clip writes need same streaming/time/host/path constraints as hardened shared helpers. No unreviewed security dismissal or blanket "secure" claim.
- Global/public product-guide STT and subscriber STT share functions/platform credentials. Verify quotas, billing policy, request context and public endpoint abuse separately; no cross-tenant transcript leak has been demonstrated.

## Backup and rollback

Verified code/runbook: persistent SQLite, Litestream DB replication/startup recovery, upload replication, separate temporary restore-drill with integrity/audit checks and a Render previous deploy. These mechanisms exist; current production backup freshness, actual restore success/RPO, object versions and IAM restrictions were NOT reverified in this read-only task. No production restore/write-test/rollback was run.

Before release: record a fresh backup manifest and approved staging restore drill; prove previous app can read additive schema; test flag-off, failed worker and orphan cleanup. Roll back application/flags only; never restore stale DB over ongoing subscriber writes. Render services cannot share one persistent disk across independent services: do not point a new worker service at the web service's local SQLite path. See master blueprint for staged worker/storage transition.
