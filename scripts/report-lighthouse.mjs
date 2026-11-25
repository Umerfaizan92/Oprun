// TR-72: Lighthouse (mobile, default simulated throttling) on the main pages of the public site, the Business
// Workspace and the Operator Console, plus a first-load budget for the workspace. Runs against a throwaway local test
// server with synthetic data; production is never touched. Writes qa/reports/lighthouse.json and LIGHTHOUSE.md.
// Lighthouse is not a project dependency (it pulls in packages with open advisories); install it in a tools folder:
//   npm i --prefix ~/.cache/oprun-lighthouse lighthouse@12 chrome-launcher puppeteer-core
//   LIGHTHOUSE_HOME=~/.cache/oprun-lighthouse npm run report:lighthouse
// Exits 1 when a main page scores under 85 for performance or the workspace misses its first-load budget.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { seedSampleBusiness } from './visual/sample-data.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const HOME = process.env.LIGHTHOUSE_HOME || path.join(os.homedir(), '.cache', 'oprun-lighthouse');
const req = createRequire(path.join(HOME, 'package.json'));
let lighthouse, chromeLauncher, puppeteer;
try { lighthouse = (await import(pathToFileURL(req.resolve('lighthouse')).href)).default; chromeLauncher = await import(pathToFileURL(req.resolve('chrome-launcher')).href); puppeteer = (await import(pathToFileURL(req.resolve('puppeteer-core')).href)).default; }
catch { console.error(`Lighthouse is not installed in ${HOME}. Run: npm i --prefix ${HOME} lighthouse@12 chrome-launcher puppeteer-core`); process.exit(2); }

const SCORE_MIN = 85;
// Workspace first load on a mid-range phone (Lighthouse mobile simulation): what the owner waits for before working.
const WORKSPACE_BUDGET = { lcp_ms: 2500, tbt_ms: 200, cls: 0.1, transfer_kb: 900, requests: 90 };
const PAGES = [
  ['public', 'Home', '/'], ['public', 'Pricing', '/pricing'], ['public', 'Features', '/features'], ['public', 'AI Receptionist', '/receptionist'], ['public', 'Contact', '/contact'],
  ['public', 'Sign in', '/saas/sign-in.html'], ['public', 'Create account', '/saas/create-account.html'],
  ['workspace', 'Command Centre', '/saas/workspace.html#today/home'], ['workspace', 'Enquiries', '/saas/workspace.html#work/enquiries'], ['workspace', 'Unified Inbox', '/saas/workspace.html#communications/inbox'],
  ['workspace', 'Money', '/saas/workspace.html#money/ledger'], ['workspace', 'Website', '/saas/workspace.html#website/home'],
  ['console', 'Operator Console', '/office/']
];

