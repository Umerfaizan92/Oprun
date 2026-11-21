import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';import path from 'node:path';import Database from 'better-sqlite3';import {startServer} from './test-server.mjs';import {seedOwner} from './visual/session.mjs';
test('library metadata, usage, version links and expiring/revocable shares stay tenant scoped',async t=>{
 const s=await startServer();t.after(()=>s.stop());const a=await seedOwner(s),b=await seedOwner(s,{email:'library-b@example.test'}),db=new Database(s.dbPath);t.after(()=>db.close());
 const id=crypto.randomUUID(),other=crypto.randomUUID(),dir=path.join(s.temp,'uploads','studio',a.org);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,id+'.png'),Buffer.from('89504e470d0a1a0a','hex'));
 const ins=db.prepare("INSERT INTO tenant_media(id,organisation_id,original_name,stored_name,mime_type,kind,size_bytes,created_at) VALUES (?,?,?,?,'image/png','photo',8,?)");ins.run(id,a.org,'private.png',id+'.png',new Date().toISOString());ins.run(other,b.org,'foreign.png',other+'.png',new Date().toISOString());
 const A=(m,u,body)=>s.call(m,u,{cookie:a.cookie,body}),B=(m,u,body)=>s.call(m,u,{cookie:b.cookie,body});
 assert.equal((await A('PATCH',`/api/saas/studio-library/${id}`,{folder:'Workshop',label:'Private preview',notes:'Owner only',version_of:other})).status,400);
 assert.equal((await A('PATCH',`/api/saas/studio-library/${id}`,{folder:'Workshop',label:'Private preview',notes:'Owner only'})).status,200);
 assert.equal((await B('PATCH',`/api/saas/studio-library/${id}`,{folder:'steal'})).status,404);
 assert.equal((await A('GET','/api/saas/studio-library')).json.usage.bytes,8);assert.deepEqual((await B('GET','/api/saas/studio-library')).json.metadata,[]);
 assert.equal((await B('POST',`/api/saas/studio-library/${id}/shares`,{minutes:15})).status,404);
 const share=(await A('POST',`/api/saas/studio-library/${id}/shares`,{minutes:15})).json;assert.ok(share.path);let r=await fetch(s.base+share.path);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);
 assert.equal((await B('POST',`/api/saas/studio-library/shares/${share.id}/revoke`,{})).status,404);
 assert.equal((await fetch(s.base+share.path+'x')).status,404);
 assert.equal((await A('POST',`/api/saas/studio-library/shares/${share.id}/revoke`,{})).status,200);assert.equal((await fetch(s.base+share.path)).status,404);
 const exp=(await A('POST',`/api/saas/studio-library/${id}/shares`,{minutes:1})).json;db.prepare("UPDATE studio_asset_shares SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(exp.id);assert.equal((await fetch(s.base+exp.path)).status,404);
 db.prepare("UPDATE memberships SET role='manager' WHERE organisation_id=? AND user_id=?").run(a.org,a.uid);assert.equal((await A('POST',`/api/saas/studio-library/${id}/shares`,{minutes:15})).status,403);
});
