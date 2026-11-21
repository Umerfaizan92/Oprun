# Oprun unified Media Studio — audit and implementation specification

Date: 21 November 2026 (Perth). Specification task T-193; implementation task T-194.
Status: implementation-ready design. The redesign and billing recovery below are NOT implemented or deployed by this document.

Release addendum (19:31 Perth): owner subsequently authorized deployment of the existing tested T-191/T-192 code. PR166 is merged as main `58fc72b597666c637a7fefb19af5962bb1980a80`; Render `dep-dc0nunmc6qcc73bonn2g` is LIVE. Six read-only deploy checks and both live feature-asset checks pass. The audit sections below retain their original pre-release snapshot; their release hold/unmerged statements are historical and superseded by this addendum. T-194 redesign and typed402 recovery remain unimplemented; continue T-194A from the current main release.

## 1. Audit report

### Verified release state

- Production main is `cfcae59c61b0784007a38611e60850f2471bb98e`: T-188 browser phone, T-189 enquiry alerts and T-190 video creator. Render service `srv-dbuq98ojo6nc73aro66g`, deploy `dep-dc0ghqbrjlhs739ukbt0`, verified live through the Render connector.
- PR [166](https://github.com/Umerfaizan92/Oprun/pull/166) holds T-191 multilingual prompt dictation and T-192 full-length/custom/continuous generation at `6dd2a0ec594662299e990fda3721a57746928dd5`; tree `834275b22a1dba8587325bde67b7f6434284c906`. Local equivalent `42c7ed3602f44904ab3164a749eb96aa85f4b0ca` has the same tree.
- Candidate evidence: CI44870894755 and Security44870894658; all six checks successful. Hosted full suite 73/73, 82 contract files; focused regressions23/23 including actual60/300/600-second synthetic-media assembly. Hosted browser acceptance includes dictation, camera/narration, custom30-second playback, Unlimited consent/Finish, phone, meetings, localization, mobile and broad interfaces. No paid real-provider render was run. Local Chromium previously could not launch under the workspace socket policy; hosted evidence is authoritative. Transient local logs disappeared on environment restart; hosted logs remain the durable source.
- PR166 is unmerged; production does not yet include T-191/T-192. Deployment is held during this expanded specification task. Do not discard these tested implementations or Claude's branches.
- Evidence is a source-code audit plus hosted browser regressions, not an authenticated inspection of the owner's current workspace or billing account. No current screenshots were attached to this request. Account balance, real channel permissions and real-provider output remain live acceptance items.

### Two workflows on the same page

| Surface | Exact current behavior | Decision |
|---|---|---|
| `saas/workspace.html` `#video-view` | Content Studio heading and Source/Organize/Frame/AI Edit/Optimize/Render ribbon | Replace competing ribbon with one real project stepper |
| `#media-library-grid`, `workspace-media.js` | Private uploaded/generated media, previews, source selection | Keep one asset service/library; use a drawer in the creator |
| `workspace-ai-video.js` `#ai-video-panel` | Inserts a second large creator after the library; provider setup, idea, prompt, guides, settings, narration, projects | Keep generation capabilities; rebuild into the unified composer |
| `#video-form`, `saas/app.js:581–584` | Separate editing prompt, model-independent quality/shape/options, manual Media ID, AI specification and Save to render queue | Merge useful editing intent into project settings; remove manual IDs and separate form |
| `server.js:4369–4370` `/api/saas/video-renders` | Stores `video_render_jobs` in `draft`; response says `rendered:false` and worker/services must be configured | This is a specification store, not an operational render pipeline. Import as drafts; hide old queue from normal creation |
| `app.js:694` old stepper | Scrolls to existing panels; does not enforce a sequential production workflow | Replace; one active step with real validation and Back/Next |
| Trend suggestions and creative score | Strategy templates and completeness heuristic, not live trends or performance prediction | Keep optional brief suggestions; remove numeric score from primary workflow |
| `src/ai-video.js` | Real provider jobs/projects, encrypted tenant credentials, final media asset, notifications | Preserve and extend service; one public project contract |
| `workspace-video-dictation.js` candidate | Speak idea/prompt controls after each field; automatic server recognition or explicit-language browser path | Preserve controller; place icon adjacent to field label/input as specified below |
| `src/growth.js` calendar vs `channel-providers.js` | Calendar has narrow Facebook/X auto-publishing; channel layer has broader media/video adapters | Consolidate orchestration behind existing adapters; do not create another scheduler |

Additional conflicts: two quality selectors, two shape selectors, two prompts, two queues, an exposed source ID, "Import from connected accounts" that only shows instructions, provider setup occupying the creation path, and edit toggles that can be saved without producing those effects. The Google adapter uses all selected reference images, whereas the Runway path currently uses only the first. Uploaded video guides are reduced to still frames; full motion conditioning must not be implied.

### Google402: diagnosis and concrete recovery

Confirmed code path: `start()` in `src/ai-video.js` POSTs Google `/v1beta/interactions`. A non-success response is converted to an Oprun502 with a string such as "Google did not start the video: status402". `checkKey()` checks model listing, rejects400/401/403 and5xx, but can accept402/429/other non-success responses. "Connected" therefore proves neither funding nor video entitlement. `last_error` has no corresponding reliable billing-block lifecycle in this path.

Google's official billing documentation says depleted prepaid credit produces402 until credits are added. The reported exhausted Gemini credits are consistent with this. The exact workspace's billing project/balance was not inspected; do not claim to have restored it. Platform prompt/transcription credentials and tenant video credentials are distinct and may belong to different projects. Match the failing request to its tenant/provider/project without exposing a key.

Fix sequence:

1. Correct key validation: reject/classify every non-2xx; distinguish authentication, quota, billing, model access and provider outage. A successful cheap metadata check yields `credential_valid`, not `generation_verified`.
2. Preserve structured upstream status/code/request ID in sanitized internal diagnostics. Return a stable Oprun error, not raw provider payload or secret-bearing URL.
3. On402 mark this tenant/provider `billing_required`, stop further automatic continuations and keep brief, attachments and all completed footage. No retry loop.
4. Show: **Google needs billing attention. Your project is saved.** Actions: **Open Google billing** (owner/admin), **Check again**, **Choose another connected model**, **Finish available footage**, **Keep as draft**. Non-admin sees **Ask your owner/admin**.
5. Owner resolves the correct project's balance/payment status in [AI Studio Billing](https://aistudio.google.com/billing). Oprun must not purchase credit or enable auto-reload implicitly. A metadata recheck cannot prove funding where no billing endpoint exists; label unknown honestly. Run one minimal, explicitly budgeted real render after account recovery to verify actual entitlement.
6. Alternate-provider fallback is offered only if connected, compatible and explicitly selected within a displayed budget. Do not move content to another vendor or start another paid request silently. No provider can guarantee generation without funding.

The voice work should be regression-tested independently, but temporal proximity is not evidence that recording caused a payment response. Also test request schema/model compatibility separately: they are additional possible failures, not explanations for402.

## 2. Single clean architecture

One navigation item: **Media Studio**. Three top-level views: **Create**, **Projects**, **Library**. One creator and one project list; Connections is a settings drawer/link, not a competing creation interface.

Create sequence:

1. **Idea** — purpose, audience, campaign goal and optional brand context; type or dictate.
2. **Prompt** — editable direction with adjacent microphone and optional **Improve with AI**. Show proposed changes with accept/undo; never invent business offers or prices.
3. **Attachments** — upload, camera or library; thumbnails, reorder, remove, preview. Explain reference image versus motion input according to selected model.
4. **Model & settings** — Recommended default; Advanced shows provider/model, final duration, shape and supported quality. Separate native generation resolution from export/upscaling.
5. **Voice-over** — None, record, upload/library, licensed voice, or own verified/consented clone. Script, language, playback, replace, original-sound mix and subtitle options.
6. **Generate** — saved brief summary, readiness, estimated price range/currency, spending cap and approval. One Generate video button. Running progress and Finish available footage stay on this project.
7. **Preview** — one playable final video, inspect sound/subtitles, edit a version, download, or create channel variants. AI plan/storyboard is labeled as a plan, never a rendered preview.
8. **Save / Post** — automatically saved private asset; explicit Add to campaign, Create social drafts, Schedule or Download actions. Publishing has a separate authorization step.

On mobile group these into four screens: Brief (1–2), Media (3), Production (4–5), Review & create (6). Preview/Post follows asynchronously. Desktop can show a compact summary beside the same step content. One source of truth stores every selection, so navigating backward does not reset the project.

Service design: browser composer -> project API -> persistent job orchestration -> provider adapters -> sequential FFmpeg assembly -> tenant asset library -> existing campaign/channel services. UI components never call vendors directly. Existing project/job/media tables are extended additively; a common project ID ties briefs, input assets, provider tasks, outputs, variants and publishing drafts together.

State machine: `draft -> validating -> queued -> generating -> assembling -> ready`; side states `needs_action`, `failed`, `cancel_requested`, `cancelled`. `needs_action` carries a typed reason; completed footage remains reusable. A saved specification is always `draft`, never `ready`.

## 3. Voice / microphone prompt specification

- Place a labeled microphone icon immediately beside **Your prompt**, at the top-right of its field group; also beside Idea. Minimum44px touch target, keyboard accessible, visible focus, icon plus accessible label **Dictate prompt**. It must not sit inside typed text or cover content. One active capture at a time.
- Tap starts recording after browser permission; button becomes **Stop**, with visible recording status/timer and a separate Cancel. Stop transcribes; Cancel discards capture, leaves typed text untouched and releases tracks. Page/workspace/sign-out changes abort capture and invalidate late results.
- Default **Auto-detect language**; selectable language hint for poor detection. Preserve Urdu, Hindi, Punjabi, English, mixed-language text, original script and RTL. Do not automatically translate.
- Insert at captured cursor/selection with undo. If text changed meanwhile, recognition is uncertain or insertion exceeds limits, show an editable transcript review. Never overwrite concurrent typing. Do not fabricate confidence values when the provider supplies none.
- **Improve with AI** is an explicit second action: punctuation/structure, scene/camera/style suggestions and brand constraints. Preserve names/numbers/meaning; translation is optional and separately accepted. No recording or transcription automatically submits generation.
- Preferred production path is server-side transcription independent of the video provider's balance; retain the existing voice endpoint behind an adapter. Browser recognition is a supported-language fallback, not universally available/offline. Permission denial, unsupported browser/language, timeout, empty speech and billing failures offer Retry, Choose language, Upload audio or Type. No silent recording restart.
- Transient audio is deleted after processing/cancellation unless the user separately saves it as narration. Prompt dictation and voice-over are clearly separate functions. Record consent/retention configuration; never send long-lived provider keys to browsers.

## 4. Reliable AI video generation flow

Recommended default: current Google Gemini Omni1.2Flash where tenant access and funding are verified; alternative Runway Gen-4.5. Veo3.1 through Runway remains a capability-gated choice. Do not restore the shut-down direct Gemini Veo preview endpoint. Persist exact provider/model/API version on each job; update compatibility through tested catalogue revisions, not inferred marketing names.

Attachments: retain originals privately, validate actual media type/size/duration, isolate tenant lookups and normalize only derived inputs. Model constraints determine attachment count, first-frame/reference/motion support and maximum prompt length. Never silently discard extra references or truncate a long prompt; explain and request a compatible model or approved condensed prompt.

Duration: retain15/30sec and1/5/10min presets plus custom seconds/minutes. Candidate T-192 supports fixed2sec–24h and ongoing **Unlimited · until I stop**. A full output is assembled from provider-length generations. Continuous playback does not guarantee a physically unbroken camera take or perfect identity across every generated boundary. Use scene/reference continuity, provider-native extension where tested, sound smoothing and preview-based quality checks. No frozen-frame padding to pretend more action was generated. Unsupported native4K must be disabled; label upscale4K separately.

Unlimited requires owner/admin consent, visible accruing cost estimate, a configurable hard application spending/storage cap and Finish. No arbitrary promise of infinite duration or storage. An already-accepted task may still complete and be charged after Finish. Concurrency and job reservation must prevent additional submissions after the stop gate. Show known charges separately from estimates and unknown pending exposure.

Narration: preview before rendering; default match-to-voice available. Explicit fixed duration requires resolving script-too-long before generation, not quietly trimming spoken words or holding a still frame. Give Shorten script / Extend duration / Keep fixed with explicit trim choices. Music/captions/logo/CTA controls become available only when their real processing step exists. Captions require transcript/time alignment and safe-area layout; generated text inside video is not a subtitle substitute.

Error contract:

| Reason | Action | Automatic retry |
|---|---|---|
|402/billing_required | Save draft/footage, billing link, recheck, explicit alternate model | No |
|401/403 | Reconnect or resolve permissions/model access | No |
|400/unsupported input | Highlight exact field and compatible values | No |
|429 | Respect Retry-After; capped jitter/backoff for safe polling | Never blindly repeat paid creation |
|5xx/network before acceptance known | Reconcile provider task/request ID, then manual resume if unknown | Safe polling only |
|Timeout after possible paid acceptance | `submission_uncertain`, check vendor before retry | No |
|Moderation | Explain, edit brief; retain inputs | No bypass fallback |
|Assembly/storage failure | Preserve provider clips; retry assembly or download available footage | No new generation charge |
|Publishing uncertainty | Reconcile external ID; do not post twice | No blind resend |

A blocked provider must not trap the whole studio: users retain drafts, edit/upload/download existing media, use known-funded alternatives, or finish existing footage. This is graceful recovery, not a guarantee external402 can never recur.

## 5. Redesign plan

- Replace old heading/ribbon/form/pseudo-render queue in one cutover, preserving records. No old/new creator toggle in the final navigation.
- Keep Library outside the step body; Attachments opens the same picker/service, not a second upload manager. Completed assets appear once with derivative versions grouped under a parent.
- One primary action per screen: Next, Review generation, Generate video, Review output, Prepare posts. Secondary Back, Save draft, Cancel. Sticky mobile footer must not obscure fields, errors or soft keyboard.
- Use readable compact spacing, visible labels and inline validation. Advanced editing controls collapse behind **More options**. Provider account setup becomes **Connections & billing** with credential/readiness badges.
- Display per-project actual progress and last provider check, not fake percentages/creative scores. No live trend claims without authorized data.
- Responsive checks at360/390/768/1024/1440px, landscape and zoom200%; keyboard/screen-reader operation, aria-live announcements, reduced motion, RTL, WCAG2.2AA contrast/touch/focus. Draft autosave shows Saved/Saving/Offline and detects conflicting edits.

## 6. Campaign and social integration

One final `tenant_media` ID is the handoff. Never require users to paste a Media ID or reupload generated content. **Add to campaign** opens existing/new campaign, pre-attaches asset and preserves source project/version. **Create social drafts** asks for connected destinations and suggests per-channel captions, hook, CTA, hashtags, alt text, subtitles, thumbnail and timing. User reviews all claims and translations.

| Destination | Audit finding | Required unified behavior |
|---|---|---|
|Facebook Pages | Growth supports direct media posts with permissions; channel adapter also exists | One adapter path, video/Reels capability check, approvals and receipt |
|Instagram, TikTok, YouTube | Channel adapters include media/video flows; Growth calendar currently labels these manual | Route calendar through tested channel service; actual app/account/scopes gate publishing |
|X | Calendar and channel paths overlap; video support differs by route | Consolidate, validate media support/limits and account tier |
|LinkedIn | Present in old export platform list; no equivalent publish proof in this audit | Export/manual handoff until a tested authorized adapter exists |
|Snapchat/WhatsApp Status | Export/calendar choices do not prove general API publishing | Clearly labeled manual share/export; no "posted everywhere" claim |
|Google Business Profile | Channel adapter supports posts/photos; this is not proof of video/Reels support | Only validated media types; offer alternative/export |
|Email/SMS campaigns | Reuse existing campaign compliance and approvals | Poster/link to hosted video; SMS link, no assumed inline video playback |

Use one publishing orchestrator, existing channel authorization and persistent attempts. Revalidate selected account, scopes, resource identity, user role, consent and plan entitlement at dispatch. Draft edits invalidate approval. Generate platform variants only when required and track their parent asset; published immutable variants cannot change underneath an approved post. Platform limits are versioned capabilities, not permanent constants.

Statuses: draft, needs_review, approved, scheduled, uploading, processing, published, needs_action, failed, delivery_uncertain. Published requires an external receipt/ID and processing success; queued/manual export must not say posted. Partial multi-channel success is visible per destination; retry only known-unsent destinations. Store schedule timezone and UTC, including DST handling.

Provider-fetchable media URLs should be scoped, expiring/revocable links with enough validity for asynchronous ingestion. Existing `media-link.js` signatures have no embedded expiry; add a versioned token path without breaking existing approved campaigns. Keep private originals private.

## 7. Recommended tools, models and agents

| Responsibility | Recommendation | Connection/replacement |
|---|---|---|
|Default video | Google Gemini Omni1.2Flash, official Interactions API | Keep adapter; add billing/error/capability contract and funded acceptance |
|Alternative video | Runway Gen-4.5; optional Veo3.1/Kling4/Seedance2.5 through Runway | Retain one alternate vendor connection; avoid showing all models by default |
|Prompt/script assistance | Existing configured text-AI service with structured output validation | Reuse; isolate its availability from video/transcription readiness |
|Prompt dictation | Dedicated multilingual transcription adapter; evaluate current OpenAI `gpt-transcribe` against representative Oprun samples | Optional independent provider integration; no new credentials created in this audit |
|Narration | Recorded/uploaded voice first; ElevenLabs for licensed/custom voices | Reuse consented clone service; professional cloning requires provider verification rules |
|Assembly/variants | Existing FFmpeg helpers, private storage and durable worker leases | Reuse sequential memory-bounded processing; migrate jobs to isolated worker before scaling heavy concurrency |
|Publishing | Existing channel adapters plus one orchestrator/calendar | Consolidate existing duplicate dispatch paths; no extra third-party scheduler needed initially |
|Product agents | Brief assistant, render planner, output checker, publishing assistant as constrained services | Versioned prompts and schemas; no authority to buy credits, invent offers or publish without approval |

Do not select models by an unsupported "world's best" claim. Benchmark approved samples for brand fidelity, original-script transcription, motion continuity, latency, successful completion and total cost per usable video. Catalogue checked against official documentation on21November2026; production availability remains account-dependent. No new paid subscription or infrastructure change is authorized by this specification alone.

## 8. Final implementation specification

### Contracts and ownership

Retain `/api/saas/ai-video` compatibility while introducing one public studio facade (do not build a second backend):

- `GET /api/saas/studio/capabilities`: supported models/input types/settings, readiness reason, checked_at; billing may be `unknown`, never inferred positive from model listing.
- `POST/PATCH /api/saas/studio/projects`: autosaved brief with optimistic revision and tenant-owned input IDs.
- `POST /projects/:id/validate`: unsupported settings, narration length, permission/storage readiness and price estimate range/currency/version. A non-billable check is not a funding guarantee.
- `POST /projects/:id/generate`: idempotency key, expected project revision, accepted estimate/budget/model/provider; returns202 and persistent job ID. Durable reservation/outbox precedes vendor submission. Reconcile uncertain acceptance rather than claiming exactly-once delivery across vendors.
- `GET /projects/:id`, `/events`: authoritative progress and actionable errors; existing polling fallback.
- `POST /projects/:id/finish` and `/resume`: idempotent state transitions with original footage preserved; explicit cost confirmation when a new vendor request is necessary.
- `POST /projects/:id/variants`, `/campaign-drafts`, `/social-drafts`: attach output IDs to existing downstream services; do not publish as a side effect.

Draft schema: idea, user_prompt, accepted_ai_prompt, language/script, attachment roles/IDs, model/provider revision, final-duration mode/seconds, shape, native/output quality, narration ID/script/voice, editing options, campaign context and revision. Jobs retain provider task/request IDs, dedupe key, lease/heartbeat, accepted/unknown submission state, cost estimate/known usage, error kind/upstream status, completed footage and final output metadata. Secrets remain encrypted in existing credential storage; logs redact prompts/PII where unnecessary, credentials and signed URLs.

Backend tenancy is always derived from authenticated server context. Owner/admin controls provider connections, budgets and approvals; permitted content roles draft/render within assigned budgets. Workers are independently tenant-scoped and recheck authorization where consequential actions occur. Rate/concurrency limits, streaming size bounds, SSRF-hardened downloads, private atomic writes, storage budgets and artifact checksums apply to every provider path, including legacy single-clip compatibility.

### Migration and implementation batches

1. **T-194A — failure recovery first:** reject all unsuccessful key checks, typed402/readiness UI, preserve drafts, billing CTA and no-charge retry policy. Add real error fixtures, including empty/non-JSON upstream body,429 and uncertain submissions. Verify a funded minimal render only after billing is resolved and a spending limit accepted.
2. **T-194B — unified project surface:** reuse tested T-191/T-192 code; move microphones adjacent to fields; replace old ribbon/form/queues with sequential creator and one project list/library. Import old `video_render_jobs` as drafts once using unique `(tenant, legacy_source, legacy_id)`. Keep source rows and old URLs as redirects/read-only compatibility; no destructive migration or duplicate asset creation. Distinguish completed outputs from saved specifications.
3. **T-194C — real production editing:** wire only implemented controls, resolve narration-duration mismatch, tested reference/motion capability rules, actual captions/branding/cropping, variants and preview. Hide unsupported controls rather than silently ignoring them.
4. **T-194D — publishing:** one orchestrator over existing adapters, campaign/media handoff, channel-specific variants, approvals, receipt reconciliation and manual fallback. No real external post without explicit user publishing instructions.
5. **T-194E — acceptance/release:** full contract suite, UI/navigation/redesign/localization/mobile/meetings/phone/video/comms, design-system build, manifest/memory/release validation, security checks; exact tested commit PR, then authorized Render deployment and live readiness checks. Never merge PR166 blindly before accounting for this new scope. Release smaller verified batches if they preserve one coherent interface.

No destructive cleanup: remove dead UI/code only after replacement bindings and migration tests pass. Preserve library records, projects, approved campaigns and old branch history. Rollback restores the previous app while additive database columns/import mapping remain compatible; never reset production data to a stale backup merely to undo UI changes.

### Measurable success criteria

- Exactly one active creator, one prompt authority, one asset library and one project status per project; no manual source-ID field or decorative step buttons.
-402 fixture produces `billing_required`, saved draft and actionable recovery; no repeat paid request. Connected-but-unfunded accounts never display generation verified. Funded real Google and alternate-provider minimal jobs are separately recorded before asserting live generation fixed.
- Dictation tests cover Urdu/Hindi/Punjabi/Arabic/English/mixed speech with representative audio; transcript review, original script, manual hint, denied microphone, concurrent edits, timeout and navigation cancellation. Set benchmark thresholds from labeled samples; do not assert100% accuracy or support every language.
- Actual full60/300/600-second files validate against requested length within0.2sec; continuous Finish accepts repeated requests without new continuations. Preview genuinely plays, voice matches selected resolution policy and no fabricated extra footage is added.
- All visible caption/music/logo/reframe controls have a verified processing result. Native/upscaled quality is labeled correctly; unsupported shape/reference combinations are rejected before cost.
- Resume/restart, lease expiration, double-clicks, concurrent refresh, uncertain provider submission, lost publish responses, storage saturation and partial channel success produce no blind repeated spending/posting.
- Cross-tenant IDs cannot read assets, jobs, voices, provider status or publishing drafts. Revoked roles/resources invalidate spending/publishing authority. No key or credential appears in UI, source, logs or handover.
- Saved generated media transfers into a campaign or social draft without reupload. Each destination shows eligible/ineligible/manual plus reason; approved integration tests verify published receipts, not just queued requests. Authenticated live tests are limited to approved test accounts/content.
- Mobile/RTL/accessibility checks pass and existing phone/meetings/comms remain green. CI green is necessary but does not establish funded live vendor availability.

## 9. Updated PROGRESS STATE

These checks mean audit/design/specification complete, not that the redesign or account billing has been fixed.

- [x] Full audit of current Media Studio + AI Video Generation completed (repository and hosted-test scope; live account inspection excluded)
- [x] Root cause of status402 and broken generation identified (Google billing response; faulty readiness/error handling confirmed; account-specific balance unverified)
- [x] Duplicate setups mapped and merge plan written
- [x] Single clean Media Studio architecture designed
- [x] Voice / microphone prompt input designed
- [x] Best-in-class video generation flow designed (quality objective, not a ranking guarantee)
- [x] Campaign & social media connection designed
- [x] UI/UX redesign specified: clean, sequential, mobile-first
- [x] Recommended tools / models / APIs selected against current official documentation
- [x] Final implementation-ready specification complete
- Current focus: specification complete; tested T-191/T-192 work preserved, unmerged.
- Next: T-194A typed provider billing recovery and validation, then T-194B unified composer; do not redo T-191/T-192.
- Not completed: actual unified redesign, restored paid Google generation, universal live social publishing, or new Render deployment.

### Transfer and continuation

Canonical specification: this file. Read `CLAUDE.md`, project-memory handover/checkpoints and both coordination logs before editing. Follow source evidence rather than stale summaries. PR166 remains the tested code base; this audit branch adds specification/memory only. No competing editing ownership has been assigned; use separate task branches, preserve exact remote/local tree mapping and save checkpoints after every batch. Claude, ChatGPT or Grok can continue from T-194A with this repository and authorized tool access; no automatic cross-model execution is promised.

### Official sources checked

- Google billing and402: https://aistudio.google.com/docs/billing
- Current Gemini video and retired direct Veo preview: https://aistudio.google.com/docs/video
- Omni request/REST response schema and capabilities: https://aistudio.google.com/docs/omni
- Runway model catalogue: https://docs.dev.runwayml.com/guides/models/
- Runway endpoints: https://docs.dev.runwayml.com/api/
- Current speech-to-text: https://developers.openai.com/api/docs/guides/speech-to-text
- ElevenLabs cloning: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/
- Instant voice cloning: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning

Source dates and account availability can change. Recheck capability schemas before activating a new model; do not change billing settings or expose keys to do so.
