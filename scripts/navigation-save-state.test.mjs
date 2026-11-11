import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../saas/navigation-shell.js',import.meta.url),'utf8');
function fixture() {
 const handlers={},timers=[],calls=[];let saveStatus=200;
 const input={name:'note',type:'text',value:''};
 const form={tagName:'FORM',id:'synthetic',elements:[input],isConnected:true,closest:()=>true};input.form=form;
 const window={addEventListener(){},fetch:async(url,options)=>{calls.push({url,options});return {ok:url==='/background'?false:saveStatus===200};}};
 vm.runInNewContext(source,{window,document:{addEventListener:(name,fn)=>handlers[name]=fn},matchMedia:()=>({matches:false}),setTimeout:fn=>timers.push(fn),confirm:()=>false});
 const focus=()=>handlers.focusin({target:input});
 const submit=()=>handlers.submit({target:form});
 const flush=async()=>{await new Promise(setImmediate);while(timers.length)timers.shift()();await new Promise(setImmediate);};
 return {window,input,focus,submit,flush,calls,status:s=>saveStatus=s,edits:()=>window.SuperProNavigation.hasEdits()};
}
test('background failure or slow monitoring does not attach to a successful form save',async()=>{
 const f=fixture();f.focus();f.input.value='draft';assert.equal(f.edits(),true);
 f.submit();await f.window.fetch('/save',{method:'POST'});
 await f.window.fetch('/background',{method:'POST',superproBackground:true});await f.flush();assert.equal(f.edits(),false);
 assert.equal('superproBackground' in f.calls[1].options,false,'metadata is not forwarded to the transport');
 f.input.value='later edit';assert.equal(f.edits(),true);
});
test('failed save and unacknowledged form keep the warning despite background requests',async()=>{
 const f=fixture();f.focus();f.input.value='draft';f.status(500);f.submit();await f.window.fetch('/save',{method:'POST'});await f.flush();assert.equal(f.edits(),true);
 f.submit();await f.window.fetch('/background',{method:'POST',superproBackground:true});await f.flush();assert.equal(f.edits(),true);
});
test('edits made after submit remain dirty when the submitted snapshot is acknowledged',async()=>{
 const f=fixture();f.focus();f.input.value='submitted';f.submit();await f.window.fetch('/save',{method:'POST'});f.input.value='newer unsaved text';await f.flush();assert.equal(f.edits(),true);
});
