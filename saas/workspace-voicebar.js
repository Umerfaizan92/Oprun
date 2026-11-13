/* Ask-anything command bar for the workspace home: type, speak, listen, and see what is happening.
   Uses the existing AI assistant form; nothing is sent without the person pressing Send or finishing a spoken request. */
(function(){
  'use strict';
  const view=document.getElementById('dashboard-view');if(!view||document.getElementById('sp-askbar'))return;
  const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
  const serverCapture=Boolean(navigator.mediaDevices?.getUserMedia&&window.MediaRecorder),voiceAvailable=serverCapture||Rec;
  const bar=document.createElement('section');bar.id='sp-askbar';bar.className='sp-askbar';bar.setAttribute('aria-label','Ask Oprun');
  bar.innerHTML=`<div class="sp-ask-head"><h2 data-i18n="vb.title">What would you like done today?</h2><p class="sp-ask-status" role="status" aria-live="polite"><span class="pulse-dot"></span><span data-ask-state>Ready</span></p></div>
  <form class="sp-ask-form" autocomplete="off"><label class="sr-only" for="sp-ask-input">Ask Oprun</label>
  <input id="sp-ask-input" type="text" placeholder="Type a request, or press the microphone and speak" data-i18n-attr="placeholder=vb.placeholder" maxlength="2000" enterkeyhint="send" autocapitalize="sentences" spellcheck="true" aria-describedby="sp-ask-hint"/>
  <button type="button" class="sp-ask-mic" aria-pressed="false" aria-label="Speak your request" title="Speak your request" data-i18n-attr="aria-label=vb.speakLabel;title=vb.speakLabel"${voiceAvailable?'':' disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span data-i18n="${voiceAvailable?'vb.speak':'vb.voiceUnavailable'}">${voiceAvailable?'Speak':'Voice unavailable'}</span></button>
  <button type="submit" class="primary-button sp-ask-send" aria-disabled="true" data-i18n="vb.send">Send</button></form><p class="sp-ask-hint" id="sp-ask-hint" data-i18n="vb.hint">Enter sends · Esc clears · anything that sends, publishes or pays still waits for your approval.</p>
  <div class="sp-ask-chips" role="group" aria-label="Quick requests" data-i18n-attr="aria-label=vb.quick"><button type="button" data-q="What needs my attention today?" data-i18n="vb.chipAttention">What needs attention today</button><button type="button" data-q="Draft replies to new enquiries for my approval." data-i18n="vb.chipDrafts">Draft replies for approval</button><button type="button" data-q="Which workers have compliance documents expiring soon?" data-i18n="vb.chipCompliance">Expiring compliance</button><button type="button" data-q="Summarise this week's jobs and income." data-i18n="vb.chipWeek">This week's jobs and income</button></div>`;
  // Keep the original greeting, operational sections and next steps ahead of AI.
  view.append(bar);
  const state=bar.querySelector('[data-ask-state]'),dot=bar.querySelector('.pulse-dot'),input=bar.querySelector('#sp-ask-input'),mic=bar.querySelector('.sp-ask-mic'),form=bar.querySelector('form');
  // Prompt 03 L6: status messages are looked up by their English text; the English is kept for comparisons.
  const VB={"Ready": "vb.ready", "Type or say what you need first.": "vb.typeFirst", "Working on it…": "vb.working", "Still working. The answer will appear in Ask Oprun.": "vb.stillWorking", "Answer ready in Ask Oprun": "vb.answerReadyAsk", "Could not reach AI right now. Please try again.": "vb.aiDown", "Voice is loading. Please try again.": "vb.voiceLoading", "Heard you. Check the text, then press Send.": "vb.heard", "No speech was understood. Please try again.": "vb.noSpeech", "Could not hear you. Try again.": "vb.cantHear", "Listening… speak now": "vb.listening", "Microphone blocked. Allow it in the browser address bar.": "vb.micBlocked", "Microphone is busy. Try again.": "vb.micBusy", "Answer ready": "vb.answerReady", "Speaking": "vb.speaking"};
  const tr=(english)=>VB[english]&&window.OprunLocale?.t?.(VB[english])||english;
  const set=(text,kind)=>{state.dataset.en=text;state.textContent=tr(text);dot.className='pulse-dot'+(kind?' '+kind:'')};
  // Prompt 01 #7: clear working / answered / problem states while Ask Oprun prepares the answer.
  const sendButton=bar.querySelector('.sp-ask-send');let pending=null;
  const syncSend=()=>sendButton.setAttribute('aria-disabled',String(!input.value.trim()));
  const settle=(text,kind)=>{clearTimeout(pending);pending=null;bar.removeAttribute('aria-busy');set(text,kind);syncSend()};
  function send(text){
    text=String(text||'').trim();if(!text){input.focus();set('Type or say what you need first.','warn');return}
    clearTimeout(pending); // a newer request replaces the one still being prepared
    bar.setAttribute('aria-busy','true');set('Working on it…','info');
    pending=setTimeout(()=>settle('Still working. The answer will appear in Ask Oprun.','warn'),20000);
    window.dispatchEvent(new CustomEvent('superpro:ask',{detail:{question:text}}));
    input.value='';syncSend();
  }
  window.addEventListener('superpro:ask-status',e=>{if(!pending)return;const st=e.detail?.state;if(st==='answered'){bar.dataset.answered='1';setTimeout(()=>{delete bar.dataset.answered},12000);settle('Answer ready in Ask Oprun')}else if(st==='failed')settle('Could not reach AI right now. Please try again.','warn')});
  input.addEventListener('input',syncSend);
  input.addEventListener('keydown',e=>{if(e.key==='Escape'&&input.value){e.preventDefault();input.value='';syncSend();set('Ready')}});
  form.addEventListener('submit',e=>{e.preventDefault();send(input.value)});
  bar.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.q)));
  if(serverCapture){
    let run=0,busy=false;
    const stopped=()=>{mic.setAttribute('aria-pressed','false');mic.classList.remove('is-listening')};
    const cancel=()=>{run++;busy=false;window.SuperProAIClient?.stopListening(true);stopped()};
    window.addEventListener('pagehide',cancel);
    window.addEventListener('gds:viewchange',event=>{if(event.detail?.view!=='dashboard')cancel()});
    window.addEventListener('superpro:ask',cancel);
    mic.addEventListener('click',async()=>{
      const client=window.SuperProAIClient;
      if(!client){set('Voice is loading. Please try again.','warn');return}
      if(busy){if(client.isListening())client.stopListening();else{cancel();set('Ready')}return}
      const current=++run;busy=true;
      try{
        const result=await client.listen({
          onStatus:(text,kind)=>{if(current===run)set(text,kind==='limited'?'warn':kind==='listening'?'info':'')},
          onListening:on=>{if(current!==run)return;mic.setAttribute('aria-pressed',String(on));mic.classList.toggle('is-listening',on)}
        });
        if(current!==run||result.cancelled)return;
        if(result.text){input.value=result.text;set('Heard you. Check the text, then press Send.')}
        else set('No speech was understood. Please try again.','warn');
      }catch(error){if(current===run)set(error.message||'Could not hear you. Try again.','warn')}
      finally{if(current===run){busy=false;stopped()}}
    });
  }else if(Rec){
    let rec=null,listening=false,heard='';
    const stop=()=>{listening=false;mic.setAttribute('aria-pressed','false');mic.classList.remove('is-listening')};
    const cancel=()=>{try{rec?.abort()}catch{}stop()};
    window.addEventListener('pagehide',cancel);window.addEventListener('gds:viewchange',event=>{if(event.detail?.view!=='dashboard')cancel()});
    mic.addEventListener('click',()=>{
      if(listening&&rec){rec.stop();return}
      rec=new Rec();rec.lang=document.documentElement.lang||'en-AU';rec.interimResults=true;rec.continuous=false;heard='';
      rec.onstart=()=>{listening=true;mic.setAttribute('aria-pressed','true');mic.classList.add('is-listening');set('Listening… speak now','warn')};
      rec.onresult=ev=>{heard=Array.from(ev.results).map(r=>r[0].transcript).join(' ');input.value=heard};
      rec.onerror=ev=>{stop();set(ev.error==='not-allowed'?'Microphone blocked. Allow it in the browser address bar.':'Could not hear you. Try again.','warn')};
      rec.onend=()=>{const had=listening;stop();if(had&&heard.trim()){set('Heard you. Check the text, then press Send.')}else if(had){set('Ready')}};
      try{rec.start()}catch{set('Microphone is busy. Try again.','warn')}
    });
  }
  try{const synth=window.speechSynthesis;if(synth&&!synth.__spWrapped){const orig=synth.speak.bind(synth);synth.speak=u=>{const emit=on=>window.dispatchEvent(new CustomEvent('superpro:speaking',{detail:{on}}));u.addEventListener('start',()=>emit(true));u.addEventListener('end',()=>emit(false));u.addEventListener('error',()=>emit(false));return orig(u)};synth.__spWrapped=true}}catch{}
  // After an answer, keep 'Answer ready' visible instead of falling back to 'Ready' when speech ends.
  window.addEventListener('superpro:speaking',e=>{const on=Boolean(e.detail&&e.detail.on);if(on)set('Speaking','info');else if(state.dataset.en==='Speaking')set(bar.dataset.answered?'Answer ready in Ask Oprun':'Ready')});
  window.addEventListener('oprun:locale-changed',()=>{state.textContent=tr(state.dataset.en||'Ready')});
})();
