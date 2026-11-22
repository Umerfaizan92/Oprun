// Media Studio redesign: one tool per page (Library · Reels · Editor · AI video), keyboard tabs, full-screen preview,
// no legacy screens, fits phone/tablet/laptop, no serious accessibility problems, no browser errors.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';
import { ffmpegPath } from '../src/media-tools.js';
const require = createRequire(import.meta.url);
const shot = async (page, name) => { if (process.env.UI_SCREENSHOT_DIR) { await page.waitForTimeout(450); fs.mkdirSync(process.env.UI_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, name) }); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-ui-'));
const clip = path.join(tmp, 'job.mp4'), photo = path.join(tmp, 'site.jpg');
execFileSync(ffmpegPath(), ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x568:rate=24', '-t', '2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', clip]);
execFileSync(ffmpegPath(), ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x480', '-frames:v', '1', photo]);
const server = await startServer({}); let browser;
try {
  const owner = await seedOwner(server);
  browser = await chromium.launch({ headless: true, ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const ctx = await ownerContext(browser, server, owner), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.base + '/saas/workspace.html#growth/media');
  await page.locator('#video-view h1', { hasText: 'Media Studio' }).waitFor();
  const tabs = page.locator('#video-view .st-tabs [role=tab]');
  assert.deepEqual(await tabs.allTextContents(), ['Library', 'Reels', 'Editor', 'AI video']);
  // Nothing from the old studio remains.
  for (const gone of ['#video-form', '.studio-workflow', '.trend-panel', '#renders', '.ms-nav', '#add-demo-assets', '#organize-library']) assert.equal(await page.locator(gone).count(), 0, gone + ' is removed');
  const visiblePages = () => page.$$eval('#video-view .st-page', (ps) => ps.filter((p) => !p.hidden).map((p) => p.id));
  assert.deepEqual(await visiblePages(), ['st-library']);

  // Library: upload, then tap a file to preview it in the full player.
  await page.locator('#media-file').setInputFiles([clip, photo]);
  await page.locator('#st-library .media-card').nth(1).waitFor();
  assert.equal(await page.locator('#library-count').textContent(), '2 files');
  await page.locator('#st-library .media-card', { hasText: 'job.mp4' }).getByRole('button', { name: 'Preview job.mp4' }).click();
  await page.waitForFunction(() => { const v = document.querySelector('.mv-dialog[open] video'); return v && v.readyState >= 1 && v.videoWidth === 320; });
  await shot(page, 'studio-preview.png'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Videos', exact: true }).click();
  assert.equal(await page.locator('#st-library .media-card').count(), 1, 'filter shows videos only');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  assert.equal(await page.locator('#st-library .media-card .media-del').count(), 2, 'owner can delete');
  await shot(page, 'studio-library.png');

  // Keyboard: arrows move between tools; exactly one page shows.
  await page.getByRole('tab', { name: 'Library' }).focus();
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await visiblePages(), ['st-reels']); assert.equal(await page.evaluate(() => document.activeElement?.id), 'st-tab-reels');
  await page.locator('#reel-maker-panel').waitFor(); await shot(page, 'studio-reels.png');
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await visiblePages(), ['st-editor']);
  await page.locator('#st-editor .ms-editor h2', { hasText: 'Editor' }).waitFor(); await shot(page, 'studio-editor.png');
  await page.keyboard.press('End');
  assert.deepEqual(await visiblePages(), ['st-ai']);
  await page.locator('#ai-video-panel h2', { hasText: 'AI video' }).waitFor(); await shot(page, 'studio-ai.png');
  assert.equal(await page.locator('#st-clear-ai').count(), 0, 'no delete button when there is nothing AI-generated');
  await page.keyboard.press('Home');
  assert.deepEqual(await visiblePages(), ['st-library']);

  // Every tool fits phone, tablet and laptop, with no serious accessibility problems.
  await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const t of ['library', 'reels', 'editor', 'ai']) {
      await page.evaluate((k) => window.OprunStudio.show(k), t); await page.waitForTimeout(150);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${t} fits at ${width}`);
      if (width === 390) await shot(page, `studio-${t}-phone.png`);
      if (width === 1440) {
        const v = await page.evaluate(async () => (await window.axe.run(document.querySelector('#video-view'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.filter((x) => ['critical', 'serious'].includes(x.impact)).map((x) => ({ id: x.id, nodes: x.nodes.map((n) => n.target.join(' ')).slice(0, 3) })));
        assert.deepEqual(v, [], `${t}: ` + JSON.stringify(v));
      }
    }
  }
  // Phone: the four tools are in the bottom dock, the app's standard for page sections.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#mobile-workspace-dock [aria-label="Reels"]').click();
  assert.deepEqual(await visiblePages(), ['st-reels']);
  assert.deepEqual(errors, []);
  console.log('Media Studio UI: four single-page tools, keyboard tabs, preview, no legacy screens, layouts and accessibility passed.');
} finally { await browser?.close(); await server.stop(); fs.rmSync(tmp, { recursive: true, force: true }); }
