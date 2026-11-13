/* Workspace connection controls. Account passwords and OAuth app secrets stay off this page. */
(()=>{
  if(window.SuperProIntegrationManager)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const pendingSelections=new Map(),records=new Map();
  let loading=null,identity='',canManage=false,canCheck=false;
  const context=()=>`${window.GDS_SESSION?.user?.id||''}:${window.GDS_SESSION?.organisation?.id||''}`;
  const api=async(url,opt={})=>{
    const r=await fetch(url,{...opt,credentials:'same-origin',headers:{'content-type':'application/json',...(opt.headers||{})}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.ok===false){const e=new Error(d.error||d.diagnostic?.title||'This action could not be completed.');e.data=d;throw e;}
    return d;
  };
  const friendly={
    meta:'Connect on Meta to choose your Facebook Pages and linked Instagram professional accounts. App review and the granted permissions determine what is available.',
    whatsapp:'Authorise your own Meta business and choose its WhatsApp phone number. Business verification, templates and messaging permissions are controlled by Meta.',
    tiktok:'Authorise your TikTok account. Profile statistics require user.info.stats; recent videos require video.list. Publishing needs separate provider approval.',
    youtube:'Authorise Google and choose your YouTube channel. Subscriber counts can be rounded or hidden by YouTube.',
    google_seo:'Authorise Google, then select your Search Console properties, Analytics properties and Tag Manager containers separately. Each API is checked independently.',
    google_business:'Authorise your own Business Profile locations. Google must approve the platform’s Business Profile API access.',
    x:'Authorise your X account. Available endpoints and metrics depend on the platform’s X API access tier.',
    snapchat:'Authorise Snapchat through its official screen. Marketing API identity does not provide personal-profile statistics; Public Profile insights need separate approved API access.',
    website:'Save your website and prove ownership with the displayed DNS TXT record. Then connect its enquiry form to this workspace.',
    email_sms:'Connect a workspace-owned business email service (Resend) or SMS service (Telnyx). Use provider API keys, not your email or social-media account password. Existing Gmail/Outlook mailbox sync is not included in this transport connection.'
  };
  const stamp=value=>value?new Date(value).toLocaleString():'Not checked yet';
  function status(x){
    if(x.last_test_status==='fail')return ['Needs attention','attention'];
    if(x.status==='connected'&&x.connection_mode==='oauth'&&!x.resources?.length)return ['Authorised · no resources found','attention'];
    if(x.status==='connected')return [x.last_test_status==='partial'?'Authorised · some services need attention':x.resources?.length&&!x.selected_resources?.length?'Authorised · choose resources':x.last_test_status==='pass'?'Connected · checked':'Authorised · test next',x.last_test_status==='partial'?'attention':'connected'];
    if(x.status==='authorisation_pending')return ['Sign-in not finished','attention'];
    return [x.provider_ready?'Ready to set up':'Not available yet','setup'];
  }
  // T-070: one health light with the single action that fixes it. The meaning is always written out, never colour alone.
  const healthWord={green:'Working',amber:'Needs action',red:'Reconnect',off:''};
  function healthHtml(x){
    const h=x.health;if(!h||h.level==='off')return '';
    const fix={connect:['data-connect-provider',x.status==='connected'?'Reconnect now':'Connect'],test:['data-im-test','Test now'],confirm:null,select:null}[h.fix];
    return `<div class="connection-health health-${esc(h.level)}" role="status"><span class="health-dot" aria-hidden="true"></span><div><b>${esc(healthWord[h.level]===h.title?h.title:(healthWord[h.level]||'')+': '+h.title)}</b>${h.detail?`<p>${esc(h.detail)}</p>`:''}<small>Last automatic check: ${esc(stamp(h.checked_at))}</small></div>${fix&&canCheck?`<button type="button" ${fix[0]}="${esc(x.provider)}" data-im-fix="1">${fix[1]}</button>`:''}</div>`;
  }
  function confirmHtml(x){
    if(!x.needs_confirmation)return '';
    const business=window.GDS_SESSION?.organisation?.name||'this business';
    return `<section class="connection-confirm" role="group" aria-label="Confirm account"><h3>Is this the right account?</h3><p>You signed in as <b>${esc(x.account_label||'an account')}</b>. It will be used only for <b>${esc(business)}</b>. If your browser signed in to a different account, choose No and connect again.</p><div class="integration-manager-actions"><button type="button" data-im-confirm="${esc(x.provider)}" ${canManage?'':'disabled'}>Yes, use this account</button><button type="button" data-im-disconnect="${esc(x.provider)}" data-im-wrong="1" ${canManage?'':'disabled'}>No, disconnect</button></div></section>`;
  }
  const actionWord={working:'Available',partial:'Available with limits',not_yet:'Not available yet',not_offered:'Not offered by this provider'};
  function actionsHtml(x){
    if(!x.actions?.length)return '';
    return `<details class="connection-capabilities"><summary>What this connection can do</summary><ul>${x.actions.map(a=>`<li class="cap-${esc(a.state)}"><b>${esc(a.label)}</b>: ${esc(actionWord[a.state]||a.state)}${a.note?` (${esc(a.note)})`:''}</li>`).join('')}</ul><p>Posts, replies and campaigns are only sent after a person approves them.</p></details>`;
  }
  function checklistHtml(x){
    if(x.status==='connected'||!x.checklist?.length)return '';
    return `<details class="connection-checklist"><summary>Before you connect</summary><ul>${x.checklist.map(c=>`<li>${esc(c)}</li>`).join('')}</ul><p>You sign in on the provider’s own page. Oprun never sees or stores your password.</p></details>`;
  }
  function diagnosticHtml(d){return d?`<div class="connection-diagnostic"><strong>${esc(d.title)}</strong><p>${esc(d.action)}</p>${d.reference?`<small>Reference: ${esc(d.reference)}</small>`:''}</div>`:'';}
  function insightsHtml(x){
    if(!x.insights)return '';
    return `<section class="connection-insights" aria-label="${esc(x.display_name)} figures"><h3>Latest figures</h3><p>Last refresh attempt: ${esc(stamp(x.insights.fetched_at))}. Provider figures can be delayed.</p>${(x.insights.results||[]).map(r=>`<article><h4>${esc(r.label)}</h4><small>${esc(r.source)} · ${esc(r.period||'')} · ${esc(stamp(r.fetched_at))}</small>${r.status==='stale'?'<p>Refresh failed. Showing the last successful figures.</p>'+diagnosticHtml(r.diagnostic):''}${r.status==='unavailable'?diagnosticHtml(r.diagnostic):`<dl class="connection-metrics">${(r.metrics||[]).map(m=>`<div><dt>${esc(m.label)}</dt><dd>${m.value===null?'Not available':esc(Number(m.value).toLocaleString(undefined,{maximumFractionDigits:3}))}</dd>${m.note?`<small>${esc(m.note)}</small>`:''}</div>`).join('')}</dl>`}${r.search_keywords?.length?`<details><summary>What people searched to find you (${esc(r.search_keywords_period||'')})</summary><ol>${r.search_keywords.map(k=>`<li>${esc(k.keyword)} <strong>${k.impressions!==null?esc(Number(k.impressions).toLocaleString()):'fewer than '+esc(k.below)}</strong></li>`).join('')}</ol><small>Google search and Maps impressions per search term.</small></details>`:''}${r.recent_content?.length?`<details><summary>Recent videos (${r.recent_content.length})</summary><p>${esc(r.content_note)}</p><div class="connection-table"><table><thead><tr><th>Video</th><th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th></tr></thead><tbody>${r.recent_content.map(v=>`<tr><th scope="row">${esc(v.title)}</th>${['views','likes','comments','shares'].map(k=>`<td>${v[k]===null?'Not available':esc(v[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`:''}</article>`).join('')}${diagnosticHtml(x.insights_error)}</section>`;
  }
  function resourcesHtml(x){
    if(!x.resources?.length)return '';
    const selected=new Set(pendingSelections.get(x.provider)||(x.selected_resources||[]).map(r=>String(r.id)));
    return `<section class="integration-resource-picker"><h3>Choose workspace resources</h3><p>Only saved selections are used for figures and connected actions.</p><div class="integration-resource-list">${x.resources.map(r=>`<label><input type="checkbox" data-im-resource="${esc(r.id)}" ${selected.has(String(r.id))?'checked':''} ${r.usable===false||!canCheck?'disabled':''}><span><b>${esc(r.label||r.id)}</b><small>${esc(String(r.type||'resource').replaceAll('_',' '))}${r.usable===false?' · ownership permission required':''}</small></span></label>`).join('')}</div><button type="button" data-im-save="${esc(x.provider)}" ${!canCheck?'disabled':''}>Save selection</button></section>`;
  }
  function bodyHtml(x){
    const [label,tone]=status(x),owned=x.connection_mode&&x.connection_mode!=='oauth',manage=canManage?'':'disabled';
    const primary=owned?'Set up my '+(x.provider==='website'?'website':'email / SMS'):x.status==='connected'?'Reconnect':x.provider_ready?'Connect / Authorise':'What is needed';
    return `<div class="connection-card-heading"><span class="integration-logo" aria-hidden="true">${esc((x.display_name||x.provider).slice(0,1))}</span><div><h3>${esc(x.display_name||x.provider)}</h3><span class="connection-state ${tone}">${esc(label)}</span></div></div><p>${esc(friendly[x.provider]||'Connect your own provider account securely.')}</p>${x.account_label?`<p><b>Account:</b> ${esc(x.account_label)}${x.connected_at?` · connected ${esc(new Date(x.connected_at).toLocaleDateString())}`:''}</p>`:''}${healthHtml(x)}${confirmHtml(x)}${checklistHtml(x)}<div class="integration-manager-actions"><button type="button" data-connect-provider="${esc(x.provider)}" data-ready="${x.provider_ready?'1':'0'}" data-status="${esc(x.status)}" ${manage}>${primary}</button>${x.status==='connected'||x.provider==='website'&&x.website?`<button type="button" data-im-test="${esc(x.provider)}" ${!canCheck?'disabled':''}>${x.provider==='website'?'Verify website':'Test connection'}</button><button type="button" data-im-insights="${esc(x.provider)}" ${!canCheck?'disabled':''}>Refresh figures</button>`:''}<button type="button" data-im-diagnose="${esc(x.provider)}">Troubleshoot</button>${x.status==='connected'&&x.connection_mode==='oauth'?`<button type="button" data-connect-provider="${esc(x.provider)}" data-im-switch="1" data-ready="${x.provider_ready?'1':'0'}" ${manage}>Switch account</button>`:''}${x.status==='connected'?`<button type="button" data-im-disconnect="${esc(x.provider)}" ${manage}>Disconnect</button>`:''}</div>${x.connection_mode==='oauth'?`<p class="connection-note">You sign in on ${esc(x.display_name||x.provider)}’s own page with your own account. Oprun never asks for or stores your social-media password.</p><details class="connection-own-app" data-im-app="${esc(x.provider)}"><summary>Use your own app keys (advanced)</summary><div data-im-app-box><p>Loading…</p></div></details>`:''}${actionsHtml(x)}<p class="integration-manager-status">Last connection check: ${esc(stamp(x.last_tested_at))}</p>${x.platform_transport_available&&x.provider==='email_sms'?'<p class="connection-note">Platform delivery is available separately. This does not connect your own mailbox or SMS account.</p>':''}${x.transport?`<dl class="connection-service-status"><dt>Business email</dt><dd>${esc(x.transport.email?.sender||'Not connected')}</dd><dt>SMS number</dt><dd>${esc(x.transport.sms?.number||'Not connected')}</dd></dl>`:''}${(x.service_checks||[]).length?`<ul class="connection-service-checks">${x.service_checks.map(c=>`<li><b>${esc(c.service.replaceAll('_',' '))}</b>: ${esc(c.status==='pass'?'Checked':c.status)}${c.detail?` · ${esc(c.detail)}`:''}</li>`).join('')}</ul>`:''}${diagnosticHtml(x.diagnostic)}${resourcesHtml(x)}${insightsHtml(x)}<div data-im-requirements="${esc(x.provider)}" class="integration-requirements-inline" hidden><p>${esc(friendly[x.provider])}</p><p>A platform administrator must register the provider app once. Each subscriber then authorises their own account and resources.</p><a href="#setup/help">Open support</a></div><div class="connection-action-result" role="status" aria-live="polite"></div>`;
  }
  function paintCard(x){
    const grid=document.getElementById('self-service-integration-grid');if(!grid)return;
    let card=grid.querySelector(`[data-provider-card="${CSS.escape(x.provider)}"]`);
    if(!card){card=document.createElement('article');card.dataset.providerCard=x.provider;card.className='integration-card self-service connection-card';grid.append(card);}
    const config=card.querySelector('[data-im-config]');config?.remove();
    const assistant=card.querySelector('[data-im-assistant]');assistant?.remove();
    card.innerHTML=bodyHtml(x);if(config)card.append(config);if(assistant)card.append(assistant);
  }
  async function render(){
    if(window.GDS_SESSION?.user?.role!=='owner'){const accounts=document.getElementById('integration-self-service');if(accounts)accounts.hidden=true;return;}
    if(loading)return loading;
    const grid=document.getElementById('self-service-integration-grid');if(!grid)return;
    const current=context();
    if(identity!==current){identity=current;pendingSelections.clear();records.clear();grid.replaceChildren();}
    loading=(async()=>{
      try{
        const d=await api('/api/saas/integrations/self-service');if(current!==context())return;
        canManage=d.can_manage??['owner','admin','super_admin'].includes(window.GDS_SESSION?.user?.role);
        canCheck=d.can_check??canManage;
        for(const x of d.integrations||[]){records.set(x.provider,x);paintCard(x);}
        let summary=document.getElementById('connection-hub-summary');
        if(!summary){summary=document.createElement('p');summary.id='connection-hub-summary';summary.className='connection-note';grid.before(summary);}
        summary.textContent=`${d.integrations?.length||0} services · ${[...records.values()].filter(x=>x.status==='connected').length} authorised for this workspace. Figures show their source and last refresh. Account passwords are never requested.`;
      }catch(e){grid.replaceChildren();const p=document.createElement('p');p.className='gov-empty';p.textContent=e.message;grid.append(p);}
    })().finally(()=>{loading=null});return loading;
  }
  const field=(label,name,type='text',hint='')=>`<label>${esc(label)}<input type="${type}" name="${name}" aria-label="${esc(label)}" autocomplete="off" ${['api_key','sender','number','url'].includes(name)?'required':''}>${hint?`<small>${esc(hint)}</small>`:''}</label>`;
  function configure(card,x){
    let box=card.querySelector('[data-im-config]');if(box){box.hidden=!box.hidden;return;}
    box=document.createElement('section');box.dataset.imConfig=x.provider;box.className='connection-config';
    if(x.provider==='website')box.innerHTML=`<h3>Connect your website</h3><form data-im-website>${field('Website address','url','url')}<button type="submit">Save website address</button></form><div data-im-website-proof></div>`;
    else box.innerHTML=`<h3>Workspace-owned email & SMS</h3><p>Keys are stored encrypted and are never shown again. A provider account password is not an API key.</p><details><summary>Connect business email with Resend</summary><form data-im-credentials="email">${field('Resend API key','api_key','password','Use a key authorised to read verified domains and send email.')}${field('Verified sender email','sender','email')}${field('Resend webhook signing secret (optional)','webhook_secret','password','Needed for signed inbound email and delivery receipts.')}<button type="submit">Verify and save email</button></form></details><details><summary>Connect SMS with Telnyx</summary><form data-im-credentials="sms">${field('Telnyx API key','api_key','password')}${field('Your Telnyx number','number','tel','Use international format, for example +61412345678.')}${field('Telnyx webhook public key (optional)','public_key','text','Needed to verify inbound SMS and delivery signatures.')}<button type="submit">Verify and save SMS</button></form></details><p>Set your provider webhook to the workspace-specific address shown after saving. Provider delivery charges remain with that provider.</p><div data-im-webhook></div>`;
    card.append(box);updateInstructions(card,x);
  }
  function updateInstructions(card,x){
    const proof=card.querySelector('[data-im-website-proof]');
    if(proof&&x.website){proof.innerHTML=`<p>Add this TXT record in your domain dashboard, then choose Verify website:</p><dl><dt>Name</dt><dd><code>${esc(x.website.verification_name)}</code></dd><dt>Value</dt><dd><code>${esc(x.website.verification_value)}</code></dd><dt>Status</dt><dd>${x.website.verified?'Ownership verified':'Waiting for verification'}</dd></dl>${x.website.verified?`<p>Use this workspace’s form endpoint with name, email or phone, and message fields:</p><code>${esc(location.origin+x.form_action)}</code><p>Recorded enquiries appear in the Unified Inbox. This is not a page-view tracking script.</p><button type="button" class="secondary-button" data-im-form-code>Get ready-made form</button><div data-im-form-box></div><button type="button" class="secondary-button" data-im-visit-script>Get visit counter</button><button type="button" class="secondary-button" data-im-visits>Show visit counts</button><div data-im-visit-box></div>`:''}`;}
    const hooks=card.querySelector('[data-im-webhook]');
    if(hooks&&x.transport){const org=window.GDS_SESSION?.organisation?.id;hooks.innerHTML=`<p>Signed provider webhook endpoints:</p><p>Email: <code>${esc(location.origin+'/api/webhooks/communications/resend/'+org)}</code></p><p>SMS: <code>${esc(location.origin+'/api/webhooks/communications/telnyx/'+org)}</code></p><p>Configure these in the provider dashboard. Inbound mail requires Resend Receiving for the connected domain; it does not sync an existing Gmail/Outlook inbox.</p>`;}
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest?.('[data-im-form-code]');if(!b)return;
    const box=b.parentElement.querySelector('[data-im-form-box]');b.disabled=true;
    try{const d=await api('/api/saas/website/contact-form');box.innerHTML=`<p>${esc(d.note)}</p><label>Form code<textarea readonly rows="10" data-im-form-html></textarea></label><button type="button" class="secondary-button" data-im-form-copy>Copy form code</button>`;box.querySelector('[data-im-form-html]').value=d.html;}
    catch(err){box.textContent=err.message||'The form code is not available yet.';}
    finally{b.disabled=false;}
  });
  document.addEventListener('click',async e=>{
    const b=e.target.closest?.('[data-im-visit-script],[data-im-visits]');if(!b)return;
    const box=b.parentElement.querySelector('[data-im-visit-box]');b.disabled=true;
    try{
      if(b.hasAttribute('data-im-visit-script')){const d=await api('/api/saas/website/visit-script');box.innerHTML=`<p>${esc(d.note)}</p><label>Visit counter code<textarea readonly rows="4" data-im-form-html></textarea></label><button type="button" class="secondary-button" data-im-form-copy>Copy code</button>`;box.querySelector('[data-im-form-html]').value=d.html;}
      else{const d=await api('/api/saas/website/visits?days=30');const list=(rows,empty)=>rows.length?`<ol>${rows.map(r=>`<li>${esc(r.key)} <strong>${Number(r.visits).toLocaleString()}</strong></li>`).join('')}</ol>`:`<p>${empty}</p>`;
        box.innerHTML=`<p><strong>${Number(d.total).toLocaleString()}</strong> page visits in the last ${d.days} days.</p><h4>Top pages</h4>${list(d.pages,'No visits counted yet.')}<h4>Where visitors came from</h4>${list(d.sources,'No visits counted yet.')}<p><small>${esc(d.note)}</small></p>`;}
    }catch(err){box.textContent=err.message||'Visit counts are not available yet.';}
    finally{b.disabled=false;}
  });
  document.addEventListener('click',async e=>{
    const b=e.target.closest?.('[data-im-form-copy]');if(!b)return;
    const t=b.parentElement.querySelector('[data-im-form-html]');try{await navigator.clipboard.writeText(t.value);b.textContent='Copied';}catch{t.select();b.textContent='Select and copy';}
  });
  function announce(card,text,error=false){const p=card.querySelector('.connection-action-result');if(p){p.textContent=text;p.classList.toggle('connection-error',error);}}
  document.addEventListener('change',e=>{
    if(!e.target.matches('[data-im-resource]'))return;
    const card=e.target.closest('[data-provider-card]');pendingSelections.set(card.dataset.providerCard,[...card.querySelectorAll('[data-im-resource]:checked')].map(i=>i.dataset.imResource));
  });
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-connect-provider],[data-im-test],[data-im-save],[data-im-disconnect],[data-im-insights],[data-im-diagnose],[data-im-confirm]');if(!b)return;
    const card=b.closest('[data-provider-card]');if(!card)return;
    const provider=card.dataset.providerCard,x=records.get(provider);if(!x)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(b.hasAttribute('data-connect-provider')&&x.connection_mode!=='oauth'&&['website','email_sms'].includes(provider)){configure(card,x);return;}
    if(b.hasAttribute('data-connect-provider')&&!x.provider_ready){const box=card.querySelector('[data-im-requirements]');box.hidden=!box.hidden;return;}
    if(b.hasAttribute('data-im-switch')&&!confirm('Switch to a different account? Sign in with the other account on the next page. If your browser is already signed in to the wrong account there, sign out of it first. Your current connection stays until the new sign-in finishes.'))return;
    if(b.hasAttribute('data-im-disconnect')&&!confirm('Disconnect this provider from this workspace? Stored authorisation will be removed and connected actions will stop.'))return;
    const original=b.textContent;b.disabled=true;b.textContent='Working…';announce(card,'');
    try{
      if(b.hasAttribute('data-im-diagnose')){
        const d=await api('/api/saas/integrations/self-service/'+provider+'/diagnostics');let box=card.querySelector('[data-im-assistant]');if(!box){box=document.createElement('section');box.dataset.imAssistant=provider;card.append(box);}
        box.innerHTML=`<h3>Connection assistant</h3><p>Guided checks based on this workspace’s connection state.</p>${diagnosticHtml(d.diagnostic)}<ol>${d.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p>${esc(d.note)}</p>`;return;
      }
      if(b.hasAttribute('data-connect-provider')){const d=await api('/api/saas/integrations/self-service/'+provider+'/authorise',{method:'POST',body:JSON.stringify(b.hasAttribute('data-im-switch')?{switch_account:true}:{})});if(d.authorize_url){location.assign(d.authorize_url);return;}}
      else if(b.hasAttribute('data-im-confirm'))await api('/api/saas/integrations/self-service/'+provider+'/confirm',{method:'POST',body:'{}'});
      else if(b.hasAttribute('data-im-test'))await api('/api/saas/integrations/self-service/'+provider+'/test',{method:'POST',body:'{}'});
      else if(b.hasAttribute('data-im-insights'))await api('/api/saas/integrations/self-service/'+provider+'/insights',{method:'POST',body:'{}'});
      else if(b.hasAttribute('data-im-save')){const resource_ids=[...card.querySelectorAll('[data-im-resource]:checked')].map(i=>i.dataset.imResource);await api('/api/saas/integrations/self-service/'+provider+'/resources',{method:'POST',body:JSON.stringify({resource_ids})});pendingSelections.delete(provider);}
      else if(b.hasAttribute('data-im-disconnect'))await api('/api/saas/integrations/self-service/'+provider,{method:'DELETE'});
      await render();const fresh=document.querySelector(`[data-provider-card="${CSS.escape(provider)}"]`);announce(fresh,'Connection information updated.');updateInstructions(fresh,records.get(provider));
    }catch(error){announce(card,error.message+(error.data?.diagnostic?.reference?' Reference: '+error.data.diagnostic.reference:''),true);}
    finally{if(b.isConnected){b.disabled=false;b.textContent=original;}}
  },true);
  // Own developer app keys: loaded when opened; the secret field is write-only and cleared after saving.
  async function paintOwnApp(details){
    const provider=details.dataset.imApp,box=details.querySelector('[data-im-app-box]');
    try{
      const k=await api('/api/saas/integrations/self-service/'+encodeURIComponent(provider)+'/app-keys'),off=k.can_manage?'':'disabled';
      const inUse={own:'Your own app ('+(k.client_id_hint||'saved')+')',oprun:'Oprun’s app',none:'No app yet: add your own keys below'}[k.in_use]||'';
      box.innerHTML=`<p>Most businesses do not need this. Use it if you prefer your own ${esc(k.label)} developer app instead of Oprun’s. One set of keys covers: ${esc(k.providers.join(', '))}.</p><p><b>In use now:</b> ${esc(inUse)}</p><ol><li>Create or open your app: ${esc(k.where)}.</li><li>Add this exact redirect / callback address to the app: <code>${esc(k.callback_url||'Not available: the callback address is not set up yet')}</code></li><li>Paste the ${esc(k.id_name)} and ${esc(k.secret_name)} below, save, then choose Connect.</li></ol><form data-im-app-form><label>${esc(k.id_name)}<input name="client_id" autocomplete="off" required maxlength="200" ${off}></label><label>${esc(k.secret_name)}<input name="client_secret" type="password" autocomplete="new-password" required minlength="16" maxlength="300" ${off}></label><p class="connection-note">The secret is stored encrypted and is never shown again. Changing or removing keys signs out connections made with different keys.</p><div class="integration-manager-actions"><button type="submit" ${off}>Save my app keys</button>${k.own_app?`<button type="button" data-im-app-remove ${off}>Remove my keys</button>`:''}</div></form>`;
    }catch(error){box.textContent=error.message;}
  }
  document.addEventListener('toggle',e=>{const d=e.target;if(d.matches?.('[data-im-app]')&&d.open)paintOwnApp(d);},true);
  document.addEventListener('submit',async e=>{
    const form=e.target;if(!form.matches('[data-im-app-form]'))return;
    e.preventDefault();const details=form.closest('[data-im-app]'),card=form.closest('[data-provider-card]'),provider=details.dataset.imApp,b=form.querySelector('button[type=submit]');b.disabled=true;
    try{const d=await api('/api/saas/integrations/self-service/'+encodeURIComponent(provider)+'/app-keys',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();
      await render();const fresh=document.querySelector(`[data-provider-card="${CSS.escape(provider)}"]`);announce(fresh,'Your app keys are saved.'+(d.signed_out?.length?' Signed out: '+d.signed_out.join(', ')+'. Connect again.':' Choose Connect to sign in.'));}
    catch(error){announce(card,error.message,true);}finally{if(b.isConnected)b.disabled=false;}
  });
  document.addEventListener('click',async e=>{
    const b=e.target.closest?.('[data-im-app-remove]');if(!b)return;
    const details=b.closest('[data-im-app]'),provider=details.dataset.imApp,card=b.closest('[data-provider-card]');
    if(!confirm('Remove your own app keys? Connections made with them are signed out, and Oprun’s app is used again if available.'))return;
    b.disabled=true;try{const d=await api('/api/saas/integrations/self-service/'+encodeURIComponent(provider)+'/app-keys',{method:'DELETE'});await render();const fresh=document.querySelector(`[data-provider-card="${CSS.escape(provider)}"]`);announce(fresh,'Your app keys were removed.'+(d.signed_out?.length?' Signed out: '+d.signed_out.join(', ')+'.':''));}
    catch(error){announce(card,error.message,true);b.disabled=false;}
  });
  document.addEventListener('submit',async e=>{
    const form=e.target;if(!form.matches('[data-im-credentials],[data-im-website]'))return;
    e.preventDefault();const card=form.closest('[data-provider-card]'),provider=card.dataset.providerCard,b=form.querySelector('button[type=submit]');b.disabled=true;
    try{
      const values=Object.fromEntries(new FormData(form));
      const endpoint=provider==='website'?'configure':'credentials';if(provider==='email_sms')values.kind=form.dataset.imCredentials;
      await api('/api/saas/integrations/self-service/'+provider+'/'+endpoint,{method:'POST',body:JSON.stringify(values)});
      form.reset();form.dispatchEvent(new Event('superpro:form-saved',{bubbles:true}));
      await render();updateInstructions(card,records.get(provider));announce(card,provider==='website'?'Website saved. Complete ownership verification next.':'Provider verified and saved. Configure signed webhooks for inbound messages and receipts.');
    }catch(error){announce(card,error.message,true);}finally{b.disabled=false;}
  });
  const onView=e=>{if(e.detail?.view==='integrations')render();};window.addEventListener('gds:viewchange',onView);
  window.SuperProIntegrationManager={render,enhance:render};
})();
