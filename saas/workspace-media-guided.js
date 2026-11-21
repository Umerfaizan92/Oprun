// Direction A: progressive controls over the existing media services, not a
// second creator. All original nodes/IDs survive and flag-off is reversible.
(()=>{
  function create({panel,library,canNavigate=()=>true,capture=()=>({}),restore=()=>{}}){
    const {el,api,note}=window.SuperProUI,view=panel.closest('#video-view'),form=panel.querySelector('#aiv-form');
    let mode='create',step=0,furthest=0,enabled=false,legacyRun=0,creative=null,editor=null;
    const original=[...form.childNodes],oldParent=panel.parentNode,oldNext=panel.nextSibling;
    const oldSelection=library.querySelector('#library-selection small'),oldSelectionText=oldSelection?.textContent;
    const panelTitle=panel.querySelector('#aiv-title'),panelCopy=panel.querySelector('.panel-head p'),originalPanelTitle=panelTitle?.textContent,originalPanelCopy=panelCopy?.textContent,importHelp=library.querySelector('#add-demo-assets'),originalImportText=importHelp?.textContent;
    const oldHeading=view.querySelector('.page-heading h1'),oldTitle=oldHeading?.textContent;
    const oldRibbon=view.querySelector('.studio-workflow'),oldGrid=view.querySelector('.content-studio-grid');
    const legacyPanels=view._superProSectionPanels?.slice()||[],legacyTabs=view.querySelector(':scope > .context-section-tabs'),legacyLabels=legacyTabs?[...legacyTabs.querySelectorAll('[role=tab]')].map(b=>b.textContent):[],legacySelected=legacyTabs?.querySelector('[aria-selected=true]')?.textContent;
    const legacyAria=legacyPanels.map(n=>[n,Object.fromEntries(['role','aria-labelledby','tabindex'].map(a=>[a,n.getAttribute(a)]))]);
    const hiddenBefore=new Map([oldRibbon,oldGrid,library].filter(Boolean).map(n=>[n,n.hidden]));
    const nav=el('nav',{class:'ms-nav','aria-label':'Media Studio views'}),steps=el('div',{class:'ms-steps','aria-label':'Creation steps'});
    const names=['Brief','Attachments','Production','Voice & review'];
    const next=el('button',{type:'button',class:'primary-button',text:'Next',onclick:()=>changeStep(step+1)});
    const back=el('button',{type:'button',class:'secondary-button',text:'Back',onclick:()=>changeStep(step-1)});
    const footer=el('div',{class:'aiv-full ms-step-actions'},back,next);
    const legacy=el('details',{class:'ms-legacy',hidden:true},el('summary',{text:'Saved legacy specifications (drafts)'})),legacyBody=el('div',{});legacy.append(legacyBody);
    const parts=[],buttons=[];
    function allowed(){if(canNavigate())return true;note('Finish or cancel the current recording or dictation first.',true);return false}
    function changeStep(n){
      if(!allowed()||n<0||n>=parts.length)return;
      if(n>step&&step===0&&panel.querySelector('#aiv-idea').value.trim().length<3&&panel.querySelector('#aiv-prompt').value.trim().length<10){note('Write or dictate your idea first.',true);panel.querySelector('#aiv-idea').focus();return}
      step=n;furthest=Math.max(furthest,n);parts.forEach((p,i)=>p.hidden=i!==step);buttons.forEach((b,i)=>{b.disabled=i>furthest+1;b.setAttribute('aria-current',i===step?'step':'false')});back.hidden=step===0;next.hidden=step===parts.length-1;
      const heading=parts[step].querySelector('h3');heading?.focus({preventScroll:true});heading?.scrollIntoView({block:'start',behavior:'auto'});
    }
    async function loadLegacy(){
      const run=++legacyRun;
      try{const d=await api('/api/saas/video-renders');if(!enabled||run!==legacyRun)return;
        legacyBody.replaceChildren(el('p',{class:'muted',text:'These are saved planning specifications, not rendered videos. Existing records are preserved.'}),
          ...(d.jobs||[]).map(j=>el('details',{},el('summary',{text:`${j.quality} · ${j.edit_spec?.platform||'Video draft'}`}),el('pre',{text:JSON.stringify(j.edit_spec||{},null,2)}))));
      }catch{if(enabled&&run===legacyRun)legacyBody.replaceChildren(el('p',{text:'Saved specifications could not be loaded. Try Projects again.'}))}
    }
    function show(name){
      if(!enabled||!allowed())return;mode=name;legacyRun++;
      [...nav.children].forEach(b=>b.setAttribute('aria-current',b.dataset.mode===mode?'page':'false'));
      panel.hidden=mode==='library';library.hidden=mode!=='library';
      form.hidden=mode!=='create';steps.hidden=mode!=='create';footer.hidden=mode!=='create';
      panel.querySelector('#aiv-providers').hidden=mode!=='connections';panel.querySelector('#aiv-connect').hidden=true;
      panel.querySelector('.aiv-jobs-head').hidden=mode!=='projects';panel.querySelector('#aiv-jobs').hidden=mode!=='projects';legacy.hidden=mode!=='projects';
      const title=panel.querySelector('#aiv-title'),copy=panel.querySelector('.panel-head p');if(title)title.textContent=mode==='projects'?'Your media projects':mode==='connections'?'Connections & billing':mode==='edit'?'Edit your video':'Make a video from an idea';if(copy)copy.textContent=mode==='projects'?'Preview, download and reuse your finished videos. Saved legacy specifications remain drafts.':mode==='connections'?'Use your own provider accounts. A valid key does not guarantee available generation credits.':'Describe your idea, add guides, choose production settings and review your voice-over before generating.';
      editor?.show(mode);creative?.show(mode);if(mode==='projects')loadLegacy();if(mode==='library')window.dispatchEvent(new Event('oprun:media-changed'));
    }
    function enable(){
      enabled=true;if(importHelp)importHelp.textContent='Connected account help';window.SuperProPageSections?.dispose(view);legacyTabs?.remove();legacyAria.forEach(([n,attrs])=>Object.keys(attrs).forEach(a=>n.removeAttribute(a)));view.querySelectorAll('.focus-inactive').forEach(n=>n.classList.remove('focus-inactive'));view.dataset.sectionInstalled='media-guided';view.classList.add('ms-unified');if(oldSelection)oldSelection.textContent='Choose an asset to reuse as a guide in your next video.';if(oldHeading)oldHeading.textContent='Media Studio';
      for(const n of [oldRibbon,oldGrid])if(n)n.hidden=true;
      panel.before(nav);view.querySelector('.page-heading').after(nav);nav.after(panel);
      for(const [id,label] of [['create','Create'],['projects','Projects'],['library','Library'],['edit','Edit'],['connections','Connections & billing']])nav.append(el('button',{type:'button',class:'secondary-button','data-mode':id,text:label,onclick:()=>show(id)}));
      const children=[...form.children],guide=panel.querySelector('#aiv-guides').closest('.aiv-field'),model=panel.querySelector('#aiv-engine').closest('label'),voice=panel.querySelector('.aiv-voice');
      const cuts=[0,children.indexOf(guide),children.indexOf(model),children.indexOf(voice),children.length];
      names.forEach((name,i)=>{const p=el('section',{class:'aiv-full ms-guided-step','aria-label':name},el('h3',{class:'aiv-full',tabindex:'-1',text:`${i+1}. ${name}`}),...children.slice(cuts[i],cuts[i+1]));parts.push(p);const b=el('button',{type:'button',class:'secondary-button',text:`${i+1}. ${name}`,onclick:()=>changeStep(i)});buttons.push(b);steps.append(b)});
      form.replaceChildren(steps,...parts,footer);panel.append(legacy);creative=window.OprunStudioProjects?.create({panel,capture,restore});editor=window.OprunStudioEditor?.create({panel});changeStep(0);show('create');
    }
    function destroy(){
      editor?.destroy();editor=null;creative?.destroy();creative=null;enabled=false;legacyRun++;nav.remove();legacy.remove();form.replaceChildren(...original);form.hidden=false;view.classList.remove('ms-unified');
      if(panelTitle)panelTitle.textContent=originalPanelTitle;if(panelCopy)panelCopy.textContent=originalPanelCopy;if(importHelp)importHelp.textContent=originalImportText;if(oldHeading)oldHeading.textContent=oldTitle;if(oldSelection)oldSelection.textContent=oldSelectionText;for(const [n,hidden] of hiddenBefore)n.hidden=hidden;
      panel.hidden=false;panel.querySelector('#aiv-providers').hidden=false;panel.querySelector('.aiv-jobs-head').hidden=false;panel.querySelector('#aiv-jobs').hidden=false;
      legacyAria.forEach(([n,attrs])=>Object.entries(attrs).forEach(([a,v])=>{if(v===null)n.removeAttribute(a);else n.setAttribute(a,v)}));delete view.dataset.sectionInstalled;if(legacyPanels.length>1)window.SuperProPageSections?.install(view,legacyPanels,{labels:legacyLabels,preferred:legacySelected});
      if(oldNext?.parentNode===oldParent)oldParent.insertBefore(panel,oldNext);else oldParent.append(panel);
    }
    const modeEvent=e=>show(e.detail?.mode||'create');window.addEventListener('oprun:studio-mode',modeEvent);const cleanup=destroy;enable();return {show,destroy(){window.removeEventListener('oprun:studio-mode',modeEvent);cleanup()}};
  }
  window.OprunMediaGuided={create};
})();
