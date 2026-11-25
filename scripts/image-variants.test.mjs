// T-051: photos from the media library are served to websites as WebP copies at fixed widths, with a srcset.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { createImageVariants, responsiveAttrs, VARIANT_WIDTHS } from '../src/image-variants.js';
import { renderPage } from '../src/seo/builder.js';

test('a website photo becomes WebP at the asked width, with a srcset; originals stay; other businesses are refused (T-051)', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Harbour Plumbing Pty Ltd' });
  const other = await seedOwner(s, { business: 'Other Trades', email: 'other-img@other.example.test' });
  const jpeg = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: '#2a6f97' } }).jpeg({ quality: 90 }).toBuffer();
  const fd = new FormData(); fd.append('files', new Blob([jpeg], { type: 'image/jpeg' }), 'van.jpg');
  let r = await fetch(s.base + '/api/saas/media', { method: 'POST', headers: { origin: s.base, cookie: owner.cookie }, body: fd });
  assert.equal(r.status, 201, await r.text());
  const id = (await s.call('GET', '/api/saas/media', { cookie: owner.cookie })).json.media.find((m) => m.original_name === 'van.jpg').id;

  r = await s.call('POST', `/api/saas/media/${id}/site-link`, { cookie: owner.cookie, body: {} });
  assert.equal(r.status, 200, r.text); const url = r.json.url; assert.match(url, /^\/m\/[\w-]+\.[\w-]+$/);
  assert.equal((await s.call('POST', `/api/saas/media/${id}/site-link`, { cookie: other.cookie, body: {} })).status, 404, 'another business cannot link this photo');

  // Each allowed width gives a WebP no wider than asked; the original is unchanged and still served without ?w.
  const small = await fetch(s.base + url + '?w=640');
  assert.equal(small.status, 200); assert.equal(small.headers.get('content-type'), 'image/webp');
  const meta = await sharp(Buffer.from(await small.arrayBuffer())).metadata();
  assert.equal(meta.format, 'webp'); assert.equal(meta.width, 640);
  const orig = await fetch(s.base + url); assert.equal(orig.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.compare(Buffer.from(await orig.arrayBuffer()), jpeg), 0);
  const odd = await fetch(s.base + url + '?w=777'); assert.equal(odd.headers.get('content-type'), 'image/jpeg', 'other widths get the original');
  const big = await sharp(Buffer.from(await (await fetch(s.base + url + '?w=1920')).arrayBuffer())).metadata();
  assert.equal(big.width, 1920);

  // The website builder writes a srcset for library photos only.
  const html = renderPage({ title: 'Home', slug: 'home', blocks: [{ type: 'image', src: url, alt: 'Our van', width: 960, height: 576 }, { type: 'image', src: 'https://example.test/x.jpg', alt: 'Elsewhere' }] }, { site: { slug: 'harbour' } });
  assert.match(html, new RegExp(`src="${url.replace(/[.]/g, '\\.')}\\?w=960" srcset="[^"]*\\?w=320 320w[^"]*\\?w=1920 1920w" sizes=`));
  assert.match(html, /src="https:\/\/example\.test\/x\.jpg" alt="Elsewhere"/);

  // Deleting the photo removes its copies; the link then stops working.
  assert.equal((await s.call('DELETE', `/api/saas/media/${id}`, { cookie: owner.cookie })).status, 200);
  assert.equal(fs.readdirSync(path.join(s.temp, 'uploads', 'studio-variants', owner.org)).length, 0);
  assert.equal((await fetch(s.base + url + '?w=640')).status, 404);
});

test('without the image library the original is served; only library photo links get a srcset', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-img-'));
  const org = 'org-1', file = path.join(dir, 'studio', org, 'a.jpg'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, 'x');
  const v = createImageVariants({ uploadRoot: dir, log: { warn() {} }, loadSharp: () => Promise.reject(new Error('missing')) });
  assert.equal(await v.variant({ id: 'm1', organisation_id: org, stored_name: 'a.jpg', kind: 'photo', mime_type: 'image/jpeg' }, 640), null);
  assert.equal(await v.variant({ id: 'm1', organisation_id: org, stored_name: 'a.jpg', kind: 'video', mime_type: 'video/mp4' }, 640), null);
  assert.equal(responsiveAttrs('https://cdn.example.test/a.jpg'), null);
  assert.equal(responsiveAttrs('/m/abc.def?w=1'), null);
  assert.equal(responsiveAttrs('/m/abc.def').srcset.split(', ').length, VARIANT_WIDTHS.length);
  fs.rmSync(dir, { recursive: true, force: true });
});
