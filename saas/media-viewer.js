// T-185: in-app preview for photos, videos and audio in the media library and for AI-generated videos.
// window.OprunMediaViewer.open(items, index, {onUse}) where items are {id, kind, original_name}.
// Built with textContent only. No autoplaying loops: a video plays once when opened, with full player controls.
(()=>{
  const mk=(tag,props={},...kids)=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(v==null||v===false)continue;if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v===true?'':String(v))}n.append(...kids.filter(Boolean));return n};
  const url=m=>`/api/saas/media/${encodeURIComponent(m.id)}/file`;
  let dlg,list=[],at=0,opts={};
  function build(){
    dlg=mk('dialog',{class:'mv-dialog','aria-label':'Media preview'});
    const head=mk('header',{class:'mv-head'},mk('div',{class:'mv-title'},mk('b',{class:'mv-name'}),mk('small',{class:'mv-count'})),
      mk('button',{type:'button',class:'mv-close','aria-label':'Close preview',text:'×',onclick:()=>dlg.close()}));
    const stage=mk('div',{class:'mv-stage'});
    const prev=mk('button',{type:'button',class:'mv-nav mv-prev','aria-label':'Previous',text:'‹',onclick:()=>go(-1)});
    const next=mk('button',{type:'button',class:'mv-nav mv-next','aria-label':'Next',text:'›',onclick:()=>go(1)});
    const foot=mk('footer',{class:'mv-foot'},mk('a',{class:'secondary-button mv-download',download:'',text:'Download'}),mk('button',{type:'button',class:'primary-button mv-use',text:'Use as render source'}));
    dlg.append(head,mk('div',{class:'mv-body'},prev,stage,next),foot);
    dlg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();go(-1)}if(e.key==='ArrowRight'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();go(1)}});
    dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
    dlg.addEventListener('close',()=>{dlg.querySelectorAll('video,audio').forEach(v=>{try{v.pause()}catch{}});dlg.querySelector('.mv-stage').replaceChildren()});
    document.body.append(dlg);
  }
  function show(){
    const m=list[at];if(!m)return;
    dlg.querySelector('.mv-name').textContent=m.original_name||'Media';
    dlg.querySelector('.mv-count').textContent=list.length>1?`${at+1} of ${list.length} · ${m.kind}`:m.kind;
    const stage=dlg.querySelector('.mv-stage');stage.querySelectorAll('video,audio').forEach(v=>{try{v.pause()}catch{}});
    let media;
    if(m.kind==='photo')media=mk('img',{src:url(m),alt:m.original_name||'Photo'});
    else if(m.kind==='video'){media=mk('video',{src:url(m),controls:true,playsinline:true,preload:'auto'});media.autoplay=true;media.loop=false}
    else media=mk('div',{class:'mv-audio'},mk('b',{text:m.original_name||'Audio'}),mk('audio',{src:url(m),controls:true,preload:'metadata'}));
    stage.replaceChildren(media);
    dlg.querySelectorAll('.mv-nav').forEach(b=>b.hidden=list.length<2);
    const dl=dlg.querySelector('.mv-download');dl.href=url(m);dl.setAttribute('download',m.original_name||'media');
    const use=dlg.querySelector('.mv-use');use.textContent=document.querySelector('#video-view')?.classList.contains('ms-unified')?'Use as guide':'Use as render source';use.hidden=!opts.onUse;use.onclick=()=>{opts.onUse?.(m);dlg.close()};
  }
  function go(step){if(list.length<2)return;at=(at+step+list.length)%list.length;show()}
  const resetWorkspace=()=>{list=[];opts={};at=0;if(dlg){if(dlg.open)dlg.close();dlg.querySelector('.mv-stage').replaceChildren();dlg.querySelector('.mv-name').textContent='';dlg.querySelector('.mv-count').textContent='';dlg.querySelector('.mv-download').removeAttribute('href');dlg.querySelector('.mv-use').onclick=null;}};
  window.addEventListener('superpro:workspace-ready',resetWorkspace);window.addEventListener('pagehide',resetWorkspace);document.getElementById('logout')?.addEventListener('click',resetWorkspace,true);
  window.OprunMediaViewer={open(items,index=0,options={}){if(!items?.length)return;if(!dlg)build();list=items;at=Math.max(0,Math.min(index,items.length-1));opts=options;show();if(!dlg.open)dlg.showModal();dlg.querySelector('.mv-close').focus()}};
})();
