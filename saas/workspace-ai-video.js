// T-185: AI Video Generator inside Media Studio.
// Idea -> AI-written director's prompt -> the business's own Google (Gemini Omni) or Runway (Gen-4.5, Veo 3.1,
// Kling 4.0, Seedance 2.5) account renders it -> the MP4 is saved into the private media library and plays here.
// T-190: videos up to 10 minutes (made as continuing clips and joined), guided by the business's own photos and
// videos (upload from any device, the library, or record with the camera), with a voice-over in the person's own
// voice: a recording they make, or a script read in their cloned voice (their own ElevenLabs account).
(()=>{
  const {el,api,onView,role,note}=window.SuperProUI;
  const $=s=>document.querySelector(s);
  const OWNERS=['owner','admin','super_admin'];
  let loaded=false,state={providers:{},engines:[],jobs:[],projects:[],voices:[]},library=[],timer=null,shape='9:16',mounted=false,busy=false;
  let picker=null,voiceMode='none',narrationId=null,dictation=null;
  const ago=iso=>{const s=Math.max(0,Math.round((Date.now()-Date.parse(iso))/1000));return s<60?`${s}s`:`${Math.floor(s/60)} min ${s%60}s`};
  const secs=n=>n<60?`${n} seconds`:n%60?`${Math.floor(n/60)} min ${n%60}s`:`${n/60} minute${n===60?'':'s'}`;
  const engine=()=>state.engines.find(e=>e.id===$('#aiv-engine')?.value)||state.engines[0];
  const headers=()=>window.SuperProWorkspaceContext?.headers?.()||{};
  async function uploadBlob(blob,name){
    const fd=new FormData();fd.append('files',new File([blob],name,{type:blob.type.split(';')[0]}));
    const r=await fetch('/api/saas/media',{method:'POST',credentials:'same-origin',headers:headers(),body:fd});const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ids?.[0])throw new Error(d.error||'The recording could not be saved.');return d.ids[0];
  }
  const stamp=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}.${z(d.getMinutes())}`};
  const pickType=(list)=>list.find(t=>window.MediaRecorder?.isTypeSupported?.(t))||'';

  function mount(){
    if(mounted)return true;
    const lib=$('#video-view .source-library-panel');if(!lib)return false;
    const seg=(name,items,cur,on)=>el('div',{class:'aiv-seg',role:'radiogroup','aria-label':name},...items.map(([v,l,h])=>el('button',{type:'button',role:'radio','data-v':v,'aria-checked':String(v===cur),title:h||'',text:l,onclick:e=>{e.currentTarget.parentElement.querySelectorAll('[data-v]').forEach(x=>x.setAttribute('aria-checked',String(x===e.currentTarget)));on(v)}})));
    const panel=el('article',{class:'panel aiv-panel',id:'ai-video-panel','aria-labelledby':'aiv-title'},
      el('div',{class:'panel-head'},el('div',{},el('span',{class:'panel-kicker',text:'AI VIDEO GENERATOR'}),el('h2',{id:'aiv-title',text:'Make a video from an idea'}),
        el('p',{text:'Describe what you want, add your own photos or videos and your own voice if you like. AI writes the shots, a leading video model renders them, and the finished video lands in your library to preview, download or use in posts and campaigns.'})),
        el('span',{class:'ai-live-chip',text:'AI assisted'})),
      el('div',{class:'aiv-providers',id:'aiv-providers'}),
      el('div',{class:'aiv-connect',id:'aiv-connect',hidden:true}),
      el('form',{class:'aiv-form',id:'aiv-form',novalidate:true},
        el('div',{class:'aiv-full aiv-dictation',id:'aiv-dictation'}),
        el('label',{class:'aiv-full'},el('span',{text:'1. Your idea'}),el('textarea',{id:'aiv-idea',rows:'2',maxlength:'2000',placeholder:'Example: me explaining how we polish a bull bar, then a close-up of the mirror finish.'})),
        el('div',{class:'aiv-full aiv-row'},el('button',{type:'button',class:'secondary-button',id:'aiv-enhance',text:'Write the prompt with AI'}),el('small',{class:'muted',id:'aiv-enhance-note',text:'AI adds camera, lighting, pacing and mood. You can edit the result.'})),
        el('label',{class:'aiv-full'},el('span',{text:'2. Director’s prompt'}),el('textarea',{id:'aiv-prompt',rows:'5',maxlength:'4000',placeholder:'The full prompt sent to the video model. Write it yourself or let AI write it from your idea. Long videos are split into shots automatically.'})),
        el('div',{class:'aiv-full aiv-field'},el('span',{class:'aiv-label',text:'3. Your photos or videos (optional, up to 3)'}),
          el('small',{class:'muted',text:'A clear photo of a face keeps the same person in every shot; a product photo keeps your product. Upload from this phone or computer, choose from your library, or record with your camera.'}),
          el('div',{id:'aiv-guides'}),
          el('div',{class:'aiv-row'},el('button',{type:'button',class:'secondary-button',id:'aiv-camera',text:'Record with camera'}))),
        el('label',{},el('span',{text:'Video model'}),el('select',{id:'aiv-engine'})),
        el('div',{class:'aiv-field'},el('span',{class:'aiv-label',text:'Shape'}),
          seg('Shape',[['9:16','Vertical 9:16','Reels, TikTok, Shorts'],['16:9','Wide 16:9','YouTube, website']],shape,v=>{shape=v})),
        el('label',{},el('span',{text:'Length'}),el('select',{id:'aiv-duration'})),
        el('label',{},el('span',{text:'Quality'}),el('select',{id:'aiv-resolution'})),
        el('fieldset',{class:'aiv-full aiv-voice'},el('legend',{text:'4. Voice-over (optional)'}),
          seg('Voice-over',[['none','None'],['record','Record my voice'],['library','From my library'],['script','Script in my voice']],'none',v=>{voiceMode=v;drawVoice()}),
          el('div',{id:'aiv-voice-body'}),
          el('label',{class:'aiv-check'},el('input',{type:'checkbox',id:'aiv-keep'}),el('span',{text:'Keep the video’s own sound quietly under my voice'}))),
        el('p',{class:'aiv-full aiv-plan',id:'aiv-plan',role:'status'}),
        el('div',{class:'aiv-full aiv-row'},el('button',{type:'submit',class:'primary-button',id:'aiv-generate',text:'Generate video'}),el('small',{class:'muted',id:'aiv-cost',text:''}))),
      el('div',{class:'aiv-jobs-head'},el('h3',{text:'Your AI videos'}),el('small',{class:'muted',text:'Videos keep rendering if you leave this page. You get a notification when each one is ready.'})),
      el('div',{class:'aiv-jobs',id:'aiv-jobs'}));
    lib.after(panel);
    $('#aiv-engine').addEventListener('change',fit);$('#aiv-duration').addEventListener('change',plan);
    $('#aiv-enhance').addEventListener('click',enhance);$('#aiv-camera').addEventListener('click',openCamera);
    $('#aiv-form').addEventListener('submit',e=>{e.preventDefault();generate()});
    dictation=window.OprunVideoDictation?.create($('#aiv-dictation'),{canStart:()=>!busy&&!$('#aiv-enhance').disabled&&!rec});
    dictation?.attach($('#aiv-idea'),'idea');dictation?.attach($('#aiv-prompt'),'prompt');
    setGuides([]);drawVoice();
    mounted=true;return true;
  }
  function setGuides(ids){
    const host=$('#aiv-guides');if(!host||!window.OprunMediaPicker)return;
    const known=ids.map(id=>library.find(m=>m.id===id)).filter(Boolean).map(m=>({id:m.id,kind:m.kind,name:m.original_name}));
    picker=window.OprunMediaPicker.create({selected:known.length?known:ids,label:'Photos and videos to guide the AI',hint:'Up to 3. JPG, PNG or WebP photos, or videos.'});
    host.replaceChildren(picker.element);
  }
  const guides=()=>picker?picker.value():[];

  function drawProviders(){
    const host=$('#aiv-providers');if(!host)return;const canKey=OWNERS.includes(role());
    host.replaceChildren(...Object.entries(state.providers).map(([id,p])=>el('div',{class:'aiv-provider'+(p.connected?' on':'')},
      el('div',{},el('b',{text:p.label}),el('small',{text:p.connected?`Connected · key ${p.key_hint||''}`:(p.kind==='voice'?'Optional: for your own voice':'Not connected')})),
      p.problem&&p.connected?el('small',{class:'aiv-problem',text:`Last problem: ${p.problem}`}):null,
      canKey?(p.connected?el('button',{type:'button',class:'secondary-button',text:'Disconnect',onclick:()=>disconnect(id,p)}):el('button',{type:'button',class:'secondary-button',text:'Connect',onclick:()=>openConnect(id)})):null)));
    if(!Object.entries(state.providers).some(([,p])=>p.connected&&p.kind!=='voice'))host.append(el('p',{class:'aiv-hint',text:canKey?'Connect at least one video provider with your own API key. You pay the provider directly for each video; Oprun adds no charge.':'Ask the business owner or an admin to connect a video provider.'}));
  }
  function openConnect(id){
    const p=state.providers[id],box=$('#aiv-connect');box.hidden=false;
    const input=el('input',{type:'password',id:'aiv-key',autocomplete:'off',spellcheck:'false',placeholder:'Paste your API key','aria-label':`${p.label} API key`});
    box.replaceChildren(el('form',{class:'aiv-connect-form',onsubmit:async e=>{e.preventDefault();const btn=e.target.querySelector('[type=submit]');btn.disabled=true;
      try{const r=await api(`/api/saas/ai-video/providers/${id}`,{method:'POST',body:JSON.stringify({api_key:input.value.trim()})});state.providers=r.providers;input.value='';box.hidden=true;note(`${p.label} connected.`);await load()}catch(x){note(x.message,true)}finally{btn.disabled=false}}},
      el('b',{text:`Connect ${p.label}`}),el('p',{class:'muted',text:p.key_help}),
      el('a',{href:p.key_url,target:'_blank',rel:'noopener noreferrer',text:'Get a key from the provider ↗'}),
      el('div',{class:'aiv-row'},input,el('button',{type:'submit',class:'primary-button',text:'Check and save'}),el('button',{type:'button',class:'secondary-button',text:'Cancel',onclick:()=>{box.hidden=true}})),
      el('small',{class:'muted',text:'The key is checked with the provider, stored encrypted, and never shown again.'})));
    input.focus();box.scrollIntoView({block:'nearest'});
  }
  async function disconnect(id,p){if(!confirm(`Disconnect ${p.label}? Videos already made stay in your library.`))return;try{const r=await api(`/api/saas/ai-video/providers/${id}`,{method:'DELETE'});state.providers=r.providers;await load()}catch(x){note(x.message,true)}}

  function drawEngines(){
    const sel=$('#aiv-engine');if(!sel)return;const keep=sel.value;
    sel.replaceChildren(...state.engines.map(e=>el('option',{value:e.id,text:`${e.label}${e.ready?'':' (connect key)'} — ${e.note}`,disabled:!e.ready})));
    const pick=state.engines.find(e=>e.id===keep&&e.ready)||state.engines.find(e=>e.ready)||state.engines[0];if(pick)sel.value=pick.id;fit();
  }
  function fit(){
    const e=engine();if(!e)return;
    const d=$('#aiv-duration'),keep=d.value||'8',joins=state.joining_available!==false,max=Math.min(state.max_seconds||600,600);
    const short=[...new Set([e.min,4,5,6,8,10,12,15,e.max])].filter(n=>n>=e.min&&n<=e.max).sort((a,b)=>a-b);
    const long=joins?[30,60,120,180,300,600].filter(n=>n>e.max&&n<=max):[];
    d.replaceChildren(...short.map(n=>el('option',{value:String(n),text:secs(n)})),...long.map(n=>el('option',{value:String(n),text:`${secs(n)} (${Math.ceil(n/e.max)} shots)`})),
      joins?el('option',{value:'voice',text:'As long as my voice-over'}):null);
    d.value=[...d.options].some(o=>o.value===keep)?keep:String(short.reduce((a,b)=>Math.abs(b-8)<Math.abs(a-8)?b:a));
    const r=$('#aiv-resolution'),rk=r.value;
    r.replaceChildren(...e.res.map(v=>el('option',{value:v,text:v==='4k'?'4K Ultra HD':v==='1080p'?'1080p Full HD':'720p HD'})));r.value=e.res.includes(rk)?rk:(e.res.includes('1080p')?'1080p':e.res[0]);
    $('#aiv-generate').disabled=!e.ready||busy;
    $('#aiv-cost').textContent=e.ready?`Rendered and billed by ${state.providers[e.provider]?.label}. Each shot usually takes 1–4 minutes.`:`Connect ${state.providers[e.provider]?.label||'the provider'} to use this model.`;
    plan();
  }
  function plan(){
    const e=engine(),v=$('#aiv-duration')?.value,box=$('#aiv-plan');if(!e||!box)return;
    if(v==='voice'){box.textContent='The video will be made as long as your voice-over, in shots of up to '+e.max+' seconds that continue from each other.';return}
    const n=Number(v),shots=Math.ceil(n/e.max);
    box.textContent=shots>1?`${secs(n)} = ${shots} shots of ${e.max} seconds. Each shot continues from the last frame of the one before, then they are joined into one video. The provider bills each shot.`:'';
  }

  // ---------- voice-over ----------
  let rec=null;
  function drawVoice(){
    const host=$('#aiv-voice-body');if(!host)return;$('#aiv-keep').parentElement.hidden=voiceMode==='none';
    if(voiceMode==='none'){narrationId=null;host.replaceChildren();return}
    if(voiceMode==='record'){
      const status=el('p',{class:'aiv-rec-status',role:'status','aria-live':'polite',text:narrationId?'Your recording is ready and will be used.':'Press Record and speak. Press Stop when you finish.'});
      const btn=el('button',{type:'button',class:'secondary-button',text:rec?'Stop':'Record',onclick:()=>rec?stopAudio():recordAudio(status,btn,host)});
      host.replaceChildren(el('div',{class:'aiv-row'},btn),status,narrationId?el('audio',{controls:true,src:`/api/saas/media/${encodeURIComponent(narrationId)}/file`,class:'aiv-audio'}):null);return;
    }
    if(voiceMode==='library'){
      const items=library.filter(m=>m.kind==='audio'||m.kind==='video');
      const sel=el('select',{id:'aiv-narration','aria-label':'Voice-over from your library',onchange:e=>{narrationId=e.target.value||null}},el('option',{value:'',text:items.length?'Choose a recording':'No audio in your library yet'}),...items.map(m=>el('option',{value:m.id,text:`${m.original_name} (${m.kind})`})));
      if(items.some(m=>m.id===narrationId))sel.value=narrationId;else narrationId=null;
      host.replaceChildren(sel);return;
    }
    // Script in my own voice (ElevenLabs).
    narrationId=null;
    const el11=state.providers.elevenlabs;
    if(!el11?.connected){host.replaceChildren(el('p',{class:'aiv-hint',text:'To read a script in your own voice, connect your ElevenLabs account above (owner or admin). Or choose “Record my voice”.'}),OWNERS.includes(role())?el('button',{type:'button',class:'secondary-button',text:'Connect ElevenLabs',onclick:()=>openConnect('elevenlabs')}):null);return}
    const voices=state.voices||[];
    host.replaceChildren(
      el('label',{},el('span',{text:'Script'}),el('textarea',{id:'aiv-script',rows:'4',maxlength:'9000',placeholder:'What you want to say. The video will be as long as this takes to read.'})),
      el('div',{class:'aiv-row'},el('label',{class:'aiv-grow'},el('span',{text:'Voice'}),el('select',{id:'aiv-voice'},...(voices.length?voices.map(v=>el('option',{value:v.id,text:v.name})):[el('option',{value:'',text:'No voice yet: create yours below'})]))),
        el('button',{type:'button',class:'secondary-button',text:'Create my voice',onclick:()=>cloneForm(host)})));
  }
  async function recordAudio(status,btn,host){
    dictation?.cancel();
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      const type=pickType(['audio/webm;codecs=opus','audio/webm','audio/mp4']);const r=new MediaRecorder(stream,type?{mimeType:type}:undefined),chunks=[],started=Date.now();
      rec={r,stream,chunks};btn.textContent='Stop';
      const tick=setInterval(()=>{status.textContent=`Recording… ${secs(Math.round((Date.now()-started)/1000))}`},500);
      r.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      r.onstop=async()=>{clearInterval(tick);stream.getTracks().forEach(t=>t.stop());rec=null;btn.textContent='Record';
        const blob=new Blob(chunks,{type:(r.mimeType||type||'audio/webm').split(';')[0]});if(blob.size<2000){status.textContent='That recording was too short. Try again.';return}
        status.textContent='Saving your recording…';
        try{narrationId=await uploadBlob(blob,`Voice recording ${stamp()}.${blob.type.includes('mp4')?'m4a':'weba'}`);await loadLibrary();drawVoice();window.dispatchEvent(new Event('oprun:media-changed'))}catch(x){status.textContent=x.message}};
      r.start(1000);
    }catch{note('Allow the microphone for this site to record your voice.',true)}
  }
  function stopAudio(){try{rec?.r.stop()}catch{rec=null}}
  function cloneForm(host){
    const audio=library.filter(m=>m.kind==='audio'||m.kind==='video');
    const box=el('div',{class:'aiv-clone'},
      el('b',{text:'Create your voice'}),
      el('p',{class:'muted',text:'Record or choose 30 seconds to 2 minutes of you speaking clearly in a quiet room. ElevenLabs makes a copy of your voice in your own account.'}),
      el('label',{},el('span',{text:'Sample recording'}),el('select',{id:'aiv-sample'},el('option',{value:'',text:audio.length?'Choose a recording':'Record one with “Record my voice” first'}),...audio.map(m=>el('option',{value:m.id,text:m.original_name})))),
      el('label',{},el('span',{text:'Name for this voice'}),el('input',{id:'aiv-voice-name',maxlength:'60',placeholder:'My voice'})),
      el('label',{class:'aiv-check'},el('input',{type:'checkbox',id:'aiv-consent'}),el('span',{text:'This is my own voice, or I have the speaker’s written permission to copy it.'})),
      el('div',{class:'aiv-row'},el('button',{type:'button',class:'primary-button',text:'Create voice',onclick:async e=>{
        const b=e.currentTarget,media=$('#aiv-sample').value,name=$('#aiv-voice-name').value.trim()||'My voice';
        if(!media){note('Choose a recording of your voice.',true);return}if(!$('#aiv-consent').checked){note('Confirm the voice is yours, or that you have permission.',true);return}
        b.disabled=true;b.textContent='Creating…';
        try{await api('/api/saas/ai-video/voices',{method:'POST',body:JSON.stringify({media_id:media,name,consent:true})});note('Your voice is ready.');await load();voiceMode='script';drawVoice()}catch(x){note(x.message,true)}finally{b.disabled=false;b.textContent='Create voice'}}})));
    host.append(box);box.scrollIntoView({block:'nearest'});
  }

  // ---------- camera ----------
  async function openCamera(){
    dictation?.cancel();
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){note('This browser cannot record video. Upload a video instead.',true);return}
    let facing='user',stream=null,recorder=null,chunks=[],blob=null,started=0,tick=null;
    const live=el('video',{class:'aiv-cam-video',playsinline:true,autoplay:true,muted:true,'aria-label':'Camera preview'});live.muted=true;
    const clock=el('span',{class:'aiv-cam-clock',role:'status'});
    const recBtn=el('button',{type:'button',class:'primary-button',text:'Start recording'}),flip=el('button',{type:'button',class:'secondary-button',text:'Switch camera'});
    const use=el('button',{type:'button',class:'primary-button',text:'Use this video',hidden:true}),retake=el('button',{type:'button',class:'secondary-button',text:'Record again',hidden:true});
    const dlg=el('dialog',{class:'aiv-cam','aria-label':'Record a video'},el('header',{},el('b',{text:'Record a video'}),el('button',{type:'button',class:'aiv-cam-x','aria-label':'Close',text:'×',onclick:()=>dlg.close()})),
      el('div',{class:'aiv-cam-stage'},live,clock),el('p',{class:'muted',text:'Up to 3 minutes. Face the light and hold the phone steady.'}),el('div',{class:'aiv-row'},recBtn,flip,retake,use));
    const startCam=async()=>{stream?.getTracks().forEach(t=>t.stop());stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1080},height:{ideal:1920}},audio:true});live.srcObject=stream;live.controls=false;live.muted=true;await live.play().catch(()=>{})};
    const stop=()=>{clearInterval(tick);try{recorder?.state==='recording'&&recorder.stop()}catch{}};
    recBtn.onclick=()=>{
      if(recorder?.state==='recording'){stop();return}
      const type=pickType(['video/mp4;codecs=avc1','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4']);
      chunks=[];recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined);started=Date.now();
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      recorder.onstop=()=>{blob=new Blob(chunks,{type:(recorder.mimeType||type||'video/webm').split(';')[0]});live.srcObject=null;live.src=URL.createObjectURL(blob);live.muted=false;live.controls=true;recBtn.hidden=true;flip.hidden=true;use.hidden=false;retake.hidden=false;clock.textContent=''};
      recorder.start(1000);recBtn.textContent='Stop';
      tick=setInterval(()=>{const s=Math.round((Date.now()-started)/1000);clock.textContent=`● ${secs(s)}`;if(s>=180)stop()},500);
    };
    flip.onclick=async()=>{facing=facing==='user'?'environment':'user';try{await startCam()}catch{note('Could not switch the camera.',true)}};
    retake.onclick=async()=>{URL.revokeObjectURL(live.src);live.removeAttribute('src');blob=null;recBtn.hidden=false;flip.hidden=false;use.hidden=true;retake.hidden=true;recBtn.textContent='Start recording';await startCam().catch(()=>{})};
    use.onclick=async()=>{
      if(!blob)return;use.disabled=true;use.textContent='Saving…';
      try{let id=await uploadBlob(blob,`Camera recording ${stamp()}.${blob.type.includes('mp4')?'mp4':'webm'}`);
        if(!blob.type.includes('mp4')){use.textContent='Making it play on every phone…';id=(await api(`/api/saas/ai-video/media/${id}/mp4`,{method:'POST',body:'{}'})).media_id}
        await loadLibrary();setGuides([...guides().filter(x=>x!==id),id].slice(-3));window.dispatchEvent(new Event('oprun:media-changed'));note('Your video is saved and added as a guide.');dlg.close();
      }catch(x){note(x.message,true);use.disabled=false;use.textContent='Use this video'}
    };
    dlg.addEventListener('close',()=>{stop();stream?.getTracks().forEach(t=>t.stop());if(live.src)URL.revokeObjectURL(live.src);dlg.remove()});
    document.body.append(dlg);dlg.showModal();
    try{await startCam()}catch{note('Allow the camera and microphone for this site to record.',true);dlg.close()}
  }

  // ---------- list ----------
  const player=(id,shapeKey,label)=>el('div',{class:'aiv-player','data-shape':shapeKey},el('video',{src:`/api/saas/media/${encodeURIComponent(id)}/file`,controls:true,playsinline:true,preload:'metadata','aria-label':label}));
  const doneActions=(id,name,onClear)=>el('div',{class:'aiv-actions'},
    el('button',{type:'button',class:'secondary-button',text:'Full preview',onclick:()=>window.OprunMediaViewer?.open([{id,kind:'video',original_name:name}],0,{onUse:m=>window.dispatchEvent(new CustomEvent('oprun:media-pick',{detail:{id:m.id}}))})}),
    el('button',{type:'button',class:'secondary-button',text:'Use in render',onclick:()=>window.dispatchEvent(new CustomEvent('oprun:media-pick',{detail:{id}}))}),
    el('a',{class:'secondary-button',href:`/api/saas/media/${encodeURIComponent(id)}/file`,download:name,text:'Download'}),
    el('button',{type:'button',class:'link-button',text:'Clear',onclick:onClear}));
  function projectCard(p){
    const label={rendering:'Rendering',joining:'Joining',succeeded:'Ready',failed:'Stopped'}[p.status]||p.status;
    const name=`AI video – ${p.title.slice(0,60)}.mp4`,body=[];
    if(p.status==='succeeded'&&p.media_id)body.push(player(p.media_id,p.aspect_ratio,'Generated video'),doneActions(p.media_id,name,()=>clearProject(p)));
    else if(p.status==='failed')body.push(el('p',{class:'aiv-error',role:'alert',text:p.error||'The video stopped.'}),
      el('div',{class:'aiv-actions'},el('button',{type:'button',class:'secondary-button',text:'Continue',onclick:()=>continueProject(p)}),el('button',{type:'button',class:'link-button',text:'Clear',onclick:()=>clearProject(p)})),
      el('small',{class:'muted',text:`${p.clips_done} of ${p.clips_total} shots are kept; Continue makes only the rest.`}));
    else body.push(el('div',{class:'aiv-progress',role:'progressbar','aria-valuemin':'0','aria-valuemax':String(p.clips_total),'aria-valuenow':String(p.clips_done),'aria-label':'Shots made'},el('span',{style:`width:${Math.round(100*p.clips_done/p.clips_total)}%`})),
      el('p',{class:'aiv-wait',text:p.status==='joining'?'Joining the shots'+(p.narration_media_id?' and adding your voice':'')+'…':`Making shot ${Math.min(p.clips_done+1,p.clips_total)} of ${p.clips_total} · ${ago(p.created_at)} so far.`}));
    return el('article',{class:`aiv-job ${p.status}`,'data-project':p.id},
      el('header',{},el('div',{},el('b',{text:p.engine_label}),el('small',{text:`${p.aspect_ratio} · ${secs(p.total_seconds)}${p.clips_total>1?` · ${p.clips_total} shots`:''} · ${p.resolution}${p.narration_media_id?' · your voice':''}`})),el('span',{class:'aiv-status','data-status':p.status==='failed'?'failed':p.status==='succeeded'?'succeeded':'running',text:label})),
      el('p',{class:'aiv-prompt',text:p.title}),...body);
  }
  function jobCard(j){
    const label={running:'Rendering',queued:'Starting',succeeded:'Ready',failed:'Failed'}[j.status]||j.status,name=`AI video – ${(j.idea||j.prompt).slice(0,60)}.mp4`,body=[];
    if(j.status==='succeeded'&&j.media_id)body.push(player(j.media_id,j.aspect_ratio,'Generated video'),doneActions(j.media_id,name,()=>clearJob(j)));
    else if(j.status==='failed')body.push(el('p',{class:'aiv-error',role:'alert',text:j.error||'The provider could not make this video.'}),el('div',{class:'aiv-actions'},el('button',{type:'button',class:'link-button',text:'Clear',onclick:()=>clearJob(j)})));
    else body.push(el('p',{class:'aiv-wait',text:`Rendering for ${ago(j.created_at)}. Usually 1–4 minutes.`}));
    return el('article',{class:`aiv-job ${j.status}`,'data-job':j.id},el('header',{},el('div',{},el('b',{text:j.engine_label}),el('small',{text:`${j.aspect_ratio} · ${j.duration}s · ${j.resolution}`})),el('span',{class:'aiv-status','data-status':j.status,text:label})),el('p',{class:'aiv-prompt',text:j.prompt}),...body);
  }
  function drawJobs(){
    const host=$('#aiv-jobs');if(!host)return;
    const existing=new Map([...host.querySelectorAll('[data-project],[data-job]')].map(n=>[n.dataset.project||n.dataset.job,n]));
    const keep=(id,status,make)=>{const old=existing.get(id);return old&&old.classList.contains(status)&&(status==='succeeded'||status==='failed')?old:make()};
    const cards=[...(state.projects||[]).map(p=>keep(p.id,p.status,()=>projectCard(p))),...(state.jobs||[]).map(j=>keep(j.id,j.status,()=>jobCard(j)))];
    host.replaceChildren(...(cards.length?cards:[el('div',{class:'empty-state'},el('b',{text:'No AI videos yet'}),el('span',{text:'Write an idea above and press Generate video.'}))]));
  }

  async function enhance(){
    if(dictation?.isBusy()){note('Finish or cancel dictation before writing the AI prompt.',true);return}
    const idea=$('#aiv-idea').value.trim();if(idea.length<3){note('Write your idea first, in a few words.',true);$('#aiv-idea').focus();return}
    const b=$('#aiv-enhance');b.disabled=true;b.textContent='Writing…';
    const v=$('#aiv-duration').value,e=engine();
    try{const r=await api('/api/saas/ai-video/enhance',{method:'POST',body:JSON.stringify({idea,aspect_ratio:shape,duration:Math.min(15,v==='voice'?e.max:Number(v)||8)})});$('#aiv-prompt').value=r.prompt;
      $('#aiv-enhance-note').textContent=r.source==='ai'?'AI wrote this prompt. Read it and change anything before generating.':'A ready-made structure was used because the AI writer is not available. Edit it to match your idea.'}
    catch(x){note(x.message,true)}finally{b.disabled=false;b.textContent='Write the prompt with AI'}
  }
  async function generate(){
    if(dictation?.isBusy()){note('Finish or cancel dictation before generating a video.',true);return}
    const e=engine();if(!e?.ready){note('Connect a video provider first.',true);return}
    let prompt=$('#aiv-prompt').value.trim();const idea=$('#aiv-idea').value.trim();
    if(prompt.length<10&&idea.length>=10)prompt=idea;
    if(prompt.length<10){note('Write your idea and press “Write the prompt with AI”, or write the prompt yourself.',true);$('#aiv-idea').focus();return}
    const refs=guides();if(refs.length>3){note('Choose up to 3 photos or videos to guide the AI.',true);return}
    const v=$('#aiv-duration').value,body={engine:e.id,prompt,aspect_ratio:shape,resolution:$('#aiv-resolution').value,reference_media_ids:refs,keep_sound:$('#aiv-keep').checked};
    if(idea)body.idea=idea;
    if(voiceMode==='record'||voiceMode==='library'){if(!narrationId){note(voiceMode==='record'?'Record your voice first, or choose None.':'Choose a recording, or choose None.',true);return}body.narration_media_id=narrationId}
    if(voiceMode==='script'){const script=$('#aiv-script')?.value.trim(),voice=$('#aiv-voice')?.value;if(!voice){note('Create your voice first.',true);return}if(!script){note('Write the script for your voice-over.',true);return}body.voice_id=voice;body.script=script}
    if(v==='voice'){if(voiceMode==='none'){note('Add a voice-over, or choose a length.',true);return}body.clip_seconds=e.max}
    else{const n=Number(v);body.total_seconds=n;body.clip_seconds=Math.min(n,e.max)}
    busy=true;const b=$('#aiv-generate');b.disabled=true;b.textContent='Starting…';
    try{await api('/api/saas/ai-video/projects',{method:'POST',body:JSON.stringify(body)});note('Your video is rendering. It will appear below when ready.');await load()}
    catch(x){note(x.message,true);await load()}finally{busy=false;b.textContent='Generate video';fit()}
  }
  async function continueProject(p){try{await api(`/api/saas/ai-video/projects/${p.id}/continue`,{method:'POST',body:'{}'});note('Continuing your video.');await load()}catch(x){note(x.message,true)}}
  async function clearProject(p){try{await api(`/api/saas/ai-video/projects/${p.id}`,{method:'DELETE'});await load()}catch(x){note(x.message,true)}}
  async function clearJob(j){try{await api(`/api/saas/ai-video/jobs/${j.id}`,{method:'DELETE'});await load()}catch(x){note(x.message,true)}}

  async function loadLibrary(){try{library=(await api('/api/saas/media')).media||[]}catch{library=[]}}
  async function load(){
    if(!mount())return;
    const before=new Set([...(state.projects||[]),...(state.jobs||[])].filter(x=>x.status==='succeeded').map(x=>x.id));
    try{state=await api('/api/saas/ai-video')}catch{return}
    await loadLibrary();
    drawProviders();drawEngines();drawJobs();if(voiceMode!=='record')drawVoice();
    if(loaded&&[...state.projects,...state.jobs].some(x=>x.status==='succeeded'&&!before.has(x.id)))window.dispatchEvent(new Event('oprun:media-changed'));loaded=true;
    schedule();
  }
  function schedule(){
    clearTimeout(timer);timer=null;
    const live=state.projects.filter(p=>p.status==='rendering'||p.status==='joining'),jobs=state.jobs.filter(j=>j.status==='running'||j.status==='queued');
    if(!live.length&&!jobs.length)return;
    timer=setTimeout(async()=>{
      if(!$('#ai-video-panel')?.isConnected||$('#video-view')?.hidden)return;
      await Promise.all([...live.map(p=>api(`/api/saas/ai-video/projects/${p.id}/refresh`,{method:'POST',body:'{}'}).catch(()=>null)),...jobs.map(j=>api(`/api/saas/ai-video/jobs/${j.id}/refresh`,{method:'POST',body:'{}'}).catch(()=>null))]);
      await load();
    },8000);
  }
  onView('video',{enter:load,leave:()=>{clearTimeout(timer);timer=null;stopAudio();dictation?.cancel()}});
})();
