import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { publicProductAnswer } from '../src/product-guide-knowledge.js';
import { androidAssociations, appleAssociation } from '../src/mobile-association.js';

test('public guide gives different actionable answers to the homepage questions during an AI outage', () => {
  const missed = publicProductAnswer('What happens when I miss a call?');
  const approvals = publicProductAnswer('How do approvals work?');
  const pricing = publicProductAnswer('Can my workers see prices?');
  assert.match(missed, /receptionist.*configured/);
  assert.match(approvals, /review.*approv/);
  assert.match(pricing, /rather than private pricing/);
  assert.equal(new Set([missed, approvals, pricing]).size, 3);
  assert.equal(publicProductAnswer('How do approvals work?', 'hi'), null, 'localized fallback must be preserved');
});

test('mobile domain proofs grant no association until real public signing identifiers are configured', () => {
  assert.deepEqual(androidAssociations({}), []);
  assert.deepEqual(appleAssociation({}).applinks.details, []);
  assert.deepEqual(androidAssociations({ ANDROID_CERT_SHA256:'not-a-certificate' }), []);
  assert.deepEqual(appleAssociation({ APPLE_TEAM_ID:'INVALID' }).applinks.details, []);
  const fingerprint = Array(32).fill('AB').join(':');
  const statements = androidAssociations({ ANDROID_CERT_SHA256:fingerprint });
  assert.equal(statements[0].target.package_name, 'ai.oprun.app');
  assert.deepEqual(statements[0].target.sha256_cert_fingerprints, [fingerprint]);
  assert.deepEqual(androidAssociations({ ANDROID_APP_ID:'<invalid>', ANDROID_CERT_SHA256:fingerprint }), []);
  assert.equal(appleAssociation({ APPLE_TEAM_ID:'AB12345678' }).applinks.details[0].appID, 'AB12345678.ai.oprun.app');
});

test('offline handling never caches private pages, API responses or unknown HTML', async () => {
  const handlers = new Map(); const written = [];
  const offline = new Response('public connection help');
  const context = { URL, location:{origin:'https://www.oprun.ai'},
    self:{ addEventListener:(name,fn) => handlers.set(name,fn) },
    fetch:async() => { throw new Error('offline'); },
    caches:{ match:async key => key === '/saas/offline.html' ? offline : undefined,
      open:async() => ({put:(...args) => written.push(args)}) }
  };
  vm.runInNewContext(fs.readFileSync('saas/sw.js','utf8'),context);
  let response;
  const dispatch = (path,mode='cors') => { response=undefined; handlers.get('fetch')({request:{url:context.location.origin+path,method:'GET',mode},respondWith:r=>{response=r;}}); };
  dispatch('/api/saas/customers'); assert.equal(response,undefined);
  dispatch('/saas/private-report.html'); assert.equal(response,undefined);
  dispatch('/saas/workspace.html','navigate'); assert.equal(await (await response).text(),'public connection help');
  assert.equal(written.length,0);
});
