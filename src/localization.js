import { z } from 'zod';
import { canonicalLocale, localeCatalogue, localeDirection } from '../saas/locale-catalog.js';

export function installLocalization(app, { db, requireSaasUser }) {
  db.exec(`CREATE TABLE IF NOT EXISTS user_locale_preferences (
    organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    locale TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(organisation_id,user_id)
  );`);
  const get = db.prepare('SELECT locale,updated_at FROM user_locale_preferences WHERE organisation_id=? AND user_id=?');
  const set = db.prepare(`INSERT INTO user_locale_preferences(organisation_id,user_id,locale,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(organisation_id,user_id) DO UPDATE SET locale=excluded.locale,updated_at=excluded.updated_at`);
  // Defence in depth: identity comes only from authenticated session + active membership.
  const membership = db.prepare("SELECT 1 FROM memberships WHERE organisation_id=? AND user_id=? AND status='active'");
  const scope = (req, res, next) => {
    if (!req.saas?.organisation_id || !req.saas?.user_id || !membership.get(req.saas.organisation_id, req.saas.user_id)) return res.status(403).json({ ok: false, error: 'Active workspace membership required.' });
    res.setHeader('Cache-Control', 'no-store'); next();
  };
  const payload = req => {
    const pref = get.get(req.saas.organisation_id, req.saas.user_id);
    const locale = canonicalLocale(pref?.locale) || 'en-AU';
    return { ok: true, locale, direction: localeDirection(locale), updated_at: pref?.updated_at || null, locales: localeCatalogue(locale), translation_status: 'partial', voice_language_status: 'provider-dependent' };
  };
  app.get('/api/saas/preferences/language', requireSaasUser, scope, (req, res) => res.json(payload(req)));
  const schema = z.object({ locale: z.string().max(40).refine(v => Boolean(canonicalLocale(v))) }).strict();
  app.put('/api/saas/preferences/language', requireSaasUser, scope, (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Choose a listed language. Other preference fields are not accepted.' });
    set.run(req.saas.organisation_id, req.saas.user_id, canonicalLocale(parsed.data.locale), new Date().toISOString());
    res.json(payload(req));
  });
}
