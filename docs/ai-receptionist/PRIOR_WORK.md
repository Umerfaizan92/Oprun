# Prior work (2026-11-19 chat, before the spec pack)

Kept so nothing from the earlier role-based sessions is lost. The decisions themselves live in
[00_CONTRACT.md](00_CONTRACT.md) §4 and §13; this file records **why**, with sources.

## 1. Voice stack research (Lead Manager)
- Speech-to-speech models measured 0.8–1.8 s from caller-stop to reply on Coval's October 2026 live-call board, and
  give less control over tool calls → pipeline STT → LLM → TTS (D-R1).
- Deepgram Flux: turn detection from meaning and sound, `EagerEndOfTurn` for speculative replies; multilingual model
  detects end of turn in under 400 ms. Backup: Pipecat Smart Turn v3 (BSD licence).
- TTS: Coval 8 Sept 2026 read put ElevenLabs Flash v2.5 at 185 ms median and Cartesia Sonic 3.6 at 440 ms; vendor
  benchmarks contradict each other, so a Sydney bake-off decides. ElevenLabs v4 Turbo needs a ~90 ms reconnect to stop
  speech; Flash flushes on the open connection; Cartesia cancels with one message.
- Telnyx has a Sydney point of presence (audio stays onshore, under 200 ms round trip). Twilio needs a regulatory
  bundle per business for AU numbers.
- Sources: cartesia.ai/learn/speech-to-speech-vs-cascaded, gradium.ai (low-latency TTS 2026),
  micdrop.dev/blog/cartesia-vs-elevenlabs, deepgram.com (Flux, Flux Multilingual), github.com/pipecat-ai/smart-turn,
  telnyx.com/voice-ai-australia.

## 2. Hosted platforms rejected (Receptionist Manager)
- Retell and Vapi: no Australian-primary region (amjid.au comparison); an Australian builder reported ~1400 ms lag
  in real calls (Reddit r/AIVoice_Agents); Retell sells numbers only in the US and Canada. Retell is kept only as the
  benchmark in task R-02.

## 3. Number provisioning (Business Manager)
- The full buy / forward / port design is now in [02_SETUP_WIZARD.md](02_SETUP_WIZARD.md) step 1 and the data model in
  the contract (`receptionist_numbers`, `receptionist_port_orders`).
- Facts used: local numbers need an Australian address and proof of address dated within 3 months (Telnyx AU DID
  requirements); ports need a Letter of Authority, ABN and a carrier invoice within 30 days; mobile ports need an SMS
  code per number; Telnyx timeframes: simple 3–6 business days, complex 5+ weeks, mobile 1–5 business days; porting
  hours 8 am–12 pm local; ACMA rules apply (acma.gov.au/port-customers-phone-number).

## 4. Competitor gap analysis (Business Analyst)
| | Upfirst | Rosie | Smith.ai |
|---|---|---|---|
| Entry price (USD) | $24.95/mo for 30 calls, then $1.50/call | $49/mo for 250 min | AI free for 25 calls; human-first from $300/mo |
| Billing | Per call; spam and < 15 s free | Per minute; automatic upgrade on overage | Per call; spam free |

Oprun advantages: calls become customers, enquiries, bookings and approvals inside Oprun; knowledge from the
business's own records; Sydney call handling and AU numbers; one subscription.
Must-have gaps adopted into the spec: spam filtering and no billing for spam, SMS summary + push, warm transfer with
briefing, texting the caller, free trial, language switching. Out of scope: human backup receptionists (D-R9).
Sources: upfirst.ai, heyrosie.com, lobbystack.com (Rosie terms review), smith.ai pricing, getmacha.com.

## 5. Audit checkpoints raised before the spec (and where they were answered)
| Checkpoint | Answer |
|---|---|
| TTS latency figures disagree | Bake-off R-02 decides |
| Render region of the Oprun app | `render.yaml` says **singapore** → media plane moved to AWS Sydney (D-R3) |
| One Telnyx account vs sub-accounts | One account, every number tagged by `organisation_id` in `receptionist_numbers`; confirm with Telnyx during R-17 |
| Forward detection | Automatic test call in wizard step 1 (02); verify on staging |
| Cost of the hidden forward-target number | Included in the add-on price set by Faizan (08) |
| ElevenLabs v4 Turbo reconnect vs 80 ms barge-in | Flash v2.5 is primary (flushes without reconnect) |
