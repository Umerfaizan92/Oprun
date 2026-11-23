// TR-24: one rule table for which optional workspace modules a business uses.
// Owner decision (D-057): each industry starts with a recommended set and the owner can switch any optional module on
// or off in Business settings. A switched-off module is hidden and its API refuses requests (403); its data is never
// changed or deleted. Core modules (Command Centre, enquiries to invoices, jobs, customers, inbox, money, settings,
// help) are always on. Plans limit how much can be added (entitlements.js); staff permissions limit who sees what
// (staff-access.js). Businesses that existed before this change keep every module on until the owner changes it.

const OFFICE_INDUSTRIES = ['admin_support', 'it_technology', 'accounting_tax', 'professional_services', 'legal', 'finance_insurance', 'real_estate', 'media_telecom'];
const NO_STOCK_INDUSTRIES = ['legal', 'accounting_tax', 'finance_insurance', 'professional_services', 'it_technology', 'real_estate', 'education_training', 'admin_support', 'media_telecom'];
const CONTENT_INDUSTRIES = ['retail_ecommerce', 'hospitality_food', 'media_telecom', 'real_estate', 'it_technology', 'arts_recreation_sport', 'repair_automotive', 'beauty_personal'];

// Media Studio blocks only its own tools; the shared file library (/api/saas/media) stays, because other modules
// pick photos from it.
export const MODULES = [
  { key: 'stock', label: 'Stock & Supplies', views: ['stock'], api: [/^\/api\/saas\/stock(\/|$)/], recommended: (i) => !NO_STOCK_INDUSTRIES.includes(i) },
  { key: 'hiring', label: 'Hiring', views: ['hiring'], api: [/^\/api\/saas\/hiring(\/|$)/], recommended: () => true },
  { key: 'offshore', label: 'Offshore staff', views: ['offshore'], api: [/^\/api\/saas\/workers\/offshore(\/|$)/], recommended: (i) => OFFICE_INDUSTRIES.includes(i) },
  { key: 'receptionist', label: 'AI Receptionist', views: ['receptionist', 'voiceflow'], api: [/^\/api\/saas\/receptionist(\/|$)/], recommended: () => true },
  { key: 'meetings', label: 'Meetings', views: ['meetings'], api: [/^\/api\/saas\/meetings(\/|$)/], recommended: () => true },
  { key: 'media', label: 'Media Studio', views: ['video'], api: [/^\/api\/saas\/(ai-video|reels|studio-exports)(\/|$)/], recommended: (i) => CONTENT_INDUSTRIES.includes(i) },
  { key: 'growth', label: 'Campaigns & growth', views: ['campaignstudio', 'growth', 'businesscampaigns'], api: [/^\/api\/saas\/growth(\/|$)/], recommended: () => true },
  { key: 'website', label: 'Website & search', views: ['websitehub', 'seocentre', 'seobuilder', 'seoaudit', 'seoclusters', 'seogoogle', 'seostudio', 'seolocal', 'seoanalytics', 'seoreports', 'visibility', 'searchconsole', 'backlinks', 'website'], api: [/^\/api\/saas\/(website|seo)(\/|$)/], recommended: () => true }
];

const KEYS = MODULES.map((m) => m.key);
const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

// The recommended on/off set for an industry; an unknown or custom industry gets everything.
export function recommendedFor(industry) {
  const code = String(industry || '');
  return Object.fromEntries(MODULES.map((m) => [m.key, !code || code === 'custom' ? true : Boolean(m.recommended(code))]));
}

// Stored setting -> effective on/off per module.
// null (businesses created before this change): everything on. {auto:true}: follow the industry. {modules:{...}}: the
// owner's own choice (a module missing from it is on).
export function effectiveModules(stored, industry) {
  const s = parse(stored);
  if (!s) return Object.fromEntries(KEYS.map((k) => [k, true]));
  if (s.auto) return recommendedFor(industry);
  return Object.fromEntries(KEYS.map((k) => [k, s.modules?.[k] !== false]));
}

export function installModuleRules(app, { db, requireSaasUser, saasAudit }) {
  const cols = new Set(db.prepare('PRAGMA table_info(organisations)').all().map((c) => c.name));
  if (!cols.has('modules_json')) db.exec('ALTER TABLE organisations ADD COLUMN modules_json TEXT');

  const industryOf = (org) => db.prepare('SELECT industry_code FROM onboarding_profiles WHERE organisation_id=?').get(org)?.industry_code || '';
  const stateOf = (org) => {
    const stored = db.prepare('SELECT modules_json FROM organisations WHERE id=?').get(org)?.modules_json || null;
    const industry = industryOf(org), on = effectiveModules(stored, industry), rec = recommendedFor(industry), s = parse(stored);
    return { mode: !s ? 'all' : s.auto ? 'recommended' : 'custom', industry, modules: MODULES.map((m) => ({ key: m.key, label: m.label, on: on[m.key], recommended: rec[m.key] })), off_views: MODULES.filter((m) => !on[m.key]).flatMap((m) => m.views) };
  };

  // Refuse the API of a switched-off module before its own route runs. Nothing is changed or deleted.
  app.use('/api/saas', (req, res, next) => {
    const path = '/api/saas' + req.path, mod = MODULES.find((m) => m.api.some((r) => r.test(path)));
    if (!mod) return next();
    requireSaasUser(req, res, () => {
      if (effectiveModules(db.prepare('SELECT modules_json FROM organisations WHERE id=?').get(req.saas.organisation_id)?.modules_json, industryOf(req.saas.organisation_id))[mod.key]) return next();
      res.status(403).json({ ok: false, error: `${mod.label} is switched off for this business. The owner can switch it on in Business settings > Modules.`, module: mod.key });
    });
  });

  app.get('/api/saas/modules', requireSaasUser, (req, res) => res.json({ ok: true, ...stateOf(req.saas.organisation_id) }));

  app.put('/api/saas/modules', requireSaasUser, (req, res) => {
    if (!['owner', 'admin', 'super_admin'].includes(req.saas.role)) return res.status(403).json({ ok: false, error: 'Only the owner or an admin can change modules.' });
    const org = req.saas.organisation_id, b = req.body || {};
    let stored;
    if (b.use_recommended === true) stored = { auto: true };
    else if (b.modules && typeof b.modules === 'object') stored = { modules: Object.fromEntries(KEYS.map((k) => [k, b.modules[k] !== false])) };
    else return res.status(400).json({ ok: false, error: 'Send the modules to switch on or off, or use_recommended.' });
    db.prepare('UPDATE organisations SET modules_json=?,updated_at=? WHERE id=?').run(JSON.stringify(stored), new Date().toISOString(), org);
    saasAudit(req, 'workspace.modules_changed', 'organisation', org, stored);
    res.json({ ok: true, ...stateOf(org) });
  });

  return { stateOf, followIndustry: (org) => db.prepare('UPDATE organisations SET modules_json=? WHERE id=? AND modules_json IS NULL').run(JSON.stringify({ auto: true }), org) };
}
