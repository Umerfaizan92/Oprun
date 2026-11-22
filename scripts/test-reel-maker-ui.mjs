// T-197: the free Reel Maker in a real browser. The owner uploads photos and a clip, picks a reel type, gets free
// word suggestions, makes a reel on the server, plays it, sends it to a post draft with the caption filled in,
// and every layout fits phone, tablet and laptop with no serious accessibility problems.
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
const shot = async (page, name) => { if (process.env.UI_SCREENSHOT_DIR) { fs.mkdirSync(process.env.UI_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, name), fullPage: false }); } };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-ui-'));
const ff = (args, out) => { execFileSync(ffmpegPath(), ['-loglevel', 'error', '-y', ...args, out]); return out; };
const photo1 = ff(['-f', 'lavfi', '-i', 'testsrc2=size=800x600', '-frames:v', '1'], path.join(tmp, 'before.jpg'));
const photo2 = ff(['-f', 'lavfi', '-i', 'color=c=0x336699:size=600x800', '-frames:v', '1'], path.join(tmp, 'after.png'));
const clip = ff(['-f', 'lavfi', '-i', 'testsrc2=size=320x568:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=300', '-t', '3', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac'], path.join(tmp, 'clip.mp4'));
const server = await startServer({}); let browser;
try {
  const owner = await seedOwner(server);
  browser = await chromium.launch({ headless: true, ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await ownerContext(browser, server, owner), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(server.base + '/saas/workspace.html#growth/media');
  // One tool per page: Library shows first; Reels is its own tab.
  await page.locator('#st-tab-library[aria-selected=true]').waitFor();
  assert.ok(await page.locator('#st-reels').isHidden());
  await page.getByRole('tab', { name: 'Reels' }).click();
  const panel = page.locator('#reel-maker-panel');
  await panel.getByRole('heading', { name: 'Reels', exact: true }).waitFor();
  assert.ok(await page.locator('#st-library').isHidden(), 'only one tool shows at a time');
  await panel.locator('.rm-template').nth(5).waitFor();
  assert.ok(await panel.locator('#rm-offer').isHidden(), 'offer box only for the offer reel');

  await panel.getByRole('radio', { name: 'Before and after' }).click();
  await panel.locator('input[type=file]').setInputFiles([photo1, photo2, clip]);
  await panel.getByText('3 added.').waitFor();

  await page.locator('#rm-make').click();
  await panel.getByText('Add a hook, or tap Suggest text.').waitFor();
  await page.locator('#rm-service').fill('Deck restoration');
  await page.locator('#rm-suggest').click();
  await panel.getByText('Text ready.').waitFor();
  assert.match(await page.locator('#rm-hook').inputValue(), /deck restoration/i);
  assert.equal(await panel.locator('.rm-hook').count(), 3);
  await panel.locator('.rm-hook').nth(1).click();
  assert.equal(await page.locator('#rm-hook').inputValue(), await panel.locator('.rm-hook').nth(1).textContent());
  assert.match(await page.locator('#rm-caption').inputValue(), /#/);
  await page.locator('#rm-features').fill('Sanded to bare timber\nTwo coats of oil');
  await panel.getByRole('radio', { name: 'Square' }).click();
  await page.locator('#rm-quality').selectOption('720p');
  await page.locator('#rm-make').click();
  await panel.getByText('Making your reel…').waitFor();
  const card = panel.locator('.rm-card').first();
  await card.and(page.locator('[data-status="succeeded"]')).waitFor({ timeout: 180000 });
  const video = card.locator('video');
  await page.waitForFunction(() => { const v = document.querySelector('.rm-card video'); return v && v.readyState >= 1 && v.videoWidth > 0; });
  const dims = await video.evaluate((v) => [v.videoWidth, v.videoHeight, v.duration]);
  assert.equal(dims[0], dims[1], 'square reel'); assert.ok(dims[2] > 5, 'reel has a real length: ' + dims[2]);
  assert.match(await card.getByRole('link', { name: 'Download' }).getAttribute('href'), /^\/api\/saas\/media\/.+\/file$/);

  await card.getByRole('button', { name: 'Preview' }).click();
  await page.locator('.mv-dialog[open] video').waitFor(); await page.keyboard.press('Escape');
  await card.getByRole('button', { name: 'Create post draft' }).click();
  const dlg = page.locator('dialog[open]'); await dlg.waitFor();
  assert.match(await dlg.locator('textarea').first().inputValue(), /Deck restoration|deck restoration/i, 'the reel caption is filled in');
  await page.keyboard.press('Escape');

  for (const width of [390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Reel Maker fits at ' + width); }
  await page.setViewportSize({ width: 390, height: 844 }); await panel.scrollIntoViewIfNeeded(); await shot(page, 'reel-maker-phone.png');
  await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
  const v = await page.evaluate(async () => (await window.axe.run(document.querySelector('#reel-maker-panel'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.filter((x) => ['critical', 'serious'].includes(x.impact)).map((x) => ({ id: x.id, nodes: x.nodes.map((n) => n.target.join(' ')).slice(0, 3) })));
  assert.deepEqual(v, []);
  assert.deepEqual(errors, []);
  assert.ok(await page.locator('#ai-video-panel').count(), 'the AI video panel is still there');
  console.log('Reel Maker UI: upload, suggest words, make reel, play, post draft, layouts and accessibility passed.');
} finally { await browser?.close(); await server.stop(); fs.rmSync(tmp, { recursive: true, force: true }); }
