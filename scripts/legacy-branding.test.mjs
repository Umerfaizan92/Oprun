// MB-11: customer-visible text and identifiers use Oprun AI, never the old product names.
// Internal names kept for compatibility (sp- tokens, X-SuperPro header, _superpro DNS records) are not checked here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from './test-server.mjs';

const pages = fs.readdirSync('saas').filter((f) => f.endsWith('.html')).map((f) => `saas/${f}`).concat(fs.readdirSync('saas/site').filter((f) => f.endsWith('.html')).map((f) => `saas/site/${f}`));
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');

test('no public or workspace page shows an old product name', () => {
  for (const p of pages) {
    const text = visible(fs.readFileSync(p, 'utf8'));
    for (const bad of [/AI Office Manager/, /Super ?Pro/i, /Fleet Parlour/i, /Office AI\b/]) assert.doesNotMatch(text, bad, `${p} shows ${bad}`);
  }
});

test('the crawler and the health check name Oprun AI', async (t) => {
  assert.match(fs.readFileSync('src/seo/audit.js', 'utf8'), /const UA = 'OprunSEOAudit\/1\.0 \(\+https:\/\/oprun\.ai\/saas\/answers\.html\)'/);
  const s = await startServer(); t.after(() => s.stop());
  const r = await (await fetch(`${s.base}/healthz`)).json();
  assert.equal(r.ok, true); assert.equal(r.service, 'oprun-ai');
  assert.equal((await fetch(`${s.base}/saas/answers.html`)).status, 200, 'the crawler page it names exists');
});
