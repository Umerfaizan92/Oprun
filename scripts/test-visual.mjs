// TR-70 visual baseline: every final page at phone (390), tablet (768) and laptop (1440) widths, in the dark and the
// light theme. Pages come from the same sources as the navigation map, so a new page is covered automatically:
//   public   the public website, sign-in and create-account pages;
//   business every Business Workspace page in the menu (pages merged into another page are covered by that page);
//   founder  every Operator Console page and tab (docs/navigation/MAPPING.json).
// Each screen (the first two screens of the page) is compared with its baseline; up to 0.6% of pixels may differ
// (font antialiasing, 1 px sub-pixel shifts). Sideways scrolling and browser errors also fail. Runs against a throwaway local server with
// synthetic data; never touches production. Baselines live in qa/visual/baseline (not in git: about 40 MB of PNG).
// On every pull request CI builds the baseline from the target branch and compares the pull request with it
// (.github/workflows/visual.yml), so baselines never go stale and are stored with each run as an artifact.
//   npm run test:visual                         compare every page (both themes) with the baselines
//   npm run test:visual:update                  accept the current screens as the new baselines
//   --group=public|business|founder             one group only (CI runs the three in parallel)
//   --themes=dark | --themes=light              one theme only
//   --only=<text>                               pages whose name contains <text> (or "portals" for business + founder)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const QA = path.join(ROOT, 'qa', 'visual');
const DIRS = { baseline: path.join(QA, 'baseline'), current: path.join(QA, 'current'), diff: path.join(QA, 'diff') };
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const UPDATE = process.argv.includes('--update');
const ONLY = arg('only'), GROUP = arg('group'), THEMES = (arg('themes') || 'dark,light').split(',').filter((t) => ['dark', 'light'].includes(t));
const WIDTHS = [[390, 844], [768, 1024], [1440, 900]];
const MAX_HEIGHT = 1800;          // the first two screens: layout, colour and type changes show here; keeps baselines small
const TOLERANCE = 0.006;          // up to 0.6% of pixels may differ (font antialiasing, a 1 px sub-pixel shift of a long list)
const FIXED_TIME = new Date('2026-10-28T10:00:00+08:00');

const PUBLIC = [
  ['home', '/'], ['features', '/features'], ['feature-money', '/features/money'], ['industries', '/for'], ['industry-trades', '/for/trades'],
  ['pricing', '/pricing'], ['receptionist', '/receptionist'], ['stories', '/stories'], ['help', '/help'], ['contact', '/contact'],
  ['legacy-landing', '/saas/index.html'], ['sign-in', '/saas/sign-in.html'], ['create-account', '/saas/create-account.html']
].map(([name, url]) => ({ group: 'public', name, url }));
const mapping = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'navigation', 'MAPPING.json'), 'utf8'));
const safe = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
const BUSINESS = mapping.business.flatMap((g) => g.items).filter((i) => !i.merged && !i.href)
  .map((i) => ({ group: 'business', name: safe(i.path), hash: i.path, ready: `#${i.view}-view` }));
const FOUNDER = mapping.founder.flatMap((g) => g[4].map((p) => ({ group: 'founder', name: safe(`${g[0]}-${p[0]}`), hash: `${g[0]}/${p[0]}` })));
const PAGES = [...PUBLIC, ...BUSINESS, ...FOUNDER]
  .filter((p) => !GROUP || p.group === GROUP)
  .filter((p) => !ONLY || (ONLY === 'portals' ? p.group !== 'public' : p.name.includes(ONLY)));

// Things that change by themselves (clocks, relative times, live counters) are hidden from the comparison.
const MASK = ['[data-year]', 'time', '.gx-clock', '[data-live-value]', '.sp-typing', '.toast', '.sp-toast', '[data-relative-time]', '#workspace-clock', '.live-clock', '.notification-badge', '.record-id'];

for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });
for (const f of fs.readdirSync(DIRS.diff)) fs.rmSync(path.join(DIRS.diff, f));

