// MB-23: measured simplicity of every Business Workspace page (docs/navigation/MAPPING.json, owner role, synthetic
// data) at 390 px and 1440 px. Per page: height, gold primary actions visible in the first screen and on the page,
// top-level sections, where the first content starts, and tip/recommendation panels that cannot be dismissed.
// Usage: node scripts/report-workspace-simplicity.mjs [out.json]   (default qa/reports/workspace-simplicity.json)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';

const mapping = JSON.parse(fs.readFileSync(new URL('../docs/navigation/MAPPING.json', import.meta.url), 'utf8'));
const routes = mapping.business.flatMap((g) => g.items.map((i) => ({ group: g.label, label: i.label, path: i.path })));
const out = process.argv[2] || 'qa/reports/workspace-simplicity.json';
const server = await startServer(); const owner = await seedOwner(server);
const browser = await chromium.launch({ headless: true, ...(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] } : {}) });
const rows = [];
try {
  for (const width of [390, 1440]) {
    const ctx = await ownerContext(browser, server, owner, { viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(server.base + '/saas/workspace.html#today/home'); await page.waitForTimeout(2500);
    for (const r of routes) {
      await page.evaluate((h) => { location.hash = h; scrollTo(0, 0); }, r.path); await page.waitForTimeout(1200);
      const m = await page.evaluate(() => {
        const view = [...document.querySelectorAll('.view')].find((v) => !v.hidden && v.offsetParent) || document.querySelector('main') || document.body;
        const visible = (e) => { const b = e.getBoundingClientRect(); return e.offsetParent && b.width > 0 && b.height > 0; };
        const gold = (e) => { const c = getComputedStyle(e).backgroundImage + ' ' + getComputedStyle(e).backgroundColor; return [...c.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g)].some((m) => +m[1] > 190 && +m[2] > 140 && +m[2] < 215 && +m[3] < 130 && (m[4] === undefined || +m[4] >= 0.6)); }; // solid gold only (a faint tint is not a primary action)
        const actions = [...view.querySelectorAll('button,a,[role=button]')].filter((e) => visible(e) && gold(e));
        const top = view.getBoundingClientRect().top + scrollY;
        const sections = [...view.querySelectorAll('h2')].filter(visible).length;
        const first = [...view.querySelectorAll('table,form,ul,ol,article,.card,[class*=card],[class*=list],[class*=grid]')].find((e) => visible(e) && e.getBoundingClientRect().height > 40);
        const tips = [...view.querySelectorAll('[class*=tip],[class*=recommend],[class*=suggest],[class*=insight],[class*=hint]')].filter((e) => visible(e) && e.getBoundingClientRect().height > 30 && !e.querySelector('button[aria-label*="ismiss" i],button[aria-label*="lose" i],[data-dismiss]'));
        return { height: Math.round(view.scrollHeight), primary_first_screen: actions.filter((e) => e.getBoundingClientRect().top < innerHeight).length, primary_total: actions.length,
          primary_labels: [...new Set(actions.map((e) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)))].slice(0, 6), sections, content_starts: first ? Math.round(first.getBoundingClientRect().top + scrollY - top) : null, undismissable_tips: tips.length,
          sideways: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      rows.push({ width, ...r, ...m });
    }
    await ctx.close();
  }
} finally { await browser.close(); await server.stop(); }
fs.mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), rows }, null, 2));
const phone = rows.filter((r) => r.width === 390);
const score = (r) => (r.primary_first_screen > 1 ? 2 : 0) + (r.primary_total > 3 ? 1 : 0) + (r.sections > 6 ? 1 : 0) + (r.height > 6000 ? 1 : 0) + (r.content_starts > 600 ? 1 : 0) + (r.undismissable_tips ? 1 : 0) + (r.sideways ? 3 : 0);
const ranked = phone.map((r) => ({ ...r, score: score(r) })).sort((a, b) => b.score - a.score);
console.log(`pages ${phone.length}; with issues ${ranked.filter((r) => r.score).length}`);
for (const r of ranked.slice(0, 25)) console.log(`${String(r.score).padStart(2)} ${r.path.padEnd(28)} h=${r.height} gold1st=${r.primary_first_screen} gold=${r.primary_total} sec=${r.sections} start=${r.content_starts} tips=${r.undismissable_tips}${r.sideways ? ' SIDEWAYS' : ''} [${r.primary_labels.join(' | ')}]`);
