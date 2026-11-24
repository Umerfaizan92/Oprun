// W-03 (T-149) acceptance: a test business with services and areas reaches Review (generated drafts) in under
// 10 minutes through the wizard. Also: resume after leaving, chips and areas, page summary, rewrite without AI is
// refused honestly, Send for approval publishes nothing directly, phone and laptop fit, accessible in both themes.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
const require = createRequire(import.meta.url);

const s = await startServer({});
const owner = await seedOwner(s, { business: 'Harbour Plumbing' });
const browser = await chromium.launch({ executablePath: process.env.UI_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const shots = process.env.UI_SCREENSHOT_DIR; if (shots) fs.mkdirSync(shots, { recursive: true });
let passed = 0; const check = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };
const axe = async (page, sel) => { await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')); return page.evaluate(async (s) => (await window.axe.run(document.querySelector(s), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => ({ id: v.id, t: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })), sel); };
async function open(width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.addCookies([{ name: 'fp_session', value: owner.token, url: s.base }]);
  await ctx.addInitScript((slug) => { try { localStorage.setItem('gds-tour-' + slug, 'done'); } catch {} const get = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return /^superpro_release_seen:/.test(String(k)) ? '1' : get.call(this, k); }; }, owner.slug);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(s.base + '/saas/workspace.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => { location.hash = window.SuperProNav.pathFor('websitehub'); });
  await page.locator('#websitehub-view [role=tab]', { hasText: 'Build' }).evaluate((b) => b.click()); // on phones the tabs sit in the bottom dock
  await page.locator('#websitehub-view .wz-card h2').waitFor({ timeout: 15000 });
  return { ctx, page, errors };
}
const nextStep = (page) => page.locator('#wz-next').click();
const at = (page, n) => page.locator(`#websitehub-view [data-wz-step="${n}"][aria-current=step]`).waitFor();
try {
  const started = Date.now();
  await check('a business with services and areas reaches Review in under 10 minutes', async () => {
    const { ctx, page, errors } = await open();
    await at(page, 1); assert.match(await page.locator('.wz-progress').innerText(), /Step 1 of 9/);
    await page.locator('#websitehub-view').getByLabel(/Make me a new website/).check(); await nextStep(page); await at(page, 2);
    assert.equal(await page.locator('#websitehub-view').getByLabel('Business name').inputValue(), 'Harbour Plumbing', 'pre-filled from Oprun');
    await page.locator('#websitehub-view').getByLabel('Phone').fill('08 9000 1234');
    await nextStep(page); await page.locator('[data-ws-status]').getByText(/Add .*at least one service/).waitFor();
    for (const svc of ['Blocked drains', 'Hot water systems']) { await page.locator('#websitehub-view').getByPlaceholder('For example: Blocked drains').fill(svc); await page.locator('#websitehub-view').getByRole('button', { name: 'Add service' }).click(); }
    assert.equal(await page.locator('.wz-chips li').count(), 2);
    await page.locator('#websitehub-view').getByRole('button', { name: 'Remove Hot water systems' }).click(); assert.equal(await page.locator('.wz-chips li').count(), 1);
    await page.locator('#websitehub-view').getByPlaceholder('For example: Blocked drains').fill('Hot water systems'); await page.keyboard.press('Enter');
    await page.locator('#websitehub-view').getByRole('button', { name: 'Add an area' }).click(); await page.locator('#websitehub-view').getByLabel('Area 1', { exact: true }).fill('Fremantle');
    await page.locator('#websitehub-view').getByLabel('One true thing about working there (optional)').fill('Our van is based in South Fremantle.');
    await page.locator('#websitehub-view').getByLabel('Opening hours (optional)').fill('Monday to Friday, 7am to 5pm');
    await nextStep(page); await at(page, 3);
    await page.locator('#websitehub-view').getByLabel('Warm local').check(); await nextStep(page); await at(page, 4);
    assert.match(await page.locator('.wz-summary').innerText(), /Hot water systems[\s\S]*Blocked drains in Fremantle|Blocked drains in Fremantle/);
    await nextStep(page); await at(page, 5); await nextStep(page); await at(page, 6); await nextStep(page); await at(page, 7); await nextStep(page); await at(page, 8);
    if (shots) await page.screenshot({ path: `${shots}/wizard-review-empty.png`, fullPage: true });
    await page.locator('#wz-generate').click();
    await page.locator('.wz-page').first().waitFor({ timeout: 60000 });
    const minutes = (Date.now() - started) / 60000; assert.ok(minutes < 10, `reached Review in ${minutes.toFixed(2)} min`);
    const titles = await page.locator('.wz-page-head b').allInnerTexts();
    for (const t of ['Harbour Plumbing', 'Services', 'Blocked drains', 'Hot water systems', 'Blocked drains in Fremantle', 'About us', 'Contact']) assert.ok(titles.includes(t), `${t} drafted (${titles.join(', ')})`);
    assert.ok(await page.locator('.wz-page a', { hasText: 'Preview' }).first().getAttribute('href'));
    if (shots) await page.screenshot({ path: `${shots}/wizard-review.png`, fullPage: true });
    // No AI in tests: a rewrite is refused and the section stays as it was.
    await page.locator('.wz-page').first().getByRole('button', { name: /^Rewrite/ }).first().click();
    await page.locator('[data-ws-status]').getByText(/unchanged/).waitFor();
    assert.deepEqual(await axe(page, '#websitehub-view'), [], 'review is accessible (dark)');
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); await page.waitForTimeout(500);
    assert.deepEqual(await axe(page, '#websitehub-view'), [], 'review is accessible (light)');
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.locator('#websitehub-view').getByRole('button', { name: 'Continue to publish' }).click(); await at(page, 9);
    await page.locator('#wz-publish').click();
    await page.locator('.wz-results li').filter({ hasText: /Sent for approval|approval/ }).first().waitFor({ timeout: 30000 });
    const db = new Database(s.dbPath, { readonly: true });
    assert.equal(db.prepare('SELECT COUNT(*) n FROM seo_site_pages WHERE owner_key=? AND published_version IS NOT NULL').get(owner.org).n, 0, 'a first release waits for approval');
    db.close();
    assert.deepEqual(errors, []); await ctx.close();
  });
  await check('leaving and coming back resumes at the saved step; phone fits without sideways scrolling', async () => {
    const { ctx, page, errors } = await open(390);
    await at(page, 9);
    for (const n of [2, 4, 8]) { await page.locator(`[data-wz-step="${n}"]`).click(); await at(page, n); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `step ${n} fits a phone`); if (shots && n !== 4) await page.screenshot({ path: `${shots}/wizard-phone-step${n}.png`, fullPage: true }); }
    assert.equal(await page.locator('.wz-chips li').count(), 0, 'chips belong to step 2 only');
    await page.locator('[data-wz-step="2"]').click(); await at(page, 2); assert.equal(await page.locator('.wz-chips li').count(), 2, 'services kept');
    assert.deepEqual(await axe(page, '#websitehub-view'), [], 'step 2 accessible on a phone');
    assert.deepEqual(errors, []); await ctx.close();
  });
  console.log(`WEBSITE WIZARD UI PASSED: ${passed}`);
} catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
finally { await browser.close(); await s.stop(); }
