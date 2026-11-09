import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

test('real login requires password, independent administrative approval and fresh email OTP',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'superpro-founder-recovery-'));
 const port=42000+crypto.randomInt(4000),base=`http://127.0.0.1:${port}`,dbPath=path.join(root,'test.sqlite');
 const key=crypto.randomBytes(32).toString('hex'),secret=crypto.randomBytes(20);
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0,encoded='';
 for(const byte of secret){value=(value<<8)|byte;bits+=8;while(bits>=5){encoded+=alphabet[(value>>>(bits-5))&31];bits-=5;}}
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const digest=crypto.createHmac('sha1',secret).update(counter).digest(),offset=digest.at(-1)&15;
 const totp=String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
 const child=spawn(process.execPath,['src/server.js'],{env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'test',SUPERPRO_SKIP_DOTENV:'1',PORT:String(port),DATABASE_PATH:dbPath,UPLOAD_DIR:path.join(root,'uploads'),PUBLIC_BASE_URL:base,ADMIN_API_KEY:key,OPERATOR_TOTP_SECRET:encoded,SMS_VERIFICATION_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
 let output='',db;child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
 try{
  let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/healthz')).ok;if(ready)break;}catch{}if(child.exitCode!==null)throw Error(output.slice(-2000));await new Promise(r=>setTimeout(r,100));}assert.ok(ready,output.slice(-2000));
  db=new Database(dbPath);const now=new Date().toISOString(),userId=crypto.randomUUID(),orgId=crypto.randomUUID(),password=crypto.randomBytes(20).toString('base64url'),salt=crypto.randomBytes(16).toString('hex');
  const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
  db.prepare('INSERT INTO users(id,email,phone,full_name,password_hash,password_salt,email_verified,phone_verified,created_at,updated_at) VALUES (?,?,?,?,?,?,1,0,?,?)').run(userId,'recovery@example.test','+61400000000','Founder',crypto.scryptSync(password,salt,64).toString('hex'),salt,now,now);
  db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)').run(orgId,'Recovery test','recovery-'+orgId,now,now);
  db.prepare("INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES (?,?,'owner',?)").run(orgId,userId,now);
  db.prepare('INSERT INTO founder_workspace_identity VALUES (1,?,?)').run(userId,now);
  async function post(route,body,headers={}){const res=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')};}
  const login={email:'recovery@example.test',password};assert.equal((await post('/api/saas/login',login)).status,403);
  const approval={user_id:userId,reason:'Telnyx billing interruption recovery',confirm:true};
  assert.equal((await post('/api/operator/founder-recovery/approve',approval,{'x-admin-key':key})).status,401);
  const admin=await post('/api/operator/login',{key,code:totp});assert.equal(admin.status,200);
  assert.equal((await post('/api/operator/founder-recovery/approve',approval,{'x-admin-key':admin.body.token})).status,200);
  assert.equal((await post('/api/saas/login',{...login,password:'wrong-password'})).status,401);
  db.prepare('UPDATE users SET mfa_enabled=1,mfa_secret=? WHERE id=?').run(encoded,userId);
  assert.equal((await post('/api/saas/login',login)).body.mfa_required,true);
  db.prepare('UPDATE users SET mfa_enabled=0 WHERE id=?').run(userId);
  const start=await post('/api/saas/login',login);assert.equal(start.status,202);assert.equal(start.body.sms_required,false);assert.ok(!start.cookie.includes('fp_session='));
  const emailCode=String(crypto.randomInt(100000,1000000));
  // Substitute a randomly generated mail delivery in this isolated fixture only.
  db.prepare('UPDATE founder_login_challenges SET email_hash=? WHERE id=?').run(hash(start.body.challenge_id+':'+emailCode),start.body.challenge_id);
  const headers={Cookie:start.cookie.split(';')[0]};
  const verified=await post('/api/saas/founder-verification/verify',{challenge_id:start.body.challenge_id,email_code:emailCode},headers);
  assert.equal(verified.status,200);assert.match(verified.cookie,/fp_session=/);assert.match(verified.cookie,/HttpOnly/);
  assert.equal(db.prepare('SELECT phone_verified FROM users WHERE id=?').get(userId).phone_verified,0);
  assert.equal((await post('/api/saas/founder-verification/verify',{challenge_id:start.body.challenge_id,email_code:emailCode},headers)).status,410);
  db.prepare('DELETE FROM founder_recovery_approvals').run();assert.equal((await post('/api/saas/login',login)).status,403);
 }finally{db?.close();child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));fs.rmSync(root,{recursive:true,force:true});}
});