const server = await startServer({ API_RATE_LIMIT_TEST: '50000' }); // hundreds of pages from one address
const browser = await chromium.launch(process.env.UI_CHROMIUM_PATH ? { executablePath: process.env.UI_CHROMIUM_PATH } : {});
const results = [];
const themeScript = (theme) => { try { localStorage.setItem('foai-theme', theme); } catch { /* storage off */ } };

async function contextFor(group, viewport, theme, owner) {
  const options = { viewport, reducedMotion: 'reduce', colorScheme: theme, deviceScaleFactor: 1, serviceWorkers: 'block' };
  let ctx;
  if (group === 'business') ctx = await ownerContext(browser, server, owner, options);
  else ctx = await browser.newContext(options);
  await ctx.addInitScript(themeScript, theme);
  await ctx.addInitScript((slug) => { try { localStorage.setItem('gds-tour-' + slug, 'done'); } catch { /* */ } const get = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return /^superpro_release_seen:/.test(String(k)) ? '1' : get.call(this, k); }; }, owner.slug);
  await ctx.clock?.setFixedTime(FIXED_TIME);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  if (group === 'business') { await page.goto(server.base + '/saas/workspace.html', { waitUntil: 'load' }); await page.locator('#workspace').waitFor({ state: 'visible', timeout: 20000 }); }
  if (group === 'founder') {
    await page.goto(server.base + '/saas/operator-sign-in.html');
    await page.locator('#operator-form input[name=key]').fill(server.adminKey);
    await Promise.all([page.waitForURL(server.base + '/office/'), page.locator('#operator-form button[type=submit]').click()]);
    await page.locator('#console-main').waitFor({ state: 'visible', timeout: 20000 });
  }
  return { ctx, page, errors };
}

async function settle(page, spec, theme) {
  if (spec.url) await page.goto(server.base + spec.url, { waitUntil: 'load' });
  else { await page.evaluate((h) => { location.hash = h; }, spec.hash); if (spec.ready) await page.locator(spec.ready).waitFor({ state: 'visible', timeout: 15000 }); }
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.view:not([hidden]) [aria-busy="true"], #console-pages [aria-busy="true"]'), null, { timeout: 4000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready);
  // One-time notices and toasts are closed so the screen underneath is what gets compared; the theme is enforced.
  await page.evaluate((t) => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); document.documentElement.dataset.theme = t; document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in')); scrollTo(0, 0); }, theme);
  const v = page.viewportSize(); await page.mouse.move(Math.round(v.width * 0.75), Math.round(v.height / 2));
  await page.waitForTimeout(450);
}

