// Synthetic-only regression: every business route, bottom navigation, real section handlers and desktop fallback.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { startServer } from './test-server.mjs';
import { seedOwner, ownerContext } from './visual/session.mjs';
const ctx = {window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../saas/workspace-nav.js',import.meta.url),'utf8'),ctx);
const groups = JSON.parse(JSON.stringify(ctx.window.SuperProNav.DOMAINS));
const results = [], errors = [];
const s = await startServer(); let browser;
fs.mkdirSync('qa/visual/mobile-workspace',{recursive:true});
const report = (route,width,detail) => results.push({route,width,detail,result:'PASS'});
const settle = async p => {
  await p.waitForFunction(() => ![...document.querySelectorAll('.view:not([hidden]) p')].some(e=>e.getClientRects().length && /^Loading/.test(e.textContent.trim())));
  // Two animation frames let both the original section controller and dock reconcile.
  await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
};
try {
  browser = await chromium.launch({headless:true,...(process.env.UI_CHROMIUM_PATH ? {executablePath:process.env.UI_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']} : {})});
  const owner = await seedOwner(s);
  for (const width of [390,1440]) {
    const context=await ownerContext(browser,s,owner,{viewport:{width,height:844},reducedMotion:'reduce',...(width<761?{isMobile:true,hasTouch:true}:{})});
    const p=await context.newPage();p.setDefaultTimeout(12000);
    p.on('pageerror',e=>errors.push({width,error:e.message}));
    await p.goto(s.base+'/saas/workspace.html#today/home');
    await p.locator('#business-navigation .navigation-page').first().waitFor({state:'attached'});
    await p.locator('.app-footer .workspace-platform-brand').waitFor();
    assert.equal(await p.locator('.topbar-left .workspace-platform-brand').count(),0);
    assert.equal(await p.locator('#logout').count(),1);
    assert.equal(await p.locator('#business-navigation > #logout').count(),1);
    assert.equal(await p.locator('#workspace-command').count(),0);
    assert.equal(await p.locator('.app-footer .sp-global-trust-footer').count(),1);
    assert.equal(await p.locator('.app-footer .workspace-trust-links a').count(),4);
    for(const group of groups) for(const item of group.items) {
      await p.locator('.navigation-business-trigger').click();
      const toggle=p.locator(`[data-nav-group="${group.id}"]`);
      if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
      const link=p.locator(`#business-navigation [data-nav-page="${item.view}"]`);
      const more=link.locator('xpath=ancestor::details');if(await more.count() && !await link.isVisible())await more.locator('summary').click();
      await link.click();await p.locator('#'+item.view+'-view').waitFor();await settle(p);
      const dock=p.locator('#mobile-workspace-dock');
      assert.equal(await dock.isVisible(),width<761,item.path+' dock breakpoint');
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),item.path+' page overflow '+width);
      if(width<761){
        await p.locator(`.mobile-workspace-pages [data-dock-key="${item.view}"][aria-current="page"]`).waitFor();
        const peers=await p.locator('.mobile-workspace-pages a').getAttribute('href');assert.ok(peers);
        assert.equal(await p.locator('.view:not([hidden]) .mobile-workspace-source:visible').count(),0);
        const sets=await p.locator('.mobile-workspace-section-group').count();
        for(let i=0;i<sets;i++){
          const row=p.locator('.mobile-workspace-section-group').nth(i);
          const labels=await row.locator('button').allTextContents();
          for(const label of labels){
            const b=p.locator('.mobile-workspace-section-group').nth(i).getByRole('button',{name:label,exact:true});
            if(!await b.count() || !await b.isEnabled())continue;
            await b.click();await settle(p);
            const selected=p.locator('.mobile-workspace-section-group').nth(i).getByRole('button',{name:label,exact:true});
            assert.equal(await selected.getAttribute('aria-current'),'location',item.path+' '+label+' active');
            const state=await selected.evaluate(e=>{const [_,i,j]=e.dataset.dockKey.split('-');const source=document.getElementById('mobile-workspace-dock')._sources[+i]?.buttons[+j];return {selected:source?.getAttribute('aria-selected'),current:source?.getAttribute('aria-current'),connected:source?.isConnected}});
            assert.ok(state.connected && (state.selected==='true'||state.current),item.path+' '+label+' real handler');
            report(item.path,width,'Section: '+label);
          }
        }
        const geometry=await dock.boundingBox();assert.ok(Math.abs(geometry.y+geometry.height-844)<2,item.path+' dock fixed to bottom');
      } else {
        const lists=p.locator('.view:not([hidden]) [role=tablist]');
        for(const list of await lists.all())if(await list.isVisible()){
          for(const label of await list.getByRole('tab').allTextContents()){
            const b=list.getByRole('tab',{name:label,exact:true});if(!await b.count()||!await b.isVisible()||!await b.isEnabled())continue;
            await b.click();await settle(p);assert.equal(await b.getAttribute('aria-selected'),'true');report(item.path,width,'Desktop section: '+label);
          }
        }
      }
      report(item.path,width,'Route, permissions-filtered current area, layout and footer');
      if(['dashboard','onboarding','integrations','finance','mail'].includes(item.view))await p.screenshot({path:`qa/visual/mobile-workspace/${item.view}-${width}.png`,fullPage:true});
    }
    // Real persistent form state survives section switches and a deep-link reload restores the section.
    await p.goto(s.base+'/saas/workspace.html#money/ledger?section=costs');await settle(p);
    const choose=label=>width<761?p.locator('.mobile-workspace-sections').getByRole('button',{name:label,exact:true}):p.getByRole('tab',{name:label,exact:true});
    await choose('Costs & overheads').click();await p.locator('#fin-overhead-form [name=name]').fill('Synthetic unsaved cost');
    await choose('Overview').click();await choose('Costs & overheads').click();
    assert.equal(await p.locator('#fin-overhead-form [name=name]').inputValue(),'Synthetic unsaved cost');
    await p.locator('#fin-overhead-form').evaluate(f=>f.reset());await p.reload();await settle(p);await p.locator('[data-fin-tab=costs][aria-selected=true]').waitFor({state:'attached'});
    if(width<761){
      await p.locator('.mobile-workspace-pages [data-dock-key=ask]').click();await p.locator('#gds-copilot .copilot-panel').waitFor();
      const panel=await p.locator('#gds-copilot .copilot-panel').boundingBox(),dock=await p.locator('#mobile-workspace-dock').boundingBox();assert.ok(panel.y+panel.height<=dock.y,'AI panel clears dock');
      await p.locator('[data-copilot-close]').click();
      await p.locator('.mobile-workspace-pages [data-dock-key=chat]').click();await p.locator('#gds-staff-chat .sc-panel').waitFor();
      await p.screenshot({path:'qa/visual/mobile-workspace/chat-390.png',fullPage:true});
    }
    report('money/ledger',width,'Unsaved form retained; section deep link reload');
    await context.close();
  }
  assert.deepEqual(errors,[],'No browser runtime errors');
  fs.writeFileSync('qa/reports/mobile-workspace.json',JSON.stringify({base:process.env.GIT_BASE_SHA||'41600c6',results,errors},null,2)+'\n');
  console.log(`PASS: ${results.length} route/section/layout checks across ${groups.flatMap(g=>g.items).length} business pages at 390px and 1440px`);
}catch(error){fs.writeFileSync('qa/reports/mobile-workspace.json',JSON.stringify({results,errors,failure:error.stack},null,2)+'\n');throw error}
finally{await browser?.close();await s.stop()}
