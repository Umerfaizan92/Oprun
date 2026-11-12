// Signed-in Business Workspace load report (frontend transformation batch 5): requests, bytes, render-blocking CSS
// and scripts, LCP and CLS on a throttled phone profile. Usage: node scripts/report-workspace-perf.mjs
import { chromium } from 'playwright';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';
const server = await startServer(); const browser = await chromium.launch();
try {
  const owner = await seedOwner(server);
  for (const [label, viewport, throttle] of [['phone-4g', { width: 390, height: 844 }, true], ['desktop', { width: 1440, height: 900 }, false]]) {
    const ctx = await ownerContext(browser, server, owner, { viewport }); const page = await ctx.newPage();
    if (throttle) { const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    const reqs = []; page.on('requestfinished', async (r) => { const s = await r.sizes().catch(() => null); reqs.push({ url: r.url(), type: r.resourceType(), bytes: s ? s.responseBodySize + s.responseHeadersSize : 0 }); });
    await page.addInitScript(() => { window.__lcp = 0; window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    const t0 = Date.now(); await page.goto(server.base + '/saas/workspace.html#today/home', { waitUntil: 'load' }); const load = Date.now() - t0;
    await page.waitForTimeout(3000);
    const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3), blockingCss: document.querySelectorAll('head link[rel=stylesheet]:not([media=print])').length, syncScripts: [...document.scripts].filter((s) => s.src && !s.defer && !s.async && s.type !== 'module').length, deferScripts: [...document.scripts].filter((s) => s.src && (s.defer || s.async)).length }));
    const by = (t) => reqs.filter((r) => r.type === t); const kb = (a) => Math.round(a.reduce((x, r) => x + r.bytes, 0) / 1024);
    console.log(JSON.stringify({ label, loadMs: load, ...m, requests: reqs.length, kb: kb(reqs), css: [by('stylesheet').length, kb(by('stylesheet'))], js: [by('script').length, kb(by('script'))], api: by('fetch').length + by('xhr').length, top: reqs.sort((a, b) => b.bytes - a.bytes).slice(0, 6).map((r) => r.url.replace(server.base, '') + ' ' + Math.round(r.bytes / 1024) + 'KB') }));
    await ctx.close();
  }
} finally { await browser.close(); await server.stop(); }