async function overflow(page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth, scroll = document.documentElement.scrollWidth, culprits = [];
    if (scroll > w + 1) for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width && r.right > w + 1 && cs.position !== 'fixed' && !el.closest('[aria-hidden="true"],.sr-only,.sp-sr')) { culprits.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''} right=${Math.round(r.right)}`); if (culprits.length >= 5) break; }
    }
    return { scroll, width: w, culprits };
  });
}

function compare(name, buffer) {
  const basePath = path.join(DIRS.baseline, name + '.png');
  fs.writeFileSync(path.join(DIRS.current, name + '.png'), buffer);
  if (UPDATE || !fs.existsSync(basePath)) { fs.writeFileSync(basePath, buffer); return { status: UPDATE ? 'updated' : 'new', ratio: 0 }; }
  const a = PNG.sync.read(fs.readFileSync(basePath)), b = PNG.sync.read(buffer);
  if (a.width !== b.width || a.height !== b.height) return { status: 'changed', ratio: 1, note: `size ${a.width}x${a.height} → ${b.width}x${b.height}` };
  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.12, includeAA: false });
  const ratio = pixels / (a.width * a.height);
  if (ratio > TOLERANCE) { fs.writeFileSync(path.join(DIRS.diff, name + '.png'), PNG.sync.write(diff)); return { status: 'changed', ratio }; }
  return { status: 'same', ratio };
}

const started = Date.now();
try {
  const owner = await seedOwner(server);
  const groups = [...new Set(PAGES.map((p) => p.group))];
  for (const group of groups) for (const theme of THEMES) for (const [width, height] of WIDTHS) {
    // One browser session per group, theme and width; pages are opened in turn, as a person would.
    let session = null;
    for (const spec of PAGES.filter((p) => p.group === group)) {
      const name = `${group}-${spec.name}-${width}-${theme}`;
      try {
        session ||= await contextFor(group, { width, height }, theme, owner);
        const { page, errors } = session; errors.length = 0;
        await settle(page, spec, theme);
        // A page that could not load its data is not a valid screen (for example a rate limit).
        if (await page.evaluate(() => /\((429|5\d\d)\)/.test(document.querySelector('.view:not([hidden]), #console-pages, main')?.innerText || ''))) errors.push('the page shows a server error');
        const of = await overflow(page);
        const shot = async () => { const full = await page.evaluate(() => document.documentElement.scrollHeight); return page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width, height: Math.min(full, MAX_HEIGHT) }, animations: 'disabled', caret: 'hide', mask: MASK.map((s) => page.locator(s)), maskColor: '#2A3550' }); };
        // Wait until the page stops moving: two screenshots in a row must match (late requests, fonts, counters).
        let buf = await shot();
        for (let i = 0; i < 4; i++) { await page.waitForTimeout(500); const next = await shot(); if (next.equals(buf)) break; buf = next; }
        let cmp = compare(name, buf);
        // A page still finishing a late request can differ by a few pixels; it is looked at once more before it counts.
        if (cmp.status === 'changed') { await page.waitForTimeout(1200); const again = compare(name, await shot()); cmp = again.status === 'same' ? { ...again, settled_late: true } : again; }
        results.push({ name, group, page: spec.url || '#' + spec.hash, width, theme, ...cmp, sidewaysScroll: of.scroll > of.width + 1, overflow: of.culprits, errors: [...errors] });
      } catch (e) {
        results.push({ name, group, page: spec.url || '#' + spec.hash, width, theme, status: 'error', ratio: 1, note: e.message.split('\n')[0], sidewaysScroll: false, overflow: [], errors: [] });
        await session?.ctx.close().catch(() => {}); session = null; // a fresh session for the next page
      }
    }
    await session?.ctx.close();
  }
} finally {
  await browser.close();
  await server.stop();
}

const failed = results.filter((r) => r.status === 'changed' || r.status === 'error' || r.sidewaysScroll || r.errors.length);
fs.mkdirSync(path.join(ROOT, 'qa', 'reports'), { recursive: true });
const report = path.join(ROOT, 'qa', 'reports', `visual-regression${GROUP ? '-' + GROUP : ONLY === 'portals' ? '-portals' : ''}.json`);
fs.writeFileSync(report, JSON.stringify({ widths: WIDTHS.map(([w]) => w), themes: THEMES, tolerance: TOLERANCE, pages: PAGES.length, screens: results.length, seconds: Math.round((Date.now() - started) / 1000), results }, null, 2) + '\n');
for (const r of results) if (r.status !== 'same' || r.sidewaysScroll || r.errors.length) {
  const flag = r.status === 'error' ? 'ERROR' : r.sidewaysScroll ? 'OVERFLOW' : r.errors.length ? 'JS-ERROR' : r.status.toUpperCase();
  console.log(`${flag.padEnd(9)} ${r.name.padEnd(48)} ${(r.ratio * 100).toFixed(3)}%${r.note ? '  ' + r.note : ''}${r.overflow.length ? '  ' + r.overflow.join(', ') : ''}${r.errors.length ? '  ' + r.errors.join(' | ') : ''}`);
}
console.log(`${PAGES.length} pages × ${WIDTHS.length} widths × ${THEMES.length} themes = ${results.length} screens in ${Math.round((Date.now() - started) / 1000)} s, ${failed.length} problem(s). Diffs (if any) in qa/visual/diff/.`);
process.exit(failed.length ? 1 : 0);
