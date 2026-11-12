// Density report (frontend transformation batch 2): page-heading height and where content starts on every Business
// Workspace page at 1440px and 390px, plus sideways-scroll check. Usage: node scripts/report-density.mjs out.json
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import {startServer} from './test-server.mjs';
import {seedOwner,ownerContext} from './visual/session.mjs';
const server=await startServer();const browser=await chromium.launch();const out={};
try{const owner=await seedOwner(server);
for(const vp of [{width:1440,height:900},{width:390,height:844}]){const ctx=await ownerContext(browser,server,owner,{viewport:vp,reducedMotion:'reduce'});const page=await ctx.newPage();
await page.goto(server.base+'/saas/workspace.html#today/home');await page.waitForTimeout(1500);
const paths=await page.evaluate(()=>window.SuperProNav.DOMAINS.flatMap(d=>d.items).map(i=>i.path));
for(const p of paths){await page.evaluate(x=>location.hash=x,p);await page.waitForTimeout(250);
out[vp.width+' '+p]=await page.evaluate(()=>{const v=document.querySelector('#workspace .view:not([hidden])');if(!v)return null;const ph=v.querySelector(':scope>.page-heading');const c=[...v.querySelectorAll(':scope>*')].find(e=>e.offsetParent&&!e.matches('.page-heading,.context-section-tabs,.view-empty-guide'));return {head:ph?Math.round(ph.getBoundingClientRect().height):0,content:c?Math.round(c.getBoundingClientRect().top+scrollY):0,wide:document.documentElement.scrollWidth>innerWidth+1}})}
await ctx.close()}
writeFileSync(process.argv[2],JSON.stringify(out));console.log(Object.keys(out).length)
}finally{await browser.close();await server.stop();}
