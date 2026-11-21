import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const guided=fs.readFileSync(new URL('../saas/workspace-media-guided.js',import.meta.url),'utf8');
const video=fs.readFileSync(new URL('../saas/workspace-ai-video.js',import.meta.url),'utf8');
const helpers=fs.readFileSync(new URL('../saas/workspace-ui.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const dom=new JSDOM('<main><section id="video-view"><div class="page-heading"><h1>Old studio</h1></div><div class="studio-workflow">Old steps</div><article class="source-library-panel">Private library</article><div class="content-studio-grid"><form id="video-form"></form></div></section><p id="notice"></p><button id="logout">Sign out</button></main>',{url:'https://app.example.test',runScripts:'outside-only'}),w=dom.window;
 w.GDS_SESSION={user:{role:'owner'}};w.HTMLElement.prototype.scrollIntoView=()=>{};w.eval(helpers);w.eval(guided);return {dom,w,close:()=>dom.window.close()};
}
const state=extra=>({providers:{},engines:[],projects:[],jobs:[],voices:[],unified_ui:false,...extra});

test('guided surface moves original controls into sequential steps and restores the legacy layout on flag-off',async()=>{
 const f=fixture(),{w}=f;try{
  const view=w.document.getElementById('video-view'),panel=w.document.createElement('article');panel.id='ai-video-panel';
  panel.innerHTML='<div id="aiv-providers"></div><div id="aiv-connect" hidden></div><form id="aiv-form"><label>Idea<textarea id="aiv-idea"></textarea></label><label>Prompt<textarea id="aiv-prompt"></textarea></label><div class="aiv-field"><div id="aiv-guides"></div></div><label>Model<select id="aiv-engine"><option>Model</option></select></label><fieldset class="aiv-voice"><legend>Voice</legend></fieldset><button type="submit">Generate video</button></form><div class="aiv-jobs-head">Your videos</div><div id="aiv-jobs"></div>';
  view.querySelector('.source-library-panel').after(panel);w.SuperProUI.api=async()=>({jobs:[{quality:'720p',edit_spec:{style_prompt:'Saved legacy draft'}}]});
  const input=panel.querySelector('#aiv-idea');input.value='Truck polishing demonstration';let allowed=true;
  const c=w.OprunMediaGuided.create({panel,library:view.querySelector('.source-library-panel'),canNavigate:()=>allowed});
  assert.equal(view.querySelector('.content-studio-grid').hidden,true);assert.equal(view.querySelector('.studio-workflow').hidden,true);assert.equal(w.document.querySelectorAll('#aiv-idea').length,1);
  const next=[...panel.querySelectorAll('button')].find(b=>b.textContent==='Next');next.click();assert.equal(panel.querySelector('[aria-label=Attachments]').hidden,false);assert.equal(input.value,'Truck polishing demonstration');
  allowed=false;next.click();assert.equal(panel.querySelector('[aria-label=Attachments]').hidden,false);allowed=true;
  c.show('library');assert.equal(panel.hidden,true);assert.equal(view.querySelector('.source-library-panel').hidden,false);
  c.show('projects');await tick();assert.match(panel.querySelector('.ms-legacy').textContent,/not rendered videos/);assert.match(panel.querySelector('.ms-legacy').textContent,/Saved legacy draft/);
  c.destroy();assert.equal(view.querySelector('.content-studio-grid').hidden,false);assert.equal(panel.querySelector('#aiv-form').contains(input),true);assert.equal(input.value,'Truck polishing demonstration');assert.equal(view.querySelector('.ms-nav'),null);
 }finally{f.close()}
});

test('workspace change rejects stale project responses before rendering tenant data',async()=>{
 const f=fixture(),{w}=f;try{
  const pending=[];let handler;
  w.SuperProUI.onView=(_name,h)=>handler=h;w.SuperProUI.api=url=>url.endsWith('/ai-video')?new Promise(resolve=>pending.push(resolve)):Promise.resolve({media:[]});
  w.eval(video);const first=handler.enter();assert.equal(pending.length,1);
  w.dispatchEvent(new w.Event('superpro:workspace-ready'));const second=handler.enter();assert.equal(pending.length,2);
  pending[0](state({projects:[{id:'old-project',title:'TENANT A PRIVATE TITLE',status:'failed'}]}));await first;assert.ok(!w.document.body.textContent.includes('TENANT A PRIVATE TITLE'));
  pending[1](state());await second;assert.ok(!w.document.body.textContent.includes('TENANT A PRIVATE TITLE'));assert.equal(w.document.getElementById('aiv-idea').value,'');
 }finally{f.close()}
});

test('microphone permission resolving after workspace switch closes its tracks without uploading narration',async()=>{
 const f=fixture(),{w}=f;try{
  let handler,allow,stops=0,uploads=0,recorders=0;
  w.SuperProUI.onView=(_name,h)=>handler=h;w.SuperProUI.api=async url=>url.endsWith('/ai-video')?state():{media:[]};w.fetch=async()=>{uploads++;throw Error('Unexpected upload')};
  Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:()=>new Promise(r=>allow=r)}});w.MediaRecorder=class{constructor(){recorders++}};
  w.eval(video);await handler.enter();const mode=[...w.document.querySelectorAll('[role=radio]')].find(b=>b.textContent==='Record my voice');mode.click();
  const record=[...w.document.querySelectorAll('button')].find(b=>b.textContent==='Record');record.click();assert.equal(typeof allow,'function');
  w.dispatchEvent(new w.Event('superpro:workspace-ready'));allow({getTracks:()=>[{stop:()=>stops++}]});await tick();
  assert.equal(stops,1);assert.equal(recorders,0);assert.equal(uploads,0);
 }finally{f.close()}
});
