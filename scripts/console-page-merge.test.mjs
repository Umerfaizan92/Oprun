// TR-33: crowded console groups merged into tabbed pages. Page count recorded; every address kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../office/console.js', import.meta.url), 'utf8');
const c = {};
vm.runInNewContext(src.slice(src.indexOf('  const definitions ='), src.indexOf('  const paths =')).replace('const definitions =', 'globalThis.definitions ='), c);
const groups = Object.fromEntries(c.definitions.map((g) => [g[0], g]));
const menu = (g) => g[4].filter((t) => !t[2]).length;

test('crowded groups now have at most four menu pages', () => {
  assert.equal(menu(groups.f05), 3, 'Oprun team');
  assert.equal(menu(groups.f06), 3, 'Oprun marketing');
  assert.equal(menu(groups.f07), 4, 'Operations & maintenance');
  for (const g of c.definitions) assert.ok(menu(g) <= 5, `${g[2]} has ${menu(g)} menu pages`);
  assert.equal(c.definitions.flatMap((g) => g[4]).length, 40, 'no page removed');
  assert.equal(c.definitions.flatMap((g) => g[4]).filter((t) => !t[2]).length, 30, 'menu pages recorded in docs/navigation/PAGE_COUNT.md');
  assert.match(readFileSync(new URL('../docs/navigation/PAGE_COUNT.md', import.meta.url), 'utf8'), /\| All founder groups \| 40 \| 30 \|/);
});

test('every earlier address still exists, and every tab points at a main page in its own group', () => {
  const before = { f05: ['team/people', 'team/structure', 'team/assignments', 'records:project', 'records:staff_task', 'records:hire'],
    f06: ['records:prospect', 'records:campaign', 'records:content', 'records:announcement_draft', 'legacy:searchvisibility', 'platform/seo', 'platform/campaigns'],
    f07: ['records:task', 'records:incident', 'records:cost', 'legacy:connections', 'platform/automation', 'platform/reliability', 'platform/localization'] };
  for (const [g, routes] of Object.entries(before)) for (const r of routes) assert.ok(groups[g][4].some((t) => t[0] === r), `${g}/${r} still opens`);
  for (const g of c.definitions) for (const t of g[4]) if (t[2]) {
    const main = g[4].find((x) => x[0] === t[2]);
    assert.ok(main, `${g[0]}/${t[0]} main page exists`);
    assert.ok(!main[2], 'no tabs inside tabs');
  }
  // Links built elsewhere still resolve.
  for (const href of ['f07/records:incident', 'f04/records:ticket', 'f05/team/assignments', 'f01/system', 'f03/invoices', 'f02/subscribers'])
    assert.ok(groups[href.slice(0, 3)][4].some((t) => t[0] === href.slice(4)), href);
});