const server = await startServer({ API_RATE_LIMIT_TEST: '100000' });
const chrome = await chromeLauncher.launch({ chromePath: process.env.UI_CHROMIUM_PATH || undefined, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
const results = [];
try {
  const owner = await seedOwner(server);
  await seedSampleBusiness(server, owner);
  // Operator session through the real sign-in (the admin key is generated for this test server only).
  // The console keeps its operator token in the tab's sessionStorage, so it is placed there before each load.
  const opToken = (await (await fetch(server.base + '/api/operator/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: server.base }, body: JSON.stringify({ key: server.adminKey }) })).json()).token;
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
  // LH_ONLY=<area or page name>[,…] measures a subset for quick checks; the report files are then left unchanged.
  const only = (process.env.LH_ONLY || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  // Workspace pages are measured twice: a returning visit (the daily case: the owner has already seen the first-run
  // tour and the product-update note on this device, so local storage is kept; Lighthouse still clears the HTTP
  // cache) and a first visit on a new device (storage cleared, so the tour opens). The target applies to the
  // returning visit; first-visit numbers are reported beside it.
  const LIST = PAGES.flatMap((p) => p[0] === 'workspace' ? [p, ['workspace-first', p[1] + ' (first visit)', p[2]]] : [p]);
  async function warmUp() { // one real visit: the owner skips the tour and closes the update note, as a person would
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ Cookie: owner.cookie });
    await page.goto(server.base + '/saas/workspace.html#today/home', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.GDS_SESSION?.organisation, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 4000));
    await page.evaluate(() => { document.querySelector('[data-tour-skip]')?.click(); localStorage.setItem('gds-tour-' + window.GDS_SESSION.organisation.slug, 'done'); });
    // The update note waits in line behind the tour (modal-queue.js), so it opens after the tour closes.
    const note = await page.waitForSelector('[data-release-ok]', { visible: true, timeout: 8000 }).catch(() => null);
    if (note) await note.click();
    const seen = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('superpro_release_seen:')));
    await page.close();
    if (!seen) console.warn('warm-up: no product-update note was shown, so none was dismissed');
  }
  for (const [area, name, url] of LIST.filter(([a, n]) => !only.length || only.includes(a) || only.includes(a.split('-')[0]) || only.includes(n.toLowerCase()) || only.includes(n.toLowerCase().replace(' (first visit)', '')))) {
    const cookie = area.startsWith('workspace') ? owner.cookie : '';
    if (area === 'workspace') await warmUp(); // again for each page: the first-visit runs clear local storage
    const runs = [];
    for (let i = 0; i < 2; i++) { // best of two cold loads, like the lab report
      const page = await browser.newPage();
      if (area === 'console') { await page.evaluateOnNewDocument((t) => { try { sessionStorage.setItem('fp-admin-key', t); } catch { /* */ } }, opToken); const cdp = await page.createCDPSession(); await cdp.send('Network.clearBrowserCache'); } // storage is kept for the token, so the cache is cleared by hand: a cold load
      const r = await lighthouse(server.base + url, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], formFactor: 'mobile', screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }, extraHeaders: cookie ? { Cookie: cookie } : undefined, disableStorageReset: area === 'console', clearStorageTypes: ['file_systems', 'shader_cache', 'service_workers', 'cache_storage', ...(area === 'workspace-first' ? ['local_storage', 'indexeddb'] : [])] }, undefined, page);
      await page.close();
      const lhr = r.lhr, a = lhr.audits;
      runs.push({ performance: Math.round((lhr.categories.performance.score || 0) * 100), accessibility: Math.round((lhr.categories.accessibility.score || 0) * 100), best_practices: Math.round((lhr.categories['best-practices'].score || 0) * 100), seo: Math.round((lhr.categories.seo.score || 0) * 100),
        fcp_ms: Math.round(a['first-contentful-paint'].numericValue), lcp_ms: Math.round(a['largest-contentful-paint'].numericValue), tbt_ms: Math.round(a['total-blocking-time'].numericValue), cls: +a['cumulative-layout-shift'].numericValue.toFixed(3), si_ms: Math.round(a['speed-index'].numericValue), tti_ms: Math.round(a['interactive']?.numericValue || 0), lcp_node: (a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.nodeLabel || '').slice(0, 60),
        transfer_kb: Math.round(a['total-byte-weight'].numericValue / 1024), requests: a['network-requests']?.details?.items?.length || 0, final_url: lhr.finalDisplayedUrl,
        bootup: (a['bootup-time']?.details?.items || []).slice(0, 8).map((x) => `${String(x.url).replace(server.base, '')} ${Math.round(x.scripting)}ms`),
        lcp_element: JSON.stringify(a['largest-contentful-paint-element']?.details?.items || []).slice(0, 900),
        blocking: (a['render-blocking-resources']?.details?.items || []).map((x) => `${String(x.url).replace(server.base, '')} ${Math.round(x.wastedMs)}ms ${Math.round(x.totalBytes / 1024)}KB`),
        net_top: (a['network-requests']?.details?.items || []).sort((x, y) => (y.transferSize || 0) - (x.transferSize || 0)).slice(0, 12).map((x) => `${String(x.url).replace(server.base, '').slice(0, 60)} ${Math.round((x.transferSize || 0) / 1024)}KB/${Math.round((x.resourceSize || 0) / 1024)}KB`),
        long_tasks: (a['long-tasks']?.details?.items || []).slice(0, 10).map((x) => `${String(x.url).replace(server.base, '').split('?')[0]}@${Math.round(x.startTime)} ${Math.round(x.duration)}ms`),
        main_thread: (a['mainthread-work-breakdown']?.details?.items || []).map((x) => `${x.group} ${Math.round(x.duration)}ms`),
        opportunities: Object.values(a).filter((x) => x.details?.type === 'opportunity' && (x.details.overallSavingsMs || 0) >= 150).sort((p, q) => q.details.overallSavingsMs - p.details.overallSavingsMs).slice(0, 3).map((x) => `${x.title} (~${Math.round(x.details.overallSavingsMs)} ms)`) });
    }
    const best = runs.sort((p, q) => q.performance - p.performance)[0];
    results.push({ area, name, url, ...best });
    console.log(`${String(best.performance).padStart(3)}  ${area.padEnd(9)} ${name.padEnd(18)} LCP ${best.lcp_ms} ms  TTI ${best.tti_ms} ms  TBT ${best.tbt_ms} ms  CLS ${best.cls}  ${best.transfer_kb} KB  ${best.requests} req${best.final_url.includes('sign-in') && area !== 'public' ? '  (REDIRECTED TO SIGN-IN)' : ''}`);
    if (process.env.LH_DEBUG) console.log('   main thread: ' + best.main_thread.join(', ') + '\n   scripts: ' + best.bootup.join(', ') + '\n   long tasks: ' + best.long_tasks.join(', ') + '\n   network: ' + best.net_top.join(', ') + '\n   blocking: ' + best.blocking.join(', ') + '\n   lcp: ' + best.lcp_element);
  }
  await browser.disconnect();
} finally { await chrome.kill(); await server.stop(); }

