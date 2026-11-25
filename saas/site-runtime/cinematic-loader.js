/* W-06: loads the cinematic hero scene on business websites, and only when it will not hurt the visitor.
   Skipped for reduced motion, data saver, slow connections, low-power devices and browsers without WebGL.
   The poster image is the page's main image either way; the scene is decoration (aria-hidden). */
(() => {
  const el = document.querySelector('[data-cinematic]');
  if (!el || /[?&]static3d=1/.test(location.search)) return;
  const c = navigator.connection || {};
  const webgl = () => { try { const x = document.createElement('canvas'); return Boolean(x.getContext('webgl2') || x.getContext('webgl')); } catch { return false; } };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || c.saveData || /2g/.test(c.effectiveType || '') || (navigator.hardwareConcurrency || 4) < 4 || (navigator.deviceMemory || 8) < 4 || !webgl()) { el.dataset.cinematicState = 'poster'; return; }
  const go = () => import('/_site/cinematic.js?v=1').then((m) => m.mount(el, { preset: el.dataset.cinematic, color: el.dataset.color, quality: innerWidth < 760 ? 'low' : 'high' })).catch(() => { el.dataset.cinematicState = 'poster'; });
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 200));
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
})();
