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
  // ---- presentation helpers ------------------------------------------------
  let itemFilter = 'all', itemSort = 'new', lastSync = '';
  const compact = new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1});
  const num = v => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '—' : compact.format(Number(v));
  const nice = v => {const d = new Date(v);return v && Number.isFinite(d.getTime()) ? d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : '';};
  const day = v => {const d = new Date(v);return v && Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined,{dateStyle:'medium'}) : '';};
  const LABELS = {views:'Views',likes:'Likes',comments:'Comments',shares:'Shares',replies:'Replies',videos_in_sample:'Recent videos',followers:'Followers',profile_likes:'Total likes',profile_videos:'Total videos',
    subscriberCount:'Subscribers',viewCount:'Total views',videoCount:'Videos',mailbox_messages:'Messages in mailbox',reviews:'Reviews',recent_recorded_messages:'Recent messages',
    like_count:'Likes',reply_count:'Replies',retweet_count:'Reposts',quote_count:'Quotes',impression_count:'Impressions',bookmark_count:'Bookmarks',clicks:'Clicks',impressions:'Impressions',conversions:'Conversions',cost_micros_account_currency:'Ad cost (micros)',costMicros:'Ad cost (micros)'};
  const label = k => LABELS[k] || String(k).replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/^./,c => c.toUpperCase());
  const KINDS = {video:'Video',comment:'Comment',message:'Message',post:'Post',review:'Review',ad_campaign:'Ad campaign'};
  const kindName = k => KINDS[k] || label(k);
  const ACTIONS = {read:['View','See content and figures'],sync:['Sync','Refresh the latest content'],draft:['Write drafts','Prepare posts and replies'],approve:['Approve','Approve or reject drafts'],publish:['Publish','Publish approved posts'],reply:['Reply','Send approved replies'],campaign:['Campaigns','Create local campaign plans']};
  const STATUS = {pending:['Waiting for approval','wait'],approved:['Approved · ready to send','ok'],rejected:['Rejected','bad'],sent:['Sent','ok'],published:['Published','ok'],sending:['Sending…','wait'],uncertain:['Check with provider','bad'],failed:['Not sent','bad'],draft:['Draft plan','wait'],active:['Approved plan','ok']};
  const pill = (text,tone = 'wait') => `<span class="co-pill" data-tone="${esc(tone)}">${esc(text)}</span>`;
  const statusPill = s => {const [t,tone] = STATUS[s] || [label(s),'wait'];return pill(t,tone);};
  const safeUrl = v => typeof v === 'string' && /^https:\/\/[a-z0-9.-]+\//i.test(v) ? v : '';
  const safeEmbed = v => typeof v === 'string' && /^https:\/\/www\.(tiktok\.com\/player\/v1\/\d+|youtube\.com\/embed\/[\w-]+)$/.test(v) ? v : '';
  const duration = s => Number.isFinite(Number(s)) && Number(s) > 0 ? `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}` : '';
  const stats = m => Object.entries(m || {}).filter(([,v]) => v !== null && v !== undefined && typeof v !== 'object').map(([k,v]) => `<span class="co-stat"><strong>${esc(num(v))}</strong> ${esc(label(k))}</span>`).join('');
  const thumb = (i,p) => {const src = safeUrl(i.thumbnail);return `<div class="co-thumb" data-kind="${esc(i.kind)}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<span class="co-thumb-fallback" aria-hidden="true">${i.kind==='video'?'▶':esc((kindName(i.kind)[0] || p.label[0] || '•'))}</span>${duration(i.duration_seconds) ? `<span class="co-duration">${esc(duration(i.duration_seconds))}</span>` : ''}</div>`;};
  const openLink = (i,p,cls = 'secondary-button compact') => safeUrl(i.url) ? `<a class="${cls}" href="${esc(safeUrl(i.url))}" target="_blank" rel="noopener noreferrer">Open on ${esc(p.label)} <span aria-hidden="true">↗</span></a>` : '';
  const empty = (title,text,action = '') => `<div class="co-empty"><strong>${esc(title)}</strong><p>${esc(text)}</p>${action}</div>`;
  const heading = (title,text) => `<div class="co-section-head"><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
  const itemTitle = i => i.title || i.text || kindName(i.kind);
  const itemCard = (i,p) => `<article class="co-card co-item" data-co-item="${esc(i.id)}">
      <button type="button" class="co-item-open" data-co-view="${esc(i.id)}" aria-label="View details: ${esc(String(itemTitle(i)).slice(0,80))}">${thumb(i,p)}</button>
      <div class="co-item-body"><small>${esc(kindName(i.kind))}${day(i.occurred_at) ? ' · ' + esc(day(i.occurred_at)) : ''}</small>
        <h4 class="co-clamp">${esc(itemTitle(i))}</h4>${i.text && i.text !== i.title ? `<p class="co-clamp">${esc(i.text)}</p>` : ''}
        ${stats(i.metrics) ? `<div class="co-stats">${stats(i.metrics)}</div>` : ''}
        <div class="co-actions"><button type="button" class="secondary-button compact" data-co-view="${esc(i.id)}">View details</button>${openLink(i,p)}${i.can_reply && permitted(p,'draft') ? button('Draft reply','reply',i.id) : ''}</div></div></article>`;
  function showItem(itemId) {
    const p = selectedProvider(), i = items.find(x => x.id === itemId);if (!p || !i) return;
    let d = root.querySelector('dialog.co-dialog');
    if (!d) {d = document.createElement('dialog');d.className = 'co-dialog';d.setAttribute('aria-label','Content details');root.append(d);d.addEventListener('close',() => d.replaceChildren());d.addEventListener('click',e => {if (e.target === d) d.close();});}
    const embed = safeEmbed(i.embed);
    const note = i.kind === 'video' && p.provider === 'tiktok' ? `TikTok shares comment counts with connected apps, but not the comment text. Open the video on TikTok to read and answer comments.` : i.kind === 'video' && p.provider === 'youtube' ? 'Comments on your channel appear as their own cards under Content & replies after a sync.' : '';
    d.innerHTML = `<div class="co-dialog-head"><div><small>${esc(p.label)} · ${esc(kindName(i.kind))}${nice(i.occurred_at) ? ' · ' + esc(nice(i.occurred_at)) : ''}</small><h3>${esc(String(itemTitle(i)).slice(0,160))}</h3></div><button type="button" class="secondary-button compact" data-co-close aria-label="Close details">Close</button></div>
      <div class="co-dialog-body"><div class="co-player" data-co-player>${thumb(i,p)}${embed ? `<button type="button" class="primary-button" data-co-play="${esc(i.id)}">▶ Play here</button>` : ''}</div>
      <div class="co-dialog-info">${stats(i.metrics) ? `<div class="co-metrics">${Object.entries(i.metrics).filter(([,v]) => v !== null && v !== undefined && typeof v !== 'object').map(([k,v]) => `<article class="co-metric"><small>${esc(label(k))}</small><strong>${esc(num(v))}</strong></article>`).join('')}</div>` : ''}
        ${i.text || i.title ? `<h4>${i.kind === 'video' ? 'Caption' : 'Text'}</h4><p class="co-text">${esc(i.text || i.title)}</p>` : ''}${i.rating ? `<p>Rating: ${esc(String(i.rating).toLowerCase())}</p>` : ''}${i.reply ? `<h4>Your reply</h4><p class="co-text">${esc(i.reply)}</p>` : ''}
        ${note ? `<p class="co-note">${esc(note)}</p>` : ''}<div class="co-actions">${openLink(i,p,'primary-button')}${i.can_reply && permitted(p,'draft') ? button('Draft reply','reply',i.id) : ''}</div>
        <small>Last updated ${esc(nice(i.synced_at))}. Figures come from ${esc(p.label)}.</small></div></div>`;
    if (!d.open) d.showModal();
  }
  function switchTab(name) {
    active=name;root.querySelectorAll('[data-co-panel]').forEach(p => p.hidden=p.dataset.coPanel!==name);
    root.querySelectorAll('[data-co-tab]').forEach(b => {b.setAttribute('aria-selected',String(b.dataset.coTab===name));b.tabIndex=b.dataset.coTab===name?0:-1;});
  }
  function shell() {
    root.innerHTML = `<div class="panel-head co-head"><div><span class="panel-kicker">CHANNEL OPERATIONS</span><h2>Channel operations</h2><p>See how each channel is performing, review content and replies, and plan local campaigns — all in one place.</p></div>${button('Refresh','refresh')}</div>
      <div class="co-toolbar"><label>Channel<select data-co-provider aria-label="Channel"></select></label><label>Account<select data-co-resource aria-label="Selected account"></select></label><div class="co-sync"><button type="button" class="primary-button" data-co-sync>Sync recent content</button><small data-co-synced></small></div></div>
      <div class="co-tabs" role="tablist" aria-label="Channel operations">${[['overview','Overview'],['inbox','Content & replies'],['publish','Publish & approvals'],['campaigns','Local campaigns'],['ai','AI assistant'],...(model.owner?[['team','Team access']]:[])].map(([key,label])=>`<button type="button" role="tab" id="co-tab-${key}" aria-controls="co-panel-${key}" data-co-tab="${key}" aria-selected="false">${label}</button>`).join('')}</div>
      <p data-co-status role="status" aria-live="polite"></p>${['overview','inbox','publish','campaigns','ai','team'].map(key=>`<section id="co-panel-${key}" role="tabpanel" aria-labelledby="co-tab-${key}" data-co-panel="${key}" hidden></section>`).join('')}`;
  }
  function resources() {
    const p=selectedProvider(), select=root.querySelector('[data-co-resource]'), prior=select.value;
    select.innerHTML=(p?.resources || []).map(r=>`<option value="${esc(r.id)}">${esc(r.label || r.id)}</option>`).join('') || '<option value="">Connect and select an account first</option>';
    if ([...select.options].some(o=>o.value===prior)) select.value=prior;
    const sync=root.querySelector('[data-co-sync]'), can=permitted(p,'sync') && p?.resources.length && p?.resources.find(r=>r.id===select.value)?.capabilities.sync;
    sync.disabled=!can;sync.hidden=!can && !p?.resources.length;
    const state=(p?.sync || []).find(s=>s.resource_id===select.value);
    root.querySelector('[data-co-synced]').textContent=state?.checked_at ? 'Last synced ' + nice(state.checked_at) : can ? 'Not synced yet' : '';
  }
  function draw() {
    const p=selectedProvider();if (!p) {panel('overview').innerHTML=empty('No channel assigned yet','Your owner has not assigned a channel. Contact your business owner for access.');return;}
    resources();
    const resourceId=root.querySelector('[data-co-resource]').value, visibleItems=items.filter(i=>i.resource_id===resourceId), visibleDrafts=drafts.filter(d=>d.resource_id===resourceId);
    const connected=p.resources.length>0, canSync=!root.querySelector('[data-co-sync]').disabled;
    const syncNow=canSync?'<button type="button" class="primary-button" data-co-sync>Sync recent content</button>':'';
    const connectNow=model.owner?'<button type="button" class="primary-button" data-co-connect>Go to your connections</button>':'';
    const state=(p.sync || []).filter(s=>s.resource_id===resourceId);
    const measured=state.flatMap(s => (s.metrics || []).map(m=>`<article class="co-metric"><small>${esc(label(m.key))}</small><strong>${esc(num(m.value))}</strong><small>${esc(m.source)}</small></article>`));
    const top=[...visibleItems].filter(i=>Number.isFinite(Number(i.metrics?.views ?? i.metrics?.impression_count))).sort((a,b)=>Number(b.metrics.views ?? b.metrics.impression_count)-Number(a.metrics.views ?? a.metrics.impression_count)).slice(0,3);
    const healthy=/working|connected|healthy/i.test(p.health?.title || p.status || '');
    panel('overview').innerHTML=`<div class="co-summary"><div><strong>${esc(p.label)}</strong><span>${esc(p.resources.find(r=>r.id===resourceId)?.label || p.account_label || 'No account connected')}</span></div>${pill(connected?(p.health?.title || 'Connected'):'Not connected',connected&&healthy?'ok':'wait')}</div>
      ${!connected?empty('Connect this channel to get started','Sign in with '+p.label+' from your connections. Oprun never asks for your social-media password.',connectNow)
      :measured.length?`${heading('Performance at a glance',state[0]?.checked_at?'Figures from your last sync on '+nice(state[0].checked_at)+'.':'')}<div class="co-metrics">${measured.join('')}</div>`
      :empty('No figures yet','Sync to bring in your latest content and its figures.',syncNow)}
      ${top.length?`${heading('Top recent content','Your most viewed items from the latest sync. Select one to see more.')}<div class="co-grid">${top.map(i=>itemCard(i,p)).join('')}</div>`:''}
      ${state.filter(s=>s.error).map(s=>`<p class="co-warning">The last sync did not finish. Your previous content is still shown — try Sync again.</p>`).join('')}
      ${model.owner?`${heading('Quick links','')}<div class="co-links"><a href="#b04/unified">Unified Inbox</a><a href="#b05/growth">Content calendar</a><a href="#b05/studio">Media Studio</a><a href="#b06/google">Google reporting</a><a href="#b01/approvals">Approvals</a></div>`:''}
      <details class="co-about"><summary>About these figures</summary><p>${esc(p.capabilities.note)}</p><p>Figures cover your most recent items, not your full history. A dash means ${esc(p.label)} did not report that figure — it does not mean zero.</p></details>`;
    const kinds=[...new Set(visibleItems.map(i=>i.kind))];if(itemFilter!=='all'&&!kinds.includes(itemFilter))itemFilter='all';
    const hasViews=visibleItems.some(i=>Number.isFinite(Number(i.metrics?.views)));if(!hasViews&&itemSort==='views')itemSort='new';
    const shown=visibleItems.filter(i=>itemFilter==='all'||i.kind===itemFilter).sort((a,b)=>itemSort==='views'?Number(b.metrics?.views || 0)-Number(a.metrics?.views || 0):String(b.occurred_at || '').localeCompare(String(a.occurred_at || '')));
    const chip=(key,text,group,on)=>`<button type="button" class="co-chip" data-co-${group}="${esc(key)}" aria-pressed="${on}">${esc(text)}</button>`;
    panel('inbox').innerHTML=`${heading('Your recent content','Select any item to see its details, figures and a link to open it on '+p.label+'.')}
      ${visibleItems.length?`<div class="co-filterbar"><div class="co-chips" role="group" aria-label="Show">${chip('all','All ('+visibleItems.length+')','filter',itemFilter==='all')}${kinds.length>1?kinds.map(k=>chip(k,kindName(k)+'s ('+visibleItems.filter(i=>i.kind===k).length+')','filter',itemFilter===k)).join(''):''}</div>${hasViews?`<div class="co-chips" role="group" aria-label="Sort">${chip('new','Newest','sort',itemSort==='new')}${chip('views','Most viewed','sort',itemSort==='views')}</div>`:''}</div><div class="co-grid">${shown.map(i=>itemCard(i,p)).join('')}</div>`
      :empty(connected?'Nothing synced yet':'Connect this channel first',connected?'Sync to bring in your latest videos, posts, comments and messages.':'Once the account is connected, its content appears here.',connected?syncNow:connectNow)}`;
    const canDraft=permitted(p,'draft') && p.resources.length;
    panel('publish').innerHTML=`${heading('Publish & approvals','Nothing leaves your business without approval: write a draft, approve it, then send.')}<ol class="co-steps"><li>Write</li><li>Approve</li><li>Send</li></ol>
      ${canDraft?`<form data-co-compose class="co-form co-box"><div class="co-fields"><label>What would you like to do?<select name="kind"><option value="post">Write a text post</option><option value="reply">Reply to a synced item</option></select></label><label>Reply to<select name="item_id"><option value="">Choose for replies</option>${visibleItems.filter(i=>i.can_reply).map(i=>`<option value="${esc(i.id)}">${esc(String(i.title || i.remote_id).slice(0,80))}</option>`).join('')}</select></label></div><label>Text<textarea name="body" required maxlength="5000" rows="5" placeholder="Write your post or reply…"></textarea></label><div class="co-actions"><button class="primary-button" type="submit">Save for approval</button><small>If ${esc(p.label)} does not allow this action, you will be told straight away.</small></div></form>`
      :empty('Drafting is not available here',connected?'You need drafting permission for this channel. Ask your business owner.':'Connect and select an account first.',connected?'':connectNow)}
      ${heading('Drafts','')}<div class="co-list">${visibleDrafts.map(d=>`<article class="co-card"><div class="co-card-top"><small>${esc(d.kind==='reply'?'Reply':'Post')} · ${esc(p.resources.find(r=>r.id===d.resource_id)?.label || d.resource_id)}${d.target?.recipient?' · To: '+esc(d.target.recipient):d.target?.title?' · Reply to: '+esc(String(d.target.title).slice(0,80)):''}</small>${statusPill(d.status)}</div><p>${esc(d.body)}</p>${d.error?`<p class="co-warning">${esc(d.error)}</p>`:''}<div class="co-actions">${d.status==='pending'&&permitted(p,'approve')?button('Approve exact draft','approve',d.id)+button('Reject','reject',d.id):''}${d.status==='approved'&&permitted(p,d.kind==='reply'?'reply':'publish')?button(d.kind==='reply'?'Send approved reply':'Publish approved post','send',d.id):''}</div>${d.external_id?`<small>Provider confirmation: ${esc(d.external_id)}</small>`:''}</article>`).join('') || empty('No drafts yet','Drafts you save for this channel appear here for approval.')}</div>
      <details class="co-about"><summary>Good to know</summary><p>Videos are prepared in Media Studio; uploading video straight to ${esc(p.label)} from here is not available yet. If a send cannot be confirmed, it is held for you to check and is never retried automatically.</p></details>`;
    panel('campaigns').innerHTML=`${heading('Local campaigns','Plan who you want to reach nearby, what you will offer and a budget. Saving or approving a plan never spends money or publishes anything.')}<ol class="co-steps"><li>Goal</li><li>Local area</li><li>Offer</li><li>Budget</li><li>Review</li></ol>
      ${permitted(p,'campaign')?`<form data-co-campaign class="co-form co-box"><div class="co-fields"><label>Campaign name<input name="name" required minlength="2" maxlength="160" placeholder="Spring local offer"></label><label>Goal<input name="goal" required minlength="2" maxlength="300" placeholder="More local enquiries"></label></div><div class="co-fields"><label>Suburbs<input name="suburbs" maxlength="1000" placeholder="Fremantle, Cockburn"><small>Separate with commas</small></label><label>Postcodes<input name="postcodes" maxlength="500" placeholder="6160, 6164"><small>Separate with commas</small></label></div><details><summary>Target by distance instead (optional)</summary><div class="co-fields"><label>Radius (km)<input type="number" name="radius" min="0.1" max="200" step="0.1"></label><label>Latitude<input name="latitude" type="number" min="-90" max="90" step="any"></label><label>Longitude<input name="longitude" type="number" min="-180" max="180" step="any"></label></div></details><label>Offer and content<textarea name="body" required minlength="2" maxlength="5000" rows="4" placeholder="What will you offer, and what should the post or ad say?"></textarea></label><div class="co-fields"><label>Plan type<select name="mode"><option value="organic">Organic</option><option value="paid_plan">Paid ad plan — no automatic spend</option></select></label><label>Daily budget (AUD)<input name="budget" type="number" min="0" max="10000" step="0.01" value="0"></label></div><div class="co-actions"><button type="submit" class="primary-button">Save local plan for ${esc(p.label)}</button></div></form>`:''}
      ${heading('Saved plans','')}<div class="co-list">${campaigns.map(c=>`<article class="co-card"><div class="co-card-top"><h4>${esc(c.name)}</h4>${statusPill(c.status)}</div><p>${esc(c.goal)}</p><div class="co-stats"><span class="co-stat">${esc(c.mode==='paid_plan'?'Paid ad plan':'Organic')}</span><span class="co-stat">${esc([...c.targeting.suburbs,...c.targeting.postcodes].join(', ') || c.targeting.radius_km+' km radius')}</span><span class="co-stat"><strong>A$${(c.daily_budget_cents/100).toFixed(2)}</strong>/day planned</span></div><p>${esc(c.body)}</p>${model.owner&&c.status==='draft'?`<div class="co-actions">${button('Approve plan only','campaign-approve',c.id)}</div>`:''}</article>`).join('') || empty('No local plans yet','Create a plan above. Paid ads are still launched from the ad provider.')}</div>`;
    const prompts=['How can I get more local enquiries from this channel?','Which of my recent posts worked best, and why?','Give me five post ideas for next week'];
    panel('ai').innerHTML=`${heading('AI assistant','Ask for ideas to improve this channel. Suggestions use only your synced content and figures, and the assistant cannot post, send or spend.')}
      ${permitted(p,'draft')?`<div class="co-chips" aria-label="Suggested questions">${prompts.map(t=>`<button type="button" class="co-chip" data-co-prompt="${esc(t)}">${esc(t)}</button>`).join('')}</div><form data-co-ai class="co-form co-box"><label>What would you like to improve?<textarea name="goal" required minlength="3" maxlength="1000" rows="3" placeholder="Improve local enquiries from this channel"></textarea></label><div class="co-actions"><button class="primary-button" type="submit">Prepare recommendations</button>${visibleItems.length?'':'<small>Tip: sync your content first for better suggestions.</small>'}</div></form>`:empty('Not available','You need drafting permission for this channel to use the assistant.')}<div data-co-ai-result class="co-card co-ai-result" aria-live="polite" hidden></div>`;
    if (model.owner && team) {
      const members=team.members.filter(m=>m.role!=='owner');
      panel('team').innerHTML=`${heading('Team access','Only you decide who can use this channel. Team members have no access until you give it, and connecting or disconnecting accounts always stays with you.')}
        ${members.length?`<form data-co-access class="co-form co-box"><label>Team member<select name="user" required>${members.map(m=>`<option value="${esc(m.id)}">${esc(m.full_name)} (${esc(m.role)})</option>`).join('')}</select></label><fieldset><legend>What can they do on ${esc(p.label)}?</legend><div class="co-checks">${team.actions.map(a=>`<label><input type="checkbox" name="actions" value="${a}"><span><strong>${esc(ACTIONS[a]?.[0] || a)}</strong><small>${esc(ACTIONS[a]?.[1] || '')}</small></span></label>`).join('')}</div></fieldset><label>Limit to one account<select name="resource"><option value="">All selected accounts on this channel</option>${p.resources.map(r=>`<option value="${esc(r.id)}">${esc(r.label || r.id)}</option>`).join('')}</select></label><div class="co-actions"><button type="submit" class="primary-button">Save channel access</button><small>Untick everything to remove access. “View” is needed for any other action.</small></div></form>`:empty('No team members yet','Invite team members first, then choose what each can do on this channel.')}`;
      fillAccess();
    }
    switchTab(active);
  }
  function fillAccess() {
    const f=root.querySelector('[data-co-access]');if (!f || !f.elements.user.value) return;
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
  root.addEventListener('error',e=>{if(e.target.matches?.('.co-thumb img'))e.target.remove();},true);
  root.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.coTab){if(b.dataset.coTab!==active)message('');switchTab(b.dataset.coTab);return;}
    if(b.dataset.coView){showItem(b.dataset.coView);return;}
    if(b.hasAttribute('data-co-close')){const d=b.closest('dialog');d?.close();d?.replaceChildren();return;}
    if(b.dataset.coPlay){const i=items.find(x=>x.id===b.dataset.coPlay),src=safeEmbed(i?.embed),box=b.closest('[data-co-player]');if(src&&box){const f=document.createElement('iframe');f.src=src;f.title='Video player';f.allow='fullscreen; encrypted-media; picture-in-picture';f.referrerPolicy='strict-origin-when-cross-origin';f.setAttribute('allowfullscreen','');box.replaceChildren(f);}return;}
    if(b.dataset.coFilter){itemFilter=b.dataset.coFilter;draw();return;}
    if(b.dataset.coSort){itemSort=b.dataset.coSort;draw();return;}
    if(b.dataset.coPrompt){const f=root.querySelector('[data-co-ai]');if(f){f.elements.goal.value=b.dataset.coPrompt;f.elements.goal.focus();}return;}
    if(b.hasAttribute('data-co-connect')){const tab=[...document.querySelectorAll('#integrations-view [role=tab]')].find(t=>t.textContent.trim()==='Your business connections');if(tab)tab.click();else document.getElementById('integration-self-service')?.scrollIntoView();return;}
    const p=selectedProvider();b.disabled=true;
    try {
      if(b.hasAttribute('data-co-refresh')){await render();return;}
      if(b.hasAttribute('data-co-sync')){message('Syncing your latest content…');const d=await api('/'+p.provider+'/sync',{resource_id:root.querySelector('[data-co-resource]').value});await render();message(d.count?`Synced your ${d.count} most recent item${d.count===1?'':'s'}.`:'Sync finished. No recent items were found for this account.');return;}
      if(b.hasAttribute('data-co-reply')){const item=items.find(i=>i.id===b.dataset.coReply);root.querySelector('dialog.co-dialog[open]')?.close();switchTab('publish');const f=root.querySelector('[data-co-compose]');f.elements.kind.value='reply';f.elements.item_id.value=item.id;root.querySelector('[data-co-resource]').value=item.resource_id;f.elements.body.focus();return;}
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
      if(f.matches('[data-co-ai]')){message('Preparing guidance…');const d=await api('/'+p.provider+'/recommendations',{goal:data.get('goal')});const box=root.querySelector('[data-co-ai-result]');box.hidden=false;box.textContent=d.text;message(`${d.method==='ai_assisted'?'AI-assisted':'Guided rules'} · ${d.sample_count} recent items · review required`);}
      if(f.matches('[data-co-access]')){await api('/team/'+data.get('user')+'/'+p.provider,{actions:data.getAll('actions'),resources:data.get('resource')?[data.get('resource')]:[],revision:Number(f.dataset.revision)},'PUT');await render();message('Channel access updated for this business only.');}
    } catch(e) {message(e.message,true);} finally {if(b.isConnected)b.disabled=false;}
  });
  window.addEventListener('gds:viewchange',e=>{if(e.detail?.view==='integrations')render();});
  window.SuperProChannels={render};
})();
