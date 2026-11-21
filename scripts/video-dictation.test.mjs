import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const source=fs.readFileSync(new URL('../saas/workspace-video-dictation.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
  const dom=new JSDOM('<button id="logout">Sign out</button><div id="host"></div><label>Idea<textarea id="idea" maxlength="2000"></textarea></label><label>Prompt<textarea id="prompt" maxlength="4000"></textarea></label>',{url:'https://app.example.test',runScripts:'outside-only'});
  const w=dom.window,requests=[],recognizers=[];let cancellations=0,listening=false;
  const el=(tag,props,...kids)=>{const e=w.document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(v===false||v==null)continue;if(k==='text')e.textContent=v;else if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?'':String(v))}for(const x of kids.flat())if(x)e.append(x);return e};
  w.SuperProUI={el,api:async()=>({locales:[{code:'ur-PK',label:'Urdu'},{code:'es-ES',label:'Spanish'}]})};
  w.MediaRecorder=class{};Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia(){}}});
  w.SuperProAIClient={listen:opts=>{listening=true;return new Promise((resolve,reject)=>requests.push({opts,resolve:r=>{listening=false;resolve(r)},reject}))},isListening:()=>listening,stopListening:cancel=>{if(cancel)cancellations++;listening=false}};
  w.SpeechRecognition=class{constructor(){recognizers.push(this)}start(){}stop(){this.onend?.()}abort(){this.aborted=true}};
  w.eval(source);const controller=w.OprunVideoDictation.create(w.document.getElementById('host'));
  const idea=w.document.getElementById('idea'),prompt=w.document.getElementById('prompt');controller.attach(idea,'idea');controller.attach(prompt,'prompt');
  const buttons=[...w.document.querySelectorAll('.aiv-dictate')],status=w.document.querySelector('[role=status]');
  return {w,dom,controller,idea,prompt,buttons,requests,recognizers,status,get cancellations(){return cancellations},close(){controller.cancel();dom.window.close()}};
}
test('automatic multilingual dictation inserts at selection, preserves original scripts and never submits a form',async()=>{
  for(const text of ['میرے ٹرک کی پالش دکھائیں','मेरे ट्रक की पॉलिश दिखाएँ','Show our truck polish','أظهر تلميع الشاحنة','Muestra nuestro trabajo']){
    const f=fixture();try{
      let submits=0;f.w.document.addEventListener('submit',()=>submits++);
      f.idea.value='Before after';f.idea.setSelectionRange(7,7);f.buttons[0].click();
      assert.equal(f.requests[0].opts.language,'auto');assert.equal(f.requests[0].opts.manual,true);
      f.requests[0].resolve({text});await tick();
      assert.equal(f.idea.value,`Before ${text} after`);assert.equal(f.idea.dir,'auto');assert.equal(submits,0);assert.match(f.status.textContent,/Speech inserted/);
    }finally{f.close()}
  }
});
test('new typing is preserved and speech needs an explicit review insertion',async()=>{
  const f=fixture();try{f.buttons[1].click();f.prompt.value='New edited direction';f.prompt.dispatchEvent(new f.w.Event('input'));f.requests[0].resolve({text:'spoken detail'});await tick();
    assert.equal(f.prompt.value,'New edited direction');assert.equal(f.w.document.querySelector('.aiv-dictation-review').hidden,false);
    f.prompt.setSelectionRange(f.prompt.value.length,f.prompt.value.length);
    [...f.w.document.querySelectorAll('button')].find(b=>b.textContent==='Insert reviewed speech').click();assert.equal(f.prompt.value,'New edited direction spoken detail');
  }finally{f.close()}
});
test('oversized speech remains editable in review and is never silently truncated',async()=>{
  const f=fixture();try{f.idea.maxLength=5;f.buttons[0].click();f.requests[0].resolve({text:'speech too long'});await tick();assert.equal(f.idea.value,'');
    const draft=f.w.document.querySelector('[aria-label="Speech to review"]');assert.equal(draft.value,'speech too long');draft.value='short';
    [...f.w.document.querySelectorAll('button')].find(b=>b.textContent==='Insert reviewed speech').click();assert.equal(f.idea.value,'short');
  }finally{f.close()}
});
for(const event of ['pagehide','superpro:workspace-ready','gds:viewchange','logout'])test(`${event} cancels audio and rejects late transcripts`,async()=>{
  const f=fixture();try{f.buttons[0].click();if(event==='logout')f.w.document.getElementById('logout').click();else f.w.dispatchEvent(new f.w.CustomEvent(event,{detail:{view:'dashboard'}}));
    assert.equal(f.cancellations,1);f.requests[0].resolve({text:'stale workspace speech'});await tick();assert.equal(f.idea.value,'');assert.equal(f.controller.isBusy(),false);
  }finally{f.close()}
});
test('explicit browser language, final-only transcript, and late recognition errors are isolated',async()=>{
  const f=fixture();try{f.w.document.getElementById('aiv-dictation-language').value='ur-PK';f.buttons[0].click();const r=f.recognizers[0];assert.equal(r.lang,'ur-PK');
    r.onresult({results:[Object.assign([{transcript:'فائنل'}],{isFinal:true}),Object.assign([{transcript:'interim'}],{isFinal:false})]});f.buttons[0].click();assert.equal(f.idea.value,'فائنل');
    f.buttons[1].click();r.onerror({error:'network'});assert.equal(f.controller.isBusy(),true);assert.equal(f.requests.length,0);
  }finally{f.close()}
});
test('permission and service errors keep existing text and re-enable retry',async()=>{
  const f=fixture();try{f.idea.value='Keep me';f.buttons[0].click();f.requests[0].reject({name:'NotAllowedError'});await tick();assert.equal(f.idea.value,'Keep me');assert.match(f.status.textContent,/denied/);assert.equal(f.buttons[0].disabled,false);
    f.buttons[0].click();f.requests[1].reject(new Error('provider quota'));await tick();assert.match(f.status.textContent,/available AI speech service/);assert.equal(f.idea.value,'Keep me');
  }finally{f.close()}
});
test('billing-blocked automatic speech exposes actionable fallback without changing typed text',async()=>{
  const f=fixture();try{f.idea.value='Keep the approved brief';f.buttons[0].click();f.requests[0].reject(Object.assign(new Error('Automatic speech needs billing attention. Choose a language for browser dictation.'),{code:'SPEECH_BILLING_REQUIRED'}));await tick();
    assert.equal(f.idea.value,'Keep the approved brief');assert.match(f.status.textContent,/billing attention/);assert.match(f.status.textContent,/No video generation was started/);assert.equal(f.controller.isBusy(),false);
    f.w.document.getElementById('aiv-dictation-language').value='ur-PK';f.buttons[0].click();const r=f.recognizers[0];r.onresult({results:[Object.assign([{transcript:'ورکشاپ'}],{isFinal:true})]});f.buttons[0].click();assert.match(f.idea.value,/ورکشاپ/);assert.equal(f.requests.length,1,'fallback chosen explicitly, not automatic paid substitution');
  }finally{f.close()}
});
