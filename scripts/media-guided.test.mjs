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
  const lib=view.querySelector('.source-library-panel');lib.classList.add('focus-inactive');view._superProSectionPanels=[lib,view.querySelector('.content-studio-grid')];let disposals=0,reinstalls=0;w.SuperProPageSections={dispose:()=>disposals++,install:()=>reinstalls++};
  const input=panel.querySelector('#aiv-idea');input.value='Truck polishing demonstration';let allowed=true;
  const c=w.OprunMediaGuided.create({panel,library:view.querySelector('.source-library-panel'),canNavigate:()=>allowed});
  assert.equal(view.querySelector('.content-studio-grid').hidden,true);assert.equal(view.querySelector('.studio-workflow').hidden,true);assert.equal(w.document.querySelectorAll('#aiv-idea').length,1);
  const next=[...panel.querySelectorAll('button')].find(b=>b.textContent==='Next');next.click();assert.equal(panel.querySelector('[aria-label=Attachments]').hidden,false);assert.equal(input.value,'Truck polishing demonstration');
  allowed=false;next.click();assert.equal(panel.querySelector('[aria-label=Attachments]').hidden,false);allowed=true;
  c.show('library');assert.equal(panel.hidden,true);assert.equal(view.querySelector('.source-library-panel').hidden,false);assert.equal(lib.classList.contains('focus-inactive'),false);assert.equal(disposals,1);
  c.show('projects');await tick();assert.match(panel.querySelector('.ms-legacy').textContent,/not rendered videos/);assert.match(panel.querySelector('.ms-legacy').textContent,/Saved legacy draft/);
  c.destroy();assert.equal(view.querySelector('.content-studio-grid').hidden,false);assert.equal(panel.querySelector('#aiv-form').contains(input),true);assert.equal(input.value,'Truck polishing demonstration');assert.equal(view.querySelector('.ms-nav'),null);assert.equal(reinstalls,1);
 }finally{f.close()}
});

test('workspace change rejects stale project responses before rendering tenant data',async()=>{
 const f=fixture(),{w}=f;try{
  const pending=[];let handler;
  w.SuperProUI.onView=(_name,h)=>handler=h;w.SuperProUI.api=url=>url.endsWith('/ai-video')?new Promise(resolve=>pending.push(resolve)):Promise.resolve({media:[]});
  w.eval(video);const first=handler.enter();assert.equal(pending.length,1);
  w.dispatchEvent(new w.Event('superpro:workspace-ready'));assert.equal(pending.length,2);
  pending[0](state({projects:[{id:'old-project',title:'TENANT A PRIVATE TITLE',status:'failed'}]}));await first;assert.ok(!w.document.body.textContent.includes('TENANT A PRIVATE TITLE'));
  pending[1](state());await tick();await tick();assert.ok(!w.document.body.textContent.includes('TENANT A PRIVATE TITLE'));assert.equal(w.document.getElementById('aiv-idea').value,'');
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
test('shared library drops stale tenant responses and routes unified picks into the creator',async()=>{
 const f=fixture(),{w}=f;try{
  const root=w.document.getElementById('video-view');root.insertAdjacentHTML('beforeend','<span id="library-count"></span><div id="media-library-grid"></div><input id="media-library-search"><select id="media-library-sort"><option value="recent">Recent</option></select><div id="library-selection"></div>');root.classList.add('ms-unified');
  const pending=[];let picked='';w.SuperProUI.api=()=>new Promise(resolve=>pending.push(resolve));w.addEventListener('oprun:studio-guide',e=>picked=e.detail.id);
  w.eval(fs.readFileSync(new URL('../saas/workspace-media.js',import.meta.url),'utf8'));
  w.dispatchEvent(new w.CustomEvent('gds:viewchange',{detail:{view:'video'}}));w.dispatchEvent(new w.Event('superpro:workspace-ready'));assert.equal(pending.length,4);
  pending[1]({metadata:[{media_id:'tenant-a',folder:'TENANT A PRIVATE FOLDER'}],usage:{files:1,bytes:1}});pending[0]({media:[{id:'tenant-a',original_name:'TENANT A PRIVATE',kind:'photo',size_bytes:1,created_at:'2026-01-01'}]});await tick();assert.ok(!w.document.body.textContent.includes('TENANT A PRIVATE'));
  pending[3]({metadata:[],usage:{files:1,bytes:1}});pending[2]({media:[{id:'tenant-b',original_name:'Tenant B photo',kind:'photo',size_bytes:1,created_at:'2026-01-01'}]});await tick();w.document.querySelector('.media-pick').click();assert.equal(picked,'tenant-b');assert.ok(!w.document.body.textContent.includes('TENANT A PRIVATE'));
 }finally{f.close()}
});

test('workspace switch closes full preview and clears private media metadata and callbacks',()=>{
 const f=fixture(),{w}=f;try{
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'))};
  w.eval(fs.readFileSync(new URL('../saas/media-viewer.js',import.meta.url),'utf8'));w.OprunMediaViewer.open([{id:'tenant-a',kind:'photo',original_name:'TENANT A PRIVATE'}],0,{onUse:()=>{throw Error('Old callback used')}});assert.match(w.document.body.textContent,/TENANT A PRIVATE/);
  w.dispatchEvent(new w.Event('superpro:workspace-ready'));assert.ok(!w.document.body.textContent.includes('TENANT A PRIVATE'));assert.equal(w.document.querySelector('.mv-dialog').open,false);assert.equal(w.document.querySelector('.mv-stage').children.length,0);assert.equal(w.document.querySelector('.mv-download').hasAttribute('href'),false);
 }finally{f.close()}
});

test('media picker rejects old workspace results and clears selected private assets',async()=>{
 const f=fixture(),{w}=f;try{
  const pending=[];w.fetch=()=>new Promise(resolve=>pending.push(resolve));w.eval(fs.readFileSync(new URL('../saas/media-picker.js',import.meta.url),'utf8'));
  const p=w.OprunMediaPicker.create({selected:[{id:'a',kind:'photo',name:'TENANT A PRIVATE'}]});w.document.body.append(p.element);p.element.querySelector('button.portal-button').click();assert.equal(pending.length,1);
  w.dispatchEvent(new w.Event('superpro:workspace-ready'));pending[0]({ok:true,json:async()=>({media:[{id:'a',kind:'photo',original_name:'TENANT A PRIVATE'}]})});await tick();assert.ok(!p.element.textContent.includes('TENANT A PRIVATE'));assert.deepEqual([...p.value()],[]);
 }finally{f.close()}
});
