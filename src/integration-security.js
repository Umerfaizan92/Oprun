import crypto from 'node:crypto';

export function redactIntegrationError(value, secrets = []) {
  let message = String(value?.message || value || 'The provider request could not be completed.');
  for (const secret of secrets.filter(Boolean).map(String).sort((a,b)=>b.length-a.length)) {
    if (secret.length >= 4) message = message.split(secret).join('[redacted]');
  }
  return message.replace(/Bearer\s+[^\s,"<>]+/gi, 'Bearer [redacted]')
    .replace(/((?:access_token|refresh_token|client_secret|api_key|code_verifier|authorization_code)["'\s]*[:=]["'\s]*)[^\s&,"'<>]+/gi, '$1[redacted]')
    .replace(/[\r\n<>]/g, ' ').slice(0, 400);
}

export function integrationDiagnostic(error, secrets = []) {
  const detail = redactIntegrationError(error, secrets), status = Number(error?.status || 0);
  let code='provider_error', title='Provider request failed', action='Try again. If it continues, share the diagnostic reference with support.', retryable=true;
  if (status===401 || /invalid_grant|expired|revoked|no usable access token/i.test(detail)) {
    code='reconnect_required'; title='Authorisation expired or was revoked'; action='Reconnect on the provider sign-in screen, then test the connection.'; retryable=false;
  } else if (status===403 || /scope|permission|access.denied/i.test(detail)) {
    code='permission_required'; title='Provider permission or app approval required'; action='Review the permissions on the provider screen. The platform administrator may need provider app approval; a password cannot resolve this.'; retryable=false;
  } else if (status===429) {
    code='rate_limited'; title='Provider request limit reached'; action='Wait before refreshing. The last successful figures remain available.';
  } else if (/redirect_uri|redirect.*mismatch/i.test(detail)) {
    code='callback_configuration'; title='Provider callback address needs correction'; action='Ask the platform administrator to register the exact callback address shown in the setup checklist.'; retryable=false;
  } else if (status===400 || status===409) {
    code='setup_required'; title='Setup needs attention'; action=detail; retryable=false;
  } else if (/timeout|aborted|fetch failed|network/i.test(detail)) {
    code='temporarily_unavailable'; title='Provider could not be reached'; action='Retry later. Your saved account selection has been retained.';
  }
  return {code,title,detail,action,retryable,reference:crypto.randomUUID()};
}

// OAuth callbacks cross sites. A narrowly scoped Lax cookie binds the flow without
// weakening the application's existing Strict session cookie.
// Callback path segments one OAuth app may share between sibling connectors. Used by the state store and the redirect check.
export const OAUTH_CALLBACK_ALIASES={google:['youtube','google_business','google_seo','gmail'],youtube:['youtube','google_business','google_seo','gmail'],meta:['meta','whatsapp']};

// A configured redirect address is only safe when the provider will send the browser back to this application on a
// callback route that exists for that connector. Anything else either strands the subscriber on another website or
// fails after consent, so Connect is refused before the subscriber leaves (T-069). Returns {ok, reason}.
export function checkOauthRedirect({provider,uri,allowedHosts=[],production=false}){
  let url;try{url=new URL(String(uri||''))}catch{return {ok:false,reason:'The callback address is not a valid web address.'}}
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.username||url.password||url.hash)return {ok:false,reason:'The callback address must not contain sign-in details or a fragment.'};
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local&&!production))return {ok:false,reason:'The callback address must use https.'};
  const hosts=allowedHosts.map(h=>String(h||'').toLowerCase()).filter(Boolean);
  if(!(local&&!production)&&hosts.length&&!hosts.includes(url.host.toLowerCase()))return {ok:false,reason:'The callback address points to a different website than this application.'};
  const match=/^\/api\/saas\/integrations\/oauth\/([a-z_]+)\/callback$/.exec(url.pathname),segment=match?.[1];
  const pathOk=(segment&&(segment===provider||OAUTH_CALLBACK_ALIASES[segment]?.includes(provider)))||(provider==='tiktok'&&url.pathname==='/api/tiktok/callback');
  if(!pathOk)return {ok:false,reason:'The callback address does not end in a callback route this connection supports.'};
  return {ok:true,reason:''};
}

