import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
test('real application language routes enforce session, workspace membership and origin',async t=>{
 const server=await startServer();t.after(()=>server.stop());
 const a=await seedOwner(server),b=await seedOwner(server,{business:'Other synthetic business',email:'other@example.test'});
 const path='/api/saas/preferences/language';
 assert.equal((await server.call('GET',path)).status,401);
 assert.equal((await server.call('PUT',path,{cookie:a.cookie,body:{locale:'hi'}})).status,200);
 assert.equal((await server.call('GET',path,{cookie:b.cookie})).json.locale,'en-AU');
 assert.equal((await server.call('GET',path,{cookie:a.cookie,headers:{'X-Organisation-Id':b.org}})).status,403);
 assert.equal((await server.call('PUT',path,{cookie:a.cookie,headers:{origin:'https://untrusted.example'},body:{locale:'ar'}})).status,403);
 assert.equal((await server.call('GET',path,{cookie:a.cookie})).json.locale,'hi');
 assert.equal((await server.call('GET','/api/operator/localization',{cookie:a.cookie})).status,401,'subscriber owner has no operator session');
});
