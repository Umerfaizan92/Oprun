// T-071: the Lead sources panel on the Enquiries page works in a real browser at phone, tablet and laptop widths.
// Uses a synthetic workspace; no provider or production account is contacted.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';
const require = createRequire(import.meta.url);
const server = await startServer(); let browser;
try {
  const owner = await seedOwner(server);
  browser = await chromium.launch({ headless: true, ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] } : {}) });
  const ctx = await ownerContext(browser, server, owner), page = await ctx.newPage(), errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(10000);
  await page.goto(server.base + '/saas/workspace.html#b02/enquiries');
  const panel = page.locator('#lead-sources-panel'); await panel.waitFor();
  await panel.locator('summary').first().click();
  await panel.getByText('No tracked links yet.', { exact: false }).waitFor();
  await panel.getByText('Create a tracked link or QR code', { exact: true }).click();
  await panel.getByLabel('Name (only you see this)').fill('Shop window QR');
  await panel.getByLabel('Where it will be used').selectOption('shop_sign');
  await panel.getByLabel('Type').selectOption('qr');
  await panel.getByLabel('Suburb, postcode or area (optional)').fill('Success 6164');
  await panel.getByLabel('Address it opens').fill('https://unrelated-site.example/offer');
  await panel.getByRole('button', { name: 'Create tracked link', exact: true }).click();
  await panel.getByText('A tracked link can open your own verified website', { exact: false }).waitFor();
  await panel.getByLabel('Address it opens').fill('https://www.instagram.com/harbourplumbing');
  await panel.getByRole('button', { name: 'Create tracked link', exact: true }).click();
  const item = panel.locator('.ls-links li'); await item.waitFor();
  assert.match(await item.innerText(), /Shop window QR[\s\S]*Shop sign · Area: Success 6164[\s\S]*\/l\/[a-z0-9]{8}[\s\S]*0 visits · 0 enquiries/);
  assert.match(await item.getByRole('link', { name: 'Open QR code' }).getAttribute('href'), /^\/api\/saas\/lead-sources\/links\/[0-9a-f-]{36}\/qr\.svg$/);
  // The new-enquiry form now offers the tracked link; saving with it shows in the report.
  await page.reload(); await page.locator('#lead-sources-panel').waitFor();
  const form = page.locator('form.pl-new'); await form.getByLabel('Tracked link or QR code (optional)').selectOption({ label: 'Shop window QR (Shop sign)' });
  await form.getByLabel('What do they need?').fill('Blocked drain'); await form.locator('input[name=name]').fill('Pat Walker'); await form.locator('input[name=phone]').fill('0400000001');
  await form.getByRole('button', { name: 'Save enquiry', exact: true }).click();
  const again = page.locator('#lead-sources-panel'); await again.getByText('1 enquiry in the last 90 days; 1 came through a tracked link or QR code.', { exact: true }).waitFor();
  assert.match(await again.locator('.ls-table').first().innerText(), /Shop sign\s+1\s+0\s+0\s+\$0\.00/);
  assert.doesNotMatch(await again.innerText(), /null|undefined/);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no page overflow at ' + width);
    for (const b of await again.locator('.ls-actions :is(button,a)').all()) assert.ok((await b.boundingBox()).height >= 44, 'touch target at ' + width);
    if (process.env.UI_SCREENSHOT_DIR) { fs.mkdirSync(process.env.UI_SCREENSHOT_DIR, { recursive: true }); await again.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'lead-sources-' + width + '.png') }); }
  }
  await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
  const violations = await page.evaluate(async () => (await axe.run(document.querySelector('#lead-sources-panel'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html.slice(0, 160)) })));
  assert.deepEqual(violations, []);
  assert.deepEqual(errors, []);
  console.log('PASS Lead sources: create QR link, refused unrelated address, tracked enquiry in report, three viewport sizes, accessibility.');
} finally { await browser?.close(); await server.stop(); }
