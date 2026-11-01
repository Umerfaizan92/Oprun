import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import {createIntegrationRuntime} from '../src/integration-runtime.js';
import {createTenantTransports} from '../src/integration-transports.js';
import {createIntegrationInsights} from '../src/integration-insights.js';
import {startServer} from './test-server.mjs';
import {seedOwner} from './visual/session.mjs';

function fixture(){
 const db=new Database(':memory:');db.exec(`CREATE TABLE organisation_integrations(organisation_id TEXT,provider TEXT,status TEXT,settings_json TEXT,account_label TEXT,connected_at TEXT,updated_at TEXT,PRIMARY KEY(organisation_id,provider));CREATE TABLE comms_channels(organisation_id TEXT,channel TEXT,address TEXT,status TEXT,activated_at TEXT,created_at TEXT,UNIQUE(organisation_id,channel));`);
 for(const org of ['a','b'])for(const p of ['email_sms','website'])db.prepare('INSERT INTO organisation_integrations VALUES (?,?,\'not_connected\',\'{}\',NULL,NULL,NULL)').run(org,p);
 const calls=[],runtime=createIntegrationRuntime({env:{INTEGRATION_ENCRYPTION_KEY:'test-encryption-only'},fetchImpl:async(url,opt)=>{
  calls.push({url,auth:opt.headers.authorization});
  return String(url).includes('/domains')?Response.json({data:[{id:'d1',name:'business.example',status:'verified'}]}):Response.json({data:[{phone_number:'+61411111111'}]});
 }});
 let proof=[];const transports=createTenantTransports({db,runtime,lookupTxt:async()=>proof});
 return {db,calls,runtime,transports,proof:next=>proof=next};
}
test('workspace transport keys are encrypted, isolated and never fall back after disconnect',async()=>{
 const {db,calls,transports}=fixture();
 const meta=await transports.save('a','email',{api_key:'test-owned-email-key',sender:'hello@business.example'});
 assert.equal(JSON.stringify(meta).includes('test-owned-email-key'),false);
 const stored=db.prepare("SELECT settings_json FROM organisation_integrations WHERE organisation_id='a' AND provider='email_sms'").get().settings_json;
 assert.equal(stored.includes('test-owned-email-key'),false);
 assert.equal(transports.environment('a',{RESEND_API_KEY:'test-platform'}).RESEND_API_KEY,'test-owned-email-key');
 assert.equal(transports.environment('b',{RESEND_API_KEY:'test-platform'}).RESEND_API_KEY,'test-platform','legacy platform transport is explicitly separate');
 assert.equal(transports.credentials('b'),null);
 assert.equal(transports.environment('a',{PLATFORM_NOTICE_FROM:'platform@example.org',NOTIFY_FROM:'platform@example.org'}).PLATFORM_NOTICE_FROM,'hello@business.example','follow-ups keep the owned sender rather than inheriting the platform sender');
 await assert.rejects(()=>transports.save('b','email',{api_key:'test-second-key',sender:'hello@business.example'}),/another workspace/);
 assert.equal(calls[0].auth,'Bearer test-owned-email-key');
 db.prepare("UPDATE organisation_integrations SET status='not_connected',settings_json='{\"tenant_transport\":true}' WHERE organisation_id='a' AND provider='email_sms'").run();
 assert.throws(()=>transports.environment('a',{RESEND_API_KEY:'test-platform'}),/Reconnect/);
 assert.equal(transports.credentials('a'),null);db.close();
});
test('website ownership proof is workspace-specific and private destinations are refused',async()=>{
 const {db,transports,proof}=fixture();
 for(const url of ['http://business.example','https://127.0.0.1','https://intranet.local','https://u:p@business.example','https://business.example:444'])assert.throws(()=>transports.saveWebsite('a',url));
 const a=transports.saveWebsite('a','https://synthetic-business.org/path'),b=transports.saveWebsite('b','https://synthetic-business.org');
 assert.notEqual(a.verification_value,b.verification_value);
 proof([[b.verification_value]]);await assert.rejects(()=>transports.verifyWebsite('a'),/does not match/);
 proof([[a.verification_value]]);assert.equal((await transports.verifyWebsite('a')).verified,true);
 assert.equal(db.prepare("SELECT status FROM organisation_integrations WHERE organisation_id='b' AND provider='website'").get().status,'setup_ready');db.close();
});
test('insights retain unavailable counts and cannot use an account that differs from the selected resource',async()=>{
 const runtime=createIntegrationRuntime({env:{},fetchImpl:async()=>Response.json({data:{id:'other-user',public_metrics:{followers_count:999}}})});
 const service=createIntegrationInsights({runtime,env:{},db:null});
 const r=await service.fetch('x',{access_token:'test-private'},[{id:'selected-user',type:'x_account',label:'Own account'}]);
 assert.equal(r[0].status,'unavailable');assert.equal(r[0].metrics.length,0);
 const snap=await service.fetch('snapchat',{access_token:'test-private'},[{id:'own-profile',type:'snapchat_account',label:'Own profile'}]);
 assert.equal(snap[0].metrics[0].value,null);assert.match(snap[0].metrics[0].note,/Public Profile/);
});
test('real API OAuth callbacks respect the supplemental cookie, legacy TikTok callback and single-use state',async t=>{
 const s=await startServer({GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',TIKTOK_CLIENT_KEY:'test-client',TIKTOK_CLIENT_SECRET:'test-secret',TIKTOK_REDIRECT_URI:'http://localhost/api/tiktok/callback'});t.after(s.stop);
 const owner=await seedOwner(s);await s.call('GET','/api/saas/integrations/self-service',{cookie:owner.cookie});
 const begin=async provider=>{
  const res=await fetch(s.base+'/api/saas/integrations/self-service/'+provider+'/authorise',{method:'POST',headers:{cookie:owner.cookie,origin:s.base,'content-type':'application/json'},body:'{}'});
  assert.equal(res.status,200,await res.clone().text());const data=await res.json();return {state:new URL(data.authorize_url).searchParams.get('state'),cookie:res.headers.getSetCookie().find(c=>c.startsWith('sp_connect_'))};
 };
 const g=await begin('google_seo');assert.match(g.cookie,/SameSite=Lax/);assert.match(g.cookie,/Path=\/api\/saas\/integrations\/oauth\/google_seo\/callback/);
 const callback=async(path,f,cookie)=>fetch(s.base+path+'?state='+f.state+'&error=access_denied',{redirect:'manual',headers:cookie?{cookie:cookie.split(';')[0]}:{}});
 const path='/api/saas/integrations/oauth/google_seo/callback';
 assert.match((await callback(path,g)).headers.get('location'),/invalid/);
 assert.match((await callback(path,g,g.cookie)).headers.get('location'),/cancelled/);
 assert.match((await callback(path,g,g.cookie)).headers.get('location'),/invalid/);
 const tk=await begin('tiktok');assert.match(tk.cookie,/Path=\/api\/tiktok\/callback/);
 assert.match((await callback('/api/tiktok/callback',tk,tk.cookie)).headers.get('location'),/cancelled/);
});
test('signed tenant SMS webhook cannot update another workspace and routes only its owned recipient',async t=>{
 const key='test-webhook-encryption',s=await startServer({INTEGRATION_ENCRYPTION_KEY:key});t.after(s.stop);
 const a=await seedOwner(s),b=await seedOwner(s,{email:'second@business.example'});
 await s.call('GET','/api/saas/integrations/self-service',{cookie:a.cookie});await s.call('GET','/api/saas/integrations/self-service',{cookie:b.cookie});
 const db=new Database(s.dbPath);t.after(()=>db.close());const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 const raw=publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64');
 const runtime=createIntegrationRuntime({env:{INTEGRATION_ENCRYPTION_KEY:key}}),now=new Date().toISOString();
 db.prepare("UPDATE organisation_integrations SET status='connected',settings_json=? WHERE organisation_id=? AND provider='email_sms'").run(JSON.stringify({tenant_transport:true,token_bundle:runtime.encryptBundle({sms:{api_key:'test-sms-key',number:'+61411111111',public_key:raw}})}),a.org);
 db.prepare("INSERT INTO comms_channels(organisation_id,channel,address,status,activated_at,created_at) VALUES (?,'sms','+61411111111','active',?,?)").run(a.org,now,now);
 for(const [org,id]of [[a.org,'owned'],[b.org,'other']])db.prepare("INSERT INTO communication_deliveries(id,organisation_id,channel,recipient,provider,provider_id,status,category,subject,created_at) VALUES (?,?,'sms','+61422222222','telnyx',?,'accepted','message','test',?)").run(crypto.randomUUID(),org,id,now);
 const hook=async(event_type,payload,signatureKey=privateKey)=>{
  const body=JSON.stringify({data:{id:crypto.randomUUID(),event_type,payload}}),ts=String(Math.floor(Date.now()/1000)),sig=crypto.sign(null,Buffer.from(ts+'|'+body),signatureKey).toString('base64');
  const res=await fetch(s.base+'/api/webhooks/communications/telnyx/'+a.org,{method:'POST',headers:{'content-type':'application/json','telnyx-timestamp':ts,'telnyx-signature-ed25519':sig},body});return {status:res.status,json:await res.json()};
 };
 assert.equal((await hook('message.finalized',{id:'other',to:[{status:'delivered'}]})).json.routed,false);
 assert.equal(db.prepare("SELECT status FROM communication_deliveries WHERE provider_id='other'").get().status,'accepted');
 assert.equal((await hook('message.finalized',{id:'owned',to:[{status:'delivered'}]})).json.routed,true);
 assert.equal(db.prepare("SELECT status FROM communication_deliveries WHERE provider_id='owned'").get().status,'delivered');
 assert.equal((await hook('message.received',{id:'in-wrong',from:{phone_number:'+61422222222'},to:[{phone_number:'+61499999999'}],text:'Hello'})).json.routed,false);
 assert.equal((await hook('message.received',{id:'in-own',from:{phone_number:'+61422222222'},to:[{phone_number:'+61411111111'}],text:'Hello'})).json.routed,true);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM comms_messages WHERE organisation_id=? AND external_message_id='in-own'").get(b.org).n,0);
});

test('Google resource selection reconciles SEO links without changing another workspace',async()=>{
 const {reconcileGoogleResourceLinks}=await import('../src/integration-resources.js');
 const db=new Database(':memory:');db.exec('CREATE TABLE seo_google_links(owner_key TEXT,service TEXT,resource TEXT,label TEXT,linked_by TEXT,linked_at TEXT,PRIMARY KEY(owner_key,service));');
 db.prepare('INSERT INTO seo_google_links VALUES (?,?,?,?,?,?)').run('b','analytics','properties/99','Other workspace','b','now');
 reconcileGoogleResourceLinks(db,'a','google_seo',[{type:'analytics_property',id:'properties/1',label:'First'},{type:'tag_manager_container',id:'accounts/1/containers/2',public_id:'GTM-TEST',label:'Tags'}],'owner-a');
 assert.equal(db.prepare("SELECT resource FROM seo_google_links WHERE owner_key='a' AND service='analytics'").get().resource,'properties/1');
 assert.equal(db.prepare("SELECT resource FROM seo_google_links WHERE owner_key='a' AND service='tag_manager'").get().resource,'GTM-TEST');
 reconcileGoogleResourceLinks(db,'a','google_seo',[],'owner-a');
 assert.equal(db.prepare("SELECT COUNT(*) n FROM seo_google_links WHERE owner_key='a'").get().n,0);
 assert.equal(db.prepare("SELECT resource FROM seo_google_links WHERE owner_key='b'").get().resource,'properties/99');db.close();
});

test('signed tenant email verifies the account, recipient and receipt ownership before routing',async()=>{
 const {installTenantIntegrationWebhooks}=await import('../src/integration-webhooks.js');
 const db=new Database(':memory:');db.exec(`CREATE TABLE communication_deliveries(organisation_id TEXT,provider TEXT,provider_id TEXT);CREATE TABLE comms_channels(organisation_id TEXT,channel TEXT,address TEXT,status TEXT);INSERT INTO communication_deliveries VALUES ('a','resend','a-mail'),('b','resend','b-mail');INSERT INTO comms_channels VALUES ('a','email','hello@business.org','active');`);
 const routes=new Map(),receipts=[],inbound=[],retrievals=[],secret=crypto.randomBytes(32),otherSecret=crypto.randomBytes(32);
 const webhooks=installTenantIntegrationWebhooks({post:(route,handler)=>routes.set(route,handler)},{db,credentials:org=>({email:{api_key:'test-owned-'+org,sender:org==='a'?'hello@business.org':'other@business.org',webhook_secret:'whsec_'+(org==='a'?secret:otherSecret).toString('base64')}}),verifyTelnyx:()=>false,receipt:(...r)=>receipts.push(r),receiveEmail:r=>inbound.push(r),receiveResend:async(key,id)=>{retrievals.push({key,id});return {data:{from:'person@example.org',to:['hello@business.org'],subject:'Hello',text:'Please call'}}}});
 const invoke=async(event,org='a',signingKey=secret)=>{
  const body=JSON.stringify(event),id=crypto.randomUUID(),ts=String(Math.floor(Date.now()/1000)),signature='v1,'+crypto.createHmac('sha256',signingKey).update(id+'.'+ts+'.'+body).digest('base64');let status=200,result;
  await routes.get('/api/webhooks/communications/resend/:organisationId')({params:{organisationId:org},rawBody:Buffer.from(body),get:k=>({'svix-id':id,'svix-timestamp':ts,'svix-signature':signature}[k])},{status(code){status=code;return this},json(data){result=data;return this}});return {status,result};
 };
 assert.equal((await invoke({type:'email.delivered',data:{email_id:'a-mail'}},'b')).status,401);
 assert.equal((await invoke({type:'email.delivered',data:{email_id:'b-mail'}})).result.routed,false);assert.equal(receipts.length,0);
 assert.equal((await invoke({type:'email.delivered',data:{email_id:'a-mail'}})).result.routed,true);assert.equal(receipts[0][2],'a-mail');
 assert.equal((await invoke({type:'email.received',data:{email_id:'received',to:['other@business.org']}})).result.routed,false);assert.equal(retrievals.length,0);
 assert.equal((await invoke({type:'email.received',data:{email_id:'received',to:['hello@business.org']}})).result.routed,true);
 assert.equal(retrievals[0].key,'test-owned-a');assert.equal(inbound[0].organisation_id,'a');
 const early=await invoke({type:'email.delivered',data:{email_id:'early-owned'}});assert.equal(early.result.pending,true);assert.equal(receipts.length,1);
 db.prepare('INSERT INTO communication_deliveries VALUES (?,?,?)').run('a','resend','early-owned');
 assert.equal(webhooks.applyPending('b','resend','early-owned'),0);assert.equal(webhooks.applyPending('a','resend','early-owned'),1);assert.equal(webhooks.applyPending('a','resend','early-owned'),0,'receipt replay is idempotent');
 await invoke({type:'email.delivered',data:{email_id:'early-other'}});
 db.prepare('INSERT INTO communication_deliveries VALUES (?,?,?)').run('b','resend','early-other');webhooks.flushPending();
 assert.equal(receipts.length,2,'a queued event cannot apply to a later record in a different workspace');db.close();
});
