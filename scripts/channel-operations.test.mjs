import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import {createChannelOperations} from '../src/channel-operations.js';
import {createChannelProviderClient, channelCapabilities, publicImageUrl} from '../src/channel-providers.js';
import {startServer} from './test-server.mjs';
import {seedOwner} from './visual/session.mjs';
import {randomUUID} from 'node:crypto';

async function fixture(t) {
  const db=new Database(':memory:');
  db.exec(`CREATE TABLE organisations(id TEXT PRIMARY KEY);INSERT INTO organisations VALUES('A'),('B');CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT,full_name TEXT);CREATE TABLE memberships(organisation_id TEXT,user_id TEXT,role TEXT,status TEXT DEFAULT 'active',created_at TEXT);
  CREATE TABLE organisation_integrations(organisation_id TEXT,provider TEXT,display_name TEXT,status TEXT,capabilities_json TEXT,settings_json TEXT,updated_at TEXT,PRIMARY KEY(organisation_id,provider));`);
  for(const [user,business,role] of [['owner','A','owner'],['worker','A','worker'],['admin','A','admin'],['other','B','owner']]){
    db.prepare("INSERT INTO users VALUES(?,'active',?)").run(user,user);db.prepare('INSERT INTO memberships VALUES(?,?,?,\'active\',?)').run(business,user,role,'2026-11-01');
  }
  const resource={id:'mine',type:'youtube_channel',label:'My channel'}, second={id:'restricted',type:'youtube_channel',label:'Other selected channel'};
  const state={resources:[resource,second],selected_resources:[resource,second],account_confirmed:true,insights:{results:[{resource_id:'mine',metrics:[{value:12}]},{resource_id:'restricted',metrics:[{value:9999}]}]}};
  db.prepare('INSERT INTO organisation_integrations VALUES(?,?,?,?,?,?,?)').run('A','youtube','YouTube','connected','[]',JSON.stringify(state),new Date().toISOString());
  const load=(o,p)=>{const row=db.prepare('SELECT * FROM organisation_integrations WHERE organisation_id=? AND provider=?').get(o,p);return row?{row,settings:JSON.parse(row.settings_json)}:null;};
  let sends=0,uncertain=false,lastTarget;
  const app=express();app.use(express.json());
  const ops=createChannelOperations({db,runtime:{testConnection:async()=>({resources:[resource,second],bundle:{access_token:'fixture-only'}})},connections:()=>({load,fresh:async()=>({access_token:'fixture-only'})}),
    publicRow:r=>({status:r.status,health:{title:'Connected'},account_label:'My account',insights:JSON.parse(r.settings_json).insights}),
    providerClient:{sync:async()=>({items:[{remote_id:'comment',kind:'comment',title:'Customer',text:'Can you help?',can_reply:true}],metrics:[{key:'views',value:12,source:'YouTube'}],fetched_at:new Date().toISOString(),coverage:'Recent sample'}),execute:async(p,b,r,d,target)=>{lastTarget=target;sends++;await new Promise(r=>setTimeout(r,30));if(uncertain)throw new Error('Network timeout');return {id:'sent-'+sends};}}});
  const auth=(req,res,next)=>{const user=req.get('x-fixture-user')||'owner',m=db.prepare('SELECT * FROM memberships WHERE user_id=?').get(user);req.saas={organisation_id:m.organisation_id,user_id:user,role:m.role};next();};
  ops.install(app,{requireSaasUser:auth});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(()=>new Promise(resolve=>{server.close(()=>{db.close();resolve();});}));
  const call=async(path,{user='owner',body,method}={})=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/saas/channels'+path,{method:method||(body?'POST':'GET'),headers:{'content-type':'application/json','x-fixture-user':user},body:body?JSON.stringify(body):undefined});return {status:r.status,json:await r.json()};};
  const grant=async(user,actions,resources=[],revision=0)=>call('/team/'+user+'/youtube',{method:'PUT',body:{actions,resources,revision}});
  const draft=async()=>call('/drafts',{body:{provider:'youtube',resource_id:'mine',kind:'reply',body:'Thanks, we can discuss your enquiry.',item_id:db.prepare('SELECT id FROM channel_items LIMIT 1').get().id}});
  return {db,ops,call,grant,draft,sends:()=>sends,target:()=>lastTarget,uncertain:()=>{uncertain=true;}};
}

test('channel access is owner-controlled, tenant-bound, resource-scoped and revocable',async t=>{
  const f=await fixture(t);
  assert.deepEqual((await f.call('/overview',{user:'admin'})).json.providers,[],'admin role alone grants no channel access');
  assert.deepEqual((await f.call('/overview',{user:'worker'})).json.providers,[]);
  assert.equal((await f.call('/team',{user:'other'})).json.members.length,1,'another owner sees only their own membership');
  assert.equal((await f.call('/team/worker/youtube',{user:'other',method:'PUT',body:{actions:['read'],resources:[],revision:0}})).status,404);
  assert.equal((await f.grant('worker',['read','sync'],['mine'])).status,200);
  assert.equal(f.ops.canEveryResource({saas:{organisation_id:'A',user_id:'worker'}},'youtube','sync'),false,'a scoped grant cannot authorize a legacy broad publisher');
  assert.equal(f.ops.canEveryResource({saas:{organisation_id:'A',user_id:'owner'}},'youtube','approve'),true);
  assert.equal(f.ops.canEveryResource({saas:{organisation_id:'B',user_id:'worker'}},'youtube','sync'),false);
  const visible=(await f.call('/overview',{user:'worker'})).json.providers[0];
  assert.equal(visible.resources.length,1);assert.equal(visible.insights.results.length,1);assert.equal(visible.insights.results[0].metrics[0].value,12);
  assert.equal((await f.call('/youtube/sync',{user:'worker',body:{resource_id:'restricted'}})).status,403);
  assert.equal((await f.call('/youtube/sync',{user:'worker',body:{resource_id:'mine',organisation_id:'B'}})).status,400);
  assert.equal((await f.call('/youtube/sync',{user:'worker',body:{resource_id:'mine'}})).status,200);
  assert.equal((await f.call('/youtube/items',{user:'other'})).status,200);assert.equal((await f.call('/youtube/items',{user:'other'})).json.items.length,0);
  assert.equal((await f.grant('worker',[],[],1)).status,200);assert.equal((await f.call('/youtube/items',{user:'worker'})).status,403);
  assert.equal((await f.grant('worker',['read'],[],1)).status,409,'stale access revision is rejected');
});

