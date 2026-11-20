// Country rules for a business's own invoices, money, formats and customer messages (T-170).
// docs/product-redesign/06_LEGAL_SECURITY_BILLING.md. Oprun is not a tax adviser: every rule here is applied
// mechanically, names its source, and leaves the final rate and registration to the business. Australia keeps the
// detailed ATO ruleset in src/finance/rules.js; this file covers every other country.
//
// Reviewed 20 Nov 2026 from: European Commission "Your Europe" VAT rates table; PwC Worldwide Tax Summaries quick
// chart (standard VAT/GST rates); HMRC VAT Notice 700/21 s.4 (VAT invoice contents); Inland Revenue NZ "Taxable supply
// information"; national e-invoicing mandate pages linked from the European Commission eInvoicing country sheets,
// ZATCA, LHDN, IRAS, the UAE Ministry of Finance and India's GST e-invoice portal. Re-check before relying on them.
export const RULES_REVIEWED_AT = '2026-11-20';

// ISO 4217 currency by country. Countries not listed: the business chooses its currency in Money settings.
const CURRENCY = {
  AU: 'AUD', NZ: 'NZD', GB: 'GBP', IE: 'EUR', US: 'USD', CA: 'CAD', SG: 'SGD', MY: 'MYR', IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR',
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', JO: 'JOD', EG: 'EGP', IL: 'ILS', TR: 'TRY', ZA: 'ZAR', NG: 'NGN', KE: 'KES',
  GH: 'GHS', UG: 'UGX', TZ: 'TZS', ET: 'ETB', MA: 'MAD', TN: 'TND', JP: 'JPY', KR: 'KRW', CN: 'CNY', HK: 'HKD', TW: 'TWD', PH: 'PHP', TH: 'THB',
  VN: 'VND', ID: 'IDR', FJ: 'FJD', PG: 'PGK', CH: 'CHF', NO: 'NOK', IS: 'ISK', SE: 'SEK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON',
  BG: 'EUR', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', UA: 'UAH', RS: 'RSD', GE: 'GEL', KZ: 'KZT'
};
const EURO = ['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK', 'MC', 'SM', 'VA', 'AD', 'ME', 'XK'];
for (const c of EURO) CURRENCY[c] = 'EUR';

export const EU_MEMBERS = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

// Standard rate as a fraction, only where it was confirmed on the review date. null = the rate depends on the
// province/state/goods, or was not confirmed: the business enters its own rate.
const VAT_STANDARD = {
  AT: 0.2, BE: 0.21, BG: 0.2, HR: 0.25, CY: 0.19, CZ: 0.21, DK: 0.25, EE: 0.24, FI: 0.255, FR: 0.2, DE: 0.19, GR: 0.24, HU: 0.27, IE: 0.23,
  IT: 0.22, LV: 0.21, LT: 0.21, LU: 0.17, MT: 0.18, NL: 0.21, PL: 0.23, PT: 0.23, RO: 0.21, SK: 0.23, SI: 0.22, ES: 0.21, SE: 0.25,
  GB: 0.2, NO: 0.25, CH: 0.081, NZ: 0.15, SG: 0.09, AE: 0.05, SA: 0.15, OM: 0.05, BH: 0.1, ZA: 0.15, JP: 0.1, NG: 0.075, EG: 0.14, IL: 0.18
};

