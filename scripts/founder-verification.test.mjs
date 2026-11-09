import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {createFounderVerification} from '../src/founder-verification.js';

async function fixture(flag){
 const db=new Database(':memory:');
 db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT,password_hash TEXT,email TEXT,phone TEXT,locked_until TEXT,mfa_enabled INTEGER,mfa_secret TEXT,failed_login_attempts INTEGER,last_login_at TEXT,updated_at TEXT);
 CREATE TABLE memberships(user_id TEXT,role TEXT,status TEXT,organisation_id TEXT);
 CREATE TABLE founder_workspace_identity(singleton INTEGER,user_id TEXT);
 CREATE TABLE user_sessions(user_id TEXT);
 INSERT INTO users(id,status,password_hash,email,phone,mfa_enabled) VALUES ('founder','active','password-hash','founder@example.test','+61400000000',0),('other','active','other-password','other@example.test','+61400000001',0);
 INSERT INTO memberships VALUES ('founder','owner','active','org'),('other','owner','active','other-org');
 INSERT INTO founder_workspace_identity VALUES (1,'founder');`);
 const env={SMS_VERIFICATION_ENABLED:flag},events=[],deliveries=[],sessions=[];
 let latestEmail='',latestSms='';
 const app=express();app.use(express.json());
 const flow=createFounderVerification({db,env,audit:(...args)=>events.push(args),
  sendEmail:async payload=>{latestEmail=payload.code;deliveries.push('email');return {sent:true};},
  sendSms:async(phone,value)=>{latestSms=value;deliveries.push('sms');return {sent:true,provider:'local'};},
  verifySms:async()=>{throw Error('Unexpected provider call');},
  hash:value=>crypto.createHash('sha256').update(value).digest('hex'),code:()=>String(crypto.randomInt(100000,1000000)),
  session:(res,id)=>{sessions.push(id);res.cookie('fp_session','test-session',{httpOnly:true});},
  cookie:(req,name)=>String(req.headers.cookie||'').split('; ').find(x=>x.startsWith(name+'='))?.slice(name.length+1),
  requireAdmin:(req,res,next)=>req.get('x-test-admin')?next():res.sendStatus(401),
  adminRecoveryAuthenticated:req=>req.get('x-test-admin')==='mfa',
  verifyLimiter:rateLimit({windowMs:60000,limit:40}),resendLimiter:rateLimit({windowMs:60000,limit:12})});
 flow.install(app);
 // This fixture's password gate models the server login call site; no email-only lookup grants access.
 app.post('/login',async(req,res)=>{const u=flow.eligible(req.body.user_id);if(!u||req.body.password!==u.password_hash)return res.sendStatus(401);await flow.start(req,res,u);});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;let binding='';
 async function request(url,body={},admin,withCookie=true){const res=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...(withCookie?{Cookie:binding}:{}),...(admin?{'x-test-admin':admin}:{})},body:JSON.stringify(body)});const cookie=res.headers.get('set-cookie');if(cookie?.startsWith('sp_founder_verification='))binding=cookie.split(';')[0];return {status:res.status,body:await res.json().catch(()=>null),cookie};}
 const approve=(id='founder',admin='mfa')=>request('/api/operator/founder-recovery/approve',{user_id:id,reason:'Billing interruption recovery',confirm:true},admin);
 const start=()=>request('/login',{user_id:'founder',password:'password-hash'});
 return {db,env,events,deliveries,sessions,request,approve,start,email:()=>latestEmail,sms:()=>latestSms,close:()=>{server.closeAllConnections();server.close();db.close();}};
}
const prefix='/api/saas/founder-verification';
for(const flag of ['false','true',undefined,'FALSE'])test(`Founder recovery SMS flag ${flag}`,async()=>{
 const f=await fixture(flag);try{
  assert.equal((await f.start()).status,401);
  assert.equal((await f.approve('founder',null)).status,401);
  assert.equal((await f.approve('founder','raw-key')).status,403);
  assert.equal((await f.approve('other')).status,400);
  assert.equal((await f.approve()).status,200);
  assert.equal((await f.request('/login',{user_id:'founder',password:'wrong'})).status,401);
  const start=await f.start(),id=start.body.challenge_id,smsRequired=flag!=='false';
  assert.equal(start.status,202);assert.equal(start.body.sms_required,smsRequired);assert.equal(f.sessions.length,0);
  assert.deepEqual(f.deliveries,smsRequired?['email','sms']:['email']);
  assert.equal((await f.request(prefix+'/status',{challenge_id:id},null,false)).status,410);
  assert.equal((await f.request(prefix+'/verify',{challenge_id:id,email_code:'000000',sms_code:f.sms()})).status,401);
  assert.equal((await f.request(prefix+'/verify',{challenge_id:id,sms_code:f.sms()})).status,401);
  if(!smsRequired)assert.equal((await f.request(prefix+'/resend',{challenge_id:id,channel:'sms'})).status,400);
  if(smsRequired)assert.equal((await f.request(prefix+'/verify',{challenge_id:id,email_code:f.email()})).status,401);
  const verified=await f.request(prefix+'/verify',{challenge_id:id,email_code:f.email(),sms_code:f.sms()});
  assert.equal(verified.status,200);assert.deepEqual(f.sessions,['founder']);assert.match(verified.cookie,/HttpOnly/);
  assert.equal((await f.request(prefix+'/verify',{challenge_id:id,email_code:f.email(),sms_code:f.sms()})).status,410);
  assert.ok(f.events.some(e=>e[1]==='security.founder_recovery_approved'));
  assert.ok(f.events.some(e=>e[1]==='security.founder_verification_completed'));
  assert.equal(f.db.prepare("SELECT password_hash FROM users WHERE id='other'").get().password_hash,'other-password');
 }finally{f.close();}
});
test('restoring SMS, expiration, revocation, attempts, resends and rate limits fail closed',async()=>{
 const f=await fixture('false');try{
  await f.approve();let id=(await f.start()).body.challenge_id;
  f.env.SMS_VERIFICATION_ENABLED='true';assert.equal((await f.request(prefix+'/verify',{challenge_id:id,email_code:f.email()})).status,409);
  await f.approve();const start=await f.start();assert.equal(start.body.sms_required,true);assert.ok(f.deliveries.includes('sms'));
  f.env.SMS_VERIFICATION_ENABLED='false';await f.approve();id=(await f.start()).body.challenge_id;
  for(let i=0;i<7;i++)assert.equal((await f.request(prefix+'/verify',{challenge_id:id,email_code:'000000'})).status,401);
  assert.equal((await f.request(prefix+'/verify',{challenge_id:id,email_code:f.email()})).status,200,'eighth correct attempt succeeds');
  await f.approve();id=(await f.start()).body.challenge_id;
  for(let i=0;i<8;i++)await f.request(prefix+'/verify',{challenge_id:id,email_code:'000000'});
  assert.equal((await f.request(prefix+'/verify',{challenge_id:id,email_code:f.email()})).status,429);
  assert.equal((await f.start()).status,429,'restarting cannot reset attempts');
  await f.approve();id=(await f.start()).body.challenge_id;
  const expires=f.db.prepare('SELECT expires_at FROM founder_login_challenges WHERE id=?').get(id).expires_at;
  await f.request(prefix+'/resend',{challenge_id:id,channel:'email'});
  assert.equal(f.db.prepare('SELECT expires_at FROM founder_login_challenges WHERE id=?').get(id).expires_at,expires);
  f.db.prepare("UPDATE founder_login_challenges SET expires_at='2000-01-01' WHERE id=?").run(id);
  assert.equal((await f.request(prefix+'/verify',{challenge_id:id,email_code:f.email()})).status,410);
  await f.approve();id=(await f.start()).body.challenge_id;f.db.prepare('DELETE FROM founder_recovery_approvals').run();
  assert.equal((await f.request(prefix+'/verify',{challenge_id:id,email_code:f.email()})).status,409);
  let limited=false;for(let i=0;i<15;i++)if((await f.request(prefix+'/resend',{challenge_id:id,channel:'email'})).status===429)limited=true;
  assert.ok(limited);
 }finally{f.close();}
});
