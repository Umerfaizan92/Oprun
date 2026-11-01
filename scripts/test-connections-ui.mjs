// Uses synthetic accounts and provider responses; never connects a production account.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {startServer} from './test-server.mjs';
import {seedOwner,ownerContext} from './visual/session.mjs';
const server=await startServer();let browser;
try{
 const owner=await seedOwner(server);
 browser=await chromium.launch({headless:true,...(process.env.UI_CHROMIUM_PATH?{executablePath:process.env.UI_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}: {})});
 const ctx=await ownerContext(browser,server,owner),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 let selected=['test-account'],saved=null,emailSaved=false;
 await page.route('**/api/saas/integrations/self-service',async route=>{
  const response=await route.fetch(),data=await response.json(),t=data.integrations.find(x=>x.provider==='tiktok');
  Object.assign(t,{status:'connected',provider_ready:true,account_label:'Synthetic business',last_test_status:'pass',resources:[{id:'test-account',type:'tiktok_account',label:'Synthetic business'}],selected_resources:selected.map(id=>({id,type:'tiktok_account'})),insights:{fetched_at:'2026-11-01T07:00:00Z',results:[{resource_id:'test-account',type:'tiktok_account',label:'Synthetic business',source:'TikTok',period:'Current provider counters',fetched_at:'2026-11-01T07:00:00Z',status:'available',metrics:[{label:'Followers',value:null,note:'user.info.stats approval required.'},{label:'Public videos',value:0}]}]}});
  if(emailSaved)Object.assign(data.integrations.find(x=>x.provider==='email_sms'),{status:'connected',last_test_status:'pass',transport:{email:{sender:'hello@synthetic-business.org',status:'verified'}}});
  await route.fulfill({response,json:data});
 });
 await page.route('**/api/saas/integrations/self-service/tiktok/resources',async route=>{saved=route.request().postDataJSON().resource_ids;selected=saved;await route.fulfill({json:{ok:true}})});
 await page.route('**/api/saas/integrations/self-service/email_sms/credentials',async route=>{assert.equal(route.request().postDataJSON().api_key,'test-write-only-key');emailSaved=true;await route.fulfill({json:{ok:true,secret_stored:true}})});
 await page.goto(server.base+'/saas/workspace.html#b08/connections');await page.locator('#integrations-view').waitFor({state:'visible'});
 const grid=page.locator('#self-service-integration-grid'),tk=grid.locator('[data-provider-card="tiktok"]'),pager=page.locator('#self-service-integration-grid + .focus-pagination');
 await tk.locator('[data-im-resource]').waitFor();assert.equal(await grid.locator('[data-provider-card]').count(),10);
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no document overflow at '+width);
  const box=await tk.boundingBox(),picker=await tk.locator('.integration-resource-picker').boundingBox(),actions=await tk.locator('.integration-manager-actions').boundingBox();
  assert.ok(picker.y>=actions.y+actions.height-1);assert.ok(picker.x>=box.x&&picker.x+picker.width<=box.x+box.width+1);
  assert.match(await tk.innerText(),/Not available/);assert.match(await tk.innerText(),/user.info.stats/);
  if(process.env.UI_SCREENSHOT_DIR){fs.mkdirSync(process.env.UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.UI_SCREENSHOT_DIR,'connections-'+width+'.png'),fullPage:true})}
 }
 await tk.locator('[data-im-resource]').uncheck();await tk.getByRole('button',{name:'Save selection',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-provider-card="tiktok"] [data-im-save]')?.disabled);assert.deepEqual(saved,[]);
 await pager.getByRole('button',{name:'Next →',exact:true}).click();await grid.locator('[data-provider-card="email_sms"]').waitFor({state:'visible'});
 const email=grid.locator('[data-provider-card="email_sms"]');await email.locator('[data-connect-provider]').click();await email.getByText('Connect business email with Resend',{exact:true}).click();
 await email.getByLabel('Resend API key',{exact:true}).fill('test-write-only-key');await email.getByLabel('Verified sender email',{exact:true}).fill('hello@synthetic-business.org');
 assert.equal(await email.getByLabel('Resend API key',{exact:true}).getAttribute('type'),'password');
 await email.getByRole('button',{name:'Verify and save email',exact:true}).click();await email.getByText('Provider verified and saved.',{exact:false}).waitFor();
 assert.equal(await email.getByLabel('Resend API key',{exact:true}).inputValue(),'');assert.match(await pager.innerText(),/Page 2 of/);
 assert.match(await email.locator('[data-im-webhook]').innerText(),new RegExp('/resend/'+owner.org));
 assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage}).includes('test-write-only-key')),false);
 await email.getByRole('button',{name:'Troubleshoot',exact:true}).click();await email.locator('[data-im-assistant]').waitFor();assert.match(await email.locator('[data-im-assistant]').innerText(),/cannot approve provider apps/);
 await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8'));
 for(const theme of ['dark','light']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.waitForTimeout(450);const violations=await page.evaluate(async()=>{const result=await axe.run(document.querySelector('#integrations-view'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary,html:n.html}))}))});assert.deepEqual(violations,[],theme+' Connections accessibility');}
 assert.deepEqual(errors,[]);console.log('PASS Connections: 10 providers, pagination, three viewport sizes, truthful metrics, resource save, write-only credential form, clearing secrets, tenant webhook instructions and diagnostics.');
}finally{await browser?.close();await server.stop()}
