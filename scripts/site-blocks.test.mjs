// W-05 (docs/ai-website/00_CONTRACT.md §6): the ten new website blocks. Each renders only what the owner entered,
// escapes every value, keeps one H1, and never shows what the contract forbids (customer names, unanswered questions,
// an urgent-calls banner without a 24/7 receptionist, a tracking map embed).
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import { renderPage, prePublishChecks, BLOCK_TYPES, siteCsp, CINEMATIC_LOADER } from '../src/seo/builder.js';
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

test('W-06: only a page with a cinematic hero loads the scene script, and only that page may run scripts', async (t) => {
  const plain = renderPage(page([{ type: 'hero', heading: 'Plumber' }]), { site });
  const cine = renderPage(page([{ type: 'cinematic_hero', heading: 'Plumber', preset: 'tools', poster: '/m/p', poster_alt: '' }]), { site: { ...site, brand: { primary_color: '#0b6e4f' } } });
  assert.ok(!plain.includes('<script type="module"'), 'no script on a plain page');
  assert.equal((cine.match(/<script type="module"/g) || []).length, 1);
  assert.ok(cine.includes(`src="${CINEMATIC_LOADER}"`)); assert.match(cine, /data-cinematic="tools" data-color="#0b6e4f"/);
  assert.doesNotMatch(siteCsp(plain), /script-src/); assert.match(siteCsp(cine), /; script-src 'self'$/);
  assert.match(siteCsp(cine), /^default-src 'none'/, 'everything else stays closed');
  const s = await startServer(); t.after(() => s.stop());
  for (const [name, enc, want] of [['cinematic-loader.js', 'br', 'br'], ['cinematic.js', 'gzip', 'gzip'], ['cinematic.js', '', null]]) {
    const r = await fetch(`${s.base}/_site/${name}?v=1`, { headers: { 'accept-encoding': enc || 'identity' } });
    assert.equal(r.status, 200, name); assert.match(r.headers.get('content-type'), /javascript/); assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    if (want === null) assert.match(await r.text(), /WebGL|webgl|three/i);
  }
  for (const bad of ['hero-3d.js', '..%2Fsrc%2Fserver.js', 'cinematic.mjs']) assert.equal((await fetch(`${s.base}/_site/${bad}`)).status, 404, bad);
});

test('W-06 speed budget: tiny loader, scene within budget, poster loads first', () => {
  const size = (f) => fs.statSync(new URL(`../saas/site-runtime/${f}`, import.meta.url)).size;
  assert.ok(size('cinematic-loader.js') <= 2048, `loader ${size('cinematic-loader.js')} bytes`);
  assert.ok(size('cinematic.js.br') <= 130 * 1024, `scene ${Math.round(size('cinematic.js.br') / 1024)} KB compressed`);
  const src = fs.readFileSync(new URL('../saas/site-runtime/src/cinematic.mjs', import.meta.url), 'utf8');
  assert.match(src, /DURATION_MS = 3[0-9]{3}\b/, 'plays for under four seconds'); assert.match(src, /setAnimationLoop\(null\)/, 'rendering stops');
  const html = renderPage(page([{ type: 'cinematic_hero', heading: 'Plumber', poster: '/m/p', poster_alt: 'Van' }]), { site });
  assert.match(html, /<img[^>]+fetchpriority="high"/); assert.doesNotMatch(html.match(/<div class="poster">.*?<\/div>/)[0], /loading="lazy"/, 'the poster is not lazy-loaded');
});

test('W-03..W-06 gate: new sections only for businesses listed in WEBSITE_BUILDER_V2_ORGS', async (t) => {
  const { v2Enabled } = await import('../src/seo/builder.js');
  assert.equal(v2Enabled('org-a', {}), false); assert.equal(v2Enabled('org-a', { WEBSITE_BUILDER_V2_ORGS: 'org-b, org-a' }), true); assert.equal(v2Enabled('org-z', { WEBSITE_BUILDER_V2_ORGS: '*' }), true);
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Gate Co', email: 'gate@gate.example.test' });
  const O = (m, u, b) => s.call(m, u, { cookie: owner.cookie, body: b });
  const types = (await O('GET', '/api/saas/seo/sites')).json.block_types;
  assert.ok(types.includes('hero') && !types.includes('pricing') && !types.includes('cinematic_hero'), 'not offered without the flag');
  let r = await O('POST', '/api/saas/seo/sites', { name: 'Gate Co', slug: 'gate-co' }); assert.equal(r.status, 201, r.text);
  r = await O('POST', `/api/saas/seo/sites/${r.json.site.id}/pages`, { title: 'Home page here', slug: 'home', template: 'home' }); assert.equal(r.status, 201, r.text);
  const id = r.json.page.id;
  r = await O('PUT', `/api/saas/seo/pages/${id}`, { content: { title: 'Home page here', blocks: [{ type: 'hero', heading: 'Hi' }, { type: 'pricing', gst: 'inc', items: [] }] } });
  assert.equal(r.status, 403); assert.match(r.json.error, /not switched on/);
  r = await O('PUT', `/api/saas/seo/pages/${id}`, { content: { title: 'Home page here', blocks: [{ type: 'hero', heading: 'Hi' }] } });
  assert.equal(r.status, 200, r.text);
});

