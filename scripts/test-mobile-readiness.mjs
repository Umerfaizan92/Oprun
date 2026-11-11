import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './test-server.mjs';

const s = await startServer();
let browser;
try {
  // Assert UI state directly: background requests are not a page-readiness signal.
  browser = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  for (const viewport of [{width:1363,height:936},{width:390,height:844},{width:768,height:1024}]) {
    const page = await browser.newPage({viewport,reducedMotion:'reduce'});
    for (const plan of ['operations','scale','starter','invalid']) {
      await page.goto(`${s.base}/saas/create-account.html?plan=${plan}`,{waitUntil:'domcontentloaded'});
      assert.equal(await page.locator('input[name="plan_id"]:checked').inputValue(), plan==='invalid'?'starter':plan);
    }
    const layout = await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,heading:document.querySelector('h1').getBoundingClientRect().top}));
    assert.ok(layout.scroll<=layout.width+1,`${viewport.width}: horizontal overflow`);
    if(viewport.width>900)assert.ok(layout.heading<400,'signup introduction must be above the fold');
    await page.goto(s.base+'/install',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Install Oprun',exact:true}).click();
    assert.ok(await page.locator('#install-detail').isVisible(),'install button must show actionable instructions without a browser prompt');
    await page.getByRole('button',{name:'Privacy and offline use',exact:true}).click();
    assert.match(await page.locator('#install-detail').innerText(),/private|financial/i);
    await page.close();
    console.log('PASS plan selection, registration layout and install guidance at',viewport.width);
  }
  const page = await browser.newPage();
  await page.goto(s.base+'/saas/sign-in.html',{waitUntil:'domcontentloaded'});
  assert.equal(await page.getByRole('link',{name:'Operator sign-in',exact:true}).count(),0);
  assert.equal(await page.getByRole('link',{name:'Install Oprun',exact:true}).count(),1);
  await page.goto(s.base+'/',{waitUntil:'domcontentloaded'});
  for(const [question,expected] of [['What happens when I miss a call?',/receptionist|enquiry/i],['How do approvals work?',/approv|review/i]]){
    await page.getByRole('button',{name:question,exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-ai-state]')?.textContent==='Ready' && document.querySelectorAll('[data-ai-log] > *').length>2);
    assert.match(await page.locator('[data-ai-log] > *').last().innerText(),expected);
  }
  console.log('PASS public guide fallback and operator navigation');
} finally { await browser?.close(); await s.stop(); }
