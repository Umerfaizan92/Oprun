# Oprun Studio: self-hosted AI video (T-196)

Status: design, sections 1-3 complete. Owner request 22 Nov 2026: zero external paid APIs, open-weight models only,
Wan 2.2 primary, LTX-2.5 only when the shot needs sound, an internal production agent, and a model-update loop.
Sources checked 22 Nov 2026: Hugging Face cards for Wan-AI/Wan2.2-* and Lightricks/LTX-2.5; VentureBeat on LTX-2.5.

## PROGRESS STATE
- [x] Requirements locked
- [x] Architecture designed
- [x] Production agent specified
- [x] Model selection and self-hosting plan complete
- [x] Prompt engineering system designed (section 4)
- [x] Automatic market-update loop designed (section 5)
- [x] Implementation plan written (section 6)
- [x] Render deployment + live test plan written (section 7)
- Decisions: 23 Nov 2026 owner chose an OWNED GPU server (section 3.7). Open: LTX-2.5 licence acceptance (LTX stays
  behind flag `STUDIO_LTX_ENABLED=0` until approved), server purchase and hosting site.
- Current focus: owner approval of the server build, then phase P1
- Next: P1 (benchmark box) as soon as hardware is on site

## 0. Locked requirements and facts that shape the design
- No call during generation leaves Oprun infrastructure. No Google, Runway, ElevenLabs, Kling, Veo or LLM API.
  This also covers the AI text Oprun uses today (Gemini) for prompts: the agent uses a self-hosted open LLM instead.
- Render has no GPUs. Render keeps the web app, database, queue and library; generation runs on Oprun-controlled GPU
  servers (owned, or bare-metal/VM leased as infrastructure: a fixed monthly cost, not a per-call API).
- Licences: Wan 2.2 = Apache 2.0 (unrestricted commercial). LTX-2.5 = LTX-2.x Community License, not open source:
  free only while Oprun is under US$10M ARR and within its field-of-use terms; record this, re-check at each
  release, budget a licence before that threshold. Every other component must be MIT/Apache/BSD.
- Reuse what is built (main (T-190, T-192, T-194 Media Studio)): projects table, shot chain with last-frame continuity,
  FFmpeg join and voice mux (`src/media-tools.js`), camera/voice capture UI, library, notifications, isolation tests.
  The bring-your-own-key provider adapters (Google/Runway/ElevenLabs) are switched off for this mode.

## 1. Architecture
```
User idea (typed, spoken, photos/videos)          Render (web app, SQLite, library, queue)
  -> /api/saas/studio/projects  ------------------> projects + shot jobs (status: queued)
                                                    ^             |
GPU server(s), Oprun-controlled                     | pull (HTTPS, HMAC, outbound only)
  worker: claims job -> runs model -> uploads clip -+             v
  models on local disk: Wan 2.2, LTX-2.5, Qwen3 (agent LLM), Whisper, Chatterbox, RIFE, Real-ESRGAN
Render: FFmpeg join + voice mux + loudness -> MP4 in tenant library -> preview, notify, use in posts
```
- Workers pull work; nothing on the GPU box is reachable from the internet. Each job carries only what that shot
  needs (prompt, guide frames, seed, settings), signed per job; results go back over the same channel.
- Models are downloaded once by an operator step into a pinned, checksummed store. At run time the worker sets
  `HF_HUB_OFFLINE=1` and has outbound network blocked except Oprun's API host, so generation makes zero external
  calls by construction (egress firewall rule, tested in CI by a "no egress" job).
- Tenant isolation: the worker never sees tenant ids beyond an opaque job id; inputs and outputs are deleted from
  the GPU box after upload (max 24 h retention for retries).
- Fallback: if no GPU worker is online, jobs wait in the queue and the user sees "queued"; nothing falls back to an
  external API.

