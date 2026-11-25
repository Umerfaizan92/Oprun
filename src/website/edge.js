// Custom domains for business websites (W-09, T-155).
//
// How a visitor reaches a business site on its own domain:
//   www.business.com.au --CNAME--> sites.<CLOUDFLARE_SAAS_DOMAIN> (Cloudflare for SaaS custom hostname, certificate
//   issued by Cloudflare) --> Worker "oprun-sites-edge" (route */* on the SaaS zone) --> https://www.oprun.ai with two
//   headers: x-oprun-site-host (the visitor's host) and x-oprun-edge-key (a secret derived from the server key).
// Oprun serves only hosts that a business added AND proved it owns (TXT _oprun.<domain>). Unknown hosts get 404.
// Why a Worker: Cloudflare only lets Enterprise plans change the Host header, and Render routes by Host header.
// Nothing here runs unless CLOUDFLARE_SAAS_TOKEN, CLOUDFLARE_SAAS_ZONE_ID, CLOUDFLARE_ACCOUNT_ID and
// CLOUDFLARE_SAAS_DOMAIN are set. Secrets are never logged.
import crypto from 'node:crypto';
import { siteCsp } from '../seo/builder.js';
import { sendSiteRuntime } from '../seo/routes.js';

export const WORKER_NAME = 'oprun-sites-edge';

