import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createDb} from '../src/db.js';
import {installNotifications} from '../src/notifications.js';
import {installWebPush,allowedPushEndpoint} from '../src/web-push.js';

const ENV={SAAS_SESSION_SECRET:'test-secret-for-web-push-0123456789'};
function fixture({env=ENV,fail=null}={}){
  const db=createDb(':memory:'),routes=new Map(),app={get:(p,...h)=>routes.set('GET '+p,h),post:(p,...h)=>routes.set('POST '+p,h),put:(p,...h)=>routes.set('PUT '+p,h)};
  const at=new Date().toISOString(),org=crypto.randomUUID(),other=crypto.randomUUID();
  for(const id of [org,other])db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(id,'Biz '+id.slice(0,4),id,at,at);
  const user=(o,role)=>{const id=crypto.randomUUID();db.prepare('INSERT INTO users(id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(id,id+'@example.test',role,'x','x',at,at);db.prepare('INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES (?,?,?,?)').run(o,id,role,at);return id};
  const owner=user(org,'owner'),manager=user(org,'manager'),outsider=user(other,'owner');
  const sent=[],sender=async(sub,payload)=>{if(fail)throw Object.assign(new Error('gone'),{statusCode:fail});sent.push({endpoint:sub.endpoint,payload:JSON.parse(payload)})};
  const auth=(_q,_s,n)=>n(),push=installWebPush(app,{db,env,requireSaasUser:auth,sender});
  const notify=installNotifications(app,{db,env:{},requireSaasUser:auth,push});
  const request=async(method,path,userId,organisationId,body={})=>{let status=200,data;await routes.get(method+' '+path).at(-1)({saas:{user_id:userId,organisation_id:organisationId,full_name:'Alex'},body},{status(n){status=n;return this},json(v){data=v}});return {status,data}};
  const sub=(n=1)=>({endpoint:`https://fcm.googleapis.com/fcm/send/device-${n}`,keys:{p256dh:'B'.repeat(87),auth:'a'.repeat(22)}});
  return {db,org,other,owner,manager,outsider,notify,push,request,sent,sub};
}
const tick=()=>new Promise(r=>setTimeout(r,20));

test('only real browser push services are accepted as endpoints',()=>{
  assert.equal(allowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'),true);
  assert.equal(allowedPushEndpoint('https://web.push.apple.com/QW'),true);
  assert.equal(allowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'),true);
  for(const bad of ['http://fcm.googleapis.com/x','https://evil.example/fcm.googleapis.com','https://169.254.169.254/latest','https://user:pw@fcm.googleapis.com/x','not a url'])assert.equal(allowedPushEndpoint(bad),false,bad);
});

test('keys are generated once, the private key is sealed, and config never exposes it',async()=>{
  const f=fixture();
  const c=await f.request('GET','/api/saas/push/config',f.owner,f.org);
  assert.equal(c.data.available,true);assert.ok(c.data.public_key.length>60);assert.equal(JSON.stringify(c.data).includes('private'),false);
  const row=f.db.prepare('SELECT public_key,private_sealed FROM web_push_keys').get();
  assert.equal(row.public_key,c.data.public_key);assert.equal(row.private_sealed.split('.').length,3);
  assert.equal((await f.request('GET','/api/saas/push/config',f.owner,f.org)).data.public_key,c.data.public_key,'stable across calls');
  const off=fixture({env:{}});assert.equal((await off.request('GET','/api/saas/push/config',off.owner,off.org)).data.available,false,'no server secret: push stays off');
});

test('new alerts reach the right person\'s devices, respect mute, and never cross businesses',async()=>{
  const f=fixture();
  assert.equal((await f.request('POST','/api/saas/push/subscribe',f.owner,f.org,{endpoint:'https://evil.example/x',keys:f.sub().keys})).status,400);
  assert.equal((await f.request('POST','/api/saas/push/subscribe',f.owner,f.org,f.sub(1))).status,200);
  assert.equal((await f.request('POST','/api/saas/push/subscribe',f.outsider,f.other,f.sub(2))).status,200);
  await f.notify.notifyUser(f.org,f.owner,{kind:'website_enquiry',title:'New job enquiry',body:'Blocked drain',link:'#work/enquiries'});await tick();
  assert.equal(f.sent.length,1);assert.equal(f.sent[0].endpoint,f.sub(1).endpoint);
  assert.equal(f.sent[0].payload.title,'New job enquiry');assert.equal(f.sent[0].payload.url,'/saas/workspace.html#work/enquiries');
  // Audit-driven activity: a manager's new enquiry alerts the owner, not the manager who made it.
  await f.request('POST','/api/saas/push/subscribe',f.manager,f.org,f.sub(3));
  f.notify.auditEvent({saas:{organisation_id:f.org,user_id:f.manager,full_name:'Sam'}},'enquiry.created','e1','audit-1');await tick();await tick();
  assert.deepEqual(f.sent.slice(1).map(s=>s.endpoint),[f.sub(1).endpoint]);assert.equal(f.sent[1].payload.title,'New job enquiry');
  // Money activity stays with owner/admin.
  f.notify.auditEvent({saas:{organisation_id:f.org,user_id:f.owner,full_name:'Alex'}},'payment.recorded_manually','p1','audit-2');await tick();
  assert.equal(f.sent.filter(s=>s.endpoint===f.sub(3).endpoint).length,0,'manager gets no finance alerts');
  // Muted: stored in the bell, no phone alert.
  await f.request('PUT','/api/saas/notification-preferences',f.owner,f.org,{muted:true,sound:false,browser:true,sms:false});
  const before=f.sent.length;await f.notify.notifyUser(f.org,f.owner,{kind:'message',title:'Muted alert'});await tick();
  assert.equal(f.sent.length,before);
  // A device moves to whoever subscribes it now; unsubscribe only removes your own device.
  await f.request('POST','/api/saas/push/unsubscribe',f.outsider,f.other,{endpoint:f.sub(1).endpoint});
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM push_subscriptions WHERE endpoint=?').get(f.sub(1).endpoint).n,1);
  await f.request('POST','/api/saas/push/unsubscribe',f.owner,f.org,{endpoint:f.sub(1).endpoint});
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM push_subscriptions WHERE endpoint=?').get(f.sub(1).endpoint).n,0);
});

test('expired devices are removed after the push service reports them gone',async()=>{
  const f=fixture({fail:410});
  await f.request('POST','/api/saas/push/subscribe',f.owner,f.org,f.sub(9));
  const r=await f.request('POST','/api/saas/push/test',f.owner,f.org);assert.equal(r.data.sent,0);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM push_subscriptions').get().n,0);
});
