# T-195 — official-source competitor research

Checked 21 November 2026. Public documentation/product pages only; no paid accounts, proprietary source, quality benchmark, internal architecture or vendor security audit was accessed. Product statements below are documented capabilities, not independent performance validation. Public API availability does not establish Oprun's entitlement, price or permission to resell/white-label. Redirects/failed pages were followed with current official sources; do not reuse obsolete URLs as capability evidence.

## Seventeen-product comparison against deployed Oprun

Each row separates public facts from our design recommendation. V = official developer reference read; P = official public product/help page read; I = Oprun inference/recommendation, not vendor internals. Security, latency, cost per usable result and real mobile performance remain UNVERIFIED for every competitor in this desk study.

| Product | Verified public capabilities / API evidence | UX and workflow lesson (I) | Gap against Oprun main58fc72b | Integration decision |
|---|---|---|---|---|
| Runway (V) | Model catalogue exposes Gen-4.5, Veo, Kling and Seedance options; video/task API reference exists [R1] | Show one recommended model; expose compatibility in Advanced | Existing adapter/catalogue, but no reliable billing readiness/cost authorization | Keep alternate vendor; test exact model/schema before offering |
| Google Gemini/Veo (V) | Current video docs use Omni1.2Flash, native audio and3–15-second clips; direct Gemini Veo preview retired [R2] | Separate final film length from native generations | Existing Omni REST/long assembly;402 collapsed to generic failure | Keep current endpoint; implement typed recovery; do not restore retired preview |
| Kling AI (V-limited) | Official indexed API updates describe text/image/omni video; full JS-rendered reference was not extractable [R3] | Reference-role and capability labels matter | Existing Kling via Runway only; no direct Kling adapter | Retain aggregate access; direct integration optional after schema verification |
| Adobe Firefly (V) | Audio/video services document template rendering, reframe, translation/lip sync and TTS [R4] | Separate real post-production effects from generation intent | Oprun old controls store desired effects without producing them | Benchmark editing patterns; no new Adobe dependency in first release |
| HeyGen (V) | Developer platform describes avatar/voice/assets/editing orchestration [R5] | Script/voice/avatar are distinct assets and steps | No dedicated avatar workflow or verified avatar adapter | Optional later adapter; not prerequisite for normal video |
| Synthesia (V) | Async Video API, uploads, localization, poll/webhook completion and Billing API [R6] | Distinguish submitted/processing/finished files; balance visibility when supported | Oprun persists tasks but lacks comparable unified readiness view | Optional training/presenter vertical; no account created |
| Pika (V/P) | Official product shows video apps including captions/motion/extend; developer site offers multi-model media API [R7] | Provide task-oriented presets without another creation system | No Pika adapter; current presets/model settings limited | Candidate benchmark only; aggregator charges/terms need review |
| Luma (V) | Generation endpoint supports prompt, aspect ratio, keyframes and completion/failure callback URL [R8] | Keyframe controls and async status belong to a project | No Luma adapter or provider webhook framework in studio | Optional adapter after core reliability; don't invent callback signature support |
| CapCut (P) | Official editor page exposes timeline cutting/arrangement, captions, video studio and editing tools [R9] | Keep common edits close to the playable result | No working professional scene timeline in Oprun | Build small Oprun edit graph; editor automation API not established in this research |
| Canva (V/P) | Help documents multi-track timeline, trim/split, waveforms and mobile rollout; SDK REST docs available [R10] | Templates/brand controls with mobile simplicity | Branding toggles exist as specs, not a verified integrated editor | Optional design handoff; REST API is not proof full editor can be embedded/automated |
| Descript (P) | Public features include text-based video/audio editing, transcription, captions, speech and templates [R11] | Link transcript edits to media timing and revision history | Dictation text insertion exists; no text-driven timed editing | Design inspiration; full headless editing API not established |
| InVideo (P) | Current homepage describes upload footage → describe edit → review cut → export [R12] | Strong beginner path: intent first, review before output | Oprun exposes two separate workflows | Use one brief/composer; API coverage/terms need separate verification |
| VEED (P) | Official tools page lists video/image generation, scripts, voices, captions/audio and templates [R13] | One project can progressively reveal audio and editing | Disconnected voice, generation and old editing intent | Use progressive disclosure; no claim every consumer tool has an accessible API |
| OpusClip (P) | Public workflow accepts uploaded/linked footage and promotes clipping, resizing and publishing [R14] | Repurposing should produce traceable derivatives | No verified scene clipping-to-calendar pipeline | Later repurpose mode; avoid guaranteed virality scores and unauthenticated URL fetching |
| Buffer (V) | Current developer API documents agent/integration access and automating posts [R15] | Simple draft/schedule/status contract | Oprun already owns calendar but has duplicate dispatch paths | Reuse Oprun adapters first; external scheduler only if justified, not another calendar |
| Hootsuite (P/V-limited) | Public suite covers planning/publishing, insights and governance; API reference exists but extracted detail limited [R16] | Separate approval, publishing, receipt and analytics | Oprun approvals exist but studio handoff incomplete | Learn workflow; do not infer access or bypass app review |
| Metricool (V) | Help documents API export, scheduling, drafts, network options; API access plan-gated [R17] | Explicit channel status + analytics feedback in calendar | Growth and channel capabilities disagree in UI | Consolidate existing service; no extra paid API plan in initial scope |

