// Phase 08: Australian tax and record-keeping rules as versioned configuration, plus the pure calculations that use them.
// Every rule names the authoritative source it was taken from and the date it was last reviewed by a person. Oprun
// applies these rules mechanically; it does not give tax or legal advice, and nothing an AI writes overrides them.
// To change a rule, add a new ruleset with a later effective date. Never edit a published one: issued documents record
// the ruleset id they were checked against.

import { taxRulesFor, RULES_REVIEWED_AT, einvoicingWarning } from '../country-rules.js';

export const RULESETS = Object.freeze([
  Object.freeze({
    id: 'AU-2026.10',
    country: 'AU',
    effective_from: '2000-07-01',
    reviewed_at: '2026-10-30',
    reviewed_by: 'Oprun engineering (not a tax agent). Owner review required before relying on it.',
    gst: { rate: 0.1, registration_turnover_cents: 7500000, registration_turnover_non_profit_cents: 15000000 },
    tax_invoice: {
      no_invoice_needed_up_to_cents: 8250, // GST-inclusive; a tax invoice need not be provided on request at or below this
      buyer_identity_from_cents: 100000, // GST-inclusive; at or above this the buyer's identity or ABN must be shown
      provide_within_days: 28,
      fields: ['Words showing it is intended to be a tax invoice', "Seller's identity", "Seller's ABN", 'Date of issue', 'Brief description of each item, with quantity and price', 'GST amount (or "Total price includes GST" when GST is exactly one-eleventh)', 'Extent to which each item is taxable']
    },
    adjustment_note: { not_required_up_to_gst_cents: 7500, fields: ['Words showing it is an adjustment note', "Seller's identity and ABN", 'Date of issue', 'Brief explanation of the reason for the adjustment', 'Amount of the adjustment and its GST effect', 'Reference to the original tax invoice', "Buyer's identity or ABN when the original sale was $1,000 or more"] },
    records: { retain_years: 5 },
    abn: { length: 11, weights: [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19], modulus: 89 },
    privacy: { small_business_turnover_cents: 300000000 },
    sources: [
      { topic: 'Tax invoices', url: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices' },
      { topic: 'Adjustment notes', url: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/completing-your-bas-for-gst/making-adjustments-on-your-activity-statements/adjustment-notes' },
      { topic: 'Adjustment notes (ruling)', url: 'https://www.ato.gov.au/law/view/document?docid=GST/GSTR20132/NAT/ATO/00001' },
      { topic: 'Registering for GST', url: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/registering-for-gst' },
      { topic: 'Record keeping (5 years)', url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/record-keeping-for-business/overview-of-record-keeping-rules-for-business/records-to-keep-longer-than-five-years' },
      { topic: 'ABN format check', url: 'https://abr.business.gov.au/Help/AbnFormat' },
      { topic: 'Privacy Act and small business', url: 'https://www.oaic.gov.au/privacy/privacy-for-organisations/small-business' },
      { topic: 'Stored-value facilities (why no wallet)', url: 'https://www.cfr.gov.au/publications/policy-statements-and-other-reports/2020/regulation-of-stored-value-facilities-in-australia/pdf/report.pdf' }
    ]
  })
]);

// Every country except Australia (T-170): a ruleset built from src/country-rules.js. The business's own registration
// status, tax number and rate (Money settings) decide what the invoice shows; Oprun only checks it mechanically.
function countryRuleset(country, s = {}) {
  const t = taxRulesFor(country);
  const rate = s.tax_rate !== null && s.tax_rate !== undefined && s.tax_rate !== '' ? Number(s.tax_rate) : t.standard_rate;
  return {
    id: `${t.country}-${RULES_REVIEWED_AT}`, country: t.country, effective_from: '2000-01-01', reviewed_at: RULES_REVIEWED_AT,
    reviewed_by: 'Oprun engineering (not a tax adviser). Owner review required before relying on it.',
    gst: { rate: Number.isFinite(rate) ? rate : null, registration_turnover_cents: null },
    tax: t, tax_invoice: { no_invoice_needed_up_to_cents: 0, buyer_identity_from_cents: t.buyer_name_and_address ? 0 : Infinity, provide_within_days: null, fields: t.notes },
    adjustment_note: { not_required_up_to_gst_cents: 0, fields: [] }, records: { retain_years: t.retain_years },
    sources: [{ topic: 'Country rules reviewed ' + RULES_REVIEWED_AT, url: 'https://europa.eu/youreurope/business/finance-and-tax/vat/vat-rules-rates/index_en.htm' }]
  };
}

export function rulesFor(date = new Date().toISOString(), country = 'AU', settings = null) {
  if (country && String(country).toUpperCase() !== 'AU') return countryRuleset(String(country).toUpperCase(), settings || {});
  const d = String(date).slice(0, 10);
  const r = [...RULESETS].filter((x) => x.effective_from <= d).sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
  if (!r) throw new Error('No tax ruleset covers ' + d);
  return r;
}
export const rulesetById = (id) => RULESETS.find((r) => r.id === id) || (/^[A-Z]{2}-\d{4}-\d{2}-\d{2}$/.test(String(id)) ? countryRuleset(String(id).slice(0, 2)) : null);

// Tax codes on a line. GST: 10% GST. FRE: GST-free sale. INP: input-taxed. NT: not reportable (outside GST).
export const TAX_CODES = Object.freeze({ GST: 'Taxable (GST)', FRE: 'GST-free', INP: 'Input-taxed', NT: 'Not reportable' });

// ABN check digit test from the Australian Business Register: subtract 1 from the first digit, weight, sum, mod 89.
export function abnValid(abn) {
  const d = String(abn || '').replace(/\s/g, '');
  const { length, weights, modulus } = RULESETS[0].abn;
  if (!new RegExp(`^\\d{${length}}$`).test(d)) return false;
  const n = d.split('').map(Number); n[0] -= 1;
  return n.reduce((s, v, i) => s + v * weights[i], 0) % modulus === 0;
}
export const formatAbn = (abn) => { const d = String(abn || '').replace(/\s/g, ''); return d.length === 11 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : d; };

// One line: amounts in cents. When prices include GST, GST is one-eleventh of the line total; otherwise rate × ex amount.
// Rounding is per line to the nearest cent; the document totals are sums of the rounded lines.
export function lineAmounts({ quantity = 1, unit_cents = 0, tax_code = 'GST', discount_cents = 0 }, { includesGst = false, registered = true, rules = rulesFor() } = {}) {
  const gross = Math.round(Number(quantity) * Number(unit_cents)) - Math.round(Number(discount_cents) || 0);
  const taxable = registered && tax_code === 'GST';
  if (!taxable) return { ex_cents: gross, gst_cents: 0, inc_cents: gross };
  const rate = Number(rules.gst.rate) || 0;
  if (!rate) return { ex_cents: gross, gst_cents: 0, inc_cents: gross };
  if (includesGst) { const gst = rate === 0.1 ? Math.round(gross / 11) : Math.round((gross * rate) / (1 + rate)); return { ex_cents: gross - gst, gst_cents: gst, inc_cents: gross }; }
  const gst = Math.round(gross * rate);
  return { ex_cents: gross, gst_cents: gst, inc_cents: gross + gst };
}
export function documentTotals(lines, opts = {}) {
  const out = { ex_cents: 0, gst_cents: 0, inc_cents: 0, taxable_inc_cents: 0, by_code: {} };
  for (const l of lines) {
    const a = lineAmounts(l, opts);
    out.ex_cents += a.ex_cents; out.gst_cents += a.gst_cents; out.inc_cents += a.inc_cents;
    if (a.gst_cents) out.taxable_inc_cents += a.inc_cents;
    const c = (out.by_code[l.tax_code || 'GST'] ||= { ex_cents: 0, gst_cents: 0 }); c.ex_cents += a.ex_cents; c.gst_cents += a.gst_cents;
  }
  // "Total price includes GST" may replace a separate GST figure only when GST is exactly one-eleventh of the total.
  out.gst_is_one_eleventh = out.inc_cents > 0 && out.gst_cents * 11 === out.inc_cents;
  return out;
}

// Checks a document against the ruleset before it is issued. Returns blocking issues and advisory notes.
// kind: 'invoice' | 'credit_note' | 'quote' | 'estimate' | 'receipt'
export function checkDocument({ kind, seller = {}, buyer = {}, lines = [], issued_at = new Date().toISOString(), original = null, reason = '' }, rules = rulesFor(issued_at)) {
  const issues = [], notes = [], registered = Boolean(seller.gst_registered);
  const totals = documentTotals(lines, { includesGst: Boolean(seller.prices_include_gst), registered, rules });
  if (!seller.name) issues.push('Add your business name in Setup & Trust > Settings.');
  if (!lines.length) issues.push('Add at least one item.');
  for (const [i, l] of lines.entries()) {
    if (!String(l.description || '').trim()) issues.push(`Item ${i + 1} needs a description.`);
    if (!(Number(l.quantity) > 0)) issues.push(`Item ${i + 1} needs a quantity above zero.`);
    if (!TAX_CODES[l.tax_code || 'GST']) issues.push(`Item ${i + 1} has an unknown tax code.`);
  }
  const au = (rules.country || 'AU') === 'AU', tax = rules.tax;
  if (!au && ['invoice', 'credit_note', 'receipt'].includes(kind)) {
    if (registered) {
      if (!seller.tax_number) issues.push(`A ${title(kind, true, rules).toLowerCase()} must show your ${tax.id_label}. Add it in Money > Finance settings.`);
      if (!(Number(rules.gst.rate) > 0)) issues.push(`Enter the ${tax.label} rate you charge in Money > Finance settings.`);
      if (tax.buyer_name_and_address && kind === 'invoice' && !buyer.name) issues.push(`A ${tax.label} invoice in this country must show the customer's name and address. Add a customer.`);
      else if (tax.buyer_name_and_address && kind === 'invoice' && !buyer.address) notes.push("Add the customer's address: it is required on a full invoice in this country.");
    } else notes.push(`You are not registered for ${tax.label}, so this invoice shows no ${tax.label}. Check your local registration threshold.`);
    for (const n of tax.notes || []) notes.push(n);
    const e = einvoicingWarning(rules.country, String(issued_at).slice(0, 10));
    if (e) notes.push(e.text);
  }
  if (au && ['invoice', 'credit_note', 'receipt'].includes(kind)) {
    if (registered) {
      if (!seller.abn) issues.push('A tax invoice must show your ABN. Add it in Setup & Trust > Settings.');
      else if (!abnValid(seller.abn)) issues.push('Your ABN fails the Australian Business Register check digit test. Check the number.');
      if (totals.inc_cents >= rules.tax_invoice.buyer_identity_from_cents && !(buyer.name || buyer.abn) && kind === 'invoice') issues.push(`Sales of $${(rules.tax_invoice.buyer_identity_from_cents / 100).toLocaleString('en-AU')} or more must show the buyer's identity or ABN. Link the customer.`);
      if (buyer.abn && !abnValid(buyer.abn)) issues.push("The customer's ABN fails the check digit test.");
      if (lines.some((l) => (l.tax_code || 'GST') !== 'GST') && lines.some((l) => (l.tax_code || 'GST') === 'GST')) notes.push('This document mixes taxable and non-taxable items; each item shows whether it is taxable.');
    } else {
      notes.push('You are not registered for GST, so this is an invoice, not a tax invoice, and shows no GST. If your GST turnover reaches the registration threshold you must register.');
      if (lines.some((l) => (l.tax_code || 'GST') === 'GST' && Number(l.unit_cents) > 0)) notes.push('No GST is charged because the business is not registered for GST.');
    }
  }
  if (kind === 'credit_note' && !au) {
    if (!original) issues.push('A credit note must refer to the original invoice.');
    if (String(reason || '').trim().length < 5) issues.push('Explain briefly why the credit is being made.');
  }
  if (kind === 'credit_note' && au) {
    if (!original) issues.push('An adjustment note must refer to the original invoice.');
    if (String(reason || '').trim().length < 5) issues.push('Explain briefly why the adjustment is being made.');
    if (original && original.inc_cents >= rules.tax_invoice.buyer_identity_from_cents && !(buyer.name || buyer.abn)) issues.push("The original sale was $1,000 or more, so the adjustment note must show the buyer's identity or ABN.");
    if (registered && totals.gst_cents <= rules.adjustment_note.not_required_up_to_gst_cents) notes.push(`A GST adjustment of $${(rules.adjustment_note.not_required_up_to_gst_cents / 100).toFixed(2)} or less does not need an adjustment note, but issuing one keeps the record clear.`);
  }
  if (au && kind === 'invoice' && registered && totals.inc_cents <= rules.tax_invoice.no_invoice_needed_up_to_cents) notes.push(`At $${(rules.tax_invoice.no_invoice_needed_up_to_cents / 100).toFixed(2)} or less you do not have to give a tax invoice on request, but you may.`);
  return { ok: !issues.length, issues, notes, totals, ruleset: rules.id, title: title(kind, registered, rules) };
}
export function title(kind, registered, rules = null) {
  if (rules && rules.country && rules.country !== 'AU') {
    const t = registered ? rules.tax.registered_title : 'Invoice';
    return { invoice: t, credit_note: 'Credit note', quote: 'Quotation', estimate: 'Estimate', receipt: 'Receipt', deposit: `${t} (deposit)` }[kind] || kind;
  }
  return { invoice: registered ? 'Tax invoice' : 'Invoice', credit_note: registered ? 'Adjustment note (credit note)' : 'Credit note', quote: 'Quotation', estimate: 'Estimate', receipt: 'Receipt', deposit: registered ? 'Tax invoice (deposit)' : 'Invoice (deposit)' }[kind] || kind;
}

// Business Activity Statement draft figures. G1 total sales (GST-inclusive), 1A GST on sales, 1B GST on purchases.
// Cash basis counts payments received/made in the period; accrual counts invoices issued. Always a draft for checking.
export function basDraft({ sales = [], purchases = [], adjustments = [] }) {
  const sum = (a, k) => a.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const g1 = sum(sales, 'inc_cents') - sum(adjustments, 'inc_cents');
  const gstFree = sales.filter((s) => !s.gst_cents).reduce((s, x) => s + x.inc_cents, 0);
  return { G1_total_sales_cents: g1, G3_gst_free_sales_cents: gstFree, '1A_gst_on_sales_cents': sum(sales, 'gst_cents') - sum(adjustments, 'gst_cents'), '1B_gst_on_purchases_cents': sum(purchases, 'gst_cents'), net_gst_cents: sum(sales, 'gst_cents') - sum(adjustments, 'gst_cents') - sum(purchases, 'gst_cents'), note: 'Draft figures from your Oprun records. Check them and lodge through the ATO or your registered tax or BAS agent. Oprun does not give tax advice.' };
}
