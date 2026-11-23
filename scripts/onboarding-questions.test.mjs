// TR-51: guided-setup questions per country and industry. Acceptance: country rules come from src/country-profile.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { buildQuestions, guessIndustry, familyOf, TOPICS } from '../src/onboarding-questions.js';
import { countryProfile } from '../src/country-profile.js';
import { INDUSTRY_REGISTRY } from '../src/industry-registry.js';
import { MESSAGES } from '../saas/locale-catalog.js';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const byKey = (r) => Object.fromEntries(r.questions.map((q) => [q.key, q]));

test('country rules come from the country profile', () => {
  const au = byKey(buildQuestions({ country: 'AU' })), gb = byKey(buildQuestions({ country: 'GB' })), us = byKey(buildQuestions({ country: 'US' }));
  assert.equal(au.tax.text, 'tax_au', 'Australia asks about GST');
  assert.equal(gb.tax.text, 'tax'); assert.equal(gb.tax.vars.tax, countryProfile('GB').tax.label); assert.equal(gb.tax.vars.tax, 'VAT');
  assert.equal(us.tax.vars.tax, 'Sales tax'); assert.equal(us.tax.vars.taxId, countryProfile('US').tax.id_label);
  assert.equal(au.staff_checks.text, 'staff_checks_au', 'Australian worker compliance pack: checks and visa work rights');
  assert.equal(gb.staff_checks.text, 'staff_checks', 'elsewhere: documents and expiry dates only');
  assert.equal(au.tools.text, 'tools_au'); assert.equal(gb.tools.text, 'tools');
  assert.equal(buildQuestions({ country: 'zz' }).country.code, 'AU', 'unknown country falls back as the profile does');
  // Australian regulators only for Australian businesses.
  assert.ok(buildQuestions({ country: 'AU', industry: 'dental' }).regulators.includes('Australian Health Practitioner Regulation Agency'));
  assert.deepEqual(buildQuestions({ country: 'GB', industry: 'dental' }).regulators, []);
  assert.equal(byKey(buildQuestions({ country: 'GB', industry: 'dental' })).compliance.hint, null, 'no Australian regulator hint abroad');
  // A state regulator is named only for a business in that state.
  assert.ok(!buildQuestions({ country: 'AU', industry: 'construction_trades' }).regulators.includes('Western Australian Government'));
  assert.ok(buildQuestions({ country: 'AU', industry: 'construction_trades', state: 'WA' }).regulators.includes('Western Australian Government'));
});

test('industry decides the wording and the compliance question', () => {
  const q = (industry, country = 'AU') => byKey(buildQuestions({ country, industry }));
  assert.equal(q('construction_trades').compliance.text, 'compliance_field');
  assert.equal(q('dental').compliance.text, 'compliance_clinic');
  assert.equal(q('dental').job_flow.text, 'job_flow_care');
  assert.equal(q('retail_ecommerce').service_area.text, 'service_area_retail');
  assert.equal(q('retail_ecommerce').hours.text, 'hours_retail');
  assert.equal(q('legal').compliance.text, 'compliance_office');
  assert.ok(q('ndis').ndis_registration, 'Australian NDIS providers are asked about registration');
  assert.equal(q('ndis', 'NZ').ndis_registration, undefined, 'NDIS is Australian only');
  for (const row of INDUSTRY_REGISTRY) assert.ok(['field', 'care', 'clinic', 'retail', 'office', 'general'].includes(familyOf(row.code)));
  // With no industry chosen, the first answer guides the optional questions; the guess is marked.
  assert.equal(guessIndustry('We are a plumbing and electrical contractor'), 'construction_trades');
  assert.equal(guessIndustry('hair salon and nails'), 'beauty_personal');
  assert.equal(guessIndustry(''), null);
  const g = buildQuestions({ country: 'AU', answers: { business: { value: 'Small dental practice in Subiaco' } } });
  assert.deepEqual([g.industry.code, g.guessed, byKey(g).compliance.text], ['dental', true, 'compliance_clinic']);
  const chosen = buildQuestions({ country: 'AU', industry: 'legal', answers: { business: { value: 'dental practice' } } });
  assert.deepEqual([chosen.industry.code, chosen.guessed], ['legal', false], 'a chosen industry is never overridden');
});

test('every topic is covered, required questions stay the same, and all wording exists in four languages', () => {
  for (const country of ['AU', 'GB', 'US', 'IN', 'AE']) for (const row of INDUSTRY_REGISTRY) {
    const r = buildQuestions({ country, industry: row.code, state: 'WA' });
    assert.deepEqual([...new Set(r.questions.map((x) => x.topic))].sort(), [...TOPICS].sort(), `${country} ${row.code} covers every topic`);
    assert.deepEqual(r.questions.filter((x) => x.required).map((x) => x.key), ['business', 'services', 'service_area', 'team']);
    for (const lang of ['en', 'hi', 'ur', 'ar']) for (const x of r.questions) {
      assert.ok(MESSAGES[lang]['ob.q.' + (x.text || x.key)], `${lang} ob.q.${x.text || x.key}`);
      assert.ok(MESSAGES[lang]['ob.h.' + (x.hint || x.text || x.key)], `${lang} ob.h.${x.hint || x.text || x.key}`);
      assert.ok(MESSAGES[lang]['ob.t.' + x.topic], `${lang} topic ${x.topic}`);
      for (const ph of (MESSAGES.en['ob.q.' + (x.text || x.key)] + MESSAGES.en['ob.h.' + (x.hint || x.text || x.key)]).match(/\{\w+\}/g) || [])
        assert.ok(x.vars && ph.slice(1, -1) in x.vars, `${x.key} gives a value for ${ph}`);
    }
  }
  assert.doesNotMatch(readFileSync(new URL('../src/onboarding-questions.js', import.meta.url), 'utf8'), /'GST'|'VAT'|'ABN'/, 'tax names come from the country profile, not this file');
});

test('the interview follows the business country and its first answer', async () => {
  const s = await startServer({});
  try {
    const owner = await seedOwner(s);
    const db = new Database(s.dbPath); db.prepare("UPDATE organisations SET country='GB' WHERE id=?").run(owner.org); db.close();
    let r = await s.call('GET', '/api/saas/onboarding/interview', { cookie: owner.cookie });
    assert.equal(r.json.context.country.code, 'GB');
    const tax = r.json.questions.find((q) => q.key === 'tax');
    assert.deepEqual([tax.text, tax.vars.tax], ['tax', 'VAT']);
    r = await s.call('PUT', '/api/saas/onboarding/interview/answers/business', { cookie: owner.cookie, body: { value: 'A small dental practice', revision: r.json.session.revision } });
    assert.equal(r.status, 200);
    assert.deepEqual([r.json.context.industry.code, r.json.context.industry_guessed], ['dental', true], 'the answer reply already carries the adjusted questions');
    assert.equal(r.json.questions.find((q) => q.key === 'compliance').text, 'compliance_clinic');
  } finally { await s.stop(); }
});
