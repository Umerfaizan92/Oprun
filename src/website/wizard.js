// W-03 (T-149): the Website → Build wizard for NEW sites. Steps 1–4 (start, business info, design, pages) and 8–9
// (generate and review, publish) from docs/ai-website/03_WIZARD.md. Steps 5–7 (domain, email, search) stay on their
// own Website tabs for now and are shown as links. The wizard state is saved per business so the owner can leave and
// resume; it is pre-filled from what the business already told Oprun. Generation uses the W-04 service (generate.js).
// Publishing uses the existing page publish route, so first releases and new claims always ask for approval (D-W10).
// Switch: WEBSITE_BUILDER_V2=0 hides the wizard and keeps the earlier one-form builder (default on).
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const iso = () => new Date().toISOString();
const J = (s, f) => { try { return JSON.parse(s); } catch { return f; } };
const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export const STYLE_LABELS = { clean_trade: 'Clean trade', bold_industrial: 'Bold industrial', warm_local: 'Warm local', premium_dark: 'Premium dark', medical_calm: 'Medical calm', retail_bright: 'Retail bright' };
const text = (n) => z.string().trim().max(n);
export const WizardData = z.object({
  mode: z.enum(['new', 'transfer']).default('new'),
  business: z.object({
    name: text(120).default(''), abn: z.string().trim().regex(/^(\d\s?){11}$|^$/, 'An ABN has 11 digits.').default(''), phone: text(30).default(''), email: z.union([z.string().trim().email().max(160), z.literal('')]).default(''),
    address: text(200).default(''), mobile_service: z.boolean().default(false), services: z.array(text(80).min(2)).max(12).default([]),
    areas: z.array(z.object({ name: text(60).min(2), fact: text(300).default('') }).strict()).max(12).default([]), hours: text(300).default(''),
    licences: z.array(text(120).min(2)).max(6).default([]), difference: text(300).default('')
  }).strict().prefault({}),
  style: z.object({ key: z.enum(Object.keys(STYLE_LABELS)).default('clean_trade'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).strict().prefault({}),
  pages: z.object({ core: z.array(z.enum(['home', 'services', 'areas', 'about', 'faq', 'contact'])).max(6).default(['home', 'services', 'about', 'contact']), service_pages: z.boolean().default(true) }).strict().prefault({})
}).strict();

export function createWizard({ db, hub, seo, generator }) {
  db.exec('CREATE TABLE IF NOT EXISTS website_wizard (organisation_id TEXT PRIMARY KEY, step INTEGER NOT NULL DEFAULT 1, data_json TEXT NOT NULL, updated_by TEXT, updated_at TEXT NOT NULL)');
  const enabled = () => process.env.WEBSITE_BUILDER_V2 !== '0';
  const site = (o) => db.prepare('SELECT * FROM seo_sites WHERE owner_key=? ORDER BY created_at LIMIT 1').get(o);

  // Pre-fill from Oprun: only what the business already gave (the owner confirms or changes each item).
  function prefill(o) {
    const f = hub.facts(o);
    return WizardData.parse({ business: {
      name: f.business_name && f.business_name !== 'Our business' ? f.business_name.slice(0, 120) : '', abn: /^(\d\s?){11}$/.test(f.abn || '') ? f.abn : '', phone: (f.phone || '').slice(0, 30),
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email || '') ? f.email.slice(0, 160) : '', address: (f.address || '').slice(0, 200), services: f.services.filter((s) => s.length >= 2).slice(0, 12),
      areas: f.areas.filter((a) => a.length >= 2).slice(0, 12).map((name) => ({ name, fact: '' })), hours: (f.hours || '').slice(0, 300) },
    style: /^#[0-9a-f]{6}$/i.test(f.color || '') ? { color: f.color } : {} });
  }
  function state(o) {
    const row = db.prepare('SELECT * FROM website_wizard WHERE organisation_id=?').get(o);
    const data = row ? WizardData.safeParse(J(row.data_json, {})) : null;
    const s = site(o), info = s ? seo.sites(o).find((x) => x.id === s.id) : null;
    const generatedHere = Boolean(s && s.build_mode === 'new');
    const run = s ? generator.lastRun(o, s.id) : null;
    return { enabled: enabled(), step: row?.step || 1, data: data?.success ? data.data : prefill(o), saved_at: row?.updated_at || null,
      site: info ? { id: info.id, name: info.name, url: info.url, build_status: s.build_status || null, generated_here: generatedHere, pages: info.pages.length } : null,
      can_generate: !s || generatedHere, run, allowance: generator.allowance(o), styles: STYLE_LABELS, missing: missing(data?.success ? data.data : prefill(o)) };
  }
  function missing(d) {
    const b = d.business, out = [];
    if (!b.name || b.name.length < 2) out.push('business name'); if (!b.phone) out.push('phone'); if (!b.services.length) out.push('at least one service'); if (!b.areas.length) out.push('at least one area');
    return out;
  }
  function save(o, actor, { step, data }) {
    const p = WizardData.safeParse(data);
    if (!p.success) return { ok: false, status: 400, error: p.error.issues[0]?.message || 'Check the details and try again.' };
    const st = Math.max(1, Math.min(9, Number(step) || 1));
    db.prepare('INSERT INTO website_wizard (organisation_id,step,data_json,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(organisation_id) DO UPDATE SET step=excluded.step,data_json=excluded.data_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at')
      .run(o, st, JSON.stringify(p.data), actor, iso());
    return { ok: true, ...state(o) };
  }
  const factsFrom = (d, o) => ({ business_name: d.business.name, abn: d.business.abn, phone: d.business.phone, email: d.business.email, address: d.business.address, mobile_service: d.business.mobile_service,
    services: d.business.services, areas: d.business.areas, hours: d.business.hours, licences: d.business.licences, difference: d.business.difference, style: d.style.key, knowledge: hub.facts(o).knowledge || '' });

  async function generate(o, actor) {
    const row = db.prepare('SELECT * FROM website_wizard WHERE organisation_id=?').get(o);
    const d = row ? WizardData.safeParse(J(row.data_json, {})) : null;
    if (!d?.success) return { ok: false, status: 400, error: 'Save the business details first.' };
    const gaps = missing(d.data); if (gaps.length) return { ok: false, status: 400, error: `Add ${gaps.join(', ')} first.` };
    let s = site(o);
    if (s && s.build_mode !== 'new') return { ok: false, status: 409, error: 'You already have a website. Open Pages to edit it.' };
    const style = hub.STYLES[d.data.style.key] || hub.STYLES.clean_trade, brand = { primary_color: d.data.style.color || style.color, font: style.font };
    if (!s) {
      let slug = slugify(d.data.business.name) || 'site';
      for (let i = 2; db.prepare('SELECT 1 FROM seo_sites WHERE slug=?').get(slug) && i < 60; i++) slug = `${slugify(d.data.business.name) || 'site'}-${i}`;
      const r = seo.createSite(o, { name: d.data.business.name, slug, brand }, actor); if (!r.ok) return r;
      db.prepare("UPDATE seo_sites SET build_mode='new', build_status='draft', style_json=? WHERE id=?").run(JSON.stringify(d.data.style), r.site.id);
      s = site(o);
    } else db.prepare('UPDATE seo_sites SET brand_json=?, style_json=? WHERE id=?').run(JSON.stringify(brand), JSON.stringify(d.data.style), s.id);
    const r = await generator.generateSite(o, actor, { siteId: s.id, facts: factsFrom(d.data, o), choice: { pages: d.data.pages.core, service_pages: d.data.pages.service_pages, areas: d.data.business.areas } });
    if (r.ok) db.prepare('UPDATE website_wizard SET step=8, updated_at=? WHERE organisation_id=?').run(iso(), o);
    return r.ok ? { ...r, review: review(o) } : r;
  }
  function review(o) {
    const s = site(o); if (!s) return { pages: [] };
    const run = generator.lastRun(o, s.id), byId = new Map((run?.pages || []).map((p) => [p.page_id, p]));
    const pages = db.prepare('SELECT id FROM seo_site_pages WHERE site_id=? ORDER BY created_at').all(s.id).map((r) => seo.pageOut(o, r.id)).filter(Boolean).map((p) => {
      const g = byId.get(p.id) || {};
      return { id: p.id, slug: p.slug, title: p.title, status: p.status, preview_url: p.preview_url, live_url: p.live_url, published: Boolean(p.published), checks: p.checks,
        blocks: (p.draft?.blocks || []).map((b, i) => ({ index: i, type: b.type, heading: b.heading || '', text: String(b.text || '').slice(0, 220), items: Array.isArray(b.items) ? b.items.length : null })),
        wording: g.wording || null, removed_claims: g.removed_claims || [] };
    });
    return { pages, notes: run?.notes || [], run_status: run?.status || null };
  }
  async function section(o, actor, { page_id, index }) {
    const s = site(o), owned = s && db.prepare('SELECT 1 FROM seo_site_pages WHERE id=? AND site_id=?').get(page_id, s.id);
    if (!owned) return { ok: false, status: 404, error: 'Page not found.' };
    const row = db.prepare('SELECT * FROM website_wizard WHERE organisation_id=?').get(o);
    const d = row ? WizardData.safeParse(J(row.data_json, {})) : null; if (!d?.success) return { ok: false, status: 400, error: 'Save the business details first.' };
    const r = await generator.regenerateSection(o, actor, { pageId: page_id, index, facts: factsFrom(d.data, o) });
    return r.ok ? { ok: true, removed_claims: r.removed_claims, review: review(o) } : r;
  }

  function install(app, { requireSaasUser, requireSaasRole, staffAccess, saasAudit }) {
    const fail = (res, s, e) => res.status(s).json({ ok: false, error: e });
    const can = (f, a) => (req, res, next) => (staffAccess.can(req, f, a) ? next() : fail(res, 403, 'This action is not authorised for your account.'));
    const owner = requireSaasRole('owner', 'admin', 'super_admin');
    const heavy = rateLimit({ windowMs: 15 * 60 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Please wait a few minutes before trying again.' } });
    const light = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Too many changes. Wait a minute.' } });
    const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => { console.error('[WEBSITE WIZARD]', e); fail(res, 500, 'Something went wrong. Nothing was changed.'); });
    const O = (req) => req.saas.organisation_id, U = (req) => req.saas.user_id;
    const send = (res, r, ok = 200) => (r.ok === false ? res.status(r.status || 400).json(r) : res.status(ok).json({ ok: true, ...r }));
    app.get('/api/saas/website/wizard', requireSaasUser, can('visibility', 'read'), wrap((req, res) => res.json({ ok: true, ...state(O(req)), review: review(O(req)) })));
    app.put('/api/saas/website/wizard', requireSaasUser, owner, light, wrap((req, res) => send(res, save(O(req), U(req), req.body || {}))));
    app.post('/api/saas/website/wizard/generate', requireSaasUser, owner, heavy, wrap(async (req, res) => {
      const r = await generate(O(req), U(req));
      if (r.ok) saasAudit(req, 'website.site_generated', 'website', r.run_id, { pages: r.pages.length, ai_pages: r.pages.filter((p) => p.wording === 'ai').length, removed_claims: r.pages.reduce((n, p) => n + p.removed_claims.length, 0) });
      send(res, r, 201);
    }));
    app.post('/api/saas/website/wizard/section', requireSaasUser, owner, heavy, wrap(async (req, res) => {
      const b = z.object({ page_id: z.string().min(8).max(80), index: z.number().int().min(0).max(39) }).strict().safeParse(req.body || {});
      if (!b.success) return fail(res, 400, 'Choose a section to rewrite.');
      const r = await section(O(req), U(req), b.data);
      if (r.ok) saasAudit(req, 'website.section_regenerated', 'website_page', b.data.page_id, { index: b.data.index });
      send(res, r);
    }));
  }
  return { install, state, save, generate, review, section, prefill };
}
