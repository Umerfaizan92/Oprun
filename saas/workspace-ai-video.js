// T-185: AI Video Generator inside Media Studio.
// Idea -> AI-written director's prompt -> the business's own Google (Gemini Omni) or Runway (Gen-4.5, Veo 3.1,
// Kling 4.0, Seedance 2.5) account renders it -> the MP4 is saved into the private media library and plays here.
(()=>{
  const {el,api,onView,role,note}=window.SuperProUI;
  const $=s=>document.querySelector(s);
  const OWNERS=['owner','admin','super_admin'];
  let loaded=false,state={providers:{},engines:[],jobs:[]},photos=[],timer=null,shape='9:16',connecting=null,mounted=false,busy=false;
  const ago=iso=>{const s=Math.max(0,Math.round((Date.now()-Date.parse(iso))/1000));return s<60?`${s}s`:`${Math.floor(s/60)} min ${s%60}s`};
  const engine=()=>state.engines.find(e=>e.id===$('#aiv-engine')?.value)||state.engines[0];

  function mount(){
    if(mounted)return true;
    const lib=$('#video-view .source-library-panel');if(!lib)return false;
    const panel=el('article',{class:'panel aiv-panel',id:'ai-video-panel','aria-labelledby':'aiv-title'},
      el('div',{class:'panel-head'},el('div',{},el('span',{class:'panel-kicker',text:'AI VIDEO GENERATOR'}),el('h2',{id:'aiv-title',text:'Make a video from an idea'}),
        el('p',{text:'Describe what you want. AI writes a director-level prompt, a leading video model renders it, and the finished video lands in your library to preview, download or use in posts and campaigns.'})),
        el('span',{class:'ai-live-chip',text:'AI assisted'})),
      el('div',{class:'aiv-providers',id:'aiv-providers'}),
      el('div',{class:'aiv-connect',id:'aiv-connect',hidden:true}),
      el('form',{class:'aiv-form',id:'aiv-form',novalidate:true},
        el('label',{class:'aiv-full'},el('span',{text:'1. Your idea'}),el('textarea',{id:'aiv-idea',rows:'2',maxlength:'2000',placeholder:'Example: before-and-after of a leaking kitchen tap we fixed, ending on a happy customer.'})),
        el('div',{class:'aiv-full aiv-row'},el('button',{type:'button',class:'secondary-button',id:'aiv-enhance',text:'Write the prompt with AI'}),el('small',{class:'muted',id:'aiv-enhance-note',text:'AI adds camera, lighting, pacing and mood. You can edit the result.'})),
        el('label',{class:'aiv-full'},el('span',{text:'2. Director’s prompt'}),el('textarea',{id:'aiv-prompt',rows:'5',maxlength:'2000',placeholder:'The full prompt sent to the video model. Write it yourself or let AI write it from your idea.'})),
        el('label',{},el('span',{text:'Video model'}),el('select',{id:'aiv-engine'})),
        el('div',{class:'aiv-field'},el('span',{class:'aiv-label',text:'Shape'}),el('div',{class:'aiv-seg',role:'radiogroup','aria-label':'Shape'},
          ...[['9:16','Vertical 9:16','Reels, TikTok, Shorts'],['16:9','Wide 16:9','YouTube, website']].map(([v,l,h])=>el('button',{type:'button',role:'radio','data-shape':v,'aria-checked':String(v===shape),title:h,text:l})))),
        el('label',{},el('span',{text:'Length'}),el('select',{id:'aiv-duration'})),
        el('label',{},el('span',{text:'Quality'}),el('select',{id:'aiv-resolution'})),
        el('label',{class:'aiv-full'},el('span',{text:'Starting photo (optional)'}),el('select',{id:'aiv-photo'},el('option',{value:'',text:'None: make it from the prompt only'}))),
        el('div',{class:'aiv-full aiv-row'},el('button',{type:'submit',class:'primary-button',id:'aiv-generate',text:'Generate video'}),el('small',{class:'muted',id:'aiv-cost',text:''}))),
      el('div',{class:'aiv-jobs-head'},el('h3',{text:'Your AI videos'}),el('small',{class:'muted',text:'Videos keep rendering if you leave this page. You get a notification when each one is ready.'})),
      el('div',{class:'aiv-jobs',id:'aiv-jobs'}));
    lib.after(panel);
    $('#aiv-engine').addEventListener('change',fit);
    panel.querySelectorAll('[data-shape]').forEach(b=>b.addEventListener('click',()=>{shape=b.dataset.shape;panel.querySelectorAll('[data-shape]').forEach(x=>x.setAttribute('aria-checked',String(x===b)))}));
    $('#aiv-enhance').addEventListener('click',enhance);
    $('#aiv-form').addEventListener('submit',e=>{e.preventDefault();generate()});
    mounted=true;return true;
  }

  function drawProviders(){
    const host=$('#aiv-providers');if(!host)return;const canKey=OWNERS.includes(role());
    host.replaceChildren(...Object.entries(state.providers).map(([id,p])=>el('div',{class:'aiv-provider'+(p.connected?' on':'')},
      el('div',{},el('b',{text:p.label}),el('small',{text:p.connected?`Connected · key ${p.key_hint||''}`:'Not connected'+(p.problem?'':'')})),
      p.problem&&p.connected?el('small',{class:'aiv-problem',text:`Last problem: ${p.problem}`}):null,
      canKey?(p.connected?el('button',{type:'button',class:'secondary-button',text:'Disconnect',onclick:()=>disconnect(id,p)}):el('button',{type:'button',class:'secondary-button',text:'Connect',onclick:()=>openConnect(id)})):null)));
    if(!Object.values(state.providers).some(p=>p.connected))host.append(el('p',{class:'aiv-hint',text:canKey?'Connect at least one provider with your own API key. You pay the provider directly for each video; Oprun adds no charge.':'Ask the business owner or an admin to connect a video provider.'}));
  }
  function openConnect(id){
    const p=state.providers[id],box=$('#aiv-connect');connecting=id;box.hidden=false;
    const input=el('input',{type:'password',id:'aiv-key',autocomplete:'off',spellcheck:'false',placeholder:'Paste your API key','aria-label':`${p.label} API key`});
    box.replaceChildren(el('form',{class:'aiv-connect-form',onsubmit:async e=>{e.preventDefault();const btn=e.target.querySelector('[type=submit]');btn.disabled=true;
      try{const r=await api(`/api/saas/ai-video/providers/${id}`,{method:'POST',body:JSON.stringify({api_key:input.value.trim()})});state.providers=r.providers;input.value='';box.hidden=true;note(`${p.label} connected.`);await load()}catch(x){note(x.message,true)}finally{btn.disabled=false}}},
      el('b',{text:`Connect ${p.label}`}),el('p',{class:'muted',text:p.key_help}),
      el('a',{href:p.key_url,target:'_blank',rel:'noopener noreferrer',text:'Get a key from the provider ↗'}),
      el('div',{class:'aiv-row'},input,el('button',{type:'submit',class:'primary-button',text:'Check and save'}),el('button',{type:'button',class:'secondary-button',text:'Cancel',onclick:()=>{box.hidden=true;connecting=null}})),
      el('small',{class:'muted',text:'The key is checked with the provider, stored encrypted, and never shown again.'})));
    input.focus();
  }
  async function disconnect(id,p){if(!confirm(`Disconnect ${p.label}? Videos already made stay in your library.`))return;try{const r=await api(`/api/saas/ai-video/providers/${id}`,{method:'DELETE'});state.providers=r.providers;await load()}catch(x){note(x.message,true)}}

  function drawEngines(){
    const sel=$('#aiv-engine');if(!sel)return;const keep=sel.value;
    sel.replaceChildren(...state.engines.map(e=>el('option',{value:e.id,text:`${e.label}${e.ready?'':' (connect key)'} — ${e.note}`,disabled:!e.ready})));
    const pick=state.engines.find(e=>e.id===keep&&e.ready)||state.engines.find(e=>e.ready)||state.engines[0];if(pick)sel.value=pick.id;fit();
  }
  function fit(){
    const e=engine();if(!e)return;
    const d=$('#aiv-duration'),keep=Number(d.value)||8;
    const lengths=[...new Set([e.min,4,5,6,8,10,12,15,e.max])].filter(n=>n>=e.min&&n<=e.max).sort((a,b)=>a-b);
    d.replaceChildren(...lengths.map(n=>el('option',{value:String(n),text:`${n} seconds`})));d.value=String(lengths.includes(keep)?keep:lengths.reduce((a,b)=>Math.abs(b-8)<Math.abs(a-8)?b:a));
    const r=$('#aiv-resolution'),rk=r.value;
    r.replaceChildren(...e.res.map(v=>el('option',{value:v,text:v==='4k'?'4K Ultra HD':v==='1080p'?'1080p Full HD':'720p HD'})));r.value=e.res.includes(rk)?rk:(e.res.includes('1080p')?'1080p':e.res[0]);
    $('#aiv-photo').disabled=!e.image;
    const ready=e.ready;$('#aiv-generate').disabled=!ready||busy;
    $('#aiv-cost').textContent=ready?`Rendered and billed by ${state.providers[e.provider]?.label}. Usually 1–4 minutes.`:`Connect ${state.providers[e.provider]?.label||'the provider'} to use this model.`;
  }
  function drawPhotos(){
    const sel=$('#aiv-photo');if(!sel)return;const keep=sel.value;
    sel.replaceChildren(el('option',{value:'',text:'None: make it from the prompt only'}),...photos.map(p=>el('option',{value:p.id,text:p.original_name})));
    if(photos.some(p=>p.id===keep))sel.value=keep;
  }

  function jobCard(j){
    const status={running:'Rendering',queued:'Starting',succeeded:'Ready',failed:'Failed'}[j.status]||j.status;
    const body=[];
    if(j.status==='succeeded'&&j.media_id){
      const item={id:j.media_id,kind:'video',original_name:`AI video – ${(j.idea||j.prompt).slice(0,60)}.mp4`};
      body.push(el('div',{class:'aiv-player','data-shape':j.aspect_ratio},el('video',{src:`/api/saas/media/${encodeURIComponent(j.media_id)}/file`,controls:true,playsinline:true,preload:'metadata','aria-label':'Generated video'})),
        el('div',{class:'aiv-actions'},
          el('button',{type:'button',class:'secondary-button',text:'Full preview',onclick:()=>window.OprunMediaViewer?.open([item],0,{onUse:m=>window.dispatchEvent(new CustomEvent('oprun:media-pick',{detail:{id:m.id}}))})}),
          el('button',{type:'button',class:'secondary-button',text:'Use in render',onclick:()=>window.dispatchEvent(new CustomEvent('oprun:media-pick',{detail:{id:j.media_id}}))}),
          el('a',{class:'secondary-button',href:`/api/saas/media/${encodeURIComponent(j.media_id)}/file`,download:item.original_name,text:'Download'}),
          el('button',{type:'button',class:'link-button',text:'Clear',onclick:()=>clear(j)})));
    }else if(j.status==='failed'){
      body.push(el('p',{class:'aiv-error',role:'alert',text:j.error||'The provider could not make this video.'}),
        el('div',{class:'aiv-actions'},el('button',{type:'button',class:'secondary-button',text:'Edit and try again',onclick:()=>retry(j)}),el('button',{type:'button',class:'link-button',text:'Clear',onclick:()=>clear(j)})));
    }else body.push(el('p',{class:'aiv-wait',text:`Rendering for ${ago(j.created_at)}. Usually 1–4 minutes; longer videos and 4K take more time.`}));
    return el('article',{class:`aiv-job ${j.status}`,'data-job':j.id},
      el('header',{},el('div',{},el('b',{text:j.engine_label}),el('small',{text:`${j.aspect_ratio} · ${j.duration}s · ${j.resolution}`})),el('span',{class:'aiv-status','data-status':j.status,text:status})),
      el('p',{class:'aiv-prompt',text:j.prompt}),...body);
  }
  function drawJobs(){
    const host=$('#aiv-jobs');if(!host)return;
    // Keep players that are already showing so a refresh never interrupts a video someone is watching.
    const existing=new Map([...host.querySelectorAll('[data-job]')].map(n=>[n.dataset.job,n]));
    if(!state.jobs.length){host.replaceChildren(el('div',{class:'empty-state'},el('b',{text:'No AI videos yet'}),el('span',{text:'Write an idea above and press Generate video.'})));return}
    host.replaceChildren(...state.jobs.map(j=>{const old=existing.get(j.id);return old&&old.classList.contains(j.status)&&j.status!=='running'?old:jobCard(j)}));
  }

  async function enhance(){
    const idea=$('#aiv-idea').value.trim();if(idea.length<3){note('Write your idea first, in a few words.',true);$('#aiv-idea').focus();return}
    const b=$('#aiv-enhance');b.disabled=true;b.textContent='Writing…';
    try{const r=await api('/api/saas/ai-video/enhance',{method:'POST',body:JSON.stringify({idea,aspect_ratio:shape,duration:Number($('#aiv-duration').value)||8})});$('#aiv-prompt').value=r.prompt;
      $('#aiv-enhance-note').textContent=r.source==='ai'?'AI wrote this prompt. Read it and change anything before generating.':'A ready-made structure was used because the AI writer is not available. Edit it to match your idea.'}
    catch(x){note(x.message,true)}finally{b.disabled=false;b.textContent='Write the prompt with AI'}
  }
  async function generate(){
    const e=engine();if(!e?.ready){note('Connect a video provider first.',true);return}
    let prompt=$('#aiv-prompt').value.trim();const idea=$('#aiv-idea').value.trim();
    if(prompt.length<10&&idea.length>=10)prompt=idea;
    if(prompt.length<10){note('Write your idea and press “Write the prompt with AI”, or write the prompt yourself.',true);$('#aiv-idea').focus();return}
    const body={engine:e.id,prompt,aspect_ratio:shape,resolution:$('#aiv-resolution').value,duration:Number($('#aiv-duration').value)};
    if(idea)body.idea=idea;const photo=e.image&&$('#aiv-photo').value;if(photo)body.source_media_id=photo;
    busy=true;const b=$('#aiv-generate');b.disabled=true;b.textContent='Starting…';
    try{await api('/api/saas/ai-video/jobs',{method:'POST',body:JSON.stringify(body)});note('Your video is rendering. It will appear below when ready.');await load()}
    catch(x){note(x.message,true)}finally{busy=false;b.textContent='Generate video';fit()}
  }
  function retry(j){
    $('#aiv-idea').value=j.idea||'';$('#aiv-prompt').value=j.prompt;shape=j.aspect_ratio;
    document.querySelectorAll('#ai-video-panel [data-shape]').forEach(x=>x.setAttribute('aria-checked',String(x.dataset.shape===shape)));
    const e=state.engines.find(x=>x.id===j.engine&&x.ready);if(e){$('#aiv-engine').value=e.id;fit();$('#aiv-duration').value=String(j.duration);if(e.res.includes(j.resolution))$('#aiv-resolution').value=j.resolution}
    if(j.source_media_id&&photos.some(p=>p.id===j.source_media_id))$('#aiv-photo').value=j.source_media_id;
    $('#aiv-prompt').focus();$('#aiv-form').scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function clear(j){try{await api(`/api/saas/ai-video/jobs/${j.id}`,{method:'DELETE'});await load()}catch(x){note(x.message,true)}}

  async function load(){
    if(!mount())return;
    const before=new Set(state.jobs.filter(j=>j.status==='succeeded').map(j=>j.id));
    try{state=await api('/api/saas/ai-video')}catch{return}
    try{photos=((await api('/api/saas/media')).media||[]).filter(m=>m.kind==='photo'&&/^image\/(jpeg|png|webp)$/.test(m.mime_type))}catch{photos=[]}
    drawProviders();drawEngines();drawPhotos();drawJobs();
    if(loaded&&state.jobs.some(j=>j.status==='succeeded'&&!before.has(j.id)))window.dispatchEvent(new Event('oprun:media-changed'));loaded=true;
    schedule();
  }
  function schedule(){
    clearTimeout(timer);timer=null;
    if(!state.jobs.some(j=>j.status==='running'||j.status==='queued'))return;
    timer=setTimeout(async()=>{
      if(!$('#ai-video-panel')?.isConnected||$('#video-view')?.hidden)return;
      await Promise.all(state.jobs.filter(j=>j.status==='running').map(j=>api(`/api/saas/ai-video/jobs/${j.id}/refresh`,{method:'POST'}).catch(()=>null)));
      await load();
    },8000);
  }
  onView('video',{enter:load,leave:()=>{clearTimeout(timer);timer=null}});
})();
