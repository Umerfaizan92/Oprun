// Content Studio media library: private uploads per business, picked as the source for a render.
(()=>{
  const {el,api,onView,role,note}=window.SuperProUI;
  const $=s=>document.querySelector(s);
  let items=[],mode='all',selected='',epoch=0,metadata=new Map(),assetDialog=null,folderFilter=null,usage=null;
  const size=b=>b>1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
  const canDelete=()=>['owner','admin','super_admin'].includes(role());

  function thumb(m){
    const url=`/api/saas/media/${m.id}/file`;
    if(m.kind==='photo')return el('img',{src:url,alt:m.original_name,loading:'lazy'});
    if(m.kind==='video')return el('video',{src:url+'#t=0.1',preload:'metadata',muted:true,playsinline:true});
    return el('div',{class:'media-audio'},el('span',{text:'Audio'}),el('audio',{src:url,controls:true,preload:'none'}));
  }
  function draw(){
    const grid=$('#media-library-grid');if(!grid)return;
    const q=($('#media-library-search')?.value||'').trim().toLowerCase(),sort=$('#media-library-sort')?.value||'recent';
    let list=items.filter(m=>(mode==='all'||m.kind===mode)&&(!q||[m.original_name,metadata.get(m.id)?.label,metadata.get(m.id)?.notes,metadata.get(m.id)?.folder].join(' ').toLowerCase().includes(q))&&(folderFilter?.value?metadata.get(m.id)?.folder===folderFilter.value:true));
    list=[...list].sort((a,b)=>sort==='name'?a.original_name.localeCompare(b.original_name):sort==='type'?a.kind.localeCompare(b.kind):b.created_at.localeCompare(a.created_at));
    $('#library-count').textContent=`${items.length} ${items.length===1?'file':'files'}`;
    if(!list.length){grid.replaceChildren(el('div',{class:'empty-state'},el('b',{text:items.length?'Nothing matches':'No media yet'}),el('span',{text:items.length?'Try a different search or filter.':'Drop photos, videos or audio above to start your library.'})));return}
    grid.replaceChildren(...list.map(m=>el('article',{class:'media-card'+(m.id===selected?' selected':''),'data-id':m.id},
      el('button',{type:'button',class:'media-pick','aria-label':`Use ${m.original_name} as the source`,onclick:()=>pick(m)},thumb(m)),
      el('button',{type:'button',class:'media-preview','aria-label':`Preview ${m.original_name}`,title:'Preview',onclick:()=>preview(list,m)},el('span',{'aria-hidden':'true',text:m.kind==='photo'?'⤢':'▶'})),
      m.source==='ai-video'?el('span',{class:'media-ai-badge',text:'AI'}):null,
      el('div',{class:'media-meta'},el('b',{text:metadata.get(m.id)?.label||m.original_name}),metadata.get(m.id)?.folder?el('small',{text:metadata.get(m.id).folder}):null,el('small',{text:`${m.kind}, ${size(m.size_bytes)}`})),
      $('#video-view')?.classList.contains('ms-unified')?el('button',{type:'button',class:'secondary-button',text:'Organize','aria-label':`Organize ${m.original_name}`,onclick:()=>organize(m)}):null,
      canDelete()?el('button',{type:'button',class:'media-del',text:'Remove','aria-label':`Remove ${m.original_name}`,onclick:()=>remove(m)}):null)));
  }
  // T-185: full-size preview with player controls, next/previous, download and "use as source".
  function preview(list,m){window.OprunMediaViewer?.open(list,list.indexOf(m),{onUse:pick})}
  function pick(m){
    selected=m.id;const f=$('#video-form');if(f?.elements.media_id)f.elements.media_id.value=m.id;
    const s=$('#library-selection');if(s)s.replaceChildren(el('span',{text:`Source: ${m.original_name}`}),el('small',{text:'This file will be used in the render brief below.'}));
    draw();if($('#video-view')?.classList.contains('ms-unified'))window.dispatchEvent(new CustomEvent('oprun:studio-guide',{detail:{id:m.id}}));else $('#video-form')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  async function remove(m){
    if(!confirm(`Remove ${m.original_name} from your library?`))return;
    try{await api('/api/saas/media/'+m.id,{method:'DELETE'});if(selected===m.id)selected='';note('Removed.');await load()}catch(e){note(e.message,true)}
  }
  async function load(){const run=epoch;try{const [d,meta]=await Promise.all([api('/api/saas/media'),api('/api/saas/studio-library').catch(()=>({metadata:[],usage:null}))]);if(run!==epoch)return;items=d.media||[];metadata=new Map((meta.metadata||[]).map(m=>[m.media_id,m]));if($('#video-view')?.classList.contains('ms-unified')){if(!folderFilter){folderFilter=el('select',{'aria-label':'Library folder',onchange:draw});usage=el('small',{class:'muted'});$('#media-library-grid').before(el('div',{class:'aiv-row'},folderFilter,usage))}const keep=folderFilter.value;folderFilter.replaceChildren(el('option',{value:'',text:'All folders'}),...[...new Set((meta.metadata||[]).map(m=>m.folder).filter(Boolean))].sort().map(f=>el('option',{value:f,text:f})));folderFilter.value=keep;usage.textContent=meta.usage?`${meta.usage.files} files · ${size(meta.usage.bytes)} stored`:''}}catch{if(run!==epoch)return;items=[]}draw()}
  function organize(m){
    assetDialog?.close();const run=epoch,data=metadata.get(m.id)||{},field=(label,node)=>el('label',{},el('span',{text:label}),node),label=el('input',{value:data.label||'',maxlength:'160','aria-label':'Asset label'}),folder=el('input',{value:data.folder||'',maxlength:'100','aria-label':'Folder name'}),notes=el('textarea',{rows:'3',maxlength:'2000','aria-label':'Asset notes'}),review=el('input',{type:'date',value:data.retention_review_at?.slice(0,10)||'','aria-label':'Retention review date'}),version=el('select',{'aria-label':'Previous asset version'},el('option',{value:'',text:'No previous version'}),...items.filter(x=>x.id!==m.id).map(x=>el('option',{value:x.id,text:x.original_name}))),shares=el('div',{}),status=el('p',{role:'status'}),dlg=el('dialog',{class:'aiv-cam ms-publish','aria-label':'Organize library asset'});notes.value=data.notes||'';version.value=data.version_of||'';assetDialog=dlg;let shareRequest=null;
    const shareList=async()=>{const d=await api(`/api/saas/studio-library/${m.id}/shares`);if(run!==epoch||!dlg.isConnected)return;shares.replaceChildren(...d.shares.filter(s=>!s.revoked_at&&s.expires_at>new Date().toISOString()).map(s=>el('div',{class:'aiv-row'},el('small',{text:'Link expires '+new Date(s.expires_at).toLocaleString()}),el('button',{type:'button',class:'secondary-button',text:'Revoke link',onclick:async()=>{await api(`/api/saas/studio-library/shares/${s.id}/revoke`,{method:'POST',body:'{}'});if(run===epoch)shareList()}}))))};
    dlg.append(el('form',{onsubmit:async e=>{e.preventDefault();if(run!==epoch)return;const b=e.submitter;if(b)b.disabled=true;try{await api(`/api/saas/studio-library/${m.id}`,{method:'PATCH',body:JSON.stringify({label:label.value,folder:folder.value,notes:notes.value,version_of:version.value||null,retention_review_at:review.value?new Date(review.value+'T00:00:00Z').toISOString():null})});if(run!==epoch)return;await load();note('Library details saved.');dlg.close()}catch(x){if(run===epoch)status.textContent=x.message}finally{if(b)b.disabled=false}}},el('h2',{text:m.original_name}),field('Display label',label),field('Folder',folder),field('Notes',notes),field('Previous asset version',version),field('Retention review date',review),el('small',{text:'A review reminder only. Files are never deleted automatically.'}),canDelete()?el('button',{type:'button',class:'secondary-button',text:'Create 15-minute share link',onclick:async e=>{const button=e.currentTarget;button.disabled=true;try{if(run!==epoch)return;const d=await api(`/api/saas/studio-library/${m.id}/shares`,{method:'POST',body:JSON.stringify({minutes:15,request_id:shareRequest||(shareRequest=crypto.randomUUID())})});if(run!==epoch)return;shareRequest=null;status.replaceChildren(el('p',{text:d.note}),el('input',{readonly:true,value:location.origin+d.path,'aria-label':'Expiring share link'}));shareList()}catch(x){if(run===epoch)status.textContent=x.message}finally{button.disabled=false}}}):null,shares,status,el('div',{class:'aiv-row'},el('button',{type:'submit',class:'primary-button',text:'Save asset details'}),el('button',{type:'button',class:'secondary-button',text:'Close',onclick:()=>dlg.close()}))));dlg.addEventListener('close',()=>{dlg.remove();if(assetDialog===dlg)assetDialog=null});document.body.append(dlg);dlg.showModal();if(canDelete())shareList().catch(()=>{});
  }
  async function upload(files){
    const run=epoch,list=[...files];if(!list.length)return;
    const fd=new FormData();list.slice(0,10).forEach(f=>fd.append('files',f));
    const drop=$('#media-drop');drop?.classList.add('busy');
    try{const r=await api('/api/saas/media',{method:'POST',body:fd});if(run!==epoch)return;note(`${r.saved} ${r.saved===1?'file':'files'} added to your library.`);await load()}
    catch(e){note(e.message,true)}finally{drop?.classList.remove('busy')}
  }
  const drop=$('#media-drop'),input=$('#media-file');
  const choose=()=>input?.click();
  drop?.addEventListener('click',e=>{if(e.target!==input)choose()});
  drop?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}});
  ['dragenter','dragover'].forEach(t=>drop?.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over')}));
  ['dragleave','drop'].forEach(t=>drop?.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('over')}));
  drop?.addEventListener('drop',e=>upload(e.dataTransfer?.files||[]));
  input?.addEventListener('change',()=>{upload(input.files);input.value=''});
  $('#organize-library')?.addEventListener('click',()=>{if($('#video-view')?.classList.contains('ms-unified')){const m=items.find(x=>x.id===selected)||items[0];if(m)organize(m);else note('Upload a file first, then organize it.')}else choose()});
  $('#add-demo-assets')?.addEventListener('click',()=>{note('Importing straight from a social account needs that platform to approve this app. For now, save the clip from the platform and upload it here. Connect accounts under Setup > Connections.');});
  document.querySelectorAll('[data-source-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.sourceMode;document.querySelectorAll('[data-source-mode]').forEach(x=>x.classList.toggle('active',x===b));draw()}));
  $('#media-library-search')?.addEventListener('input',draw);$('#media-library-sort')?.addEventListener('change',draw);
  window.addEventListener('oprun:media-changed',()=>{load()});
  window.addEventListener('oprun:media-pick',async e=>{const id=e.detail?.id;if(!items.some(x=>x.id===id))await load();const m=items.find(x=>x.id===id);if(m)pick(m)});
  const reset=()=>{epoch++;assetDialog?.close();assetDialog=null;metadata.clear();if(folderFilter)folderFilter.value='';if(usage)usage.textContent='';items=[];selected='';mode='all';$('#media-library-search')&&($('#media-library-search').value='');$('#library-selection')?.replaceChildren(el('span',{text:'No source selected'}));draw()};
  window.addEventListener('superpro:workspace-ready',()=>{reset();if($('#video-view')&&!$('#video-view').hidden)load()});
  window.addEventListener('pagehide',reset);document.getElementById('logout')?.addEventListener('click',reset,true);
  window.addEventListener('gds:viewchange',e=>{if(e.detail?.view==='video')load()});
})();
