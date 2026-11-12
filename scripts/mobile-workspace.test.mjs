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
test('all 60 pages keep main navigation in the sidebar and only one sub-section bar below',async()=>{
  const f=await fixture();try{
    const nav=f.w.SuperProNav,groups=nav.DOMAINS;let count=0;
    for(const group of groups)for(const item of group.items){
      await f.activate(item.view);
      const dock=f.w.document.getElementById('mobile-workspace-dock');assert.equal(dock.hidden,false);
      assert.equal(dock.tagName,'NAV');assert.equal(dock.children.length,2);
      assert.equal(dock.firstElementChild.dataset.dockKey,'menu');
      assert.equal(dock.querySelectorAll('a,.mobile-workspace-pages').length,0);
      assert.equal(dock.querySelectorAll('[data-dock-key=ask],[data-dock-key=chat]').length,0);
      assert.ok(f.w.document.querySelector(`#business-navigation [data-nav-page="${item.view}"]`),'main page remains in sidebar');
      assert.equal(nav.resolve(item.path,'owner'),item.view);for(const alias of item.alias||[])assert.equal(nav.resolve(alias,'owner'),item.view);count++;
    }
    assert.equal(count,60);
    f.w.GDS_SESSION={user:{role:'employee',id:'test-worker'},organisation:{id:'test-org'},access:{mode:'custom',grants:['dashboard.read']}};
    await f.activate('dashboard');
    f.w.SuperProNav.render(f.w.document.querySelector('.workspace-nav'),'employee');await f.flush();
    assert.equal(f.w.document.querySelector('#business-navigation [data-nav-page=finance]'),null);
    assert.equal(f.w.document.querySelector('#mobile-workspace-dock a'),null);
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
    const link=d.querySelector('#business-navigation [data-nav-page=dashboard]');const event=new f.w.MouseEvent('click',{bubbles:true,cancelable:true});link.dispatchEvent(event);
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
// Prompt 01 #9 (12 Nov 2026): the bar no longer follows the visual viewport (that caused movement while scrolling);
// it stays pinned and is hidden only while someone is typing with the on-screen keyboard open.
test('mobile keyboard: the bar never moves with the viewport and hides only while typing',async()=>{
  const f=await fixture();try{
    const d=f.w.document,body=d.body;
    f.w.innerHeight=600;f.w.visualViewport={height:540,offsetTop:0};f.w.dispatchEvent(new f.w.Event('resize'));
    assert.equal(body.style.getPropertyValue('--mobile-workspace-keyboard-offset'),'0px','address-bar changes never shift the bar');
    assert.equal(body.classList.contains('mobile-keyboard-open'),false);
    const input=d.createElement('input');d.querySelector('.app-main').append(input);input.focus();
    f.w.visualViewport={height:320,offsetTop:0};f.w.dispatchEvent(new f.w.Event('resize'));
    assert.equal(body.style.getPropertyValue('--mobile-workspace-keyboard-offset'),'0px');
    assert.equal(body.style.getPropertyValue('--mobile-workspace-viewport-height'),'320px');
    assert.equal(body.classList.contains('mobile-keyboard-open'),true,'hidden while the keyboard is open');
    input.blur();f.w.visualViewport={height:600,offsetTop:0};f.w.dispatchEvent(new f.w.Event('resize'));
    assert.equal(body.classList.contains('mobile-keyboard-open'),false,'back when typing ends');
    assert.equal(d.getElementById('mobile-workspace-dock')?.parentElement,body,'pinned to the viewport, outside transformed ancestors');
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
    assert.equal(d.activeElement,d.querySelector('[data-dock-key=menu]'),'closing drawer returns focus to the visible bottom Menu');
  }finally{f.close()}
});

test('business identity is static on mobile and nested sub-section groups share one scroller',async()=>{
  const f=await fixture();try{
    const d=f.w.document,identity=d.querySelector('.workspace-mobile-identity');
    assert.ok(identity);assert.equal(identity.tagName,'DIV');
    assert.equal(identity.querySelectorAll('button,a,[tabindex],.navigation-identity-chevron').length,0);
    const root=await f.activate('automations');root.innerHTML='<div role="tablist" aria-label="Primary"><button role="tab" aria-selected="true">Overview</button></div><div role="tablist" aria-label="Secondary"><button role="tab" aria-selected="true">Activity</button></div>';
    await f.flush();
    const dock=d.getElementById('mobile-workspace-dock');
    assert.equal(dock.children.length,2);assert.equal(dock.querySelectorAll('.mobile-workspace-sections').length,1);
    assert.equal(dock.querySelectorAll('.mobile-workspace-section-group').length,2);
    assert.deepEqual([...dock.querySelectorAll('.mobile-workspace-section-group')].map(g=>g.parentElement),[dock.lastElementChild,dock.lastElementChild]);
    root.replaceChildren();await f.flush();assert.equal(dock.lastElementChild.hidden,true);assert.equal(dock.querySelectorAll('button').length,1);
  }finally{f.close()}
});

test('sidebar chat badge updates keep focus inside the open Menu',async()=>{
  const f=await fixture();try{
    const d=f.w.document,shell=d.createElement('div');shell.id='gds-staff-chat';
    shell.innerHTML='<button class="sc-launch"><span class="sc-badge">1</span></button>';d.body.append(shell);await f.flush();
    d.querySelector('#mobile-workspace-dock [data-dock-key=menu]').click();
    d.querySelector('.mobile-workspace-actions [data-dock-key=chat]').focus();
    shell.querySelector('.sc-badge').textContent='2';await f.flush();
    assert.equal(d.activeElement,d.querySelector('.mobile-workspace-actions [data-dock-key=chat]'));
    shell.hidden=true;await f.flush();
    assert.equal(d.activeElement,d.querySelector('.business-navigation-close'));
  }finally{f.close()}
});
