// T-191: dictate editable video instructions. Audio is transient; speech never
// submits a prompt or starts a billed render. Automatic mode uses the existing
// authenticated speech service; explicit languages use browser recognition.
(()=>{
  function create(host,{canStart=()=>true}={}){
    const {el,api}=window.SuperProUI;
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    let run=0,active=null,pending=null,clock=null;
    const fields=[];
    const micIcon=()=>{
      const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
      for(const [k,v] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2','aria-hidden':'true',width:'18',height:'18'}))svg.setAttribute(k,v);
      const p=document.createElementNS(ns,'path');p.setAttribute('d','M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V6ZM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8');svg.append(p);return svg;
    };
    const language=el('select',{id:'aiv-dictation-language','aria-label':'Dictation language'},
      el('option',{value:'auto',text:'Automatic · AI speech recognition'}));
    const defaults=[['en-AU','English'],['ur-PK','اردو · Urdu'],['hi-IN','हिन्दी · Hindi'],['pa-IN','ਪੰਜਾਬੀ · Punjabi'],['ar-SA','العربية · Arabic'],['es-ES','Español'],['fr-FR','Français'],['zh-CN','中文'],['ja-JP','日本語'],['de-DE','Deutsch']];
    for(const [value,text] of defaults)language.append(el('option',{value,text}));
    const hint=el('small',{class:'muted',text:'Automatic detects supported languages using AI. Choose a language for browser dictation. Availability depends on your speech service or browser. Review the text before generating.'});
    const status=el('p',{class:'aiv-dictation-status',role:'status','aria-live':'polite',text:'Voice input is ready.'});
    const draft=el('textarea',{rows:3,dir:'auto','aria-label':'Speech to review'});
    const review=el('div',{class:'aiv-dictation-review',hidden:true},
      el('p',{text:'Your text changed, or the speech is longer than this field allows. Review it, then insert at the cursor.'}),draft,
      el('button',{type:'button',class:'secondary-button',text:'Insert reviewed speech',onclick:()=>{if(pending&&insert(pending,draft.value,true)){pending=null;review.hidden=true;status.textContent='Speech inserted. Review it before generating.'}}}),
      el('button',{type:'button',class:'secondary-button',text:'Discard speech',onclick:()=>{pending=null;draft.value='';review.hidden=true}}));
    host.append(el('label',{},el('span',{text:'Voice input language'}),language),hint,status,review);
    // Reuse the app's language catalogue without asserting that every listed
    // language is supported by a particular browser or transcription provider.
    api('/api/saas/preferences/language').then(data=>{
      const keep=language.value,seen=new Set([...language.options].map(o=>o.value));
      for(const item of data.locales||[]){if(!seen.has(item.code)){language.append(el('option',{value:item.code,text:item.label||item.native_name||item.code}));seen.add(item.code)}}
      language.value=keep;
    }).catch(()=>{});
    const say=text=>{status.textContent=text};
    function reset(){
      clearTimeout(clock);clock=null;active=null;language.disabled=false;
      for(const f of fields){f.label.textContent=`Speak ${f.name}`;f.button.setAttribute('aria-pressed','false');f.cancel.hidden=true;f.button.disabled=false}
    }
    function cancel(message='Voice input is ready.'){
      run++;const a=active;
      if(a?.recognition){try{a.recognition.abort()}catch{}}
      if(a?.server)window.SuperProAIClient?.stopListening(true);
      reset();pending=null;draft.value='';review.hidden=true;
      if(message)say(message);
    }
    function insert(capture,text,current=false){
      const t=capture.field.target;if(!t.isConnected)return false;
      const start=current?t.selectionStart:capture.start,end=current?t.selectionEnd:capture.end;
      const left=t.value.slice(0,start),right=t.value.slice(end);
      const addition=(left&&!/\s$/.test(left)?' ':'')+text+(right&&!/^\s/.test(right)?' ':'');
      if(t.maxLength>=0&&left.length+addition.length+right.length>t.maxLength){say(`This field allows ${t.maxLength} characters. Shorten the speech below before inserting.`);return false}
      t.setRangeText(addition,start,end,'end');t.dispatchEvent(new Event('input',{bubbles:true}));return true;
    }
    function finish(capture,text){
      if(capture.id!==run)return;
      reset();text=String(text||'').trim();
      if(!text){say('No speech was understood. Try again in a quiet place.');return}
      if(capture.field.target.value!==capture.before||capture.field.revision!==capture.revision||!insert(capture,text)){
        pending=capture;draft.value=text;review.hidden=false;say('Speech is ready for review. Your existing text was preserved.');return;
      }
      say('Speech inserted. Check names and details, then use “Write the prompt with AI” or Generate video.');
    }
    function failure(capture,error){
      if(capture.id!==run)return;
      run++;reset();
      if(error?.name==='NotAllowedError'||error==='not-allowed'||error==='service-not-allowed')say('Microphone access was denied. Allow it in your browser settings, then try again.');
      else if(error==='language-not-supported')say('This browser does not support that language. Try Automatic or another language.');
      else if(error==='no-speech')say('No speech was understood. Try again in a quiet place.');
      else say('Speech could not be transcribed. Try again, choose a language for browser dictation, or type your text. Automatic mode needs an available AI speech service.');
    }
    async function start(field){
      if(active){
        if(active.field!==field){say('Finish or cancel the current dictation first.');return}
        if(active.recognition){active.recognition.stop();say('Finishing speech…')}
        else if(window.SuperProAIClient?.isListening()){window.SuperProAIClient.stopListening();say('Transcribing speech…')}
        return;
      }
      if(pending){say('Insert or discard the reviewed speech before recording again.');return}
      if(!canStart()){say('Finish the current AI or recording action before dictating.');return}
      const capture={id:++run,field,before:field.target.value,start:field.target.selectionStart,end:field.target.selectionEnd,revision:field.revision};
      active=capture;language.disabled=true;
      for(const f of fields)f.button.disabled=f!==field;
      field.label.textContent='Stop dictation';field.button.setAttribute('aria-pressed','true');field.cancel.hidden=false;
      say('Allow the microphone, then speak naturally. Press Stop dictation when finished.');
      if(language.value!=='auto'&&Recognition){
        try{
          const r=new Recognition();capture.recognition=r;capture.text='';r.lang=language.value;r.continuous=true;r.interimResults=true;
          r.onresult=e=>{if(capture.id!==run)return;capture.text=Array.from(e.results).filter(x=>x.isFinal).map(x=>x[0].transcript).join(' ');say('Listening… press Stop dictation when finished.')};
          r.onstart=()=>{if(capture.id!==run){try{r.abort()}catch{}}};
          r.onerror=e=>{if(capture.id!==run)return;failure(capture,e.error);try{r.abort()}catch{}};
          r.onend=()=>finish(capture,capture.text);r.start();
          clock=setTimeout(()=>{if(capture.id===run){r.stop();say('Finishing speech…')}},45000);
        }catch(e){failure(capture,e)}
        return;
      }
      const client=window.SuperProAIClient;
      if(!client||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){failure(capture);say('Automatic recording is unavailable in this browser. Choose a language for browser dictation, or type your text.');return}
      capture.server=true;
      // This bound includes permission waiting and provider response time.
      clock=setTimeout(()=>cancel('Speech input timed out. Your existing text was preserved; please try again.'),80000);
      try{
        const result=await client.listen({language:language.value==='auto'?'auto':language.value.split('-')[0],manual:true,
          onListening:on=>{if(capture.id===run&&on)say('Listening… speak naturally, then press Stop dictation.')},
          onStatus:(_text,state)=>{if(capture.id===run&&state==='transcribing')say('Transcribing speech…')}});
        if(capture.id!==run)return;
        if(result.cancelled){cancel('Dictation cancelled. Your existing text was preserved.');return}
        finish(capture,result.text);
      }catch(e){failure(capture,e)}
    }
    function attach(target,name){
      target.dir='auto';const field={target,name,revision:0};target.addEventListener('input',()=>field.revision++);
      field.label=el('span',{text:`Speak ${name}`});
      field.button=el('button',{type:'button',class:'secondary-button aiv-dictate','aria-pressed':'false','aria-controls':target.id,onclick:()=>start(field)},micIcon(),field.label);
      field.cancel=el('button',{type:'button',class:'secondary-button',hidden:true,text:'Cancel dictation',onclick:()=>cancel('Dictation cancelled. Your existing text was preserved.')});
      const toolbar=el('div',{class:'aiv-full aiv-dictation-tools'},field.button,field.cancel);
      target.closest('label').after(toolbar);fields.push(field);
    }
    window.addEventListener('pagehide',()=>cancel());
    window.addEventListener('superpro:workspace-ready',()=>cancel('Workspace changed. Dictation cancelled.'));
    window.addEventListener('gds:viewchange',e=>{if(e.detail?.view!=='video')cancel()});
    document.getElementById('logout')?.addEventListener('click',()=>cancel(),true);
    return {attach,cancel,isBusy:()=>Boolean(active)};
  }
  window.OprunVideoDictation={create};
})();
