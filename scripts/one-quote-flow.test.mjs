// MB-22 (D-090): Work → Quotes is the one quote flow. A quote made from an enquiry is also the formal quotation:
// it has a quote number, a valid-until date and a GST line whose amounts equal the quote's own (totals never change).
// It shows in Money → Sales documents. The finance documents API keeps accepting its existing requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

test('a Work quote is the formal quotation, with the same totals, listed in Money', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Quote Flow Plumbing Pty Ltd', email: 'flow@quoteflow.example.test' });
  const O = (m, u, b) => s.call(m, u, { cookie: owner.cookie, body: b });
  let r = await O('POST', '/api/saas/pipeline/enquiries', { title: 'Replace kitchen tap', customer: { name: 'Sam Rivera', phone: '0400 000 001' } });
  assert.equal(r.status, 201, r.text);
  r = await O('POST', `/api/saas/pipeline/enquiries/${r.json.id}/quote`, { amount: 300, gst_applies: true, title: 'Kitchen tap replacement' });
  assert.equal(r.status, 201, r.text);
  const id = r.json.id; assert.equal(r.json.amount_cents, 30000); assert.equal(r.json.gst_cents, 3000);
  const d = (await O('GET', `/api/saas/finance/documents/${id}`)).json.document;
  assert.ok(d.number, 'it has a quotation number'); assert.match(String(d.valid_until), /^\d{4}-\d{2}-\d{2}$/, 'and a valid-until date');
  assert.equal(d.lines.length, 1); assert.equal(d.lines[0].description, 'Kitchen tap replacement');
  assert.equal(d.lines[0].ex_cents, 30000); assert.equal(d.lines[0].gst_cents, 3000); assert.equal(d.lines[0].tax_code, 'GST');
  const db = new Database(s.dbPath); t.after(() => db.close());
  const row = db.prepare('SELECT amount_cents,gst_cents FROM tenant_documents WHERE id=?').get(id);
  assert.deepEqual([row.amount_cents, row.gst_cents], [30000, 3000], 'the quote total did not change');
  const list = (await O('GET', '/api/saas/finance/documents?kind=quote')).json.documents;
  assert.ok(list.some((x) => x.id === id), 'listed in Money as a formal quotation');
  assert.equal((await O('GET', `/api/saas/finance/documents/${id}/print`)).status, 200, 'the printable quotation opens');
  // A GST-free quote gets a GST-free line.
  r = await O('POST', '/api/saas/pipeline/enquiries', { title: 'Advice call', customer: { name: 'Jo Lee', phone: '0400 000 002' } });
  r = await O('POST', `/api/saas/pipeline/enquiries/${r.json.id}/quote`, { amount: 80, gst_applies: false });
  const free = (await O('GET', `/api/saas/finance/documents/${r.json.id}`)).json.document;
  assert.equal(free.lines[0].tax_code, 'FRE'); assert.equal(free.lines[0].gst_cents, 0); assert.ok(free.number);
  assert.notEqual(free.number, d.number, 'each quote has its own number');
});

test('the finance documents API still accepts existing quotation requests (no endpoint is broken)', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Api Compat Pty Ltd', email: 'compat@compat.example.test' });
  const r = await s.call('POST', '/api/saas/finance/documents', { cookie: owner.cookie, body: { kind: 'quote', title: 'Compatibility quote', lines: [{ description: 'Work', quantity: 1, unit_price: 100, tax_code: 'GST' }] } });
  assert.equal(r.status, 201, r.text); assert.ok(r.json.document.number);
});