/** The Worker that forwards custom-domain traffic to Oprun. Cookies are never forwarded either way. */
export const WORKER_SOURCE = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const headers = new Headers(request.headers);
    headers.delete('cookie');
    headers.set('x-oprun-site-host', host);
    headers.set('x-oprun-edge-key', env.EDGE_KEY);
    const method = request.method.toUpperCase();
    const r = await fetch(new URL(url.pathname + url.search, env.ORIGIN), { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : request.body, redirect: 'manual' });
    const out = new Response(r.body, r);
    out.headers.delete('set-cookie');
    const loc = out.headers.get('location');
    if (loc && loc.startsWith(env.ORIGIN)) out.headers.set('location', 'https://' + host + loc.slice(env.ORIGIN.length));
    return out;
  }
};
`;

/** The shared secret between the Worker and Oprun, derived from the server key so there is nothing extra to store. */
export const edgeKeyFrom = (secret) => (secret ? crypto.createHmac('sha256', String(secret)).update('oprun-sites-edge-v1').digest('hex') : '');

export function edgeConfig(env = {}) {
  const c = { token: String(env.CLOUDFLARE_SAAS_TOKEN || '').trim(), zone: String(env.CLOUDFLARE_SAAS_ZONE_ID || '').trim(), account: String(env.CLOUDFLARE_ACCOUNT_ID || '').trim(), domain: String(env.CLOUDFLARE_SAAS_DOMAIN || '').trim().toLowerCase().replace(/^www\./, ''), origin: String(env.PUBLIC_BASE_URL || 'https://www.oprun.ai').replace(/\/$/, ''), key: edgeKeyFrom(env.INTEGRATION_ENCRYPTION_KEY || env.SESSION_SECRET || '') };
  c.ready = Boolean(c.token && /^[0-9a-f]{32}$/i.test(c.zone) && /^[0-9a-f]{32}$/i.test(c.account) && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(c.domain) && c.key);
  c.target = c.ready ? `sites.${c.domain}` : '';
  return c;
}

export function createEdge({ env, fetchImpl = globalThis.fetch, log = console }) {
  const c = edgeConfig(env);
  const API = 'https://api.cloudflare.com/client/v4';
  async function cf(method, path, body, { form = null } = {}) {
    const r = await fetchImpl(API + path, { method, headers: { authorization: `Bearer ${c.token}`, ...(form ? {} : { 'content-type': 'application/json' }) }, body: form || (body === undefined ? undefined : JSON.stringify(body)), signal: AbortSignal.timeout(20000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) {
      const msg = (d.errors || []).map((e) => e.message).filter(Boolean).join('; ') || `HTTP ${r.status}`;
      throw Object.assign(new Error(`Cloudflare: ${msg}`.slice(0, 300)), { status: r.status, code: d.errors?.[0]?.code });
    }
    return d.result;
  }

  /** One-time, repeatable set-up of the SaaS zone. Safe to run on every start. */
  async function setup() {
    if (!c.ready) return { ok: false, ready: false };
    const steps = [];
    // 1. The fallback origin record: proxied, "originless" (the Worker answers).
    const recs = await cf('GET', `/zones/${c.zone}/dns_records?name=${encodeURIComponent(c.target)}`);
    if (!recs?.length) await cf('POST', `/zones/${c.zone}/dns_records`, { type: 'AAAA', name: c.target, content: '100::', proxied: true, comment: 'Oprun business sites (fallback origin)' });
    steps.push('dns');
    // 2. The Worker.
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ main_module: 'worker.js', compatibility_date: '2026-01-01', bindings: [{ type: 'plain_text', name: 'ORIGIN', text: c.origin }, { type: 'secret_text', name: 'EDGE_KEY', text: c.key }] })], { type: 'application/json' }));
    form.append('worker.js', new Blob([WORKER_SOURCE], { type: 'application/javascript+module' }), 'worker.js');
    await cf('PUT', `/accounts/${c.account}/workers/scripts/${WORKER_NAME}`, undefined, { form });
    steps.push('worker');
    // 3. Route every request on the zone (custom hostnames included) to the Worker.
    const routes = await cf('GET', `/zones/${c.zone}/workers/routes`);
    if (!routes?.some((r) => r.pattern === '*/*')) await cf('POST', `/zones/${c.zone}/workers/routes`, { pattern: '*/*', script: WORKER_NAME });
    steps.push('route');
    // 4. Fallback origin for custom hostnames.
    await cf('PUT', `/zones/${c.zone}/custom_hostnames/fallback_origin`, { origin: c.target });
    steps.push('fallback_origin');
    return { ok: true, ready: true, steps, target: c.target };
  }

  async function addHostname(hostname) {
    try {
      return await cf('POST', `/zones/${c.zone}/custom_hostnames`, { hostname, ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } } });
    } catch (e) {
      // Already created (for example a retry after a timeout): find it instead of failing.
      const found = await cf('GET', `/zones/${c.zone}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`);
      if (found?.[0]) return found[0];
      throw e;
    }
  }
  const getHostname = (id) => cf('GET', `/zones/${c.zone}/custom_hostnames/${encodeURIComponent(id)}`);
  const deleteHostname = (id) => cf('DELETE', `/zones/${c.zone}/custom_hostnames/${encodeURIComponent(id)}`);

  /** Summarises a custom hostname for the business: what to add and whether it is live. */
  function summarise(h) {
    const active = h?.status === 'active' && h?.ssl?.status === 'active';
    const records = [];
    if (h?.ownership_verification?.name && h?.status !== 'active') records.push({ type: String(h.ownership_verification.type || 'txt').toUpperCase(), name: h.ownership_verification.name, value: h.ownership_verification.value, purpose: 'Lets Cloudflare issue the security certificate' });
    for (const v of h?.ssl?.validation_records || []) if (v.txt_name && h?.ssl?.status !== 'active') records.push({ type: 'TXT', name: v.txt_name, value: v.txt_value, purpose: 'Certificate check' });
    return { status: active ? 'active' : h?.ssl?.status === 'pending_validation' || h?.status === 'pending' ? 'ssl_pending' : 'pending', cf_status: h?.status || null, ssl_status: h?.ssl?.status || null, errors: [...(h?.verification_errors || []), ...((h?.ssl?.validation_errors || []).map((e) => e.message))].filter(Boolean).slice(0, 3), records };
  }

  /** True when the request came through our Worker. Constant-time comparison. */
  function fromEdge(req) {
    const k = String(req.get('x-oprun-edge-key') || '');
    if (!c.key || k.length !== c.key.length) return false;
    return crypto.timingSafeEqual(Buffer.from(k), Buffer.from(c.key));
  }

  return { config: c, ready: c.ready, setup, addHostname, getHostname, deleteHostname, summarise, fromEdge };
}

const notFound = (res) => res.status(404).set('Cache-Control', 'no-store').type('html').send('<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found</title><h1>Page not found</h1>');

/**
 * Express middleware for requests that arrive through the Worker. It must run before CORS and every other route:
 * a custom-domain request only ever reaches the business's published pages and its contact form.
 * Requests without the edge header pass straight through, so oprun.ai itself is unchanged.
 */
export function edgeHandler({ edge, hub, seo }) {
  return (req, res, next) => {
    const host = req.get('x-oprun-site-host');
    if (host === undefined) return next();
    if (!edge?.ready || !edge.fromEdge(req)) return res.status(403).type('text').send('Forbidden');
    const site = hub()?.hostSite(host);
    if (!site) return notFound(res);
    req.edgeSite = site;
    const path = req.path, q = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    // The contact form posts to its own domain. It is same-site for the visitor, so the origin check does not apply.
    if (req.method === 'POST' && (path === `/api/public/contact/${site.slug}` || path === `/api/public/visit/${site.slug}`)) { delete req.headers.origin; return next(); }
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).set('Allow', 'GET, HEAD').type('text').send('Method not allowed');
    const pref = `/sites/${site.slug}`;
    if (path === pref || path.startsWith(`${pref}/`)) return res.redirect(301, (path.slice(pref.length) || '/') + q);
    const moved = hub().redirectFor(site.site_id, path) || (path.length > 1 && path.endsWith('/') ? hub().redirectFor(site.site_id, path.slice(0, -1)) : null);
    if (moved) return res.redirect(moved.code === 302 ? 302 : 301, moved.to_path);
    const base = `https://${site.hostname}`, mount = { base, prefix: '' };
    if (path === '/robots.txt') { const x = seo.siteRobots ? seo.siteRobots(site.slug, mount) : null; return res.set('Cache-Control', 'public, max-age=3600').type('text/plain').send(x || `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`); }
    if (path === '/llms.txt') { const x = seo.siteLlms?.(site.slug, mount); return x ? res.set({ 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' }).type('text/markdown; charset=utf-8').send(x) : notFound(res); }
    if (path === '/sitemap.xml') { const x = seo.siteSitemap(site.slug, mount); return x ? res.set('Cache-Control', 'public, max-age=3600').type('application/xml').send(x) : notFound(res); }
    // W-06: the cinematic hero files are served from the business's own domain, so the page keeps script-src 'self'.
    if (/^\/_site\/(cinematic-loader|cinematic)\.js$/.test(path)) return sendSiteRuntime(req, res, path.slice(7));
    const m = /^\/([a-z0-9][a-z0-9-]{0,79})?\/?$/.exec(path);
    if (!m) return notFound(res);
    const form = ['sent', 'error'].includes(req.query.form) ? req.query.form : null;
    const r = seo.renderPublic(site.slug, m[1] || 'home', null, form, mount);
    if (!r || r.status !== 200) return notFound(res);
    res.set({ 'Cache-Control': form ? 'no-store' : 'public, max-age=300', 'Content-Security-Policy': siteCsp(r.html), 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    return res.type('html').send(r.html);
  };
}
