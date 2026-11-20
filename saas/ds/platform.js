/* Oprun device and shell detection (T-172, docs/product-redesign/05_ADAPTIVE_UI_SYSTEM.md §2).
   Runs in <head> before the first paint and sets on <html>:
     data-device  phone (<700px) | tablet (700–1023px) | desktop (>=1024px)   — updates on resize/rotation
     data-shell   browser | pwa | android-app | ios-app                       — fixed for the visit
     data-pointer touch | fine
   Layout only: nothing here grants access, and the server never trusts these values. */
(function (root) {
  'use strict';
  var BREAKS = { tablet: 700, desktop: 1024 };
  var KEY = 'oprun-shell';

  function device(width) { return width >= BREAKS.desktop ? 'desktop' : width >= BREAKS.tablet ? 'tablet' : 'phone'; }

  /** Pure decision, so it can be tested: which shell is this visit running in? */
  function shell(input) {
    var i = input || {};
    var ua = String(i.ua || ''), search = String(i.search || ''), ref = String(i.referrer || ''), stored = String(i.stored || '');
    if (/\bOprunApp-iOS\//.test(ua)) return 'ios-app';
    if (/(?:^|[?&])shell=android-app(?:&|$)/.test(search) || /^android-app:\/\/ai\.oprun\.app/.test(ref)) return 'android-app';
    if (stored === 'android-app' || stored === 'ios-app') return stored;
    if (i.standalone) return 'pwa';
    return 'browser';
  }

  function apply(doc, win) {
    var html = doc.documentElement, w = win.innerWidth || html.clientWidth || 1024;
    var stored = '';
    try { stored = win.sessionStorage.getItem(KEY) || ''; } catch (e) { stored = ''; }
    var standalone = false;
    try { standalone = win.matchMedia('(display-mode: standalone)').matches || win.navigator.standalone === true; } catch (e) { standalone = false; }
    var s = shell({ ua: win.navigator.userAgent, search: win.location.search, referrer: doc.referrer, stored: stored, standalone: standalone });
    try { if (s === 'android-app' || s === 'ios-app') win.sessionStorage.setItem(KEY, s); } catch (e) { /* private mode */ }
    // Remove the launch marker from the address bar so it is not bookmarked or shared.
    try {
      if (/(?:^|[?&])shell=android-app/.test(win.location.search) && win.history.replaceState) {
        var q = win.location.search.replace(/([?&])shell=android-app(&|$)/, function (m, a, b) { return b ? a : ''; }).replace(/[?&]$/, '');
        win.history.replaceState(win.history.state, '', win.location.pathname + q + win.location.hash);
      }
    } catch (e) { /* ignore */ }
    var coarse = false;
    try { coarse = win.matchMedia('(pointer: coarse)').matches; } catch (e) { coarse = false; }
    html.setAttribute('data-shell', s);
    html.setAttribute('data-pointer', coarse ? 'touch' : 'fine');
    html.setAttribute('data-device', device(w));
    if (win.matchMedia) {
      var update = function () { html.setAttribute('data-device', device(win.innerWidth || html.clientWidth)); };
      [BREAKS.tablet, BREAKS.desktop].forEach(function (b) {
        try { var mq = win.matchMedia('(min-width: ' + b + 'px)'); if (mq.addEventListener) mq.addEventListener('change', update); else if (mq.addListener) mq.addListener(update); } catch (e) { /* ignore */ }
      });
      try { var pq = win.matchMedia('(pointer: coarse)'); var up = function () { html.setAttribute('data-pointer', pq.matches ? 'touch' : 'fine'); }; if (pq.addEventListener) pq.addEventListener('change', up); } catch (e) { /* ignore */ }
    }
    return { device: html.getAttribute('data-device'), shell: s };
  }

  var api = { device: device, shell: shell, apply: apply, breakpoints: BREAKS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) { root.OprunPlatform = api; api.current = apply(root.document, root); }
})(typeof window !== 'undefined' ? window : null);
