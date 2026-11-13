// Founder Console tables (frontend transformation, batch 3 follow-up / T-094).
// Labels every data cell with its column heading so saas/ds/kit.css can show wide tables as stacked cards on phones,
// and restates the table roles explicitly so screen readers keep row/column semantics when CSS changes the display.
// Scope: tables inside #console-content only. Read-only: it adds attributes and one class, never moves, hides or
// rewrites content, controls or IDs. Tables are re-labelled when a console page re-renders them.
(() => {
  'use strict';
  const MIN_COLUMNS_FOR_CARDS = 3;

  const headingText = (th) => (th.textContent || '').replace(/\s+/g, ' ').trim();

  function label(table) {
    const head = table.tHead && table.tHead.rows[table.tHead.rows.length - 1];
    if (!head) return;
    const headings = [...head.cells].map(headingText);
    const signature = headings.join('|') + '#' + table.querySelectorAll('tbody tr').length;
    if (table.dataset.cxLabelled === signature) return;
    table.setAttribute('role', 'table');
    for (const section of [table.tHead, ...table.tBodies]) {
      section.setAttribute('role', 'rowgroup');
      for (const row of section.rows) {
        row.setAttribute('role', 'row');
        let col = 0;
        for (const cell of row.cells) {
          if (cell.tagName === 'TH') {
            cell.setAttribute('role', section === table.tHead ? 'columnheader' : 'rowheader');
          } else {
            cell.setAttribute('role', 'cell');
            const text = headings[col] || '';
            if (text) cell.setAttribute('data-label', text); else cell.removeAttribute('data-label');
          }
          col += cell.colSpan || 1;
        }
      }
    }
    table.classList.add('cx-table');
    table.classList.toggle('cx-cards', headings.length >= MIN_COLUMNS_FOR_CARDS);
    table.dataset.cxLabelled = signature;
  }

  function scan(root) {
    root.querySelectorAll('table').forEach(label);
  }

  function start() {
    const content = document.getElementById('console-content');
    if (!content) return;
    scan(content);
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; scan(content); });
    }).observe(content, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