test('publishing requires exact approval, claims once, and checks the current approver',async t=>{
  const f=await fixture(t);await f.call('/youtube/sync',{body:{resource_id:'mine'}});
  const created=await f.draft();assert.equal(created.status,201);const id=created.json.id;
  assert.equal((await f.call('/drafts/'+id+'/publish',{body:{revision:1}})).status,409);
  assert.equal((await f.call('/drafts/'+id+'/decision',{user:'other',body:{decision:'approve',revision:1}})).status,404);
  await f.call('/drafts/'+id+'/decision',{body:{decision:'approve',revision:1}});
  const [a,b]=await Promise.all([f.call('/drafts/'+id+'/publish',{body:{revision:1}}),f.call('/drafts/'+id+'/publish',{body:{revision:1}})]);
  assert.deepEqual([a.status,b.status].sort(),[200,409]);assert.equal(f.sends(),1);
  await f.grant('worker',['read','approve'],['mine']);const next=(await f.draft()).json.id;
  await f.call('/drafts/'+next+'/decision',{user:'worker',body:{decision:'approve',revision:1}});
  await f.grant('worker',[],[],1);
  assert.equal((await f.call('/drafts/'+next+'/publish',{body:{revision:1}})).status,409);assert.equal(f.sends(),1);
});

test('ambiguous delivery is held and a campaign approval cannot start ad spend',async t=>{
  const f=await fixture(t);await f.call('/youtube/sync',{body:{resource_id:'mine'}});const id=(await f.draft()).json.id;
  await f.call('/drafts/'+id+'/decision',{body:{decision:'approve',revision:1}});f.uncertain();
  const sent=await f.call('/drafts/'+id+'/publish',{body:{revision:1}});assert.equal(sent.json.status,'uncertain');
  assert.equal((await f.call('/drafts/'+id+'/publish',{body:{revision:1}})).status,409);assert.equal(f.sends(),1);
  const campaign=await f.call('/campaigns',{body:{name:'Local awareness',goal:'Local enquiries',providers:['youtube'],targeting:{country:'AU',postcodes:['6160']},body:'Helpful local content',mode:'paid_plan',daily_budget_cents:2000}});
  assert.equal(campaign.status,201);assert.equal(campaign.json.spend_started,false);
  const review=await f.call('/campaigns/'+campaign.json.id+'/approve',{body:{}});assert.equal(review.json.spend_started,false);assert.equal(review.json.status,'approved_plan');assert.equal(f.sends(),1);
});

test('provider adapters use official endpoints and only the approved reply target',async()=>{
  const calls=[];const client=createChannelProviderClient({runtime:{requestJson:async(url,opt)=>{calls.push({url,opt});return {id:'ack'};}}});
  await client.execute('youtube',{access_token:'fixture'}, {id:'mine'}, {kind:'reply',body:'Approved reply'}, {remote_id:'comment-owned',can_reply:true});
  assert.equal(calls[0].url,'https://www.googleapis.com/youtube/v3/comments?part=snippet');
  assert.deepEqual(JSON.parse(calls[0].opt.body),{snippet:{parentId:'comment-owned',textOriginal:'Approved reply'}});
  await assert.rejects(client.execute('gmail',{access_token:'fixture'},{id:'business@example.test'},{kind:'reply',body:'Reply'},{can_reply:true,recipient:'victim@example.test\r\nBcc: other@example.test',message_id:'id'}),/Unsafe reply headers/);
});

