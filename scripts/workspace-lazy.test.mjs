// TR-72: page scripts load on first open. Checks the page markup, the loader's page table and the server bundles agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createAssetBundler } from '../src/asset-bundles.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(ROOT, 'saas/workspace.html'), 'utf8');
const lazyTags = [...html.matchAll(/<script\b[^>]*type="oprun\/lazy"[^>]*><\/script>/g)].map((m) => ({ group: m[0].match(/data-lazy="([^"]+)"/)?.[1], src: m[0].match(/src="([^"]+)"/)?.[1] }));

function loaderTable() {
  const win = {}, fake = lazyTags.map((t) => ({ dataset: { lazy: t.group }, getAttribute: () => t.src }));
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'saas/workspace-lazy.js'), 'utf8'), { window: win, document: { querySelectorAll: () => fake }, Promise, Set, Map });
  return win.OprunLazy;
}
function navViews() {
  const win = { addEventListener() {}, location: { hash: '' } };
  const doc = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], documentElement: { dataset: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'saas/workspace-nav.js'), 'utf8'), { window: win, document: doc, location: win.location, localStorage: { getItem: () => null, setItem() {} }, console });
  return new Set(win.SuperProNav.DOMAINS.flatMap((d) => d.items.map((i) => i.view)));
}

test('every lazy page script names a known group, exists and is not also loaded at start', () => {
  const lazy = loaderTable();
  assert.ok(lazyTags.length >= 30, 'page scripts are marked to load on open');
  for (const t of lazyTags) {
    assert.ok(t.group && lazy.GROUP_VIEWS[t.group], `${t.src}: group ${t.group} is in the loader table`);
    const file = path.join(ROOT, 'saas', t.src.split('?')[0]);
    assert.ok(fs.existsSync(file), `${t.src} exists`);
    const name = path.basename(file);
    assert.equal([...html.matchAll(new RegExp(`src="${name.replace('.', '\\.')}[?"]`, 'g'))].length, 1, `${name} appears once in the page`);
  }
  for (const g of Object.keys(lazy.GROUP_VIEWS)) assert.ok(lazyTags.some((t) => t.group === g), `group ${g} has scripts`);
  assert.ok(html.indexOf('workspace-lazy.js') < html.indexOf('src="app.js'), 'the loader runs before app.js');
});

test('the loader table only names real pages; the Command Centre needs no page scripts; unmapped pages load all', () => {
  const lazy = loaderTable(), views = navViews();
  for (const [g, list] of Object.entries(lazy.GROUP_VIEWS)) for (const v of list) assert.ok(views.has(v), `${g}: ${v} is a workspace page`);
  assert.equal(JSON.stringify(lazy.groupsFor('dashboard')), '[]');
  assert.equal(JSON.stringify(lazy.groupsFor('enquiries')), '["pipeline"]');
  assert.equal(JSON.stringify([...lazy.groupsFor('a-page-nobody-mapped')].sort()), JSON.stringify([...new Set(lazyTags.map((t) => t.group))].sort()), 'an unmapped page loads every group');
});

test('the server joins each page group into one file and leaves start-up scripts as they were', async () => {
  const b = createAssetBundler({ root: ROOT, enabled: true, production: false, log: {} });
  const out = await b.transform('saas/workspace.html');
  const groups = [...out.matchAll(/<script\b[^>]*type="oprun\/lazy"[^>]*>/g)].map((m) => m[0].match(/data-lazy="([^"]+)"/)[1]);
  assert.equal(groups.length, new Set(groups).size, 'one tag per group after bundling');
  assert.deepEqual(new Set(groups), new Set(lazyTags.map((t) => t.group)));
  for (const m of out.matchAll(/<script\b[^>]*type="oprun\/lazy"[^>]*src="([^"]+)"/g)) if (m[1].startsWith('/saas/__b/')) assert.ok(b.bundles.has(m[1].split('/').pop()), 'bundle is served');
  assert.ok(!/<script defer src="(?:workspace-seo-platform|workspace-pipeline)\.js/.test(out), 'page scripts do not run at start');
});
