# ChatGPT coordination

## 21 November 2026 — T-190 recovery and release candidate (PR #165)

- Recovered `claude/t190-wip` at `0768ccb` on separate Codex branches. Preserved T-188 `fa7f1a6` and T-189 `0073830`. Canonical published branch: `codex/t190-video-creator`; local integration branch: `codex/t190-integration`.
- Fixed Generate rejecting browser-recorded narration: streaming WebM has no Duration header. A bounded FFmpeg decode now measures the timeline. Real FFmpeg regression completes a two-shot project using this recording. Recordings over 600 seconds remain detectable; invalid files retain zero duration.
- Removed temporary DEBUG output. Added missing localization/mobile/meetings/web-phone/AI-video browser suites to CI. Fixed the pre-existing pipeline test to exercise the T-165 worker chooser and its disabled no-eligible actions.
- Reconciled squash-merged T-187 ancestry with main without changing the candidate tree. Published through the GitHub connector because shell push has no credentials; local and remote tree hashes matched.
- CodeQL identified a guide-image check/read race and insecure temporary writes. Guide-image size checks and reads now use one no-follow descriptor. AI clips, voiceovers and call recordings use private atomic replacement; the symlink target stays unchanged and saved files have mode 0600.
- Evidence: Node 22 AI video projects + web phone backend tests pass (2/2). Private-write symlink/permission regression passes. `build:ds`, manifest and memory validation passed before security hardening; final validation remains pending. One local full-suite run observed transient merge markers and is invalid evidence; repeat on stable source. Hosted CI is the browser authority because local Chromium cannot create its Unix socket.
- Current production: Render `srv-dbuq98ojo6nc73aro66g`, main `4945c147`, deploy `dep-dc0885u7bikc73fk3l00` verified live. No production data/settings were changed.
- Next: publish security hardening after focused checks; verify current PR CI and CodeQL, including review of intentional provider-media/test-fixture download warnings; run final manifest/memory checks; only after passing release gates squash-merge PR #165 and verify the automatic Render deployment goes live.

## 18 November 2026 — Render build isolation

- Baseline `7742dec`; previous coordination checkpoint `3b3eb8e`. The separate `fix/oprun-production-localization` branch contains a diagnostics-only commit and was left intact.
- Reproduced the SaaS platform contract failure locally with a synthetic `SOCIAL_WEBHOOK_SECRET`. The server test inherited the setting and the signed social request no longer used the fixture email secret fallback.
- Isolated the verification subprocesses and the standalone SaaS platform fixture from deployment settings. Preserved the TAP assertion and stack that can precede a file-level failure. No production runtime code changed.
- Next release step: review this isolated branch, verify production recovery evidence, and obtain owner approval before any merge to the auto-deploy branch or production change.
