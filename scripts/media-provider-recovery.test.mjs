import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

test('provider billing recovery keeps drafts and tenant state, rejects bad checks, and never resubmits without explicit approval',async t=>{
  let checkStatus=200,renderStatus=402,speechStatus=402,checks=0,renders=0,speech=0;
  const upstream=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
    let status=200,data={models:[]};
    if(req.url.includes('/models')){checks++;status=checkStatus}
    else if(req.url.endsWith('/interactions')&&raw.includes('gemini-3.5-transcribe')){speech++;status=speechStatus;data={steps:[{type:'model_output',content:[{type:'text',text:'میرے ٹرک کی پالش دکھائیں'}]}]}}
    else if(req.url.endsWith('/interactions')){renders++;status=renderStatus;data={id:'accepted-task',status:'in_progress'}}
    else{status=404}
    res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(status>=400?{error:{message:'sensitive-upstream-echo'}}:data));
  })});await new Promise(r=>upstream.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${upstream.address().port}`;
  const s=await startServer({GEMINI_API_BASE_URL:base,AI_TTS_PROVIDER_BASE_URL:base,AI_TTS_API_KEY:'synthetic-speech-fixture',AI_VIDEO_POLL_MS:'60000',AI_VIDEO_RATE_LIMIT:'200'});
  t.after(async()=>{await s.stop();await new Promise(r=>upstream.close(r))});
  const a=await seedOwner(s,{business:'Tenant A'}),b=await seedOwner(s,{business:'Tenant B',email:'recovery-b@example.test'});
  const A=(m,u,body)=>s.call(m,u,{cookie:a.cookie,body}),B=(m,u,body)=>s.call(m,u,{cookie:b.cookie,body});
  const key={api_key:'synthetic-google-fixture'},project={engine:'google:gemini-omni-1.2-flash',prompt:'A clear product demonstration in a workshop.',aspect_ratio:'9:16',total_seconds:30};
  for(const [upstreamStatus,code] of [[402,'BILLING_REQUIRED'],[429,'QUOTA_EXCEEDED'],[401,'AUTH_RECONNECT'],[503,'PROVIDER_UNAVAILABLE']]){
    checkStatus=upstreamStatus;const r=await A('POST','/api/saas/ai-video/providers/google',key);assert.equal(r.json.error_code,code);assert.ok(!r.text.includes('sensitive-upstream-echo'));assert.equal((await A('GET','/api/saas/ai-video')).json.providers.google.connected,false);
  }
  checkStatus=200;assert.equal((await A('POST','/api/saas/ai-video/providers/google',key)).status,200);
  assert.equal((await A('GET','/api/saas/ai-video')).json.providers.google.readiness,'credential_valid');
  let r=await A('POST','/api/saas/ai-video/projects',project);assert.equal(r.status,402);assert.equal(r.json.error_code,'BILLING_REQUIRED');assert.equal(renders,1);
  let state=(await A('GET','/api/saas/ai-video')).json;assert.equal(state.providers.google.readiness,'billing_required');assert.equal(state.projects.length,1);assert.equal(state.projects[0].error_code,'BILLING_REQUIRED');assert.equal(state.projects[0].title,project.prompt);const id=state.projects[0].id;
  r=await A('POST','/api/saas/ai-video/providers/google/check',{});assert.equal(r.status,200);assert.equal(r.json.providers.google.readiness,'billing_required','listing models cannot prove billing recovered');
  assert.equal((await A('POST','/api/saas/ai-video/projects',project)).status,402);assert.equal(renders,1,'known blocked provider is not submitted again');
  assert.equal((await A('POST',`/api/saas/ai-video/projects/${id}/continue`,{})).status,402);assert.equal(renders,1);
  assert.equal((await B('POST','/api/saas/ai-video/providers/google/check',{})).status,404);assert.equal((await B('POST',`/api/saas/ai-video/projects/${id}/continue`,{billing_retry_confirmed:true})).status,404);assert.equal((await B('GET','/api/saas/ai-video')).json.providers.google.connected,false);
  const db=new Database(s.dbPath);db.prepare("UPDATE memberships SET role='manager' WHERE organisation_id=? AND user_id=?").run(a.org,a.uid);
  assert.equal((await A('POST',`/api/saas/ai-video/projects/${id}/continue`,{billing_retry_confirmed:true})).status,403);assert.equal((await A('POST','/api/saas/ai-video/providers/google/check',{})).status,403);assert.equal(renders,1);
  db.prepare("UPDATE memberships SET role='owner' WHERE organisation_id=? AND user_id=?").run(a.org,a.uid);db.close();
  renderStatus=200;r=await A('POST',`/api/saas/ai-video/projects/${id}/continue`,{billing_retry_confirmed:true});assert.equal(r.status,200,r.text);assert.equal(renders,2,'only explicit retry creates a second paid task');
  assert.equal((await A('GET','/api/saas/ai-video')).json.projects[0].id,id,'retry retains original project');
  // Real multipart input to the server; local provider mock, not a funded recognition claim.
  const speechServer=await startServer({FREE_AI_MODE:'1',GEMINI_API_KEY:'speech-fixture-key',GEMINI_API_BASE_URL:base});t.after(()=>speechServer.stop());const speaker=await seedOwner(speechServer,{business:'Speech tenant'});
  const form=()=>{const f=new FormData();f.append('audio',new Blob([Buffer.alloc(1000,1)],{type:'audio/mp4'}),'speech.m4a');f.append('language','auto');return f};
  let sr=await fetch(speechServer.base+'/api/saas/voice/transcribe',{method:'POST',headers:{origin:speechServer.base,cookie:speaker.cookie},body:form()}),body=await sr.json();assert.equal(sr.status,402);assert.equal(body.error_code,'SPEECH_BILLING_REQUIRED');assert.equal(body.fallback,'browser');assert.equal(speech,1);assert.ok(!JSON.stringify(body).includes('sensitive-upstream-echo'));assert.ok(!speechServer.log().includes('sensitive-upstream-echo'));
  speechStatus=200;sr=await fetch(speechServer.base+'/api/saas/voice/transcribe',{method:'POST',headers:{origin:speechServer.base,cookie:speaker.cookie},body:form()});body=await sr.json();assert.equal(sr.status,200);assert.equal(body.text,'میرے ٹرک کی پالش دکھائیں');assert.equal(speech,2);
  assert.equal((await B('GET','/api/saas/ai-video')).json.unified_ui,false,'new UI defaults off');
  assert.equal((await B('POST','/api/saas/ai-video/projects',{...project,organisation_id:a.org})).status,400,'client tenant identity is never accepted');
  const assetDb=new Database(s.dbPath),asset='tenant-a-private-asset';assetDb.prepare("INSERT INTO tenant_media(id,organisation_id,original_name,stored_name,mime_type,kind,size_bytes,created_at) VALUES(?,?,'private.jpg','private.jpg','image/jpeg','photo',10,?)").run(asset,a.org,new Date().toISOString());assetDb.close();
  assert.equal((await B('GET',`/api/saas/media/${asset}/file`)).status,404);assert.equal((await B('DELETE',`/api/saas/media/${asset}`)).status,404);
  await B('POST','/api/saas/ai-video/providers/google',key);const spent=renders;
  const foreign=await B('POST','/api/saas/ai-video/projects',{...project,reference_media_ids:[asset]}),missing=await B('POST','/api/saas/ai-video/projects',{...project,reference_media_ids:['missing-asset']});assert.equal(foreign.status,400,'foreign media rejected before vendor spend');assert.equal(foreign.json.error,missing.json.error,'cannot discover whether another tenant asset exists');assert.equal(renders,spent);
  const before=checks;assert.equal((await s.call('POST','/api/saas/ai-video/providers/google/check',{body:{}})).status,401);assert.equal(checks,before);
});