## 2. Production agent
One internal service ("Director") on the GPU box: Qwen3 (Apache 2.0, 14B-32B, served by vLLM) + Whisper
large-v3-turbo (MIT) for speech. It outputs strict JSON validated by a schema; any invalid output is retried once,
then a rule-based template is used, so a job never fails because of the LLM.

### 2.1 Steps
1. Intake: text, or speech -> Whisper -> text (language detected; English output prompts, user language kept for
   voice-over). Guide media: photos as identity/product references, videos -> best frame (FFmpeg).
2. Brief: fill gaps with safe defaults: goal, audience, platform (9:16 / 16:9), length (default 15-30 s), tone,
   business context from onboarding. Ask nothing unless the idea is empty or unsafe.
3. Treatment: one-paragraph story with beats (hook 0-2 s, problem/process, proof, payoff, call to action as a spoken
   line, never as on-screen text the model would misspell).
4. Shot list: N shots of 5 s (Wan) or up to 10-20 s (LTX). Each shot: purpose, subject, action, setting, shot size,
   lens feel, camera move, light, colour, mood, duration, model choice, seed, needs_audio flag.
5. Continuity bible (fixed for the project): character sheet (face/clothing from guide photo), place, time of day,
   palette, lens family, colour grade. Prepended to every shot prompt.
6. Render shots in order. Shot k > 1 is image-to-video from shot k-1's last frame (continuity), plus the reference
   image; a fixed project seed family keeps style stable.
7. Quality gate per shot (automatic, no extra model cost): black/frozen frame check, motion score (frame diff),
   face-present check when a person is required, duration check. One automatic re-roll with a new seed on failure.
8. Voice-over: user's own recording, or script -> Chatterbox (MIT, zero-shot clone from the user's consented
   sample; output carries its built-in watermark) -> loudness normalised to -14 LUFS.
9. Assembly (existing FFmpeg tools): RIFE to 24/30 fps, optional Real-ESRGAN to 1080p, cross-fade 6-8 frames between
   shots, voice mux (picture holds the last frame if the voice is longer), optional music bed from Oprun's own
   licensed library, burnt captions generated from the script (exact text, so no model typos).
10. Delivery: MP4 to the library, poster frame, captions file, notification, cost/time log per project.

### 2.2 Model routing per shot
- Wan 2.2 A14B (I2V or T2V): default for every visual shot (best quality of the open set).
- Wan 2.2 TI2V-5B: draft/preview tier and overflow when the large GPU is busy.
- LTX-2.5: only shots with `needs_audio` (on-camera dialogue with lip sync, sound-led moments). Never used if the
  licence check flag is off.

### 2.3 Shot prompt template (filled by the Director)
`[continuity bible]. Shot k of N, Xs. [shot size], [lens feel], [camera move]. [subject] [action] in [setting].
[light], [palette], [mood]. Realistic motion, consistent face and clothing, no text, no logos, no watermark.`
Negative prompt (Wan): blurry, distorted hands, extra limbs, text, watermark, flicker, frozen frame.

## 3. Models and infrastructure
### 3.1 Models (all self-hosted)
| Job | Model | Licence | Notes |
|---|---|---|---|
| Visual shots | Wan 2.2 T2V/I2V-A14B (MoE, 14B active) | Apache 2.0 | 480p/720p; FP8 weights ~14 GB per expert |
| Fast/draft shots | Wan 2.2 TI2V-5B | Apache 2.0 | 720p@24fps; fits 24 GB |
| Shots with sound | LTX-2.5 (22B, distilled) | LTX-2.x Community | joint audio+video, up to ~20 s |
| Director LLM | Qwen3 14B-32B | Apache 2.0 | vLLM, JSON output |
| Speech to text | Whisper large-v3-turbo | MIT | spoken ideas |
| Voice / own voice | Chatterbox | MIT | consented zero-shot clone |
| Frame rate / upscale | RIFE, Real-ESRGAN | MIT / BSD | assembly |

