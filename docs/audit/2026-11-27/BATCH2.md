# Batch 2 supersedes the batch 1 continuation state

27 November 2026. Production application/settings unchanged. Business owner login securely completed and verified. This is an existing production business, so no test records, prompts, uploads, provider retries, payment actions or sends were made. Tour/update overlays were dismissed (UI preferences only); sign-in naturally creates a session/audit event. Read-only does not mean literally zero authentication/UI preference writes.

## Verified findings

- **Media design root cause established:** the guided layout released in 8573c88 was deliberately removed/replaced by T-202 / PR174 / 6cbbe20, as D-053 records. Current Library/Reels/Editor/AI video tabs match that replacement. T-232 later restyled them without changing structure. STUDIO_UNIFIED flags and guided/projects code were removed. DO NOT enable historical flags or rebuild from stale handover instructions. Preserved guided screenshots are historical, not current acceptance baselines.
- Live Business navigation has eight top-level groups; Growth renders Campaign Studio, Media Studio, Website. The Studio AI tab renders voice input, automatic language choice, camera/guide uploads, custom/unlimited durations and voice-over controls. Presence only: capture, generation and continuous rendering NOT tested. Current provider UI reports billing attention; no billing retry/change authorized or attempted.
- Business settings: guided interview and module controls present; no settings saved. Current business profile is custom; investigate whether T270 collapse is expected for that profile before classifying regression.
- 31 homepage-linked public destinations checked with stable browser DOM observations: title/H1 present, no horizontal overflow at desktop width1363. /start redirects to create-account. Evidence public-routes.json. This is route/render smoke coverage, NOT every button/form, mobile, screenshot comparison or HTTP-status assertion.
- Node22.23.5 obtained for isolated tests; better-sqlite3 rebuilt locally. Four selected test files: tenant-isolation, tenant-sweep, ai-memory-isolation, agent-hard-limits. **20 tests PASS, 0 failed/skipped.** Tenant sweep reports 517 routes, 4508 requests, 23 cross-tenant tables, 0 server errors. Raw log and JSON included. Source findings SEC01–03 remain outside these acceptance assertions.
- Operator sign-in reached through the visible Business sign-in link. Securely submitted credential; page explicitly reports 'That admin key is not right.' No automatic retries. Founder Console BLOCKED by rejected credentials; manual takeover needed. Do not expose or recover credentials from code, environment or browser state.

## Approval scope is still preliminary

Audit continues. Existing 60-task register is authoritative; append confirmed security remediation there only when registering the approved implementation batch. Current source-derived fixes: reset browser conversation IDs with transcripts, bind guide conversations to caller identity, add synthetic reset/ownership regressions. Root coordinator owns audit/checkpoint; reconcile agent owns history and task evidence; security_review owns independent source/test review. No concurrent editing assignments. Frontend/backend/communications/storage/performance scopes will be allocated after approval to avoid overlapping work.

Remaining blockers: Founder credential; authorized disposable staging/test data for mutative flows; native Android/iOS hardware/sessions; AWS operational policy/restore evidence; funded test-provider authorization; implementation scope approval and distinct release approval. Suspended staging must not be resumed without infrastructure approval. No universal security, performance or completion claim.

## Exact next action

Offer manual takeover of the current Operator sign-in tab. User completes sign-in without linking a new account or changing credentials. Once user returns control, inspect fresh URL/DOM to verify actual Founder session, then continue read-only console audit. Do not automatically retry rejected key. Retain Business session at current Media Studio page. If manual login is unavailable, mark Founder coverage BLOCKED and proceed with isolated backend/UI verification and a consolidated remediation proposal explicitly excluding unverified operational/native/provider acceptance.

Remote checkpoint branch: codex/audit-20261127, batch1 docs commit f3e7500be27d7b2f9409cb41706dde108f026ee3. Local batch1 with screenshots commit987e0e7 has a different tree from remote because remote currently preserves report only. Portable archive includes screenshots and both reports; no private signed-in screenshots are included.
