// Isolated design-source acceptance only. No production site, providers or credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve('qa/visual/transformation-v3');
await fs.mkdir(out, { recursive: true });
const html = await fs.readFile(path.join(root, 'preview.html'));
const server = http.createServer((req, res) => {
  if (req.url !== '/' && req.url !== '/favicon.ico') { res.writeHead(404); res.end(); return; }
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const screens = ['home', 'signin', 'workspace', 'studio', 'founder'];
const widths = [390, 768, 1440];
const browser = await chromium.launch();
const results = [];
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width === 768 ? 1024 : 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const failures = [];
    await context.route('**/*', async route => {
      if (route.request().url().startsWith(origin + '/')) return route.continue();
      failures.push('Unexpected network destination: ' + new URL(route.request().url()).origin);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(error.message));
    await page.goto(origin, { waitUntil: 'networkidle' });
    for (const screen of screens) {
      const select = page.locator('[data-screen-select="' + screen + '"]');
      await select.click();
      const panel = page.locator('[data-screen="' + screen + '"]');
      await panel.waitFor({ state: 'visible' });
      await assert.equal(await page.locator('[data-screen]:visible').count(), 1, 'Only one proposal visible');
      await assert.equal(await select.getAttribute('aria-pressed'), 'true', 'Selected proposal announced');
      assert.ok(await panel.getByRole('heading').count(), screen + ' needs a visible heading');
      const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(overflow.scroll <= overflow.width + 1, screen + ' overflows at ' + width + ': ' + JSON.stringify(overflow));
      await page.screenshot({ path: path.join(out, screen + '-' + width + '.png'), fullPage: true, animations: 'disabled' });
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const a11y = await page.evaluate(async () => {
        const report = await axe.run(document, { resultTypes: ['violations'] });
        return report.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) }));
      });
      results.push({ screen, width, overflow, seriousOrCritical: a11y });
      console.log(JSON.stringify(results.at(-1)));
      assert.equal(a11y.length, 0, 'Accessibility blockers: ' + JSON.stringify(a11y));
      const otherScreen = screens[(screens.indexOf(screen) + 1) % screens.length];
      await page.locator('[data-screen-select="' + otherScreen + '"]').click();
      await page.locator('[data-screen="' + otherScreen + '"]').waitFor({ state: 'visible' });
      await select.focus();
      await page.keyboard.press('Enter');
      await panel.waitFor({ state: 'visible' });
      assert.equal(await select.getAttribute('aria-pressed'), 'true', 'Keyboard switches an inactive proposal');
      assert.equal(await page.locator('[data-screen]:visible').count(), 1);
    }
    assert.deepEqual(failures, [], 'No runtime errors/external requests');
    await context.close();
  }
  const motionContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
  await motionContext.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const motionPage = await motionContext.newPage();
  await motionPage.goto(origin, { waitUntil: 'networkidle' });
  for (const screen of screens) {
    await motionPage.locator('[data-screen-select="' + screen + '"]').click();
    const infinite = await motionPage.evaluate(() => document.getAnimations().filter(a => a.effect?.getTiming().iterations === Infinity).length);
    assert.equal(infinite, 0, 'Decorative motion must not loop forever: ' + screen);
  }
  await motionContext.close();
} finally {
  await fs.writeFile(path.join(out, 'checks.json'), JSON.stringify({ proposedOnly: true, productionUntouched: true, baselineComparisonPending: true, results }, null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log('PASS: five proposed screens at three widths; current-versus-proposed owner approval remains separate.');
