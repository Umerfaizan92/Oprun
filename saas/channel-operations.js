(() => {
  const root = document.getElementById('channel-operations');if (!root) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let model = null, items = [], drafts = [], campaigns = [], team = null, active = 'overview', busy = false, detailSequence = 0;
  const api = async(path,body,method) => {const r = await fetch('/api/saas/channels' + path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body ? {method:method || 'POST',body:JSON.stringify(body)} : {})});const d = await r.json();if (!r.ok) throw new Error(d.error || 'Request failed.');return d;};
  const selectedProvider = () => model?.providers.find(p => p.provider === root.querySelector('[data-co-provider]')?.value);
  const message = (text,error = false) => {const box = root.querySelector('[data-co-status]');if (box) {box.textContent=text;box.dataset.error=String(error);}};
  const date = v => v ? new Date(v).toLocaleString() : 'Not refreshed';
  const panel = name => root.querySelector(`[data-co-panel="${name}"]`);
  const button = (label,key,value = '') => `<button type="button" class="secondary-button compact" data-co-${key}="${esc(value)}">${esc(label)}</button>`;
  const permitted = (p,action) => p?.actions.includes(action);
  function switchTab(name) {
    active=name;root.querySelectorAll('[data-co-panel]').forEach(p => p.hidden=p.dataset.coPanel!==name);
    root.querySelectorAll('[data-co-tab]').forEach(b => {b.setAttribute('aria-selected',String(b.dataset.coTab===name));b.tabIndex=b.dataset.coTab===name?0:-1;});
  }
  function shell() {
    root.innerHTML = `<div class="panel-head"><div><span class="panel-kicker">CHANNEL OPERATIONS</span><h2>One business. Every assigned channel.</h2><p>Review content, replies and local plans with clear account ownership.</p></div>${button('Refresh overview','refresh')}</div>
      <div class="co-toolbar"><label>Channel<select data-co-provider aria-label="Channel"></select></label><label>Selected account<select data-co-resource aria-label="Selected account"></select></label>${button('Sync recent content','sync')}</div>
      <div class="co-tabs" role="tablist" aria-label="Channel operations">${[['overview','Overview'],['inbox','Content & replies'],['publish','Publish & approvals'],['campaigns','Local campaigns'],['ai','AI assistant'],...(model.owner?[['team','Team access']]:[])].map(([key,label])=>`<button type="button" role="tab" id="co-tab-${key}" aria-controls="co-panel-${key}" data-co-tab="${key}" aria-selected="false">${label}</button>`).join('')}</div>
      <p data-co-status role="status" aria-live="polite"></p>${['overview','inbox','publish','campaigns','ai','team'].map(key=>`<section id="co-panel-${key}" role="tabpanel" aria-labelledby="co-tab-${key}" data-co-panel="${key}" hidden></section>`).join('')}`;
  }
  function resources() {
    const p=selectedProvider(), select=root.querySelector('[data-co-resource]'), prior=select.value;
    select.innerHTML=(p?.resources || []).map(r=>`<option value="${esc(r.id)}">${esc(r.label || r.id)}</option>`).join('') || '<option value="">Connect and select an account first</option>';
    if ([...select.options].some(o=>o.value===prior)) select.value=prior;
    root.querySelector('[data-co-sync]').disabled=!permitted(p,'sync') || !p?.resources.length || !p?.resources.find(r=>r.id===select.value)?.capabilities.sync;
  }
  function draw() {
    const p=selectedProvider();if (!p) {panel('overview').innerHTML='<p>Your owner has not assigned a channel. Contact your business owner for access.</p>';return;}
    resources();
    const resourceId=root.querySelector('[data-co-resource]').value, visibleItems=items.filter(i=>i.resource_id===resourceId), visibleDrafts=drafts.filter(d=>d.resource_id===resourceId);
    const measured=(p.sync || []).filter(s=>s.resource_id===resourceId).flatMap(s => (s.metrics || []).map(m=>`<article class="co-metric"><small>${esc(m.source)} · ${esc(m.key.replaceAll('_',' '))}</small><strong>${Number.isFinite(m.value)?Number(m.value).toLocaleString():'Not reported'}</strong><small>${esc(date(s.checked_at))}</small></article>`));
    panel('overview').innerHTML=`<div class="co-summary"><strong>${esc(p.label)}</strong><span>${esc(p.account_label || 'Account not connected')}</span><span>${esc(p.health?.title || p.status)}</span></div><div class="co-metrics">${measured.join('') || '<p>No content-sync measurements yet. Account-level figures remain available in the Accounts cards below.</p>'}</div><p>${esc(p.capabilities.note)}</p><p>Sources and reporting times stay separate. Missing figures are not zero; recent samples are not lifetime totals.</p>${(p.sync || []).filter(s=>s.error).map(s=>`<p class="co-warning">${esc(s.error)}</p>`).join('')}${model.owner?'<div class="co-links"><a href="#b04/unified">Unified Inbox: WhatsApp, email & SMS</a><a href="#b05/growth">Content calendar</a><a href="#b05/studio">Media Studio</a><a href="#b06/google">Google reporting</a><a href="#b01/approvals">Business approvals</a></div>':''}`;
    panel('inbox').innerHTML=`<h3>Recent content, comments & messages</h3><p>Sync explicitly to import a bounded recent sample. Email and customer content is treated as untrusted text.</p><div class="co-list">${visibleItems.map(i=>`<article class="co-card"><small>${esc(i.kind)} · ${esc(date(i.synced_at))}</small><h4>${esc(i.title || i.remote_id)}</h4><p>${esc(i.text)}</p>${i.metrics?`<small>${esc(Object.entries(i.metrics).map(([k,v])=>k+': '+v).join(' · '))}</small>`:''}${i.can_reply && permitted(p,'draft')?button('Draft reply','reply',i.id):''}</article>`).join('') || '<p>No synced content is available for your assigned accounts.</p>'}</div>`;
    const canDraft=permitted(p,'draft') && p.resources.length;
    panel('publish').innerHTML=`<h3>Review before anything leaves your business</h3>${canDraft?`<form data-co-compose class="co-form"><label>Action<select name="kind"><option value="post">Text post</option><option value="reply">Reply to a synced item</option></select></label><label>Reply item<select name="item_id"><option value="">Choose for replies</option>${visibleItems.filter(i=>i.can_reply).map(i=>`<option value="${esc(i.id)}">${esc(i.title || i.remote_id)}</option>`).join('')}</select></label><label>Text<textarea name="body" required maxlength="5000" rows="5"></textarea></label><button class="primary-button" type="submit">Save for approval</button><p>Replies retain their synced account and recipient. Unsupported actions are refused by the server.</p></form>`:'<p>Draft permission and a selected account are required.</p>'}<div class="co-list">${visibleDrafts.map(d=>`<article class="co-card"><small>${esc(d.kind)} · ${esc(d.status)} · revision ${d.revision}</small><p>Account: ${esc(p.resources.find(r=>r.id===d.resource_id)?.label || d.resource_id)}${d.target?.recipient?' · To: '+esc(d.target.recipient):d.target?.title?' · Reply to: '+esc(d.target.title):''}</p><p>${esc(d.body)}</p>${d.error?`<p class="co-warning">${esc(d.error)}</p>`:''}<div class="co-actions">${d.status==='pending'&&permitted(p,'approve')?button('Approve exact draft','approve',d.id)+button('Reject','reject',d.id):''}${d.status==='approved'&&permitted(p,d.kind==='reply'?'reply':'publish')?button(d.kind==='reply'?'Send approved reply':'Publish approved post','send',d.id):''}</div>${d.external_id?`<small>Provider confirmation: ${esc(d.external_id)}</small>`:''}</article>`).join('') || '<p>No drafts for this channel.</p>'}</div><p>Video preparation uses Media Studio. Direct video upload is not enabled in this adapter. Uncertain delivery is held for manual reconciliation and is never retried automatically.</p>`;
    panel('campaigns').innerHTML=`<h3>Goal → local area → content → budget review → results</h3><p>These are saved campaign plans. Approving a plan never starts ad spend or sends content. Publish individual organic drafts after review; paid launches remain in the ad provider.</p>${permitted(p,'campaign')?`<form data-co-campaign class="co-form"><label>Campaign name<input name="name" required minlength="2" maxlength="160"></label><label>Goal<input name="goal" required minlength="2" maxlength="300" placeholder="More local enquiries"></label><div class="co-fields"><label>Plan type<select name="mode"><option value="organic">Organic</option><option value="paid_plan">Paid ad plan — no automatic spend</option></select></label><label>Daily budget (AUD)<input name="budget" type="number" min="0" max="10000" step="0.01" value="0"></label></div><div class="co-fields"><label>Suburbs, comma separated<input name="suburbs" maxlength="1000" placeholder="Fremantle, Cockburn"></label><label>Postcodes, comma separated<input name="postcodes" maxlength="500" placeholder="6160, 6164"></label></div><details><summary>Optional radius targeting</summary><div class="co-fields"><label>Radius (km)<input type="number" name="radius" min="0.1" max="200" step="0.1"></label><label>Latitude<input name="latitude" type="number" min="-90" max="90" step="any"></label><label>Longitude<input name="longitude" type="number" min="-180" max="180" step="any"></label></div></details><label>Offer and content<textarea name="body" required minlength="2" maxlength="5000" rows="4"></textarea></label><button type="submit" class="primary-button">Save local plan for ${esc(p.label)}</button></form>`:''}<div class="co-list">${campaigns.map(c=>`<article class="co-card"><h4>${esc(c.name)}</h4><p>${esc(c.goal)}</p><small>${esc(c.mode)} · ${esc(c.status)} · ${esc([...c.targeting.suburbs,...c.targeting.postcodes].join(', ') || c.targeting.radius_km+' km radius')} · A$${(c.daily_budget_cents/100).toFixed(2)}/day planned</small><p>${esc(c.body)}</p>${model.owner&&c.status==='draft'?button('Approve plan only','campaign-approve',c.id):''}</article>`).join('') || '<p>No local campaign plans yet.</p>'}</div>`;
    panel('ai').innerHTML=`<h3>AI-assisted channel improvement</h3><p>Recommendations use only your assigned channel’s synced sample and measured figures. They cannot send, publish or spend.</p>${permitted(p,'draft')?'<form data-co-ai class="co-form"><label>What would you like to improve?<textarea name="goal" required minlength="3" maxlength="1000" rows="3" placeholder="Improve local enquiries from this channel"></textarea></label><button class="primary-button" type="submit">Prepare recommendations</button></form>':''}<div data-co-ai-result class="co-card" aria-live="polite"></div>`;
    if (model.owner && team) {
      const members=team.members.filter(m=>m.role!=='owner');
      panel('team').innerHTML=`<h3>Only you assign channel access</h3><p>Staff, workers and administrators have no channel access by default. Grants apply to this business and this channel only. Connecting or disconnecting accounts remains owner-only.</p><form data-co-access class="co-form"><label>Team member<select name="user" required>${members.map(m=>`<option value="${esc(m.id)}">${esc(m.full_name)} (${esc(m.role)})</option>`).join('')}</select></label><fieldset><legend>Actions for ${esc(p.label)}</legend><div class="co-checks">${team.actions.map(a=>`<label><input type="checkbox" name="actions" value="${a}">${esc(a)}</label>`).join('')}</div></fieldset><label>Resource restriction<select name="resource"><option value="">All selected accounts on this channel</option>${p.resources.map(r=>`<option value="${esc(r.id)}">${esc(r.label || r.id)}</option>`).join('')}</select></label><button type="submit" class="primary-button" ${members.length?'':'disabled'}>Save channel access</button><small>Uncheck every action to revoke access. Read is required for every other action. Changes take effect on the next server request.</small></form>`;
      fillAccess();
    }
    switchTab(active);
  }
  function fillAccess() {
    const f=root.querySelector('[data-co-access]');if (!f) return;
    const g=team.grants.find(g=>g.user_id===f.elements.user.value && g.provider===selectedProvider()?.provider);
    f.dataset.revision=String(g?.revision || 0);f.querySelectorAll('[name=actions]').forEach(i=>i.checked=(g?.actions || []).includes(i.value));f.elements.resource.value=g?.resources?.[0] || '';
  }
  async function loadDetails() {
    const sequence=++detailSequence,p=selectedProvider();if (!p) {draw();return;}
    const result=await Promise.all([api('/'+p.provider+'/items'),api('/drafts'),api('/campaigns')]);
    if(sequence!==detailSequence || selectedProvider()?.provider!==p.provider)return;
    items=result[0].items;drafts=result[1].drafts.filter(d=>d.provider===p.provider);campaigns=result[2].campaigns.filter(c=>c.providers.includes(p.provider));draw();
  }
  async function render() {
    if (busy) return;busy=true;
    const prev=root.querySelector('[data-co-provider]')?.value;
    try {
      model=await api('/overview');team=model.owner?await api('/team'):null;shell();
      root.querySelector('[data-co-provider]').innerHTML=model.providers.map(p=>`<option value="${esc(p.provider)}">${esc(p.label)}</option>`).join('');
      if (model.providers.some(p=>p.provider===prev)) root.querySelector('[data-co-provider]').value=prev;
      const accounts=document.getElementById('integration-self-service');if(accounts) accounts.hidden=!model.owner;
      if (!model.providers.length) {draw();switchTab('overview');return;}
      await loadDetails();
    } catch(e) {root.replaceChildren();const p=document.createElement('p');p.textContent=e.message;root.append(p);} finally {busy=false;}
  }
  root.addEventListener('keydown',e=>{const current=e.target.closest('[data-co-tab]');if(!current||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...root.querySelectorAll('[data-co-tab]')],at=tabs.indexOf(current),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(at+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;switchTab(tabs[next].dataset.coTab);tabs[next].focus();});
  root.addEventListener('change',e=>{if(e.target.matches('[data-co-provider]'))loadDetails().catch(e=>message(e.message,true));if(e.target.matches('[data-co-resource]'))draw();if(e.target.matches('[name=user]'))fillAccess();});
  root.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.coTab){switchTab(b.dataset.coTab);return;}
    const p=selectedProvider();b.disabled=true;
    try {
      if(b.hasAttribute('data-co-refresh')){await render();return;}
      if(b.hasAttribute('data-co-sync')){message('Checking ownership and syncing the recent sample…');const d=await api('/'+p.provider+'/sync',{resource_id:root.querySelector('[data-co-resource]').value});await render();message(`Synced ${d.count} recent items. ${d.coverage}`);return;}
      if(b.hasAttribute('data-co-reply')){const item=items.find(i=>i.id===b.dataset.coReply);switchTab('publish');const f=root.querySelector('[data-co-compose]');f.elements.kind.value='reply';f.elements.item_id.value=item.id;root.querySelector('[data-co-resource]').value=item.resource_id;f.elements.body.focus();return;}
      for(const key of ['approve','reject','send'])if(b.hasAttribute('data-co-'+key)){const d=drafts.find(d=>d.id===b.getAttribute('data-co-'+key));await api('/drafts/'+d.id+(key==='send'?'/publish':'/decision'),{revision:d.revision,...(key==='send'?{}:{decision:key==='approve'?'approve':'reject'})});await render();message(key==='send'?'Provider confirmed delivery.':'Review recorded.');return;}
      if(b.hasAttribute('data-co-campaign-approve')){const d=await api('/campaigns/'+b.dataset.coCampaignApprove+'/approve',{});await render();message(d.message);}
    } catch(e) {message(e.message,true);} finally {if(b.isConnected)b.disabled=false;}
  });
  root.addEventListener('submit',async e=>{
    e.preventDefault();const f=e.target,p=selectedProvider(),b=f.querySelector('button[type=submit]');if(!b)return;b.disabled=true;
    try {
      const data=new FormData(f);
      if(f.matches('[data-co-compose]')){const reply=items.find(i=>i.id===data.get('item_id'));await api('/drafts',{provider:p.provider,resource_id:data.get('kind')==='reply'&&reply?reply.resource_id:root.querySelector('[data-co-resource]').value,kind:data.get('kind'),body:data.get('body'),item_id:data.get('kind')==='reply'?data.get('item_id')||null:null});await render();message('Draft saved. Approval is required before sending.');}
      if(f.matches('[data-co-campaign]')){const split=v=>String(v).split(',').map(s=>s.trim()).filter(Boolean);await api('/campaigns',{name:data.get('name'),goal:data.get('goal'),providers:[p.provider],mode:data.get('mode'),daily_budget_cents:Math.round(Number(data.get('budget'))*100),body:data.get('body'),targeting:{country:'AU',suburbs:split(data.get('suburbs')),postcodes:split(data.get('postcodes')),radius_km:data.get('radius')?Number(data.get('radius')):null,latitude:data.get('latitude')?Number(data.get('latitude')):null,longitude:data.get('longitude')?Number(data.get('longitude')):null}});await render();message('Campaign plan saved. No content was sent and no ad spend started.');}
      if(f.matches('[data-co-ai]')){message('Preparing guidance…');const d=await api('/'+p.provider+'/recommendations',{goal:data.get('goal')});const box=root.querySelector('[data-co-ai-result]');box.textContent=d.text;message(`${d.method==='ai_assisted'?'AI-assisted':'Guided rules'} · ${d.sample_count} recent items · review required`);}
      if(f.matches('[data-co-access]')){await api('/team/'+data.get('user')+'/'+p.provider,{actions:data.getAll('actions'),resources:data.get('resource')?[data.get('resource')]:[],revision:Number(f.dataset.revision)},'PUT');await render();message('Channel access updated for this business only.');}
    } catch(e) {message(e.message,true);} finally {if(b.isConnected)b.disabled=false;}
  });
  window.addEventListener('gds:viewchange',e=>{if(e.detail?.view==='integrations')render();});
  window.SuperProChannels={render};
})();
