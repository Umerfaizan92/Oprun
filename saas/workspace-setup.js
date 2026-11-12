// Business Setup checklist, shared by Brand & Settings and the Command Centre "Workflow Guidance" section.
// Every status comes from the signed-in person's own authorised endpoints; nothing is assumed or invented.
// Master prompt fix (12 Nov 2026): the "Open" buttons used data-jump="onboarding" while already on that page, so a
// click changed nothing. Each step now opens its real page, selects the right tab and focuses the field to fill in.
(()=>{
  const {el,api,onView,role}=window.SuperProUI;
  const nav=()=>window.SuperProNav;
  const allowed=()=>new Set(nav()?.sequence?.(window.GDS_SESSION?.user?.role||role())||[]);
  const OWNER=['owner','admin','super_admin'];
  const CONNECTED=new Set(['connected','active']);
  const hosts=new Set();
  let state={status:'idle',steps:[],error:'',at:0,meta:{}};
  let loading=null;

  async function load(){
    if(loading)return loading;
    loading=(async()=>{
      state={...state,status:state.steps.length?'refreshing':'loading',error:''};paintAll();
      const owner=OWNER.includes(role()),views=allowed();
      const call=url=>api(url).then(v=>({ok:true,v}),e=>({ok:false,e}));
      const [cc,ob,jobs,conn,oh]=await Promise.all([
        call('/api/saas/command-centre'),call('/api/saas/onboarding'),
        views.has('jobs')||owner?call('/api/saas/work-orders'):Promise.resolve(null),
        views.has('integrations')?call('/api/saas/integrations/self-service'):Promise.resolve(null),
        owner?call('/api/saas/finance/overheads'):Promise.resolve(null)]);
      if(!ob.ok&&!cc.ok){state={...state,status:'error',error:'Your setup status could not be loaded.'};loading=null;paintAll();return state}
      const T=cc.ok&&cc.v?.terms||{job:'Job',jobs:'Jobs',customer:'Customer',team:'Team'},p=ob.ok&&ob.v?.profile||{};
      // A step is only marked unknown (never "done") when its data could not be read.
      const known=r=>r?r.ok:null;
      const list=conn?.ok?(conn.v?.integrations||conn.v?.providers||[]):[];
      const steps=[
        {key:'business',done:ob.ok?!!(p.completed_at||p.business_type||p.industry_code):null,title:'Tell us what your business does',text:'Pick your industry so every page uses your words.',view:'onboarding',tab:'onboarding-business-profile',focus:'#industry-search, #business-type'},
        {key:'services',done:ob.ok?(p.services||[]).length>0:null,title:'List your services',text:`What you sell, so quotes and ${String(T.customer||'customer').toLowerCase()} replies are accurate.`,view:'onboarding',tab:'onboarding-services-brand',focus:'#onboarding-services-brand input, #onboarding-services-brand textarea'},
        {key:'contact',done:ob.ok?!!(p.phone||p.website):null,title:'Add contact details',text:'Phone and website go on replies and documents.',view:'onboarding',tab:'onboarding-contact',focus:'#onboarding-contact input'},
        ...(conn?[{key:'channel',done:known(conn)===false?null:list.some(x=>CONNECTED.has(x.status)),title:'Connect a channel',text:'Facebook, Instagram, WhatsApp, email and more, so enquiries land in one inbox.',view:'integrations',focus:'#integrations-view h1'}]:[]),
        ...(jobs?[{key:'job',done:known(jobs)===false?null:(jobs.v?.jobs||jobs.v?.work_orders||[]).length>0,title:`Create your first ${String(T.job||'job').toLowerCase()}`,text:'Jobs drive scheduling and profit.',view:'jobs',focus:'#job-form input, #job-form select'}]:[]),
        ...(oh?[{key:'overheads',done:known(oh)===false?null:(oh.v?.overheads||[]).length>0,title:'Add fixed overheads',text:'Rent, insurance and software, so profit is real.',view:'finance',fin:'costs',focus:'#fin-overhead-form input'}]:[])
      ];
      state={status:'ready',steps,error:'',at:Date.now(),meta:{industry:cc.ok&&cc.v?.business?.code!=='custom'?cc.v?.business?.industry:''}};
      loading=null;paintAll();
      window.dispatchEvent(new CustomEvent('oprun:setup-status',{detail:summary()}));
      return state;
    })();
    return loading;
  }
  const summary=()=>({done:state.steps.filter(s=>s.done===true).length,total:state.steps.length,status:state.status});

  // Opens the step's page, its tab, and focuses the field. Works when already on that page (the old bug).
  function go(step){
    const views=allowed();if(!views.has(step.view))return false;
    const target=document.getElementById(`${step.view}-view`);
    const finish=()=>{
      if(step.tab)document.querySelector(`.settings-nav [data-settings-target="${step.tab}"]`)?.click();
      if(step.fin)document.querySelector(`[data-fin-tab="${step.fin}"]`)?.click();
      requestAnimationFrame(()=>{const f=document.querySelector(step.focus);const box=(step.tab&&document.getElementById(step.tab))||f;
        box?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
        if(f){if(!f.matches('input,select,textarea,button,a,[tabindex]'))f.setAttribute('tabindex','-1');f.focus({preventScroll:true})}});
    };
    if(target&&!target.hidden){finish();return true}
    location.hash='#'+(nav()?.pathFor?.(step.view)||step.view);
    const t0=Date.now();(function wait(){const v=document.getElementById(`${step.view}-view`);if(v&&!v.hidden)return setTimeout(finish,60);if(Date.now()-t0<4000)setTimeout(wait,80)})();
    return true;
  }

  function paint(host){
    const views=allowed(),{done,total}=summary();
    if(state.status==='loading'||state.status==='idle'){host.setAttribute('aria-busy','true');host.replaceChildren(el('p',{class:'setup-state muted',role:'status',text:'Checking your setup…'}));return}
    host.removeAttribute('aria-busy');
    if(state.status==='error'){host.replaceChildren(el('div',{class:'setup-state setup-error',role:'alert'},el('p',{text:`${state.error} Nothing has changed.`}),el('button',{type:'button',class:'secondary-button compact','data-setup-retry':'',text:'Try again'})));return}
    if(!total){host.replaceChildren(el('p',{class:'setup-state muted',text:'There are no setup steps for your role. Your business owner manages workspace setup.'}));return}
    const complete=done===total;
    host.replaceChildren(
      el('div',{class:'setup-head'},el('div',{},el('h2',{text:complete?'Your workspace is set up':`Set up your workspace: ${done} of ${total} done`}),el('p',{text:complete?'Every setup step is complete. You can change any of them at any time.':state.meta.industry?`Tuned for ${String(state.meta.industry).toLowerCase()}.`:'Do these in any order. Each one takes a minute or two.'})),
        el('div',{class:'setup-bar',role:'progressbar','aria-label':'Setup progress','aria-valuenow':String(done),'aria-valuemin':'0','aria-valuemax':String(total)},el('i',{style:`width:${Math.round(done/total*100)}%`}))),
      el('ol',{class:'setup-list'},...state.steps.map((s,i)=>{
        const can=views.has(s.view);
        const action=s.done===true?el('em',{class:'setup-done',text:'Done'}):can?el('button',{type:'button',class:'secondary-button compact','data-setup-step':String(i),'aria-label':`${s.done===null?'Check':'Open'}: ${s.title}`,text:s.done===null?'Check':'Open'}):el('small',{class:'setup-locked',text:'Ask your owner'});
        return el('li',{class:s.done===true?'done':s.done===null?'unknown':'', 'data-setup-key':s.key},el('span',{class:'setup-tick','aria-hidden':'true',text:s.done===true?'✓':s.done===null?'?':''}),el('div',{},el('b',{text:s.title}),el('small',{text:s.done===null?'Status could not be read right now. Open it to check.':s.text})),action)})),
      el('div',{class:'setup-foot'},el('small',{role:'status',text:state.status==='refreshing'?'Refreshing…':`Checked ${new Date(state.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`}),el('button',{type:'button',class:'text-button','data-setup-retry':'',text:'Refresh'})));
  }
  function paintAll(){for(const h of hosts)if(h.isConnected)paint(h);else hosts.delete(h)}
  function render(host){if(!host)return;hosts.add(host);if(!host.dataset.setupBound){host.dataset.setupBound='1';host.addEventListener('click',e=>{
    const r=e.target.closest('[data-setup-retry]'),b=e.target.closest('[data-setup-step]');
    if(r){e.preventDefault();load();}
    if(b){e.preventDefault();const s=state.steps[Number(b.dataset.setupStep)];if(s&&!go(s))window.SuperProUI.note?.('This step is not available for your account. Ask your business owner.',true)}
  })}
    paint(host);if(state.status==='idle'||Date.now()-state.at>15000)load();}

  let onboardingHost=null;
  function build(){
    const view=document.querySelector('#onboarding-view');if(!view)return;
    if(!onboardingHost){onboardingHost=el('section',{class:'panel setup-check','aria-label':'Setup checklist',id:'setup-checklist'});(view.querySelector('.page-heading')||view.firstElementChild).after(onboardingHost)}
    render(onboardingHost);
  }
  onView('onboarding',{enter:build});
  // Saving the business profile, a connection, a job or an overhead updates the checklist on next view.
  document.addEventListener('submit',e=>{if(e.target.matches?.('#onboarding-form,#job-form,#fin-overhead-form'))setTimeout(()=>{state.at=0;if(hosts.size)load()},1200)},true);
  window.OprunSetupChecklist={render,refresh:load,summary,go:key=>{const s=state.steps.find(x=>x.key===key);return s?go(s):false}};
})();
