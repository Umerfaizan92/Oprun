// Premium finish for every page: the animated Oprun mark, real icons in place of text symbols, and the owner card.
// No data is read or sent here; it only changes how the page looks.
(()=>{
  let n=0;
  // Oprun mark (2026-11-11): gold crescent-moon arrow around a compass star. Static; no looping motion.
  const logo=()=>{n+=1;const id='sp'+n;return `<svg class="sp-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe3a1"/><stop offset=".55" stop-color="#e2b45c"/><stop offset="1" stop-color="#b9821f"/></linearGradient><linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4d6"/><stop offset="1" stop-color="#f0c66e"/></linearGradient><radialGradient id="${id}b" cx="30%" cy="22%" r="85%"><stop offset="0" stop-color="#1a2233"/><stop offset="1" stop-color="#090c12"/></radialGradient><linearGradient id="${id}o" gradientUnits="userSpaceOnUse" x1="14" y1="12" x2="106" y2="108"><stop offset="0" stop-color="#F4D88E"/><stop offset=".5" stop-color="#E6B455"/><stop offset="1" stop-color="#8F682D"/></linearGradient></defs><rect x="1" y="1" width="46" height="46" rx="13" fill="url(#${id}b)" stroke="url(#${id}g)" stroke-opacity=".55" stroke-width="1.2"/><g transform="translate(.9 .9) scale(.385)"><path fill="url(#${id}o)" d="M103.8 63.8 L103.4 67.1 L102.7 70.3 L101.8 73.4 L100.7 76.5 L99.4 79.5 L97.8 82.4 L96.0 85.2 L94.0 87.8 L91.8 90.3 L89.5 92.6 L87.0 94.7 L84.3 96.6 L81.5 98.3 L78.6 99.8 L75.5 101.1 L72.4 102.2 L69.2 103.0 L66.0 103.5 L62.7 103.9 L59.4 104.0 L56.2 103.8 L52.9 103.4 L49.7 102.7 L46.5 101.8 L43.4 100.7 L40.4 99.4 L37.5 97.8 L34.8 96.0 L32.1 94.0 L29.7 91.9 L27.4 89.5 L25.3 87.0 L23.3 84.3 L21.6 81.5 L20.1 78.6 L18.8 75.6 L17.8 72.5 L17.0 69.3 L16.4 66.0 L16.0 62.8 L16.0 59.5 L16.1 56.2 L16.5 52.9 L17.2 49.7 L18.0 46.5 L19.2 43.4 L20.5 40.4 L22.1 37.6 L23.9 34.8 L25.8 32.2 L28.0 29.7 L30.4 27.4 L32.9 25.3 L35.5 23.3 L38.3 21.6 L41.3 20.1 L44.3 18.8 L47.4 17.8 L50.6 17.0 L53.8 16.4 L50.7 17.6 L47.8 19.0 L45.0 20.6 L42.3 22.3 L39.8 24.2 L37.5 26.2 L35.3 28.4 L33.4 30.7 L31.6 33.1 L30.0 35.6 L28.6 38.1 L27.4 40.7 L26.4 43.4 L25.6 46.1 L25.0 48.8 L24.6 51.5 L24.4 54.2 L24.3 56.9 L24.5 59.6 L24.8 62.2 L25.3 64.8 L26.0 67.3 L26.8 69.8 L27.8 72.2 L28.9 74.5 L30.2 76.7 L31.6 78.9 L33.1 80.9 L34.8 82.8 L36.6 84.6 L38.5 86.3 L40.5 87.9 L42.6 89.3 L44.8 90.6 L47.1 91.7 L49.4 92.7 L51.9 93.6 L54.4 94.3 L56.9 94.8 L59.5 95.2 L62.2 95.3 L64.9 95.4 L67.6 95.2 L70.3 94.8 L73.0 94.3 L75.6 93.5 L78.3 92.6 L80.9 91.4 L83.4 90.1 L85.9 88.6 L88.3 86.9 L90.6 85.0 L92.8 82.9 L94.8 80.6 L96.7 78.2 L98.5 75.6 L100.0 72.9 L101.5 70.0 L102.7 66.9 L103.8 63.8Z"/><path fill="url(#${id}o)" d="M64.63 16.59 45.24 13.19 52.02 19.74 49.11 28.71Z"/><circle fill="url(#${id}o)" cx="102.9" cy="52.6" r="2.2"/><circle fill="url(#${id}o)" fill-opacity=".6" cx="99.2" cy="41.2" r="1.6"/><circle fill="url(#${id}o)" fill-opacity=".3" cx="92.6" cy="31.6" r="1.1"/><path fill="url(#${id}o)" fill-opacity=".7" d="M69.19 50.81 62.5 60 69.19 69.19 60 62.5 50.81 69.19 57.5 60 50.81 50.81 60 57.5Z"/><path fill="url(#${id}o)" d="M60 39 62.26 57.74 81 60 62.26 62.26 60 81 57.74 62.26 39 60 57.74 57.74Z"/><path fill="#090B0F" fill-opacity=".28" d="M60 39 62.26 57.74 60 60ZM81 60 62.26 62.26 60 60ZM60 81 57.74 62.26 60 60ZM39 60 57.74 57.74 60 60Z"/><path fill="#F5F7FB" d="M60 56.5 63.5 60 60 63.5 56.5 60Z"/></g></svg>`};
  const ICONS={
    '✦':'<svg viewBox="0 0 32 32" class="ai-ico ai-spark"><path class="a" d="M16 3l2.6 7.4L26 13l-7.4 2.6L16 23l-2.6-7.4L6 13l7.4-2.6z"/><path class="b" d="M25 20l1.1 3 3 1.1-3 1.1L25 28l-1.1-2.8-3-1.1 3-1.1z"/><path class="c" d="M7 21l.8 2.2L10 24l-2.2.8L7 27l-.8-2.2L4 24l2.2-.8z"/></svg>',
    '◎':'<svg viewBox="0 0 32 32" class="ai-ico ai-inbox"><rect x="4" y="8" width="24" height="17" rx="3.5"/><path class="a" d="M5 10l11 8 11-8"/><circle class="dot" cx="26" cy="8" r="3.2"/></svg>',
    '◈':'<svg viewBox="0 0 32 32" class="ai-ico ai-team"><circle class="a" cx="16" cy="10" r="4.2"/><path d="M7.5 26c.8-5 4-8 8.5-8s7.7 3 8.5 8"/><circle class="b" cx="6.5" cy="13" r="2.6"/><circle class="c" cx="25.5" cy="13" r="2.6"/></svg>',
    '◉':'<svg viewBox="0 0 32 32" class="ai-ico ai-voice"><path d="M9 6.5c0-1 .8-1.8 1.8-1.8h2.2l2 5-2.4 1.6a13 13 0 0 0 6.4 6.4l1.6-2.4 5 2v2.2c0 1-.8 1.8-1.8 1.8C14 21.3 9 14.5 9 6.5z"/><path class="w1" d="M21 6.5a7 7 0 0 1 4.5 4.5"/><path class="w2" d="M21.5 2.5a11 11 0 0 1 8 8"/></svg>',
    '▣':'<svg viewBox="0 0 32 32" class="ai-ico ai-studio"><rect x="4" y="6" width="24" height="20" rx="4"/><path class="play" d="M13.5 12l7 4-7 4z"/><path class="scan" d="M7 22h18"/></svg>',
    '⌕':'<svg viewBox="0 0 32 32" class="ai-ico ai-find"><g class="lens"><circle cx="14" cy="14" r="7.5"/><path d="M20 20l7 7"/></g></svg>',
    '▯':'<svg viewBox="0 0 32 32" class="ai-ico ai-phone"><rect x="9" y="3.5" width="14" height="25" rx="3.5"/><path d="M14 24.5h4"/><path class="a" d="M12.5 9.5h7"/></svg>',
    'desk':'<svg viewBox="0 0 32 32" class="ai-ico ai-desk"><rect x="3.5" y="6" width="25" height="16" rx="3"/><path d="M11 27h10M16 22v5"/><path class="a" d="M8 11h9"/></svg>',
    '✓':'<svg viewBox="0 0 32 32" class="ai-ico ai-secure"><path d="M16 3.5l10 3.6v8.2c0 6-4.2 10.4-10 13.2C10.2 25.7 6 21.3 6 15.3V7.1z"/><path class="tick" d="M11 16.2l3.6 3.6 6.9-7.3"/></svg>'
  };
  function swapIcons(){
    document.querySelectorAll('.feature-card .icon,.install-choice-icon').forEach(e=>{
      if(e.dataset.spIcon)return;const g=e.textContent.trim();let key=g;
      if(e.classList.contains('install-choice-icon')&&g==='▣')key='desk';
      if(ICONS[key]){e.innerHTML=ICONS[key];e.dataset.spIcon='1';e.setAttribute('aria-hidden','true')}
    });
  }
  function swapLogos(){
    document.querySelectorAll('.sp-glyph,.sp-auth-mark,.sp-workspace-mark,.sp-monogram').forEach(e=>{
      if(e.dataset.spLogo)return;e.dataset.spLogo='1';e.classList.add('sp-logo-host');e.innerHTML=logo();
    });
  }
  function install(){swapLogos();swapIcons();addEyes()}

  // Show/hide eye button on every password box, so people can check what they typed (helps on phones).
  const eye='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const eyeOff='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  const addEyes=()=>{document.querySelectorAll('input[type="password"]:not([data-eye])').forEach(inp=>{
    inp.dataset.eye='1';const wrap=document.createElement('span');wrap.className='pw-wrap';inp.parentNode.insertBefore(wrap,inp);wrap.appendChild(inp);
    const b=document.createElement('button');b.type='button';b.className='pw-eye';b.setAttribute('aria-label','Show password');b.setAttribute('aria-pressed','false');b.innerHTML=eye;wrap.appendChild(b);
    b.addEventListener('click',e=>{e.preventDefault();const show=inp.type==='password';inp.type=show?'text':'password';b.innerHTML=show?eyeOff:eye;b.setAttribute('aria-label',show?'Hide password':'Show password');b.setAttribute('aria-pressed',show?'true':'false');inp.focus({preventScroll:true})});
  })};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  new MutationObserver(()=>{clearTimeout(install.t);install.t=setTimeout(install,120)}).observe(document.documentElement,{childList:true,subtree:true});
})();
