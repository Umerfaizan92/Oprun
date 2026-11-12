// Founder Console density report (frontend transformation batch 3): heading height, where content starts and
// sideways scroll for every non-legacy founder page at 1440px and 390px. Usage: node scripts/report-console-density.mjs out.json
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
const routes = [...new Set([...readFileSync(new URL('../docs/navigation/MAPPING.md', import.meta.url), 'utf8').matchAll(/\| Founder \|[^|]*\|[^|]*\| [^|]*#(f0\d[^ |]*)/g)].map((m) => m[1]).filter((r) => !r.includes('legacy')))];
const s = await startServer(); const browser = await chromium.launch(); const out = {};
try {
  await seedOwner(s);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' }); const p = await ctx.newPage();
    await p.goto(s.base + '/saas/operator-sign-in.html'); await p.locator('#operator-form input[name=key]').fill(s.adminKey);
    await Promise.all([p.waitForURL(s.base + '/office/'), p.locator('#operator-form button[type=submit]').click()]);
    for (const r of routes) {
      await p.evaluate((h) => { location.hash = h; }, r); await p.waitForTimeout(500);
      out[viewport.width + ' ' + r] = await p.evaluate(() => {
        const c = document.querySelector('#console-content'); if (!c) return null;
        const h = c.querySelector('h1,h2'); const head = h?.closest('header,.cp-head,.page-heading,.console-head') || h;
        const first = [...c.querySelectorAll('table,.cp-grid,.cp-list,.cp-stat,form,article,section>div')].find((e) => e.offsetParent);
        return { head: head ? Math.round(head.getBoundingClientRect().height) : 0, h: h ? getComputedStyle(h).fontSize : '', content: first ? Math.round(first.getBoundingClientRect().top + scrollY) : 0, wide: document.documentElement.scrollWidth > innerWidth + 1 };
      });
    }
    await ctx.close();
  }
  writeFileSync(process.argv[2] || '/dev/stdout', JSON.stringify(out, null, 1));
} finally { await browser.close(); await s.stop(); }
