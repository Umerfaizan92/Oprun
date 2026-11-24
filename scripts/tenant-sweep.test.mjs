// TR-71 tenant isolation sweep. Business A is filled with realistic records through the real API (customers,
// enquiries, quotes, bookings, jobs, invoices, inbox, website, onboarding, an uploaded file). Then business B's owner
// calls EVERY business API route found in the source:
//   - every GET route without parameters (lists, dashboards, logs, caches): no A data may appear;
//   - every route with an :id-style parameter, for every method, once with one id from each of A's tables: the
//     answer may not contain A's data, and afterwards every A row must be unchanged.
// Routes are read from src/, so a new route is covered automatically. A failing route is reported with what leaked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { seedSampleBusiness } from './visual/sample-data.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MARK = 'TENANTA' + crypto.randomBytes(4).toString('hex').toUpperCase();

function routes() {
  const files = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.js$/.test(f.name)) files.push(p); } })(path.join(ROOT, 'src'));
  const out = new Map();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/app\.(get|post|put|patch|delete)\(\s*(['`])((?:\/api\/saas|\$\{prefix\})[^'`]*)\2/g)) {
      const p = m[3].replace('${prefix}', '/api/saas/seo');
      if (p.includes('${')) continue;
      out.set(`${m[1].toUpperCase()} ${p}`, { method: m[1].toUpperCase(), path: p, file: path.relative(ROOT, f) });
    }
  }
  return [...out.values()];
}
// Routes that act on the caller's own session or are designed to answer for anyone (public tokens) are left out.
const SKIP = /logout|sign-?out|\/session|switch-organisation|\/account\/delete|\/leave|password|\/impersonat/i;

test('business B cannot read or change any of business A\'s records, files, jobs, inbox, website or logs', { timeout: 900000 }, async () => {
  const s = await startServer({ API_RATE_LIMIT_TEST: '1000000' });
  try {
    const A = await seedOwner(s, { business: `Harbour Plumbing ${MARK}`, email: `owner-${MARK.toLowerCase()}@a.example.test` });
    const B = await seedOwner(s, { business: 'Bayside Electrical', name: 'Bea Brown', email: 'bea@b.example.test' });
    // Other businesses take over when a per-business rate limit stops B, so limited routes are still tested.
    const others = []; for (let i = 2; i <= 6; i++) others.push(await seedOwner(s, { business: `Other Business ${i}`, name: `Owner ${i}`, email: `owner${i}@b${i}.example.test` }));
    await seedSampleBusiness(s, A);
    const callA = (m, u, body) => s.call(m, u, { cookie: A.cookie, ...(m === 'GET' ? {} : { body }) });
    // More of A's world: inbox (website form), website drafts, onboarding answers, an uploaded file, a note with the marker.
    await callA('PUT', '/api/saas/website/wizard', { step: 4, data: { business: { name: `Harbour Plumbing ${MARK}`, phone: '08 9000 1234', services: [`Drains ${MARK}`], areas: [{ name: 'Fremantle', fact: `Van ${MARK}` }] } } });
    await callA('POST', '/api/saas/website/wizard/generate', {});
    await callA('PUT', '/api/saas/onboarding/interview/answers/business', { value: `We fix drains ${MARK}`, revision: (await callA('GET', '/api/saas/onboarding/interview')).json?.session?.revision || 0 });
    // A website enquiry lands in A's inbox (thread, messages, customer, enquiry).
    const form = await s.call('POST', `/api/public/contact/${A.slug}`, { body: { name: `Wendy ${MARK}`, email: 'wendy@a-customer.example.test', message: `Please call me back ${MARK}` } });
    assert.ok(form.status < 400, 'website enquiry accepted: ' + form.status);
        const fd = new FormData(); fd.append('files', new Blob([`PNGDATA ${MARK}`], { type: 'image/png' }), `photo-${MARK}.png`);
    const up = await fetch(s.base + '/api/saas/media', { method: 'POST', headers: { cookie: A.cookie, origin: s.base }, body: fd });
    assert.ok([201, 400].includes(up.status), 'media upload answered');

    // A job in the automation engine (publishing a page asks for approval) and an AI assistant conversation.
    const pageId = (await callA('GET', '/api/saas/website/wizard')).json?.review?.pages?.[0]?.id;
    if (pageId) await callA('POST', `/api/saas/seo/pages/${pageId}/publish`, {});
    { const w = new Database(s.dbPath), now = new Date().toISOString(), th = crypto.randomUUID();
      w.prepare('INSERT INTO ai_threads (id,organisation_id,created_by,title,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(th, A.org, A.uid, `Plan ${MARK}`, now, now);
      w.prepare("INSERT INTO ai_thread_messages (id,thread_id,role,content,created_at) VALUES (?,?,'user',?,?)").run(crypto.randomUUID(), th, `Private question ${MARK}`, now);
      w.close(); }
    // Everything A owns, read straight from the database: one id per table, and the markers that identify A.
    const db = new Database(s.dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
    const owned = [];
    for (const t of tables) {
      const cols = db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name), key = cols.includes('organisation_id') ? 'organisation_id' : cols.includes('owner_key') ? 'owner_key' : null;
      if (!key || !cols.includes('id')) continue;
      const rows = db.prepare(`SELECT * FROM "${t}" WHERE "${key}"=?`).all(A.org);
      if (rows.some((r) => r.id != null)) owned.push({ table: t, key, ids: rows.map((r) => String(r.id)).filter((x) => x && x !== 'null') });
    }
    const snapshot = () => { const d = new Database(s.dbPath, { readonly: true }); const out = {}; for (const o of owned) out[o.table] = d.prepare(`SELECT * FROM "${o.table}" WHERE "${o.key}"=? ORDER BY id`).all(A.org).map((r) => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !/(_at|_seen|last_|count|views|attempts)$/.test(k))))); d.close(); return out; };
    let before = snapshot();
    const people = ['Sam Rivera', 'Priya Nair', 'Tom Becker', 'Leila Hassan', 'Grace Okafor', 'Daniel Kim'];
    const aIds = owned.flatMap((o) => o.ids).filter((x) => x.length >= 8);
    const markers = [MARK, ...people, A.org, A.uid];
    db.close();
    assert.ok(owned.length >= 15, `A has records in ${owned.length} tables`);

    const all = routes();
    const leaks = [], errors = [], limited = new Set();
    let calls = 0;
    const leaked = (text, skip = []) => { let t = text; for (const v of skip) t = t.split(v).join(''); return markers.find((m) => t.includes(m)) || aIds.find((id) => t.includes(id)) || null; };
    const hit = async (method, url, used = []) => {
      calls++;
      let r; try { for (const who of [B, ...others]) { r = await s.call(method, url, { cookie: who.cookie, headers: { 'x-forwarded-for': `10.${(calls >> 16) & 255}.${(calls >> 8) & 255}.${calls & 255}` }, ...(method === 'GET' ? {} : { body: {} }) }); /* a new address per request so address-based limits do not hide a route */ if (r.status !== 429) break; } } catch (e) { throw new Error(`${method} ${url}: ${e.cause?.code || e.message}\n${String(s.log()).slice(-1500)}`); }
      status[r.status] = (status[r.status] || 0) + 1;
      if (r.status >= 500) errors.push(`${method} ${url} -> ${r.status}`);
      if (r.status === 429) limited.add(`${method} ${url.replace(/[0-9a-f-]{36}/g, ':id')}`);
      if (r.status < 400) { const what = leaked(r.text || '', used); if (what) leaks.push(`${method} ${url} -> ${r.status} shows ${what === MARK ? 'A marker' : what}`); }
      if (calls % 250 === 0) assert.equal((await s.call('GET', '/api/saas/me', { cookie: B.cookie })).status, 200, `B is still signed in after ${method} ${url}`);
    };
    // A opens every list first, so any per-process cache is warm with A's data before B asks (caches are covered).
    const lists0 = all.filter((r) => r.method === 'GET' && !r.path.includes(':') && !SKIP.test(r.path));
    let control = 0;
    for (const r of lists0) { const x = await callA('GET', r.path); if (x.status < 400 && leaked(x.text || '')) control++; }
    before = snapshot(); // A's own reads above may be logged; B's requests start from here
    assert.ok(control >= 5, `positive control: ${control} of A's own lists show A's data, so the check can see a leak`);
    const status = {};
    // 1. Lists, dashboards, logs and other parameterless reads.
    const lists = all.filter((r) => r.method === 'GET' && !r.path.includes(':') && !SKIP.test(r.path));
    for (const r of lists) await hit('GET', r.path);
    // 2. Every route with parameters, every method, with one id from each of A's tables.
    const withParams = all.filter((r) => r.path.includes(':') && !SKIP.test(r.path));
    const sample = owned.map((o) => o.ids[0]);
    const PROVIDERS = ['website', 'meta', 'email_sms'];
    for (const r of withParams) {
      const names = [...r.path.matchAll(/:([a-zA-Z_]+)/g)].map((m) => m[1]);
      const values = names.length === 1 && names[0] === 'provider' ? PROVIDERS : names.includes('organisationId') ? [A.org] : sample;
      for (const v of values) {
        const url = r.path.replace(/:([a-zA-Z_]+)/g, (_, n) => encodeURIComponent(n === 'provider' && !PROVIDERS.includes(v) ? 'website' : v));
        await hit(r.method, url, [v]);
      }
    }
    // 3. Nothing of A changed.
    const after = snapshot();
    const changed = Object.keys(before).filter((t) => JSON.stringify(before[t]) !== JSON.stringify(after[t]));
    fs.mkdirSync(path.join(ROOT, 'qa', 'reports'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'qa', 'reports', 'tenant-sweep.json'), JSON.stringify({ routes: all.length, list_routes: lists.length, a_tables_names: owned.map((o) => `${o.table} (${o.ids.length})`), statuses: status, positive_control_lists: control, param_routes: withParams.length, a_tables: owned.length, requests: calls, leaks, a_rows_changed: changed, server_errors: errors, rate_limited_routes: [...limited] }, null, 2) + '\n');
    assert.deepEqual(leaks, [], 'B saw A data');
    assert.deepEqual(changed, [], 'B changed A data');
    console.log(`tenant sweep: ${all.length} routes, ${calls} requests as business B, ${owned.length} of A's tables checked; ${errors.length} server errors (see qa/reports/tenant-sweep.json)`);
  } finally { await s.stop(); }
});
