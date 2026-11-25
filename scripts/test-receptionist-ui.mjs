// R-15/R-16/R-18: the live AI receptionist steps in the AI Receptionist section, in a real browser, with the service
// switched on for this synthetic workspace only. No provider or production account is contacted.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';
const require = createRequire(import.meta.url);
const server = await startServer({ RECEPTIONIST_ENABLED: '1' }); let browser;
try {
  const owner = await seedOwner(server, { business: 'Browser Plumbing' });
  { const d = new Database(server.dbPath); d.prepare("INSERT INTO onboarding_profiles (organisation_id,business_type,services,updated_at) VALUES (?,?,?,?) ON CONFLICT(organisation_id) DO UPDATE SET business_type=excluded.business_type,services=excluded.services").run(owner.org, 'Plumber', JSON.stringify(['Blocked drains']), new Date().toISOString()); d.close(); }
  browser = await chromium.launch({ headless: true, ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] } : {}) });
  const ctx = await ownerContext(browser, server, owner), page = await ctx.newPage(), errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(15000);
  await page.goto(server.base + '/saas/workspace.html#communications/receptionist');
  const view = page.locator('#receptionist-view'); await view.waitFor({ state: 'visible' });
  await view.locator('[data-rx-step="6"]').click();
  const know = view.locator('.rx-knowledge'); await know.getByText('Nothing approved yet', { exact: false }).waitFor();
  await know.getByRole('button', { name: 'Build from my records' }).click();
  await know.getByText('Draft version 1', { exact: false }).waitFor();
  await know.getByLabel('Questions and answers').fill('Do you work weekends?\nSaturday mornings only.');
  await know.getByRole('button', { name: 'Save answers' }).click();
  await view.locator('[data-rx-status]').getByText('Answers saved', { exact: false }).waitFor();
  await view.locator('[data-rx-step="6"]').click();
  await view.locator('.rx-knowledge').getByRole('button', { name: 'Approve what it knows' }).click();
  await view.locator('[data-rx-status]').getByText('Approved', { exact: false }).waitFor();
  // Booking rules.
  await view.locator('[data-rx-step="7"]').click();
  await view.getByLabel('Hours callers can book').fill('Mon-Fri 07:00-17:00\nSat 08:00-12:00');
  await view.getByLabel('Bookable services').fill('Blocked drain, 60, 120');
  await view.getByLabel('Service area').fill('Joondalup, 6027');
  await view.getByRole('button', { name: 'Save booking rules' }).click();
  await view.locator('[data-rx-status]').getByText('Booking rules saved', { exact: false }).waitFor();
  // Approvals and transfers; then go live is refused honestly without a number.
  await view.locator('[data-rx-step="8"]').click();
  await view.getByLabel('What can go out without you checking').selectOption('auto_confirmations');
  await view.getByLabel('Transfer list').fill('Sam, +61400555666');
  await view.getByRole('button', { name: 'Save approvals' }).click();
  await view.locator('[data-rx-status]').getByText('Saved', { exact: false }).waitFor();
  await view.locator('[data-rx-step="8"]').click();
  assert.match(await view.getByLabel('Transfer list').inputValue(), /Sam, •••666/, 'numbers are masked');
  await view.locator('[data-rx-step="9"]').click();
  await view.locator('.rx-step').filter({ has: page.getByRole('heading', { name: 'Go live' }) }).getByRole('button', { name: 'Go live' }).click();
  await view.locator('[data-rx-status]').getByText('an active phone number', { exact: false }).waitFor();
  const d = new Database(server.dbPath);
  const cfg = d.prepare('SELECT approval_level,booking_rules_json,status,knowledge_revision FROM receptionist_config WHERE organisation_id=?').get(owner.org); d.close();
  assert.equal(cfg.approval_level, 'auto_confirmations'); assert.equal(JSON.parse(cfg.booking_rules_json).services[0].price_from_cents, 12000); assert.equal(cfg.status, 'draft'); assert.equal(cfg.knowledge_revision, 1);
  { const d2 = new Database(server.dbPath); const h = JSON.parse(d2.prepare('SELECT hours_json FROM receptionist_config WHERE organisation_id=?').get(owner.org).hours_json); d2.close(); assert.deepEqual(h.fri, [['07:00', '17:00']]); assert.deepEqual(h.sun, []); }
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no sideways scroll at ${width}px`);
  }
  await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
  const violations = await page.evaluate(async () => (await axe.run(document.querySelector('#receptionist-view'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => v.id));
  assert.deepEqual(violations, []);
  assert.deepEqual(errors, []);
  console.log('PASS AI receptionist live steps: build, answer and approve knowledge, booking rules, approvals with masked numbers, honest go-live refusal, three widths, accessibility.');
} finally { await browser?.close(); await server.stop(); }