export function createIntegrationOAuthStore({db, secret, production=false, clock=Date.now,authorised=()=>true}) {
  db.exec(`CREATE TABLE IF NOT EXISTS integration_oauth_sessions (
    state_hash TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, user_id TEXT NOT NULL,
    session_id TEXT NOT NULL, provider TEXT NOT NULL, browser_hash TEXT NOT NULL,
    redirect_uri TEXT NOT NULL, created_at INTEGER NOT NULL, consumed_at INTEGER
  ); CREATE INDEX IF NOT EXISTS integration_oauth_expiry ON integration_oauth_sessions(created_at);`);
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const cookieName = provider => 'sp_connect_' + provider;
  const cookie = (provider, value, age=900, path="/api/saas/integrations/oauth") => `${cookieName(provider)}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${age}${production?'; Secure':''}`;
  const verifier = payload => crypto.createHmac('sha256',String(secret())).update('superpro-pkce:'+payload).digest('base64url');
  function begin({organisation_id,user_id,session_id,provider,redirect_uri}) {
    if (!secret()) throw new Error('Secure OAuth state signing is not configured.');
    const state=crypto.randomBytes(32).toString('base64url'), browser=crypto.randomBytes(32).toString('base64url'), stamp=clock();
    db.transaction(()=>{
      db.prepare('DELETE FROM integration_oauth_sessions WHERE created_at<?').run(stamp-900000);
      db.prepare('UPDATE integration_oauth_sessions SET consumed_at=? WHERE organisation_id=? AND provider=? AND consumed_at IS NULL').run(stamp,organisation_id,provider);
      db.prepare('INSERT INTO integration_oauth_sessions(state_hash,organisation_id,user_id,session_id,provider,browser_hash,redirect_uri,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(hash(state),organisation_id,user_id,session_id,provider,hash(browser),redirect_uri,stamp);
    })();
    return {state,payload:state,cookie:cookie(provider,browser,900,new URL(redirect_uri).pathname),verifier:verifier(state)};
  }
  function consume(raw,pathProvider,cookieHeader='') {
    if (typeof raw!=='string' || !/^[\w-]{43}$/.test(raw)) return null;
    return db.transaction(()=>{
      const row=db.prepare('SELECT * FROM integration_oauth_sessions WHERE state_hash=?').get(hash(raw));
      const aliases=OAUTH_CALLBACK_ALIASES;
      if (!row || row.consumed_at!==null || clock()-row.created_at>900000 || row.created_at>clock() || !(pathProvider===row.provider || aliases[pathProvider]?.includes(row.provider))) return null;
      const browser=String(cookieHeader).split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName(row.provider)+'='))?.split('=').slice(1).join('=') || '';
      if (!browser || hash(browser)!==row.browser_hash) return null;
      const member=db.prepare(`SELECT m.role FROM memberships m JOIN users u ON u.id=m.user_id JOIN user_sessions s ON s.user_id=u.id
        WHERE m.organisation_id=? AND m.user_id=? AND m.status='active' AND u.status='active' AND s.id=? AND s.expires_at>?`).get(row.organisation_id,row.user_id,row.session_id,new Date(clock()).toISOString());
      if (!member || !['owner','admin','super_admin'].includes(member.role)) return null;
      if (!authorised(row.organisation_id,row.user_id,member.role)) return null;
      if (!db.prepare('UPDATE integration_oauth_sessions SET consumed_at=? WHERE state_hash=? AND consumed_at IS NULL').run(clock(),hash(raw)).changes) return null;
      return {o:row.organisation_id,u:row.user_id,p:row.provider,payload:raw,redirect_uri:row.redirect_uri,clearCookie:cookie(row.provider,'',0,new URL(row.redirect_uri).pathname)};
    })();
  }
  const owns=(raw,provider)=>typeof raw==='string' && /^[\w-]{43}$/.test(raw) && Boolean(db.prepare('SELECT 1 FROM integration_oauth_sessions WHERE state_hash=? AND provider=?').get(hash(raw),provider));
  return {begin,consume,verifier,owns};
}
