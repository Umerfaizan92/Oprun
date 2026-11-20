// T-188: the Phone page as a real phone in a real browser. Dial -> keypad disappears -> "Calling…", "Ringing…",
// then a running timer; mute, keypad tones, hold, record (after a consent prompt) and hang up; the call and its
// recording appear in Recents. Telnyx's call server cannot be reached from the test machine, so the browser SDK is
// replaced by a stand-in that moves through Telnyx's real call states; the Oprun server and its Telnyx calls are real
// against a local Telnyx stand-in.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';
const require = createRequire(import.meta.url);
const shot = async (page, name) => { if (process.env.UI_SCREENSHOT_DIR) { fs.mkdirSync(process.env.UI_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, name) }); } };
const NUM = '+61862891786';
const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
    const body = b ? JSON.parse(b) : null, p = req.url.replace(/^\/telnyx/, '');
    const ok = (data) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ data })); };
    if (p.startsWith('/phone_numbers?')) return ok([{ id: 'pn-1', phone_number: NUM }]);
    if (p === '/ai/assistants') return ok({ id: 'assistant-11111111-2222-3333-4444-555555555555' });
    if (p === '/call_control_applications') return ok({ id: 'app-1' });
    if (p === '/call_control_applications/app-1') return ok({ id: 'app-1', outbound: req.method === 'PATCH' ? body.outbound : { outbound_voice_profile_id: 'ovp-1' } });
    if (p === '/phone_numbers/pn-1') return ok({ id: 'pn-1' });
    if (p.startsWith('/outbound_voice_profiles?')) return ok([{ id: 'ovp-1', name: 'Oprun outbound calls' }]);
    if (p === '/credential_connections') return ok({ id: 'cc-1' });
    if (p === '/telephony_credentials') return ok({ id: 'cred-1' });
    if (p === '/telephony_credentials/cred-1/token') { res.writeHead(201, { 'content-type': 'text/plain' }); return res.end('aaa.bbb.ccc'); }
    res.writeHead(404); res.end('{}');
  });
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const server = await startServer({ TELNYX_API_BASE_URL: `http://127.0.0.1:${mock.address().port}/telnyx` }); let browser;
try {
  const owner = await seedOwner(server, { business: 'Fleet Parlour' });
  const r = await server.call('POST', '/api/saas/receptionist/telnyx/connect', { cookie: owner.cookie, body: { api_key: 'KEY0123456789ABCDEF_tenant_secret_ui', public_key: Buffer.alloc(32, 9).toString('base64'), number: NUM } });
  assert.equal(r.status, 200, r.text);
  browser = await chromium.launch({ headless: true, ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH } : {}), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await ownerContext(browser, server, owner), page = await ctx.newPage(), errors = [];
  await ctx.grantPermissions(['microphone'], { origin: server.base });
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(15000);
  // Stand-in for the Telnyx browser SDK: same API names and call states.
  await ctx.addInitScript(() => {
    const tone = () => { const a = new AudioContext(), o = a.createOscillator(), d = a.createMediaStreamDestination(); o.connect(d); o.start(); return d.stream; };
    class Call {
      constructor(c, opts) { this.c = c; this.opts = opts; this.state = 'new'; this.tones = ''; this.muted = false; this.localStream = tone(); this.remoteStream = tone(); window.__call = this; setTimeout(() => this.go('trying'), 50); setTimeout(() => this.go('early'), 300); setTimeout(() => this.go('active'), 1500); }
      go(s) { this.state = s; this.c.emit('telnyx.notification', { type: 'callUpdate', call: this }); }
      toggleAudioMute() { this.muted = !this.muted; } toggleHold() { this.go(this.state === 'held' ? 'active' : 'held'); }
      dtmf(k) { this.tones += k; } hangup() { this.cause = 'NORMAL_CLEARING'; this.go('hangup'); }
    }
    window.TelnyxWebRTC = { TelnyxRTC: class { constructor(o) { this.o = o; this.h = {}; window.__login = o.login_token; } on(e, f) { (this.h[e] ||= []).push(f); } emit(e, x) { (this.h[e] || []).forEach((f) => f(x)); } connect() { setTimeout(() => this.emit('telnyx.ready'), 30); } disconnect() {} newCall(o) { window.__dialled = o; return new Call(this, o); } } };
  });
  await page.goto(server.base + '/saas/workspace.html#communications/phone');
  const view = page.locator('#dialer-view');
  await view.getByText('Calls go straight from here to the number you dial.').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await view.getByLabel('Phone number').fill('0488669601');
  await view.getByRole('button', { name: 'Call', exact: true }).click();
  // The keypad is replaced by the call screen, and the call goes to the number dialled, from the business number.
  await view.getByText('Ringing…').waitFor();
  assert.equal(await view.locator('.ph-keypad').isVisible(), false, 'keypad hidden during the call');
  assert.deepEqual(await page.evaluate(() => [window.__dialled.destinationNumber, window.__dialled.callerNumber, window.__login]), ['+61488669601', NUM, 'aaa.bbb.ccc']);
  await shot(page, 'webphone-ringing.png');
  await view.locator('.ph-cs-state', { hasText: /^0:0\d$/ }).waitFor();
  // Controls.
  await view.getByRole('button', { name: 'Mute' }).click();
  assert.equal(await view.getByRole('button', { name: 'Mute' }).getAttribute('aria-pressed'), 'true'); assert.equal(await page.evaluate(() => window.__call.muted), true);
  await view.getByRole('button', { name: 'Keypad' }).click();
  await view.getByRole('group', { name: 'Send keypad tones' }).getByRole('button', { name: '5', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__call.tones), '5');
  await view.getByRole('button', { name: 'Hold' }).click(); await view.getByText('On hold').waitFor();
  await view.getByRole('button', { name: 'Resume' }).click(); await view.locator('.ph-cs-state', { hasText: /^0:\d\d$/ }).waitFor();
  page.once('dialog', (d) => { assert.match(d.message(), /tell the other person/); d.accept(); });
  await view.getByRole('button', { name: 'Record' }).click();
  await view.locator('.ph-cs-rec', { hasText: 'Recording' }).waitFor();
  await shot(page, 'webphone-live.png');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'call screen fits the phone');
  await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
  const v = await page.evaluate(async () => (await window.axe.run(document.querySelector('.ph-callscreen'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.filter((x) => ['critical', 'serious'].includes(x.impact)).map((x) => x.id));
  assert.deepEqual(v, []);
  await page.waitForTimeout(1200);
  await view.getByRole('button', { name: 'End call' }).click();
  await view.getByText(/Call ended · 0:\d\d/).waitFor();
  // Back to Recents with the call and its recording.
  await view.locator('#dialer-panel-recents:not([hidden])').waitFor();
  const row = view.locator('.ph-row').first();
  await row.getByText(/Outgoing · answered/).waitFor();
  await row.locator('audio.ph-rec-play').waitFor();
  await view.getByText('Call recording saved. Find it in Recents.').waitFor();
  await shot(page, 'webphone-recents.png');
  // Desktop fits too.
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(errors, []);
  console.log('Web phone UI: dial, ringing, timer, mute, tones, hold, record with consent, hang up, Recents and recording passed.');
} finally { await browser?.close(); await server.stop(); mock.close(); }
