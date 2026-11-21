// T-185: Media Studio in a real browser. The owner connects a video provider, writes an idea, lets AI write the
// prompt, generates a video, watches it play in the page and in the full preview, and every layout fits phone,
// tablet and laptop. A local stand-in plays the provider; the video is a real H.264 MP4 made with ffmpeg.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';
const require = createRequire(import.meta.url);
const shot = async (page, name) => { if (process.env.UI_SCREENSHOT_DIR) { fs.mkdirSync(process.env.UI_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, name), fullPage: false }); } };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiv-ui-'));
const mp4 = path.join(tmp, 'clip.mp4');
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=24', '-t', '2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '34', '-movflags', '+faststart', mp4]);
const VIDEO = fs.readFileSync(mp4).toString('base64');
let polls = 0;
const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
    const send = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url.startsWith('/g/v1beta/models')) return send(200, { models: [] });
    if (req.url === '/g/v1beta/interactions') return send(200, { id: 'int-ui', status: 'in_progress' });
    if (req.url === '/g/v1beta/interactions/int-ui') { polls += 1; return send(200, polls < 2 ? { id: 'int-ui', status: 'in_progress' } : { id: 'int-ui', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', data: VIDEO }] }] }); }
    send(404, {});
  });
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const mbase = `http://127.0.0.1:${mock.address().port}`;
const server = await startServer({ GEMINI_API_BASE_URL: mbase + '/g', AI_VIDEO_POLL_MS: '2000', AI_VIDEO_RATE_LIMIT: '200' }); let browser;
try {
  const owner = await seedOwner(server);
  browser = await chromium.launch({ headless: true, ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH } : {}), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await ownerContext(browser, server, owner), page = await ctx.newPage(), errors = [];
  await ctx.grantPermissions(['camera', 'microphone'], { origin: server.base });
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(20000);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(server.base + '/saas/workspace.html#growth/media');
  const panel = page.locator('#ai-video-panel'); await panel.getByRole('heading', { name: 'Make a video from an idea' }).waitFor();
  await panel.locator('.aiv-provider').nth(2).waitFor();
  assert.equal(await panel.getByText('Not connected').count(), 2, 'both video providers start disconnected');
  await panel.getByText('Optional: for your own voice').waitFor();
  assert.ok(await page.locator('#aiv-generate').isDisabled(), 'cannot generate before connecting');

  // Connect Google with the business's own key.
  await panel.locator('.aiv-provider').filter({ hasText: 'Google' }).getByRole('button', { name: 'Connect' }).click();
  await page.locator('#aiv-key').fill('AIza-ui-test-key-0000000000');
  await page.getByRole('button', { name: 'Check and save' }).click();
  await panel.getByText('Connected · key …0000').waitFor();
  assert.ok(!(await page.content()).includes('AIza-ui-test-key'), 'the key is not shown anywhere after saving');

  // Idea -> AI prompt -> generate.
  await page.locator('#aiv-idea').fill('Before and after of a leaking kitchen tap we fixed');
  await page.getByRole('button', { name: 'Write the prompt with AI' }).click();
  await page.waitForFunction(() => document.querySelector('#aiv-prompt').value.length > 60);
  await panel.getByRole('radio', { name: 'Vertical 9:16' }).click();
  assert.deepEqual(await page.locator('#aiv-resolution option').allTextContents(), ['720p HD', '1080p Full HD', '4K Ultra HD']);
  await page.locator('#aiv-resolution').selectOption('4k');
  await page.locator('#aiv-duration').selectOption('8');
  await shot(page, 'ai-video-form.png');
  await page.locator('#aiv-generate').click();
  await panel.locator('.aiv-job.rendering').waitFor();
  // The finished video appears and really plays in the page.
  await panel.locator('.aiv-job.succeeded video').waitFor({ timeout: 60000 });
  const played = await page.evaluate(async () => { const v = document.querySelector('.aiv-job.succeeded video'); v.muted = true; await v.play(); await new Promise((r) => setTimeout(r, 900)); return { t: v.currentTime, w: v.videoWidth, h: v.videoHeight }; });
  assert.ok(played.t > 0.2 && played.w === 360 && played.h === 640, 'generated video plays: ' + JSON.stringify(played));
  await shot(page, 'ai-video-ready.png');

  // It is in the media library with an AI badge, and the full preview plays it.
  await page.locator('.media-card .media-ai-badge').first().waitFor();
  await page.locator('.media-card').first().getByRole('button', { name: /^Preview / }).click();
  const viewer = page.locator('.mv-dialog[open]'); await viewer.waitFor();
  await page.waitForFunction(() => { const v = document.querySelector('.mv-dialog[open] video'); return v && v.readyState >= 2 && v.videoWidth === 360; });
  await shot(page, 'ai-video-preview.png');
  await viewer.getByRole('button', { name: 'Use as render source' }).click();
  assert.equal(await page.locator('.mv-dialog[open]').count(), 0, 'preview closes');
  assert.match(await page.locator('#video-form [name=media_id]').inputValue(), /^[0-9a-f-]{36}$/);

  // T-190: record a guide video with the camera, record the voice-over, and make a 30-second video in 2 shots.
  await page.evaluate(() => scrollTo(0, 0));
  await panel.getByRole('button', { name: 'Record with camera' }).click();
  const cam = page.locator('dialog.aiv-cam[open]'); await cam.waitFor();
  await page.waitForFunction(() => document.querySelector('.aiv-cam-video')?.readyState >= 2);
  await cam.getByRole('button', { name: 'Start recording' }).click(); await page.waitForTimeout(1600);
  await cam.getByRole('button', { name: 'Stop' }).click();
  await cam.getByRole('button', { name: 'Use this video' }).click();
  await page.locator('#notice', { hasText: 'Your video is saved and added as a guide.' }).waitFor({ timeout: 60000 });
  await page.locator('dialog.aiv-cam').waitFor({ state: 'detached' });
  assert.equal(await panel.locator('#aiv-guides .mp-strip li').count(), 1, 'the camera video is a guide');
  const camMedia = await page.evaluate(async () => (await (await fetch('/api/saas/media', { credentials: 'same-origin', headers: window.SuperProWorkspaceContext?.headers?.() || {} })).json()).media.find((m) => /^Camera recording/.test(m.original_name)));
  assert.equal(camMedia.mime_type, 'video/mp4', 'camera WebM is turned into MP4 for every phone');
  await panel.getByRole('radio', { name: 'Record my voice' }).click();
  await panel.getByRole('button', { name: 'Record', exact: true }).click(); await page.waitForTimeout(2200);
  await panel.getByRole('button', { name: 'Stop', exact: true }).click();
  await panel.getByText('Your recording is ready and will be used.').waitFor({ timeout: 30000 });
  await page.locator('#aiv-duration').selectOption('30');
  await panel.getByText(/30 seconds = 2 shots of 15 seconds/).waitFor();
  await page.locator('#aiv-resolution').selectOption('720p');
  await shot(page, 'ai-video-creator.png');
  await page.locator('#aiv-generate').click();
  await panel.locator('.aiv-job.succeeded', { hasText: '2 shots' }).locator('video').waitFor({ timeout: 90000 });
  const long = await page.evaluate(async () => { const v = [...document.querySelectorAll('.aiv-job.succeeded')].find((n) => n.textContent.includes('2 shots')).querySelector('video'); await new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener('loadedmetadata', r, { once: true }))); return v.duration; });
  assert.ok(long > 3.5, 'two shots joined into one video: ' + long);

  // Fits phone, tablet and laptop; the preview fits the phone screen too; no accessibility blockers.
  for (const width of [390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Media Studio fits at ' + width); }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#ai-video-panel').scrollIntoViewIfNeeded(); await shot(page, 'ai-video-phone.png');
  await page.locator('.media-card').first().getByRole('button', { name: /^Preview / }).click();
  const box = await page.locator('.mv-dialog[open]').boundingBox(); assert.ok(box.width <= 390 && box.height <= 844, 'preview fits the phone: ' + JSON.stringify(box));
  await shot(page, 'ai-video-preview-phone.png'); await page.keyboard.press('Escape');
  await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
  const v = await page.evaluate(async () => (await window.axe.run(document.querySelector('#ai-video-panel'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.filter((x) => ['critical', 'serious'].includes(x.impact)).map((x) => ({ id: x.id, nodes: x.nodes.map((n) => n.html.slice(0, 140)) })));
  assert.deepEqual(v, []);
  assert.deepEqual(errors, []);
  console.log('AI video UI: connect, AI prompt, generate, play, preview, use as source, layouts and accessibility passed.');
} finally { await browser?.close(); await server.stop(); mock.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
