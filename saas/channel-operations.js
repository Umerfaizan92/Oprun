(() => {
  const root = document.getElementById('channel-operations');if (!root) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let model = null, waTemplates = {rid:'', list:[]}, items = [], drafts = [], campaigns = [], team = null, active = 'overview', busy = false, detailSequence = 0;
  const api = async(path,body,method) => {const r = await fetch('/api/saas/channels' + path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body ? {method:method || 'POST',body:JSON.stringify(body)} : {})});const d = await r.json();if (!r.ok) throw new Error(d.error || 'Request failed.');return d;};
  const selectedProvider = () => model?.providers.find(p => p.provider === root.querySelector('[data-co-provider]')?.value);
  const message = (text,error = false) => {const box = root.querySelector('[data-co-status]');if (box) {box.textContent=text;box.dataset.error=String(error);}};
  const date = v => v ? new Date(v).toLocaleString() : 'Not refreshed';
  const panel = name => root.querySelector(`[data-co-panel="${name}"]`);
  const button = (label,key,value = '') => `<button type="button" class="secondary-button compact" data-co-${key}="${esc(value)}">${esc(label)}</button>`;
  const permitted = (p,action) => p?.actions.includes(action);
  // ---- presentation helpers ------------------------------------------------
  let itemFilter = 'all', itemSort = 'new', loadedAt = 0, growth = null;const drawn = new Set(), GOALS = {leads:'More leads',views:'More views',promotion:'Promote an offer'};
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
  const stats = (m,itemId) => Object.entries(m || {}).filter(([,v]) => v !== null && v !== undefined && typeof v !== 'object').map(([k,v]) => itemId && k === 'comments' ? `<button type="button" class="co-stat co-stat-btn" data-co-view="${esc(itemId)}" data-co-focus="comments" aria-label="Open comments (${esc(num(v))})"><strong>${esc(num(v))}</strong> ${esc(label(k))} ›</button>` : `<span class="co-stat"><strong>${esc(num(v))}</strong> ${esc(label(k))}</span>`).join('');
  const commentsFor = i => i.kind === 'video' ? items.filter(x => x.kind === 'comment' && x.parent_id && x.parent_id === i.remote_id && x.resource_id === i.resource_id) : [];
  const thumb = (i,p) => {const src = safeUrl(i.thumbnail);return `<div class="co-thumb" data-kind="${esc(i.kind)}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}<span class="co-thumb-fallback" aria-hidden="true">${i.kind==='video'?'▶':esc((kindName(i.kind)[0] || p.label[0] || '•'))}</span>${duration(i.duration_seconds) ? `<span class="co-duration">${esc(duration(i.duration_seconds))}</span>` : ''}</div>`;};
  const openLink = (i,p,cls = 'secondary-button compact') => safeUrl(i.url) ? `<a class="${cls}" href="${esc(safeUrl(i.url))}" target="_blank" rel="noopener noreferrer">Open on ${esc(p.label)} <span aria-hidden="true">↗</span></a>` : '';
  const empty = (title,text,action = '') => `<div class="co-empty"><strong>${esc(title)}</strong><p>${esc(text)}</p>${action}</div>`;
  const heading = (title,text) => `<div class="co-section-head"><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
  const itemTitle = i => i.title || i.text || kindName(i.kind);
  const itemCard = (i,p) => `<article class="co-card co-item" data-co-item="${esc(i.id)}">
      <button type="button" class="co-item-open" data-co-view="${esc(i.id)}" aria-label="View details: ${esc(String(itemTitle(i)).slice(0,80))}">${thumb(i,p)}<span class="co-overlay" aria-hidden="true">View details</span></button>
      <div class="co-item-body"><small>${esc(kindName(i.kind))}${day(i.occurred_at) ? ' · ' + esc(day(i.occurred_at)) : ''}</small>
        <h4 class="co-clamp">${esc(itemTitle(i))}</h4>${i.text && i.text !== i.title ? `<p class="co-clamp">${esc(i.text)}</p>` : ''}
        ${stats(i.metrics) ? `<div class="co-stats">${stats(i.metrics,i.id)}</div>` : ''}
        <div class="co-actions"><button type="button" class="secondary-button compact" data-co-view="${esc(i.id)}">View details</button>${i.kind === 'video' ? `<button type="button" class="secondary-button compact" data-co-view="${esc(i.id)}" data-co-focus="comments">Comments</button>` : ''}${openLink(i,p)}${i.can_reply && permitted(p,'draft') ? button('Draft reply','reply',i.id) : ''}</div></div></article>`;
  function showItem(itemId,focus) {
    const p = selectedProvider(), i = items.find(x => x.id === itemId);if (!p || !i) return;
    let d = root.querySelector('dialog.co-dialog');
    if (!d) {d = document.createElement('dialog');d.className = 'co-dialog';d.setAttribute('aria-label','Content details');root.append(d);d.addEventListener('close',() => d.replaceChildren());d.addEventListener('click',e => {if (e.target === d) d.close();});}
    const embed = safeEmbed(i.embed);
    const thread = commentsFor(i), count = i.metrics?.comments;
    const commentBlock = i.kind !== 'video' ? '' : `<section class="co-comments" data-co-comments tabindex="-1" aria-label="Comments"><h4>Comments${Number.isFinite(Number(count)) ? ' (' + esc(num(count)) + ')' : ''}</h4>${thread.length ? `<div class="co-list">${thread.map(c => `<article class="co-comment"><small>${esc(c.title || 'Viewer')}${day(c.occurred_at) ? ' · ' + esc(day(c.occurred_at)) : ''}</small><p class="co-text">${esc(c.text)}</p><div class="co-actions">${c.can_reply && permitted(p,'draft') ? button('Draft reply','reply',c.id) : ''}${openLink(c,p)}</div></article>`).join('')}</div>`
      : p.provider === 'tiktok' ? `<p class="co-note">TikTok shares comment counts with connected apps, but not the comment text. Open the video on TikTok to read and answer comments.</p>${safeUrl(i.url) ? `<div class="co-actions"><a class="primary-button" href="${esc(safeUrl(i.url))}" target="_blank" rel="noopener noreferrer">Read and reply on TikTok <span aria-hidden="true">↗</span></a></div>` : ''}`
      : `<p class="co-note">No comments have been synced for this ${esc(kindName(i.kind).toLowerCase())} yet. Sync again to bring in the latest.</p>`}</section>`;
    d.innerHTML = `<div class="co-dialog-head"><div><small>${esc(p.label)} · ${esc(kindName(i.kind))}${nice(i.occurred_at) ? ' · ' + esc(nice(i.occurred_at)) : ''}</small><h3>${esc(String(itemTitle(i)).slice(0,160))}</h3></div><button type="button" class="icon-button co-close" data-co-close aria-label="Close details" title="Close"><span aria-hidden="true">×</span></button></div>
      <div class="co-dialog-body"><div class="co-player" data-co-player>${thumb(i,p)}${embed ? `<button type="button" class="primary-button" data-co-play="${esc(i.id)}">▶ Play here</button>` : ''}</div>
      <div class="co-dialog-info">${stats(i.metrics) ? `<div class="co-metrics">${Object.entries(i.metrics).filter(([,v]) => v !== null && v !== undefined && typeof v !== 'object').map(([k,v]) => `<article class="co-metric"><small>${esc(label(k))}</small><strong>${esc(num(v))}</strong></article>`).join('')}</div>` : ''}
        ${i.text || i.title ? `<h4>${i.kind === 'video' ? 'Caption' : 'Text'}</h4><p class="co-text">${esc(i.text || i.title)}</p>` : ''}${i.rating ? `<p>Rating: ${esc(String(i.rating).toLowerCase())}</p>` : ''}${i.reply ? `<h4>Your reply</h4><p class="co-text">${esc(i.reply)}</p>` : ''}
        <div class="co-actions">${openLink(i,p,thread.length || p.provider !== 'tiktok' || i.kind !== 'video' ? 'primary-button' : 'secondary-button compact')}${i.can_reply && permitted(p,'draft') ? button('Draft reply','reply',i.id) : ''}</div>
        ${commentBlock}<small>Last updated ${esc(nice(i.synced_at))}. Figures come from ${esc(p.label)}.</small></div></div>`;
    if (!d.open) d.showModal();
    const target = focus === 'comments' && d.querySelector('[data-co-comments]');
    if (target) {target.scrollIntoView({block:'start'});target.focus({preventScroll:true});} else d.scrollTop = 0;
  }
  function switchTab(name) {
    active=name;if (model && selectedProvider() && !drawn.has(name)) draw(true);else showTab(name);
  }
  // Moving between tabs from code goes through a real tab click, so the page's own section memory follows.
  function goTab(name) {const tab=root.querySelector('#co-tab-'+name);if(tab){tab.click();tab.focus();}else switchTab(name);}
  function showTab(name) {
    root.querySelectorAll('[data-co-panel]').forEach(p => p.hidden=p.dataset.coPanel!==name);
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
  // Only the open tab is built; the others are built the first time they are opened.
  function draw(keep) {
    if (!keep) drawn.clear();
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
    if(active==='overview')panel('overview').innerHTML=`<div class="co-summary"><div><strong>${esc(p.label)}</strong><span>${esc(p.resources.find(r=>r.id===resourceId)?.label || p.account_label || 'No account connected')}</span></div>${pill(connected?(p.health?.title || 'Connected'):'Not connected',connected&&healthy?'ok':'wait')}</div>
      ${!connected?empty('Connect this channel to get started','Sign in with '+p.label+' from your connections. Oprun never asks for your social-media password.',connectNow)
      :measured.length?`${heading('Performance at a glance',state[0]?.checked_at?'Figures from your last sync on '+nice(state[0].checked_at)+'.':'')}<div class="co-metrics">${measured.join('')}</div>`
      :empty('No figures yet','Sync to bring in your latest content and its figures.',syncNow)}
      ${top.length?`${heading('Top recent content','Your most viewed items from the latest sync. Select one to see more.')}<div class="co-grid">${top.map(i=>itemCard(i,p)).join('')}</div>`:''}
      ${state.filter(s=>s.error).map(s=>`<p class="co-warning">The last sync did not finish. Your previous content is still shown — try Sync again.</p>`).join('')}
      ${connected&&(permitted(p,'draft')||permitted(p,'campaign'))?`<div class="co-box co-ai-teaser"><div><strong>Want more leads, views or bookings?</strong><p>Get AI recommendations for your channels and apply them in one click.</p></div><button type="button" class="primary-button" data-co-goto="ai">Get AI recommendations</button></div>`:''}
      ${model.owner?`${heading('Quick links','')}<div class="co-links"><a href="#communications/inbox">Unified Inbox</a><a href="#growth/hub">Content calendar</a><a href="#growth/media">Media Studio</a><a href="#growth/seo-google">Google reporting</a><a href="#today/approvals">Approvals</a></div>`:''}
      <details class="co-about"><summary>About these figures</summary><p>${esc(p.capabilities.note)}</p><p>Figures cover your most recent items, not your full history. A dash means ${esc(p.label)} did not report that figure — it does not mean zero.</p></details>`;
    const kinds=[...new Set(visibleItems.map(i=>i.kind))];if(itemFilter!=='all'&&!kinds.includes(itemFilter))itemFilter='all';
    const hasViews=visibleItems.some(i=>Number.isFinite(Number(i.metrics?.views)));if(!hasViews&&itemSort==='views')itemSort='new';
    const shown=visibleItems.filter(i=>itemFilter==='all'||i.kind===itemFilter).sort((a,b)=>itemSort==='views'?Number(b.metrics?.views || 0)-Number(a.metrics?.views || 0):String(b.occurred_at || '').localeCompare(String(a.occurred_at || '')));
    const chip=(key,text,group,on)=>`<button type="button" class="co-chip" data-co-${group}="${esc(key)}" aria-pressed="${on}">${esc(text)}</button>`;
    if(active==='inbox')panel('inbox').innerHTML=`${heading('Your recent content','Select any item to see its details, figures and a link to open it on '+p.label+'.')}
      ${visibleItems.length?`<div class="co-filterbar"><div class="co-chips" role="group" aria-label="Show">${chip('all','All ('+visibleItems.length+')','filter',itemFilter==='all')}${kinds.length>1?kinds.map(k=>chip(k,kindName(k)+'s ('+visibleItems.filter(i=>i.kind===k).length+')','filter',itemFilter===k)).join(''):''}</div>${hasViews?`<div class="co-chips" role="group" aria-label="Sort">${chip('new','Newest','sort',itemSort==='new')}${chip('views','Most viewed','sort',itemSort==='views')}</div>`:''}</div><div class="co-grid">${shown.map(i=>itemCard(i,p)).join('')}</div>`
      :empty(connected?'Nothing synced yet':'Connect this channel first',connected?'Sync to bring in your latest videos, posts, comments and messages.':'Once the account is connected, its content appears here.',connected?syncNow:connectNow)}`;
    const canDraft=permitted(p,'draft') && p.resources.length;
    if(active==='publish')panel('publish').innerHTML=`${heading('Publish & approvals','Nothing leaves your business without approval: write a draft, approve it, then send.')}<ol class="co-steps"><li>Write</li><li>Approve</li><li>Send</li></ol>
      ${canDraft?`<form data-co-compose class="co-form co-box"><div class="co-fields"><label>What would you like to do?<select name="kind"><option value="post">Write a post</option><option value="reply">Reply to a synced item</option></select></label><label>Reply to<select name="item_id"><option value="">Choose for replies</option>${visibleItems.filter(i=>i.can_reply).map(i=>`<option value="${esc(i.id)}">${esc(String(i.title || i.remote_id).slice(0,80))}</option>`).join('')}</select></label></div>${p.provider==='whatsapp'&&waTemplates.rid===resourceId&&waTemplates.list.length?`<div class="co-fields"><label>Approved template (needed after 24 hours)<select name="template"><option value="">No template · free text within 24 hours</option>${waTemplates.list.map((t,i)=>`<option value="${i}">${esc(t.name)} · ${esc(t.language)}${t.params?' · '+t.params+' value'+(t.params===1?'':'s'):''}</option>`).join('')}</select></label><label>Template values, one per line<textarea name="template_params" rows="2" maxlength="10000" placeholder="Value for {{1}}"></textarea></label></div>`:''}<label>Text<textarea name="body" maxlength="5000" rows="5" placeholder="Write your post or reply…"></textarea></label>${(p.resources.find(r=>r.id===resourceId)?.capabilities||{}).media?`${(p.resources.find(r=>r.id===resourceId)?.capabilities||{}).video&&(p.resources.find(r=>r.id===resourceId)?.capabilities||{}).image?`<label>Post type<select name="media_kind"><option value="image">Photo</option><option value="video">Video</option></select></label>`:''}<label>${p.provider==='tiktok'?'Video link':(p.resources.find(r=>r.id===resourceId)?.capabilities||{}).video?'Photo or video link':'Image link'}${p.resources.find(r=>r.id===resourceId).capabilities.media_required?' (required for posts)':' (optional, posts only)'}<input name="media_url" type="url" inputmode="url" maxlength="1500" placeholder="${p.provider==='tiktok'?'https://…/video.mp4':'https://…/photo.jpg'}"></label>${p.provider==='tiktok'?`<label>Who can see this video<select name="privacy_level"><option value="">Choose…</option><option value="PUBLIC_TO_EVERYONE">Everyone</option><option value="FOLLOWER_OF_CREATOR">Followers</option><option value="MUTUAL_FOLLOW_FRIENDS">Friends</option><option value="SELF_ONLY">Only me</option></select><small>TikTok checks this against what your account allows before posting.</small></label>`:''}`:''}<div class="co-actions"><button class="primary-button" type="submit">Save for approval</button><small>If ${esc(p.label)} does not allow this action, you will be told straight away.</small></div></form>`
      :empty('Drafting is not available here',connected?'You need drafting permission for this channel. Ask your business owner.':'Connect and select an account first.',connected?'':connectNow)}
      ${heading('Drafts','')}<div class="co-list">${visibleDrafts.map(d=>`<article class="co-card"><div class="co-card-top"><small>${esc(d.kind==='reply'?'Reply':'Post')} · ${esc(p.resources.find(r=>r.id===d.resource_id)?.label || d.resource_id)}${d.target?.recipient?' · To: '+esc(d.target.recipient):d.target?.title?' · Reply to: '+esc(String(d.target.title).slice(0,80)):''}</small>${statusPill(d.status)}</div><p>${esc(d.body)}</p>${d.error?`<p class="co-warning">${esc(d.error)}</p>`:''}<div class="co-actions">${d.status==='pending'&&permitted(p,'approve')?button('Approve exact draft','approve',d.id)+button('Reject','reject',d.id):''}${d.status==='approved'&&permitted(p,d.kind==='reply'?'reply':'publish')?button(d.kind==='reply'?'Send approved reply':'Publish approved post','send',d.id):''}</div>${d.external_id?`<small>Provider confirmation: ${esc(d.external_id)}</small>`:''}</article>`).join('') || empty('No drafts yet','Drafts you save for this channel appear here for approval.')}</div>
      <details class="co-about"><summary>Good to know</summary><p>Videos are prepared in Media Studio; uploading video straight to ${esc(p.label)} from here is not available yet. If a send cannot be confirmed, it is held for you to check and is never retried automatically.</p></details>`;
    if(active==='campaigns')panel('campaigns').innerHTML=`${heading('Local campaigns','Plan who you want to reach nearby, what you will offer and a budget. Saving or approving a plan never spends money or publishes anything.')}<ol class="co-steps"><li>Goal</li><li>Local area</li><li>Offer</li><li>Budget</li><li>Review</li></ol>
      ${permitted(p,'campaign')?`<form data-co-campaign class="co-form co-box"><div class="co-fields"><label>Campaign name<input name="name" required minlength="2" maxlength="160" placeholder="Spring local offer"></label><label>Goal<input name="goal" required minlength="2" maxlength="300" placeholder="More local enquiries"></label></div><div class="co-fields"><label>Suburbs<input name="suburbs" maxlength="1000" placeholder="Fremantle, Cockburn"><small>Separate with commas</small></label><label>Postcodes<input name="postcodes" maxlength="500" placeholder="6160, 6164"><small>Separate with commas</small></label></div><details><summary>Target by distance instead (optional)</summary><div class="co-fields"><label>Radius (km)<input type="number" name="radius" min="0.1" max="200" step="0.1"></label><label>Latitude<input name="latitude" type="number" min="-90" max="90" step="any"></label><label>Longitude<input name="longitude" type="number" min="-180" max="180" step="any"></label></div></details><label>Offer and content<textarea name="body" required minlength="2" maxlength="5000" rows="4" placeholder="What will you offer, and what should the post or ad say?"></textarea></label><div class="co-fields"><label>Plan type<select name="mode"><option value="organic">Organic</option><option value="paid_plan">Paid ad plan — no automatic spend</option></select></label><label>Daily budget (AUD)<input name="budget" type="number" min="0" max="10000" step="0.01" value="0"></label></div><div class="co-actions"><button type="submit" class="primary-button">Save local plan for ${esc(p.label)}</button></div></form>`:''}
      ${heading('Saved plans','')}<div class="co-list">${campaigns.map(c=>`<article class="co-card"><div class="co-card-top"><h4>${esc(c.name)}</h4>${statusPill(c.status)}</div><p>${esc(c.goal)}</p><div class="co-stats"><span class="co-stat">${esc(c.mode==='paid_plan'?'Paid ad plan':'Organic')}</span><span class="co-stat">${esc([...c.targeting.suburbs,...c.targeting.postcodes].join(', ') || c.targeting.radius_km+' km radius')}</span><span class="co-stat"><strong>A$${(c.daily_budget_cents/100).toFixed(2)}</strong>/day planned</span></div><p>${esc(c.body)}</p>${model.owner&&c.status==='draft'?`<div class="co-actions">${button('Approve plan only','campaign-approve',c.id)}</div>`:''}</article>`).join('') || empty('No local plans yet','Create a plan above. Paid ads are still launched from the ad provider.')}</div>`;
    const prompts=['How can I get more local enquiries from this channel?','Which of my recent posts worked best, and why?','Give me five post ideas for next week'];
    const growthCard=a=>{const done=growth.applied[a.key],t=a.apply.type;return `<article class="co-card co-growth" data-co-growth="${esc(a.key)}"><div class="co-card-top"><h4>${esc(a.title)}</h4>${pill(a.label,t==='connect'?'wait':'ok')}</div><p class="co-why">${esc(a.why)}</p>${a.body?`<p class="co-text co-proposed">${esc(a.body)}</p>`:''}<div class="co-actions">${done?`${pill(done.text,done.ok?'ok':'bad')}${done.tab?`<button type="button" class="secondary-button compact" data-co-goto="${esc(done.tab)}">${done.tab==='publish'?'Review in Publish & approvals':'Review in Local campaigns'}</button>`:''}`:`<button type="button" class="primary-button" data-co-apply="${esc(a.key)}">${t==='post'?'Apply — create draft post':t==='campaign'?'Apply — save as plan':'Connect now'}</button>`}</div></article>`;};
    const needsArea=growth?.actions.some(a=>a.apply.type==='campaign'&&!growth.applied[a.key]),open=growth?.actions.filter(a=>a.apply.type!=='connect'&&!growth.applied[a.key]).length || 0;
    if(active==='ai')panel('ai').innerHTML=`${heading('AI recommendations','Pick a goal and get ready-made actions for your channels. One click turns an action into a draft or plan — nothing is published, sent or spent until you approve it.')}
      ${permitted(p,'draft')||permitted(p,'campaign')?`<form data-co-growth-form class="co-form co-box"><fieldset><legend>What do you want more of?</legend><div class="co-chips">${Object.entries(GOALS).map(([k,t])=>`<label class="co-chip co-radio"><input type="radio" name="goal" value="${k}" ${(growth?.goal || 'leads')===k?'checked':''}> ${esc(t)}</label>`).join('')}</div></fieldset><div class="co-fields"><label>For<select name="scope"><option value="all" ${growth?.scope!=='one'?'selected':''}>All my channels</option><option value="one" ${growth?.scope==='one'?'selected':''}>${esc(p.label)} only</option></select></label></div><div class="co-actions"><button class="primary-button" type="submit">Get recommendations</button></div></form>
      ${growth?`${heading('Recommended actions for “'+GOALS[growth.goal]+'”',growth.actions.length?(growth.method==='ai_assisted'?'Written with AI from your own synced figures.':'Based on your synced figures.')+' Review each one before approving.':'')}${needsArea?`<label class="co-area">Local area for plans<input data-co-area value="${esc(growth.area)}" maxlength="300" placeholder="Fremantle, 6160"><small>Suburbs or postcodes, separated by commas. Needed for actions saved as plans.</small></label>`:''}${open>1?`<div class="co-actions"><button type="button" class="primary-button" data-co-apply-all>Apply all ${open} actions</button></div>`:''}<div class="co-list">${growth.actions.filter(a=>a.apply.type!=='connect').map(growthCard).join('') || empty('No actions ready yet','Connect a channel below, or ask your business owner for drafting or campaign permission.')}</div>${growth.actions.some(a=>a.apply.type==='connect')?`<details class="co-about co-unconnected"><summary>${growth.actions.filter(a=>a.apply.type==='connect').length} more channel(s) you could connect</summary><div class="co-list">${growth.actions.filter(a=>a.apply.type==='connect').map(growthCard).join('')}</div></details>`:''}`:''}`:empty('Not available','You need drafting or campaign permission for this channel to use AI recommendations.')}
      ${permitted(p,'draft')?`${heading('Ask a question','Suggestions use only this channel’s synced content and figures.')}<div class="co-chips" aria-label="Suggested questions">${prompts.map(t=>`<button type="button" class="co-chip" data-co-prompt="${esc(t)}">${esc(t)}</button>`).join('')}</div><form data-co-ai class="co-form co-box"><label>What would you like to improve?<textarea name="goal" required minlength="3" maxlength="1000" rows="3" placeholder="Improve local enquiries from this channel"></textarea></label><div class="co-actions"><button class="primary-button" type="submit">Prepare recommendations</button>${visibleItems.length?'':'<small>Tip: sync your content first for better suggestions.</small>'}</div></form>`:''}<div data-co-ai-result class="co-card co-ai-result" aria-live="polite" hidden></div>`;
    if (model.owner && team && active==='team') {
      const members=team.members.filter(m=>m.role!=='owner');
      panel('team').innerHTML=`${heading('Team access','Only you decide who can use this channel. Team members have no access until you give it, and connecting or disconnecting accounts always stays with you.')}
        ${members.length?`<form data-co-access class="co-form co-box"><label>Team member<select name="user" required>${members.map(m=>`<option value="${esc(m.id)}">${esc(m.full_name)} (${esc(m.role)})</option>`).join('')}</select></label><fieldset><legend>What can they do on ${esc(p.label)}?</legend><div class="co-checks">${team.actions.map(a=>`<label><input type="checkbox" name="actions" value="${a}"><span><strong>${esc(ACTIONS[a]?.[0] || a)}</strong><small>${esc(ACTIONS[a]?.[1] || '')}</small></span></label>`).join('')}</div></fieldset><label>Limit to one account<select name="resource"><option value="">All selected accounts on this channel</option>${p.resources.map(r=>`<option value="${esc(r.id)}">${esc(r.label || r.id)}</option>`).join('')}</select></label><div class="co-actions"><button type="submit" class="primary-button">Save channel access</button><small>Untick everything to remove access. “View” is needed for any other action.</small></div></form>`:empty('No team members yet','Invite team members first, then choose what each can do on this channel.')}`;
      fillAccess();
    }
    drawn.add(active);showTab(active);
  }
  function fillAccess() {
    const f=root.querySelector('[data-co-access]');if (!f || !f.elements.user.value) return;
    const g=team.grants.find(g=>g.user_id===f.elements.user.value && g.provider===selectedProvider()?.provider);
    f.dataset.revision=String(g?.revision || 0);f.querySelectorAll('[name=actions]').forEach(i=>i.checked=(g?.actions || []).includes(i.value));f.elements.resource.value=g?.resources?.[0] || '';
  }
  const details = provider => Promise.all([api('/'+provider+'/items'),api('/drafts'),api('/campaigns')]);
  async function applyGrowth(a) {
    const t=a.apply;
    if(t.type==='connect')return {connect:true};
    try {
      if(t.type==='post'){await api('/drafts',{provider:t.provider,resource_id:t.resource_id,kind:'post',body:t.body,item_id:null});return {ok:true,text:'Draft created · waiting for approval',tab:'publish'};}
      const parts=String(growth.area || '').split(',').map(v=>v.trim()).filter(Boolean),postcodes=parts.filter(v=>/^\d{3,4}$/.test(v)),suburbs=parts.filter(v=>!/^\d{3,4}$/.test(v));
      if(!parts.length)return {ok:false,text:'Add a local area first'};
      await api('/campaigns',{name:t.name,goal:t.goal,providers:t.providers,mode:'organic',daily_budget_cents:0,body:t.body,targeting:{country:'AU',suburbs,postcodes,radius_km:null,latitude:null,longitude:null}});
      return {ok:true,text:'Plan saved · waiting for approval',tab:'campaigns'};
    } catch(e) {return {ok:false,text:e.message};}
  }
  async function loadDetails(preload) {
    const sequence=++detailSequence,p=selectedProvider();if (!p) {draw();return;}
    const result=preload || await details(p.provider);
    if(sequence!==detailSequence || selectedProvider()?.provider!==p.provider)return;
    items=result[0].items;drafts=result[1].drafts.filter(d=>d.provider===p.provider);campaigns=result[2].campaigns.filter(c=>c.providers.includes(p.provider));
    const rid=root.querySelector('[data-co-resource]')?.value || p.resources.find(r=>r.type==='whatsapp_phone')?.id || '';
    if(p.provider==='whatsapp' && rid && permitted(p,'draft') && waTemplates.rid!==rid){
      const list=await api('/whatsapp/templates?resource_id='+encodeURIComponent(rid)).then(d=>d.templates.filter(t=>t.available)).catch(()=>[]);
      if(sequence!==detailSequence)return;waTemplates={rid,list};
    }
    draw();
  }
  async function render() {
    if (busy) return;busy=true;
    const prev=root.querySelector('[data-co-provider]')?.value;
    try {
      // One round of parallel requests instead of five in a row.
      const guessOwner=window.GDS_SESSION?.user?.role==='owner';
      const [m,t,pre]=await Promise.all([api('/overview'),guessOwner?api('/team').catch(()=>undefined):undefined,prev?details(prev).catch(()=>null):null]);
      const rebuild=!root.querySelector('[data-co-provider]') || Boolean(model?.owner)!==Boolean(m.owner);
      model=m;team=m.owner?(t || await api('/team')):null;loadedAt=Date.now();if(rebuild)shell();
      root.querySelector('[data-co-provider]').innerHTML=model.providers.map(p=>`<option value="${esc(p.provider)}">${esc(p.label)}</option>`).join('');
      if (model.providers.some(p=>p.provider===prev)) root.querySelector('[data-co-provider]').value=prev;
      const accounts=document.getElementById('integration-self-service');if(accounts) accounts.hidden=!model.owner;
      if (!model.providers.length) {draw();switchTab('overview');return;}
      await loadDetails(pre && selectedProvider()?.provider===prev ? pre : undefined);
    } catch(e) {root.replaceChildren();const p=document.createElement('p');p.textContent=e.message;root.append(p);} finally {busy=false;}
  }
  root.addEventListener('keydown',e=>{const current=e.target.closest('[data-co-tab]');if(!current||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...root.querySelectorAll('[data-co-tab]')],at=tabs.indexOf(current),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(at+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;switchTab(tabs[next].dataset.coTab);tabs[next].focus();});
  root.addEventListener('change',e=>{if(e.target.matches('[data-co-provider]'))loadDetails().catch(e=>message(e.message,true));if(e.target.matches('[data-co-resource]'))draw();if(e.target.matches('[name=user]'))fillAccess();});
  root.addEventListener('error',e=>{if(e.target.matches?.('.co-thumb img'))e.target.remove();},true);
  root.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.coTab){if(b.dataset.coTab!==active)message('');switchTab(b.dataset.coTab);return;}
    if(b.dataset.coView){showItem(b.dataset.coView,b.dataset.coFocus);return;}
    if(b.hasAttribute('data-co-close')){const d=b.closest('dialog');d?.close();d?.replaceChildren();return;}
    if(b.dataset.coPlay){const i=items.find(x=>x.id===b.dataset.coPlay),src=safeEmbed(i?.embed),box=b.closest('[data-co-player]');if(src&&box){const f=document.createElement('iframe');f.src=src;f.title='Video player';f.allow='fullscreen; encrypted-media; picture-in-picture';f.referrerPolicy='strict-origin-when-cross-origin';f.setAttribute('allowfullscreen','');box.replaceChildren(f);}return;}
    if(b.dataset.coGoto){goTab(b.dataset.coGoto);return;}
    if(b.dataset.coApply||b.hasAttribute('data-co-apply-all')){
      const area=root.querySelector('[data-co-area]');if(area)growth.area=area.value;
      const list=b.dataset.coApply?growth.actions.filter(a=>a.key===b.dataset.coApply):growth.actions.filter(a=>a.apply.type!=='connect'&&!growth.applied[a.key]);
      if(list.length===1&&list[0].apply.type==='connect'){root.querySelector('[data-co-connect]')?.click();const tab=[...document.querySelectorAll('#integrations-view [role=tab]')].find(t=>t.textContent.trim()==='Your business connections');tab?.click();return;}
      b.disabled=true;message(list.length>1?'Applying '+list.length+' actions…':'Applying…');let ok=0;
      for(const a of list){const r=await applyGrowth(a);if(r.ok)ok++;if(r.ok||list.length===1||r.text!=='Add a local area first')growth.applied[a.key]=r.ok?r:undefined;if(!r.ok){message(r.text==='Add a local area first'?'Add a local area (suburb or postcode) so plans can be saved.':r.text,true);if(list.length===1){draw();root.querySelector('[data-co-area]')?.focus();return;}}}
      if(ok){const [d,c]=await Promise.all([api('/drafts'),api('/campaigns')]),pp=selectedProvider();drafts=d.drafts.filter(x=>x.provider===pp.provider);campaigns=c.campaigns.filter(x=>x.providers.includes(pp.provider));}
      draw();if(ok)message(ok===1?'Done. Review and approve it before anything goes out.':ok+' actions applied. Review and approve each before anything goes out.');return;
    }
    if(b.dataset.coFilter){itemFilter=b.dataset.coFilter;draw();return;}
    if(b.dataset.coSort){itemSort=b.dataset.coSort;draw();return;}
    if(b.dataset.coPrompt){const f=root.querySelector('[data-co-ai]');if(f){f.elements.goal.value=b.dataset.coPrompt;f.elements.goal.focus();}return;}
    if(b.hasAttribute('data-co-connect')){const tab=[...document.querySelectorAll('#integrations-view [role=tab]')].find(t=>t.textContent.trim()==='Your business connections');if(tab)tab.click();else document.getElementById('integration-self-service')?.scrollIntoView();return;}
    const p=selectedProvider();b.disabled=true;
    try {
      if(b.hasAttribute('data-co-refresh')){await render();return;}
      if(b.hasAttribute('data-co-sync')){message('Syncing your latest content…');const d=await api('/'+p.provider+'/sync',{resource_id:root.querySelector('[data-co-resource]').value});await render();message(d.count?`Synced your ${d.count} most recent item${d.count===1?'':'s'}.`:'Sync finished. No recent items were found for this account.');return;}
      if(b.hasAttribute('data-co-reply')){const item=items.find(i=>i.id===b.dataset.coReply);root.querySelector('dialog.co-dialog[open]')?.close();goTab('publish');const f=root.querySelector('[data-co-compose]');f.elements.kind.value='reply';f.elements.item_id.value=item.id;root.querySelector('[data-co-resource]').value=item.resource_id;f.elements.body.focus();return;}
      for(const key of ['approve','reject','send'])if(b.hasAttribute('data-co-'+key)){const d=drafts.find(d=>d.id===b.getAttribute('data-co-'+key));await api('/drafts/'+d.id+(key==='send'?'/publish':'/decision'),{revision:d.revision,...(key==='send'?{}:{decision:key==='approve'?'approve':'reject'})});await render();message(key==='send'?'Provider confirmed delivery.':'Review recorded.');return;}
      if(b.hasAttribute('data-co-campaign-approve')){const d=await api('/campaigns/'+b.dataset.coCampaignApprove+'/approve',{});await render();message(d.message);}
    } catch(e) {message(e.message,true);} finally {if(b.isConnected)b.disabled=false;}
  });
  root.addEventListener('submit',async e=>{
    e.preventDefault();const f=e.target,p=selectedProvider(),b=f.querySelector('button[type=submit]');if(!b)return;b.disabled=true;
    try {
      const data=new FormData(f);
      if(f.matches('[data-co-compose]')){const reply=items.find(i=>i.id===data.get('item_id')),tpl=data.get('template')?waTemplates.list[Number(data.get('template'))]:null;
        if(!tpl&&!String(data.get('body')||'').trim()){message('Write the text first.');return;}
        await api('/drafts',{provider:p.provider,resource_id:data.get('kind')==='reply'&&reply?reply.resource_id:root.querySelector('[data-co-resource]').value,kind:data.get('kind'),body:tpl?tpl.name:data.get('body'),...(tpl?{template:{name:tpl.name,language:tpl.language,params:String(data.get('template_params')||'').split('\n').map(v=>v.trim()).filter(Boolean)}}:{}),item_id:data.get('kind')==='reply'?data.get('item_id')||null:null,...(data.get('kind')==='post'&&String(data.get('media_url')||'').trim()?{media_url:String(data.get('media_url')).trim()}:{}),...(data.get('kind')==='post'&&data.get('privacy_level')?{privacy_level:data.get('privacy_level')}:{}),...(data.get('kind')==='post'&&data.get('media_kind')&&String(data.get('media_url')||'').trim()?{media_kind:data.get('media_kind')}:{})});await render();message('Draft saved. Approval is required before sending.');}
      if(f.matches('[data-co-campaign]')){const split=v=>String(v).split(',').map(s=>s.trim()).filter(Boolean);await api('/campaigns',{name:data.get('name'),goal:data.get('goal'),providers:[p.provider],mode:data.get('mode'),daily_budget_cents:Math.round(Number(data.get('budget'))*100),body:data.get('body'),targeting:{country:'AU',suburbs:split(data.get('suburbs')),postcodes:split(data.get('postcodes')),radius_km:data.get('radius')?Number(data.get('radius')):null,latitude:data.get('latitude')?Number(data.get('latitude')):null,longitude:data.get('longitude')?Number(data.get('longitude')):null}});await render();message('Campaign plan saved. No content was sent and no ad spend started.');}
      if(f.matches('[data-co-growth-form]')){message('Preparing recommendations…');const scope=data.get('scope'),d=await api('/growth-actions',{goal:data.get('goal'),...(scope==='one'?{provider:p.provider}:{})});growth={goal:d.goal,scope,actions:d.actions,method:d.method,applied:{},area:growth?.area || d.suggested_area || ''};draw();message(d.actions.length?d.actions.length+' recommended action'+(d.actions.length===1?'':'s')+' ready.':'No actions available yet.');}
      if(f.matches('[data-co-ai]')){message('Preparing guidance…');const d=await api('/'+p.provider+'/recommendations',{goal:data.get('goal')});const box=root.querySelector('[data-co-ai-result]');box.hidden=false;box.textContent=d.text;message(`${d.method==='ai_assisted'?'AI-assisted':'Guided rules'} · ${d.sample_count} recent items · review required`);}
      if(f.matches('[data-co-access]')){await api('/team/'+data.get('user')+'/'+p.provider,{actions:data.getAll('actions'),resources:data.get('resource')?[data.get('resource')]:[],revision:Number(f.dataset.revision)},'PUT');await render();message('Channel access updated for this business only.');}
    } catch(e) {message(e.message,true);} finally {if(b.isConnected)b.disabled=false;}
  });
  window.addEventListener('gds:viewchange',e=>{if(e.detail?.view==='integrations'&&Date.now()-loadedAt>30000)render();});
  window.SuperProChannels={render};
})();
