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
