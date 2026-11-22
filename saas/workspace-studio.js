// Media Studio: one tool per page. Tabs: Library · Reels · Editor · AI video. Keyboard: arrows, Home, End.
(()=>{
  const $=s=>document.querySelector(s);
  const TABS=['library','reels','editor','ai'];
  let current='library',editor=null,epoch=0;
  const tab=k=>$(`#st-tab-${k}`),page=k=>$(`#st-${k}`);
  function show(k,focus=false){
    if(!TABS.includes(k)||!tab(k))return;current=k;
    for(const t of TABS){const on=t===k,b=tab(t);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;page(t).hidden=!on}
    if(focus)tab(k).focus();
    if(k==='editor'){if(!editor&&window.OprunStudioEditor){const card=document.createElement('article');card.className='panel st-editor-card';page('editor').append(card);editor=window.OprunStudioEditor.create({panel:card})}editor?.show('edit')}else editor?.show('');
    if(k==='ai')drawClear();
    if(k==='library')window.dispatchEvent(new Event('oprun:media-changed'));
  }
  // Owner-only: permanently delete this workspace's AI-generated videos, voice files and old saved specifications.
  async function drawClear(){
    const run=++epoch,host=page('ai');if(!host)return;let box=host.querySelector('.st-clear');
    const role=window.GDS_SESSION?.user?.role||window.GDS_SESSION?.membership?.role||'';
    if(!['owner','admin','super_admin'].includes(role)){box?.remove();return}
    let d;try{d=await window.SuperProUI.api('/api/saas/ai-video/generated')}catch{return}
    if(run!==epoch)return;
    const total=d.files+d.videos+d.specs;
    if(!total){box?.remove();return}
    if(!box){box=document.createElement('div');box.className='st-clear';host.append(box)}
    const {el,api,note}=window.SuperProUI;
    const label=`Delete all AI-generated videos (${d.files} ${d.files===1?'file':'files'})`;
    const btn=el('button',{type:'button',class:'secondary-button st-danger',id:'st-clear-ai',text:label});
    let armed=false;
    btn.addEventListener('click',async()=>{
      if(!armed){armed=true;btn.textContent='Tap again to delete permanently';btn.setAttribute('aria-live','polite');setTimeout(()=>{if(btn.isConnected&&armed){armed=false;btn.textContent=label}},6000);return}
      btn.disabled=true;
      try{const r=await api('/api/saas/ai-video/generated/delete',{method:'POST',body:JSON.stringify({confirm:'DELETE'})});note(`Deleted ${r.deleted.files} ${r.deleted.files===1?'file':'files'}.`);window.dispatchEvent(new Event('oprun:media-changed'));window.dispatchEvent(new Event('oprun:ai-video-refresh'));drawClear()}
      catch(e){note(e.message,true);btn.disabled=false;armed=false;btn.textContent=label}
    });
    box.replaceChildren(btn,d.running?el('small',{class:'muted',text:`${d.running} still rendering, not deleted`}):null);
  }
  function wire(){
    const list=$('#video-view .st-tabs');if(!list||list.dataset.wired)return;list.dataset.wired='1';
    list.addEventListener('click',e=>{const b=e.target.closest('[data-st]');if(b)show(b.dataset.st)});
    list.addEventListener('keydown',e=>{const i=TABS.indexOf(current);let n=null;if(e.key==='ArrowRight')n=TABS[(i+1)%TABS.length];else if(e.key==='ArrowLeft')n=TABS[(i+TABS.length-1)%TABS.length];else if(e.key==='Home')n=TABS[0];else if(e.key==='End')n=TABS[TABS.length-1];if(n){e.preventDefault();show(n,true)}});
  }
  window.addEventListener('oprun:studio-mode',e=>{if(e.detail?.mode==='edit')show('editor')});
  window.addEventListener('superpro:workspace-ready',()=>{epoch++;editor?.destroy?.();editor=null;page('editor')?.replaceChildren();page('ai')?.querySelector('.st-clear')?.remove();show('library')});
  window.OprunStudio={show,current:()=>current};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();
