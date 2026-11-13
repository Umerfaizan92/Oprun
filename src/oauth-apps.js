// Business-owned developer apps for OAuth connections (owner request, 2026-11-13).
// A business may register its own app with Meta, Google, TikTok, X or Snapchat and use it instead of Oprun's.
// The client secret is encrypted with the integration key, never returned, and never logged. Each business can
// only read or change its own record. Signing in always happens on the provider's own page: Oprun never asks for
// or stores a social-media password.
export const APP_FAMILIES = {
  meta: { label: 'Meta (Facebook, Instagram, WhatsApp)', providers: ['meta', 'whatsapp'], id: /^\d{5,25}$/, idName: 'App ID', secretName: 'App secret', where: 'Meta for Developers > your app > App settings > Basic' },
  google: { label: 'Google (YouTube, Gmail, Business Profile, Search Console, Analytics)', providers: ['youtube', 'gmail', 'google_business', 'google_seo'], id: /^[\w-]{6,100}\.apps\.googleusercontent\.com$/, idName: 'OAuth client ID', secretName: 'Client secret', where: 'Google Cloud Console > APIs & Services > Credentials > OAuth client (Web application)' },
  tiktok: { label: 'TikTok', providers: ['tiktok'], id: /^[A-Za-z0-9]{8,40}$/, idName: 'Client key', secretName: 'Client secret', where: 'TikTok for Developers > your app > App details' },
  x: { label: 'X', providers: ['x'], id: /^[A-Za-z0-9_-]{10,100}$/, idName: 'OAuth 2.0 client ID', secretName: 'Client secret', where: 'X Developer Portal > your app > Keys and tokens > OAuth 2.0' },
  snapchat: { label: 'Snapchat', providers: ['snapchat'], id: /^[A-Za-z0-9-]{8,100}$/, idName: 'OAuth client ID', secretName: 'Client secret', where: 'Snap Kit / Business Manager > OAuth apps' }
};
const ENV = { meta: ['META_APP_ID', 'META_APP_SECRET'], google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'], x: ['X_CLIENT_ID', 'X_CLIENT_SECRET'], snapchat: ['SNAPCHAT_CLIENT_ID', 'SNAPCHAT_CLIENT_SECRET'] };
export const familyOf = (provider) => Object.keys(APP_FAMILIES).find((f) => APP_FAMILIES[f].providers.includes(provider)) || null;

export function createOAuthApps({ db, env, encrypt, decrypt }) {
  db.exec(`CREATE TABLE IF NOT EXISTS organisation_oauth_apps (
    organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, family TEXT NOT NULL,
    client_id TEXT NOT NULL, secret_enc TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(organisation_id, family));`);
  const useful = (v) => Boolean(String(v || '').trim()) && !/^(changeme|todo|placeholder|your[_-])/i.test(String(v).trim());
  function workspace(org, provider) {
    const family = familyOf(provider); if (!family) return null;
    const row = db.prepare('SELECT client_id, secret_enc FROM organisation_oauth_apps WHERE organisation_id=? AND family=?').get(org, family);
    if (!row) return null;
    try { const secret = decrypt(row.secret_enc)?.client_secret; return secret ? { client_id: row.client_id, client_secret: secret, source: 'workspace', family } : null; } catch { return null; }
  }
  function platform(provider) {
    const family = familyOf(provider); if (!family) return null;
    const [idKey, secretKey] = ENV[family], id = String(env[idKey] || '').trim(), secret = env[secretKey];
    return useful(id) && useful(secret) && (family !== 'meta' || /^\d{5,25}$/.test(id)) ? { client_id: id, client_secret: String(secret), source: 'platform', family } : null;
  }
  // The business's own app wins when present; otherwise Oprun's app, when the platform has one configured.
  const resolve = (org, provider) => workspace(org, provider) || platform(provider);
  function describe(org, provider) {
    const family = familyOf(provider); if (!family) return null;
    const row = db.prepare('SELECT client_id, updated_at FROM organisation_oauth_apps WHERE organisation_id=? AND family=?').get(org, family), f = APP_FAMILIES[family];
    return { family, label: f.label, providers: f.providers, id_name: f.idName, secret_name: f.secretName, where: f.where,
      own_app: Boolean(row), client_id_hint: row ? row.client_id.slice(0, 4) + '…' + row.client_id.slice(-4) : null, updated_at: row?.updated_at || null,
      platform_app_available: Boolean(platform(provider)), in_use: row ? 'own' : platform(provider) ? 'oprun' : 'none' };
  }
  function save(org, provider, { client_id, client_secret }, user) {
    const family = familyOf(provider), f = APP_FAMILIES[family];
    if (!family) throw Object.assign(new Error('This connection does not use a developer app.'), { status: 400 });
    const id = String(client_id || '').trim(), secret = String(client_secret || '').trim();
    if (!f.id.test(id)) throw Object.assign(new Error(`That does not look like a ${f.label.split(' (')[0]} ${f.idName}. Copy it from ${f.where}.`), { status: 400 });
    if (secret.length < 16 || secret.length > 300 || /\s/.test(secret) || secret === id) throw Object.assign(new Error(`Enter the ${f.secretName} exactly as shown in ${f.where}.`), { status: 400 });
    db.prepare(`INSERT INTO organisation_oauth_apps(organisation_id,family,client_id,secret_enc,updated_by,updated_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(organisation_id,family) DO UPDATE SET client_id=excluded.client_id,secret_enc=excluded.secret_enc,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
      .run(org, family, id, encrypt({ client_secret: secret }), user, new Date().toISOString());
    return family;
  }
  function remove(org, provider) { const family = familyOf(provider); db.prepare('DELETE FROM organisation_oauth_apps WHERE organisation_id=? AND family=?').run(org, family); return family; }
  return { resolve, workspace, platform, describe, save, remove };
}
