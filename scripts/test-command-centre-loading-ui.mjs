// Batch-5 review (ChatGPT, REVIEW_CP117_T094 "Batch-5 checks" item 1): the Command Centre live-figures board shows
// placeholder tiles while it loads. Check every response path and role: placeholders never show figures, the board
// is marked busy only while loading, no "Live" badge appears before data, denied/failed responses leave no stale
// placeholders, and nothing scrolls sideways. Responses are intercepted in the browser; no data is written.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';

const server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.UI_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) });
const results = [];
try {
  const owner = await seedOwner(server);
  const cases = [
    { name: 'owner delayed', role: null, mode: 'delay', placeholders: 5 },
    { name: 'manager delayed', role: 'manager', mode: 'delay', placeholders: 4 },
    { name: 'custom role delayed', role: 'custom_dispatch', mode: 'delay', placeholders: 4 },
    { name: 'owner denied', role: null, mode: 403 },
    { name: 'manager denied', role: 'manager', mode: 403 },
    { name: 'owner failed', role: null, mode: 500 }
  ];
  for (const width of [390, 1440]) for (const c of cases) {
    const ctx = await ownerContext(browser, server, owner, { viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    let release; const gate = new Promise((r) => { release = r; });
    if (c.role) await page.route('**/api/saas/me', async (route) => {
      const res = await route.fetch(); const body = await res.json(); body.user.role = c.role;
      await route.fulfill({ response: res, json: body });
    });
    await page.route('**/api/saas/command-centre', async (route) => {
      if (c.mode === 'delay') { await gate; return route.continue(); }
      return route.fulfill({ status: c.mode, contentType: 'application/json', body: JSON.stringify({ ok: false, error: c.mode === 403 ? 'Not permitted' : 'Unavailable' }) });
    });
    await page.goto(server.base + '/saas/workspace.html#dashboard');
    const board = page.locator('.gx-board');
    await board.waitFor({ state: 'attached', timeout: 15000 });
    const state = () => page.evaluate(() => {
      const b = document.querySelector('.gx-board');
      return { busy: b.getAttribute('aria-busy'), ghosts: b.querySelectorAll('.gx-skeleton').length, tiles: b.querySelectorAll('.gx-tile:not(.gx-skeleton)').length,
        live: !!b.querySelector('.gx-live'), loading: /Loading live figures/.test(b.textContent), digits: [...b.querySelectorAll('.gx-skeleton')].some((t) => /\d/.test(t.textContent)),
        ghostsHidden: [...b.querySelectorAll('.gx-skeleton')].every((t) => t.getAttribute('aria-hidden') === 'true'),
        wide: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    if (c.mode === 'delay') {
      await page.waitForFunction(() => document.querySelector('.gx-board')?.getAttribute('aria-busy') === 'true');
      const during = await state();
      assert.equal(during.ghosts, c.placeholders, `${width} ${c.name}: placeholder count`);
      assert.equal(during.digits, false, `${width} ${c.name}: placeholders show no figures`);
      assert.equal(during.ghostsHidden, true, `${width} ${c.name}: placeholders hidden from screen readers`);
      assert.equal(during.live, false, `${width} ${c.name}: no Live badge before data`);
      assert.equal(during.wide, false, `${width} ${c.name}: no sideways scroll while loading`);
      release();
      await page.waitForFunction(() => !document.querySelector('.gx-board')?.hasAttribute('aria-busy'), null, { timeout: 15000 });
      const after = await state();
      assert.equal(after.ghosts, 0, `${width} ${c.name}: placeholders removed`);
      assert.equal(after.loading, false, `${width} ${c.name}: loading message cleared`);
      assert.ok(after.tiles > 0, `${width} ${c.name}: real tiles shown`);
      assert.equal(after.wide, false, `${width} ${c.name}: no sideways scroll after load`);
      results.push(`${width} ${c.name}: ${during.ghosts} placeholders -> ${after.tiles} tiles`);
    } else {
      await page.waitForFunction(() => !document.querySelector('.gx-board')?.hasAttribute('aria-busy'), null, { timeout: 15000 });
      const after = await state();
      assert.equal(after.ghosts, 0, `${width} ${c.name}: no stale placeholders`);
      assert.equal(after.loading, false, `${width} ${c.name}: no endless loading message`);
      assert.equal(after.live, false, `${width} ${c.name}: no false Live badge`);
      assert.equal(after.tiles, 0, `${width} ${c.name}: no figures shown`);
      assert.equal(after.wide, false, `${width} ${c.name}: no sideways scroll`);
      results.push(`${width} ${c.name}: cleared`);
    }
    await ctx.close();
  }
  // E-037: Today sections must not rebuild themselves continuously (was about 20/s on Action Centre, 50/s on Your Workspace).
  { const ctx = await ownerContext(browser, server, owner, { viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
    await page.goto(server.base + '/saas/workspace.html#dashboard'); await page.locator('#dashboard-view [role=tab][data-section-key="action-centre"]').waitFor();
    for (const [tab, target] of [['action-centre', '#priorities .cc-brief'], ['your-workspace', '#cc-feature-results']]) {
      await page.locator(`#dashboard-view [role=tab][data-section-key="${tab}"]`).click(); await page.waitForTimeout(1500);
      const rebuilds = await page.evaluate((sel) => new Promise((r) => { let c = 0; new MutationObserver((m) => { c += m.length; }).observe(document.querySelector(sel), { childList: true }); setTimeout(() => r(c), 2000); }), target);
      assert.ok(rebuilds <= 1, `${tab}: ${rebuilds} rebuilds in 2 seconds while idle`);
      results.push(`${tab}: ${rebuilds} rebuilds in 2s idle`);
    }
    await ctx.close(); }
  console.log('PASS Command Centre loading states: ' + results.length + ' cases\n  ' + results.join('\n  '));
} finally { await browser.close(); await server.stop(); }
