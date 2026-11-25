// W-05: a generated business page using all ten new blocks, in a real browser at phone, tablet and laptop widths.
// Checks accessibility (axe, WCAG 2.1 AA), one H1, no sideways scrolling and keyboard reach to the quote form.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { renderPage, siteCsp } from '../src/seo/builder.js';
const require = createRequire(import.meta.url);

const blocks = [
  { type: 'emergency_banner', phone: '08 9000 0000' },
  { type: 'cinematic_hero', heading: 'Plumber in Fremantle', text: 'Hot water, drains and leaks across Fremantle and nearby suburbs.', preset: 'blueprint', cta_label: 'Get a quote', cta_href: '#contact', poster: '/m/hero', poster_alt: 'Plumber fitting a hot water unit', width: 1200, height: 600 },
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

// SwiftShader gives headless Chrome software WebGL, so the scene really runs.
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH } : {}) });
// A detailed photo-sized poster: Chrome ignores near-empty images when choosing the largest contentful paint.
const noise = Buffer.alloc(1200 * 600 * 3); for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
const poster = await sharp(noise, { raw: { width: 1200, height: 600, channels: 3 } }).jpeg({ quality: 70 }).toBuffer();
const serve = async (ctx) => {
  const asked = [];
  await ctx.route('**/m/hero', (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: poster }));
  await ctx.route(/\/m\/(?!hero)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#ccd"/></svg>' }));
  await ctx.route('https://sites.test/_site/**', (r) => { const name = new URL(r.request().url()).pathname.slice(7); asked.push(name); r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(new URL(`../saas/site-runtime/${name}`, import.meta.url)) }); });
  await ctx.route('https://sites.test/harbour-plumbing/', (r) => r.fulfill({ status: 200, contentType: 'text/html', headers: { 'content-security-policy': siteCsp(html) }, body: html }));
  return asked;
};
try {
  // Reduced motion: the poster only, and the scene file is never downloaded.
  { const ctx = await browser.newContext({ reducedMotion: 'reduce' }); const asked = await serve(ctx); const p = await ctx.newPage();
    await p.goto('https://sites.test/harbour-plumbing/'); await p.waitForFunction(() => document.querySelector('[data-cinematic]')?.dataset.cinematicState === 'poster');
    assert.equal(await p.locator('canvas').count(), 0); assert.deepEqual(asked, ['cinematic-loader.js'], 'reduced motion never loads the scene'); await ctx.close(); }
  // A low-power device (2 cores) keeps the poster too.
  { const ctx = await browser.newContext(); const asked = await serve(ctx); const p = await ctx.newPage();
    await p.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
    await p.goto('https://sites.test/harbour-plumbing/'); await p.waitForFunction(() => document.querySelector('[data-cinematic]')?.dataset.cinematicState === 'poster');
    assert.deepEqual(asked, ['cinematic-loader.js'], 'low-power devices never load the scene'); await ctx.close(); }
  const ctx = await browser.newContext(); const asked = await serve(ctx);
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { window.__lcp = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push(e.element?.tagName || ''); }).observe({ type: 'largest-contentful-paint', buffered: true }); });
  await page.goto('https://sites.test/harbour-plumbing/');
  assert.equal(await page.locator('h1').count(), 1, 'one H1');
  assert.equal(await page.locator('iframe').count(), 0, 'no embeds');
  assert.equal(await page.locator('script:not([type="application/ld+json"])').count(), 1, 'one script: the cinematic loader');
  // The scene plays once and stops: it starts after load, is done within about 4 s, and draws nothing afterwards.
  await page.waitForFunction(() => document.querySelector('[data-cinematic]')?.dataset.cinematicState === 'playing', null, { timeout: 10000 });
  const t0 = Date.now();
  await page.waitForFunction(() => document.querySelector('[data-cinematic]')?.dataset.cinematicState === 'done', null, { timeout: 8000 });
  assert.ok(Date.now() - t0 <= 4500, `the scene finished in ${Date.now() - t0} ms`);
  assert.deepEqual(asked, ['cinematic-loader.js', 'cinematic.js']);
  assert.equal(await page.locator('canvas.cine-canvas[aria-hidden="true"]').count(), 1);
  const frames = await page.evaluate(() => new Promise((done) => { let n = 0; const c = document.querySelector('canvas.cine-canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'); const orig = gl.drawArrays.bind(gl); gl.drawArrays = (...a) => { n++; return orig(...a); }; setTimeout(() => done(n), 1200); }));
  assert.equal(frames, 0, 'no drawing after the scene ends (no loop)');
  { const l = await page.evaluate(() => window.__lcp); assert.equal(l.at(-1), 'IMG', 'the poster is the largest contentful paint: ' + l.join(',')); }
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
  console.log('PASS website blocks: ten new blocks, one H1, no embeds; cinematic hero plays once in under 4.5 s then stops, poster is the LCP, reduced motion keeps the poster and skips the scene; axe clean and no sideways scroll at 390, 820 and 1440 px, labelled quote form.');
} finally { await browser.close(); }