### 3.2 Serving approach
Production: a custom Python worker (official Wan 2.2 code / Diffusers WanPipeline, `ltx-pipelines` for LTX-2.5)
behind a tiny internal job loop, with models kept loaded. Reason: fixed inputs, versioned code, testable, no
node-graph surface. ComfyUI is used only on an R&D box to prototype and compare workflows; a winning workflow is
re-implemented in the worker. Speed-ups: FP8 weights, step-distilled LoRAs (4-8 steps) for drafts, TeaCache-style
caching, torch.compile; each must pass the eval set before use in production.

### 3.3 GPU plan (verify with phase-1 benchmark; numbers below are starting estimates)
- Minimum viable (1 box): 1x 80 GB GPU (H100/A100) for Wan A14B FP8 + LTX-2.5, 1x 24-48 GB GPU (L40S/4090) for
  Director LLM, Whisper, Chatterbox and TI2V-5B drafts. 64-128 GB RAM, 2 TB NVMe for model store and scratch.
- Throughput guide: Wan TI2V-5B ~2-9 min per 5 s 720p shot on a 24 GB card unoptimised; A14B on 80 GB with step
  distillation targeted at 1-3 min per shot. A 30 s video = 6 shots, so plan per-plan monthly shot quotas and a
  fair queue (one active project per business, priority by plan).
- Scale-out: add identical worker boxes; the queue is the only coordination point.

### 3.4 Security and safety
Signed job claims, per-job expiry, outbound-only workers, model store checksums, prompt and output safety filter
(open NSFW/violence classifier on frames), consent record before any voice clone, no real public figures, audit log.

### 3.5 What changes in the app
Media Studio shows one "Oprun Studio" engine (no provider keys), states "made on Oprun's own servers", shows queue
position and shots done. The BYO-key panels stay hidden in this mode (code kept, off by default).

### 3.6 Model-update loop (outline; full design next)
Weekly ops job (not in the user path): list new video/TTS models on Hugging Face, filter to Apache/MIT/BSD or
already-approved licences, run the fixed 40-prompt eval set on the R&D box, score (automatic metrics + blind owner
review of 10 pairs), and write a recommendation. Switching needs owner approval and a canary on 10% of jobs.

### 3.7 Owned GPU server (decision 23 Nov 2026)
Recommended build (one server, Perth colocation or office rack with UPS):
| Part | Choice | Why |
|---|---|---|
| GPU A | NVIDIA RTX PRO 6000 Blackwell 96 GB (approx. A$21.5k-28k, AU retail Nov 2026) | Wan 2.2 A14B FP8 and LTX-2.5 FP8 fully on one card |
| GPU B | second RTX PRO 6000 96 GB (or RTX 5090 32 GB to save money) | Director LLM, Whisper, Chatterbox, TI2V-5B drafts |
| CPU / RAM | 24-32 core EPYC or Xeon, 256 GB ECC | model loading, FFmpeg, offload |
| Storage | 2x 4 TB NVMe (mirror) | model store about 400 GB plus scratch |
| Power / cooling | 2x 1600 W redundant PSU, rack chassis built for 2 workstation GPUs; about 1.5-1.8 kW at load | |
| Network | business fibre, outbound only; no public ports | worker pulls jobs |
Budget guide: about A$70k-85k with two 96 GB cards; about A$40k-45k with one 96 GB card and one RTX 5090.
Get two written quotes from AU builders; confirm warranty and that the chassis cools two 600 W cards.
Operations: Ubuntu LTS, NVIDIA driver plus CUDA pinned, Docker with NVIDIA runtime, encrypted disks, automatic
security updates, remote access only over WireGuard, nightly config backup, UPS-triggered clean shutdown,
health heartbeat to Oprun every 30 s (Oprun shows "Studio offline" and alerts the owner if missed for 5 min).

## 4. Prompt engineering system
- Director prompts are versioned files in the repo (`studio/prompts/vN/`): system rules, JSON schema, shot template
  (2.3), negative prompt, safety rules, 12 worked examples (trades, retail, food, beauty, real estate, product).
