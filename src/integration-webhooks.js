import {Resend} from 'resend';

// A workspace-specific signature proves the sending account, not ownership of
// arbitrary message IDs. Check both before invoking the shared receipt handlers.
export function installTenantIntegrationWebhooks(app,{db,credentials,verifyTelnyx,receiveEmail,receipt,onProviderEvent,receiveResend=async(key,id)=>new Resend(key).emails.receiving.get(id)}) {
  db.exec(`CREATE TABLE IF NOT EXISTS integration_tenant_receipt_events (organisation_id TEXT NOT NULL,provider TEXT NOT NULL,event_id TEXT NOT NULL,message_id TEXT NOT NULL,state TEXT NOT NULL,kind TEXT,created_at TEXT NOT NULL,applied INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(organisation_id,provider,event_id));CREATE INDEX IF NOT EXISTS tenant_receipt_message ON integration_tenant_receipt_events(organisation_id,provider,message_id,applied);`);
  const exists=table=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
  function messageOwners(provider,id){
    if(typeof id!=='string'||!id)return [];
    const owners=[];
    if(exists('communication_deliveries'))owners.push(...db.prepare('SELECT organisation_id owner FROM communication_deliveries WHERE provider=? AND provider_id=?').all(provider,id));
    if(exists('portal_mail'))owners.push(...db.prepare("SELECT CASE WHEN scope='business' THEN owner_id ELSE 'platform' END owner FROM portal_mail WHERE provider_id=?").all(id));
    if(exists('comms_campaign_recipients'))owners.push(...db.prepare('SELECT owner_key owner FROM comms_campaign_recipients WHERE provider_id=?').all(id));
    if(exists('comms_messages'))owners.push(...db.prepare('SELECT organisation_id owner FROM comms_messages WHERE external_message_id=?').all(id));
    return owners;
  }
  const ownsMessage=(org,provider,id)=>{const owners=messageOwners(provider,id);return owners.length>0&&owners.every(r=>r.owner===org)};
  function applyPending(org,provider,id){
    if(!ownsMessage(org,provider,id))return 0;
    let count=0;
    for(const event of db.prepare('SELECT * FROM integration_tenant_receipt_events WHERE organisation_id=? AND provider=? AND message_id=? AND applied=0 ORDER BY created_at').all(org,provider,id)){
      receipt(provider,org+':'+event.event_id,id,event.state);
      if(event.kind)onProviderEvent?.(id,event.kind);
      db.prepare('UPDATE integration_tenant_receipt_events SET applied=1 WHERE organisation_id=? AND provider=? AND event_id=?').run(org,provider,event.event_id);count++;
    }
    return count;
  }
  function queueReceipt(org,provider,eventId,id,state,kind=null){
    if(!eventId||!id||!['sent','delivered','opened','failed'].includes(state))return {routed:false};
    const owners=messageOwners(provider,id);if(owners.some(r=>r.owner!==org))return {routed:false};
    db.prepare('INSERT OR IGNORE INTO integration_tenant_receipt_events(organisation_id,provider,event_id,message_id,state,kind,created_at) VALUES (?,?,?,?,?,?,?)').run(org,provider,eventId,id,state,kind,new Date().toISOString());
    applyPending(org,provider,id);return {routed:owners.length>0,pending:owners.length===0};
  }
  function flushPending(){
    db.prepare('DELETE FROM integration_tenant_receipt_events WHERE created_at<?').run(new Date(Date.now()-7*86400000).toISOString());
    const predicates=[];
    if(exists('communication_deliveries'))predicates.push('EXISTS(SELECT 1 FROM communication_deliveries d WHERE d.organisation_id=e.organisation_id AND d.provider=e.provider AND d.provider_id=e.message_id)');
    if(exists('portal_mail'))predicates.push("EXISTS(SELECT 1 FROM portal_mail m WHERE m.scope='business' AND m.owner_id=e.organisation_id AND m.provider_id=e.message_id)");
    if(exists('comms_campaign_recipients'))predicates.push('EXISTS(SELECT 1 FROM comms_campaign_recipients c WHERE c.owner_key=e.organisation_id AND c.provider_id=e.message_id)');
    if(exists('comms_messages'))predicates.push('EXISTS(SELECT 1 FROM comms_messages m WHERE m.organisation_id=e.organisation_id AND m.external_message_id=e.message_id)');
    if(predicates.length)for(const e of db.prepare('SELECT DISTINCT organisation_id,provider,message_id FROM integration_tenant_receipt_events e WHERE applied=0 AND ('+predicates.join(' OR ')+') LIMIT 100').all())applyPending(e.organisation_id,e.provider,e.message_id);
  }
  const address=value=>String(value||'').match(/<([^>]+)>/)?.[1]?.toLowerCase()||String(value||'').trim().toLowerCase();
  const active=(org,channel,to)=>db.prepare("SELECT 1 FROM comms_channels WHERE organisation_id=? AND channel=? AND lower(address)=? AND status='active'").get(org,channel,address(to));
  const owned=(org,kind)=>{try{return credentials(org)?.[kind]}catch{return null}};
  app.post('/api/webhooks/communications/resend/:organisationId',async(req,res)=>{
    const org=req.params.organisationId,own=owned(org,'email');
    if(!own?.webhook_secret)return res.status(401).json({ok:false,error:'Signed workspace email webhook is not configured.'});
    let event;try{event=new Resend('webhook-verification-only').webhooks.verify({payload:req.rawBody.toString('utf8'),headers:{id:req.get('svix-id'),timestamp:req.get('svix-timestamp'),signature:req.get('svix-signature')},webhookSecret:own.webhook_secret})}catch{return res.status(401).json({ok:false,error:'Invalid webhook signature.'})}
    const id=event.data?.email_id;
    if(event.type==='email.received'){
      if(!id)return res.status(400).json({ok:false,error:'Missing email identifier.'});
      if(!(event.data?.to||[]).some(to=>address(to)===address(own.sender)&&active(org,'email',to)))return res.json({ok:true,routed:false});
      try{
        const result=await receiveResend(own.api_key,id);if(result.error||!result.data)throw new Error('Retrieval failed');
        const mail=result.data;
        if(!(mail.to||[]).some(to=>address(to)===address(own.sender)))return res.json({ok:true,routed:false});
        receiveEmail({organisation_id:org,channel:'email',contact_address:address(mail.from),subject:mail.subject||null,body:mail.text||'Email received; open the provider inbox for HTML content.',provider:'resend',external_message_id:id});
        return res.json({ok:true,routed:true});
      }catch{return res.status(503).json({ok:false,error:'Inbound email could not be retrieved. Retry later.'})}
    }
    const state={'email.sent':'sent','email.delivered':'delivered','email.opened':'opened','email.bounced':'failed','email.failed':'failed','email.complained':'failed','email.suppressed':'failed'}[event.type];
    const kind=event.type==='email.bounced'?'bounce':event.type==='email.complained'?'complaint':null;
    return res.json({ok:true,...queueReceipt(org,'resend',req.get('svix-id'),id,state,kind)});
  });
  app.post('/api/webhooks/communications/telnyx/:organisationId',(req,res)=>{
    const org=req.params.organisationId,own=owned(org,'sms');
    if(!own?.public_key||!verifyTelnyx(req,own.public_key))return res.status(401).json({ok:false,error:'Invalid webhook signature.'});
    const event=req.body?.data,p=event?.payload;
    if(event?.event_type==='message.received'){
      if(!p?.id||!(p.to||[]).some(to=>to.phone_number===own.number&&active(org,'sms',to.phone_number)))return res.json({ok:true,routed:false});
      receiveEmail({organisation_id:org,channel:'sms',contact_address:p.from?.phone_number,body:p.text||'',provider:'telnyx',external_message_id:p.id});
      return res.json({ok:true,routed:true});
    }
    const state=event?.event_type==='message.sent'?'sent':event?.event_type==='message.finalized'?(p?.to?.some(to=>to.status==='delivered')?'delivered':'failed'):null;
    return res.json({ok:true,...queueReceipt(org,'telnyx',event?.id,p?.id,state)});
  });
  return {ownsMessage,applyPending,flushPending};
}
