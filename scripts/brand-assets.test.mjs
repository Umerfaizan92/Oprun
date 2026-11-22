// TR-13: every Oprun page shows the Oprun icon in the browser tab and on a phone home screen, the workspace can be
// installed from where people use it, and requests Oprun sends to other websites carry the Oprun name.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('every app page declares the Oprun tab and home-screen icons', () => {
  for (const f of fs.readdirSync('saas').filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync('saas/' + f, 'utf8');
    assert.match(html, /<link[^>]*rel="icon"[^>]*href="[^"]*oprun-icon\.svg"/, f + ': tab icon');
    assert.match(html, /<link[^>]*rel="apple-touch-icon"[^>]*href="[^"]*oprun-icon-192\.png"/, f + ': home-screen icon');
    assert.doesNotMatch(html, /<link[^>]*rel="[^"]*icon[^"]*"[^>]*superpro-icon/, f + ': no old icon');
  }
  assert.match(fs.readFileSync('saas/workspace.html', 'utf8'), /rel="manifest" href="\/saas\/manifest\.webmanifest"/);
  const manifest = JSON.parse(fs.readFileSync('saas/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.short_name, 'Oprun');
  for (const i of manifest.icons) assert.ok(fs.existsSync('saas/' + i.src.replace('/saas/', '')), i.src);
});

test('outbound website checks identify as Oprun', () => {
  for (const f of ['src/visibility.js', 'src/seo-cluster.js', 'src/server.js']) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /SuperPro(VisibilityCheck|AI-OfficeManager)/, f);
  }
});
