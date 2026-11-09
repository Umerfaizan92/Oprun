(() => {
  const login=document.querySelector('#founder-recovery-login'),approval=document.querySelector('#founder-recovery-approval'),message=document.querySelector('#founder-recovery-message');
  let token='',account=null;
  const request=async(url,body)=>{
    const response=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json',...(token?{'x-admin-key':token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Recovery request failed.');return data;
  };
  login.onsubmit=async e=>{e.preventDefault();const button=login.querySelector('button');button.disabled=true;try{
    const data=await request('/api/operator/login',{key:login.elements.key.value,code:login.elements.code.value});
    login.reset();token=data.token;account=await request('/api/operator/founder-recovery');
    document.querySelector('#founder-recovery-account').textContent=`Approve recovery for ${account.email}. Verification will require ${account.sms_required?'email and SMS codes':'a 6-digit email code'}. Existing sessions will be signed out.`;
    login.hidden=true;approval.hidden=false;message.textContent='Review the account before approving.';
  }catch(err){token='';message.textContent=err.message;}finally{button.disabled=false;}};
  approval.onsubmit=async e=>{e.preventDefault();const button=approval.querySelector('button');button.disabled=true;try{
    await request('/api/operator/founder-recovery/approve',{user_id:account.user_id,reason:approval.elements.reason.value,confirm:approval.elements.confirm.checked});
    token='';approval.hidden=true;message.textContent='Recovery approved. Sign in with your account password and complete verification.';
    const link=document.createElement('a');link.href='sign-in.html';link.textContent='Continue to sign in';message.after(link);
  }catch(err){message.textContent=err.message;button.disabled=false;}};
})();
