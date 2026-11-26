# 07 · Master backlog, audit and plan (FINAL MASTER TRANSFORMATION brief, 26 Nov 2026)

Status: **read-only audit complete; waiting for owner scope approval.** Production is read-only (D-088).
Repository `Umerfaizan92/Oprun`, work branch `claude/transformation-phase1` at the commit that adds this file.
Live: Render service "Oprun AI" (`srv-dbuq98ojo6nc73aro66g`), branch `main`, auto-deploy on commit,
deploy `dep-dc3ql8ui0phs7388vfsg` = commit `b4880d3` plus an environment update the owner made at 03:42 UTC.

This file does not create a second task list. `PENDING_TASKS.md` stays the one register; each `MB-` line below becomes
a `T-` task there when the owner approves it. Earlier plans are folded in: `02_BACKLOG.md` (TR-01..TR-81: 31 of 36
done), `docs/ai-receptionist/` (R-01..R-20), `docs/ai-website/` (W-01..W-20).

## 1. What the audit found

**Already in place (KEEP, no rebuild).** Gold identity tokens (`saas/ds/tokens.css`: `--sp-gold #E6B455`,
`--sp-midnight #070B14`, gold scale 100–800, both themes; purple/cyan was rejected in D-056 and is not in the code);
one navigation registry (`docs/navigation/MAPPING.json`: 8 business groups / 62 pages, 10 console groups / 42 pages);
one shared email frame with a large monospace code panel (`src/email-templates.js`); one-time codes stored hashed
with expiry and attempt counts; a durable job queue with leases, retries and idempotency (`src/job-queue.js`);
an AI agent registry with 13 owned, permission-limited agents (`src/agents/`); a Founder Console covering overview,
revenue, subscribers, billing, support, people and teams, projects, marketing, operations, agents, security and
feature access; a 197-language catalogue with right-to-left support; industry registry and onboarding interview;
73 server test checks, 27 browser suites and a 426-screen visual check (business 348, public 78).

**Problems found**

| # | Finding | Evidence | Severity |
|---|---|---|---|
| A1 | Old page still served at `/saas/index.html` showing "AI Office Manager" and a Fleet Parlour line | `src/server.js:1145`, `saas/index.html:27,156,160` | P1 brand |
| A2 | Sign-up verification page shows the old "AI Office Manager" tagline to every new business | `saas/verify-account.html:3` | P1 brand |
| A3 | SEO crawler identifies itself as `SuperProSEOAudit … superpro.ai`, a domain Oprun may not own | `src/seo/audit.js:13` | P1 brand/trust |
| A4 | Public `/healthz` reports the old service name `super-pro-ai-office-manager` | `src/server.js:1115` | P3 |
| A5 | Render has **no health check path**, so a broken start can still go live | Render service config | P0 stability (needs approval: infra) |
| A6 | Duplicate navigation: Phone / Call Handling / AI Receptionist / Phone numbers setup / Calls & SMS setup (5 entries, one job) | MAPPING.json, Communications | P2 |
| A7 | Duplicate navigation: Website, Pages & editor, Search & AI visibility, 7 "SEO ·" pages, Search readiness, Search connection, Links | MAPPING.json, Growth | P2 |
| A8 | Quotes appear in Work, Money ("Invoices & Quotes") and "Sales documents"; "Plans, Billing & Add-ons" and "Change Plan" are separate | MAPPING.json | P2 |
| A9 | Two ChatGPT handover packages (`docs/chatgpt-emergency-handover/`, 20 Nov, out of date; `docs/transformation/HANDOVER_FOR_CHATGPT.md`) | docs | P1 continuity |
| A10 | No animated feature demonstrations, registry or rendering pipeline exist; the Google demo video the brief refers to was not attached | repo search | P2 (BUILD) |
| A11 | No single supervisor over the 13 agents: nothing detects stuck runs across agents, prevents duplicates across them or escalates | `src/agents/` | P1 (UPGRADE) |
| A12 | All background work runs inside the one web process. The database is SQLite on one Render disk, which only one service can mount, so a separate worker (T-048) is not possible without moving the database | render.yaml, Render disk | P1 architecture decision |
| A13 | One 512 MB instance in Singapore serves Australian customers | Render config | P2 (cost decision) |
| A14 | Email codes cannot have a working "copy" button in most mail apps (no scripts in email); today the code is large and selectable | email-templates.js | P2 (UPGRADE: copy on the web page, code first in plain text) |
| A15 | Browser test `console-ui` fails about 1 run in 3 on a timing wait (passes on rerun) | ERROR_LOG | P2 test reliability |
| A17 | An older **paid** service "Oprun" (`super-pro-ai-office-manager.onrender.com`, 0.5 CPU / 512 MB, its own 10 GB disk) is still running beside the live "Oprun AI" service; auto-deploy is off. It may hold old data | Render services list | P1 cost (needs approval; never delete before its disk is checked and copied) |
| A18 | A public preview `superpro-ai-v2-preview-20261029` (free, old branch and old branding) is still running | Render services list | P2 (suspend with approval) |
| A16 | Internal names still use the old prefix (`sp-` CSS tokens, `X-SuperPro-Voice-Provider`, `_superpro` DNS record) | code | P3: not customer-facing; keep for compatibility |

