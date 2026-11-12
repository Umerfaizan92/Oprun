// Founder Console sweep (frontend transformation batch 1): every console page renders for the founder at laptop and
// phone width with no browser errors, no failing /api/operator calls, no raw "[object Object]"/"undefined" text,
// a visible loading-finished state and no sideways scrolling. Legacy maintenance links are opened by their own tests.
//   npm run test:console-all
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const routes = [...new Set([...readFileSync(new URL('../docs/navigation/MAPPING.md', import.meta.url), 'utf8').matchAll(/\| Founder \|[^|]*\|[^|]*\| [^|]*#(f0\d[^ |]*)/g)].map((m) => m[1]).filter((r) => !r.includes('legacy')))];
assert.ok(routes.length >= 25, `founder routes found: ${routes.length}`);
const s = await startServer();
const browser = await chromium.launch();
const problems = [];
try {
  await seedOwner(s);
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    let current = '';
    p.on('pageerror', (e) => problems.push(`${width} ${current} pageerror ${e.message}`));
    p.on('response', (r) => { if (/\/api\/operator\//.test(r.url()) && r.status() >= 400) problems.push(`${width} ${current} ${r.status()} ${new URL(r.url()).pathname}`); });
    await p.goto(s.base + '/saas/operator-sign-in.html');
    await p.locator('#operator-form input[name=key]').fill(s.adminKey);
    await Promise.all([p.waitForURL(s.base + '/office/'), p.locator('#operator-form button[type=submit]').click()]);
    for (const route of routes) {
      current = route;
      await p.evaluate((h) => { location.hash = h; }, route);
      await p.waitForTimeout(400);
      await p.waitForFunction(() => !/Loading/i.test(document.querySelector('#console-content')?.innerText?.slice(0, 200) || ''), null, { timeout: 8000 }).catch(() => problems.push(`${width} ${route} still loading after 8s`));
      const info = await p.evaluate(() => ({ text: document.querySelector('#console-content')?.innerText || '', wide: document.documentElement.scrollWidth > innerWidth + 1 }));
      if (!info.text.trim()) problems.push(`${width} ${route} empty page`);
      if (/\[object Object\]|\bundefined\b|\bNaN\b/.test(info.text)) problems.push(`${width} ${route} raw value: ${(info.text.match(/.{0,40}(\[object Object\]|\bundefined\b|\bNaN\b).{0,40}/) || [''])[0].replace(/\s+/g, ' ')}`);
      if (info.wide) problems.push(`${width} ${route} sideways scroll`);
    }
    await ctx.close();
  }
  if (problems.length) console.log(problems.join('\n'));
  assert.deepEqual(problems, []);
  console.log(`CONSOLE SWEEP PASSED: ${routes.length} founder pages at 1440px and 390px`);
} finally { await browser.close(); await s.stop(); }
