import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { message, formatMessage, localeCatalogue, localeDirection } from '../saas/locale-catalog.js';
const source=fs.readFileSync(new URL('../saas/workspace-locale.js',import.meta.url),'utf8').replace(/^import .*;\n/,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('language UI persists only validated API results and recovers from save failure',async()=>{
  const dom=new JSDOM(`<html><body><button id="workspace-language">Language</button><button id="logout" data-i18n="signOut">Sign out</button><dialog id="workspace-language-dialog"><form><h2 data-i18n="language"></h2><select name="locale"></select><p role="status"></p><button data-language-close type="button"></button><button type="submit" data-i18n="save"></button></form></dialog></body></html>`,{url:'https://oprun.example.test',runScripts:'outside-only'});
  const w=dom.window,requests=[];let locale='ur',fail=false;
  w.message=message;w.formatMessage=formatMessage;w.GDS_SESSION={};
  const dialog=w.document.querySelector('dialog');dialog.showModal=()=>{dialog.open=true};dialog.close=()=>{dialog.open=false};
  w.fetch=async(url,options)=>{requests.push({url,options});if(fail)return {ok:false};if(options.method==='PUT')locale=JSON.parse(options.body).locale;return {ok:true,json:async()=>({locale,direction:localeDirection(locale),locales:localeCatalogue(locale)})};};
  w.eval(source);await tick();
  assert.equal(w.document.documentElement.dir,'rtl');
  assert.equal(w.document.documentElement.lang,'en','untranslated legacy screens keep accurate language metadata');
  assert.equal(w.document.querySelector('#logout').textContent,'سائن آؤٹ');
  w.document.querySelector('#workspace-language').click();await tick();assert.equal(dialog.open,true);
  const form=w.document.querySelector('form');form.elements.locale.value='hi';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(w.document.documentElement.dir,'ltr');
  assert.equal(w.document.documentElement.dataset.preferredLocale,'hi');
  assert.equal(w.document.querySelector('#logout').textContent,'साइन आउट');
  const saved=requests.find(x=>x.options.method==='PUT');assert.deepEqual(JSON.parse(saved.options.body),{locale:'hi'});
  assert.equal(w.localStorage.length,0,'preferences do not leak through shared-device storage');
  fail=true;form.elements.locale.value='ja';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(w.document.documentElement.dataset.preferredLocale,'hi','failed saves cannot change language');
  assert.equal(form.querySelector('[type="submit"]').disabled,false);
  assert.equal(w.OprunLocale.currency(125,'AUD'),new Intl.NumberFormat('hi',{style:'currency',currency:'AUD'}).format(125));
  dom.window.close();
});

// CG-001 (ChatGPT review of CP-117): a save started in one business must never repaint, set status or re-enable the
// button after the user has switched business, signed out, or started a newer save.
async function raceHarness() {
  const dom=new JSDOM(`<html><body><button id="workspace-language">Language</button><button id="logout" data-i18n="signOut">Sign out</button><dialog id="workspace-language-dialog"><form><select name="locale"></select><p role="status"></p><button data-language-close type="button"></button><button type="submit"></button></form></dialog></body></html>`,{url:'https://oprun.example.test',runScripts:'outside-only'});
  const w=dom.window,pending=[];const state={workspace:'A'};
  const data=locale=>({locale,direction:localeDirection(locale),locales:localeCatalogue(locale)});
  w.message=message;w.formatMessage=formatMessage;w.GDS_SESSION={};
  w.fetch=async(_url,options={})=>{
    if(options.method==='PUT'){const locale=JSON.parse(options.body).locale;return await new Promise(resolve=>pending.push({locale,ok:()=>resolve({ok:true,json:async()=>data(locale)}),fail:()=>resolve({ok:false})}));}
    return {ok:true,json:async()=>data(state.workspace==='A'?'en-AU':'ja')};
  };
  const dialog=w.document.querySelector('dialog');dialog.showModal=()=>{dialog.open=true};dialog.close=()=>{dialog.open=false};
  w.eval(source);await tick();
  const form=w.document.querySelector('form'),status=w.document.querySelector('[role="status"]'),button=form.querySelector('[type="submit"]');
  const save=async locale=>{form.elements.locale.value=locale;form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();};
  const switchTo=async id=>{state.workspace=id;w.dispatchEvent(new w.Event('superpro:workspace-ready'));await tick();};
  const locale=()=>w.document.documentElement.dataset.preferredLocale;
  return {dom,w,pending,save,switchTo,locale,status,button};
}
for (const outcome of ['ok','fail']) test(`late ${outcome==='ok'?'success':'failure'} from business A cannot change business B`,async()=>{
  const h=await raceHarness();
  await h.save('ur');assert.equal(h.button.disabled,true);
  await h.switchTo('B');assert.equal(h.locale(),'ja');assert.equal(h.button.disabled,false,'B can save straight away');
  h.pending[0][outcome]();await tick();
  assert.equal(h.locale(),'ja');assert.equal(h.w.document.documentElement.dir,'ltr');
  assert.equal(h.status.textContent,'','no stale saved or error message');assert.equal(h.button.disabled,false);
  h.dom.window.close();
});
test('newest save wins when responses arrive in reverse order',async()=>{
  const h=await raceHarness();
  await h.save('ur');await h.save('hi');
  h.pending[1].ok();await tick();assert.equal(h.locale(),'hi');assert.equal(h.button.disabled,false);
  h.pending[0].ok();await tick();assert.equal(h.locale(),'hi','older Urdu save arrives late and is ignored');
  assert.equal(h.status.textContent,message('hi','notice'));
  h.dom.window.close();
});
test('older save cannot re-enable the button while a newer save is pending',async()=>{
  const h=await raceHarness();
  await h.save('ur');await h.save('hi');
  h.pending[0].ok();await tick();assert.equal(h.button.disabled,true);assert.equal(h.locale(),'en-AU');
  h.pending[1].ok();await tick();assert.equal(h.button.disabled,false);assert.equal(h.locale(),'hi');
  h.dom.window.close();
});
test('save finishing after sign-out is clicked does not repaint the page',async()=>{
  const h=await raceHarness();
  await h.save('ur');h.w.document.querySelector('#logout').click();
  h.pending[0].ok();await tick();
  assert.equal(h.locale(),'en-AU');assert.equal(h.status.textContent,'');
  h.dom.window.close();
});
