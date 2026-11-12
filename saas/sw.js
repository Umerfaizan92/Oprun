const CACHE='superpro-public-20261112-3';
const PUBLIC=[
  '/saas/index.html',
  '/saas/intro.css?v=20261024',
  '/saas/support.css?v=20261024',
  '/saas/public-sections.css?v=20261024',
  '/saas/public-voice-install.css?v=20261024',
  '/saas/adaptive.css?v=20261024',
  '/saas/brand.css?v=20261025',
  '/saas/experience.css?v=20261024',
  '/saas/product-guide.js?v=23',
  '/saas/intro.js?v=29',
  '/saas/support.js?v=13',
  '/saas/common.js?v=20260919.6',
  '/saas/install.js?v=20260919.6',
  '/saas/answers.html',
  '/saas/offline.html',
  '/saas/offline.css',
  '/saas/oprun-icon-192.png',
  '/saas/oprun-icon-512.png'
];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PUBLIC)).catch(()=>{}));
});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('superpro-public-')&&k!==CACHE).map(k=>caches.delete(k))))
])));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  const privatePath=u.pathname.startsWith('/api/')||u.pathname.includes('workspace')||u.pathname.includes('sign-in')||u.pathname.includes('create-account')||u.pathname.includes('verify-account')||u.pathname.includes('recover-account')||u.pathname.startsWith('/office/');
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  // Never cache authenticated HTML or API responses. Navigation gets a public,
  // data-free connection-help screen instead of a blank browser error offline.
  if(privatePath){
    if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('/saas/offline.html')));
    return;
  }
  const approvedPublic=PUBLIC.some(p=>new URL(p,location.origin).pathname===u.pathname);
  const staticAsset=/^\/saas\/.*\.(?:css|js|png|svg|webp|woff2?)$/.test(u.pathname);
  if(!approvedPublic&&!staticAsset)return;
  e.respondWith(fetch(e.request).then(r=>{
    if(!r||r.status!==200||r.type==='opaque')return r;
    const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r;
  }).catch(()=>caches.match(e.request)));
});

// Phone/desktop alerts. The server sends only what the person would see in their bell; tapping opens that page.
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch{d={title:'Oprun',body:e.data?.text?.()||''}}
  const title=String(d.title||'Oprun update').slice(0,120);
  e.waitUntil((async()=>{
    // If Oprun is open and visible, the page itself announces the alert (sound and voice); still show the system alert.
    await self.registration.showNotification(title,{body:String(d.body||'').slice(0,240),tag:d.tag||undefined,renotify:true,silent:false,requireInteraction:Boolean(d.urgent),icon:'/saas/oprun-icon-192.png',badge:'/saas/oprun-icon-192.png',vibrate:d.urgent?[200,100,200,100,300]:[180,80,180],timestamp:Date.now(),data:{url:d.url||'/saas/workspace.html',kind:d.kind||'alert'}});
    const open=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    open.forEach(c=>c.postMessage({type:'oprun-push',title,body:d.body||'',kind:d.kind||'alert',url:d.url||''}));
  })());
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const target=new URL(e.notification.data?.url||'/saas/workspace.html',self.location.origin);
  if(target.origin!==self.location.origin)return;
  e.waitUntil((async()=>{
    const wins=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const ws=wins.find(c=>new URL(c.url).pathname===target.pathname);
    if(ws){await ws.focus();if(target.hash)ws.postMessage({type:'oprun-open',hash:target.hash});return}
    await self.clients.openWindow(target.href);
  })());
});