## 2. Master backlog (proposed)

Owner roles are scoped responsibilities carried out by Claude (development) with an independent reviewer pass on
high-risk work (§3). "S" = one working session of Claude (about 3–5 hours of continuous work, measured on this
project: W-05..W-08 plus release took about one session).

### P0 · Safety, data and production protection
| ID | Class | Task | Depends | Acceptance | Est. |
|---|---|---|---|---|---|
| MB-01 | BUILD | Set Render health check path to `/healthz` | approval | Render shows the path; a deploy that cannot start stays on the old version | 0.1 S |
| MB-02 | KEEP | AWS lifecycle rules for `oprun-ai/` backups (T-241) | owner | Rules visible in AWS; restore drill still passes | owner |
| MB-03 | UPGRADE | Restore drill recorded monthly on live (T-060) | approval | Platform health shows a drill under 31 days old | 0.3 S |
| MB-05 | RETIRE | Legacy paid service "Oprun" (A17): read-only check of what its disk holds, copy anything needed to S3, then suspend (not delete) | approval | Inventory recorded; data copied and checksummed; service suspended; cost stops | 0.5 S |
| MB-06 | RETIRE | Suspend the old public preview (A18) | approval | Old URL no longer serves the old design | 0.1 S |
| MB-04 | MERGE | One ChatGPT handover: refresh `HANDOVER_FOR_CHATGPT.md`, mark the 20 Nov folder superseded | — | One file, current SHA, next action, resume prompt | 0.3 S |

### P1 · Brand clean-up, continuity, supervision
| ID | Class | Task | Depends | Acceptance | Est. |
|---|---|---|---|---|---|
| MB-10 | RETIRE | `/saas/index.html` → 301 to `/` (keep the file for history) | — | Old page no longer shown; link checker clean | 0.2 S |
| MB-11 | UPGRADE | Verification page, crawler name, `/healthz` name → Oprun AI | — | No "AI Office Manager"/"SuperPro" in any customer-visible text (test added) | 0.3 S |
| MB-12 | UPGRADE | Brand asset library: one source for logo, wordmark, glyph, favicon, PWA/Android/iOS icons, email logo | MB-11 | One folder + manifest; all pages and emails use it; screenshots | 1 S |
| MB-13 | UPGRADE | AI Supervisor: one supervisor agent over the registry: stuck/late runs, duplicate prevention, escalation, daily summary; never approves its own high-risk work | — | Tests: stuck run detected and escalated; duplicate refused; console page shows it | 1.5 S |
| MB-14 | DECIDE | Background work architecture (A12): keep in-process with the durable queue (no cost), or move to Postgres + worker (cost, migration) | owner | Decision recorded | owner |
| MB-15 | UPGRADE | Fix the `console-ui` timing wait | — | 5 consecutive passes | 0.2 S |

