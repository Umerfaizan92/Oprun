import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read = file => fs.readFileSync(new URL('../saas/'+file,import.meta.url),'utf8');
async function fixture(mobile=true) {
  const dom=new JSDOM(read('workspace.html'),{url:'https://preview.example.test/saas/workspace.html#today/home',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;w.CSS={escape:s=>String(s)};
  const observers=[],Observer=w.MutationObserver;let disposed=false;
  w.MutationObserver=class extends Observer {constructor(callback){super(callback);observers.push(this)}};
  const frame=w.requestAnimationFrame.bind(w);
  w.requestAnimationFrame=callback=>frame(time=>{if(!disposed)callback(time)});
  const media={matches:mobile,listeners:[],addEventListener(type,fn){this.listeners.push(fn)}};
  w.matchMedia=()=>media;w.ResizeObserver=class {observe(){} disconnect(){}};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.fetch=async()=>({ok:true,json:async()=>({isolated_preview:false})});
  w.GDS_SESSION={user:{role:'owner',id:'test-owner'},organisation:{id:'test-org'},access:{mode:'owner'}};
  w.document.getElementById('workspace').hidden=false;
  w.document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='dashboard-view');
  for(const script of ['workspace-nav.js','navigation-shell.js','portal-shell.js','page-sections.js','focused-workspace.js','workspace-mobile.js','support.js']) w.eval(read(script));
  w.SuperProNav.render(w.document.querySelector('.workspace-nav'),'owner');
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const flush=async()=>{await new Promise(r=>w.setTimeout(r,70))};await flush();
  const activate=async view=>{
    let root=w.document.getElementById(view+'-view');
    if(!root){root=w.document.createElement('section');root.id=view+'-view';root.className='view';w.document.querySelector('.content-wrap').append(root)}
    w.document.querySelectorAll('.view').forEach(v=>v.hidden=v!==root);
    w.dispatchEvent(new w.CustomEvent('gds:viewchange',{detail:{view}}));await flush();return root;
  };
  return {dom,w,media,flush,activate,close:()=>{disposed=true;observers.forEach(observer=>observer.disconnect());w.close()}};
}
test('all 60 canonical pages and aliases keep the correct permission-filtered mobile area navigation',async()=>{
  const f=await fixture();try{
    const nav=f.w.SuperProNav,groups=nav.DOMAINS;let count=0;
    for(const group of groups)for(const item of group.items){
      await f.activate(item.view);
      const dock=f.w.document.getElementById('mobile-workspace-dock');assert.equal(dock.hidden,false);
      const active=dock.querySelector('.mobile-workspace-pages [aria-current=page]');assert.equal(active.dataset.dockKey,item.view);assert.equal(active.getAttribute('href'),'#'+item.path);
      assert.deepEqual([...dock.querySelectorAll('.mobile-workspace-pages a')].map(a=>a.dataset.dockKey),Array.from(group.items,i=>i.view));
      assert.equal(nav.resolve(item.path,'owner'),item.view);for(const alias of item.alias||[])assert.equal(nav.resolve(alias,'owner'),item.view);count++;
    }
    assert.equal(count,60);
    f.w.GDS_SESSION={user:{role:'employee',id:'test-worker'},organisation:{id:'test-org'},access:{mode:'custom',grants:['dashboard.read']}};
    await f.activate('dashboard');
    assert.deepEqual([...f.w.document.querySelectorAll('.mobile-workspace-pages a')].map(a=>a.dataset.dockKey),['dashboard']);
    assert.equal(nav.resolve('money/ledger','employee'),null);
  }finally{f.close()}
});
test('real page section handlers keep an unsaved field and adapt after native tabs rerender',async()=>{
  const f=await fixture();try{
    const root=await f.activate('jobs');
    const nav=root.querySelector('[role=tablist]');assert.ok(nav,'original job sections installed');
    const input=root.querySelector('input');input.value='Unsaved job title';
    const proxies=()=>[...f.w.document.querySelectorAll('.mobile-workspace-section-group button')];
    assert.equal(proxies().length,nav.querySelectorAll('[role=tab]').length);
    for(const b of proxies()){b.click();await f.flush();assert.equal(input.value,'Unsaved job title');assert.equal(f.w.document.getElementById('mobile-workspace-dock')._sources[0].buttons[+b.dataset.dockKey.split('-')[2]].getAttribute('aria-selected'),'true')}
    // Replace an API-rendered native tablist with identical labels: proxies must rebind to the new elements.
    const dynamic=await f.activate('automations');let clicked=0;
    const insert=()=>{dynamic.replaceChildren();const list=f.w.document.createElement('div');list.setAttribute('role','tablist');list.setAttribute('aria-label','Automations');
      for(const label of ['Flows','Activity']){const b=f.w.document.createElement('button');b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(label==='Flows'));b.textContent=label;b.onclick=()=>{clicked++;list.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',String(x===b)))};list.append(b)}dynamic.append(list)};
    insert();await f.flush();insert();await f.flush();
    proxies().find(b=>b.textContent==='Activity').click();await f.flush();assert.equal(clicked,1);
    assert.equal(dynamic.querySelector('[aria-selected=true]').textContent,'Activity');
  }finally{f.close()}
});
test('inactive nested sections stay out of the dock and desktop returns to original controls',async()=>{
  const f=await fixture();try{
    const root=await f.activate('automations');root.innerHTML='<div role="tablist" aria-label="Main"><button role="tab" aria-selected="true">Main</button></div><section hidden><div role="tablist" aria-label="Private"><button role="tab">Invisible</button></div></section>';
    await f.flush();assert.equal(f.w.document.querySelectorAll('.mobile-workspace-section-group').length,1);
    f.media.matches=false;f.media.listeners.forEach(fn=>fn());await f.flush();assert.equal(f.w.document.getElementById('mobile-workspace-dock').hidden,true);
    assert.equal(root.querySelector('[role=tablist]').hidden,false);
  }finally{f.close()}
});
test('brand moves into footer; one original sign-out button remains last in the drawer; duplicate search is removed',async()=>{
  const f=await fixture();try{
    const d=f.w.document;
    assert.equal(d.querySelectorAll('.topbar-left .workspace-platform-brand').length,0);
    assert.equal(d.querySelectorAll('.app-footer .workspace-platform-brand').length,1);
    assert.equal(d.querySelectorAll('#logout').length,1);
    assert.equal(d.querySelector('#business-navigation').lastElementChild.id,'logout');
    assert.equal(d.querySelectorAll('#workspace-command').length,0);
    assert.equal(d.querySelectorAll('.app-footer .workspace-trust-links a').length,4);
    assert.equal(d.querySelectorAll('.app-footer .sp-global-trust-footer').length,1);
    assert.doesNotMatch(d.querySelector('.app-footer').textContent,/AWS-ready|built with AI-assisted/);
    assert.equal(d.querySelectorAll('.topbar-actions .search-button').length,1);
    let prompted=0;f.w.confirm=()=>{prompted++;return false};
    const root=await f.activate('jobs'),input=root.querySelector('input');input.dispatchEvent(new f.w.FocusEvent('focusin',{bubbles:true}));input.value='Pending change';
    const link=d.querySelector('.mobile-workspace-pages a');const event=new f.w.MouseEvent('click',{bubbles:true,cancelable:true});link.dispatchEvent(event);
    assert.equal(prompted,1);assert.equal(event.defaultPrevented,true);
  }finally{f.close()}
});
test('chat permission changes and unread notifications stay in sync with the real launcher',async()=>{
  const f=await fixture();try{
    const d=f.w.document,shell=d.createElement('div');shell.id='gds-staff-chat';shell.hidden=true;
    shell.innerHTML='<button class="sc-launch"><span class="sc-badge" hidden></span></button>';d.body.append(shell);await f.flush();
    assert.equal(d.querySelector('[data-dock-key=chat]'),null,'no dead action for a denied staff-chat grant');
    shell.hidden=false;const badge=shell.querySelector('.sc-badge');badge.hidden=false;badge.textContent='3';await f.flush();
    assert.equal(d.querySelector('[data-dock-key=chat] .mobile-workspace-badge').textContent,'3');
    assert.equal(d.querySelector('[data-dock-key=chat]').getAttribute('aria-label'),'Office chat, 3 unread');
    badge.textContent='7';await f.flush();assert.equal(d.querySelector('[data-dock-key=chat] .mobile-workspace-badge').textContent,'7');
    badge.hidden=true;await f.flush();assert.equal(d.querySelector('[data-dock-key=chat] .mobile-workspace-badge'),null);
    shell.hidden=true;await f.flush();assert.equal(d.querySelector('[data-dock-key=chat]'),null);
  }finally{f.close()}
});
test('mobile keyboard viewport measurements provide offsets for the dock and chat panels',async()=>{
  const f=await fixture();try{
    f.w.innerHeight=600;f.w.visualViewport={height:320,offsetTop:0};f.w.dispatchEvent(new f.w.Event('resize'));
    assert.equal(f.w.document.body.style.getPropertyValue('--mobile-workspace-keyboard-offset'),'280px');
    assert.equal(f.w.document.body.style.getPropertyValue('--mobile-workspace-viewport-height'),'320px');
  }finally{f.close()}
});

test('bottom Menu opens the drawer without the outside-click handler closing it',async()=>{
  const f=await fixture();try{
    const d=f.w.document;d.querySelector('[data-dock-key=menu]').click();
    assert.equal(d.getElementById('business-navigation').dataset.drawer,'true');
    assert.equal(d.querySelector('.app-main').inert,true);
    d.querySelector('.business-navigation-close').click();
    assert.equal(d.getElementById('business-navigation').dataset.drawer,'false');
    assert.equal(d.querySelector('.app-main').inert,false);
  }finally{f.close()}
});
