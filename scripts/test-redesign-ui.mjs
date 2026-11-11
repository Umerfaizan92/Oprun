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
 for(const width of [390,768,1440]) {
  const context=await ownerContext(browser,server,owner,{viewport:{width,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.base+'/saas/workspace.html#b01/home');
  await page.locator('#workspace-command button').waitFor();
  await page.locator('#workspace-start a').first().waitFor();
  assert.equal(await page.locator('#dashboard-view .operational-strip .metric-card').count(),4);
  assert.equal(await page.locator('#business-navigation [data-nav-group]').count(),8);
  assert.deepEqual(await page.locator('#business-navigation [data-nav-group] .navigation-label').allTextContents(),['Today','Work','Customers','People','Communications','Growth','Money','Setup']);
  await page.waitForFunction(()=>location.hash==='#today/home',null,{timeout:5000});
  assert.doesNotMatch(await page.evaluate(()=>[document.querySelector('#business-navigation')?.textContent,document.querySelector('#page-eyebrow')?.textContent,document.querySelector('#page-title')?.textContent,document.querySelector('#workspace-breadcrumb')?.textContent].join(' ')),/\bB0\d/i);
  await page.evaluate(()=>{location.hash='work/enquiries'});await page.locator('#enquiries-view').waitFor({state:'visible'});
  const pipelineEmpty=await page.evaluate(async()=>{const d=await (await fetch('/api/saas/pipeline/overview')).json();return d.stages.every(s=>!s.count)});
  if(pipelineEmpty){const guide=page.locator('#enquiries-view .view-empty-guide');await guide.waitFor({state:'visible'});assert.equal(await guide.locator('a').count(),1);assert.ok(await guide.locator('a').evaluate(e=>e.getBoundingClientRect().height>=44));}
  await page.evaluate(()=>{location.hash='today/home'});await page.locator('#dashboard-view').waitFor({state:'visible'});
  assert.ok(await page.locator('.content-wrap').evaluate(e=>e.getBoundingClientRect().width<=1201));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#workspace-command button').click();await page.locator('#page-search').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Close search',exact:true}).click();
  for(const theme of ['dark','light']) {
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const violations=await page.evaluate(async source=>{
    if(!window.axe)(0,eval)(source);
    const result=await window.axe.run({include:['#workspace-start','#workspace-command']},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});
    return result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));
   },axe);
   assert.deepEqual(violations,[],`${width}px ${theme} guided start and command accessibility`);
   await page.evaluate(() => {document.activeElement?.blur();window.scrollTo(0,0);});await page.mouse.move(0,0);
   await page.screenshot({path:`qa/visual/redesign/command-${width}-${theme}.png`,fullPage:true});
  }
  await page.goto(server.base+'/saas/workspace.html#b04/unified');
  await page.locator('#unifiedinbox-view').waitFor({state:'visible'});
  const link=page.locator('#workspace-workflows a[href="#communications/email"]');await link.waitFor();
  assert.ok(await link.evaluate(e=>e.getBoundingClientRect().height>=44));
  await link.click();await page.locator('#mail-view').waitFor({state:'visible'});
  assert.equal(await page.locator('#workspace-workflows a[href="#communications/email"]').getAttribute('aria-current'),'page');
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
  await context.close();
  console.log(`PASS redesign ${width}px: navigation, guidance, command search, context links, overflow and dark/light accessibility`);
 }
 assert.deepEqual(errors,[]);console.log('PASS redesigned workspace: phone, tablet and desktop');
} finally {await browser?.close();await server.stop();}