### P2 · Simplify and upgrade the experience
| ID | Class | Task | Depends | Acceptance | Est. |
|---|---|---|---|---|---|
| MB-20 | MERGE | Communications: one "Phone & AI Receptionist" page with tabs; old addresses keep working (aliases) | R-15 | Nav entries 10 → 6; every old link opens the right tab; screenshots | 1 S |
| MB-21 | MERGE | Growth: one "Website" and one "Search" page with tabs; old addresses as aliases | — | Growth entries ~16 → 5; screenshots | 1.5 S |
| MB-22 | MERGE | Quotes in one place (Work), money documents in Money; one "Plan & billing" page | — | No duplicate entries; aliases; screenshots | 0.8 S |
| MB-23 | UPGRADE | Google-style simplicity pass on every page: compact groups, one primary action, icons with labels, dismissible AI tips | MB-20..22 | Before/after screenshots at 390/768/1440 for all 104 pages; axe clean | 4 S |
| MB-24 | BUILD | Visual guide engine: feature→demo registry (versioned), deterministic rendering with Playwright + FFmpeg from synthetic data, lazy/paused offscreen, reduced-motion still image, optional narration | sample video from owner | 5 demos shipped behind a flag; registry marks a demo outdated when its page changes | 4 S |
| MB-25 | UPGRADE | Codes: "Copy code" on the web verification pages; code first in plain-text emails; check SPF/DKIM/DMARC for oprun.ai (T-055) | owner DNS check | Copy works on phone and laptop; mail-tester style check recorded | 0.8 S |
| MB-26 | UPGRADE | Performance budget: workspace first load, Lighthouse mobile ≥ 85 (T-236) | — | Before/after numbers recorded | 1.5 S |
| MB-27 | UPGRADE | Translation coverage report → fill the top 10 customer languages for the main flows; RTL screenshots | — | Coverage % per language before/after | 2 S |
| MB-28 | UPGRADE | Industry onboarding: voice or text interview → proposed workspace (modules shown/hidden) for owner approval | existing interview | 5 industries tested end to end | 2 S |
| MB-29 | DECIDE | Region/plan (A13): stay Singapore 512 MB, or move/upgrade | owner, cost | Decision recorded | owner |

### P3 · Already planned, waiting on providers or keys (carried over unchanged)
AI Receptionist R-01/R-02 (voice keys), R-17 (Telnyx staging), R-19 (after a stable live release), R-20 (price);
AI Website W-10..W-20 (Cloudflare items); live provider checks T-053, T-055, T-057, T-242; T-037, T-072, T-076
(blocked as recorded). Receptionist and website items in TESTING (T-123..T-142) close with a live test after release.

## 3. Who does what

Development work is done by Claude acting in the brief's roles one at a time, in the order above, never two edits on
the same files at once. High-risk changes (security, payments, data migration, permissions) get an independent
review by a separate reviewer agent that has not seen the work, before commit. Production agents are the 13 in the
registry plus the new Supervisor (MB-13); they run in the live service on the durable queue with permission lists,
timeouts, retries, audit logs and approval gates. No agent approves its own high-risk work.

## 4. Order and timeline

MB-04 → MB-01/05/06 (after approval) → MB-10/11 → MB-15 → MB-13 → MB-12 → MB-20..22 → MB-23 → MB-25 → MB-26 → MB-24 → MB-27 → MB-28.
P0/P1: about 6 sessions. P2: about 17 sessions. Total about 23 sessions of Claude work, plus owner items.
Each release goes to the test site first (`oprun-test`, free, branch `claude/transformation-staging`, D-056), then to production **only after your approval of
that release**, and is checked on www.oprun.ai with screenshots and the live commit recorded.

## 5. Cost

- Claude work: covered by your Claude plan; usage limits, not money, set the pace.
- MB-05 should **reduce** cost: the legacy paid service and its disk stop billing once suspended.
- No new paid service is needed for MB-01..MB-28 as written. Possible costs that need your decision first:
  Render plan or region change (MB-29), a database move (MB-14), narration voices for demos (MB-24 can ship without
  narration), and the receptionist voice providers (per-minute, on your own accounts). I will get current prices
  before asking you to decide.

## 6. Blockers and decisions needed from you

1. Approve this backlog (all, or which IDs) and that each production release needs your yes.
2. MB-01 health check path, MB-05 legacy paid service, MB-06 old preview (infrastructure changes).
3. Attach the Google demonstration video the brief mentions (MB-24 copies its pacing, not its content).
4. Later decisions: MB-14 architecture, MB-29 region/plan; carried-over keys and accounts (§2 P3).

## 7. Resume instruction

If a session ends, the next one runs `npm run memory:resume`, reads `SESSION_HANDOVER.md` and this file, and
continues with the first approved `MB-` task not yet in `COMPLETED_TASKS.md`.
