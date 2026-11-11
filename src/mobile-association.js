// Public proof of domain/app ownership. Signing fingerprints are public, not keys.
// Empty config deliberately grants no app association.
export function androidAssociations(env) {
  const appId = String(env.ANDROID_APP_ID || 'ai.oprun.app');
  const fingerprints = [...new Set(String(env.ANDROID_CERT_SHA256 || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean))];
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(appId) || !fingerprints.length || fingerprints.some(f => !/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f))) return [];
  return [{ relation:['delegate_permission/common.handle_all_urls'], target:{ namespace:'android_app', package_name:appId, sha256_cert_fingerprints:fingerprints } }];
}
export function appleAssociation(env) {
  const team = String(env.APPLE_TEAM_ID || '');
  const bundle = String(env.APPLE_BUNDLE_ID || 'ai.oprun.app');
  const details = /^[A-Z0-9]{10}$/.test(team) && /^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+){2,}$/.test(bundle)
    ? [{ appID:`${team}.${bundle}`, paths:['/saas/workspace.html','/saas/meet.html'] }] : [];
  return { applinks:{ apps:[], details } };
}
export function installMobileAssociations(app, env) {
  app.get('/.well-known/assetlinks.json', (req,res) => res.set('Cache-Control','public, max-age=300').json(androidAssociations(env)));
  app.get('/.well-known/apple-app-site-association', (req,res) => res.set('Cache-Control','public, max-age=300').json(appleAssociation(env)));
}
