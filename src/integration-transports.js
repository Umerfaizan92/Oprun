import crypto from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { isIP } from 'node:net';

const parse = text => { try{return JSON.parse(text||'{}')}catch{return {}} };
const invalid = message => Object.assign(new Error(message),{status:400});
export function createTenantTransports({db,runtime,lookupTxt=resolveTxt}) {
  const row = org => db.prepare("SELECT * FROM organisation_integrations WHERE organisation_id=? AND provider='email_sms'").get(org);
  function credentials(org) {
    const record=row(org), settings=parse(record?.settings_json);
    if(record?.status!=='connected' || !settings.tenant_transport || !settings.token_bundle) return null;
    return runtime.decryptBundle(settings.token_bundle);
  }
  function environment(org,base={}) {
    if(!org || org==='platform' || org==='superpro') return base;
    const record=row(org),settings=parse(record?.settings_json);
    if(!settings.tenant_transport) return base; // Explicit compatibility for existing platform transport.
    // An explicitly owned transport never silently falls back to the platform's account.
    if(record.status!=='connected')throw Object.assign(new Error('Reconnect this workspace email/SMS provider.'),{status:409});
    const own=credentials(org);
    return {...base,RESEND_OUTBOUND_API_KEY:'',RESEND_API_KEY:own?.email?.api_key||'',SAAS_VERIFY_FROM:own?.email?.sender||'',
      PLATFORM_NOTICE_FROM:own?.email?.sender||'',NOTIFY_FROM:own?.email?.sender||'',SUPPORT_FROM:own?.email?.sender||'',
      RESEND_WEBHOOK_SECRET:own?.email?.webhook_secret||'',TELNYX_API_KEY:own?.sms?.api_key||'',
      TELNYX_FROM_NUMBER:own?.sms?.number||'',TELNYX_PHONE_NUMBER:own?.sms?.number||'',
      TELNYX_PUBLIC_KEY:own?.sms?.public_key||'',TELNYX_MESSAGING_PROFILE_ID:own?.sms?.messaging_profile_id||'',RESEND_API_BASE_URL:'https://api.resend.com',TELNYX_API_BASE_URL:'https://api.telnyx.com/v2'};
  }
  // Provider checks use an API key, not a sign-in, so a refused key gets a plain explanation instead of
  // "authorisation expired" (T-145). Messages never include the key.
  async function ask(kind,url,key){
    try{return await runtime.requestJson(url,{headers:{authorization:'Bearer '+key}})}
    catch(e){
      const s=Number(e.status||0),m=String(e.message||'');
      if(kind==='email'&&(/restricted/i.test(m)||((s===401||s===403)&&/only send|sending access/i.test(m))))throw invalid('This Resend key can only send emails, so Oprun cannot confirm your sender domain. In Resend, go to API Keys, create a key with "Full access", and paste that key here.');
      if(kind==='email'&&(s===401||s===403))throw invalid('Resend did not accept this API key. In Resend, go to API Keys, create a new key with "Full access", copy all of it (it starts with re_) and paste it here.');
      if(kind==='sms'&&s===401)throw invalid('Telnyx did not accept this API key. In the Telnyx portal go to Account Settings, API Keys, create a key and copy all of it (it starts with KEY and is long, about 60 characters). A key from a different Telnyx account will not work.');
      if(kind==='sms'&&s===403)throw invalid('This Telnyx key is not allowed to read your numbers or messaging profiles. Use a key from the account that owns the number.');
      if(kind==='sms'&&s===404)throw invalid('Telnyx could not find that messaging profile in this account. Copy the Profile ID from Messaging, Profiles.');
      throw e;
    }
  }
  async function verify(kind,value) {
    if(kind==='email') {
      if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value.sender||''))throw invalid('Enter the verified business sender email address.');
      const d=await ask('email','https://api.resend.com/domains?limit=100',value.api_key);
      const domain=value.sender.split('@')[1].toLowerCase();
      const verified=(d.data||[]).find(x=>String(x.name).toLowerCase()===domain && x.status==='verified');
      if(!verified)throw invalid('The sender domain is not verified in this Resend account. Complete its DNS verification first; use a key that can read domains.');
      return {sender:value.sender,domain,domain_id:verified.id,status:'verified',tested_at:new Date().toISOString()};
    }
    if(kind==='sms') {
      // Australian landline numbers (02/03/07/08) cannot send texts. A business can send from an SMS-capable mobile
      // number, or from a sender name (alphanumeric sender ID, e.g. FleetParlour) through a Telnyx messaging profile.
      const senderName=/^(?=.*[A-Za-z])[A-Za-z0-9 ]{3,11}$/.test(value.number||'');
      if(!senderName&&!/^\+[1-9]\d{7,14}$/.test(value.number||''))throw invalid('Enter your Telnyx mobile number in international format (for example +61412345678), or a sender name of 3 to 11 letters.');
      if(/^\+61[2378]\d{8}$/.test(value.number||''))throw invalid('Australian landline numbers cannot send text messages. Use an Australian mobile number from Telnyx, or a sender name with a messaging profile.');
      if(senderName){
        if(!/^[0-9a-f-]{20,80}$/i.test(value.messaging_profile_id||''))throw invalid('A sender name needs your Telnyx messaging profile ID (Messaging > Profiles in the Telnyx portal).');
        const prof=await ask('sms','https://api.telnyx.com/v2/messaging_profiles/'+encodeURIComponent(value.messaging_profile_id),value.api_key);
        if(!prof?.data?.id)throw invalid('This messaging profile was not found in the authorised Telnyx account.');
        return {number:value.number,sender_type:'name',messaging_profile_id:value.messaging_profile_id,status:'verified',tested_at:new Date().toISOString(),note:'Messaging profile found. Make sure alphanumeric sender ID is enabled for Australia on this profile. Customers cannot reply to a sender name.'};
      }
      const d=await ask('sms','https://api.telnyx.com/v2/phone_numbers?filter[phone_number]='+encodeURIComponent(value.number),value.api_key);
      const number=(d.data||[]).find(x=>x.phone_number===value.number);
      if(!number)throw invalid('This phone number was not found in the authorised Telnyx account.');
      if(value.messaging_profile_id){await ask('sms','https://api.telnyx.com/v2/messaging_profiles/'+encodeURIComponent(value.messaging_profile_id),value.api_key);if(number.messaging_profile_id&&number.messaging_profile_id!==value.messaging_profile_id)throw invalid('This number is attached to a different messaging profile in Telnyx. Use that profile\'s ID, or move the number to this profile.');}
      if(!value.messaging_profile_id&&!number.messaging_profile_id)throw invalid('This number is not attached to a messaging profile in Telnyx, so it cannot send texts yet. In Telnyx open Messaging, Profiles, add the number to a profile, then paste the Profile ID here.');
      return {number:value.number,sender_type:'number',...(value.messaging_profile_id?{messaging_profile_id:value.messaging_profile_id}:{}),status:'verified',tested_at:new Date().toISOString(),note:'Account ownership checked. Configure a messaging profile and signed webhooks in Telnyx before live delivery.'};
    }
    throw invalid('Choose email or SMS.');
  }
  async function save(org,kind,value) {
    const current=row(org); if(!current)throw invalid('Open Connections before saving a provider.');
    if(typeof value.api_key!=='string' || value.api_key.length<10 || value.api_key.length>1000 || /[\r\n]/.test(value.api_key))throw invalid('Enter a valid provider API key.');
    if(value.public_key && Buffer.from(value.public_key,'base64').length!==32)throw invalid('Telnyx public key must be a Base64 Ed25519 public key.');
    if(value.webhook_secret && !/^whsec_[A-Za-z0-9+/=]+$/.test(value.webhook_secret))throw invalid('Use the Resend webhook signing secret starting with whsec_.');
    const checked=await verify(kind,value), old=credentials(org)||{},settings=parse(current.settings_json);
    const bundle={...old,[kind]:{api_key:value.api_key,...(kind==='email'?{sender:value.sender,webhook_secret:value.webhook_secret||''}:{number:value.number,public_key:value.public_key||'',messaging_profile_id:value.messaging_profile_id||''})}};
    const transport={...settings.transport,[kind]:checked};
    const next={...settings,tenant_transport:true,transport,token_bundle:runtime.encryptBundle(bundle),last_test_status:'pass',last_tested_at:checked.tested_at,last_test_error:null};
    db.transaction(()=>{
      const channel=kind==='email'?'email':'sms',address=kind==='email'?value.sender.toLowerCase():value.number;
      const used=db.prepare('SELECT organisation_id FROM comms_channels WHERE channel=? AND address=?').get(channel,address);
      if(used && used.organisation_id!==org)throw Object.assign(new Error('This sender is already routed to another workspace. Use a different sender or ask its owner to disconnect it.'),{status:409});
      db.prepare("INSERT INTO comms_channels(organisation_id,channel,address,status,activated_at,created_at) VALUES (?,?,?,'active',?,?) ON CONFLICT(organisation_id,channel) DO UPDATE SET address=excluded.address,status='active',activated_at=excluded.activated_at").run(org,channel,address,checked.tested_at,checked.tested_at);
      db.prepare("UPDATE organisation_integrations SET settings_json=?,status='connected',account_label=?,connected_at=COALESCE(connected_at,?),updated_at=? WHERE organisation_id=? AND provider='email_sms'")
        .run(JSON.stringify(next),'Workspace-owned email/SMS provider',checked.tested_at,checked.tested_at,org);
    })();
    return transport;
  }
  async function test(org) {
    const own=credentials(org); if(!own)throw Object.assign(new Error('Add your workspace email or SMS provider in the setup form. Platform transport is a separate service.'),{status:409});
    const checks=[]; for(const kind of ['email','sms']) if(own[kind]) checks.push({service:kind,...await verify(kind,own[kind])});
    return checks;
  }
  function saveWebsite(org,url) {
    let u;try{u=new URL(url)}catch{throw invalid('Enter an HTTPS website address.')}
    if(u.protocol!=='https:' || u.username || u.password || u.port || isIP(u.hostname) || !/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/i.test(u.hostname) || /\.(localhost|local|internal|test|invalid|example)$/i.test(u.hostname))throw invalid('Use a public HTTPS website domain without a port or credentials.');
    const record=db.prepare("SELECT * FROM organisation_integrations WHERE organisation_id=? AND provider='website'").get(org);
    if(!record)throw invalid('Open Connections before configuring the website.');
    const old=parse(record.settings_json),same=old.website?.url===u.origin;
    const website=same?old.website:{url:u.origin,hostname:u.hostname,verification_name:'_oprun.'+u.hostname,verification_value:'oprun-verification='+crypto.randomBytes(24).toString('base64url'),verified:false};
    const at=new Date().toISOString();
    db.prepare("UPDATE organisation_integrations SET settings_json=?,status=?,account_label=?,updated_at=? WHERE organisation_id=? AND provider='website'")
      .run(JSON.stringify({...old,...(!same?{last_test_status:null,last_tested_at:null,diagnostic:null}:{}),website}),website.verified?'connected':'setup_ready',u.hostname,at,org);
    return website;
  }
  async function verifyWebsite(org) {
    const record=db.prepare("SELECT * FROM organisation_integrations WHERE organisation_id=? AND provider='website'").get(org),settings=parse(record?.settings_json),site=settings.website;
    if(!site)throw invalid('Save your website address first.');
    let entries=[];
    // Records made before the rename use _superpro; newer ones _oprun. Either name is accepted, as long as the value is this workspace's.
    const names=[...new Set([site.verification_name,'_oprun.'+site.hostname,'_superpro.'+site.hostname])];
    const look=(n)=>Promise.race([lookupTxt(n),new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error('DNS verification timed out.')),10000);t.unref?.()})]).catch(()=>[]);
    entries=(await Promise.all(names.map(look))).flat();
    if(!entries.length)throw Object.assign(new Error(`The verification TXT record is not visible yet. In most domain dashboards the Name/Host is just ${site.verification_name.slice(0,-(site.hostname.length+1))} (the dashboard adds .${site.hostname} itself). Changes can take a few minutes to a few hours to appear; then choose Verify website again.`),{status:409});
    if(!entries.some(entry=>entry.join('')===site.verification_value))throw Object.assign(new Error('The website verification TXT record does not match this workspace.'),{status:409});
    const at=new Date().toISOString(),website={...site,verified:true,verified_at:at};
    db.prepare("UPDATE organisation_integrations SET settings_json=?,status='connected',connected_at=COALESCE(connected_at,?),updated_at=? WHERE organisation_id=? AND provider='website'").run(JSON.stringify({...settings,website,last_test_status:'pass',last_tested_at:at}),at,at,org);
    return website;
  }
  return {environment,credentials,save,test,saveWebsite,verifyWebsite};
}