## Capability-axis assessment

This is a qualitative gap assessment, not a market ranking. A product absent from a cell is not proven incapable.

| Axis requested | Evidence-backed public examples | Actual Oprun implementation | Proposed Oprun target |
|---|---|---|---|
| UX / AI workflow / prompt enhancement | InVideo intent/review; Canva mobile templates; Google conversational generation | Idea/prompt enhancement + two competing systems | One brief-to-publish project, optional AI director |
| Model quality / character consistency / references | Google reference-oriented generation; Kling/Runway capability catalogues | Last-frame chaining, images, extracted video stills; Runway receives first image | Model capability matrix, motion input only if actually supported; quality sample benchmark |
| Video/audio/narration | Google native audio; Synthesia uploads/localization; VEED/Descript audio tools | Record/upload/clone narration, no complete mixing editor | Separate source audio, narration, music, subtitles and timing |
| Timeline / previews | Canva timeline/waveforms; CapCut edits; Descript transcript editing | Native playable video and full viewer; no professional timeline | Real time-based edit graph, proxy preview and final render parity |
| Templates / brand | Canva templates/brand tools; Adobe template render | Old brief options, no proven final brand rendering | Versioned brand kit with actual composition |
| Publishing / campaign / analytics | Buffer API; Hootsuite governance; Metricool scheduling/export | Growth calendar + channel adapters + narrow auto-publish path | One approval/dispatch service, receipt reconciliation, metric provenance |
| API / asynchronous reliability | Synthesia async poll/webhook; Luma callback; Runway tasks | DB-persisted jobs and in-web-process poll/join leases | Durable outbox/claims, reconciled uncertain acceptance, independent workers when approved |
| Cost efficiency | Provider billing/catalogue choices; Metricool plan gate | Direct tenant vendor billing; no accurate estimate/budget ledger | Server authorization/reservation before each paid submission, estimate ranges + actual reconciliation |
| Security | Public API/auth documentation is not an independent isolation audit | Tenant-scoped video/media queries and encrypted keys; several scopes not adversarially verified | Explicit two-tenant test matrix across API/storage/worker/publishing/cache |
| Mobile / performance | Canva help explicitly distinguishes mobile rollouts | Hosted responsive regression; native iOS/Android speech not verified | Measured target-device capture/playback; lazy timeline/waveform/model code |

## Selection and benchmark policy

Keep existing Google/Runway adapters and FFmpeg; recorded/uploaded audio is the default voice path. Evaluate an independent STT provider only with approved credentials and explicit account/budget mapping. No automatic provider fallback. Optional avatar/video vendors must earn integration through a benchmark rather than expand the default model dropdown.

Before selecting a new paid provider, test a fixed approved set: product/brand fidelity, human/reference consistency, motion, multilingual transcription (Hindi/Urdu/English plus supported languages), content-policy rejection, latency p50/p95, provider task recovery, native/export resolution and cost per accepted result. Use labeled originals and blinded output review; report sample size and failures. No competitor security, response-time or cost superiority claim is established by this research. No video credits were spent.

## Official source register

[R1] https://docs.dev.runwayml.com/guides/models/ and https://docs.dev.runwayml.com/api/

[R2] https://aistudio.google.com/docs/video and https://aistudio.google.com/docs/omni ; billing https://aistudio.google.com/docs/billing

[R3] https://kling.ai/document-api/updates/api and https://kling.ai/document-api/guides/capability-map/video (official indexed extracts; rendered body limited). Do not substitute third-party kling-branded endpoints.

[R4] https://developer.adobe.com/audio-video-firefly-services/

[R5] https://developers.heygen.com/

[R6] https://developers.synthesia.io/docs/introduction

[R7] https://pika.art/ and https://dev.pika.art/

[R8] https://docs.lumalabs.ai/reference/creategeneration

[R9] https://www.capcut.com/tools/online-video-editor

[R10] https://www.canva.com/en_au/help/creating-and-editing-videos/ ; https://www.canva.com/en_au/help/using-brand-templates/ ; https://www.canva.dev/docs/apps/rest-apis/

[R11] https://www.descript.com/ (old /video-editor URL returned404)

[R12] https://invideo.io/

[R13] https://www.veed.io/tools/ai-video

[R14] https://www.opus.pro/

[R15] https://developers.buffer.com/

[R16] https://www.hootsuite.com/platform ; https://help.hootsuite.com/s/article/ask-for-approval ; https://apidocs.hootsuite.com/docs/api/index.html (API extraction limited)

[R17] https://help.metricool.com/basic-guide-for-api-integration-r97af (Advanced/Custom API access documented); https://metricool.com/metricool-api/ . The generic /api/ URL redirected to an unrelated explanatory article and is not capability evidence.

Current posting constraints also require official channel review: TikTok https://developers.tiktok.com/docs/en/content-posting-api-get-started ; https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide ; Pinterest https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/ and sandbox https://developers.pinterest.com/docs/developer-tools/sandbox/ ; YouTube https://developers.google.com/youtube/terms/api-services-terms-of-service/ . LinkedIn/Meta/X exact permission and upload schemas must be revalidated during the adapter batch, not assumed from a consumer interface.
