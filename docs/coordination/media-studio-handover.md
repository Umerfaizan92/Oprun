# Media Studio continuation handover

Current checkpoint: T195 phases0–3 approval package. This file is a current pointer; append-only history is in media-studio-progress.md. Read CLAUDE.md, this file, master/decisions/test-evidence and both agent coordination logs before any edit.

## Production and code

- Main/live:58fc72b597666c637a7fefb19af5962bb1980a80; Render srv-dbuq98ojo6nc73aro66g / dep-dc0nunmc6qcc73bonn2g LIVE. Latest connector reads in T195 confirm no newer main/deploy.
- PR166 merged, T191/T192 released. T193 unified redesign is a specification only. T194 implementation NOT_STARTED; owner explicitly requires blueprint approval before major code changes and separate production approval. Earlier deployment authorization does not extend here.
- Preserved audit/release handover: remote codex/t193-unified-media-studio-audit8f6ef9a1727614fb3d86cf8fc6a50a3a7fc43a6b, local equivalentfef2e17. New docs-only codex/t195-media-studio-blueprint retains that work; no app source changed. Publish/tree receipt to be appended after commit. Local memory tooling may incorrectly label connector-published branches as not on GitHub because no upstream tracking ref exists.

## What is complete

Read-only recovery/public source comparison,17-vendor official-source desk study,347-record source census, duplicate/defect classification, three design directions, recommended single architecture, database/API/media/security design, two-tenant adversarial plan, estimates and staged rollout/rollback plan. No proprietary competitor source was accessed. No real user microphone/billing account or subscriber database was inspected.

IssueA: missing implementation confirmed, not a cache fix. IssueB: source bindings exist, Auto uses server STT and selected-language browser path differs; real-device failure unresolved. IssueC: Google402 matches documented billing block, but exact failing account response/balance not captured; key-validation/generic-error defects confirmed. Never call either live workflow fixed based on historical mocks.

## Exact next action

**WAIT FOR OWNER APPROVAL** of Direction A (or B/C), proposed architecture and MS-04A/MS-04B/MS-05A sequence. Do not implement major redesign, purchase credits/provision infrastructure, publish content or deploy. Present concrete package and request approval once; explain this gate comes directly from the owner's master brief.

After approval: re-read main/deploy/branch heads and task journal; establish non-overlapping file ownership; create implementation branch from latest main, bring required docs through reviewed normal commits (no force/rewrite); reproduce reported microphone failure with actual device and sanitized trace; implement typed billing/key-check recovery and isolated deterministic tests first. Preserve T191/T192 features. No existing microphone/model replacement justified until failure cause is measured.

Approved external acceptance later needs a specific funded account and cost ceiling, approved content/test destinations and native-device testing. Mocks remain repeatable evidence only. Fresh backup/isolated restore must be proved before any release; do not assume documented Litestream/signed-storage code is current recovery evidence.

## Evidence and constraints

Fresh live six checks PASS and five assets byte-match. Historical released CI44870894755 and Security44870894658 all six checks successful,73/73 including82 contract files; focused23/23 synthetic media/runtime/dictation. Native multilingual recognition and funded video not proven; no new runtime suite run for documentation-only changes. Full isolation, fresh restore and authenticated live UI remain partial/unverified.

No secrets, settings, accounts, runtime source, production records or other agent files changed. No destructive operations, external messages, real social posts or paid video calls performed. New blueprint runtime infrastructure is logical; don't attach a second Render worker to the web service's SQLite disk.

## Transfer protocol

Each completed batch: append stable ID/status/owner/branch/commit/files/tests/results/decision/blocker/exact next action; update memory checkpoint; commit and push permitted task branch. Save unfinished work via snapshot and explicit handover if access remains. Next session (Claude/ChatGPT/Grok) must be started and verify state; limits resetting does not automatically resume work. Never overwrite another agent's unmerged branch or claim an unfinished module done. Current uncommitted changes must be checked with git status; final publication receipt below records the saved batch.
