// T-170: invoices, money, formats and marketing follow the business's country.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { taxRulesFor, einvoicingWarning, formatMoney, toMinorUnits, nextMarketingWindow, currencyFor } from '../src/country-rules.js';
import { rulesFor, checkDocument, lineAmounts, title } from '../src/finance/rules.js';
import { normPhone } from '../src/comms/service.js';

test('country tax rules: labels, rates, titles, currencies and e-invoicing mandates', () => {
  assert.equal(taxRulesFor('AU').label, 'GST');
  const gb = taxRulesFor('GB'); assert.deepEqual([gb.label, gb.standard_rate, gb.registered_title, gb.currency], ['VAT', 0.2, 'VAT invoice', 'GBP']);
  assert.equal(taxRulesFor('US').standard_rate, null, 'US sales tax is set by the business');
  assert.equal(taxRulesFor('CA').standard_rate, null, 'Canada depends on the province');
  assert.equal(taxRulesFor('FI').standard_rate, 0.255); assert.equal(taxRulesFor('EE').standard_rate, 0.24); assert.equal(taxRulesFor('RO').standard_rate, 0.21);
  assert.equal(taxRulesFor('NZ').standard_rate, 0.15); assert.equal(taxRulesFor('AE').registered_title, 'Tax invoice');
  assert.equal(currencyFor('DE'), 'EUR'); assert.equal(currencyFor('PK'), 'PKR'); assert.equal(currencyFor('ZZ'), null);
  assert.equal(einvoicingWarning('IT').live, true);
  assert.equal(einvoicingWarning('DE', '2026-11-20').live, false); assert.equal(einvoicingWarning('DE', '2027-02-01').live, true);
  assert.equal(einvoicingWarning('GB', '2026-11-20').live, false); assert.equal(einvoicingWarning('AU'), null);
  assert.equal(formatMoney(123456, 'GBP', 'en-GB'), '£1,234.56');
  assert.equal(toMinorUnits(150000, 'JPY'), 1500, 'zero-decimal currency'); assert.equal(toMinorUnits(1234, 'KWD'), 12340, 'three-decimal currency'); assert.equal(toMinorUnits(1234, 'GBP'), 1234);
});

