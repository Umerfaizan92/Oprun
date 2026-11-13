// S5b: privacy-friendly visit counts for a business's own verified website.
// Stores only daily totals per page path and per referring site. No cookies, no IP addresses,
// no visitor identifiers, no query strings. Only the verified https origin is accepted.
import express from 'express';
import rateLimit from 'express-rate-limit';

const BOT = /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|pingdom|curl|wget|python|java\//i;
const MAX_KEYS_PER_DAY = 500;

export function installWebsiteVisits(app, { db, read, siteOrigin, wrap }) {
  // One visitor browsing several pages is normal; the cap only stops floods from a single address.
  const publicLimiter = rateLimit({ windowMs: 10 * 60000, limit: 120, standardHeaders: true, legacyHeaders: false });
  db.exec(`CREATE TABLE IF NOT EXISTS website_visit_counts (
    organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    day TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('page','source')), key TEXT NOT NULL, visits INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(organisation_id, day, kind, key));`);
  const orgFor = (slug) => db.prepare('SELECT id FROM organisations WHERE slug=?').get(slug)?.id;
  const cleanPath = (v) => { const p = String(v || '/').split(/[?#]/)[0].slice(0, 200); return /^\/[\w\-./~%]*$/.test(p) ? p : '/'; };
  const sourceOf = (v, own) => { try { const u = new URL(String(v || '')); if (!/^https?:$/.test(u.protocol)) return 'direct'; const h = u.hostname.toLowerCase().replace(/^www\./, ''); return own && h === new URL(own).hostname.replace(/^www\./, '') ? null : h.slice(0, 120); } catch { return 'direct'; } };
  const bump = db.prepare(`INSERT INTO website_visit_counts(organisation_id,day,kind,key,visits) VALUES(?,?,?,?,1)
    ON CONFLICT(organisation_id,day,kind,key) DO UPDATE SET visits=visits+1`);
  const exists = db.prepare('SELECT 1 FROM website_visit_counts WHERE organisation_id=? AND day=? AND kind=? AND key=?');
  const keys = db.prepare('SELECT COUNT(*) n FROM website_visit_counts WHERE organisation_id=? AND day=?');
  const count = (org, day, kind, key) => { if (!exists.get(org, day, kind, key) && keys.get(org, day).n >= MAX_KEYS_PER_DAY) key = kind === 'page' ? '(other pages)' : '(other sites)'; bump.run(org, day, kind, key); };

  const cors = (req, res) => { const origin = String(req.get('origin') || '').toLowerCase(), own = siteOrigin(req.params.slug); if (own && origin === own) res.set({ 'Access-Control-Allow-Origin': own, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type' }); res.vary('Origin'); return { origin, own }; };
  app.options('/api/public/visit/:slug', publicLimiter, (req, res) => { cors(req, res); res.status(204).end(); });
  app.post('/api/public/visit/:slug', publicLimiter, express.text({ type: '*/*', limit: '2kb' }), (req, res) => {
    const { origin, own } = cors(req, res);
    // Always answer the same way, so the counter reveals nothing about the business or the rules.
    res.set('Cache-Control', 'no-store'); res.status(204).end();
    if (!own || origin !== own || BOT.test(String(req.get('user-agent') || '')) || req.get('dnt') === '1' || req.get('sec-gpc') === '1') return;
    const org = orgFor(req.params.slug); if (!org) return;
    let b = {}; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return; }
    const day = new Date().toISOString().slice(0, 10), source = sourceOf(b.r, own);
    db.transaction(() => { count(org, day, 'page', cleanPath(b.p)); if (source) count(org, day, 'source', source); })();
  });

  app.get('/api/saas/website/visit-script', ...read, wrap((req, res) => {
    const slug = db.prepare('SELECT slug FROM organisations WHERE id=?').get(req.saas.organisation_id)?.slug, own = slug && siteOrigin(slug);
    if (!own) return res.status(409).json({ ok: false, error: 'Verify your website in Connections first.' });
    const base = (/^https:\/\//.test(process.env.PUBLIC_BASE_URL || '') ? process.env.PUBLIC_BASE_URL : `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const url = `${base}/api/public/visit/${encodeURIComponent(slug)}`;
    const html = `<script>(function(){if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl)return;var d=JSON.stringify({p:location.pathname,r:document.referrer});if(navigator.sendBeacon)navigator.sendBeacon(${JSON.stringify(url)},d);else fetch(${JSON.stringify(url)},{method:'POST',body:d,keepalive:true,mode:'cors'});})();</script>`;
    res.json({ ok: true, website: own, html, note: 'Add this before </body> on each page of your verified website. It counts page visits and referring sites only: no cookies, no IP addresses, no personal details. Visitors who ask not to be tracked are not counted.' });
  }));
  app.get('/api/saas/website/visits', ...read, wrap((req, res) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30)), from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10), org = req.saas.organisation_id;
    const daily = db.prepare("SELECT day, SUM(visits) visits FROM website_visit_counts WHERE organisation_id=? AND kind='page' AND day>=? GROUP BY day ORDER BY day").all(org, from);
    const top = (kind) => db.prepare('SELECT key, SUM(visits) visits FROM website_visit_counts WHERE organisation_id=? AND kind=? AND day>=? GROUP BY key ORDER BY visits DESC, key LIMIT 10').all(org, kind, from);
    res.json({ ok: true, days, from, total: daily.reduce((n, d) => n + d.visits, 0), daily, pages: top('page'), sources: top('source'), note: 'Counted on your website without cookies or IP addresses. Blocked by some browsers and ad blockers, so treat these as a lower bound.' });
  }));
}
