# PRG-03 / T-271 payment integrity and security audit batch

Status: candidate correction; independent review and release approval remain required.
Code base: main 234f56d9818da0590d5dabf1a4fa7b7a8139a7dd. Branch codex/programme-audit-20261128.
Owner: ChatGPT. Claude PRG-02 files remain untouched.

## Confirmed payment defect and correction

src/payments.js refundStripe sent Oprun hundredths directly to Stripe, while checkout correctly used toMinorUnits. charge.refunded applied provider minor units directly to the hundredths ledger. This affects currencies with zero or three fractional digits. It does not establish that a real customer refund was affected.

Synthetic reproduction before correction: 2 AUD cases passed; 4 JPY/KWD cases failed their assertions after fixing a missing finance-schema column in the test fixture. For an intended refund of 50 major units:

| Currency | Internal hundredths | Required provider units | Previously attempted provider units | Previous ledger refund on correctly reported provider amount |
|---|---:|---:|---:|---:|
| AUD | 5000 | 5000 | 5000 | 5000 |
| JPY | 5000 | 50 | 5000 | 50 |
| KWD | 5000 | 50000 | 5000 | 50000 |

Fix: convert outbound amounts using existing toMinorUnits and the payment's stored currency; convert cumulative inbound amounts to ledger hundredths before calculating the delta. A signed event specifying a different currency records currency_mismatch and leaves money balances unchanged. Missing currency retains legacy event compatibility; no claim is made that missing-currency validation was strengthened.

No schema migration, provider credential change, destructive operation or production data rewrite. Historical incorrectly recorded refunds, if any, need a separately approved reconciliation; this patch does not silently rewrite them.

Additional limitation: the shared ledger stores hundredths. It cannot exactly represent an externally initiated three-decimal-currency refund below 0.01 major units; this candidate rounds that conversion and does not redesign monetary storage. The KWD tests cover exactly representable amounts only. Record this as an unresolved payment-precision release gate for three-decimal currencies; do not claim complete arbitrary-precision currency support or release that support without a separately tested storage/validation decision (PRG-04/PRG-08).

T-272 must also address zero-decimal currencies: existing toMinorUnits rounds amounts that contain an unsupported fractional major unit (for example JPY 50.50). Valid input granularity must be enforced consistently for checkout and refunds rather than silently rounding a provider request while retaining a different ledger amount. This is a separate existing validation issue; the current tests use valid JPY integer-major amounts and do not close it. Do not release affected currency flows before precision validation is resolved.

## Executable evidence

- Runtime installed locally: Node 22.23.5, matching package engines. npm ci --include=dev --no-audit --no-fund completed; lockfile unchanged.
- Existing audit baseline: node --test --test-concurrency=1 scripts/tenant-isolation.test.mjs scripts/integration-tenant.test.mjs scripts/job-queue.test.mjs scripts/platform.test.mjs scripts/platform-team.test.mjs scripts/finance.test.mjs scripts/country-rules.test.mjs — 51 assertions passed, zero failed (before correction).
- New scripts/programme-payment-currency.test.mjs — 7/7 passed after correction. Covers outbound provider amount; signed cumulative inbound refund; duplicate event ID; repeated cumulative total with new ID; larger partial total; out-of-order older total; full refund; mismatched currency. Uses an in-memory database, synthetic encrypted-value adapter, captured provider requests and signed events; no provider network.
- AUD finance flow and non-two-decimal checkout tests exist separately; new tests specifically cover the refund boundary. Direct handler tests do not replace a live provider sandbox verification.
- Full npm test under Node 22.23.5: PASS, exit 0, 73/73 checks including 131 contract-test files (contract stage 522.9 seconds). Runtime source remained unchanged during this run. The final test-only additions for cumulative/out-of-order/full-refund cases were also rerun separately: 7/7 PASS. Documentation/checkpoint/manifest files were updated during the full run; no runtime source was changed after it started.
- Final manifest verification, memory validation, staged secret scan and git diff whitespace check passed. These checks do not certify external compliance or provider readiness.

## Other audit evidence and limits

- Subscriber identity middleware (src/server.js requireSaasUser) selects organisation through authenticated active membership, validates requested organisation IDs, enforces expiry/account state and staff access. Source evidence plus passing tenant baseline; not a universal proof of every route.
- Operator Console uses platform.identity plus section/action permits. Platform staff sessions and audit are separate from business membership tables. Support reads require subscriber approval, matching requesting staff, permitted area, expiry and no revocation, and log the read (src/operator-console.js). The platform-team baseline checks subscriber isolation; detailed platform identity suite is included by full regression.
- Storage creates per-organisation keys and checks ownership before short-lived signing (src/object-storage.js). Real AWS configuration/current restore freshness remain unverified; local storage tests are part of full regression.
- Five queue enqueue call sites inspected: reel.render and studio.export include org plus generated job ID; automation.execute uses run ID; campaign.send uses ID/time/random suffix; audit.verify_chain is platform/date-scoped. No externally supplied raw idempotency key was established at these boundaries. Generic enqueue key-only duplicate lookup remains a core design risk assigned exclusively to Claude PRG-02. Do not label it a proven remotely exploitable leak.
- Real payments, refunds, tenant data, provider APIs, calls, messages, email and posts were not exercised.
- The live production revision a691cf5 contains the audited refund logic; release remains blocked on known payment defects until corrected candidate review, tests and an owner-approved deployment. This report is not deployment approval.

## Review and exact next action

1. Full local regression is complete. T-271 remains TESTING pending independent review, not COMPLETED. T-272 remains NOT_STARTED for the precision design/validation follow-up; Claude PRG-02 is reserved T-280.
2. Preserve candidate, tests and checkpoint on audit branch only; verify published tree matches local candidate. Remote commit receipt belongs in the assistant's delivery message rather than a self-referential commit hash here.
3. Independent reviewer should read only src/payments.js diff and scripts/programme-payment-currency.test.mjs; challenge currency units, stored payment currency, duplicate/out-of-order handling, AUD compatibility and reconciliation limitations. Do not change Claude's PRG-02 ownership or claim this external review has occurred.
4. Continue PRG-03 route-level security/recovery audit and review Claude/Grok results when provided. No main/staging push, merge, deployment or paid action without owner approval.
