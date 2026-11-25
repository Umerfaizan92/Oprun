// W-05 (docs/ai-website/00_CONTRACT.md §6): the ten new website blocks. Each renders only what the owner entered,
// escapes every value, keeps one H1, and never shows what the contract forbids (customer names, unanswered questions,
// an urgent-calls banner without a 24/7 receptionist, a tracking map embed).
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { renderPage, prePublishChecks, BLOCK_TYPES } from '../src/seo/builder.js';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const X = '<script>alert(1)</script>';
const site = { name: 'Harbour Plumbing', slug: 'harbour-plumbing' };
const page = (blocks, extra = {}) => ({ title: 'Plumber in Fremantle', slug: 'home', meta_description: 'Plumbing in Fremantle.', blocks, ...extra });
const h1s = (html) => (html.match(/<h1[\s>]/g) || []).length;

test('every new block is a known block type', () => {
  for (const t of ['cinematic_hero', 'stats', 'process', 'projects', 'pricing', 'quote_form', 'emergency_banner', 'map', 'logos', 'faq_ai']) assert.ok(BLOCK_TYPES.includes(t), t);
});

test('each block renders the owner\'s content, escaped, with one H1 on the page', () => {
  const blocks = [
    { type: 'cinematic_hero', heading: `Plumber ${X}`, text: 'Fremantle and nearby', preset: 'skyline', poster: '/m/abc', poster_alt: 'Van outside a house', cta_label: 'Get a quote', cta_href: '#contact' },
    { type: 'stats', heading: 'In numbers', items: [{ value: '1,200+', label: `Jobs ${X}` }, { value: 'lots', label: 'Invented' }] },
    { type: 'process', heading: 'How we work', items: [{ title: 'Call us', text: 'We answer.' }, { title: 'We quote' }] },
    { type: 'projects', heading: 'Recent jobs', items: [{ src: '/m/job1', alt: 'New hot water unit', service: 'Hot water', suburb: 'Fremantle', customer: 'Priya Shah' }] },
    { type: 'pricing', heading: 'Prices', gst: 'inc', items: [{ name: 'Call-out', price: '$99', unit: 'flat' }, { name: 'Blocked drain', price: 'from $180', note: 'Most jobs' }] },
    { type: 'quote_form', heading: 'Get a quote', services: ['Hot water', 'Blocked drain', X] },
    { type: 'emergency_banner', phone: '08 9000 0000' },
    { type: 'map', heading: 'Where we are', address: '1 Marine Tce, Fremantle WA' },
    { type: 'logos', heading: 'Licensed', items: [{ src: '/m/logo', name: 'Master Plumbers', number: 'PL1234' }] },
    { type: 'faq_ai', items: [{ q: 'Do you work weekends?', a: 'Yes, Saturdays.', approved: true }, { q: 'Unanswered?', a: '', approved: true }, { q: 'Not approved?', a: 'Draft', approved: false }] }
  ];
  const html = renderPage(page(blocks), { site });
  assert.equal(h1s(html), 1, 'one H1');
  assert.ok(!html.includes('<script>alert'), 'values are escaped');
  assert.match(html, /<h1>Plumber &lt;script&gt;/);
  assert.match(html, /data-cinematic="skyline"/); assert.match(html, /alt="Van outside a house"/); assert.match(html, /fetchpriority="high"/);
  assert.match(html, /<dd>1,200\+<\/dd>/); assert.ok(!html.includes('Invented'), 'a stat without a real number is not shown');
  assert.match(html, /<ol><li><strong>Call us<\/strong>/);
  assert.match(html, /Hot water · Fremantle/); assert.ok(!html.includes('Priya'), 'customer names are never shown');
  assert.match(html, /<th scope="row">Call-out<\/th><td>\$99/); assert.match(html, /Prices include GST\./);
  assert.match(html, /action="\/api\/public\/contact\/harbour-plumbing"/); assert.match(html, /<select name="service" required>/); assert.match(html, /name="suburb"/); assert.match(html, /Ask for a quote<\/button>/);
  assert.ok(!html.includes('Urgent help'), 'no 24/7 banner unless the receptionist answers 24/7');
  assert.match(html, /google\.com\/maps\/search\/\?api=1&amp;query=1%20Marine%20Tce/); assert.ok(!/<iframe/i.test(html), 'no map embed');
  assert.match(html, /alt="Master Plumbers"/); assert.match(html, /PL1234/);
  assert.match(html, /Do you work weekends\?/); assert.ok(!html.includes('Unanswered?') && !html.includes('Not approved?'), 'only answered, approved questions');
  const with247 = renderPage(page([{ type: 'hero', heading: 'Hi' }, { type: 'emergency_banner', phone: '08 9000 0000' }]), { site, receptionist247: true });
  assert.match(with247, /<aside class="emergency" aria-label="Urgent help">.*href="tel:0890000000"/);
});

test('a page that starts with a non-hero block still has exactly one H1', () => {
  const html = renderPage(page([{ type: 'stats', heading: 'Numbers', items: [{ value: '20', label: 'Years' }] }, { type: 'faq_ai', items: [{ q: 'Q?', a: 'A.', approved: true }] }, { type: 'quote_form' }]), { site });
  assert.equal(h1s(html), 1);
});

test('empty blocks render nothing, and pre-publish checks say what is missing', () => {
  const blocks = [{ type: 'hero', heading: 'Plumber', text: 'Fremantle' }, { type: 'stats', items: [{ value: 'many', label: 'Jobs' }] }, { type: 'pricing', items: [{ name: 'Call-out', price: '$99' }] }, { type: 'projects', items: [{ src: '/m/1', service: 'Drains', customer: 'Sam' }] }, { type: 'map' }, { type: 'emergency_banner', phone: '1' }, { type: 'faq_ai', items: [] }, { type: 'process', items: [] }, { type: 'logos', items: [{ src: 'javascript:alert(1)', name: 'Bad' }] }];
  const html = renderPage(page(blocks), { site });
  assert.ok(!html.includes('class="stats"') && !html.includes('class="map"') && !html.includes('class="process"') && !html.includes('class="logos"'));
  const texts = prePublishChecks(page(blocks), { site }).checks.map((c) => `${c.level}:${c.text}`).join('\n');
  assert.match(texts, /block:Say whether your prices include GST/);
  assert.match(texts, /block:Every number in the stats section needs a real figure/);
  assert.match(texts, /block:Add the address for the map/);
  assert.match(texts, /block:An image has no alt text/);
  assert.match(texts, /warn:Customer names on project photos are never shown/);
  assert.match(texts, /warn:The urgent-calls banner shows only while the AI receptionist answers 24\/7/);
});

test('the quote form sends service and suburb into the enquiry', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Quote Co', email: 'quote@quote.example.test' });
  const r = await fetch(`${s.base}/api/public/contact/${owner.slug}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'Priya', phone: '0400 111 222', service: 'Hot water\nINJECT', suburb: 'Fremantle', message: 'No hot water since this morning.', return_to: '/sites/x/contact' }), redirect: 'manual' });
  assert.equal(r.status, 303, await r.text());
  const d = new Database(s.dbPath); t.after(() => d.close());
  const row = JSON.stringify(d.prepare("SELECT * FROM tenant_documents WHERE organisation_id=? AND kind='enquiry'").all(owner.org));
  assert.match(row, /Service: Hot water INJECT\\nSuburb: Fremantle\\n\\nNo hot water/, 'service and suburb are on the enquiry, on one line each');
});