const failures = [];
for (const r of results) {
  if (r.area === 'workspace-first') continue; // reported beside the returning visit, see above
  if (r.performance < SCORE_MIN) failures.push(`${r.name}: performance ${r.performance} < ${SCORE_MIN}`);
  if (r.area !== 'public' && /sign-in/.test(r.final_url)) failures.push(`${r.name}: not signed in, measured the sign-in page instead`);
  if (r.area === 'workspace') for (const [k, max] of Object.entries(WORKSPACE_BUDGET)) if (r[k] > max) failures.push(`${r.name}: ${k} ${r[k]} over budget ${max}`);
}
if (process.env.LH_ONLY) { console.log(failures.length ? `SUBSET: ${failures.join(' | ')}` : 'SUBSET PASSED'); process.exit(failures.length ? 1 : 0); }
const OUT = path.join(ROOT, 'qa', 'reports'); fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'lighthouse.json'), JSON.stringify({ generated_at: new Date().toISOString(), tool: 'Lighthouse 12, mobile preset, simulated throttling, best of two cold loads, local test server', score_min: SCORE_MIN, workspace_budget: WORKSPACE_BUDGET, results, failures }, null, 2) + '\n');
let md = `# Lighthouse report (TR-72)\n\nGenerated by \`npm run report:lighthouse\` on ${new Date().toISOString().slice(0, 10)} against a local test server with synthetic data (production not touched). Lighthouse 12, mobile preset with simulated throttling (slow 4G, 4x CPU), best of two cold loads. Lab numbers, not field data; a hosted server adds network time.\n\nTarget: performance ≥ ${SCORE_MIN} on every main page. Workspace pages are measured as a returning visit (the owner has already seen the first-run tour and the product-update note on this device, so local storage is kept; Lighthouse still clears the HTTP cache before each load) and, in the rows marked "first visit", as a first visit on a new device (all storage cleared, so the tour opens). The target and budget apply to the returning visit; first-visit rows are reported, not judged. Workspace first-load budget: LCP ≤ ${WORKSPACE_BUDGET.lcp_ms} ms, total blocking time ≤ ${WORKSPACE_BUDGET.tbt_ms} ms, CLS ≤ ${WORKSPACE_BUDGET.cls}, transfer ≤ ${WORKSPACE_BUDGET.transfer_kb} KB, requests ≤ ${WORKSPACE_BUDGET.requests}.\n\n| Area | Page | Perf | A11y | Best pr. | SEO | FCP ms | LCP ms | Ready (TTI) ms | TBT ms | CLS | Transfer KB | Requests | Largest paint |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const r of results) md += `| ${r.area} | ${r.name} | ${r.performance} | ${r.accessibility} | ${r.best_practices} | ${r.seo} | ${r.fcp_ms} | ${r.lcp_ms} | ${r.tti_ms} | ${r.tbt_ms} | ${r.cls} | ${r.transfer_kb} | ${r.requests} | ${String(r.lcp_node).replace(/\|/g, '/')} |\n`;
md += `\n## Result\n\n${failures.length ? failures.map((f) => `- ${f}`).join('\n') : '- Every main page meets the target and the workspace is within its first-load budget.'}\n`;
const opps = results.filter((r) => r.opportunities.length);
if (opps.length) md += `\n## Largest remaining opportunities\n\n${opps.map((r) => `- ${r.name}: ${r.opportunities.join('; ')}`).join('\n')}\n`;
fs.writeFileSync(path.join(OUT, 'LIGHTHOUSE.md'), md);
console.log(failures.length ? `FAILED: ${failures.join(' | ')}` : 'LIGHTHOUSE PASSED: every main page ≥ ' + SCORE_MIN + ' and the workspace is within budget.');
process.exit(failures.length ? 1 : 0);