- Inputs are treated as data (quoted JSON), never instructions. Output is schema-validated; invalid -> one retry ->
  template fallback.
- Fixed vocabulary the models follow well: shot size (wide, medium, close-up, macro), move (static, slow dolly in,
  orbit, handheld, crane up), light (soft window, golden hour, studio key, neon), lens feel (24/35/50/85 mm).
- Platform presets: 9:16 hook in the first 1.5 s, faces centred in the safe zone; 16:9 wider establishing shots.
- Continuity bible is generated once and repeated verbatim at the start of every shot prompt.
- Each prompt version must beat the previous one on the eval set (section 5) before it is used.

## 5. Automatic model-update loop
Weekly job on the GPU server (ops only; not part of user requests):
1. Read new or updated video, TTS and LLM models from the Hugging Face Hub (metadata only).
2. Keep those with Apache 2.0, MIT or BSD licences (others listed for owner review, never auto-used), that fit the
   server memory, and that have working inference code.
3. Download to a quarantine folder, verify checksums, run the 40-prompt eval set (10 people, 10 products, 10 places,
   10 motion-heavy) at fixed seeds.
4. Score: automatic (temporal consistency, motion amount, face consistency against the reference, prompt-match with
   an open image-text model, time per shot) plus a blind owner review of 10 side-by-side pairs.
5. Write a one-page recommendation into Oprun (Super admin > Studio models). A switch needs owner approval, then a
   canary on 10% of jobs for a week, then full rollout; the previous model stays installed for instant rollback.

## 6. Implementation plan (phases; each ends with tests passing and a checkpoint)
- P0 Approvals: server quote, hosting site, LTX licence answer. No code risk.
- P1 Server and benchmark (1-2 weeks after hardware): OS hardening, models installed offline, egress firewall,
  benchmark Wan A14B / TI2V-5B / LTX-2.5 at 480p/720p, record times in this spec.
- P2 Worker (`studio-worker/`, Python): job claim/heartbeat/upload protocol with HMAC, Wan I2V/T2V, quality gate,
  RIFE, unit tests with a tiny model; "no egress" test.
- P3 Oprun side (`src/studio-gpu.js`): job queue tables, signed claim API, plan quotas and fair queue, Studio engine
  in the existing project flow (reuses shot chain, FFmpeg join, voice mux), BYO-key panels off by default.
- P4 Director: Qwen3 on vLLM, Whisper, prompt library v1, eval set, JSON validation and fallback.
- P5 Voice: Chatterbox with consent record and watermark; captions from script; loudness.
- P6 Hardening and launch: safety classifier, load test (10 businesses x 1 project), failure drills (worker dies
  mid-shot, server offline, disk full), accessibility and phone/tablet/laptop checks, Help article.
- P7 LTX-2.5 (only if licence approved): audio shots, lip-sync check.

## 7. Render deployment and live test plan
- Render: deploy the Oprun side (P3) behind `STUDIO_ENABLED=0`; existing Media Studio keeps working unchanged.
  New env (owner enters in Render, never in chat): `STUDIO_WORKER_KEYS` (HMAC secrets, one per server).
  render.yaml unchanged; normal autoDeploy from main after the full test suite.
- GPU server: worker runs as a systemd-managed container pointed at `https://www.oprun.ai`; enabling is per business
  first (Fleet Parlour as pilot), then all.
- Live tests in order: (1) heartbeat shows "Studio online"; (2) one 5 s draft shot; (3) one 30 s 6-shot video with
  a face photo and the owner's own recorded voice, checked on phone, iPad and laptop; (4) server unplugged during a
  shot: job resumes after restart with no duplicate; (5) egress check from the server shows no external calls during
  generation; (6) two businesses at once: no cross-tenant data; (7) quotas stop the 11th video on a 10-video plan.
- Rollback: set `STUDIO_ENABLED=0` (UI falls back to the current Media Studio); worker can be stopped without data
  loss because jobs stay queued.
