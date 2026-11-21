import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {randomUUID} from 'node:crypto';
const pause=()=>new Promise(r=>setTimeout(r,0));
test('creative draft saves attachments and voice state, preserves Unicode and ignores a response after disposal',async()=>{
 const dom=new JSDOM('<article id="ai-video-panel"><form id="aiv-form"><section class="ms-guided-step"><textarea id="aiv-idea"></textarea><textarea id="aiv-prompt"></textarea><select id="aiv-engine"><option value="test">Test</option></select></section></form></article>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;w.crypto.randomUUID=randomUUID;w.structuredClone=structuredClone;let resolveSave,body;
 const el=(tag,props={},...kids)=>{const n=w.document.createElement(tag);for(const [k,v]of Object.entries(props)){if(v===false)continue;if(k==='text')n.textContent=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v===true?'':v)}for(const k of kids.flat())if(k)n.append(k);return n};
 w.SuperProUI={el,note(){},api:async(path,opt)=>{if(opt?.method==='PUT'){body=JSON.parse(opt.body);return new Promise(r=>resolveSave=r)}return {projects:[]}}};
 w.eval(fs.readFileSync('saas/workspace-studio-projects.js','utf8'));const panel=w.document.querySelector('article'),ref=randomUUID(),voice=randomUUID();const controller=w.OprunStudioProjects.create({panel,capture:()=>({reference_media_ids:[ref],narration_media_id:voice,voice_mode:'record',shape:'16:9'})});
 const idea=panel.querySelector('#aiv-idea');idea.value='میرے ورکشاپ کی ویڈیو';idea.dispatchEvent(new w.Event('input',{bubbles:true}));panel.querySelector('[aria-label="Video script"]').value='हिंदी اردو English';
 [...panel.querySelectorAll('button')].find(b=>b.textContent==='Save project').click();await pause();assert.deepEqual(body.document.media_ids,[ref,voice]);assert.equal(body.document.idea,idea.value);assert.equal(body.document.script,'हिंदी اردو English');assert.equal(JSON.parse(body.document.fields['studio-state']).shape,'16:9');
 controller.destroy();resolveSave({version:1});await pause();assert.equal(panel.querySelector('.ms-savebar'),null);assert.equal(panel.querySelector('.ms-planning'),null);dom.window.close();
});
test('late transcription never overwrites captions after source changes or editor reset',async()=>{
 const dom=new JSDOM('<textarea id="captions">0 | 1 | Original</textarea><div id="host"></div>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;w.crypto.randomUUID=randomUUID;w.confirm=()=>true;let resolve,source='source-a';
 const el=(tag,props={},...kids)=>{const n=w.document.createElement(tag);for(const [k,v]of Object.entries(props)){if(v===false||v==null)continue;if(k==='text')n.textContent=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v===true?'':v)}for(const k of kids.flat())if(k)n.append(k);return n};
 w.SuperProUI={el,note(){},role:()=> 'owner',api:()=>new Promise(r=>resolve=r)};w.eval(fs.readFileSync('saas/workspace-studio-audio.js','utf8'));const field=w.document.querySelector('textarea'),controller=w.OprunStudioAudio.create({captionField:field,source:()=>source,changed(){}});w.document.querySelector('#host').append(controller.element);const button=[...controller.element.querySelectorAll('button')].find(b=>b.textContent==='Transcribe to draft captions');button.click();await pause();source='source-b';resolve({captions:[{start:0,end:1,text:'Previous source'}],note:'Review timing'});await pause();assert.equal(field.value,'0 | 1 | Original');assert.equal(controller.element.querySelector('[aria-label="AI caption draft"]').value,'0 | 1 | Previous source');
 button.click();await pause();controller.reset();resolve({captions:[{start:0,end:1,text:'Discarded'}]});await pause();assert.equal(field.value,'0 | 1 | Original');assert.equal(controller.element.querySelector('[aria-label="AI caption draft"]'),null);controller.destroy();dom.window.close();
});
