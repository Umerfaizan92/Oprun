// TR-72: page bundles keep the order and content of the files they replace; scripts that cannot be joined safely stay.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createAssetBundler, selfContained } from '../src/asset-bundles.js';

test('self-contained scripts are recognised; scripts with shared top-level names are not', () => {
  assert.equal(selfContained('(()=>{ window.a = 1; })();'), true);
  assert.equal(selfContained('// note\n(function (root) { root.b = 2; })(window);'), true);
  assert.equal(selfContained('window.OprunBrandIcons = {"map":{}};'), true);
  assert.equal(selfContained('const shared = 1; window.c = shared;'), false);
  assert.equal(selfContained('import { x } from "./y.js";'), false);
});

test('a page keeps its order: stylesheets join at the first one, deferred scripts join between barriers', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bundles-'));
  const w = (f, t) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); };
  w('p/a.css', '.a{background:url(img/a.png)}'); w('p/ds/b.css', '.b{background:url("../img/b.png")}'); w('p/print.css', '.p{}');
  w('p/one.js', '(()=>{window.order=(window.order||[]).concat(1)})();'); w('p/two.js', '(()=>{window.order.push(2); throw new Error("two fails")})();');
  w('p/three.js', '(()=>{window.order.push(3)})();'); w('p/app.js', 'const shared = 1; window.order.push("app");'); w('p/four.js', '(()=>{window.order.push(4)})();'); w('p/five.js', '(()=>{window.order.push(5)})();');
  w('p/page.html', '<html><head><link rel="stylesheet" href="a.css?v=1"><script src="sync.js"></script><link rel="stylesheet" href="ds/b.css"><link rel="stylesheet" media="print" href="print.css"></head><body>' +
    '<script defer src="one.js"></script><script defer src="two.js"></script><script defer src="three.js"></script><script defer src="app.js"></script><script defer src="four.js"></script><script defer src="five.js"></script></body></html>');
  w('p/sync.js', 'window.sync = 1;');
  const b = createAssetBundler({ root, log: { warn() {} } });
  const html = await b.transform('p/page.html');
  assert.equal((html.match(/rel="stylesheet"/g) || []).length, 2, 'one bundle plus the print stylesheet');
  assert.ok(html.indexOf('data-bundle="2 stylesheets"') < html.indexOf('sync.js'), 'the bundle sits where the first stylesheet was');
  assert.match(html, /media="print" href="print.css"/);
  assert.deepEqual([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1].replace(/\/saas\/__b\/\w+\.js/, 'BUNDLE')), ['sync.js', 'BUNDLE', 'app.js', 'BUNDLE']);
  const css = [...b.bundles.values()].find((x) => x.type === 'css').body;
  assert.match(css, /url\(\/p\/img\/a\.png\)/); assert.match(css, /url\("?\/p\/img\/b\.png"?\)/);
  // Run the scripts in page order: the failing file does not stop the files after it.
  const ctx = { window: {}, console: { error() {} } }; ctx.window.window = ctx.window; vm.createContext(ctx);
  const js = [...b.bundles.values()].filter((x) => x.type === 'js').map((x) => x.body);
  vm.runInContext(js[0], ctx); vm.runInContext('var order = window.order; ' + fs.readFileSync(path.join(root, 'p/app.js'), 'utf8').replace('window.order.push', 'order.push'), ctx); vm.runInContext(js[1], ctx);
  assert.equal(JSON.stringify(ctx.window.order), JSON.stringify([1, 2, 3, 'app', 4, 5]));
  const off = createAssetBundler({ root, enabled: false });
  let nextCalled = false; await off.page('p/page.html')({}, {}, () => { nextCalled = true; }); assert.equal(nextCalled, true, 'ASSET_BUNDLES=0 serves the page as written');
  fs.rmSync(root, { recursive: true, force: true });
});
