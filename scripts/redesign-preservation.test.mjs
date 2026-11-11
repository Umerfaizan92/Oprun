import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../saas/workspace-nav.js',import.meta.url),'utf8');
function nav(session={}) {const window={GDS_SESSION:session};vm.runInNewContext(source,{window});return window.SuperProNav;}
const baseline=JSON.parse(fs.readFileSync(new URL('../docs/redesign/BASELINE_ROUTES.json',import.meta.url)));
test('seven daily groups plus Setup retain every view, canonical hash, old alias and bare group',()=>{
 const n=nav(),items=n.DOMAINS.flatMap(g=>g.items);
 assert.equal(n.DOMAINS.length,8);assert.equal(n.DOMAINS.filter(g=>!g.utility).length,7);assert.deepEqual([...n.DOMAINS.map(g=>g.label)],['Today','Work','Customers','People','Communications','Growth','Money','Setup']);assert.equal(items.length,60);assert.equal(new Set(items.map(i=>i.view)).size,60);
 for(const p of baseline.business.flatMap(g=>g.items)) {
  assert.equal(n.resolve(p.path,'owner'),p.view);
  assert.equal(n.resolve(p.view,'owner'),p.view);
  for(const alias of p.alias||[]) assert.equal(n.resolve(alias,'owner'),p.view);
 }
 assert.equal(n.resolve('b06','owner'),'seocentre');assert.equal(n.resolve('b09','owner'),'billing');
 assert.equal(n.pathFor('unifiedinbox'),'communications/inbox');assert.equal(n.DOMAINS.find(g=>g.id==='communications').items[0].view,'unifiedinbox');
 assert.equal(n.resolve('b04/unified','owner'),'unifiedinbox');assert.equal(n.resolve('work','owner'),'enquiries');
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
test('no B01-B09 inventory numbering is visible in labels, page titles or canonical routes',()=>{
 const n=nav(),meta=n.pageMeta();
 for(const g of n.DOMAINS){assert.doesNotMatch(g.label+' '+g.kicker+' '+g.id,/\bB0\d/i);for(const i of g.items){assert.doesNotMatch(i.label,/\bB0\d/i);assert.doesNotMatch(i.path,/^b0\d/);}}
 for(const [kicker,label] of Object.values(meta)) assert.doesNotMatch(kicker+' '+label,/\bB0\d/i);
 for(const w of n.WORKFLOWS) assert.doesNotMatch(w.label,/\bB0\d/i);
});

test('canonicalising an authorised legacy deep link preserves its section without leaking it to another view',()=>{
 const n=nav(),fn=fs.readFileSync(new URL('../saas/app.js',import.meta.url),'utf8').match(/^function showView.*$/m)[0];
 for(const [hash,target,expected] of [['#b07/ledger?section=reports','finance','#'+n.pathFor('finance')+'?section=reports'],['#b07/ledger?section=reports','jobs','#'+n.pathFor('jobs')]]){
  let pushed;
  const c={NAV:{...n,reveal(){}},currentRole:'owner',viewSequence:n.sequence('owner'),pageMeta:{},location:{hash},history:{pushState(_a,_b,url){pushed=url}},$:()=>null,$$:()=>[],note(){},updateFlowNav(){},closeSidebar(){},window:{dispatchEvent(){}},CustomEvent:class{},requestAnimationFrame(){},loadFinance:async()=>{}};
  vm.runInNewContext(fn+`;showView('${target}')`,c);assert.equal(pushed,expected);
 }
});
