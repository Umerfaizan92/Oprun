// TR-11: builds saas/design-system.html, the reference page of every shared component, from the workspace's own
// stylesheet list and icon sprite, so the catalogue always looks exactly like the app. Not linked from the app and
// marked noindex. Run `node scripts/build-design-catalogue.mjs` (or with --check to fail when it is out of date).
import fs from 'node:fs';

const ws = fs.readFileSync('saas/workspace.html', 'utf8');
const links = (ws.match(/<link\b[^>]*>/g) || []).filter((l) => /rel="stylesheet"/.test(l));
const platform = (ws.match(/<script src="ds\/platform\.js[^"]*"><\/script>/) || [''])[0];
const sprite = (ws.match(/<svg aria-hidden="true" class="icon-sprite"[\s\S]*?<\/svg>/) || [''])[0];

const GOLD = [100, 200, 300, 400, 500, 600, 700, 800];
const swatch = (v, label) => `<div class="dsc-swatch"><span style="background:var(${v})"></span><b>${label}</b><code>${v}</code></div>`;
const section = (id, title, body, note = '') => `<section class="panel dsc-section" id="${id}" aria-labelledby="${id}-h"><h2 id="${id}-h">${title}</h2>${note ? `<p class="dsc-note">${note}</p>` : ''}${body}</section>`;
const tile = `<button class="gx-tile gx-gold" type="button" aria-label="Waiting for a reply: 3 conversations"><div class="gx-tile-head"><span class="gx-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 6l8 7 8-7"></path></svg></span><span class="gx-label">Waiting for a reply</span></div><div class="gx-main"><div class="gx-figure"><strong class="gx-num">3</strong><em>conversations</em></div><svg viewBox="0 0 120 36" class="gx-spark" aria-hidden="true" preserveAspectRatio="none"><path d="M0 30 L20 26 L40 28 L60 18 L80 20 L100 10 L120 12 L120 36 L0 36 Z" class="gx-spark-fill"></path><path d="M0 30 L20 26 L40 28 L60 18 L80 20 L100 10 L120 12" class="gx-spark-line"></path></svg></div><span class="gx-sub">2 new today</span></button>`;

const body = [
  section('colours', 'Colours', `<h3>Gold scale (one source: <code>saas/ds/tokens.css</code>)</h3><div class="dsc-grid">${GOLD.map((n) => swatch(`--sp-gold-${n}`, `Gold ${n}`)).join('')}</div>
<h3>Actions and meaning (change with the theme)</h3><div class="dsc-grid">${[['--sp-gold', 'Action'], ['--sp-gold-hover', 'Action hover'], ['--sp-gold-soft', 'Action soft'], ['--sp-cyan', 'Live / AI'], ['--sp-good', 'Good'], ['--sp-warn', 'Warning'], ['--sp-bad', 'Problem'], ['--sp-focus', 'Focus ring']].map(([v, l]) => swatch(v, l)).join('')}</div>
<h3>Surfaces and text</h3><div class="dsc-grid">${[['--sp-midnight', 'Page'], ['--sp-graphite-1', 'Surface 1'], ['--sp-graphite-2', 'Surface 2'], ['--sp-graphite-3', 'Surface 3'], ['--sp-line', 'Line'], ['--sp-fg', 'Text'], ['--sp-fg-2', 'Text 2'], ['--sp-fg-muted', 'Muted text']].map(([v, l]) => swatch(v, l)).join('')}</div>
<h3>Contrast (measured live for the current theme; AA needs 4.5 for text)</h3><table class="dsc-table" id="dsc-contrast"><thead><tr><th>Text</th><th>On</th><th>Ratio</th><th>AA</th></tr></thead><tbody></tbody></table>`),
  section('type', 'Typography', `<p class="kicker">KICKER LABEL</p><h1 class="dsc-h1">Page title</h1><h2>Section heading</h2><h3>Card heading</h3><p>Body text in Manrope. Short sentences, plain words.</p><p class="muted">Secondary text for hints and timestamps.</p><p><small>Small print</small></p>`),
  section('buttons', 'Buttons', `<div class="dsc-row"><button class="primary-button" type="button">Primary</button><button class="secondary-button" type="button">Secondary</button><button class="primary-button compact" type="button">Primary compact</button><button class="secondary-button compact" type="button">Secondary compact</button><button class="link-button" type="button">Link button</button><button class="danger-button" type="button">Delete</button><button class="primary-button" type="button" disabled>Disabled</button></div>
<h3>Duplicate set to merge (TR-20)</h3><div class="dsc-row"><button class="portal-button primary" type="button">portal-button primary</button><button class="portal-button" type="button">portal-button</button></div>`, 'Standard: <code>primary-button</code>, <code>secondary-button</code>, <code>link-button</code>, <code>danger-button</code>, with <code>compact</code> for tight spaces. <code>portal-button</code> (220 uses) does the same job and will be merged into the standard set.'),
  section('forms', 'Forms', `<form class="form-grid" data-dsc-noop><label><span>Business name</span><input value="Harbour Plumbing"></label><label><span>Service</span><select><option>Blocked drains</option><option>Hot water</option></select></label><label class="full"><span>Notes</span><textarea rows="3">Customer prefers mornings.</textarea></label><label class="cx-check"><input type="checkbox" checked> <span>Send me a copy</span></label><label><span>Email (with an error)</span><input aria-invalid="true" value="not-an-email"><small class="dsc-error">Enter a valid email address.</small></label></form>`),
  section('status', 'Status and labels', `<div class="dsc-row"><span class="status-pill neutral">Neutral</span><span class="status-pill ok">Ready</span><span class="status-pill warn">Needs attention</span><span class="status-pill bad">Failed</span><span class="badge">Badge</span></div>`),
  section('cards', 'Cards', `<div class="dsc-grid dsc-grid-wide">${tile}<article class="row-card"><header><div><b>Quote Q-1042</b><small>Blocked drain · Fremantle</small></div><span class="status-pill warn">Waiting</span></header><p>Sent 2 days ago. Reminder due tomorrow.</p></article><div class="empty-state"><b>No enquiries yet</b><span>New enquiries appear here.</span></div></div>`, 'Stat card (<code>gx-tile</code>), list card (<code>row-card</code>) and empty state (<code>empty-state</code>). Panels (<code>panel</code>) wrap every section on this page.'),
  section('tabs', 'Tabs and switches', `<div class="context-section-tabs" role="tablist" aria-label="Example tabs" data-managed-sections="1" data-section-keyboard="1"><button type="button" role="tab" aria-selected="true">Overview</button><button type="button" role="tab" aria-selected="false" tabindex="-1">Details</button><button type="button" role="tab" aria-selected="false" tabindex="-1">History</button></div><div class="aiv-seg" role="radiogroup" aria-label="Example switch"><button type="button" role="radio" aria-checked="true">Vertical 9:16</button><button type="button" role="radio" aria-checked="false">Wide 16:9</button></div>`, 'Page tabs (<code>context-section-tabs</code>, one tool per tab; the bottom dock on phones) and the segmented switch (<code>aiv-seg</code>).'),
  section('table', 'Table', `<div class="table-scroll"><table class="data-table"><thead><tr><th>Customer</th><th>Job</th><th>Status</th><th class="num">Amount</th></tr></thead><tbody><tr><td>J. Smith</td><td>Hot water repair</td><td><span class="status-pill ok">Paid</span></td><td class="num">$420.00</td></tr><tr><td>A. Chen</td><td>Blocked drain</td><td><span class="status-pill warn">Due</span></td><td class="num">$260.00</td></tr></tbody></table></div>`, 'Shared table: <code>data-table</code> inside <code>table-scroll</code> (scrolls sideways on phones). Pages still using their own table styles move to it during the page redesigns.'),
  section('feedback', 'Dialog, toast and loading', `<div class="dsc-row"><button class="secondary-button" type="button" data-dsc-open="dsc-dialog">Open dialog</button><button class="secondary-button" type="button" data-dsc-toast="Saved.">Show toast</button><span class="gx-tile gx-skeleton dsc-skel" aria-hidden="true"></span></div><dialog id="dsc-dialog" class="dsc-dialog" aria-labelledby="dsc-dialog-h"><h2 id="dsc-dialog-h">Send this quote?</h2><p>The customer gets an email with the quote and an accept link.</p><div class="dsc-row"><button class="primary-button" type="button" data-dsc-close>Send</button><button class="secondary-button" type="button" data-dsc-close>Cancel</button></div></dialog>`),
].join('\n');

const html = `<!doctype html>
<html lang="en-AU" data-theme="dark"><head>${platform}<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Oprun design system</title>
<!-- Generated by scripts/build-design-catalogue.mjs from saas/workspace.html. Do not edit by hand. -->
${links.filter((l) => !/ds\/layout\.css/.test(l)).join('')}
<style>
.dsc-page{max-width:1180px;margin:0 auto;padding:20px;display:grid;gap:16px}
.dsc-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.dsc-section h2{margin:0 0 10px}.dsc-section h3{margin:18px 0 8px;font-size:1rem}
.dsc-note{margin:0 0 12px;color:var(--sp-fg-muted)}
.dsc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.dsc-grid-wide{grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.dsc-swatch{display:grid;gap:4px;font-size:.8rem}.dsc-swatch span{display:block;height:54px;border-radius:12px;border:1px solid var(--sp-line-soft)}.dsc-swatch code{color:var(--sp-fg-muted);font-size:.72rem}
.dsc-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:8px 0}
.dsc-table{width:100%;border-collapse:collapse;font-size:.9rem}.dsc-table th,.dsc-table td{padding:10px 12px;border-bottom:1px solid var(--sp-line-soft);text-align:left}.dsc-table th{color:var(--sp-fg-muted);font-weight:700;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}.dsc-table .num{text-align:right;font-variant-numeric:tabular-nums}
.dsc-scroll{overflow-x:auto}.dsc-error{color:var(--sp-bad)}.dsc-skel{display:inline-block;width:160px;height:64px}
.dsc-dialog{max-width:420px;border-radius:16px;border:1px solid var(--sp-line);background:var(--sp-graphite-1);color:var(--sp-fg);padding:20px}.dsc-dialog::backdrop{background:rgba(0,0,0,.6)}
.dsc-h1{margin:6px 0}
</style>${links.find((l) => /ds\/layout\.css/.test(l)) || ''}</head>
<body class="portal-workspace">
${sprite}
<main class="content-wrap"><section class="view" id="dsc-view"><div class="dsc-page">
<div class="page-heading dsc-top"><div><p class="kicker">OPRUN</p><h1>Design system</h1></div><div class="dsc-row" role="group" aria-label="Theme"><button class="secondary-button compact" type="button" data-theme-set="dark">Dark</button><button class="secondary-button compact" type="button" data-theme-set="light">Light</button></div></div>
${body}
</div></section></main>
<script src="design-system.js?v=20261123"></script>
</body></html>
`;
const target = 'saas/design-system.html';
if (process.argv.includes('--check')) { if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== html) { console.error('saas/design-system.html is out of date: run node scripts/build-design-catalogue.mjs'); process.exit(1); } console.log('Design catalogue up to date.'); }
else { fs.writeFileSync(target, html); console.log(`Wrote ${target} (${links.length} stylesheets, ${(sprite.match(/<symbol/g) || []).length} icons).`); }
