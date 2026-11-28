# Checkpoint 025 — PRG-03 G1–G3

Tested runtime head 8d7f8dfffb54793f5f2d9585a1ba05f5fa7b1487 follows 2dba1d65d88a6663e5839d1b851108c296489e32 and independent review 431b44878093220b9366da04432b830903df4e5d. The review is a direct child of frozen correction checkpoint 3d00fec369c27924f51f0a2d8bad0dfbb41fe622, whose parent is 09fcd0b2fdd36f1cdb008731fec0f6177eab4685. Financial correction ownership is limited to payments, finance, test fixtures and evidence. Neither the accepted PRG-02 paths nor PRG-04, T-274, reviews, lockfile or preserved integration refs changed.

- G1. An exact, authenticated refund failure after success compensates the payment and work-order balances in the same transaction as the state transition and append-only lifecycle evidence. A dated requires-action re-entry with supporting action metadata can reopen the reservation and compensate it. Stale or conflicting events cannot undo the newer decision. An owner can reconcile uncertain chronology with current read-only provider evidence. Lower aggregates do not authorise reversal. Recorded in-app notices and audit entries flag discrepancies.
- G2. New claims bind to an authenticated Stripe account ID and explicit balance mode. Before posting, a direct account also supplies the matching payment-intent identity, mode and currency. The webhook signing secret is independent, and signed events must match mode. Same-account credential rotation preserves held and pending recovery. Different-account, different-mode and unverified keys block financial operations against bound claims. Legacy recovery requires exact read-only matching plus owner authority. If the original fingerprint cannot be verified, the owner must also supply the expected account, mode, refund ID and an evidence reference. Connect remains excluded. Older test stand-ins without account endpoints use synthetic compatibility paths. Dedicated identity tests exercise the account, balance and payment-intent endpoints as synthetic responses.
- G3. A local balance conflict keeps the payment and work order unchanged, atomically records provider evidence and an audit/in-app notice, and acknowledges only after commit. Duplicate deliveries do not create another discrepancy. The owner can inspect and resolve a discrepancy using read-only provider evidence and existing authorised local corrections. Resolution sends no financial POST. Unexpected storage failures still retry so evidence is never acknowledged before it is durable.

Official references checked via public documentation and the public OpenAPI schema: [refund lifecycle](https://docs.stripe.com/refunds), [account retrieval](https://docs.stripe.com/api/accounts/retrieve), [balance and livemode](https://docs.stripe.com/api/balance/balance_retrieve), [Stripe OpenAPI](https://github.com/stripe/openapi). No Stripe account was contacted.

## Verification

Linux x86_64, Node 22.23.5, npm 11.19.1, synthetic SQLite and provider stand-ins. Locked `npm ci --no-audit --no-fund --fetch-retries=0` installed 266 packages, exit 0.

| Command and tree | Actual result |
| --- | --- |
| `node --test --test-concurrency=1 qa/programme/prg03-reacceptance-independent.test.mjs` on 431b448 | 23 pass, 3 fail, zero skip or TODO, exit 1. |
| `node --test qa/programme/prg03-reacceptance-characterisation.test.mjs` on 431b448 | 3 pass, exit 0. Includes repeated G3 HTTP 500 before the correction. These checks assert obsolete behaviour. |
| Unchanged mandatory command on 8d7f8df | 26 pass, zero fail, skip or TODO, exit 0. |
| `node --test qa/programme/prg03-g1-g3-acceptance.test.mjs qa/programme/prg03-financial-corrections-acceptance.test.mjs qa/programme/queue-independent-review.test.mjs scripts/programme-queue-isolation.test.mjs scripts/finance.test.mjs scripts/programme-payment-currency.test.mjs scripts/country-rules.test.mjs scripts/db-schema.test.mjs scripts/release-security.test.mjs scripts/tenant-isolation.test.mjs` on 8d7f8df | 135 pass, zero fail, skip or TODO, exit 0. Includes the prior 129 cases and six new mandatory cases. The old F1–F4 in-process provider fixture gained an explicit response for the account lookup without altering its assertions. |
| `node scripts/verify-manifest.mjs`, `node scripts/secret-scan.mjs`, `node scripts/memory/validate.mjs` | All exit 0. |

Independent review of this correction and separately authorised combined verification remain pending. Ambiguous legacy identity, conflicting chronology and unavailable credentials can require continued holds. The application cannot independently authenticate an external owner evidence reference. No live or Stripe test-mode account operation, production migration, deployment, data deletion, recovery upload or expenditure occurred.

## Evidence clarification appended at Checkpoint 030 (E1)

The original 26-case and 135-case commands in this receipt ran with NODE_ENV=test. Historical stand-ins exercised fingerprint compatibility where account lookup endpoints were absent. These are regression results. Production-path identity evidence comes separately from Claude's independent 12-case suite, whose synthetic workers run with NODE_ENV=production. Checkpoint 030 records versions, environment and the explicit test-only opt-in now required. See [Checkpoint 030](PRG03-FINANCIAL-CHECKPOINT-030.md).
