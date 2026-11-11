import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../saas/workspace-nav.js',import.meta.url),'utf8');
function nav(session={}) {const window={GDS_SESSION:session};vm.runInNewContext(source,{window});return window.SuperProNav;}
const baseline=JSON.parse(fs.readFileSync(new URL('../docs/redesign/BASELINE_ROUTES.json',import.meta.url)));
test('seven business groups retain every view, canonical hash, old alias and bare group',()=>{
 const n=nav(),items=n.DOMAINS.flatMap(g=>g.items);
 assert.equal(n.DOMAINS.length,7);assert.equal(items.length,60);assert.equal(new Set(items.map(i=>i.view)).size,60);
 for(const p of baseline.business.flatMap(g=>g.items)) {
  assert.equal(n.resolve(p.path,'owner'),p.view);
  assert.equal(n.resolve(p.view,'owner'),p.view);
  for(const alias of p.alias||[]) assert.equal(n.resolve(alias,'owner'),p.view);
 }
 assert.equal(n.resolve('b06','owner'),'seocentre');assert.equal(n.resolve('b09','owner'),'billing');
 assert.equal(n.pathFor('unifiedinbox'),'b04/unified');assert.equal(n.DOMAINS.find(g=>g.id==='b04').items[0].view,'unifiedinbox');
 assert.ok(items.filter(i=>i.secondary).length>15);
});
test('workflow destinations obey current feature and channel grants without granting founder access',()=>{
 const n=nav({access:{mode:'custom',grants:['jobs.read','dashboard.read']},channel_access:[]});
 assert.equal(n.resolve('b07/invoices','employee'),null);assert.equal(n.resolve('b08/connections','employee'),null);
 assert.equal(n.resolve('b03/staff','employee'),null);assert.equal(n.resolve('b04/unified','employee'),null);
 const contexts=n.contexts('jobs','employee');assert.ok(contexts.length);
 for(const c of contexts) for(const i of c.items) assert.ok(n.sequence('employee').includes(i.view));
 assert.equal(n.resolve('f01/overview','owner'),null);
});
