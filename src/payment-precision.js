// Oprun's ledger stores integer hundredths. Never round at a provider boundary.
// Stripe ISK/UGX use two API decimals but require whole major units:
// https://docs.stripe.com/currencies#special-cases (checked 2026-11-28).
import { minorDigits } from './country-rules.js';

const failure = () => Object.assign(new Error('Unsupported payment amount precision. Use whole units for zero-decimal currencies and no more than two decimals otherwise.'), { status: 400, permanent: true });
const whole = currency => ['ISK', 'UGX'].includes(String(currency).toUpperCase());
// Display locale data can classify HUF/IDR differently from Stripe's charge API.
const zero = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const digits = currency => {
  const code = String(currency).toUpperCase();
  if (whole(code)) return 2;
  if (zero.has(code)) return 0;
  // Preserve existing three-decimal conversion; provider availability is a separate gate.
  return minorDigits(code) === 3 ? 3 : 2;
};

export function majorToLedgerExact(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw failure();
  const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e');
  const [integer, fraction = ''] = coefficient.split('.');
  const shift = Number(exponent) - fraction.length + 2;
  const n = BigInt(integer + fraction), divisor = 10n ** BigInt(Math.abs(shift));
  if (shift < 0 && n % divisor !== 0n) throw failure();
  const result = Number(shift < 0 ? n / divisor : n * divisor);
  if (!Number.isSafeInteger(result)) throw failure();
  return result;
}

export function stripeUnitsOrNull(cents, currency) {
  if (!Number.isSafeInteger(cents) || cents < 0 || (whole(currency) && cents % 100 !== 0)) return null;
  const d = digits(currency), factor = 10 ** Math.abs(d - 2);
  if (d < 2 && cents % factor !== 0) return null;
  const result = d < 2 ? cents / factor : cents * factor;
  return Number.isSafeInteger(result) ? result : null;
}

export function requireStripeUnits(cents, currency) {
  const result = stripeUnitsOrNull(cents, currency);
  if (result === null) throw failure();
  return result;
}

export function ledgerFromStripeUnits(amount, currency) {
  if (!Number.isSafeInteger(amount) || amount < 0) return null;
  const d = digits(currency), factor = 10 ** Math.abs(d - 2);
  if (d > 2 && amount % factor !== 0) return null;
  const result = d > 2 ? amount / factor : amount * factor;
  if (!Number.isSafeInteger(result) || (whole(currency) && result % 100 !== 0)) return null;
  return result;
}
