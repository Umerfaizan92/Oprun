// T-071 Lead sources: every enquiry can record where it came from. A workspace creates tracked links and QR codes for
// its posts, campaigns, flyers and signs; a visit is counted and the code travels with the visitor so the enquiry that
// follows is attributed. The report shows leads, quotes, bookings and paid revenue per source, campaign and area.
// Every query is scoped to the signed-in workspace. No visitor IP address or device detail is stored.
import crypto from 'node:crypto';
import { z } from 'zod';
import QRCode from 'qrcode';
import rateLimit from 'express-rate-limit';

export const LEAD_CHANNELS = {
  facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'WhatsApp', tiktok: 'TikTok', youtube: 'YouTube', x: 'X / Twitter', snapchat: 'Snapchat',
  google_business: 'Google Business Profile', email: 'Email', sms: 'SMS', flyer: 'Flyer or print', vehicle: 'Vehicle sign', shop_sign: 'Shop sign', other: 'Other'
};
// How an enquiry's own "came in by" value reads when it has no tracked link.
const ENQUIRY_CHANNELS = { phone: 'Phone call', email: 'Email', website: 'Website form', walk_in: 'In person', sms: 'SMS', social: 'Social media', receptionist: 'AI receptionist', referral: 'Referral', other: 'Other' };
// A tracked link may only lead to the workspace's own verified website or a page on one of these services, so the
// short address can never be used to send people to an unrelated site.
const PLATFORM_HOSTS = ['facebook.com', 'fb.com', 'm.me', 'instagram.com', 'wa.me', 'whatsapp.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'x.com', 'twitter.com', 'snapchat.com', 'g.page', 'google.com', 'goo.gl', 'linkedin.com'];
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const newCode = () => Array.from(crypto.randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
const hostAllowed = (host, own) => { const h = String(host).toLowerCase().replace(/^www\./, ''); return (own && (h === own || h.endsWith('.' + own))) || PLATFORM_HOSTS.some((p) => h === p || h.endsWith('.' + p)); };

export function installLeadSources(app, { db, env = {}, requireSaasUser, saasAudit, staffAccess }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_links (
      id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'link',
      channel TEXT NOT NULL, campaign TEXT, area TEXT, destination TEXT NOT NULL, clicks INTEGER NOT NULL DEFAULT 0, last_click_at TEXT,
      created_by TEXT, created_at TEXT NOT NULL, archived_at TEXT);
    CREATE INDEX IF NOT EXISTS lead_links_org ON lead_links(organisation_id, archived_at);
    CREATE TABLE IF NOT EXISTS lead_link_days (link_id TEXT NOT NULL, organisation_id TEXT NOT NULL, day TEXT NOT NULL, clicks INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (link_id, day));
    CREATE TABLE IF NOT EXISTS lead_attributions (
      document_id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, link_id TEXT, channel TEXT, campaign TEXT, area TEXT, set_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS lead_attributions_org ON lead_attributions(organisation_id);`);

  const fail = (res, status, error, code) => res.status(status).json({ ok: false, error, ...(code ? { code } : {}) });
  const can = (feature, action) => (req, res, next) => (staffAccess.can(req, feature, action) ? next() : fail(res, 403, 'This business action is not authorised for your account.'));
  const iso = () => new Date().toISOString();
  const clean = (v, max) => { const s = String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max); return s || null; };
  const base = (req) => (String(env.PUBLIC_BASE_URL || '').trim() || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const ownHost = (org) => { try { const s = JSON.parse(db.prepare("SELECT settings_json FROM organisation_integrations WHERE organisation_id=? AND provider='website'").get(org)?.settings_json || '{}'); return s.website?.verified ? String(s.website.hostname || '').toLowerCase().replace(/^www\./, '') : null; } catch { return null; } };
  const linkView = (req, l, leads = 0) => ({ id: l.id, code: l.code, label: l.label, kind: l.kind, channel: l.channel, channel_label: LEAD_CHANNELS[l.channel] || l.channel, campaign: l.campaign, area: l.area, destination: l.destination, short_url: `${base(req)}/l/${l.code}`, clicks: l.clicks, leads, last_click_at: l.last_click_at, created_at: l.created_at, archived: Boolean(l.archived_at) });

  /** Records where an enquiry came from. Called by the pipeline for every new enquiry that carries a code, campaign or area. */
  function attribute(org, documentId, { source_code, link_id, campaign, area, channel, set_by = null } = {}) {
    const enquiry = db.prepare("SELECT id FROM tenant_documents WHERE id=? AND organisation_id=? AND kind='enquiry'").get(documentId, org);
    if (!enquiry) return null;
    const code = String(source_code || '').toLowerCase();
    const link = /^[a-z0-9]{8}$/.test(code) ? db.prepare('SELECT * FROM lead_links WHERE code=? AND organisation_id=?').get(code, org)
      : link_id ? db.prepare('SELECT * FROM lead_links WHERE id=? AND organisation_id=?').get(String(link_id), org) : null;
    const row = { link_id: link?.id || null, channel: link?.channel || (LEAD_CHANNELS[channel] ? channel : null), campaign: clean(link?.campaign ?? campaign, 120), area: clean(link?.area ?? area, 80) };
    if (!row.link_id && !row.channel && !row.campaign && !row.area) { db.prepare('DELETE FROM lead_attributions WHERE document_id=? AND organisation_id=?').run(documentId, org); return null; }
    const now = iso();
    db.prepare(`INSERT INTO lead_attributions (document_id,organisation_id,link_id,channel,campaign,area,set_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(document_id) DO UPDATE SET link_id=excluded.link_id,channel=excluded.channel,campaign=excluded.campaign,area=excluded.area,set_by=excluded.set_by,updated_at=excluded.updated_at
      WHERE lead_attributions.organisation_id=excluded.organisation_id`).run(documentId, org, row.link_id, row.channel, row.campaign, row.area, set_by, now, now);
    return row;
  }

  /** Leads, quotes, bookings and paid revenue per source, campaign and area for one workspace. */
  function report(org, days = 90) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const docs = db.prepare("SELECT id,kind,status,channel,source_id,work_order_id,created_at FROM tenant_documents WHERE organisation_id=? AND kind IN ('enquiry','quote','booking','invoice')").all(org);
    const byId = new Map(docs.map((d) => [d.id, d]));
    const rootOf = (d) => { let cur = d, guard = 0; while (cur?.source_id && byId.has(cur.source_id) && guard++ < 8) cur = byId.get(cur.source_id); return cur?.kind === 'enquiry' ? cur.id : null; };
    const paid = new Map(db.prepare('SELECT id,paid_cents FROM work_orders WHERE organisation_id=?').all(org).map((j) => [j.id, j.paid_cents || 0]));
    const attributions = new Map(db.prepare('SELECT a.*,l.label link_label FROM lead_attributions a LEFT JOIN lead_links l ON l.id=a.link_id AND l.organisation_id=a.organisation_id WHERE a.organisation_id=?').all(org).map((a) => [a.document_id, a]));
    const outcome = new Map(), jobsCounted = new Set();
    for (const d of docs) {
      if (d.kind === 'enquiry') continue;
      const root = rootOf(d); if (!root) continue;
      const o = outcome.get(root) || { quoted: false, booked: false, revenue: 0 }; outcome.set(root, o);
      if (d.kind === 'quote') o.quoted = true;
      if (d.kind === 'booking') { o.quoted = true; o.booked = true; }
      // Revenue is money actually received on the job, counted once per job however many documents point to it.
      if (d.work_order_id && !jobsCounted.has(d.work_order_id)) { jobsCounted.add(d.work_order_id); o.revenue += paid.get(d.work_order_id) || 0; }
    }
    const tally = () => new Map();
    const add = (map, key, label, e, o) => { const t = map.get(key) || { key, label, leads: 0, quoted: 0, booked: 0, revenue_cents: 0 }; map.set(key, t); t.leads++; if (o?.quoted) t.quoted++; if (o?.booked) t.booked++; t.revenue_cents += o?.revenue || 0; };
    const sources = tally(), campaigns = tally(), areas = tally();
    let total = 0, tracked = 0;
    for (const e of docs) {
      if (e.kind !== 'enquiry' || e.created_at < since) continue;
      total++;
      const a = attributions.get(e.id), o = outcome.get(e.id);
      if (a?.channel) { tracked++; add(sources, 'tracked:' + a.channel, LEAD_CHANNELS[a.channel] || a.channel, e, o); }
      else add(sources, 'entry:' + (e.channel || 'other'), (ENQUIRY_CHANNELS[e.channel] || 'Other') + ' (not tracked)', e, o);
      if (a?.campaign) add(campaigns, a.campaign.toLowerCase(), a.campaign, e, o);
      if (a?.area) add(areas, a.area.toLowerCase(), a.area, e, o);
    }
    const list = (m) => [...m.values()].sort((x, y) => y.leads - x.leads || x.label.localeCompare(y.label));
    return { days, total_leads: total, tracked_leads: tracked, sources: list(sources), campaigns: list(campaigns), areas: list(areas) };
  }

  const linkSchema = z.object({
    label: z.string().trim().min(2).max(80), kind: z.enum(['link', 'qr']).default('link'), channel: z.enum(Object.keys(LEAD_CHANNELS)),
    campaign: z.string().trim().max(120).optional().or(z.literal('')), area: z.string().trim().max(80).optional().or(z.literal('')), destination: z.string().trim().max(600)
  }).strict();

  app.get('/api/saas/lead-sources', requireSaasUser, can('customers', 'read'), (req, res) => {
    const org = req.saas.organisation_id, days = Math.min(365, Math.max(7, Number(req.query.days) || 90));
    const counts = new Map(db.prepare('SELECT link_id,COUNT(*) n FROM lead_attributions WHERE organisation_id=? AND link_id IS NOT NULL GROUP BY link_id').all(org).map((r) => [r.link_id, r.n]));
    const links = db.prepare('SELECT * FROM lead_links WHERE organisation_id=? AND archived_at IS NULL ORDER BY created_at DESC LIMIT 200').all(org).map((l) => linkView(req, l, counts.get(l.id) || 0));
    res.json({ ok: true, links, report: report(org, days), channels: Object.entries(LEAD_CHANNELS).map(([value, label]) => ({ value, label })), own_website: ownHost(org), allowed_hosts: PLATFORM_HOSTS });
  });

  app.post('/api/saas/lead-sources/links', requireSaasUser, can('customers', 'create'), (req, res) => {
    const p = linkSchema.safeParse(req.body);
    if (!p.success) return fail(res, 400, 'Add a name, choose where it will be used, and enter the address it should open.');
    const org = req.saas.organisation_id, d = p.data;
    let url; try { url = new URL(d.destination); } catch { return fail(res, 400, 'Enter the full address, starting with https://'); }
    if (url.protocol !== 'https:' || url.username || url.password) return fail(res, 400, 'The address must start with https:// and contain no sign-in details.');
    if (!hostAllowed(url.hostname, ownHost(org))) return fail(res, 400, 'A tracked link can open your own verified website (Setup & Trust, Connections, Website) or your page on a social or Google service.', 'destination_not_allowed');
    if (db.prepare('SELECT COUNT(*) n FROM lead_links WHERE organisation_id=? AND archived_at IS NULL').get(org).n >= 200) return fail(res, 409, 'This workspace has 200 active tracked links. Archive some first.');
    const id = crypto.randomUUID(); let code = newCode();
    for (let i = 0; i < 5 && db.prepare('SELECT 1 FROM lead_links WHERE code=?').get(code); i++) code = newCode();
    db.prepare('INSERT INTO lead_links (id,organisation_id,code,label,kind,channel,campaign,area,destination,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, org, code, clean(d.label, 80), d.kind, d.channel, clean(d.campaign, 120), clean(d.area, 80), url.toString(), req.saas.user_id, iso());
    saasAudit(req, 'lead_source.link_created', 'lead_link', id, { kind: d.kind, channel: d.channel, campaign: clean(d.campaign, 120), area: clean(d.area, 80) });
    res.status(201).json({ ok: true, link: linkView(req, db.prepare('SELECT * FROM lead_links WHERE id=?').get(id)) });
  });

  app.post('/api/saas/lead-sources/links/:id/archive', requireSaasUser, can('customers', 'edit'), (req, res) => {
    const done = db.prepare('UPDATE lead_links SET archived_at=? WHERE id=? AND organisation_id=? AND archived_at IS NULL').run(iso(), req.params.id, req.saas.organisation_id).changes;
    if (!done) return fail(res, 404, 'Tracked link not found.');
    saasAudit(req, 'lead_source.link_archived', 'lead_link', req.params.id, {});
    res.json({ ok: true });
  });

  app.get('/api/saas/lead-sources/links/:id/qr.svg', requireSaasUser, can('customers', 'read'), async (req, res) => {
    const l = db.prepare('SELECT * FROM lead_links WHERE id=? AND organisation_id=?').get(req.params.id, req.saas.organisation_id);
    if (!l) return fail(res, 404, 'Tracked link not found.');
    const svg = await QRCode.toString(`${base(req)}/l/${l.code}`, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 512 });
    res.set({ 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'private, no-store', 'Content-Disposition': `inline; filename="qr-${l.code}.svg"`, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" }).send(svg);
  });

  app.post('/api/saas/lead-sources/attribute', requireSaasUser, can('customers', 'edit'), (req, res) => {
    const p = z.object({ enquiry_id: z.string().uuid(), link_id: z.string().uuid().nullable().optional(), channel: z.enum(Object.keys(LEAD_CHANNELS)).nullable().optional(), campaign: z.string().trim().max(120).nullable().optional(), area: z.string().trim().max(80).nullable().optional() }).strict().safeParse(req.body);
    if (!p.success) return fail(res, 400, 'Choose the enquiry and its source.');
    const org = req.saas.organisation_id, d = p.data;
    if (!db.prepare("SELECT 1 FROM tenant_documents WHERE id=? AND organisation_id=? AND kind='enquiry'").get(d.enquiry_id, org)) return fail(res, 404, 'Enquiry not found.');
    if (d.link_id && !db.prepare('SELECT 1 FROM lead_links WHERE id=? AND organisation_id=?').get(d.link_id, org)) return fail(res, 404, 'Tracked link not found.');
    const row = attribute(org, d.enquiry_id, { link_id: d.link_id, channel: d.channel, campaign: d.campaign, area: d.area, set_by: req.saas.user_id });
    saasAudit(req, 'lead_source.attributed', 'enquiry', d.enquiry_id, row || { cleared: true });
    res.json({ ok: true, attribution: row });
  });

  // Public short address. Counts the visit (a number per day, nothing about the visitor) and passes the code on so
  // the workspace's own contact form can record it. An unknown or archived code gets a plain 404 with no redirect.
  const visitLimiter = rateLimit({ windowMs: 60000, limit: 120, standardHeaders: true, legacyHeaders: false, message: 'Too many requests. Try again in a minute.' });
  app.get('/l/:code', visitLimiter, (req, res) => {
    const code = String(req.params.code || '').toLowerCase();
    const l = /^[a-z0-9]{8}$/.test(code) ? db.prepare('SELECT * FROM lead_links WHERE code=? AND archived_at IS NULL').get(code) : null;
    if (!l) return res.status(404).type('text/plain').send('This link is no longer available.');
    const now = iso();
    db.transaction(() => {
      db.prepare('UPDATE lead_links SET clicks=clicks+1,last_click_at=? WHERE id=?').run(now, l.id);
      db.prepare('INSERT INTO lead_link_days (link_id,organisation_id,day,clicks) VALUES (?,?,?,1) ON CONFLICT(link_id,day) DO UPDATE SET clicks=clicks+1').run(l.id, l.organisation_id, now.slice(0, 10));
    })();
    const to = new URL(l.destination); to.searchParams.set('sp_src', l.code);
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' }).redirect(302, to.toString());
  });

  return { attribute, report };
}
