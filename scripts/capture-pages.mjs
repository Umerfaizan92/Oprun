// Before/after evidence for page changes (brief §13): screenshots of public pages at phone, tablet and laptop widths
// from a local test server with synthetic data only.
// Usage: node scripts/capture-pages.mjs <out-dir> <path> [<path> ...]
//   Founder Console pages: give the console hash with a leading # (signs in with the test server's operator key),
//   e.g. node scripts/capture-pages.mjs qa/visual/transformation/mb-13/before '#f07/agents/center'
//   e.g. node scripts/capture-pages.mjs qa/visual/transformation/mb-11/before /saas/verify-account.html
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer } from './test-server.mjs';

const [out, ...paths] = process.argv.slice(2);
if (!out || !paths.length) { console.error('Usage: node scripts/capture-pages.mjs <out-dir> <path> [<path> ...]'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({ headless: true, ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] } : {}) });
try {
  const page = await browser.newPage();
  // The verification step only shows mid sign-up; give it a synthetic pending registration (no real person).
  await page.addInitScript(() => sessionStorage.setItem('gds-pending-registration', JSON.stringify({ registration_id: 'reg-synthetic', email: 'owner@example-business.test', phone: '+61 400 000 000', delivery: { email: { sent: true }, sms: { sent: true } } })));
  if (paths.some((p) => p.startsWith('#'))) {
    await page.goto(server.base + '/saas/operator-sign-in.html');
    await page.locator('#operator-form input[name=key]').fill(server.adminKey);
    await Promise.all([page.waitForURL(server.base + '/office/'), page.locator('#operator-form button[type=submit]').click()]);
    await page.locator('#console-main').waitFor({ state: 'visible', timeout: 20000 });
  }
  for (const p of paths) for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (p.startsWith('#')) { await page.evaluate((h) => { location.hash = h; }, p.slice(1)); await page.waitForFunction(() => !document.querySelector('#console-pages [aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1200); }
    else { await page.goto(server.base + p, { waitUntil: 'load' }); await page.waitForTimeout(800); }
    const file = path.join(out, `${p.replace(/^[/#]/, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '') || 'home'}-${width}.png`);
    await page.screenshot({ path: file, fullPage: false });
    if (!p.startsWith('#') && new URL(page.url()).pathname !== p) throw new Error(`${p} redirected to ${page.url()}; the screenshot would show the wrong page`);
    console.log(file);
  }
} finally { await browser.close(); await server.stop(); }