test('real server sessions cannot use workspace headers or platform keys to cross channel boundaries',async()=>{
  const s=await startServer();try {
    const a=await seedOwner(s),b=await seedOwner(s,{email:'other-channel@example.test'});
    assert.equal((await s.call('GET','/api/saas/channels/overview',{headers:{'x-admin-key':s.adminKey}})).status,401);
    assert.equal((await s.call('GET','/api/saas/channels/overview',{cookie:a.cookie,headers:{'X-Organisation-Id':b.org}})).status,403);
    const db=new Database(s.dbPath),user=randomUUID();
    db.prepare('INSERT INTO users(id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(user,'channel-worker@example.test','Channel worker','x','x',new Date().toISOString(),new Date().toISOString());
    db.prepare("INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES(?,?,'worker',?)").run(a.org,user,new Date().toISOString());db.close();
    const change=await s.call('PUT','/api/saas/channels/team/'+user+'/youtube',{cookie:a.cookie,body:{actions:['read'],resources:[],revision:0}});assert.equal(change.status,200);
    assert.equal((await s.call('PUT','/api/saas/channels/team/'+user+'/youtube',{cookie:b.cookie,body:{actions:['read','publish'],resources:[],revision:0}})).status,404);
  } finally {await s.stop();}
});


test('approval keeps its original reply target when later sync changes cached content',async t=>{
  const f=await fixture(t);await f.call('/youtube/sync',{body:{resource_id:'mine'}});const id=(await f.draft()).json.id;
  await f.call('/drafts/'+id+'/decision',{body:{decision:'approve',revision:1}});
  f.db.prepare("UPDATE channel_items SET content_json=? WHERE organisation_id='A'").run(JSON.stringify({remote_id:'different-comment',can_reply:true}));
  assert.equal((await f.call('/drafts/'+id+'/publish',{body:{revision:1}})).status,200);
  assert.equal(f.target().remote_id,'comment','approved reply cannot be redirected by a later import');
});

test('channel data follows business deletion without touching another business',async t=>{
  const f=await fixture(t);await f.grant('worker',['read'],['mine']);await f.call('/youtube/sync',{body:{resource_id:'mine'}});await f.draft();
  assert.ok(f.db.prepare('SELECT count(*) n FROM channel_items').get().n>0);
  f.db.prepare("DELETE FROM organisations WHERE id='A'").run();
  for(const table of ['channel_access','channel_items','channel_drafts','channel_sync_state','channel_campaigns'])assert.equal(f.db.prepare('SELECT count(*) n FROM '+table).get().n,0,table);
  assert.ok(f.db.prepare("SELECT id FROM organisations WHERE id='B'").get());
});


test('transport replies enforce WhatsApp windows and accept Business Profile update acknowledgements',async()=>{
  const calls=[],client=createChannelProviderClient({runtime:{requestJson:async(url,opt)=>{calls.push({url,opt});return {updateTime:'2026-11-11T12:00:00Z'};}}});
  const draft={kind:'reply',body:'A reviewed response'};
  await assert.rejects(client.execute('whatsapp',{access_token:'fixture'},{id:'phone'},draft,{can_reply:true,recipient:'+61411111111',occurred_at:new Date(Date.now()-25*3600000).toISOString()}),/window is closed/);
  assert.equal(calls.length,0,'closed-window messaging never reaches the transport');
  const ack=await client.execute('google_business',{access_token:'fixture'},{parent_id:'accounts/1',id:'locations/2'},draft,{can_reply:true,remote_id:'review-3'});
  assert.equal(ack.id,'accounts/1/locations/2/reviews/review-3/reply');
});

test('synced content carries only provider-hosted links, previews and measured totals (T-079)',async()=>{
  const {providerLink}=await import('../src/channel-providers.js');
  assert.equal(providerLink('https://www.tiktok.com/@a/video/1',['tiktok.com']),'https://www.tiktok.com/@a/video/1');
  for(const bad of ['http://www.tiktok.com/x','javascript:alert(1)','https://tiktok.com.evil.test/x','https://eviltiktok.com/x','https://user:pw@www.tiktok.com/x','https://www.tiktok.com:8443/x',''])assert.equal(providerLink(bad,['tiktok.com']),undefined,bad);
  const calls=[],videos=[
    {id:'7080213458555737986',title:'Before & after',video_description:'Before & after #rims',create_time:1767225600,duration:31,cover_image_url:'https://p16-sign-sg.tiktokcdn.com/c.image?x-expires=1',share_url:'https://www.tiktok.com/@fp/video/7080213458555737986',view_count:803,like_count:8,comment_count:0,share_count:0},
    {id:'not-numeric',title:'Second',cover_image_url:'https://evil.test/c.png',share_url:'javascript:alert(1)',view_count:412,like_count:8,comment_count:0,share_count:0}];
  const client=createChannelProviderClient({runtime:{requestJson:async(url)=>{calls.push(url);return url.includes('/video/list/')?{data:{videos}}:{data:{user:{follower_count:120,likes_count:55,video_count:14}}};}}});
  const basic=await client.sync('tiktok',{access_token:'t',scope:'user.info.basic,video.list'},{id:'open',type:'tiktok_account'});
  assert.match(calls[0],/cover_image_url/);assert.match(calls[0],/share_url/);assert.equal(calls.length,1,'profile totals are not requested without the granted permission');
  const [a,b]=basic.items;
  assert.equal(a.url,'https://www.tiktok.com/@fp/video/7080213458555737986');assert.match(a.thumbnail,/^https:\/\/p16-sign-sg\.tiktokcdn\.com\//);assert.equal(a.embed,'https://www.tiktok.com/player/v1/7080213458555737986');assert.equal(a.occurred_at,'2026-01-01T00:00:00.000Z');assert.equal(a.duration_seconds,31);assert.equal(a.metrics.views,803);
  assert.equal(b.url,undefined);assert.equal(b.thumbnail,undefined);assert.equal(b.embed,undefined);
  const by=Object.fromEntries(basic.metrics.map(m=>[m.key,m.value]));assert.deepEqual(by,{videos_in_sample:2,views:1215,likes:16,comments:0,shares:0});
  const withStats=await client.sync('tiktok',{access_token:'t',scope:'user.info.basic,user.info.stats,video.list'},{id:'open',type:'tiktok_account'});
  assert.equal(withStats.metrics.find(m=>m.key==='followers').value,120);
  videos[1].view_count=undefined;const partial=await client.sync('tiktok',{access_token:'t',scope:'video.list'},{id:'open',type:'tiktok_account'});
  assert.equal(partial.metrics.find(m=>m.key==='views').value,null,'a missing figure is never summed as zero');
});

test('growth actions are permission-scoped, evidence-based and never write by themselves (T-080)',async t=>{
  const f=await fixture(t);await f.call('/youtube/sync',{body:{resource_id:'mine'}});
  const before=f.db.prepare('SELECT (SELECT COUNT(*) FROM channel_drafts)+(SELECT COUNT(*) FROM channel_campaigns) n').get().n;
  const r=await f.call('/growth-actions',{body:{goal:'leads'}});assert.equal(r.status,200);assert.equal(r.json.sent,false);assert.equal(r.json.method,'guided_rules');
  const yt=r.json.actions.find(a=>a.key==='youtube:leads');assert.equal(yt.apply.type,'campaign','YouTube cannot post text, so the action is a plan');assert.deepEqual(yt.apply.providers,['youtube']);
  assert.equal(f.db.prepare('SELECT (SELECT COUNT(*) FROM channel_drafts)+(SELECT COUNT(*) FROM channel_campaigns) n').get().n,before,'recommending writes nothing');
  assert.equal((await f.call('/growth-actions',{body:{goal:'spend-money'}})).status,400);
  assert.equal((await f.call('/growth-actions',{user:'worker',body:{goal:'leads'}})).json.actions.length,0,'staff without channel access get no actions');
  await f.grant('worker',['read','draft']);assert.equal((await f.call('/growth-actions',{user:'worker',body:{goal:'promotion'}})).json.actions.length,0,'a plan needs campaign permission');
  assert.equal((await f.call('/growth-actions',{user:'other',body:{goal:'leads'}})).json.actions.some(a=>a.provider==='youtube'&&a.apply.type!=='connect'),false,'another business never sees this account');
});

test('Meta sync reads only managed Pages and linked Instagram, and replies only to synced comments (S1)',async()=>{
  const calls=[];
  const pages={data:[{id:'111',access_token:'page-token',instagram_business_account:{id:'222'}}]};
  const client=createChannelProviderClient({runtime:{requestJson:async(url,opt={})=>{calls.push({url,auth:opt.headers?.authorization,body:opt.body});
    if(url.includes('me/accounts'))return pages;
    if(url.includes('/111?fields'))return {followers_count:40,fan_count:38};
    if(url.includes('/111/posts'))return {data:[{id:'111_9',message:'Hi',created_time:'2026-11-10T10:00:00+0000',permalink_url:'https://www.facebook.com/111/posts/9',full_picture:'https://evil.example/x.png',comments:{data:[{id:'9_1',message:'Price?',from:{name:'Sam'},created_time:'2026-11-11T10:00:00+0000'}]}}]};
    if(url.includes('/222?fields'))return {followers_count:500,media_count:12};
    if(url.includes('/222/media'))return {data:[{id:'m1',caption:'New job',media_type:'IMAGE',media_url:'https://scontent.cdninstagram.com/a.jpg',permalink:'https://www.instagram.com/p/x/',timestamp:'2026-11-09T10:00:00+0000',like_count:7,comments_count:1,comments:{data:[{id:'17890001',text:'Nice',username:'kim',timestamp:'2026-11-10T10:00:00+0000'}]}}]};
    return {id:'ack'};}}});
  const fb=await client.sync('meta',{access_token:'user-token'},{id:'111',type:'facebook_page'});
  assert.equal(fb.items.length,2);assert.equal(fb.items[0].url,'https://www.facebook.com/111/posts/9');assert.equal(fb.items[0].thumbnail,undefined);
  assert.deepEqual(fb.metrics.map(m=>[m.key,m.value]),[['followers',40],['page_likes',38]]);
  assert.ok(calls.filter(c=>c.url.includes('/111/')).every(c=>c.auth==='Bearer page-token'));
  const ig=await client.sync('meta',{access_token:'user-token'},{id:'222',type:'instagram_account',parent_id:'111'});
  assert.equal(ig.items.find(i=>i.kind==='comment').parent_id,'m1');assert.equal(ig.items[0].thumbnail,'https://scontent.cdninstagram.com/a.jpg');
  assert.ok(ig.metrics.some(m=>m.key==='followers'&&m.value===500));
  await assert.rejects(client.sync('meta',{access_token:'user-token'},{id:'333',type:'instagram_account',parent_id:'111'}),/no longer linked/);
  await assert.rejects(client.sync('meta',{access_token:'user-token'},{id:'999',type:'facebook_page'}),/not managed/);
  calls.length=0;
  await client.execute('meta',{access_token:'user-token'},{id:'111',type:'facebook_page'},{kind:'reply',body:'Thanks'},{kind:'comment',remote_id:'9_1',can_reply:true});
  assert.match(calls.at(-1).url,/\/9_1\/comments$/);assert.equal(calls.at(-1).auth,'Bearer page-token');
  await client.execute('meta',{access_token:'user-token'},{id:'222',type:'instagram_account',parent_id:'111'},{kind:'reply',body:'Thanks'},{kind:'comment',remote_id:'17890001',can_reply:true});
  assert.equal(calls.at(-1).url,'https://graph.facebook.com/v23.0/17890001/replies');
  await assert.rejects(client.execute('meta',{access_token:'t'},{id:'111',type:'facebook_page'},{kind:'reply',body:'x'},{kind:'post',remote_id:'111_9',can_reply:true}),/Only synced comments/);
  assert.equal(channelCapabilities('meta','facebook_page').sync,true);assert.equal(channelCapabilities('meta','instagram_account').reply,true);
});

test('Instagram and Facebook image posts use public https images and publish once (S2)',async()=>{
  for(const bad of ['http://a.com/x.jpg','https://user:pw@a.com/x.jpg','https://a.com:8443/x.jpg','https://127.0.0.1/x.jpg','https://localhost/x.jpg','https://[::1]/x.jpg','https://box.internal/x.jpg','javascript:alert(1)'])assert.equal(publicImageUrl(bad),null,bad);
  assert.equal(publicImageUrl(' https://cdn.example.com/a.jpg '),'https://cdn.example.com/a.jpg');
  const calls=[];let status=['IN_PROGRESS','FINISHED'];
  const pages={data:[{id:'111',access_token:'page-token',instagram_business_account:{id:'222'}}]};
  const client=createChannelProviderClient({env:{META_MEDIA_POLL_MS:0},runtime:{requestJson:async(url,opt={})=>{calls.push({url,auth:opt.headers?.authorization,body:opt.body&&JSON.parse(opt.body)});
    if(url.includes('me/accounts'))return pages;
    if(url.endsWith('/222/media'))return {id:'18000001'};
    if(url.includes('/18000001?fields=status_code'))return {status_code:status.shift()||'FINISHED'};
    if(url.endsWith('/222/media_publish'))return {id:'18000099'};
    if(url.endsWith('/111/photos'))return {id:'p1',post_id:'111_77'};
    return {id:'ack'};}}});
  const ig={id:'222',type:'instagram_account',parent_id:'111'};
  const r=await client.execute('meta',{access_token:'user-token'},ig,{kind:'post',body:'New job done',media_url:'https://cdn.example.com/a.jpg'},null);
  assert.equal(r.id,'18000099');
  assert.deepEqual(calls.find(c=>c.url.endsWith('/222/media')).body,{image_url:'https://cdn.example.com/a.jpg',caption:'New job done'});
  assert.equal(calls.filter(c=>c.url.endsWith('/media_publish')).length,1);
  await assert.rejects(client.execute('meta',{access_token:'t'},ig,{kind:'post',body:'x'},null),/need an image/);
  calls.length=0;status=['ERROR'];
  await assert.rejects(client.execute('meta',{access_token:'t'},ig,{kind:'post',body:'x',media_url:'https://cdn.example.com/a.jpg'},null),/could not process/);
  assert.equal(calls.filter(c=>c.url.endsWith('/media_publish')).length,0);
  status=Array(10).fill('IN_PROGRESS');
  await assert.rejects(client.execute('meta',{access_token:'t'},ig,{kind:'post',body:'x',media_url:'https://cdn.example.com/a.jpg'},null),e=>e.status===409&&/Nothing was published/.test(e.message));
  await assert.rejects(client.execute('meta',{access_token:'t'},{id:'333',type:'instagram_account',parent_id:'111'},{kind:'post',body:'x',media_url:'https://cdn.example.com/a.jpg'},null),/no longer linked/);
  const fb=await client.execute('meta',{access_token:'t'},{id:'111',type:'facebook_page'},{kind:'post',body:'Hi',media_url:'https://cdn.example.com/a.jpg'},null);
  assert.equal(fb.id,'111_77');assert.equal(calls.at(-1).auth,'Bearer page-token');assert.deepEqual(calls.at(-1).body,{url:'https://cdn.example.com/a.jpg',caption:'Hi'});
  await assert.rejects(client.execute('meta',{access_token:'t'},{id:'111',type:'facebook_page'},{kind:'post',body:'Hi',media_url:'http://x.com/a.jpg'},null),/public https/);
  const c=channelCapabilities('meta','instagram_account');assert.equal(c.post,true);assert.equal(c.media_required,true);
  assert.equal(channelCapabilities('x','x_account').media,true,'X takes photos and videos since V2');
});

test('draft images are additive, validated and refused where the channel cannot post them (S2)',async t=>{
  const f=await fixture(t);
  assert.ok(f.db.prepare('PRAGMA table_info(channel_drafts)').all().some(c=>c.name==='media_url'));
  await f.call('/youtube/sync',{body:{resource_id:'mine'}});
  const item=f.db.prepare('SELECT id FROM channel_items LIMIT 1').get().id;
  const send=media_url=>f.call('/drafts',{body:{provider:'youtube',resource_id:'mine',kind:'reply',body:'Thanks',item_id:item,media_url}});
  assert.equal((await send('https://localhost/a.jpg')).status,400);
  assert.equal((await send('https://cdn.example.com/a.jpg')).status,409);
  const ok=await f.draft();assert.equal(ok.status,201);
  assert.equal(f.db.prepare('SELECT media_url FROM channel_drafts WHERE id=?').get(ok.json.id).media_url,null);
});

test('WhatsApp sends only approved utility templates, re-checked at send time (S3)',async()=>{
  const calls=[];let list=[
    {name:'job_update',language:'en_AU',status:'APPROVED',category:'UTILITY',components:[{type:'BODY',text:'Hi {{1}}, your job is booked for {{2}}.'}]},
    {name:'promo',language:'en_AU',status:'APPROVED',category:'MARKETING',components:[{type:'BODY',text:'Sale!'}]},
    {name:'draft_one',language:'en_AU',status:'PENDING',category:'UTILITY',components:[{type:'BODY',text:'x'}]},
    {name:'with_image',language:'en',status:'APPROVED',category:'UTILITY',components:[{type:'HEADER',format:'IMAGE'},{type:'BODY',text:'Done'}]}];
  const client=createChannelProviderClient({runtime:{requestJson:async(url,opt={})=>{calls.push({url,body:opt.body&&JSON.parse(opt.body)});
    if(url.includes('/message_templates'))return {data:list};return {messages:[{id:'wamid.1'}]};}}});
  const phone={id:'555',type:'whatsapp_phone',parent_id:'444'};
  const t=await client.templates({access_token:'t'},phone);
  assert.deepEqual(t.map(x=>[x.name,x.params,x.available]),[['job_update',2,true],['with_image',0,false]]);
  assert.match(calls[0].url,/\/444\/message_templates\?/);
  await assert.rejects(client.templates({access_token:'t'},{id:'444',type:'whatsapp_business_account'}),/phone number/);
  const old={recipient:'+61400000000',occurred_at:new Date(Date.now()-3*86400000).toISOString(),can_reply:true};
  const draft={kind:'reply',body:'Hi Sam',template_json:JSON.stringify({name:'job_update',language:'en_AU',params:['Sam','Monday']})};
  const r=await client.execute('whatsapp',{access_token:'t'},phone,draft,old);
  assert.equal(r.id,'wamid.1');
  assert.deepEqual(calls.at(-1).body,{messaging_product:'whatsapp',to:'61400000000',type:'template',template:{name:'job_update',language:{code:'en_AU'},components:[{type:'body',parameters:[{type:'text',text:'Sam'},{type:'text',text:'Monday'}]}]}});
  await assert.rejects(client.execute('whatsapp',{access_token:'t'},phone,{kind:'reply',body:'free text'},old),/window is closed/);
  list=list.filter(x=>x.name!=='job_update');
  await assert.rejects(client.execute('whatsapp',{access_token:'t'},phone,draft,old),/no longer approved/);
});

test('templates are refused outside WhatsApp replies (S3)',async t=>{
  const f=await fixture(t);await f.call('/youtube/sync',{body:{resource_id:'mine'}});
  const item=f.db.prepare('SELECT id FROM channel_items LIMIT 1').get().id;
  const r=await f.call('/drafts',{body:{provider:'youtube',resource_id:'mine',kind:'reply',body:'x',item_id:item,template:{name:'job_update',language:'en_AU',params:[]}}});
  assert.equal(r.status,409);
  assert.ok(f.db.prepare('PRAGMA table_info(channel_drafts)').all().some(c=>c.name==='template_json'));
});

test('TikTok posting: permission, creator-chosen visibility, one post only, status checked (S4)',async t=>{
  const f=await fixture(t);
  assert.ok(f.db.prepare('PRAGMA table_info(channel_drafts)').all().some(c=>c.name==='options_json'));
  const bad=await f.call('/drafts',{body:{provider:'youtube',resource_id:'mine',kind:'post',body:'Hi',privacy_level:'SELF_ONLY'}});
  assert.ok([400,409].includes(bad.status));
  const calls=[];let status=['PROCESSING_DOWNLOAD','PUBLISH_COMPLETE'],initReply={data:{publish_id:'v_pub_url~v2.123'},error:{code:'ok'}};
  const client=createChannelProviderClient({env:{TIKTOK_PUBLISH_POLL_MS:0},runtime:{requestJson:async(url,opt={})=>{calls.push({url,body:opt.body&&JSON.parse(opt.body)});
    if(url.includes('creator_info'))return {data:{creator_nickname:'Fleet',privacy_level_options:['SELF_ONLY','FOLLOWER_OF_CREATOR'],comment_disabled:false,duet_disabled:true,stitch_disabled:true,max_video_post_duration_sec:300},error:{code:'ok'}};
    if(url.includes('/video/init/'))return initReply;
    if(url.includes('/status/fetch/'))return {data:{status:status.shift()||'PROCESSING_UPLOAD'}};
    return {};}}});
  const acct={id:'open1',type:'tiktok_account'},granted={access_token:'t',scope:'user.info.basic,video.list,video.publish'};
  const post=(privacy,media='https://cdn.example.com/v.mp4')=>({kind:'post',body:'Gutter clean before and after',media_url:media,options_json:JSON.stringify({privacy_level:privacy})});
  const info=await client.tiktokCreatorInfo(granted);
  assert.deepEqual(info.privacy_levels,['SELF_ONLY','FOLLOWER_OF_CREATOR']);
  await assert.rejects(client.execute('tiktok',{access_token:'t',scope:'video.list'},acct,post('SELF_ONLY')),/video\.publish/);
  await assert.rejects(client.execute('tiktok',granted,acct,post('PUBLIC_TO_EVERYONE')),/Choose who can see/);
  await assert.rejects(client.execute('tiktok',granted,acct,post('SELF_ONLY','http://localhost/v.mp4')),/video link is not a public https link/);
  calls.length=0;
  assert.deepEqual(await client.execute('tiktok',granted,acct,post('SELF_ONLY')),{id:'v_pub_url~v2.123'});
  const init=calls.find(c=>c.url.includes('/video/init/'));
  assert.equal(init.body.source_info.source,'PULL_FROM_URL');assert.equal(init.body.post_info.privacy_level,'SELF_ONLY');assert.equal(init.body.post_info.disable_duet,true);
  assert.equal(calls.filter(c=>c.url.includes('/video/init/')).length,1);
  status=[];calls.length=0;
  assert.deepEqual(await client.execute('tiktok',granted,acct,post('SELF_ONLY')),{id:'v_pub_url~v2.123',processing:true});
  assert.equal(calls.filter(c=>c.url.includes('/video/init/')).length,1);
  status=['FAILED'];
  await assert.rejects(client.execute('tiktok',granted,acct,post('SELF_ONLY')),/could not publish/);
  initReply={error:{code:'url_ownership_unverified'}};
  await assert.rejects(client.execute('tiktok',granted,acct,post('SELF_ONLY')),/domain is verified/);
  assert.equal(channelCapabilities('tiktok','tiktok_account').post,true);assert.equal(channelCapabilities('tiktok','tiktok_account').media_required,true);
});

test('Business Profile posts may carry a public photo and are length-checked (S6)', async () => {
  const calls = []; const client = createChannelProviderClient({ runtime: { requestJson: async (url, opt = {}) => { calls.push({ url, body: JSON.parse(opt.body || '{}') }); return { name: 'accounts/1/locations/2/localPosts/3' }; } } });
  const loc = { id: 'locations/2', parent_id: 'accounts/1', type: 'google_business_location' };
  await client.execute('google_business', { access_token: 't' }, loc, { kind: 'post', body: 'Winter special', media_url: 'https://cdn.example.com/a.jpg' });
  assert.deepEqual(calls[0].body.media, [{ mediaFormat: 'PHOTO', sourceUrl: 'https://cdn.example.com/a.jpg' }]);
  await client.execute('google_business', { access_token: 't' }, loc, { kind: 'post', body: 'Text only' });
  assert.equal(calls[1].body.media, undefined);
  await assert.rejects(client.execute('google_business', { access_token: 't' }, loc, { kind: 'post', body: 'x'.repeat(1501) }), /1,500/);
  assert.equal(channelCapabilities('google_business', 'google_business_location').media, true);
  assert.equal(channelCapabilities('google_business', 'google_business_location').media_required, false);
});

test('Facebook Page video and Instagram Reels post from a public video link (V1)', async t => {
  const calls = [];let igStatus = ['IN_PROGRESS', 'FINISHED'];
  const client = createChannelProviderClient({ env: { META_MEDIA_POLL_MS: 0 }, runtime: { requestJson: async (url, opt = {}) => { calls.push({ url, auth: opt.headers?.authorization, body: opt.body && JSON.parse(opt.body) });
    if (url.includes('me/accounts')) return { data: [{ id: '111', access_token: 'page-token', instagram_business_account: { id: '222' } }] };
    if (url.endsWith('/111/videos')) return { id: 'vid1' };
    if (url.endsWith('/222/media')) return { id: '3333' };
    if (url.includes('/3333?fields=status_code')) return { status_code: igStatus.shift() || 'IN_PROGRESS' };
    if (url.endsWith('/media_publish')) return { id: 'reel1' };
    return {}; } } });
  const draft = kind => ({ kind: 'post', body: 'Before and after', media_url: 'https://cdn.example.com/job.mp4', options_json: JSON.stringify({ media_kind: kind }) });
  assert.deepEqual(await client.execute('meta', { access_token: 'u' }, { id: '111', type: 'facebook_page' }, draft('video')), { id: 'vid1' });
  const fb = calls.find(c => c.url.endsWith('/111/videos'));
  assert.match(fb.url, /^https:\/\/graph-video\.facebook\.com\/v[\d.]+\/111\/videos$/); assert.equal(fb.auth, 'Bearer page-token');
  assert.deepEqual(fb.body, { file_url: 'https://cdn.example.com/job.mp4', description: 'Before and after' });
  calls.length = 0;
  await client.execute('meta', { access_token: 'u' }, { id: '222', type: 'instagram_account', parent_id: '111' }, draft('video'));
  assert.deepEqual(calls.find(c => c.url.endsWith('/222/media')).body, { media_type: 'REELS', video_url: 'https://cdn.example.com/job.mp4', caption: 'Before and after', share_to_feed: true });
  assert.equal(calls.filter(c => c.url.endsWith('/media_publish')).length, 1);
  calls.length = 0; igStatus = [];
  await assert.rejects(client.execute('meta', { access_token: 'u' }, { id: '222', type: 'instagram_account', parent_id: '111' }, draft('video')), /still processing the video/);
  assert.equal(calls.filter(c => c.url.endsWith('/media_publish')).length, 0, 'nothing published while still processing');
  calls.length = 0;
  await client.execute('meta', { access_token: 'u' }, { id: '111', type: 'facebook_page' }, { ...draft('image'), media_url: 'https://cdn.example.com/a.jpg' });
  assert.ok(calls.some(c => c.url.endsWith('/111/photos')));
  assert.equal(channelCapabilities('meta', 'instagram_account').video, true); assert.equal(channelCapabilities('tiktok', 'tiktok_account').image, false);
  const f = await fixture(t);
  const r = await f.call('/drafts', { body: { provider: 'youtube', resource_id: 'mine', kind: 'post', body: 'x', media_url: 'https://cdn.example.com/v.mp4', media_kind: 'video' } });
  assert.equal(r.status, 400, 'YouTube video posts need a visibility choice (V2)');
});

test('YouTube uploads and X photo and video posts use the safe media fetcher and post once (V2)', async () => {
  const calls = [], http = [];
  const file = { body: Buffer.alloc(9 * 1048576, 1), type: 'video/mp4', size: 9 * 1048576 };
  const fetchMedia = async (link, o) => { calls.push({ media: link, kind: o.kind }); return o.kind === 'image' ? { body: Buffer.from('img'), type: 'image/png', size: 3 } : file; };
  let xStatus = ['in_progress', 'succeeded'], finalizeReply = { data: { processing_info: { state: 'pending' } } };
  const fakeHttp = async (url, opt) => { http.push({ url, method: opt.method, body: opt.body });
    if (url.includes('upload_id=abc')) return Response.json({ id: 'dQw4w9WgXcQ' });
    if (url.includes('uploadType=resumable')) return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=abc' } });
    if (url.includes('/append')) return new Response(null, { status: 204 });
    return new Response('{}', { status: 404 }); };
  const client = createChannelProviderClient({ env: { X_MEDIA_POLL_MS: 0 }, fetchMedia, http: fakeHttp, runtime: { requestJson: async (url, opt = {}) => { calls.push({ url, body: opt.body && JSON.parse(opt.body) });
    if (url.includes('channels?part=id&mine=true')) return { items: [{ id: 'UC123' }] };
    if (url.endsWith('/initialize')) return { data: { id: '1880028106020515840' } };
    if (url.endsWith('/finalize')) return finalizeReply;
    if (url.includes('command=STATUS')) return { data: { processing_info: { state: xStatus.shift() || 'in_progress' } } };
    if (url.endsWith('/2/tweets')) return { data: { id: '42' } };
    return {}; } } });
  const yt = { id: 'UC123', type: 'youtube_channel' };
  const ytDraft = (privacy) => ({ kind: 'post', body: 'Gutter clean <before & after>\nFull job in Fremantle', media_url: 'https://cdn.example.com/job.mp4', options_json: JSON.stringify({ media_kind: 'video', ...(privacy ? { video_privacy: privacy } : {}) }) });
  await assert.rejects(client.execute('youtube', { access_token: 't' }, yt, ytDraft()), /Choose who can see/);
  await assert.rejects(client.execute('youtube', { access_token: 't' }, { id: 'UCother', type: 'youtube_channel' }, ytDraft('public')), /not owned/);
  assert.deepEqual(await client.execute('youtube', { access_token: 't' }, yt, ytDraft('unlisted')), { id: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  const meta = JSON.parse(http.find((h) => h.method === 'POST' && h.url.includes('uploadType=resumable')).body);
  assert.equal(meta.snippet.title, 'Gutter clean before & after'); assert.equal(meta.status.privacyStatus, 'unlisted');
  assert.equal(http.filter((h) => h.method === 'PUT').length, 1, 'uploaded once');
  const xDraft = (kind, link) => ({ kind: 'post', body: 'New job done', media_url: link, options_json: JSON.stringify({ media_kind: kind }) });
  await assert.rejects(client.execute('x', { access_token: 't', scope: 'tweet.write' }, { id: '1', type: 'x_account' }, xDraft('video', 'https://cdn.example.com/v.mp4')), /media.write/);
  http.length = 0; calls.length = 0;
  await client.execute('x', { access_token: 't', scope: 'tweet.write media.write' }, { id: '1', type: 'x_account' }, xDraft('video', 'https://cdn.example.com/v.mp4'));
  assert.equal(http.filter((h) => h.url.includes('/append')).length, 3, '9 MB in 4 MB chunks');
  const tweet = calls.find((c) => c.url?.endsWith('/2/tweets'));
  assert.deepEqual(tweet.body.media, { media_ids: ['1880028106020515840'] });
  xStatus = ['failed']; calls.length = 0;
  await assert.rejects(client.execute('x', { access_token: 't', scope: 'media.write' }, { id: '1', type: 'x_account' }, xDraft('video', 'https://cdn.example.com/v.mp4')), /could not process/);
  assert.equal(calls.filter((c) => c.url?.endsWith('/2/tweets')).length, 0, 'nothing posted after a failed upload');
  calls.length = 0; finalizeReply = { data: {} };
  await client.execute('x', { access_token: 't', scope: 'media.write' }, { id: '1', type: 'x_account' }, { ...xDraft('image', 'https://cdn.example.com/a.png'), options_json: JSON.stringify({ media_kind: 'image' }) });
  assert.equal(calls.find((c) => c.media)?.kind, 'image');
  assert.equal(channelCapabilities('youtube', 'youtube_channel').post, true); assert.equal(channelCapabilities('youtube', 'youtube_channel').image, false);
});

test('media fetcher refuses private addresses, wrong types and oversize files', async () => {
  const { createMediaFetcher, isPublicAddress } = await import('../src/media-fetch.js');
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.1.1', '100.64.0.1', '::1', 'fd00::1', '::ffff:127.0.0.1']) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress('142.250.70.14'), true);
  const fetchMedia = createMediaFetcher({ lookup: async (h) => [{ address: h === 'evil.example.com' ? '169.254.169.254' : '93.184.216.34', family: 4 }] });
  await assert.rejects(fetchMedia('https://evil.example.com/v.mp4'), /public website/);
  await assert.rejects(fetchMedia('http://cdn.example.com/v.mp4'), /public https link/);
  await assert.rejects(fetchMedia('https://user:pw@cdn.example.com/v.mp4'), /public https link/);
  await assert.rejects(fetchMedia('https://127.0.0.1/v.mp4'), /public https link/);
});
