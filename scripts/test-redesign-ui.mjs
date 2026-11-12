// PDF foundation: actual responsive layout, keyboard, workflow links and contrast.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {startServer} from './test-server.mjs';
import {seedOwner,ownerContext} from './visual/session.mjs';
const server=await startServer();let browser;
const errors=[],axe=fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js',import.meta.url),'utf8');
fs.mkdirSync('qa/visual/redesign',{recursive:true});
try {
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined});
 const owner=await seedOwner(server);
 for(const width of [320,390,768,1440]) {
  const context=await ownerContext(browser,server,owner,{viewport:{width,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.todayAskChecks=[];window.addEventListener('superpro:ask',e=>{window.todayAskChecks.push(e.detail.question);e.stopImmediatePropagation();},true);});
  await page.goto(server.base+'/saas/workspace.html#b01/home');
  await page.locator('.topbar-actions .search-button').waitFor();
  assert.equal(await page.locator('#business-navigation > .portal-brand').count(),0);
  assert.equal(await page.locator('.app-footer .workspace-platform-brand').textContent(),'Oprun');
  assert.equal(await page.locator('#business-navigation #workspace-context').count(),1);
  assert.equal(await page.locator('#business-switcher').count(),1);
  assert.equal(await page.locator('#business-navigation').evaluate(e=>e.inert),true);
  await page.waitForFunction(()=>document.querySelector('.navigation-identity-name')?.textContent===document.querySelector('#org-name-side')?.textContent);

  await page.locator('#dashboard-view .gx-board .gx-tile').first().waitFor();
  // Prompt 01: greeting only (no account line), no "Your next step", no "<name> right now", no workspace shortcuts,
  // five live sections, Open job pool and Ask AI side by side.
  assert.equal(await page.locator('#user-line').isVisible(),false);
  assert.equal(await page.locator('#workspace-start').isVisible(),false);
  assert.equal(await page.locator('#dashboard-view .gx-head h2').count(),0);
  assert.equal(await page.locator('#dashboard-view .gx-workspace-links').count(),0);
  assert.match(await page.locator('#dashboard-view .gx-live').innerText(),/^Live/);
  assert.equal(await page.locator('#dashboard-view .gx-tile').count(),5);
  const [jobPool,askAi]=await page.locator('#dashboard-view .heading-actions > button').evaluateAll(b=>b.map(x=>x.getBoundingClientRect().toJSON()));
  assert.ok(Math.abs(jobPool.top-askAi.top)<2&&jobPool.right<=askAi.left+1&&jobPool.height>=44,'job pool and Ask AI side by side');
  const geometry=await page.evaluate(()=>{
   const rect=s=>document.querySelector(s).getBoundingClientRect();
   const h=rect('.dashboard-heading'),bar=rect('#sp-askbar'),board=rect('#dashboard-view .gx-board');
   return {first:document.querySelector('#dashboard-view').firstElementChild.classList.contains('dashboard-heading'),heading:h.top,ai:bar.top,aiHeight:bar.height,boardEnd:board.bottom,position:getComputedStyle(document.querySelector('#sp-askbar')).position};
  });
  assert.equal(geometry.first,true,'greeting is first dashboard content');
  assert.ok(geometry.heading<geometry.ai&&geometry.boardEnd<=geometry.ai,'greeting and live sections precede AI');
  if(width>=1280)assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+40),'desktop Command Centre fits one viewport');
  if(width<=760){
    const dock=page.locator('#mobile-workspace-dock');await dock.waitFor({state:'visible'});
    assert.equal(await dock.evaluate(e=>e.parentElement===document.body),true,'bar pinned outside transformed ancestors');
    assert.equal((await dock.locator('.mobile-workspace-menu').innerText()).replace(/\s+/g,' ').trim(),'All Features');
    const bottoms=[];for(const y of [0,300,5000,0]){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(80);bottoms.push(await dock.evaluate(e=>Math.round(innerHeight-e.getBoundingClientRect().bottom)))}
    assert.deepEqual(bottoms,[0,0,0,0],'bar never moves while scrolling');
    await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(80);
    const gap=await page.evaluate(()=>document.querySelector('#mobile-workspace-dock').getBoundingClientRect().top-document.querySelector('.app-footer').getBoundingClientRect().bottom);
    assert.ok(gap>=0,'footer is never covered by the bar');
    await dock.locator('.mobile-workspace-menu').click();await page.locator('#all-features .gx-shortcut').first().waitFor();
    assert.ok(await page.locator('#all-features .gx-shortcut').count()>=6,'All Features lists the workspace shortcuts');
    await page.locator('.business-navigation-close').click();await page.evaluate(()=>scrollTo(0,0));
  }
  assert.equal(geometry.position,'static','AI never overlays the viewport');
  if(width<=760)assert.ok(geometry.aiHeight<320,`compact mobile AI: ${JSON.stringify(geometry)}`);
  for(const control of await page.locator('#sp-askbar input,#sp-askbar .sp-ask-form button').all())assert.ok(await control.evaluate(e=>e.getBoundingClientRect().height>=44),'44px AI touch target');
  const originalName=await page.locator('#first-name').textContent();
  await page.locator('#first-name').evaluate(e=>e.textContent='Faizan-Ul-Hasnain Long Business Owner Name');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'long identity wraps');
  await page.locator('#first-name').evaluate((e,name)=>e.textContent=name,originalName);
  await page.locator('#sp-ask-input').fill('Review my business today');await page.locator('.sp-ask-send').click();
  assert.deepEqual(await page.evaluate(()=>window.todayAskChecks),['Review my business today']);
  assert.equal(await page.locator('#sp-ask-input').inputValue(),'');
  for(const chip of await page.locator('#sp-askbar [data-q]').all()){const q=await chip.getAttribute('data-q');await chip.click();assert.equal(await page.evaluate(()=>window.todayAskChecks.at(-1)),q);}
  await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0)});
  assert.equal(await page.locator('#dashboard-view .operational-strip .metric-card').count(),4);
  assert.equal(await page.locator('#business-navigation [data-nav-group]').count(),8);
  assert.equal(await page.locator('#business-navigation .navigation-more[open]').count(),0,'More defaults closed');
  assert.deepEqual(await page.locator('#business-navigation [data-nav-group] .navigation-label').allTextContents(),['Today','Work','Customers','People','Communications','Growth','Money','Setup']);
  await page.waitForFunction(()=>location.hash==='#today/home',null,{timeout:5000});
  assert.doesNotMatch(await page.evaluate(()=>[document.querySelector('#business-navigation')?.textContent,document.querySelector('#page-eyebrow')?.textContent,document.querySelector('#page-title')?.textContent,document.querySelector('#workspace-breadcrumb')?.textContent].join(' ')),/\bB0\d/i);
  await page.evaluate(()=>{location.hash='work/enquiries'});await page.locator('#enquiries-view').waitFor({state:'visible'});
  const pipelineEmpty=await page.evaluate(async()=>{const d=await (await fetch('/api/saas/pipeline/overview')).json();return d.stages.every(s=>!s.count)});
  if(pipelineEmpty){const guide=page.locator('#enquiries-view .view-empty-guide');await guide.waitFor({state:'visible'});assert.equal(await guide.locator('a').count(),1);assert.ok(await guide.locator('a').evaluate(e=>e.getBoundingClientRect().height>=44));}
  await page.evaluate(()=>{location.hash='today/home'});await page.locator('#dashboard-view').waitFor({state:'visible'});
  assert.ok(await page.locator('.content-wrap').evaluate(e=>e.getBoundingClientRect().width<=1201));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.topbar-actions .search-button').click();await page.locator('#page-search').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Close search',exact:true}).click();
  for(const theme of ['dark','light']) {
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const violations=await page.evaluate(async source=>{
    if(!window.axe)(0,eval)(source);
    const result=await window.axe.run({include:['#workspace-start','.topbar-actions .search-button','#sp-askbar','.dashboard-heading']},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});
    return result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));
   },axe);
   assert.deepEqual(violations,[],`${width}px ${theme} guided start and command accessibility`);
   await page.evaluate(() => {document.activeElement?.blur();window.scrollTo(0,0);});await page.mouse.move(0,0);
   await page.screenshot({path:`qa/visual/redesign/command-${width}-${theme}.png`,fullPage:true});
  }
  await page.goto(server.base+'/saas/workspace.html#b04/unified');
  await page.locator('#unifiedinbox-view').waitFor({state:'visible'});
  if(width<=760){await page.locator('[data-dock-key=menu]').click();await page.locator('#business-navigation .navigation-more').filter({has:page.locator('[data-nav-page=mail]')}).locator('summary').click();}
  const link=page.locator((width<=760?'#business-navigation':'#workspace-workflows')+' a[href="#communications/email"]');await link.waitFor();
  assert.ok(await link.evaluate(e=>e.getBoundingClientRect().height>=44));
  await link.click();await page.locator('#mail-view').waitFor({state:'visible'});
  assert.equal(await page.locator((width<=760?'#business-navigation':'#workspace-workflows')+' a[href="#communications/email"]').getAttribute('aria-current'),'page');
  await page.reload();await page.locator('#mail-view').waitFor({state:'visible'});
  const more=page.locator('#business-navigation .navigation-more').filter({has:page.locator('[data-nav-page="mail"]')});
  assert.equal(await more.getAttribute('open'),null,'secondary navigation does not force More open');
  await page.locator(width<=760?'#mobile-workspace-dock [data-dock-key=menu]':'.navigation-business-trigger').click();
  await more.locator('summary').click();assert.equal(await more.getAttribute('open'),'','More opens manually');
  await more.locator('summary').press('Enter');assert.equal(await more.getAttribute('open'),null,'More can close while its page is active');
  await page.locator('#business-navigation [data-nav-group="today"]').click();
  await page.locator('#business-navigation [data-nav-group="communications"]').click();
  assert.equal(await more.getAttribute('open'),null,'repainting does not reopen a manually closed More');
  await page.screenshot({path:`qa/visual/redesign/business-drawer-${width}.png`,fullPage:true});
  await page.keyboard.press('Escape');

  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  for (const theme of ['dark','light']) {
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const failures=await page.evaluate(async source=>{
    if(!window.axe)(0,eval)(source);
    const r=await window.axe.run({include:['#workspace-workflows']},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});
    return r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id);
   },axe);
   assert.deepEqual(failures,[],`${width}px ${theme} workflow navigation accessibility`);
  }
  await page.evaluate(() => {document.activeElement?.blur();window.scrollTo(0,0);});await page.mouse.move(0,0);
  await page.screenshot({path:`qa/visual/redesign/inbox-${width}.png`,fullPage:true});
  // Prompt 02: Your Workspace (after Business overview) and Priorities (renamed from Attention items).
  await page.goto(server.base+'/saas/workspace.html#today/home');await page.locator('#dashboard-view .gx-tile').first().waitFor();
  assert.deepEqual(await page.locator('#dashboard-view .context-section-tabs [role=tab]').evaluateAll(t=>t.map(x=>x.textContent)),['Business overview','Your Workspace','Action Centre','Workflow Guidance']);
  const openSection=async name=>{if(width<=760)await page.locator('#mobile-workspace-dock button',{hasText:name}).click();else await page.locator('#dashboard-view .context-section-tabs [role=tab]',{hasText:name}).click();await page.waitForFunction(n=>document.querySelector('#dashboard-view [role=tab][aria-selected=true]')?.textContent===n,name)};
  await openSection('Your Workspace');await page.locator('[data-cc-features] .cc-tile').first().waitFor();
  assert.ok(await page.locator('[data-cc-features] .cc-tile:visible').count()>=20,'all permitted features listed');
  for(const hidden of ['.dashboard-heading','#sp-askbar','.gx-board','#priorities','#gds-copilot .copilot-launch'])assert.equal(await page.locator(hidden).first().isVisible(),false,hidden+' hidden on Your Workspace');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll');
  await page.locator('#cc-feature-filter').fill('invoice');assert.ok(await page.locator('[data-cc-features] .cc-tile').count()>=1);
  await page.locator('#cc-feature-filter').fill('zzzz-nothing');await page.locator('[data-cc-ask]').waitFor();await page.locator('#cc-feature-filter').fill('');
  await openSection('Action Centre');await page.locator('#priorities .cc-brief').waitFor();
  assert.equal(await page.locator('#workspace-start .workspace-start-link:visible').count(),3,'three next-step cards');
  assert.ok(await page.locator('#priorities .ai-brief-panel').isVisible());
  await page.waitForFunction(()=>/^Live/.test(document.querySelector('#priorities .status-pill')?.textContent||''));
  for(const hidden of ['.dashboard-heading','#sp-askbar','#workspace-features'])assert.equal(await page.locator(hidden).isVisible(),false,hidden+' hidden on Action Centre');
  for(const theme of ['dark','light']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const v=await page.evaluate(async source=>{if(!window.axe)(0,eval)(source);const r=await window.axe.run({include:['#priorities']},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});return r.violations.filter(x=>['serious','critical'].includes(x.impact)).map(x=>({id:x.id,t:x.nodes.map(n=>n.target)}))},axe);
   assert.deepEqual(v,[],`${width}px ${theme} Action Centre accessibility`);}
  await openSection('Your Workspace');
  for(const theme of ['dark','light']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const v=await page.evaluate(async source=>{if(!window.axe)(0,eval)(source);const r=await window.axe.run({include:['#workspace-features']},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});return r.violations.filter(x=>['serious','critical'].includes(x.impact)).map(x=>({id:x.id,t:x.nodes.map(n=>n.target)}))},axe);
   assert.deepEqual(v,[],`${width}px ${theme} Your Workspace accessibility`);}
  // Master prompt: Workflow Guidance = 8-stage core workflow + the working Setup Checklist.
  await openSection('Workflow Guidance');await page.locator('#workflow-guidance .wg-stage').first().waitFor();
  assert.deepEqual(await page.locator('#workflow-guidance .wg-name b').allTextContents(),['Enquiry','Quotation','Booking','Allocation','Execution','Completion','Invoice','Payment']);
  for(const hidden of ['.dashboard-heading','#workspace-features','#priorities','.gx-board'])assert.equal(await page.locator(hidden).first().isVisible(),false,hidden+' hidden on Workflow Guidance');
  await page.waitForFunction(()=>!/Loading/.test(document.querySelector('#workflow-guidance .wg-summary')?.textContent||'Loading'));
  await page.locator('[data-wg-toggle=quotation]').click();await page.locator('#wg-quotation').waitFor();
  assert.equal(await page.locator('[data-wg-toggle=quotation]').getAttribute('aria-expanded'),'true');
  assert.match(await page.locator('#wg-quotation a').getAttribute('href'),/#work\/quotes/);
  await page.locator('[data-setup-checklist] .setup-list li').first().waitFor();
  assert.ok(await page.locator('[data-setup-checklist] .setup-list li').count()>=5,'checklist shows every step for the owner');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll on Workflow Guidance');
  for(const theme of ['dark','light']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const v=await page.evaluate(async source=>{if(!window.axe)(0,eval)(source);const r=await window.axe.run({include:['#workflow-guidance']},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});return r.violations.filter(x=>['serious','critical'].includes(x.impact)).map(x=>({id:x.id,t:x.nodes.map(n=>n.target)}))},axe);
   assert.deepEqual(v,[],`${width}px ${theme} Workflow Guidance accessibility`);}
  // The fixed bug: a checklist button opens its page and focuses the field, including the step on the current page.
  const step=page.locator('[data-setup-checklist] [data-setup-step]').first();
  if(await step.count()){const key=await step.evaluate(b=>b.closest('li').dataset.setupKey);await step.click();
   await page.waitForFunction(()=>!document.getElementById('dashboard-view')||document.getElementById('dashboard-view').hidden);
   const want={business:'onboarding',services:'onboarding',contact:'onboarding',channel:'integrations',job:'jobs',overheads:'finance'}[key];
   await page.waitForFunction(v=>!document.getElementById(v+'-view').hidden,want);
   if(want==='onboarding'){await page.locator('#setup-checklist [data-setup-step]').first().click();await page.waitForFunction(()=>document.activeElement&&document.activeElement.closest('#onboarding-form'));}}
  for(const [old,label] of [['attention-items','Action Centre'],['priorities','Action Centre'],['readiness','Workflow Guidance'],['workflow-guide','Workflow Guidance']]){
   await page.goto(server.base+'/saas/workspace.html#today/home?section='+old);
   await page.waitForFunction(n=>document.querySelector('#dashboard-view [role=tab][aria-selected=true]')?.textContent===n,label);}
  await context.close();
  console.log(`PASS redesign ${width}px: navigation, guidance, command search, context links, overflow and dark/light accessibility`);
 }
 assert.deepEqual(errors,[]);console.log('PASS redesigned workspace: phone, tablet and desktop');
} finally {await browser?.close();await server.stop();}
