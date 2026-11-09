import crypto from 'node:crypto';

// The flag alone never changes an account's requirements. A recent, independently
// authenticated founder recovery approval and a password-authenticated challenge
// are both required. Existing authenticator MFA remains enforced by login.
export function createFounderVerification({db,env,audit,sendEmail,sendSms,verifySms,hash,code,session,cookie,requireAdmin,adminRecoveryAuthenticated,verifyLimiter,resendLimiter}){
  db.exec(`CREATE TABLE IF NOT EXISTS founder_recovery_approvals (
    user_id TEXT PRIMARY KEY,approved_at TEXT NOT NULL,expires_at TEXT NOT NULL,reason TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS founder_login_challenges (
    id TEXT PRIMARY KEY,user_id TEXT NOT NULL,binding_hash TEXT NOT NULL,password_hash TEXT NOT NULL,
    email TEXT NOT NULL,phone TEXT,email_hash TEXT NOT NULL,sms_hash TEXT NOT NULL,sms_provider TEXT,
    sms_required INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,expires_at TEXT NOT NULL,
    consumed_at TEXT,created_at TEXT NOT NULL);`);
  const path='/api/saas/founder-verification',cookieName='sp_founder_verification';
  const credentialState=user=>hash(JSON.stringify([user.password_hash,user.mfa_enabled,user.mfa_secret]));
  const smsEnabled=()=>env.SMS_VERIFICATION_ENABLED!=='false';
  function eligible(userId){
    return db.prepare(`SELECT u.* FROM users u JOIN founder_workspace_identity f ON f.user_id=u.id AND f.singleton=1
      JOIN founder_recovery_approvals a ON a.user_id=u.id WHERE u.id=? AND u.status='active' AND a.expires_at>?
      AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND lower(m.role)='owner' AND m.status='active')`).get(userId,new Date().toISOString());
  }
  function log(req,userId,event,detail={}){
    const membership=db.prepare("SELECT organisation_id FROM memberships WHERE user_id=? AND lower(role)='owner' AND status='active' LIMIT 1").get(userId);
    audit({...req,ip:req.ip,saas:{organisation_id:membership?.organisation_id,user_id:userId,role:'owner'},get:name=>req.get(name)},event,'user',userId,detail);
  }
  function view(row){return {ok:true,founder_verification:true,challenge_id:row.id,sms_required:Boolean(row.sms_required),expires_at:row.expires_at};}
  function load(req,res,afterAttempt=false){
    const row=db.prepare('SELECT * FROM founder_login_challenges WHERE id=?').get(req.body?.challenge_id||'');
    if(!row||row.consumed_at||row.expires_at<=new Date().toISOString()||hash(cookie(req,cookieName)||'')!==row.binding_hash){res.status(410).json({ok:false,error:'Verification expired. Sign in again.'});return null;}
    const user=eligible(row.user_id);
    if(!user||credentialState(user)!==row.password_hash||user.email!==row.email||user.phone!==row.phone||Boolean(row.sms_required)!==smsEnabled()||user.locked_until>new Date().toISOString()){
      res.status(409).json({ok:false,error:'Security requirements changed. Sign in again.'});return null;
    }
    if(row.attempts>=8&&!afterAttempt){res.status(429).json({ok:false,error:'Too many verification attempts. Wait for this request to expire.'});return null;}
    return {row,user};
  }
  async function deliver(req,row,channel,value){
    let delivery;
    try{delivery=channel==='email'?await sendEmail({to:row.email,code:value,businessName:'Founder account recovery'}):await sendSms(row.phone,value,'Founder account recovery');}
    catch{delivery={sent:false};}
    log(req,row.user_id,'security.founder_otp_delivery',{channel,sent:Boolean(delivery.sent)});
    return delivery;
  }
  async function start(req,res,user){
    // One live request per account: restarts and resends cannot reset attempts.
    if(db.prepare('SELECT 1 FROM founder_login_challenges WHERE user_id=? AND consumed_at IS NULL AND expires_at>?').get(user.id,new Date().toISOString()))return res.status(429).json({ok:false,error:'A verification request is already active. Continue it or wait 10 minutes.'});
    const emailCode=code(),smsCode=code(),binding=crypto.randomBytes(32).toString('base64url');
    const row={id:crypto.randomUUID(),user_id:user.id,binding_hash:hash(binding),password_hash:credentialState(user),email:user.email,phone:user.phone,email_hash:'',sms_hash:'',sms_required:Number(smsEnabled()),expires_at:new Date(Date.now()+600000).toISOString(),created_at:new Date().toISOString()};
    row.email_hash=hash(row.id+':'+emailCode);row.sms_hash=hash(row.id+':'+smsCode);
    db.prepare(`INSERT INTO founder_login_challenges(id,user_id,binding_hash,password_hash,email,phone,email_hash,sms_hash,sms_required,expires_at,created_at) VALUES (@id,@user_id,@binding_hash,@password_hash,@email,@phone,@email_hash,@sms_hash,@sms_required,@expires_at,@created_at)`).run(row);
    res.cookie(cookieName,binding,{httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'strict',path,maxAge:600000});
    await deliver(req,row,'email',emailCode);
    if(row.sms_required){const delivery=await deliver(req,row,'sms',smsCode);db.prepare('UPDATE founder_login_challenges SET sms_provider=?,expires_at=? WHERE id=?').run(delivery.provider||'local',new Date(Math.min(Date.parse(row.expires_at),Date.now()+(delivery.timeout_seconds||600)*1000)).toISOString(),row.id);}
    log(req,user.id,'security.founder_verification_started',{sms_required:Boolean(row.sms_required)});
    return res.status(202).json(view(row));
  }
  function install(app){
    app.use(path,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
    app.use('/api/operator/founder-recovery',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
    app.get('/api/operator/founder-recovery',resendLimiter,requireAdmin,(req,res)=>{
      res.set('Cache-Control','no-store');
      if(!adminRecoveryAuthenticated(req))return res.status(403).json({ok:false,error:'Founder key and authenticator sign-in required.'});
      const founder=db.prepare(`SELECT u.id,u.email FROM founder_workspace_identity f JOIN users u ON u.id=f.user_id WHERE f.singleton=1 AND u.status='active'`).get();
      if(!founder)return res.status(409).json({ok:false,error:'No existing linked Founder account. Recovery requires an independently verified Founder account link.'});
      res.json({ok:true,user_id:founder.id,email:founder.email,sms_required:smsEnabled()});
    });
    app.post('/api/operator/founder-recovery/approve',resendLimiter,requireAdmin,(req,res)=>{
      // A raw API key or business-owner session is insufficient for MFA recovery.
      if(!adminRecoveryAuthenticated(req))return res.status(403).json({ok:false,error:'Sign in to the Founder Console with the founder key and authenticator before approving recovery.'});
      const userId=req.body?.user_id,reason=String(req.body?.reason||'').trim();
      const founder=db.prepare(`SELECT u.id FROM founder_workspace_identity f JOIN users u ON u.id=f.user_id WHERE f.singleton=1 AND u.id=? AND u.status='active' AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND lower(m.role)='owner' AND m.status='active')`).get(typeof userId==='string'?userId:'');
      if(!founder||reason.length<10||reason.length>500||req.body?.confirm!==true)return res.status(400).json({ok:false,error:'Confirm the linked Founder user ID and provide a recovery reason (10–500 characters).'});
      const expires=new Date(Date.now()+86400000).toISOString();
      db.transaction(()=>{db.prepare('INSERT OR REPLACE INTO founder_recovery_approvals VALUES (?,?,?,?)').run(userId,new Date().toISOString(),expires,reason);db.prepare('DELETE FROM founder_login_challenges WHERE user_id=?').run(userId);db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(userId);log(req,userId,'security.founder_recovery_approved',{expires_at:expires,reason});})();
      res.json({ok:true,expires_at:expires});
    });
    app.post(path+'/status',resendLimiter,(req,res)=>{const loaded=load(req,res);if(loaded)res.json(view(loaded.row));});
    app.post(path+'/resend',resendLimiter,async(req,res)=>{
      const loaded=load(req,res);if(!loaded)return;
      const {row}=loaded,channel=req.body?.channel;
      if(!['email','sms'].includes(channel)||channel==='sms'&&!row.sms_required)return res.status(400).json({ok:false,error:'This verification channel is not available.'});
      const value=code(),delivery=await deliver(req,row,channel,value);
      if(!delivery.sent)return res.status(503).json({ok:false,error:'Code delivery failed. Retry after checking the provider.'});
      db.prepare(`UPDATE founder_login_challenges SET ${channel==='email'?'email_hash':'sms_hash'}=?${channel==='sms'?',sms_provider=?':''} WHERE id=? AND consumed_at IS NULL`).run(...[hash(row.id+':'+value),...(channel==='sms'?[delivery.provider||'local']:[]),row.id]);
      res.json({ok:true,message:'A new verification code was sent.'});
    });
    app.post(path+'/verify',verifyLimiter,async(req,res)=>{
      const loaded=load(req,res);if(!loaded)return;
      const {row}=loaded;
      if(!db.prepare('UPDATE founder_login_challenges SET attempts=attempts+1 WHERE id=? AND attempts<8 AND consumed_at IS NULL').run(row.id).changes)return res.status(429).json({ok:false,error:'Verification attempt limit reached.'});
      const equal=(value,expected)=>crypto.timingSafeEqual(Buffer.from(hash(row.id+':'+value)),Buffer.from(expected));
      const emailOk=/^\d{6}$/.test(req.body?.email_code||'')&&equal(req.body.email_code,row.email_hash);
      let smsOk=!row.sms_required;
      if(emailOk&&row.sms_required&&/^\d{4,8}$/.test(req.body?.sms_code||'')){
        try{smsOk=row.sms_provider==='telnyx_verify'?Boolean((await verifySms(row.phone,req.body.sms_code)).ok):equal(req.body.sms_code,row.sms_hash);}catch{smsOk=false;}
      }
      if(!emailOk||!smsOk){log(req,row.user_id,'security.founder_verification_failed');return res.status(401).json({ok:false,error:'Verification code is incorrect or unavailable.'});}
      // Revalidate after provider I/O; consume atomically to prevent replay.
      const current=load(req,res,true);if(!current)return;
      if(current.row.email_hash!==row.email_hash||current.row.sms_hash!==row.sms_hash)return res.status(409).json({ok:false,error:'A newer code was issued. Enter the latest code.'});
      if(!db.prepare('UPDATE founder_login_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL').run(new Date().toISOString(),row.id).changes)return res.status(409).json({ok:false,error:'This code was already used.'});
      log(req,row.user_id,'security.founder_verification_completed',{sms_required:Boolean(row.sms_required)});
      db.prepare('UPDATE users SET failed_login_attempts=0,locked_until=NULL,last_login_at=?,updated_at=? WHERE id=?').run(new Date().toISOString(),new Date().toISOString(),row.user_id);
      session(res,row.user_id,req);res.clearCookie(cookieName,{path});res.json({ok:true});
    });
  }
  return {eligible,start,install};
}
