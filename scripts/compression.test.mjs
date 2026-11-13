// Batch-5 review (ChatGPT, REVIEW_CP117_T094 "Global compression"): response compression must not delay streamed voice,
// must keep no-store and Vary on authenticated data, must not double-encode precompressed assets, must serve plain
// bodies to clients without encoding support, and must not change error status or bodies.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'gemini-stream-mock.mjs');
const GAP = 1500;
let s, owner;
test.before(async () => {
  s = await startServer({ NODE_OPTIONS: `--import=${fixture}`, GEMINI_API_KEY: 'synthetic-test-key-not-real', GEMINI_MOCK_GAP_MS: String(GAP) });
  owner = await seedOwner(s);
});
test.after(async () => { await s?.stop(); });

// Raw request so nothing is decoded for us: we see the exact bytes and headers the browser would receive.
function raw(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(s.base + url);
    const req = http.request({ method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers: { origin: s.base, ...headers } }, (res) => {
      const chunks = []; const times = []; const start = Date.now();
      res.on('data', (c) => { chunks.push(c); times.push(Date.now() - start); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks), times }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
const decode = (r) => r.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(r.body) : r.headers['content-encoding'] === 'br' ? zlib.brotliDecompressSync(r.body) : r.body;

// Two guards keep the voice stream uncompressed: application/x-ndjson is not in the compressible list, and the route sends
// Cache-Control: no-transform. Verified 2026-11-13: removing both makes this test fail; removing either one alone does not.
test('streamed voice reaches the browser chunk by chunk, uncompressed, even when gzip is offered', async () => {
  const r = await raw('POST', '/api/product-guide/speech-stream', { headers: { 'content-type': 'application/json', 'accept-encoding': 'gzip, br' }, body: JSON.stringify({ text: 'Hello from Oprun' }) });
  assert.equal(r.status, 200, r.body.toString());
  assert.equal(r.headers['content-encoding'], undefined, 'no-transform stream must not be compressed');
  assert.match(r.headers['cache-control'], /no-store/);
  const lines = r.body.toString().trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.filter((l) => l.audio).length, 2); assert.deepEqual(lines.at(-1), { done: true });
  assert.ok(r.times.length >= 2, 'response arrived in more than one chunk');
  assert.ok(r.times[0] < GAP - 500, `first audio arrived at ${r.times[0]}ms, before the ${GAP}ms upstream gap ended`);
});

test('authenticated data stays no-store, varies on encoding and decodes to the same JSON', async () => {
  const url = '/api/saas/integrations/self-service';
  const gz = await raw('GET', url, { headers: { cookie: owner.cookie, 'accept-encoding': 'gzip' } });
  const plain = await raw('GET', url, { headers: { cookie: owner.cookie, 'accept-encoding': 'identity' } });
  assert.equal(gz.status, 200); assert.equal(plain.status, 200);
  assert.ok(gz.body.length > 0 && plain.body.length > 1024, 'payload large enough to be compressible');
  assert.equal(gz.headers['content-encoding'], 'gzip');
  assert.match(String(gz.headers.vary), /accept-encoding/i);
  assert.match(String(gz.headers['cache-control']), /no-store/, 'compression must not drop no-store on private data');
  assert.equal(plain.headers['content-encoding'], undefined, 'clients without gzip get a plain body');
  assert.deepEqual(JSON.parse(decode(gz)), JSON.parse(plain.body), 'same data either way');
});

test('precompressed assets are served once-encoded and decode to the real file', async () => {
  const br = await raw('GET', '/saas/ds/kit.css', { headers: { 'accept-encoding': 'br, gzip' } });
  const plain = await raw('GET', '/saas/ds/kit.css', { headers: { 'accept-encoding': 'identity' } });
  assert.equal(br.status, 200); assert.equal(plain.status, 200);
  assert.ok(['br', 'gzip'].includes(br.headers['content-encoding']), 'an encoded variant is served');
  assert.equal(String(br.headers['content-encoding']).split(',').length, 1, 'never double-encoded');
  assert.equal(decode(br).toString(), plain.body.toString(), 'one decode gives the exact stylesheet');
  assert.equal(plain.headers['content-encoding'], undefined);
});

test('errors keep their status and body when compressed', async () => {
  const url = '/api/saas/integrations/self-service';
  const gz = await raw('GET', url, { headers: { 'accept-encoding': 'gzip' } });
  const plain = await raw('GET', url, { headers: { 'accept-encoding': 'identity' } });
  assert.equal(gz.status, 401); assert.equal(plain.status, 401);
  assert.equal(decode(gz).toString(), plain.body.toString());
});
