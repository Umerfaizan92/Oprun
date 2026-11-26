// MB-13: the AI Supervisor in the Founder Console (Operations → AI agents → Command center), in a real browser.
// Synthetic data only: one background job that gave up. Checks the status line, Check now, the finding,
// the daily summary, accessibility (axe) and no sideways scrolling at phone, tablet and laptop widths.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
const require = createRequire(import.meta.url);

const server = await startServer();
const browser = await chromium.launch({ headless: true, ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] } : {}) });
try {
  const page = await browser.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.base + '/saas/operator-sign-in.html');
  await page.locator('#operator-form input[name=key]').fill(server.adminKey);
  await Promise.all([page.waitForURL(server.base + '/office/'), page.locator('#operator-form button[type=submit]').click()]);
  await page.locator('#console-main').waitFor({ state: 'visible', timeout: 20000 });
  { const d = new Database(server.dbPath); const t = new Date(Date.now() - 3600000).toISOString();
    d.prepare("INSERT INTO background_jobs(id,type,payload_json,idempotency_key,status,attempts,max_attempts,run_at,last_error,created_at,updated_at) VALUES ('job-ui','email.send','{}','k-job-ui','dead',5,5,?,?,?,?)").run(t, 'SMTP 550 mailbox unavailable', t, t); d.close(); }
  await page.evaluate(() => { location.hash = 'f07/agents/center'; });
  const status = page.locator('[data-supervisor-status]'); await status.waitFor({ timeout: 15000 });
  assert.equal(await status.getAttribute('data-supervisor-status'), 'stopped'); assert.match(await status.innerText(), /needs attention.*not run yet/s);
  await page.getByRole('button', { name: 'Check now' }).click();
  await page.locator('[data-supervisor-status="running"]').waitFor({ timeout: 15000 });
  assert.match(await page.locator('[data-supervisor-status]').innerText(), /AI Supervisor is checking/);
  const tab = page.getByRole('tab', { name: /Supervisor findings \(1\)/ }); if (await tab.count()) await tab.click();
  const finding = page.locator('[data-finding]').first(); await finding.waitFor({ timeout: 10000 });
  assert.match(await finding.innerText(), /Background job "email\.send" gave up after 5 attempt.*SMTP 550/s);
  assert.match(await page.locator('[data-supervisor-daily]').innerText(), /^Daily summary \d{4}-\d{2}-\d{2}:/);
  await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no sideways scroll at ${width}px`);
    const v = await page.evaluate(async () => (await axe.run(document.querySelector('#console-content') || document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`));
    assert.deepEqual(v, [], `axe at ${width}px`);
  }
  if (process.env.UI_SCREENSHOT_DIR) { fs.mkdirSync(process.env.UI_SCREENSHOT_DIR, { recursive: true }); await page.setViewportSize({ width: 390, height: 900 }); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/f07-agents-center-390.png` }); }
  assert.deepEqual(errors, []);
  console.log('PASS AI Supervisor console: stopped state shown, Check now runs the checks, finding and daily summary shown, axe clean and no sideways scroll at 390, 768 and 1440 px.');
} finally { await browser.close(); await server.stop(); }
