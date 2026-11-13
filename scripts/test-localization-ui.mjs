import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs, { existsSync } from 'node:fs';
import path from 'node:path';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';
const server = await startServer(); let browser;
try {
  const owner = await seedOwner(server);
  browser = await chromium.launch({headless:true,executablePath:process.env.UI_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  const ctx = await ownerContext(browser,server,owner,{viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.base+'/saas/workspace.html#today/home');
  await page.locator('#workspace-language').click();
  await page.locator('#workspace-language-dialog').waitFor({state:'visible'});
  assert.ok(await page.locator('#preferred-language option').count()>180);
  await page.locator('#preferred-language').selectOption('ur');
  await page.locator('#workspace-language-dialog button[type=submit]').click();
  await page.waitForFunction(()=>document.documentElement.dataset.preferredLocale==='ur');
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  assert.equal(await page.locator('#logout').textContent(),'سائن آؤٹ');
  assert.equal(await page.locator('#logout').getAttribute('lang'),'ur');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#workspace-language-dialog').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'workspace-language');
  await page.reload();
  await page.waitForFunction(()=>document.documentElement.dataset.preferredLocale==='ur');
  // Prompt 03, Today screen: translated text, icons kept, accessible names follow the text, no sideways scroll.
  const { MESSAGES } = await import('../saas/locale-catalog.js');
  await page.locator('#dashboard-view [data-i18n="today.kicker"]').waitFor({state:'visible'});
  for (const key of ['today.kicker','today.briefTitle','today.approvalNote','today.guidanceTitle','today.readinessTitle','today.askAi'])
    assert.equal(await page.locator(`#dashboard-view [data-i18n="${key}"]`).textContent(),MESSAGES.ur[key],key);
  assert.equal(await page.locator('#dashboard-view [data-i18n="today.askAi"]').evaluate(el=>el.parentElement.querySelector('svg')!==null),true,'icon kept beside translated text');
  assert.equal(await page.locator('#dashboard-view [data-i18n="today.openAi"]').evaluate(el=>el.tagName==='BUTTON'&&el.textContent),MESSAGES.ur['today.openAi'],'button text (its accessible name) is translated');
  // Prompt 03 L2: greeting and the live figures board are drawn by scripts in the reader's language.
  assert.equal(await page.locator('[data-i18n="today.greeting"]').textContent(),MESSAGES.ur['today.greeting']);
  await page.waitForFunction(()=>document.querySelectorAll('.gx-board .gx-tile:not(.gx-skeleton)').length>0);
  const boardText=await page.locator('.gx-board').innerText();
  for (const key of ['gx.inboxLabel','gx.approvalsLabel','gx.profitLabel']) assert.ok(boardText.includes(MESSAGES.ur[key]),key+' shown in Urdu');
  assert.match(await page.locator('.gx-live').innerText(),new RegExp(MESSAGES.ur['gx.live']));
  assert.equal(boardText.includes('Waiting for a reply'),false,'no English left on translated tiles');
  for (const word of ['Jobs','Team','Income','costs']) assert.equal(new RegExp(`\\b${word}\\b`).test(boardText),false,`business vocabulary "${word}" is translated`);
  assert.equal(await page.locator('.gx-board .gx-sub').first().evaluate(e=>getComputedStyle(e).direction+'/'+getComputedStyle(e).unicodeBidi),'rtl/isolate','translated tile lines keep right-to-left order even when they start with a number');
  // Switching language redraws the board from loaded figures, without a page reload.
  await page.evaluate(()=>{window.__noReload=true});
  await page.locator('#workspace-language').click();await page.locator('#preferred-language').selectOption('ar');
  await page.locator('#workspace-language-dialog button[type=submit]').click();
  await page.waitForFunction(text=>document.querySelector('.gx-board')?.innerText.includes(text),MESSAGES.ar['gx.inboxLabel']);
  assert.equal(await page.evaluate(()=>window.__noReload),true,'redrawn in place');
  await page.keyboard.press('Escape');
  await page.locator('#workspace-language').click();await page.locator('#preferred-language').selectOption('ur');
  await page.locator('#workspace-language-dialog button[type=submit]').click();
  await page.waitForFunction(text=>document.querySelector('.gx-board')?.innerText.includes(text),MESSAGES.ur['gx.inboxLabel']);
  await page.keyboard.press('Escape');
  // T-099: Action Centre and Workflow Guidance sections in Urdu, in reading order, and the AI plan asks for Urdu.
  for (const [tab, check] of [['action-centre',['cc.refresh','cc.plan']],['workflow-guidance',['wg.s.enquiry.name','wg.s.payment.name']]]) {
    await page.locator(`#dashboard-view [role=tab][data-section-key="${tab}"]`).click();
    for (const key of check) await page.waitForFunction(t=>document.querySelector('#dashboard-view')?.innerText.includes(t),MESSAGES.ur[key]);
  }
  await page.locator('[data-wg-toggle="enquiry"]').click();
  assert.equal(await page.locator('#wg-enquiry p').textContent(),MESSAGES.ur['wg.s.enquiry.what']);
  assert.equal(await page.locator('[data-cc-workflow] .wg-chip').first().evaluate(e=>getComputedStyle(e).unicodeBidi),'isolate','stage status keeps right-to-left order');
  let planBody=null;await page.route('**/api/saas/ai/threads',async route=>{planBody=route.request().postDataJSON();await route.fulfill({json:{ok:true,ai_response:'تجرباتی منصوبہ'}})});
  await page.locator('#dashboard-view [role=tab][data-section-key="action-centre"]').click();
  await page.locator('[data-cc-plan]').click();await page.locator('.cc-plan[data-state="done"]').waitFor();
  assert.match(planBody.message,/Answer in Urdu\./,'AI plan is requested in the reader\'s language');
  assert.equal(await page.locator('.cc-plan b').textContent(),MESSAGES.ur['cc.planTitle']);
  await page.unroute('**/api/saas/ai/threads');
  await page.locator('#dashboard-view [role=tab][data-section-key="business-overview"]').click();
  // Prompt 03 L4: the business menu is in Urdu and its links still navigate.
  await page.waitForFunction(t=>[...document.querySelectorAll('#business-navigation .navigation-label')].some(e=>e.textContent===t),MESSAGES.ur['nav.group.money']);
  const railLinks=await page.locator('#business-navigation a.navigation-page').allTextContents();
  assert.ok(railLinks.includes(MESSAGES.ur['nav.page.businessinvoices']),'menu page names in Urdu');
  assert.equal(railLinks.some(t=>/^(Invoices & Quotes|Enquiries|Bookings)$/.test(t)),false,'no English page names left in the menu');
  await page.evaluate(()=>location.hash='money/invoices');await page.locator('#businessinvoices-view').waitFor({state:'visible'});
  await page.waitForFunction(t=>document.body.innerText.includes(t),MESSAGES.ur['nav.flow.docsPayments']);
  await page.evaluate(()=>location.hash='today/home');await page.locator('#dashboard-view').waitFor({state:'visible'});
  // Mixed-language reading order (R14-02): untranslated English keeps its punctuation; translated Urdu stays right to left.
  const bidi=await page.evaluate(()=>{const s=e=>{const c=getComputedStyle(e);return c.direction+'/'+c.unicodeBidi};return{english:s(document.querySelector('#user-line')),urdu:s(document.querySelector('[data-i18n="today.askAi"]'))}});
  assert.equal(bidi.english,'rtl/plaintext','English text takes its own direction inside a right-to-left page');
  assert.equal(bidi.urdu,'rtl/isolate','translated text starting with Latin letters stays right to left');
  for (const width of [1440,768,390,360]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`Urdu Today page has no sideways scroll at ${width}px`);
  }
  await page.setViewportSize({width:360,height:900});
  await page.locator('#workspace-language').click();
  await page.locator('#workspace-language-dialog').waitFor({state:'visible'});
  const box=await page.locator('#workspace-language-dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=361,'language panel fits narrow phones');
  const overflow=await page.locator('#workspace-language-dialog').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false);
  // CG-002: screenshots only when asked for, into a folder the caller chooses (same convention as the other UI tests).
  if(process.env.UI_SCREENSHOT_DIR){fs.mkdirSync(process.env.UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.UI_SCREENSHOT_DIR,'localization-mobile-ur.png')});}
  await page.locator('#preferred-language').selectOption('ja');
  await page.locator('#workspace-language-dialog button[type=submit]').click();
  await page.waitForFunction(()=>document.documentElement.dataset.preferredLocale==='ja');
  assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
  assert.equal(await page.locator('#logout').textContent(),'Sign out','untranslated language has honest fallback');
  assert.equal(await page.evaluate(()=>window.OprunLocale.currency(123.45,'AUD')),new Intl.NumberFormat('ja',{style:'currency',currency:'AUD'}).format(123.45));
  const cross=await server.call('PUT','/api/saas/preferences/language',{cookie:owner.cookie,headers:{origin:'https://untrusted.example'},body:{locale:'en-AU'}});
  assert.equal(cross.status,403,'real application rejects cross-origin writes');
  assert.deepEqual(errors,[]);
  console.log('PASS: locale selector, Urdu RTL, save/reload, English fallback, 360px panel, keyboard focus, currency formatting and cross-origin write rejection.');
  await ctx.close();
} finally { if(browser)await browser.close();await server.stop(); }
