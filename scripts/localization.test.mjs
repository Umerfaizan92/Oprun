import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createDb } from '../src/db.js';
import { installLocalization } from '../src/localization.js';
import { SELECTABLE_LOCALES, canonicalLocale, localeDirection, localeCatalogue, message, MESSAGES } from '../saas/locale-catalog.js';

test('every listed locale round-trips; script variants have the right default direction', () => {
  assert.ok(SELECTABLE_LOCALES.length > 180);
  for (const code of SELECTABLE_LOCALES) assert.equal(canonicalLocale(code), code);
  for (const code of ['ur', 'ar', 'he', 'fa', 'pa-Arab']) assert.equal(localeDirection(code), 'rtl', code);
  for (const code of ['hi', 'en-AU', 'pa-Guru', 'sr-Latn', 'zh-Hant']) assert.equal(localeDirection(code), 'ltr', code);
  for (const code of ['xx', '<script>', '', null, 'en-INVALID-LONG-LOCALE']) assert.equal(canonicalLocale(code), null);
  assert.equal(canonicalLocale('EN-au'), 'en-AU');
});
test('translation coverage is explicit and missing text falls back to English', () => {
  assert.equal(message('ja', 'save'), 'Save');
  assert.equal(message('ur', 'save'), 'محفوظ کریں');
  for (const messages of Object.values(MESSAGES)) assert.deepEqual(Object.keys(messages).sort(), Object.keys(MESSAGES.en).sort());
  for (const row of localeCatalogue('ur')) { assert.equal(row.workspace_translation_certified, false); assert.ok(row.name && row.native_name); }
});
test('language preferences enforce session identity, active membership, schema and tenant isolation', async t => {
  const db = createDb(':memory:'), at = new Date().toISOString();
  for (const id of ['a', 'b']) db.prepare('INSERT INTO organisations(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').run(id,id,id,at,at);
  for (const id of ['alice', 'bob']) db.prepare('INSERT INTO users(id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id,id+'@example.test',id,'x','x',at,at);
  for (const [org,user] of [['a','alice'],['b','alice'],['a','bob']]) db.prepare('INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES(?,?,?,?)').run(org,user,'worker',at);
  const app = express(); app.use(express.json());
  // Synthetic session resolver; production supplies requireSaasUser, never these test headers.
  const auth = (req,res,next) => { if(!req.get('Test-User'))return res.status(401).json({ok:false});req.saas={user_id:req.get('Test-User'),organisation_id:req.get('Test-Org')};next(); };
  installLocalization(app,{db,requireSaasUser:auth});
  const server = app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
  t.after(()=>{ server.close();db.close(); });
  const url=`http://127.0.0.1:${server.address().port}/api/saas/preferences/language`;
  const call=async(user,org,body)=>{const res=await fetch(url,{method:body?'PUT':'GET',headers:{...(user?{'Test-User':user,'Test-Org':org}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,body:await res.json(),cache:res.headers.get('cache-control')};};
  assert.equal((await call()).status,401);
  assert.equal((await call('bob','b')).status,403);
  assert.equal((await call('alice','a',{locale:'ur',organisation_id:'b'})).status,400,'reject forged tenant field');
  assert.equal((await call('alice','a',{locale:'ur',user_id:'bob'})).status,400,'reject forged user field');
  assert.equal((await call('alice','a',{locale:'xx'})).status,400);
  assert.equal((await call('alice','a',{locale:'ur'})).body.direction,'rtl');
  assert.equal((await call('alice','a')).body.locale,'ur');
  assert.equal((await call('alice','b')).body.locale,'en-AU','same person, different workspace');
  assert.equal((await call('bob','a')).body.locale,'en-AU','same workspace, different person');
  assert.equal((await call('alice','a')).cache,'no-store');
  db.prepare("UPDATE memberships SET status='revoked' WHERE user_id='alice' AND organisation_id='a'").run();
  assert.equal((await call('alice','a',{locale:'hi'})).status,403,'revoked membership cannot write');
  assert.equal(db.prepare("SELECT locale FROM user_locale_preferences WHERE user_id='alice' AND organisation_id='a'").get().locale,'ur');
});
