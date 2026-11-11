import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import {installGrowth} from '../src/growth.js';

function fixture(t,{platform='facebook',revoke='none',uncertain=false,deniedActor=false,noAuthority=false}={}) {
 const db=new Database(':memory:');t.after(()=>db.close());
 db.exec(`CREATE TABLE audit_logs(id TEXT,organisation_id TEXT,user_id TEXT,user_name TEXT,user_role TEXT,action TEXT,module TEXT,entity_type TEXT,entity_id TEXT,ip_address TEXT,user_agent TEXT,metadata_json TEXT,created_at TEXT,retention_until TEXT,prev_hash TEXT,event_hash TEXT);`);
 let active=true,selected=true,sends=0;
 const connection=()=>({row:{status:'connected'},settings:{account_confirmed:true,selected_resources:selected?[{id:'page',type:platform==='x'?'x_account':'facebook_page'}]:[]}});
 const app=express(), noop=(req,res,next)=>next();
 const authority=(org,user,provider,action)=>org==='A'&&active&&(user==='approver'||user==='sender'&&!deniedActor)&&['approve','publish'].includes(action);
 const api=installGrowth(app,{db,requireSaasUser:noop,requireSaasRole:()=>noop,saasAudit:()=>{},
  entitlements:{rules:()=>({growth_auto_publish:true})},channelAuthority:noAuthority?undefined:authority,
  connections:{load:connection,fresh:async()=>{if(revoke==='refresh')active=false;if(revoke==='refresh-selection')selected=false;return {access_token:'synthetic-only'};}},
  fetchImpl:async(url,opt)=>{
   if(opt?.method!=='POST') {if(revoke==='page-token')active=false;if(revoke==='selection')selected=false;return {ok:true,json:async()=>({access_token:'synthetic-page-only'})};}
   sends++;if(uncertain)throw new Error('synthetic network timeout');return {ok:true,json:async()=>({id:'posted',data:{id:'posted'}})};
  }});
 db.prepare(`INSERT INTO growth_calendar(id,organisation_id,plan_day,scheduled_at,platform,pillar,post_type,hook,body,status,approved_by,created_at,updated_at) VALUES('post','A',1,?,?,?,?,?,?,'approved','approver',?,?)`).run('2026-11-01T00:00:00Z',platform,'Authority','text','Helpful local tip','Approved text','2026-11-01','2026-11-01');
 return {api,db,sends:()=>sends};
}
for(const revoke of ['refresh','page-token','selection'])test('legacy publisher blocks access or selection changed during '+revoke,async t=>{
 const f=fixture(t,{revoke});const result=await f.api.publishItem('post',{actor:'sender'});
 assert.equal(result.ok,false);assert.equal(result.status,'draft');assert.equal(f.sends(),0);
 assert.equal(f.db.prepare('SELECT action FROM audit_logs').get().action,'growth.post_held_for_access');
});
test('manual sender needs publish permission independently of approver authority',async t=>{
 const f=fixture(t,{deniedActor:true});assert.equal((await f.api.publishItem('post',{actor:'sender'})).ok,false);assert.equal(f.sends(),0);
});
test('missing channel authority fails closed',async t=>{
 const f=fixture(t,{noAuthority:true});assert.equal((await f.api.publishItem('post')).ok,false);assert.equal(f.sends(),0);
});
test('unconfirmed delivery is held and cannot be retried by timer or double click',async t=>{
 const f=fixture(t,{uncertain:true});assert.equal((await f.api.publishItem('post',{actor:'sender'})).status,'uncertain');
 assert.equal((await f.api.publishItem('post',{actor:'sender'})).ok,false);await f.api.runDue();assert.equal(f.sends(),1);
});
test('valid approval publishes exactly once and records its business',async t=>{
 const f=fixture(t);assert.equal((await f.api.publishItem('post',{actor:'sender'})).status,'published');
 assert.equal((await f.api.publishItem('post',{actor:'sender'})).ok,false);assert.equal(f.sends(),1);
 assert.equal(f.db.prepare('SELECT organisation_id FROM audit_logs').get().organisation_id,'A');
});
test('X also rechecks revoked authority after refresh',async t=>{
 const f=fixture(t,{platform:'x',revoke:'refresh'});assert.equal((await f.api.publishItem('post',{actor:'sender'})).status,'draft');assert.equal(f.sends(),0);
});

test('X cannot send with a stale selected account after refresh',async t=>{
 const f=fixture(t,{platform:'x',revoke:'refresh-selection'});assert.equal((await f.api.publishItem('post',{actor:'sender'})).status,'draft');assert.equal(f.sends(),0);
});