const TAX = (label, extra = {}) => ({ label, ...extra });
// Invoice title when the business is registered, the tax ID label, and how long records are kept (years, where confirmed).
const TAX_SYSTEM = {
  NZ: TAX('GST', { registered_title: 'Tax invoice', id_label: 'GST number', retain_years: 7, notes: ['From 1 April 2023 New Zealand uses "taxable supply information"; the words "tax invoice" are no longer required but remain accepted.', 'No taxable supply information is needed for supplies of $200 or less (GST inclusive).'] }),
  GB: TAX('VAT', { registered_title: 'VAT invoice', id_label: 'VAT registration number', retain_years: 6, buyer_name_and_address: true, notes: ['A full VAT invoice shows a unique sequential number, the time of supply, your name, address and VAT number, the customer\'s name and address, each item\'s quantity, unit price, VAT rate and amount, and the VAT total in sterling (HMRC VAT Notice 700/21).', 'A simplified VAT invoice may be used for supplies of £250 or less (VAT inclusive).'] }),
  IE: TAX('VAT', { registered_title: 'VAT invoice', id_label: 'VAT number', retain_years: 6, buyer_name_and_address: true }),
  CA: TAX('GST/HST', { registered_title: 'Invoice', id_label: 'GST/HST registration number', retain_years: 6, notes: ['The rate depends on the province: GST 5% alone or combined HST up to 15%. Enter the rate that applies to your sales.'] }),
  US: TAX('Sales tax', { registered_title: 'Invoice', id_label: 'Sales tax permit number', notes: ['There is no national sales tax. Rates and rules are set by each state and locality: enter the rate you collect.'] }),
  SG: TAX('GST', { registered_title: 'Tax invoice', id_label: 'GST registration number', retain_years: 5 }),
  MY: TAX('SST', { registered_title: 'Invoice', id_label: 'SST registration number', notes: ['Sales tax and service tax rates depend on the goods or service. Enter the rate that applies.'] }),
  IN: TAX('GST', { registered_title: 'Tax invoice', id_label: 'GSTIN', notes: ['GST rates depend on the goods or service (HSN/SAC). Enter the rate that applies to your sales.'] }),
  AE: TAX('VAT', { registered_title: 'Tax invoice', id_label: 'TRN (Tax Registration Number)', buyer_name_and_address: true }),
  SA: TAX('VAT', { registered_title: 'Tax invoice', id_label: 'VAT registration number', buyer_name_and_address: true }),
  ZA: TAX('VAT', { registered_title: 'Tax invoice', id_label: 'VAT registration number' }),
  JP: TAX('Consumption tax', { registered_title: 'Qualified invoice', id_label: 'Registration number (T + 13 digits)' }),
  PK: TAX('Sales tax', { registered_title: 'Sales tax invoice', id_label: 'NTN / STRN', notes: ['Sales tax on services is set by each province. Enter the rate that applies.'] }),
  CH: TAX('VAT', { registered_title: 'Invoice', id_label: 'UID / VAT number' }),
  NO: TAX('VAT', { registered_title: 'Invoice', id_label: 'Organisation number (MVA)' })
};
for (const c of EU_MEMBERS) if (!TAX_SYSTEM[c]) TAX_SYSTEM[c] = TAX('VAT', { registered_title: 'Invoice', id_label: 'VAT identification number', buyer_name_and_address: true, notes: ['An EU VAT invoice shows a sequential number, the issue date, your VAT number, the customer\'s name and address, the VAT rate and amount for each rate, and the totals.'] });

// Where a business in scope must issue invoices through a national e-invoicing system, an Oprun PDF/web invoice is
// not the legal invoice. status: 'live' (in force, scope may depend on size) or 'from' a date.
const EINVOICING = {
  IT: { status: 'live', system: 'SdI (FatturaPA)' }, RO: { status: 'live', system: 'RO e-Factura' }, PL: { status: 'live', system: 'KSeF' },
  BE: { status: 'live', system: 'Peppol' }, HR: { status: 'live', system: 'eRačun (Fiscalisation 2.0)' }, FR: { status: 'live', system: 'an approved platform (plateforme agréée)', note: 'Small and micro-enterprises must issue from 1 September 2027; all businesses must be able to receive now.' },
  GR: { status: 'live', system: 'myDATA through a certified provider' }, HU: { status: 'live', system: 'Online Számla real-time reporting' },
  SA: { status: 'live', system: 'ZATCA FATOORA' }, IN: { status: 'live', system: 'the GST Invoice Registration Portal (IRN)', note: 'Applies from ₹5 crore aggregate turnover.' },
  MY: { status: 'live', system: 'LHDN MyInvois', note: 'Applies by annual turnover; the smallest businesses are exempt.' }, MX: { status: 'live', system: 'SAT CFDI' },
  KE: { status: 'live', system: 'KRA eTIMS' }, CN: { status: 'live', system: 'the State Taxation Administration e-fapiao platform' },
  DE: { status: 'from', from: '2027-01-01', system: 'XRechnung / ZUGFeRD', note: 'Businesses must already be able to receive e-invoices.' },
  SK: { status: 'from', from: '2027-01-01', system: 'structured e-invoices' }, NO: { status: 'from', from: '2027-01-01', system: 'structured e-invoices (Peppol)' },
  AE: { status: 'from', from: '2027-01-01', system: 'Peppol through an Accredited Service Provider', note: 'Large businesses from 1 January 2027; others from 1 July 2027.' },
  ES: { status: 'from', from: '2027-10-06', system: 'B2B e-invoicing (and Veri*Factu certified software)' },
  SG: { status: 'from', from: '2028-04-01', system: 'InvoiceNow (Peppol)', note: 'Phased by registration type and size until 2031; some new voluntary registrants already.' },
  IE: { status: 'from', from: '2028-11-01', system: 'Peppol' }, GB: { status: 'from', from: '2029-04-01', system: 'Peppol (VAT invoices between VAT-registered businesses)' }
};

