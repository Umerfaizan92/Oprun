// MB-12: one brand library. Tokens, the app manifest, every page's icons and theme colour, and platform emails all
// match src/brand.js; retired icon names redirect to the library.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BRAND } from '../src/brand.js';
import { platformBrand, renderEmail } from '../src/email-templates.js';
import { startServer } from './test-server.mjs';

const file = (url) => url.replace(/^\/saas\//, 'saas/');
const pages = ['saas', 'saas/site', 'office'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`));
const libraryNames = new Set(Object.values(BRAND.assets).flat().map((u) => u.split('/').pop()));

test('design tokens (dark theme) equal the brand colours', () => {
  const css = fs.readFileSync('saas/ds/tokens.css', 'utf8');
  const first = (name) => (css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1]?.toUpperCase();
  assert.equal(first('sp-gold'), BRAND.colors.gold); assert.equal(first('sp-midnight'), BRAND.colors.midnight);
  assert.equal(first('sp-on-gold'), BRAND.colors.onGold); assert.equal(first('sp-gold-600'), BRAND.colors.goldDeep);
});

test('every library file exists and no retired copy is left in the site folder', () => {
  for (const u of Object.values(BRAND.assets).flat()) assert.ok(fs.existsSync(file(u)), u);
  assert.deepEqual(fs.readdirSync('saas').filter((f) => /superpro/i.test(f)), []);
});

test('the installed app uses the Oprun AI name, brand colours and library icons', () => {
  const m = JSON.parse(fs.readFileSync('saas/manifest.webmanifest', 'utf8'));
  assert.equal(m.name, BRAND.name); assert.equal(m.short_name, BRAND.shortName);
  assert.equal(m.theme_color, BRAND.colors.midnight); assert.equal(m.background_color, BRAND.colors.midnight);
  for (const i of m.icons) assert.ok(libraryNames.has(i.src.split('/').pop()), `manifest icon ${i.src}`);
});

test('every page uses library icons and the brand theme colour', () => {
  for (const p of pages) {
    const html = fs.readFileSync(p, 'utf8');
    for (const tag of html.match(/<link[^>]+rel="(?:icon|shortcut icon|apple-touch-icon|mask-icon)"[^>]*>/g) || []) {
      const href = (tag.match(/href="([^"]+)"/) || [])[1] || '';
      assert.ok(libraryNames.has(href.split('?')[0].split('/').pop()), `${p}: ${tag}`);
    }
    for (const tag of html.match(/<meta name="theme-color"[^>]*>/g) || []) assert.match(tag, new RegExp(`content="${BRAND.colors.midnight}"`, 'i'), `${p}: ${tag}`);
  }
});

test('platform emails use the brand gold', () => {
  const b = platformBrand({ PUBLIC_BASE_URL: 'https://www.oprun.ai' });
  assert.equal(b.color, BRAND.colors.gold);
  const r = renderEmail(b, { heading: 'Your code', paragraphs: ['Use this code to finish signing up.'], verification: { label: 'Code', code: '123456', expires: 'Expires in 10 minutes.' } });
  assert.match(String(r.html || r), new RegExp(BRAND.colors.gold, 'i'));
});

test('retired icon addresses redirect permanently to the library', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  for (const [from, to] of Object.entries(BRAND.retired)) {
    const r = await fetch(s.base + from, { redirect: 'manual' });
    assert.equal(r.status, 301, from); assert.equal(r.headers.get('location'), to);
    assert.equal((await fetch(s.base + to)).status, 200, to);
  }
});
