// Direction A acceptance: one creator, real final playback, preserved drafts.
// Vendor is local synthetic footage; not funded vendor or native speech proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {startServer} from './test-server.mjs';
import {seedOwner,ownerContext} from './visual/session.mjs';
import {ffmpegPath} from '../src/media-tools.js';
const shot=async(page,name)=>{if(process.env.UI_SCREENSHOT_DIR){fs.mkdirSync(process.env.UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.UI_SCREENSHOT_DIR,name),fullPage:false})}};
const require=createRequire(import.meta.url),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'studio-guided-')),clip=path.join(tmp,'clip.mp4');
execFileSync(ffmpegPath(),['-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=180x320:rate=30','-t','15','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p',clip]);const data=fs.readFileSync(clip).toString('base64');
let sequence=0;
const upstream=http.createServer((req,res)=>{req.resume();req.on('end',()=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(req.url.includes('/models')?{models:[]}:req.method==='POST'?{id:`task-${++sequence}`,status:'in_progress'}:{status:'completed',steps:[{type:'model_output',content:[{type:'video',mime_type:'video/mp4',data}]}]}))})});
await new Promise(r=>upstream.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${upstream.address().port}`;
const s=await startServer({STUDIO_UNIFIED_UI:'1',GEMINI_API_BASE_URL:base,AI_VIDEO_POLL_MS:'2000',AI_VIDEO_RATE_LIMIT:'200'});let browser;
try{
 const owner=await seedOwner(s);browser=await chromium.launch({headless:true,...(process.env.UI_CHROMIUM_PATH?{executablePath:process.env.UI_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});const ctx=await ownerContext(browser,s,owner),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});await page.goto(s.base+'/saas/workspace.html#growth/media');
 const nav=page.getByRole('navigation',{name:'Media Studio views'}),panel=page.locator('#ai-video-panel');await nav.waitFor();
 assert.equal(await page.locator('#video-form').isVisible(),false);assert.equal(await page.locator('.studio-workflow').isVisible(),false);assert.equal(await page.locator('#aiv-idea').count(),1);
 await nav.getByRole('button',{name:'Connections & billing',exact:true}).click();await panel.locator('.aiv-provider').filter({hasText:'Google'}).getByRole('button',{name:'Connect',exact:true}).click();await page.locator('#aiv-key').fill('synthetic-guided-key');await page.getByRole('button',{name:'Check and save',exact:true}).click();await panel.getByText('Connected · key …-key').waitFor();
 await nav.getByRole('button',{name:'Create',exact:true}).click();await page.locator('#aiv-idea').fill('Show the truck polishing process in our workshop');await page.locator('#aiv-prompt').fill('A continuous truck polishing demonstration with clear product details, natural lighting and smooth camera movement.');
 await shot(page,'guided-brief-phone.png');
 await panel.getByRole('button',{name:'Next',exact:true}).click();await panel.getByRole('heading',{name:'2. Attachments',exact:true}).waitFor();
 await panel.getByRole('button',{name:'Next',exact:true}).click();await page.locator('#aiv-duration').selectOption('custom');await page.locator('#aiv-custom-duration').fill('1');await page.locator('#aiv-resolution').selectOption('720p');await shot(page,'guided-production-phone.png');
 await panel.getByRole('button',{name:'Back',exact:true}).click();await panel.getByRole('button',{name:'Next',exact:true}).click();assert.equal(await page.locator('#aiv-custom-duration').inputValue(),'1','step navigation preserves settings');
 await panel.getByRole('button',{name:'Next',exact:true}).click();await panel.getByRole('button',{name:'Generate video',exact:true}).click();
 const video=panel.locator('.aiv-job.succeeded video');await video.waitFor({timeout:120000});const result=await video.evaluate(async v=>{await new Promise(r=>v.readyState>=1?r():v.addEventListener('loadedmetadata',r,{once:true}));v.muted=true;await v.play();await new Promise(r=>setTimeout(r,500));return {duration:v.duration,time:v.currentTime}});assert.ok(Math.abs(result.duration-60)<0.2);assert.ok(result.time>0.1);await shot(page,'guided-output-phone.png');
 await nav.getByRole('button',{name:'Library',exact:true}).click();await page.locator('.source-library-panel .media-ai-badge').first().waitFor();await page.locator('.source-library-panel .media-pick').first().click();await page.locator('#aiv-guides .mp-strip li').waitFor({state:'attached'});await nav.getByRole('button',{name:'Projects',exact:true}).click();assert.equal(await panel.locator('.ms-legacy').count(),1);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'guided layout fits '+width)}
 await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8'));const issues=await page.evaluate(async()=>{const r=await window.axe.run(document.querySelector('#video-view'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.filter(x=>['serious','critical'].includes(x.impact)).map(x=>x.id)});assert.deepEqual(issues,[]);assert.deepEqual(errors,[]);
 console.log('Guided Media Studio: one active creator, reversible settings steps,60-second final playback, shared library, mobile layouts and accessibility PASS.');
}finally{await browser?.close();await s.stop();await new Promise(r=>upstream.close(r));fs.rmSync(tmp,{recursive:true,force:true})}
