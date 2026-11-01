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
    return {...base,RESEND_API_KEY:own?.email?.api_key||'',SAAS_VERIFY_FROM:own?.email?.sender||'',
      PLATFORM_NOTICE_FROM:own?.email?.sender||'',NOTIFY_FROM:own?.email?.sender||'',SUPPORT_FROM:own?.email?.sender||'',
      RESEND_WEBHOOK_SECRET:own?.email?.webhook_secret||'',TELNYX_API_KEY:own?.sms?.api_key||'',
      TELNYX_FROM_NUMBER:own?.sms?.number||'',TELNYX_PHONE_NUMBER:own?.sms?.number||'',
      TELNYX_PUBLIC_KEY:own?.sms?.public_key||'',RESEND_API_BASE_URL:'https://api.resend.com',TELNYX_API_BASE_URL:'https://api.telnyx.com/v2'};
  }
  async function verify(kind,value) {
    if(kind==='email') {
      if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value.sender||''))throw invalid('Enter the verified business sender email address.');
      const d=await runtime.requestJson('https://api.resend.com/domains?limit=100',{headers:{authorization:'Bearer '+value.api_key}});
      const domain=value.sender.split('@')[1].toLowerCase();
      const verified=(d.data||[]).find(x=>String(x.name).toLowerCase()===domain && x.status==='verified');
      if(!verified)throw invalid('The sender domain is not verified in this Resend account. Complete its DNS verification first; use a key that can read domains.');
      return {sender:value.sender,domain,domain_id:verified.id,status:'verified',tested_at:new Date().toISOString()};
    }
    if(kind==='sms') {
      if(!/^\+[1-9]\d{7,14}$/.test(value.number||''))throw invalid('Enter your Telnyx number in international format, for example +61412345678.');
      const d=await runtime.requestJson('https://api.telnyx.com/v2/phone_numbers?filter[phone_number]='+encodeURIComponent(value.number),{headers:{authorization:'Bearer '+value.api_key}});
      const number=(d.data||[]).find(x=>x.phone_number===value.number);
      if(!number)throw invalid('This phone number was not found in the authorised Telnyx account.');
      return {number:value.number,status:'verified',tested_at:new Date().toISOString(),note:'Account ownership checked. Configure a messaging profile and signed webhooks in Telnyx before live delivery.'};
    }
    throw invalid('Choose email or SMS.');
  }
  async function save(org,kind,value) {
    const current=row(org); if(!current)throw invalid('Open Connections before saving a provider.');
    if(typeof value.api_key!=='string' || value.api_key.length<10 || value.api_key.length>1000 || /[\r\n]/.test(value.api_key))throw invalid('Enter a valid provider API key.');
    if(value.public_key && Buffer.from(value.public_key,'base64').length!==32)throw invalid('Telnyx public key must be a Base64 Ed25519 public key.');
    if(value.webhook_secret && !/^whsec_[A-Za-z0-9+/=]+$/.test(value.webhook_secret))throw invalid('Use the Resend webhook signing secret starting with whsec_.');
    const checked=await verify(kind,value), old=credentials(org)||{},settings=parse(current.settings_json);
    const bundle={...old,[kind]:{api_key:value.api_key,...(kind==='email'?{sender:value.sender,webhook_secret:value.webhook_secret||''}:{number:value.number,public_key:value.public_key||''})}};
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
    const website=same?old.website:{url:u.origin,hostname:u.hostname,verification_name:'_superpro.'+u.hostname,verification_value:'superpro-verification='+crypto.randomBytes(24).toString('base64url'),verified:false};
    const at=new Date().toISOString();
    db.prepare("UPDATE organisation_integrations SET settings_json=?,status=?,account_label=?,updated_at=? WHERE organisation_id=? AND provider='website'")
      .run(JSON.stringify({...old,...(!same?{last_test_status:null,last_tested_at:null,diagnostic:null}:{}),website}),website.verified?'connected':'setup_ready',u.hostname,at,org);
    return website;
  }
  async function verifyWebsite(org) {
    const record=db.prepare("SELECT * FROM organisation_integrations WHERE organisation_id=? AND provider='website'").get(org),settings=parse(record?.settings_json),site=settings.website;
    if(!site)throw invalid('Save your website address first.');
    let entries=[];
    try{entries=await Promise.race([lookupTxt(site.verification_name),new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error('DNS verification timed out.')),10000);t.unref?.()})])}catch{throw Object.assign(new Error('The verification TXT record is not visible yet. Check the record name/value in your domain dashboard and retry after DNS propagation.'),{status:409})}
    if(!entries.some(entry=>entry.join('')===site.verification_value))throw Object.assign(new Error('The website verification TXT record does not match this workspace.'),{status:409});
    const at=new Date().toISOString(),website={...site,verified:true,verified_at:at};
    db.prepare("UPDATE organisation_integrations SET settings_json=?,status='connected',connected_at=COALESCE(connected_at,?),updated_at=? WHERE organisation_id=? AND provider='website'").run(JSON.stringify({...settings,website,last_test_status:'pass',last_tested_at:at}),at,at,org);
    return website;
  }
  return {environment,credentials,save,test,saveWebsite,verifyWebsite};
}
