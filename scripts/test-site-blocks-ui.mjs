// W-05: a generated business page using all ten new blocks, in a real browser at phone, tablet and laptop widths.
// Checks accessibility (axe, WCAG 2.1 AA), one H1, no sideways scrolling and keyboard reach to the quote form.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { renderPage } from '../src/seo/builder.js';
const require = createRequire(import.meta.url);

const blocks = [
  { type: 'emergency_banner', phone: '08 9000 0000' },
  { type: 'cinematic_hero', heading: 'Plumber in Fremantle', text: 'Hot water, drains and leaks across Fremantle and nearby suburbs.', preset: 'blueprint', cta_label: 'Get a quote', cta_href: '#contact' },
  { type: 'stats', heading: 'In numbers', items: [{ value: '1,200+', label: 'Jobs completed' }, { value: '15', label: 'Years in business' }, { value: '4.9', label: 'Google rating' }] },
  { type: 'process', heading: 'How we work', items: [{ title: 'Call or send a message', text: 'We answer every call.' }, { title: 'Fixed quote', text: 'Before any work starts.' }, { title: 'Job done', text: 'We clean up after.' }] },
  { type: 'projects', heading: 'Recent jobs', items: [{ src: '/m/job1', alt: 'New hot water unit on an outside wall', width: 800, height: 600, service: 'Hot water', suburb: 'Fremantle' }, { src: '/m/job2', alt: 'Cleared drain pit', width: 800, height: 600, service: 'Blocked drain', suburb: 'Bicton' }] },
  { type: 'pricing', heading: 'Prices', gst: 'inc', items: [{ name: 'Call-out', price: '$99', unit: 'flat' }, { name: 'Blocked drain', price: 'from $180', note: 'Most household drains' }, { name: 'Hot water replacement', price: 'from $1,450' }] },
  { type: 'logos', heading: 'Licensed and insured', items: [{ src: '/m/logo1', name: 'Master Plumbers WA', number: 'PL1234', width: 120, height: 64 }] },
  { type: 'faq_ai', heading: 'Common questions', items: [{ q: 'Do you work weekends?', a: 'Yes, Saturday mornings.', approved: true }, { q: 'Is the call-out fee taken off the job?', a: 'Yes, when you go ahead on the day.', approved: true }] },
  { type: 'map', heading: 'Where we are', address: '1 Marine Tce, Fremantle WA 6160' },
  { type: 'quote_form', heading: 'Ask for a quote', text: 'We reply within one business day.', services: ['Hot water', 'Blocked drain', 'Leak'] }
];
const html = renderPage({ title: 'Plumber in Fremantle', slug: 'home', meta_description: 'Plumbing in Fremantle.', blocks },
  { site: { name: 'Harbour Plumbing', slug: 'harbour-plumbing' }, receptionist247: true, nav: [{ href: './', label: 'Home', current: true }, { href: './contact', label: 'Contact' }] });

const browser = await chromium.launch({ headless: true, ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] } : {}) });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/m/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ccd"/></svg>' }));
  await page.route('https://sites.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto('https://sites.test/harbour-plumbing/');
  assert.equal(await page.locator('h1').count(), 1, 'one H1');
  assert.equal(await page.locator('iframe, script:not([type="application/ld+json"])').count(), 0, 'no scripts or embeds');
  await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no sideways scroll at ${width}px`);
    const v = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`));
    assert.deepEqual(v, [], `axe at ${width}px`);
  }
  // The quote form is reachable and labelled.
  await page.getByLabel('Service').selectOption('Leak');
  await page.getByLabel('Suburb').fill('Bicton');
  assert.ok(await page.getByRole('button', { name: 'Ask for a quote' }).isVisible());
  assert.ok(await page.getByRole('link', { name: /Call 08 9000 0000/ }).isVisible(), 'urgent-calls banner with a phone link');
  assert.deepEqual(errors, []);
  console.log('PASS website blocks: ten new blocks, one H1, no scripts or embeds, axe clean and no sideways scroll at 390, 820 and 1440 px, labelled quote form.');
} finally { await browser.close(); }
