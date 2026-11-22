// Oprun design-system catalogue: theme switch, live contrast table, demo dialog and toast.
(() => {
  const set = (t) => { document.documentElement.dataset.theme = t; draw(); };
  document.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => set(b.dataset.themeSet)));
  const rgb = (v) => { const c = document.createElement('i'); c.style.color = v; document.body.append(c); const m = getComputedStyle(c).color.match(/[\d.]+/g).map(Number); c.remove(); return m; };
  const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const PAIRS = [['--sp-fg', '--sp-midnight'], ['--sp-fg', '--sp-graphite-1'], ['--sp-fg-2', '--sp-graphite-1'], ['--sp-fg-muted', '--sp-graphite-1'], ['--sp-fg-muted', '--sp-graphite-2'], ['--sp-gold', '--sp-graphite-1'], ['--sp-on-gold', '--sp-gold'], ['--sp-good', '--sp-graphite-1'], ['--sp-warn', '--sp-graphite-1'], ['--sp-bad', '--sp-graphite-1']];
  function draw() {
    const tb = document.querySelector('#dsc-contrast tbody'); if (!tb) return; tb.replaceChildren();
    for (const [fg, bg] of PAIRS) { const r = ratio('var(' + fg + ')', 'var(' + bg + ')'); const tr = document.createElement('tr');
      for (const t of [fg, bg, r.toFixed(2), r >= 4.5 ? 'Pass' : 'Fail']) { const td = document.createElement('td'); td.textContent = t; tr.append(td); } tr.dataset.ratio = r.toFixed(2); tb.append(tr); }
  }
  draw();
})();

document.addEventListener('click', (e) => {
  const o = e.target.closest('[data-dsc-open]'); if (o) document.getElementById(o.dataset.dscOpen)?.showModal();
  const c = e.target.closest('[data-dsc-close]'); if (c) c.closest('dialog')?.close();
  const t = e.target.closest('[data-dsc-toast]'); if (t) window.SPMotion?.toast?.(t.dataset.dscToast);
});
document.addEventListener('submit', (e) => { if (e.target.matches('[data-dsc-noop]')) e.preventDefault(); });