test('W-08 speed budget: an over-budget page cannot publish until the owner accepts it', async (t) => {
  const { speedBudget, SPEED_BUDGET } = await import('../src/seo/builder.js');
  const lorem = 'We clear blocked drains for homes around Fremantle and give a written quote before any work starts. ';
  const ok = page([{ type: 'hero', heading: 'Plumber', text: lorem }, { type: 'text', heading: 'About', text: lorem.repeat(4) }]);
  assert.deepEqual(speedBudget(ok, { site }), [], 'a normal page is within budget');
  // 41 photos is over the image limit; random text over the compressed HTML limit.
  const many = page([{ type: 'hero', heading: 'Plumber' }, { type: 'gallery', images: Array.from({ length: SPEED_BUDGET.images + 1 }, (_, i) => ({ src: `/m/p${i}`, alt: `Job ${i}`, width: 800, height: 600 })) }]);
  assert.match(speedBudget(many, { site }).join(' '), /has 41 images; the limit is 40/);
  const noise = Array.from({ length: 30 }, (_, i) => ({ type: 'text', heading: `Section ${i}`, text: Array.from({ length: 450 }, () => Math.random().toString(36).slice(2, 10)).join(' ') }));
  const big = page([{ type: 'hero', heading: 'Plumber' }, ...noise]);
  assert.match(speedBudget(big, { site }).join(' '), /compressed; the limit is 60 KB/);
  let c = prePublishChecks(big, { site });
  assert.equal(c.blocked, true); assert.ok(c.checks.some((x) => x.level === 'budget'));
  c = prePublishChecks({ ...big, speed_accepted: true }, { site });
  assert.ok(!c.checks.some((x) => x.level === 'budget'), 'accepted: no longer blocks'); assert.ok(c.checks.some((x) => x.level === 'warn' && /^Accepted: /.test(x.text)), 'the accepted warning stays visible');
  // Unsized images are advice only, so existing pages are not suddenly blocked.
  c = prePublishChecks(page([{ type: 'hero', heading: 'Plumber', text: lorem }, { type: 'image', src: 'https://example.test/a.jpg', alt: 'Van' }]), { site });
  assert.ok(c.checks.some((x) => x.group === 'speed' && x.level === 'warn' && /no width and height/.test(x.text))); assert.ok(!c.checks.some((x) => x.level === 'budget'));

  // Through the API: refused with the speed message, then published after accepting.
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Big Page Co', email: 'big@big.example.test' });
  const O = (m, u, b) => s.call(m, u, { cookie: owner.cookie, body: b });
  await O('PUT', '/api/saas/seo/profile', { business_name: 'Big Page Co', services: ['Drains'], areas: ['Fremantle'], phone: '0400 000 002', website_url: '' });
  let r = await O('POST', '/api/saas/seo/sites', { name: 'Big Page Co', slug: 'big-page-co' });
  const pg = (await O('POST', `/api/saas/seo/sites/${r.json.site.id}/pages`, { title: 'Home', slug: 'home', template: 'home' })).json.page;
  const content = { title: 'Plumber in Fremantle', meta_title: 'Plumber in Fremantle | Big Page Co', meta_description: 'Plumbing in Fremantle from Big Page Co. Written quotes before any work starts.', blocks: [{ type: 'hero', heading: 'Plumber in Fremantle', text: lorem }, ...noise] };
  assert.equal((await O('PUT', `/api/saas/seo/pages/${pg.id}`, { content })).status, 200);
  r = await O('POST', `/api/saas/seo/pages/${pg.id}/publish`, {});
  assert.equal(r.status, 409); assert.match(r.json.error, /over the speed budget/);
  assert.equal((await O('PUT', `/api/saas/seo/pages/${pg.id}`, { content: { ...content, speed_accepted: true }, note: 'Accept speed' })).status, 200);
  r = await O('POST', `/api/saas/seo/pages/${pg.id}/publish`, {});
  assert.equal(r.status, 201, r.text); assert.equal(r.json.run.status, 'awaiting_approval', 'then the normal first-release approval');
});
