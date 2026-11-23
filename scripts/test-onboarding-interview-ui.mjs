// TR-50 acceptance: guided setup resumes after the browser is closed. Answers two questions, closes the whole
// browser context (cookies kept as a real browser would for a signed-in user; page memory and storage gone), opens it
// again and checks the interview continues at question 3 with both answers kept. Also checks correction and Hindi.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const s = await startServer({});
const owner = await seedOwner(s);
const browser = await chromium.launch({ executablePath: process.env.UI_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const results = [];
const check = async (name, fn) => { await fn(); results.push(name); console.log('PASS ' + name); };
const open = async (width = 1280) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.addCookies([{ name: 'fp_session', value: owner.token, url: s.base }]);
  await ctx.addInitScript((slug) => { try { localStorage.setItem('gds-tour-' + slug, 'done'); } catch {} const get = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return /^superpro_release_seen:/.test(String(k)) ? '1' : get.call(this, k); }; }, owner.slug);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(s.base + '/saas/workspace.html', { waitUntil: 'networkidle' });
  const path = await page.evaluate(() => window.SuperProNav.pathFor('onboarding'));
  await page.evaluate((p) => { location.hash = p; }, path);
  await page.locator('#ob-interview .ob-question, #ob-interview .ob-done').first().waitFor({ timeout: 15000 });
  return { ctx, page, errors };
};
try {
  await check('first visit starts at question 1', async () => {
    const { ctx, page, errors } = await open();
    assert.equal(await page.locator('#ob-interview [data-question]').getAttribute('data-question'), 'business');
    await page.locator('#ob-interview textarea').fill('Residential plumbing and hot water repairs');
    await page.locator('#ob-interview').getByRole('button', { name: 'Save answer' }).click();
    await page.locator('#ob-interview [data-question="services"]').waitFor();
    await page.locator('#ob-interview textarea').fill('Blocked drains, hot water systems, leak repairs');
    await page.locator('#ob-interview').getByRole('button', { name: 'Save answer' }).click();
    await page.locator('#ob-interview [data-question="pricing"]').waitFor();
    assert.match(await page.locator('.ob-progress').innerText(), /2 of 16 answered/);
    assert.match(await page.locator('.ob-context').innerText(), /Australia/, 'questions are for the business country');
    assert.match(await page.locator('.ob-step').innerText(), /Services and pricing/, 'each question shows its topic');
    assert.deepEqual(errors, []);
    await ctx.close(); // the browser is closed: page memory and site storage are gone
  });
  await check('after closing the browser it resumes at question 3 with both answers kept', async () => {
    const { ctx, page, errors } = await open();
    assert.equal(await page.locator('#ob-interview [data-question]').getAttribute('data-question'), 'pricing');
    assert.match(await page.locator('.ob-resume').innerText(), /Carry on from question 3/);
    const answers = await page.locator('.ob-summary li').allInnerTexts();
    assert.match(answers[0], /Residential plumbing/); assert.match(answers[1], /Blocked drains/); assert.match(answers[2], /Not answered yet/);
    // Correction: edit question 1 and save; the answer changes and nothing else is lost.
    await page.locator('#ob-interview').getByRole('button', { name: 'Edit: What does your business do?' }).click();
    assert.equal(await page.locator('#ob-interview textarea').inputValue(), 'Residential plumbing and hot water repairs');
    await page.locator('#ob-interview textarea').fill('Residential and small commercial plumbing');
    await page.locator('#ob-interview').getByRole('button', { name: 'Save answer' }).click();
    await page.waitForTimeout(500);
    assert.match((await page.locator('.ob-summary li').allInnerTexts())[0], /small commercial/);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  await check('the corrected answer survives another restart, and the phone layout fits', async () => {
    const { ctx, page } = await open(390);
    assert.match((await page.locator('.ob-summary li').allInnerTexts())[0], /small commercial/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no sideways scrolling on a phone');
    await ctx.close();
  });
  await check('questions appear in the owner\'s language (Hindi)', async () => {
    const r = await s.call('PUT', '/api/saas/preferences/language', { cookie: owner.cookie, body: { locale: 'hi' } });
    if (r.status >= 300) console.log('language PUT', r.status, r.json);
    assert.ok(r.status < 300, 'language saved');
    const { ctx, page } = await open();
    await page.waitForFunction(() => String(window.OprunLocale?.locale).startsWith('hi'), null, { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => window.OprunInterview.reload()); await page.waitForTimeout(800);
    const label = await page.locator('#ob-interview .ob-label').innerText();
    assert.match(label, /[ऀ-ॿ]/, `Hindi question text, got "${label}"`);
    await ctx.close();
  });
  console.log(`ONBOARDING INTERVIEW UI PASSED: ${results.length}`);
} catch (e) { console.error('FAIL', e); process.exitCode = 1; }
finally { await browser.close(); await s.stop(); }
