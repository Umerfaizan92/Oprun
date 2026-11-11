import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import Database from 'better-sqlite3';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {startServer} from './test-server.mjs';
import {seedOwner,ownerContext} from './visual/session.mjs';

const s=await startServer();let browser;
try {
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
  const owner=await seedOwner(s);await s.call('GET','/api/saas/integrations/self-service',{cookie:owner.cookie});
  const db=new Database(s.dbPath), now=new Date().toISOString(), uid=randomUUID(), token=randomBytes(24).toString('hex');
  db.prepare("UPDATE organisation_integrations SET status='connected',account_label='Example Page',settings_json=? WHERE organisation_id=? AND provider='meta'").run(JSON.stringify({account_confirmed:true,resources:[{id:'123456',type:'facebook_page',label:'Example Page'}],selected_resources:[{id:'123456',type:'facebook_page',label:'Example Page'}],last_test_status:'pass'}),owner.org);
  db.prepare('INSERT INTO users(id,email,full_name,password_hash,password_salt,email_verified,phone_verified,created_at,updated_at) VALUES(?,?,?,?,?,1,1,?,?)').run(uid,'assigned-worker@example.test','Assigned worker','x','x',now,now);
  db.prepare("INSERT INTO memberships(organisation_id,user_id,role,created_at) VALUES(?,?,'worker',?)").run(owner.org,uid,now);
  db.prepare('INSERT INTO user_sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),uid,createHash('sha256').update(token).digest('hex'),new Date(Date.now()+3600000).toISOString(),now,now);db.close();
  for(const width of [390,768,1440]) {
    const context=await ownerContext(browser,s,owner,{viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(s.base+'/saas/workspace.html#b08/connections');
    const hub=page.locator('#channel-operations');await hub.locator('[data-co-provider]').waitFor();
    await hub.locator('[data-co-provider]').selectOption('meta');
    await hub.locator('[data-co-resource] option[value="123456"]').waitFor({state:'attached'});
    await hub.getByRole('tab',{name:'Publish & approvals',exact:true}).click();
    await hub.locator('[data-co-compose] textarea').fill('A helpful local post for review '+width);
    const saved=page.waitForResponse(r=>r.url().endsWith('/api/saas/channels/drafts')&&r.request().method()==='POST');
    await hub.getByRole('button',{name:'Save for approval',exact:true}).click();assert.equal((await saved).status(),201);
    await hub.locator('[data-co-status]').filter({hasText:'Draft saved'}).waitFor();
    assert.ok(await hub.getByText('A helpful local post for review '+width,{exact:true}).isVisible());
    await hub.getByRole('tab',{name:'Local campaigns',exact:true}).click();
    const f=hub.locator('[data-co-campaign]');await f.locator('[name=name]').fill('Local plan '+width);await f.locator('[name=goal]').fill('More local enquiries');await f.locator('[name=postcodes]').fill('6160, 6164');await f.locator('[name=mode]').selectOption('paid_plan');await f.locator('[name=budget]').fill('20');await f.locator('[name=body]').fill('A useful offer for nearby customers.');
    const planned=page.waitForResponse(r=>r.url().endsWith('/api/saas/channels/campaigns')&&r.request().method()==='POST');await f.getByRole('button',{name:'Save local plan for Facebook & Instagram',exact:true}).click();assert.equal((await planned).status(),201);
    await hub.locator('[data-co-status]').filter({hasText:'No content was sent'}).waitFor();
    await hub.getByRole('tab',{name:'Team access',exact:true}).click();
    const access=hub.locator('[data-co-access]');await access.locator('[name=user]').selectOption(uid);await access.locator('input[value=read]').check();await access.locator('[name=resource]').selectOption('123456');
    const granted=page.waitForResponse(r=>r.url().includes('/channels/team/')&&r.request().method()==='PUT');await access.getByRole('button',{name:'Save channel access'}).click();assert.equal((await granted).status(),200);await hub.locator('[data-co-status]').filter({hasText:'access updated'}).waitFor();
    const layout=await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth}));assert.ok(layout.page<=layout.viewport+1,JSON.stringify(layout));assert.deepEqual(errors,[]);
    await context.close();console.log('PASS channel drafts, local campaign plans, owner assignments and no overflow at '+width);
  }
  const context=await ownerContext(browser,s,{token,slug:owner.slug},{viewport:{width:390,height:900},reducedMotion:'reduce'}),page=await context.newPage();
  await page.goto(s.base+'/saas/workspace.html#b08/connections');const hub=page.locator('#channel-operations');await hub.locator('[data-co-provider]').waitFor();
  assert.deepEqual(await hub.locator('[data-co-provider] option').allTextContents(),['Facebook & Instagram']);
  assert.equal(await page.locator('#integration-self-service').isVisible(),false);assert.equal(await hub.getByRole('tab',{name:'Team access'}).count(),0);assert.equal(await hub.locator('[data-co-compose]').count(),0);
  console.log('PASS assigned worker sees only their channel, without credentials or owner controls');await context.close();
} finally {await browser?.close();await s.stop();}
