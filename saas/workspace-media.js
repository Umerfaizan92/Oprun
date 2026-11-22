// Media Studio → Library: private uploads per business. Tap a file to preview it (photo, video with player, audio).
(()=>{
  const {el,api,role,note}=window.SuperProUI;
  const $=s=>document.querySelector(s);
  let items=[],mode='all',epoch=0;
  const size=b=>b>1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
  const canDelete=()=>['owner','admin','super_admin'].includes(role());
  function thumb(m){
    const url=`/api/saas/media/${m.id}/file`;
    if(m.kind==='photo')return el('img',{src:url,alt:'',loading:'lazy'});
    if(m.kind==='video')return el('video',{src:url+'#t=0.1',preload:'metadata',muted:true,playsinline:true,'aria-hidden':'true'});
    return el('div',{class:'media-audio'},el('span',{text:'Audio'}));
  }
  function draw(){
    const grid=$('#media-library-grid');if(!grid)return;
    const q=($('#media-library-search')?.value||'').trim().toLowerCase(),sort=$('#media-library-sort')?.value||'recent';
    let list=items.filter(m=>(mode==='all'||m.kind===mode)&&(!q||m.original_name.toLowerCase().includes(q)));
    list=[...list].sort((a,b)=>sort==='name'?a.original_name.localeCompare(b.original_name):sort==='type'?a.kind.localeCompare(b.kind):b.created_at.localeCompare(a.created_at));
    const count=$('#library-count');if(count)count.textContent=`${items.length} ${items.length===1?'file':'files'}`;
    if(!list.length){grid.replaceChildren(el('div',{class:'empty-state'},el('b',{text:items.length?'Nothing matches':'No media yet'})));return}
    grid.replaceChildren(...list.map(m=>el('article',{class:'media-card','data-id':m.id},
      el('button',{type:'button',class:'media-pick','aria-label':`Preview ${m.original_name}`,onclick:()=>preview(list,m)},thumb(m),m.kind!=='photo'?el('span',{class:'media-play','aria-hidden':'true',text:'▶'}):null),
      el('div',{class:'media-meta'},el('b',{text:m.original_name}),el('small',{text:`${m.kind} · ${size(m.size_bytes)}`})),
      canDelete()?el('button',{type:'button',class:'media-del',text:'Delete','aria-label':`Delete ${m.original_name}`,onclick:()=>remove(m)}):null)));
  }
  function preview(list,m){window.OprunMediaViewer?.open(list,list.indexOf(m))}
  async function remove(m){
    if(!confirm(`Delete ${m.original_name}? This cannot be undone.`))return;
    try{await api('/api/saas/media/'+m.id,{method:'DELETE'});note('Deleted.');await load()}catch(e){note(e.message,true)}
  }
  async function load(){const run=epoch;try{const d=await api('/api/saas/media');if(run!==epoch)return;items=d.media||[]}catch{if(run!==epoch)return;items=[]}draw()}
  async function upload(files){
    const run=epoch,list=[...files];if(!list.length)return;
    const fd=new FormData();list.slice(0,10).forEach(f=>fd.append('files',f));
    const drop=$('#media-drop');drop?.classList.add('busy');
    try{const r=await api('/api/saas/media',{method:'POST',body:fd});if(run!==epoch)return;note(`${r.saved} ${r.saved===1?'file':'files'} added.`);window.dispatchEvent(new Event('oprun:media-changed'))}
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
  document.querySelectorAll('[data-source-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.sourceMode;document.querySelectorAll('[data-source-mode]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))});draw()}));
  $('#media-library-search')?.addEventListener('input',draw);$('#media-library-sort')?.addEventListener('change',draw);
  let loading=false;window.addEventListener('oprun:media-changed',()=>{if(loading)return;loading=true;load().finally(()=>{loading=false})});
  const reset=()=>{epoch++;items=[];mode='all';const s=$('#media-library-search');if(s)s.value='';draw()};
  window.addEventListener('superpro:workspace-ready',()=>{reset();if($('#video-view')&&!$('#video-view').hidden)load()});
  window.addEventListener('pagehide',reset);document.getElementById('logout')?.addEventListener('click',reset,true);
  window.addEventListener('gds:viewchange',e=>{if(e.detail?.view==='video')load()});
})();