const fmtCache = new Map();
export function currencyFor(country) { return CURRENCY[String(country || '').toUpperCase()] || null; }
export function localeFor(country) { const c = String(country || 'AU').toUpperCase(); return `en-${/^[A-Z]{2}$/.test(c) ? c : 'AU'}`; }
/** Digits after the decimal point for a currency (JPY 0, AUD 2, KWD 3). */
export function minorDigits(currency) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits; } catch { return 2; }
}
/** Oprun keeps money in hundredths. Providers want the currency's smallest unit. */
export function toMinorUnits(cents, currency) {
  const d = minorDigits(currency);
  return d === 2 ? Math.round(cents) : Math.round(Number(cents) * 10 ** (d - 2));
}
export function formatMoney(cents, currency = 'AUD', locale = 'en-AU') {
  const key = `${locale}|${currency}`;
  let f = fmtCache.get(key);
  if (!f) { try { f = new Intl.NumberFormat(locale, { style: 'currency', currency }); } catch { f = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }); } fmtCache.set(key, f); }
  return f.format(Number(cents || 0) / 100);
}
export function formatDate(iso, locale = 'en-AU', timeZone = undefined) {
  try { return new Date(iso).toLocaleDateString(locale, timeZone ? { timeZone } : undefined); } catch { return new Date(iso).toLocaleDateString('en-AU'); }
}

/** Everything the money screens and invoices need for one country. Australia returns its familiar values. */
export function taxRulesFor(country = 'AU') {
  const c = String(country || 'AU').toUpperCase();
  if (c === 'AU') return { country: 'AU', label: 'GST', registered_title: 'Tax invoice', id_label: 'ABN', standard_rate: 0.1, retain_years: 5, currency: 'AUD', locale: 'en-AU', notes: [], einvoicing: null, buyer_name_and_address: false };
  const t = TAX_SYSTEM[c] || TAX('Tax', { registered_title: 'Invoice', id_label: 'Tax registration number' });
  return {
    country: c, label: t.label, registered_title: t.registered_title, id_label: t.id_label,
    standard_rate: VAT_STANDARD[c] ?? null, retain_years: t.retain_years ?? null, currency: currencyFor(c), locale: localeFor(c),
    notes: t.notes || [], buyer_name_and_address: Boolean(t.buyer_name_and_address), einvoicing: EINVOICING[c] || null
  };
}

/** A plain-English warning when an Oprun invoice is not the legal invoice in this country (now or from a date). */
export function einvoicingWarning(country, today = new Date().toISOString().slice(0, 10)) {
  const e = EINVOICING[String(country || '').toUpperCase()];
  if (!e) return null;
  const live = e.status === 'live' || (e.from && e.from <= today);
  const head = live
    ? `In this country, businesses in scope must issue invoices through ${e.system}. An invoice made in Oprun is a copy for your records and your customer, not the legal invoice. Issue the legal invoice through ${e.system} and record its number here.`
    : `From ${e.from}, businesses in scope must issue invoices through ${e.system}. Until then an Oprun invoice can be used; plan the switch with your accountant.`;
  return { live, system: e.system, from: e.from || null, text: e.note ? `${head} ${e.note}` : head };
}

/**
 * Marketing messages are sent only inside a window that meets the strictest common rules (for example US federal
 * 8am–9pm and state 9am–8pm limits, and Australian telemarketing hours): Monday to Friday 9am–8pm, Saturday
 * 9am–5pm, never Sunday, in the business's time zone. Returns null when now is inside the window, otherwise the next
 * opening time (ISO). Customer service messages a person approved (replies, reminders, invoices) are not limited.
 */
export function nextMarketingWindow(timeZone = 'Australia/Perth', now = new Date()) {
  const part = (d) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value])); return { day: p.weekday, hour: Number(p.hour), minute: Number(p.minute) }; };
  const open = ({ day, hour }) => day !== 'Sun' && hour >= 9 && hour < (day === 'Sat' ? 17 : 20);
  if (open(part(now))) return null;
  // Step forward to the next 9:00 that opens a window (at most a week).
  let t = new Date(now.getTime());
  for (let i = 0; i < 24 * 8; i++) {
    t = new Date(t.getTime() + 60 * 60 * 1000);
    const p = part(t);
    if (open(p)) return new Date(t.getTime() - p.minute * 60 * 1000).toISOString();
  }
  return null;
}
