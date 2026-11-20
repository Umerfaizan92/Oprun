// Country profile: the single place that decides what is Australia-specific (docs/product-redesign/02_COUNTRY_ONBOARDING.md).
// Australia keeps business verification (ABR), the Australian worker compliance pack, GST and AU formats.
// Every other country: email + phone verification only, the documents-only worker pack, a neutral tax label.
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/max';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

// Countries under comprehensive sanctions are refused at sign-up. The owner confirms this list with an adviser
// and can replace it with SIGNUP_BLOCKED_COUNTRIES (comma-separated ISO codes; "none" clears it).
export const DEFAULT_BLOCKED_COUNTRIES = ['CU', 'IR', 'KP', 'SY'];

const EU_VAT = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const TAX_LABEL = {
  AU: 'GST', NZ: 'GST', SG: 'GST', IN: 'GST', MY: 'SST', CA: 'GST/HST', US: 'Sales tax', PK: 'Sales tax',
  GB: 'VAT', AE: 'VAT', SA: 'VAT', BH: 'VAT', OM: 'VAT', ZA: 'VAT', NG: 'VAT', KE: 'VAT', PH: 'VAT', TH: 'VAT', NO: 'VAT', CH: 'VAT',
  JP: 'Consumption tax'
};
for (const c of EU_VAT) TAX_LABEL[c] = 'VAT';

export const isCountryCode = (v) => /^[A-Z]{2}$/.test(String(v || '')) && getCountries().includes(String(v));
export const countryName = (code) => { try { return regionNames.of(code) || code; } catch { return code; } };

export function blockedCountries(env = {}) {
  const raw = String(env.SIGNUP_BLOCKED_COUNTRIES ?? '').trim();
  if (!raw) return new Set(DEFAULT_BLOCKED_COUNTRIES);
  if (raw.toLowerCase() === 'none') return new Set();
  return new Set(raw.split(',').map((x) => x.trim().toUpperCase()).filter(isCountryCode));
}

/** Countries a business can sign up from, sorted by name. Australia first. */
export function listCountries(env = {}) {
  const blocked = blockedCountries(env);
  const rows = getCountries().filter((c) => !blocked.has(c)).map((code) => ({ code, name: countryName(code), dial: `+${getCountryCallingCode(code)}` }));
  rows.sort((a, b) => (a.code === 'AU' ? -1 : b.code === 'AU' ? 1 : a.name.localeCompare(b.name)));
  return rows;
}

export function countryProfile(input = 'AU') {
  const code = isCountryCode(String(input || '').toUpperCase()) ? String(input).toUpperCase() : 'AU';
  const au = code === 'AU';
  return {
    code, name: countryName(code), dial: `+${getCountryCallingCode(code)}`,
    business_verification: au ? 'abr' : 'none',
    worker_compliance: au ? 'au' : 'documents',
    tax: { label: TAX_LABEL[code] || 'Tax', id_label: au ? 'ABN' : `${TAX_LABEL[code] || 'Tax'} or registration number` },
    features: { au_directories: au, au_domains: au, vevo: au, abn: au }
  };
}

/**
 * A phone number a verification code can reach, in E.164, or null. Australia keeps its own mobile rule
 * (04xx / +614). Elsewhere: a valid mobile (or a number that may be mobile, as in the US and Canada).
 */
export function normalisePhone(input, country = 'AU') {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (country === 'AU') {
    const d = raw.replace(/\D/g, '');
    if (/^04\d{8}$/.test(d)) return `+61${d.slice(1)}`;
    if (/^614\d{8}$/.test(d)) return `+${d}`;
    return null;
  }
  const p = parsePhoneNumberFromString(raw, country);
  if (!p || !p.isValid() || p.country !== country) return null;
  return ['MOBILE', 'FIXED_LINE_OR_MOBILE'].includes(p.getType()) ? p.number : null;
}

// Common throw-away mailbox domains. Not exhaustive: it stops the casual case, rate limits stop the rest.
const DISPOSABLE = new Set(['mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', 'grr.la', '10minutemail.com', '10minutemail.net',
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com', 'tempr.email', 'yopmail.com', 'yopmail.net', 'trashmail.com', 'trashmail.de', 'getnada.com',
  'nada.email', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com', 'spamgourmet.com',
  'mailnesia.com', 'mytemp.email', 'tmpmail.org', 'tmpmail.net', 'burnermail.io', 'inboxkitten.com', 'mailpoof.com', 'moakt.com', 'luxusmail.org']);
export const isDisposableEmail = (email) => DISPOSABLE.has(String(email || '').split('@').pop().trim().toLowerCase());

export function validTimeZone(tz) {
  try { return tz && new Intl.DateTimeFormat('en', { timeZone: String(tz) }).resolvedOptions().timeZone; } catch { return null; }
}
