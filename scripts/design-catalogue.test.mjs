// TR-11: the design-system catalogue is generated from the workspace and must stay in step with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('design catalogue is up to date and loads exactly the workspace stylesheets', () => {
  execFileSync(process.execPath, ['scripts/build-design-catalogue.mjs', '--check'], { stdio: 'pipe' });
  const links = (f) => (fs.readFileSync(f, 'utf8').match(/<link\b[^>]*>/g) || []).filter((l) => /rel="stylesheet"/.test(l));
  assert.deepEqual(links('saas/design-system.html').sort(), links('saas/workspace.html').sort());
  const html = fs.readFileSync('saas/design-system.html', 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(html, /<script>(?!<\/script>)|\son[a-z]+="/, 'no inline scripts or handlers (CSP)');
  for (const id of ['colours', 'type', 'buttons', 'forms', 'status', 'cards', 'tabs', 'table', 'feedback']) assert.match(html, new RegExp(`id="${id}"`));
});

test('shared components have a style outside their pages', () => {
  const css = fs.readFileSync('saas/ds/retheme.css', 'utf8');
  for (const sel of ['button.link-button', 'button.danger-button', '.badge{', '.data-table{', '.table-scroll{']) assert.ok(css.includes(sel), sel);
  const tokens = fs.readFileSync('saas/ds/tokens.css', 'utf8');
  for (const n of [100, 200, 300, 400, 500, 600, 700, 800]) assert.match(tokens, new RegExp(`--sp-gold-${n}:#[0-9A-F]{6}`));
});
