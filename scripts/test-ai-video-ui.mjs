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
import { ffmpegPath } from '../src/media-tools.js';
const require = createRequire(import.meta.url);
const shot = async (page, name) => { if (process.env.UI_SCREENSHOT_DIR) { fs.mkdirSync(process.env.UI_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, name), fullPage: false }); } };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiv-ui-'));
const mp4 = path.join(tmp, 'clip.mp4');
execFileSync(ffmpegPath(), ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=24', '-t', '15', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '34', '-movflags', '+faststart', mp4]);
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
  await page.addInitScript(()=>{
    window.SpeechRecognition=class{
      constructor(){window.__videoDictationRecognition=this}
      start(){this.onstart?.()}
      stop(){this.onend?.()}
      abort(){this.aborted=true}
    };
  });
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

  // T-191: real browser microphone capture -> authenticated transcription ->
  // original-language editable idea. Recording never starts a paid render.
  let dictationBody='',enhanceCalls=0,renderCalls=0;
  page.on('request',r=>{if(r.url().endsWith('/ai-video/enhance'))enhanceCalls++;if(r.url().endsWith('/ai-video/projects')&&r.method()==='POST')renderCalls++});
  await page.route('**/api/saas/voice/transcribe',async route=>{
    dictationBody=route.request().postDataBuffer().toString('utf8');
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,text:'ہمارے ٹرک کی پالش پہلے اور بعد میں دکھائیں',language:'ur'})});
  });
  await panel.getByRole('button',{name:'Speak idea',exact:true}).click();
  await panel.getByRole('status').filter({hasText:/Listening… speak naturally/}).waitFor();
  await page.waitForTimeout(1300);
  await panel.getByRole('button',{name:'Stop dictation',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#aiv-idea').value.includes('ہمارے ٹرک'));
  assert.match(dictationBody,/name="language"\r\n\r\nauto/);
  assert.equal(enhanceCalls,0,'dictation does not automatically call the prompt writer');
  assert.equal(renderCalls,0,'dictation does not automatically start a paid render');
  assert.equal(await page.locator('#aiv-idea').getAttribute('dir'),'auto');
  await page.unroute('**/api/saas/voice/transcribe');

  // Idea -> AI prompt, then add detail by explicit-language browser dictation.
  await page.getByRole('button', { name: 'Write the prompt with AI' }).click();
  await page.waitForFunction(() => document.querySelector('#aiv-prompt').value.length > 60);
  const writtenPrompt=await page.locator('#aiv-prompt').inputValue();
  await page.locator('#aiv-prompt').evaluate(t=>t.setSelectionRange(t.value.length,t.value.length));
  await page.locator('#aiv-dictation-language').selectOption('hi-IN');
  await panel.getByRole('button',{name:'Speak prompt',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__videoDictationRecognition.lang),'hi-IN');
  await page.evaluate(()=>window.__videoDictationRecognition.onresult({results:[Object.assign([{transcript:'धीमी कैमरा गति रखें'}],{isFinal:true})]}));
  await panel.getByRole('button',{name:'Stop dictation',exact:true}).click();
  assert.equal(await page.locator('#aiv-prompt').inputValue(),writtenPrompt+' धीमी कैमरा गति रखें');
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
  await page.locator('#aiv-duration').selectOption('custom');
  await page.locator('#aiv-custom-duration').fill('0.5');
  await panel.getByText('Your finished video: 30 seconds. One full video to play or download.').waitFor();
  assert.ok(!(await page.locator('#aiv-duration').innerText()).includes('shots'),'length options never show internal sections');
  await page.locator('#aiv-resolution').selectOption('720p');
  await shot(page, 'ai-video-creator.png');
  const createdResponse=page.waitForResponse(r=>r.url().endsWith('/ai-video/projects')&&r.request().method()==='POST');
  await page.locator('#aiv-generate').click();const customProject=(await (await createdResponse).json()).project;
  const customCard=panel.locator(`[data-project="${customProject.id}"]`);
  await customCard.locator('video').waitFor({timeout:90000});
  const long=await customCard.locator('video').evaluate(async v=>{await new Promise(r=>v.readyState>=1?r():v.addEventListener('loadedmetadata',r,{once:true}));return v.duration});
  assert.ok(Math.abs(long-30)<0.2,'one full video matches custom requested duration: '+long);
  assert.ok(!(await customCard.innerText()).includes('shots'),'finished card hides internal sections');

  // Unlimited is explicit about charges and ends in one downloadable video.
  await panel.getByRole('radio',{name:'None',exact:true}).click();
  await page.locator('#aiv-duration').selectOption('continuous');
  const countBefore=renderCalls;await page.locator('#aiv-generate').click();
  await page.locator('#notice',{hasText:'Confirm ongoing provider charges'}).waitFor();assert.equal(renderCalls,countBefore);
  await page.locator('#aiv-continuous-consent').check();
  const ongoingResponse=page.waitForResponse(r=>r.url().endsWith('/ai-video/projects')&&r.request().method()==='POST');
  await page.locator('#aiv-generate').click();const ongoing=(await (await ongoingResponse).json()).project;
  const ongoingCard=panel.locator(`[data-project="${ongoing.id}"]`);
  await ongoingCard.getByRole('button',{name:'Finish video',exact:true}).click();
  await ongoingCard.locator('video').waitFor({timeout:60000});
  assert.equal(await ongoingCard.getByRole('link',{name:'Download',exact:true}).count(),1);

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
