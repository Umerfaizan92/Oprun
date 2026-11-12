// Phone and desktop push alerts (Web Push). An alert reaches a signed-in person's device even when Oprun is closed.
// - Keys: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY when set; otherwise one key pair is generated on first use and kept in the
//   database, the private key sealed with AES-256-GCM using the server's existing secret. Nothing secret reaches a browser.
// - A device subscription belongs to one person in one business; the server, never the browser, decides who it is for.
// - Endpoints are accepted only on the browsers' own push services, so a forged subscription cannot make the server
//   call an arbitrary address.
import crypto from 'node:crypto';
import webpush from 'web-push';
import { z } from 'zod';

const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /^push\.api\.chrome\.google\.com$/];
export const allowedPushEndpoint = (value) => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && PUSH_HOSTS.some(rx => rx.test(u.hostname)); } catch { return false; } };

export function installWebPush(app, { db, env, requireSaasUser, sender = null }) {
  db.exec(`CREATE TABLE IF NOT EXISTS web_push_keys(id INTEGER PRIMARY KEY CHECK(id=1),public_key TEXT NOT NULL,private_sealed TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS push_subscriptions(id TEXT PRIMARY KEY,organisation_id TEXT NOT NULL,user_id TEXT NOT NULL,endpoint TEXT NOT NULL UNIQUE,p256dh TEXT NOT NULL,auth TEXT NOT NULL,device TEXT,public_key TEXT NOT NULL,created_at TEXT NOT NULL,last_sent_at TEXT,last_error TEXT,failures INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(organisation_id,user_id);`);
  const secret = () => [env?.INTEGRATION_ENCRYPTION_KEY, env?.SAAS_SESSION_SECRET, env?.SESSION_SECRET, env?.ADMIN_SESSION_SECRET].find(v => v && String(v).length >= 16);
  const keyOf = s => crypto.createHash('sha256').update('oprun-web-push:' + s).digest();
  const seal = (text) => { const s = secret(); if (!s) return null; const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', keyOf(s), iv); const d = Buffer.concat([c.update(text, 'utf8'), c.final()]); return [iv, c.getAuthTag(), d].map(b => b.toString('base64url')).join('.'); };
  const unseal = (value) => { try { const [iv, tag, d] = String(value).split('.').map(p => Buffer.from(p, 'base64url')); const x = crypto.createDecipheriv('aes-256-gcm', keyOf(secret()), iv); x.setAuthTag(tag); return Buffer.concat([x.update(d), x.final()]).toString('utf8'); } catch { return null; } };
  let cached = null;
  function keys() {
    if (cached) return cached;
    if (env?.VAPID_PUBLIC_KEY && env?.VAPID_PRIVATE_KEY) return (cached = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY });
    const row = db.prepare('SELECT public_key,private_sealed FROM web_push_keys WHERE id=1').get();
    const privateKey = row && unseal(row.private_sealed);
    if (row && privateKey) return (cached = { publicKey: row.public_key, privateKey });
    const fresh = webpush.generateVAPIDKeys(), sealed = seal(fresh.privateKey);
    if (!sealed) return null; // no server secret configured: push stays off rather than storing a plain private key
    db.prepare('INSERT INTO web_push_keys(id,public_key,private_sealed,created_at) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET public_key=excluded.public_key,private_sealed=excluded.private_sealed,created_at=excluded.created_at').run(fresh.publicKey, sealed, new Date().toISOString());
    return (cached = fresh);
  }
  const subject = () => env?.VAPID_SUBJECT || ('mailto:' + (env?.SUPPORT_EMAIL || env?.PLATFORM_NOTICE_FROM || 'hello@oprun.ai').replace(/^.*<|>.*$/g, ''));
  const deliver = sender || ((sub, payload, k) => webpush.sendNotification(sub, payload, { TTL: 86400, urgency: 'high', vapidDetails: { subject: subject(), publicKey: k.publicKey, privateKey: k.privateKey } }));

  app.get('/api/saas/push/config', requireSaasUser, (req, res) => {
    const k = keys();
    const count = db.prepare('SELECT COUNT(*) n FROM push_subscriptions WHERE organisation_id=? AND user_id=?').get(req.saas.organisation_id, req.saas.user_id).n;
    res.json({ ok: true, available: Boolean(k), public_key: k?.publicKey || null, devices: count });
  });
  const subSchema = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().min(16).max(200), auth: z.string().min(8).max(100) }), device: z.string().max(120).optional() });
  app.post('/api/saas/push/subscribe', requireSaasUser, (req, res) => {
    const k = keys(); if (!k) return res.status(503).json({ ok: false, error: 'Phone alerts are not available on this server yet.' });
    const p = subSchema.safeParse(req.body); if (!p.success || !allowedPushEndpoint(p.data.endpoint)) return res.status(400).json({ ok: false, error: 'This browser did not provide a valid push subscription.' });
    const at = new Date().toISOString();
    // One endpoint = one device; re-subscribing on a shared device moves it to the person signed in now.
    db.prepare(`INSERT INTO push_subscriptions(id,organisation_id,user_id,endpoint,p256dh,auth,device,public_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(endpoint) DO UPDATE SET organisation_id=excluded.organisation_id,user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,device=excluded.device,public_key=excluded.public_key,failures=0,last_error=NULL`)
      .run(crypto.randomUUID(), req.saas.organisation_id, req.saas.user_id, p.data.endpoint, p.data.keys.p256dh, p.data.keys.auth, p.data.device || null, k.publicKey, at);
    res.json({ ok: true });
  });
  app.post('/api/saas/push/unsubscribe', requireSaasUser, (req, res) => {
    const p = z.object({ endpoint: z.string().url().max(1000) }).safeParse(req.body); if (!p.success) return res.status(400).json({ ok: false, error: 'Choose a device.' });
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND organisation_id=? AND user_id=?').run(p.data.endpoint, req.saas.organisation_id, req.saas.user_id);
    res.json({ ok: true });
  });

  async function pushToUser(org, userId, { id, title, body = '', link = '', kind = 'alert', urgent = false }) {
    const k = keys(); if (!k) return { sent: 0 };
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE organisation_id=? AND user_id=? AND public_key=?').all(org, userId, k.publicKey);
    const business = db.prepare('SELECT COALESCE(display_name,name) n FROM organisations WHERE id=?').get(org)?.n || 'Oprun';
    // Only what the person would see in their bell; the click opens the workspace page that needs them.
    const payload = JSON.stringify({ title: String(title).slice(0, 120), body: [body, business].filter(Boolean).join(' · ').slice(0, 240), tag: id || kind, url: '/saas/workspace.html' + (String(link).startsWith('#') ? link : ''), urgent: Boolean(urgent), kind });
    let sent = 0;
    for (const s of subs) {
      try { await deliver({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, k); sent++; db.prepare('UPDATE push_subscriptions SET last_sent_at=?,failures=0,last_error=NULL WHERE id=?').run(new Date().toISOString(), s.id); }
      catch (e) {
        const gone = [404, 410].includes(e?.statusCode);
        if (gone || s.failures >= 9) db.prepare('DELETE FROM push_subscriptions WHERE id=?').run(s.id);
        else db.prepare('UPDATE push_subscriptions SET failures=failures+1,last_error=? WHERE id=?').run(String(e?.statusCode || 'error'), s.id);
      }
    }
    return { sent };
  }
  app.post('/api/saas/push/test', requireSaasUser, async (req, res) => {
    const r = await pushToUser(req.saas.organisation_id, req.saas.user_id, { id: 'test-' + crypto.randomUUID(), kind: 'push_test', title: 'Phone alerts are on', body: 'You will be alerted here about new enquiries, jobs, approvals and messages.', link: '#today/home' });
    res.json({ ok: true, sent: r.sent });
  });
  return { pushToUser, keys };
}
