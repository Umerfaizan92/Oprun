// T-074: a real call in real browsers. An owner starts a video call from the workspace, two guests open the private
// link, wait, are let in, and all three see and hear each other. Uses the browser's built-in test camera and
// microphone on a synthetic workspace; no outside service is contacted.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';
const require = createRequire(import.meta.url);
const server = await startServer({ MEETING_STUN_URLS: '' }); let browser;
const shot = async (page, name) => { if (process.env.UI_SCREENSHOT_DIR) { fs.mkdirSync(process.env.UI_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, name) }); } };
// Every remote tile must be receiving moving picture and sound.
const mediaFlowing = (page, tiles) => page.waitForFunction(async (n) => {
  const remote = [...document.querySelectorAll('.mc-tile video:not(.mc-self)')].filter((v) => !v.muted);
  if (remote.length !== n) return false;
  return remote.every((v) => v.videoWidth > 0 && v.readyState >= 2 && v.srcObject?.getAudioTracks().some((t) => t.readyState === 'live' && !t.muted) && v.srcObject?.getVideoTracks().some((t) => t.readyState === 'live'));
}, tiles, { timeout: 30000 });
const framesAdvance = async (page) => { const read = () => page.evaluate(() => [...document.querySelectorAll('.mc-tile video:not(.mc-self)')].map((v) => v.currentTime)); const a = await read(); await page.waitForTimeout(700); const b = await read(); return a.length > 0 && b.every((t, i) => t > a[i]); };
try {
  const owner = await seedOwner(server);
  browser = await chromium.launch({ headless: true, ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH } : {}),
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const ctx = await ownerContext(browser, server, owner), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push('owner: ' + e.message)); page.setDefaultTimeout(15000);
  await ctx.grantPermissions(['camera', 'microphone', 'clipboard-read', 'clipboard-write'], { origin: server.base });
  await page.goto(server.base + '/saas/workspace.html#b04/meetings');
  const view = page.locator('#meetings-view'); await view.getByRole('heading', { name: 'Call now' }).waitFor();
  assert.equal(await view.getByText('Provider setup required').count(), 0, 'the old request form is gone');
  await shot(page, 'meetings-page.png');
  for (const width of [390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Meetings page fits at ' + width); }
  await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
  const axe = (p, sel) => p.evaluate(async (s) => (await window.axe.run(document.querySelector(s), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html.slice(0, 140)) })), sel);
  assert.deepEqual(await axe(page, '#meetings-view'), []);

  // Owner starts a call; alone at first.
  await view.getByRole('button', { name: 'Start video call', exact: true }).click();
  const call = page.locator('#meeting-call-overlay'); await call.getByText('Only you are here').waitFor();
  await page.waitForFunction(() => { const v = document.querySelector('.mc-tile video.mc-self'); return v && v.videoWidth > 0; });
  await call.getByRole('button', { name: 'Copy guest link', exact: true }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(link, /\/saas\/meet\.html\?m=[0-9a-f-]{36}#t=[A-Za-z0-9_-]{32}$/);

  // A wrong link tells the visitor nothing about the meeting.
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await guestCtx.grantPermissions(['camera', 'microphone'], { origin: server.base });
  const stranger = await guestCtx.newPage(); await stranger.goto(link.replace(/#t=.{4}/, '#t=AAAA'));
  await stranger.getByText('This meeting link is not valid.', { exact: false }).waitFor();
  assert.equal(await stranger.locator('#guest-form').isVisible(), false); await stranger.close();

  // Guest one asks to join and waits; the owner lets them in.
  const g1 = await guestCtx.newPage(); g1.on('pageerror', (e) => errors.push('guest1: ' + e.message)); g1.setDefaultTimeout(15000);
  await g1.goto(link); await g1.getByLabel('Your name').fill('Sam Lee');
  assert.match(await g1.locator('#guest-status').innerText(), /Harbour Plumbing Pty Ltd invited you to a video call\./);
  await g1.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')); assert.deepEqual(await axe(g1, 'body'), []);
  await g1.getByRole('button', { name: 'Ask to join', exact: true }).click();
  await g1.getByText('Waiting for the business to let you in', { exact: false }).waitFor();
  assert.equal(await g1.locator('.mc-tile').count(), 0, 'no call before being let in');
  await call.getByText('1 guest is waiting').waitFor();
  await shot(page, 'meetings-waiting.png');
  await call.getByRole('button', { name: 'Let in Sam Lee', exact: true }).click();
  await call.getByText('2 people in this call').waitFor(); await g1.getByText('2 people in this call').waitFor();
  await mediaFlowing(page, 1); await mediaFlowing(g1, 1);
  assert.ok(await framesAdvance(page), 'owner sees moving picture from the guest');
  assert.ok(await framesAdvance(g1), 'guest sees moving picture from the owner');

  // Guest two is declined once, then let in: three people, everyone connected to everyone.
  const g2Ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await g2Ctx.grantPermissions(['camera', 'microphone'], { origin: server.base });
  const g2 = await g2Ctx.newPage(); g2.on('pageerror', (e) => errors.push('guest2: ' + e.message)); g2.setDefaultTimeout(15000);
  await g2.goto(link); await g2.getByLabel('Your name').fill('Jo Citizen'); await g2.getByRole('button', { name: 'Ask to join', exact: true }).click();
  await call.getByRole('button', { name: 'Decline Jo Citizen', exact: true }).click();
  await g2.getByText('The business did not let you in this time.').waitFor();
  await g2.getByRole('button', { name: 'Ask to join', exact: true }).click();
  await call.getByRole('button', { name: 'Let in Jo Citizen', exact: true }).click();
  for (const p of [page, g1, g2]) { await p.getByText('3 people in this call').waitFor(); await mediaFlowing(p, 2); }
  assert.ok(await framesAdvance(g2), 'the second guest sees both others');
  assert.ok(await framesAdvance(g1), 'the first guest sees both others');
  await shot(page, 'meetings-call-desktop.png'); await shot(g1, 'meetings-call-phone.png');

  // Controls: muting and turning the camera off are shown to the others in words.
  await g1.getByRole('button', { name: 'Mute microphone', exact: true }).click();
  await call.locator('.mc-tile', { hasText: 'Sam Lee' }).getByText('Muted').waitFor();
  await call.getByRole('button', { name: 'Turn camera off', exact: true }).click();
  await g2.locator('.mc-tile.mc-novideo', { hasText: 'Alex Morgan' }).waitFor();
  await call.getByRole('button', { name: 'Turn camera on', exact: true }).click();
  await g2.waitForFunction(() => ![...document.querySelectorAll('.mc-tile')].find((x) => x.textContent.includes('Alex Morgan')).classList.contains('mc-novideo'));
  for (const [p, width] of [[page, 390], [page, 1440]]) { await p.setViewportSize({ width, height: 800 }); for (const b of await call.locator('.mc-controls button').all()) assert.ok((await b.boundingBox()).height >= 44, 'touch target at ' + width); assert.ok(await p.evaluate(() => document.querySelector('.mc-root').scrollWidth <= innerWidth + 1), 'call screen fits at ' + width); }
  assert.deepEqual(await axe(page, '#meeting-call-overlay'), []);

  // A guest leaving is noticed; the organiser ending the meeting closes it for everyone and the link stops working.
  await g2.getByRole('button', { name: 'Leave call', exact: true }).click();
  await g2.getByText('You left the call.', { exact: false }).waitFor();
  await call.getByText('2 people in this call').waitFor();
  page.once('dialog', (d) => d.accept());
  await call.getByRole('button', { name: 'End for everyone', exact: true }).click();
  await g1.getByText('The organiser ended this meeting.', { exact: false }).waitFor();
  await view.getByText('The organiser ended this meeting.', { exact: false }).waitFor();
  assert.equal(await page.locator('#meeting-call-overlay').isVisible(), false);
  await view.getByText('Ended meetings (1)').waitFor();
  const late = await guestCtx.newPage(); await late.goto(link); await late.getByText('This meeting has ended.').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS Video meetings: start from workspace, guest link, waiting room, three-way picture and sound, mute and camera states, leave, end for everyone, three viewport sizes, accessibility.');
} finally { await browser?.close(); await server.stop(); }
