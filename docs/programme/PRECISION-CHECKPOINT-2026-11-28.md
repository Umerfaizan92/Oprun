# T-272 — exact payment precision candidate

Status: TESTING; independent review and release approval outstanding. Owner ChatGPT, PRG-03/04/08. Base published candidate fc8c43365a7187b3f5da5a2e494fec502109968b. Decision D-095. No migrations, production writes, provider calls, deployment or claim adapters.

## Change and evidence

The earlier T-271 report documented silent rounding limits. Eight new assertions reproduced failures: ISK and UGX outgoing/incoming units, fractional JPY refund submission, an unrepresentable cumulative refund, fractional-JPY checkout and sub-hundredth-AUD checkout. Seven prior controls still passed. Further negative tests caught a locale/provider difference for HUF and an incomplete finance test fixture; both were corrected before recording a passing run.

- New src/payment-precision.js parses numeric major amounts to ledger hundredths without decimal rounding, rejects unsafe/non-numeric/non-finite/negative values, and provides exact Stripe-boundary conversions. Integer exponent notation and ordinary values such as 19.99 retain their decimal meaning.
- Explicit Stripe zero-decimal list and ISK/UGX special cases override display locale data. HUF, IDR and TWD use two API decimal places for charges/refunds; payout restrictions must not be applied to these flows.
- src/payments.js validates checkout before ensureInvoice and payment insertion. Saved-card charging validates before invoice/payment/provider operations. Provider confirmation comparisons use the same exact conversion. Existing invalid pending checkout amounts are flagged for review rather than settled through a rounded comparison.
- src/finance/routes.js rejects over-precision refund requests before service execution; src/finance/service.js refuses a Stripe amount with invalid currency granularity before creating a refund/approval. refundStripe also guards execution, including older approved requests.
- Signed refund events that cannot be represented exactly are recorded with outcome amount_precision_review, generate the existing review notice, and do not mutate payment/job balances. Repeated event IDs are acknowledged idempotently; the original provider event is not silently rounded. A later representable cumulative total can reconcile through the existing cumulative-delta logic; the flagged event itself remains review evidence.
- No existing financial records are rewritten or assumed correct. Historical reconciliation remains a separate controlled action.

Focused command under Node 22.23.5:

    node --test scripts/programme-payment-currency.test.mjs scripts/finance.test.mjs scripts/country-rules.test.mjs

Result: 29 tests passed, zero failed. Covers exact-decimal parsing, invalid JPY refund before approval, saved-card refusal without payment/provider mutation, no invoice on invalid checkout, ISK/UGX units, HUF/IDR/TWD charge units, AUD/JPY/KWD exactly representable refund amounts, partial/full/out-of-order/duplicate events, precision-review event deduplication and mismatched currency. Uses synthetic data, captured provider requests and local server stand-ins only.

Full npm test under Node 22.23.5: PASS, exit 0, 73/73 checks including 131 contract files (521.1 seconds for the contract stage). Payment/finance source files remained stable during that run. A later metadata-only correction to the checkpoint helper's old repository label was separately verified by project-memory.test.mjs: 6/6 PASS. No UI or live-provider acceptance has been performed. This is not an independently approved release.

## Source recheck and constraints

[Stripe currency documentation](https://docs.stripe.com/currencies) re-fetched 28 November 2026: API units and zero-decimal exceptions differ from locale display conventions; ISK/UGX use two-decimal API representation with whole-major-unit constraints. HUF/TWD payout restrictions do not imply zero-decimal charge rules. This source supports the provider-specific correction.

The current retrieved Stripe page did not expose its historical three-decimal presentment section. Existing three-decimal conversion is retained for exactly representable ledger values, and unrepresentable incoming values are refused for automatic accounting. This is NOT confirmation of current provider/account availability for KWD or any other three-decimal presentment currency. Generic ISO/display precision is not proof of Stripe product support. Keep actual service/currency/account verification as a release gate. The previous KWD synthetic mismatch demonstrates inconsistency under the existing model, not an actual production refund failure or provider certification.

No payout adapter or claim adapter was introduced. Arbitrary third-decimal amounts are not stored by the hundredths ledger. The bounded design prevents silent rounding at inspected subscriber Stripe charge/refund boundaries; it does not certify every provider, platform subscription flow or accounting calculation.

## Ownership, preservation and next action

Claude's PRG-02/T-280 queue files are untouched. Grok PRG-06 original is still missing; T-273 is BLOCKED with a separate review in GROK-PRG06-REVIEW-2026-11-28.md. Do not replace its original report or create a placeholder research branch.

Finish full regression, update this report and shared ChatGPT log, verify manifest/memory/secret scan, checkpoint, publish only the audit candidate to codex/programme-audit-20261128 and compare tree hashes. Leave T-271 and T-272 TESTING until independent review. Resume PRG-03 security/recovery evidence; complete T-273 only after exact original report/commit evidence becomes accessible. No main/staging push, deploy, spending or production mutation without owner approval.
