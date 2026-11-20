// T-172: one adaptive system. New CSS may only use the three agreed widths (700, 1024, 1440) plus the
// legacy widths already in the code on 21 Nov 2026 (listed in qa/breakpoints-legacy.json). Legacy widths are
// removed as pages move to ds/layout.css; this test fails if a new width appears.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED = [700, 1024, 1440];
const root = new URL('../saas/', import.meta.url).pathname;
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.css$/.test(f.name)) files.push(p); } })(root);
const used = new Map();
for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/(?:max|min)-width\s*:\s*(\d+(?:\.\d+)?)px/g)) { const v = Number(m[1]); if (!used.has(v)) used.set(v, new Set()); used.get(v).add(path.relative(root, f)); }

test('CSS uses only the agreed breakpoints or already-listed legacy ones', () => {
  const legacy = JSON.parse(fs.readFileSync(new URL('../qa/breakpoints-legacy.json', import.meta.url), 'utf8')).widths;
  const unknown = [...used.keys()].filter((w) => !ALLOWED.includes(w) && !legacy.includes(w)).map((w) => `${w}px in ${[...used.get(w)].join(', ')}`);
  assert.deepEqual(unknown, [], 'use 700, 1024 or 1440 (or a container query) instead');
});

test('the platform script and adaptive layout are on every app page, before the first paint', () => {
  for (const f of fs.readdirSync(root).filter((x) => x.endsWith('.html'))) {
    const s = fs.readFileSync(path.join(root, f), 'utf8');
    assert.match(s, /<head><script src="ds\/platform\.js\?v=[\d.]+"><\/script>/, f + ' loads ds/platform.js first');
    assert.match(s, /<link rel="stylesheet" href="ds\/layout\.css\?v=[\d.]+"><\/head>/, f + ' loads ds/layout.css last');
  }
});
