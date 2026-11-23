// TR-51: the guided-setup question list for one business, built from its country (src/country-profile.js) and its
// industry (src/industry-registry.js). Topics: about the business, services and pricing, operations, staff, customers,
// scheduling, communications, finance, marketing, integrations and compliance.
//
// Country rules come only from countryProfile(): the tax name (GST, VAT, Sales tax…), whether Australian business
// verification and the Australian worker compliance pack apply, and Australian-only regulators. Industry rules come
// from the registry: which family of business it is and which regulators it lists.
// Text for every question is in saas/locale-catalog.js as ob.q.<text> and ob.h.<text>, with {placeholders}.
import { countryProfile } from './country-profile.js';
import { INDUSTRY_REGISTRY, industryByCode, industrySources } from './industry-registry.js';

export const TOPICS = ['about', 'services', 'operations', 'staff', 'customers', 'scheduling', 'communications', 'finance', 'marketing', 'integrations', 'compliance', 'goals'];

// Business families decide which compliance question fits.
const FAMILY = {
  field: ['construction_trades', 'cleaning_facilities', 'repair_automotive', 'utilities_waste', 'agriculture_forestry_fishing', 'transport_logistics', 'mining_resources'],
  care: ['ndis', 'aged_care', 'nursing_midwifery', 'childcare_early_learning'],
  clinic: ['healthcare', 'allied_health', 'dental', 'pharmacy', 'veterinary', 'beauty_personal'],
  retail: ['retail_ecommerce', 'wholesale_trade', 'hospitality_food', 'manufacturing'],
  office: ['professional_services', 'legal', 'accounting_tax', 'it_technology', 'admin_support', 'finance_insurance', 'real_estate', 'media_telecom', 'education_training', 'public_safety', 'arts_recreation_sport']
};
export const familyOf = (code) => Object.entries(FAMILY).find(([, list]) => list.includes(code))?.[0] || 'general';

// When the business has not chosen an industry yet, take a careful guess from its own description (keyword match
// against the registry). The guess only changes which optional questions are asked; it is never saved as the industry.
export function guessIndustry(text) {
  const t = ` ${String(text || '').toLowerCase()} `;
  // Words share a stem when their first five letters match ("plumbing" and "plumber"), so small spelling
  // differences still match. Short keywords must appear as written.
  const words = t.match(/[a-z]{4,}/g) || [];
  // Specific words count more than short general ones ("plumber" beats "water").
  const GENERIC = new Set(['repair', 'maintenance', 'service', 'services', 'water', 'gas', 'trade', 'other', 'support', 'custom', 'retail', 'online']);
  const weight = (k) => { k = String(k || '').toLowerCase(); if (!k) return 0; if (GENERIC.has(k)) return t.includes(k) ? 1 : 0; if (t.includes(k)) return k.length >= 6 || k.includes(' ') ? 3 : 1; if (k.length < 5 || k.includes(' ')) return 0; const stem = k.slice(0, 5); return words.some((w) => w.startsWith(stem)) ? 2 : 0; };
  let best = null, score = 0;
  for (const row of INDUSTRY_REGISTRY) {
    if (row.code === 'custom') continue;
    const hits = (row.keywords || []).reduce((n, k) => n + weight(k), 0);
    if (hits > score) { best = row.code; score = hits; }
  }
  return best;
}

const Q = (key, topic, opts = {}) => ({ key, topic, required: false, max: 1000, ...opts });

/**
 * @param {{ country?: string, industry?: string, state?: string, answers?: object }} input
 * @returns {{ country: object, industry: object, family: string, guessed: boolean, questions: object[] }}
 */
export function buildQuestions({ country = 'AU', industry = 'custom', state = '', answers = {} } = {}) {
  const cp = countryProfile(country);
  let code = industry && industry !== 'custom' ? industry : null, guessed = false;
  if (!code) { code = guessIndustry(answers.business?.value) || 'custom'; guessed = code !== 'custom'; }
  const row = industryByCode(code), family = familyOf(row.code), au = cp.code === 'AU';
  const vars = { tax: cp.tax.label, taxId: cp.tax.id_label, country: cp.name };
  // Australian regulators for this industry first (national, or the business's own state), then the general
  // workplace and privacy regulators. A state body is shown only when the business is in that state.
  const st = String(state || '').toUpperCase();
  const fits = (s) => !s.jurisdiction || s.jurisdiction === 'AU' || (st && s.jurisdiction === st);
  const general = industrySources('custom', st).filter((s) => !['abs-anzsic', 'ablis', 'asic', 'ato-business'].includes(s.id));
  const regulators = au ? [...new Set([...(row.sources || []).filter(fits), ...general.filter(fits)].map((s) => s.authority))].slice(0, 3) : [];

  const list = [
    Q('business', 'about', { required: true, max: 2000 }),
    Q('services', 'services', { required: true, max: 2000 }),
    Q('pricing', 'services'),
    Q('service_area', 'about', { required: true, max: 500, text: family === 'retail' ? 'service_area_retail' : 'service_area' }),
    Q('job_flow', 'operations', { max: 2000, text: family === 'retail' ? 'job_flow_retail' : family === 'clinic' || family === 'care' ? 'job_flow_care' : 'job_flow' }),
    Q('team', 'staff', { required: true, max: 500 }),
    // Country rule: Australia uses the Australian worker compliance pack (licences, checks and visa work rights);
    // elsewhere Oprun keeps worker documents and expiry dates only.
    Q('staff_checks', 'staff', { text: cp.worker_compliance === 'au' ? 'staff_checks_au' : 'staff_checks' }),
    Q('customers', 'customers'),
    Q('hours', 'scheduling', { text: family === 'retail' ? 'hours_retail' : 'hours' }),
    Q('channels', 'communications'),
    Q('payments', 'finance'),
    // Country rule: the tax name and registration number label come from the country profile.
    Q('tax', 'finance', { max: 300, text: au ? 'tax_au' : 'tax', vars }),
    Q('marketing', 'marketing'),
    Q('tools', 'integrations', { text: au ? 'tools_au' : 'tools' }),
    // Industry rule: the compliance question fits the kind of business; Australian businesses see their regulators.
    Q('compliance', 'compliance', { text: `compliance_${family}`, vars: { ...vars, regulators: regulators.join(', ') }, hint: regulators.length ? `compliance_${family}_au` : null }),
    Q('help_wanted', 'goals')
  ];
  if (au && row.code === 'ndis') list.splice(list.findIndex((q) => q.key === 'compliance') + 1, 0, Q('ndis_registration', 'compliance', { max: 500 }));
  return { country: { code: cp.code, name: cp.name, tax: cp.tax.label }, industry: { code: row.code, label: row.label }, family, guessed, regulators, questions: list };
}
