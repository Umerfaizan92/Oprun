// TR-25: temporary, dismissible suggestions.
// Brief section 11: suggestions are compact and contextual, completed ones disappear, dismissed ones are remembered
// for this person, and an unresolved critical security, billing or compliance warning can never be hidden.
// Markup: <div data-tip="workforce-work-rights@1" data-tip-kind="info|security|billing|compliance"
//              data-tip-level="info|critical" data-tip-resolved="0|1">…</div>
// The id carries a version (after @). Changing the text means bumping the version, so the new text is seen once.
(function(root){
  const CRITICAL_KINDS=new Set(['security','billing','compliance']);
  const PREFIX='oprun.tips.v1';

  function isCritical(tip){return !!tip&&tip.level==='critical'&&CRITICAL_KINDS.has(tip.kind)}
  // A critical warning may be hidden only once the problem behind it is fixed.
  function canDismiss(tip){return !!tip&&!!tip.id&&!(isCritical(tip)&&!tip.resolved)}
  function visible(tip,dismissed){
    if(!tip||!tip.id)return false;
    if(tip.resolved)return false;                   // completed or fixed: nothing left to suggest
    if(isCritical(tip))return true;                 // unresolved critical warning: always shown
    return !(dismissed&&Object.prototype.hasOwnProperty.call(dismissed,tip.id));
  }
  function storeKey(session){
    const u=session?.user?.id,o=session?.organisation?.id;
    return u==null?null:`${PREFIX}.${o==null?'none':o}.${u}`;
  }
  function makeStore(storage,key){
    let cache=null;
    const read=()=>{if(cache)return cache;cache={};if(!key||!storage)return cache;
      try{const v=JSON.parse(storage.getItem(key)||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))cache=v}catch{cache={}}
      return cache};
    return{
      all:read,
      has:id=>Object.prototype.hasOwnProperty.call(read(),id),
      dismiss(tip,now=Date.now()){
        if(!canDismiss(tip))return false;
        const d={...read(),[tip.id]:now};cache=d;
        try{storage&&key&&storage.setItem(key,JSON.stringify(d))}catch{}
        return true;
      },
      reset(){cache={};try{storage&&key&&storage.removeItem(key)}catch{}}
    };
  }

  const api={isCritical,canDismiss,visible,storeKey,makeStore};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return}

  // Browser part.
  let store=makeStore(null,null);
  const safeStorage=()=>{try{return root.localStorage}catch{return null}};
  const tipOf=el=>({id:el.dataset.tip,kind:el.dataset.tipKind||'info',level:el.dataset.tipLevel||'info',resolved:el.dataset.tipResolved==='1'});
  function apply(el){
    const tip=tipOf(el);
    el.hidden=!visible(tip,store.all());
    if(canDismiss(tip)&&!el.querySelector(':scope > [data-tip-dismiss]')){
      const b=document.createElement('button');
      b.type='button';b.className='tip-dismiss';b.setAttribute('data-tip-dismiss','');
      b.setAttribute('aria-label',el.dataset.tipLabel||'Dismiss this tip');b.title=el.dataset.tipLabel||'Dismiss';b.textContent=el.dataset.tipText||'×';if(el.dataset.tipText)b.classList.add('tip-dismiss-text');
      el.classList.add('tip-dismissible');el.append(b);
    }
    if(!canDismiss(tip))el.querySelector(':scope > [data-tip-dismiss]')?.remove();
  }
  // Only versioned suggestion ids ("name@1"). A plain data-tip is the hover tooltip text on buttons and links and
  // must never be hidden or get a dismiss button inside it.
  const SEL='[data-tip*="@"]';
  function scan(scope){(scope||document).querySelectorAll(SEL).forEach(apply)}
  function bindSession(){store=makeStore(safeStorage(),storeKey(root.GDS_SESSION));scan()}
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-tip-dismiss]');if(!b)return;
    const el=b.closest(SEL);if(!el)return;
    e.preventDefault();
    if(store.dismiss(tipOf(el))){
      el.hidden=true;
      root.SuperProUI?.note?.(el.dataset.tipNote||'Tip hidden. It will not show again for you.');
    }
  });
  root.addEventListener('superpro:workspace-ready',bindSession);
  if(root.GDS_SESSION)bindSession();
  root.OprunTips={...api,scan,apply,resolve(id,yes=true){const el=document.querySelector(`[data-tip="${CSS.escape(id)}"]`);if(el){el.dataset.tipResolved=yes?'1':'0';apply(el)}},dismissed:()=>({...store.all()})};
})(typeof window!=='undefined'?window:globalThis);
