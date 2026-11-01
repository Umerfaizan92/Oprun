import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {createIntegrationOAuthStore,integrationDiagnostic} from '../src/integration-security.js';
import {createIntegrationRuntime} from '../src/integration-runtime.js';

test('OAuth is browser/session/member bound, single use and provider checked',()=>{
  const db=new Database(':memory:');
  db.exec(`CREATE TABLE users(id TEXT,status TEXT);CREATE TABLE memberships(organisation_id TEXT,user_id TEXT,role TEXT,status TEXT);CREATE TABLE user_sessions(id TEXT,user_id TEXT,expires_at TEXT);
    INSERT INTO users VALUES ('u-a','active');INSERT INTO memberships VALUES ('org-a','u-a','owner','active');INSERT INTO user_sessions VALUES ('sid-a','u-a','2099-01-01');`);
  let stamp=Date.now(),allow=true;
  const store=createIntegrationOAuthStore({db,secret:()=> 'test-oauth-secret',clock:()=>stamp,authorised:()=>allow});
  const begin=provider=>store.begin({organisation_id:'org-a',user_id:'u-a',session_id:'sid-a',provider,redirect_uri:'https://app.example/api/saas/integrations/oauth/google/callback'});
  const cookie=f=>f.cookie.split(';')[0];
  const f=begin('google_seo');
  assert.equal(f.state.includes('org-a'),false);
  assert.equal(store.consume(f.state,'google','sp_connect_google_seo=wrong'),null);
  assert.equal(store.consume(f.state,'meta',cookie(f)),null);
  assert.equal(store.consume(f.state,'google',cookie(f)).o,'org-a');
  assert.equal(store.consume(f.state,'google',cookie(f)),null,'replay is refused');
  const old=begin('x'),newer=begin('x');
  assert.equal(store.consume(old.state,'x',cookie(old)),null,'a newer attempt supersedes the old attempt');
  allow=false;assert.equal(store.consume(newer.state,'x',cookie(newer)),null,'revoked custom permission is respected');allow=true;
  db.prepare("UPDATE memberships SET status='inactive'").run();
  assert.equal(store.consume(newer.state,'x',cookie(newer)),null);
  db.prepare("UPDATE memberships SET status='active'").run();
  const expiring=begin('meta');stamp+=900001;
  assert.equal(store.consume(expiring.state,'meta',cookie(expiring)),null);
  stamp=Date.now();const revoked=begin('youtube');db.prepare("DELETE FROM user_sessions").run();
  assert.equal(store.consume(revoked.state,'youtube',cookie(revoked)),null,'signed-out session cannot complete a connection');
  db.close();
});

test('reading an issued token never renews its expiry; an expired token really refreshes',async()=>{
  let calls=0;
  const runtime=createIntegrationRuntime({env:{INTEGRATION_ENCRYPTION_KEY:'test-key',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'},fetchImpl:async()=>{calls++;return Response.json({access_token:'test-new',expires_in:3600})}});
  const expired={access_token:'test-old',refresh_token:'test-refresh',issued_at:new Date(Date.now()-7200000).toISOString(),expires_in:3600,expires_at:new Date(Date.now()-3600000).toISOString()};
  const result=await runtime.ensureFreshToken('google_seo',expired);
  assert.equal(calls,1);assert.equal(result.refreshed,true);assert.equal(result.bundle.access_token,'test-new');assert.equal(result.bundle.refresh_token,'test-refresh');
  await assert.rejects(()=>runtime.ensureFreshToken('meta',{access_token:'test-old',expires_at:expired.expires_at}),/Re-authorise/);
});

test('HTTP 200 provider error envelopes are errors, and secrets stay out of diagnostics',async()=>{
  const runtime=createIntegrationRuntime({env:{INTEGRATION_ENCRYPTION_KEY:'test-key'},fetchImpl:async()=>Response.json({error:{code:'access_token_invalid',message:'Expired access_token=test-private-token'}})});
  await assert.rejects(()=>runtime.testConnection('tiktok',{access_token:'test-private-token'}),error=>!error.message.includes('test-private-token'));
  const d=integrationDiagnostic(Object.assign(new Error('Bearer test-secret-access client_secret=test-client-secret'),{status:401}),['test-secret-access','test-client-secret']);
  assert.equal(d.code,'reconnect_required');assert.equal(JSON.stringify(d).includes('test-secret-access'),false);assert.equal(JSON.stringify(d).includes('test-client-secret'),false);
});

test('Google discovers Analytics and reports partial Tag Manager failure independently',async()=>{
  const runtime=createIntegrationRuntime({env:{},fetchImpl:async url=>{
    if(String(url).includes('webmasters'))return Response.json({siteEntry:[{siteUrl:'https://business.example',permissionLevel:'siteOwner'}]});
    if(String(url).includes('accountSummaries'))return Response.json({accountSummaries:[{account:'accounts/1',displayName:'Business',propertySummaries:[{property:'properties/2',displayName:'Website'}]}]});
    return Response.json({error:{message:'Tag Manager API not enabled'}},{status:403});
  }});
  const result=await runtime.testConnection('google_seo',{access_token:'test-google'});
  assert.deepEqual(result.resources.map(r=>r.type),['search_console_property','analytics_property']);
  assert.equal(result.service_checks.find(c=>c.service==='tag_manager').status,'unavailable');
  assert.equal(result.service_checks.find(c=>c.service==='analytics').resource_count,1);
});