test('invoice checks per country; Australia unchanged', () => {
  const lines = [{ description: 'Window cleaning', quantity: 2, unit_cents: 5000, tax_code: 'GST' }];
  const gb = rulesFor('2026-11-20', 'GB', {});
  assert.equal(gb.gst.rate, 0.2); assert.match(gb.id, /^GB-/);
  let c = checkDocument({ kind: 'invoice', seller: { name: 'Thames', gst_registered: true }, buyer: { name: 'Riley', address: '1 Road' }, lines }, gb);
  assert.ok(c.issues.some((x) => /VAT registration number/.test(x)), 'a VAT invoice needs the VAT number');
  c = checkDocument({ kind: 'invoice', seller: { name: 'Thames', gst_registered: true, tax_number: 'GB123456789' }, buyer: { name: 'Riley', address: '1 Road' }, lines }, gb);
  assert.equal(c.ok, true, c.issues.join(';')); assert.equal(c.title, 'VAT invoice'); assert.equal(c.totals.gst_cents, 2000); assert.equal(c.totals.inc_cents, 12000);
  assert.ok(c.notes.some((n) => /2029/.test(n)), 'future UK e-invoicing is mentioned');
  c = checkDocument({ kind: 'invoice', seller: { name: 'Thames', gst_registered: true, tax_number: 'GB1' }, buyer: {}, lines }, gb);
  assert.ok(c.issues.some((x) => /customer's name and address/.test(x)));
  // Prices including 20% VAT: VAT is one-sixth.
  assert.deepEqual(lineAmounts({ quantity: 1, unit_cents: 12000 }, { includesGst: true, registered: true, rules: gb }), { ex_cents: 10000, gst_cents: 2000, inc_cents: 12000 });
  // US: the business sets its rate; without one, a registered seller is asked for it.
  const us = rulesFor('2026-11-20', 'US', {});
  c = checkDocument({ kind: 'invoice', seller: { name: 'Austin Plumbing', gst_registered: true, tax_number: 'TX-1' }, buyer: { name: 'Sam' }, lines }, us);
  assert.ok(c.issues.some((x) => /Sales tax rate/.test(x))); assert.equal(c.title, 'Invoice');
  c = checkDocument({ kind: 'invoice', seller: { name: 'Austin Plumbing', gst_registered: true, tax_number: 'TX-1' }, buyer: { name: 'Sam' }, lines }, rulesFor('2026-11-20', 'US', { tax_rate: 0.0825 }));
  assert.equal(c.ok, true); assert.equal(c.totals.gst_cents, 825);
  // Italy: an Oprun invoice is not the legal e-invoice; the business is told, not blocked.
  c = checkDocument({ kind: 'invoice', seller: { name: 'Roma Srl', gst_registered: true, tax_number: 'IT123' }, buyer: { name: 'Luca', address: 'Via 1' }, lines }, rulesFor('2026-11-20', 'IT', {}));
  assert.equal(c.ok, true); assert.ok(c.notes.some((n) => /SdI/.test(n)));
  // Australia: same ruleset, same title, same GST.
  const au = rulesFor('2026-11-20'); assert.equal(au.id, 'AU-2026.10');
  assert.equal(title('invoice', true, au), 'Tax invoice'); assert.equal(title('invoice', true), 'Tax invoice');
  assert.deepEqual(lineAmounts({ quantity: 1, unit_cents: 11000 }, { includesGst: true, registered: true, rules: au }), { ex_cents: 10000, gst_cents: 1000, inc_cents: 11000 });
});

test('marketing send window and local phone numbers', () => {
  const tz = 'Europe/London';
  assert.equal(nextMarketingWindow(tz, new Date('2026-11-18T10:30:00Z')), null, 'Wednesday 10:30 is inside the window');
  assert.equal(nextMarketingWindow(tz, new Date('2026-11-20T21:15:00Z')), '2026-11-21T09:00:00.000Z', 'Friday night waits for Saturday 9am');
  assert.equal(nextMarketingWindow(tz, new Date('2026-11-21T17:30:00Z')), '2026-11-23T09:00:00.000Z', 'Saturday evening and Sunday wait for Monday 9am');
  assert.equal(nextMarketingWindow('Australia/Perth', new Date('2026-11-22T03:00:00Z')), '2026-11-23T01:00:00.000Z', 'Sunday in Perth waits for Monday 9am Perth');
  assert.equal(normPhone('0412 345 678'), '+61412345678'); assert.equal(normPhone('07400 123456', 'GB'), '+447400123456'); assert.equal(normPhone('+447400123456', 'GB'), '+447400123456');
});

test('a UK business: VAT invoice in pounds with its VAT number, VAT summary, compliance review', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Thames Window Cleaning Ltd' });
  const O = (m, u, b) => s.call(m, u, { cookie: owner.cookie, body: b });
  const sql = (q, ...a) => { const d = new Database(s.dbPath); try { return /^\s*select/i.test(q) ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } };
  sql("UPDATE organisations SET country='GB', verification_level='contact_verified', abn=NULL, business_identifier=NULL, address_formatted='12 River Road, London SE1 9AA', timezone='Europe/London' WHERE id=?", owner.org);
  const cust = crypto.randomUUID(), now = new Date().toISOString(), jobId = crypto.randomUUID();
  sql("INSERT INTO tenant_customers(id,organisation_id,name,email,phone,address,status,source,created_at,updated_at) VALUES (?,?,?,?,?,?,'current','manual',?,?)", cust, owner.org, 'Riley Quinn', 'riley@example.test', '07400 123456', '3 Bank St, London', now, now);
  sql("INSERT INTO work_orders(id,organisation_id,title,start_at,required_skills,status,created_at,updated_at,customer_id,price_cents,gst_applies,completed_at) VALUES (?,?,?,?,'[]','completed',?,?,?,0,1,?)", jobId, owner.org, 'Window cleaning', now, now, now, cust, now);

  let st = await O('GET', '/api/saas/finance/settings');
  assert.equal(st.json.locale.currency, 'GBP'); assert.equal(st.json.rules.tax.label, 'VAT'); assert.equal(st.json.seller.tax_id_label, 'VAT registration number');
  let r = await O('PUT', '/api/saas/finance/settings', { gst_registered: true, prices_include_gst: false, accounting_basis: 'accrual', bas_period: 'quarterly', quote_valid_days: 30, deposit_percent: 0, tax_number: 'GB123456789', tax_rate_percent: 20 });
  assert.equal(r.status, 200, r.text);
  r = await O('POST', '/api/saas/finance/documents', { kind: 'invoice', title: 'Window cleaning', work_order_id: jobId, lines: [{ description: 'Window cleaning', quantity: 2, unit_price: 50, tax_code: 'GST' }] });
  assert.equal(r.status, 201, r.text); let inv = r.json.document;
  assert.equal(inv.gst_cents, 2000); assert.equal(inv.total_cents, 12000);
  await O('POST', `/api/saas/finance/documents/${inv.id}/approve`, { revision: inv.revision });
  r = await O('POST', `/api/saas/finance/documents/${inv.id}/issue`); assert.equal(r.status, 200, r.text);
  inv = r.json.document; assert.equal(inv.heading, 'VAT invoice'); assert.match(inv.ruleset, /^GB-/);
  const html = await (await fetch(`${s.base}/api/saas/finance/documents/${inv.id}/print`, { headers: { cookie: owner.cookie } })).text();
  assert.match(html, /<h1>VAT invoice<\/h1>/); assert.match(html, /VAT registration number GB123456789/); assert.match(html, /£120\.00/); assert.match(html, /Amounts in GBP/);
  assert.doesNotMatch(html, /ABN|GST|A\$/, 'no Australian wording');
  const rep = (await O('GET', '/api/saas/finance/reports/gst?from=2026-01-01&to=2027-12-31')).json.report;
  assert.equal(rep.tax_label, 'VAT'); assert.equal(rep.tax_on_sales_cents, 2000); assert.equal(rep.total_sales_cents, 12000);
  const cr = (await O('GET', '/api/saas/finance/compliance')).json;
  assert.ok(!cr.items.some((i) => i.area === 'ABN'), 'no ABN check outside Australia');
  assert.ok(cr.items.some((i) => i.area === 'Records' && /6 years/.test(i.text)));
});
