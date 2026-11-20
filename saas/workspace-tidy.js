// T-176: remove visible repetition. When a tab panel opens with a heading that only repeats the selected tab's
// name ("Stock on hand" tab, then "Stock on hand" heading), the heading stays for screen readers but is not
// shown a second time. Nothing is removed from the page and no handler changes.
(() => {
  const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  let frame = 0;
  function tidy() {
    frame = 0;
    document.querySelectorAll('.view:not([hidden]) [role="tablist"]').forEach((list) => {
      list.querySelectorAll('[role="tab"]').forEach((tab) => {
        const panel = document.getElementById(tab.getAttribute('aria-controls') || '');
        if (!panel) return;
        const heading = panel.querySelector('h2');
        if (!heading) return;
        const repeat = tab.getAttribute('aria-selected') === 'true' && norm(heading.textContent) === norm(tab.textContent);
        heading.classList.toggle('rf-repeat-heading', repeat);
      });
    });
  }
  const queue = () => { if (!frame) frame = requestAnimationFrame(tidy); };
  addEventListener('hashchange', queue);
  document.addEventListener('click', queue, true);
  addEventListener('superpro:workspace-ready', queue);
  const start = () => {
    new MutationObserver(queue).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'hidden'], childList: true });
    queue();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
