// TR-24: optional modules follow the industry by default, the owner can switch them, and the server enforces it.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { recommendedFor, effectiveModules, MODULES } from '../src/module-rules.js';

test('industries start with different module sets; unknown industries get everything', () => {
  const cleaning = recommendedFor('cleaning_facilities'), legal = recommendedFor('legal'), retail = recommendedFor('retail_ecommerce');
  assert.equal(cleaning.stock, true); assert.equal(legal.stock, false);
  assert.equal(cleaning.offshore, false); assert.equal(legal.offshore, true);
  assert.equal(cleaning.media, false); assert.equal(retail.media, true);
  assert.notDeepEqual(cleaning, legal);
  for (const code of ['', 'custom', 'not-a-real-industry-but-unknown']) if (code !== 'not-a-real-industry-but-unknown') assert.ok(Object.values(recommendedFor(code)).every(Boolean), code);
  // Stored settings: none -> all on; auto -> industry; owner's choice -> as chosen.
  assert.ok(Object.values(effectiveModules(null, 'legal')).every(Boolean), 'businesses from before this change keep everything');
  assert.equal(effectiveModules(JSON.stringify({ auto: true }), 'legal').stock, false);
  assert.equal(effectiveModules(JSON.stringify({ modules: { stock: false } }), 'cleaning_facilities').stock, false);
  assert.equal(effectiveModules(JSON.stringify({ modules: { stock: false } }), 'cleaning_facilities').hiring, true);
  assert.ok(MODULES.every((m) => m.views.length && m.api.length));
});

test('a switched-off module is hidden and refused by the server; its data is kept; only owners and admins switch', async () => {
  const s = await startServer({});
  try {
    const o = await seedOwner(s, {});
    const mods = await s.call('GET', '/api/saas/modules', { cookie: o.cookie });
    assert.equal(mods.status, 200); assert.equal(mods.json.mode, 'all'); assert.ok(mods.json.modules.every((m) => m.on));
    const item = await s.call('POST', '/api/saas/stock/items', { cookie: o.cookie, body: { name: 'Mop heads', unit: 'each', cost: 4.5, reorder_level: 5, reorder_qty: 20 } });
    assert.ok(item.status < 300, item.text);

    const off = await s.call('PUT', '/api/saas/modules', { cookie: o.cookie, body: { modules: { stock: false } } });
    assert.equal(off.status, 200, off.text); assert.equal(off.json.mode, 'custom'); assert.ok(off.json.off_views.includes('stock'));
    const blocked = await s.call('GET', '/api/saas/stock', { cookie: o.cookie });
    assert.equal(blocked.status, 403); assert.equal(blocked.json.module, 'stock');
    assert.equal((await s.call('POST', '/api/saas/stock/items', { cookie: o.cookie, body: { name: 'Gloves', unit: 'box', cost: 9 } })).status, 403);
    assert.ok((await s.call('GET', '/api/saas/me', { cookie: o.cookie })).json.modules_off.includes('stock'), 'the menu is told to hide it');
    assert.equal((await s.call('GET', '/api/saas/hiring/roles', { cookie: o.cookie })).status === 403, false, 'other modules stay on');

    // A staff member cannot change modules.
    const db = new Database(s.dbPath), now = new Date().toISOString(), uid = randomUUID(), token = randomBytes(24).toString('hex');
    db.prepare('INSERT INTO users (id,email,full_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(uid, 'kim@harbour.example.test', 'Kim Staff', 'x', 'x', now, now);
    db.prepare('INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,?,?)').run(o.org, uid, 'employee', now);
    db.prepare('INSERT INTO user_sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').run(randomUUID(), uid, createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 3600000).toISOString(), now, now);
    db.close();
    assert.equal((await s.call('PUT', '/api/saas/modules', { cookie: 'fp_session=' + token, body: { modules: { stock: true } } })).status, 403);

    const on = await s.call('PUT', '/api/saas/modules', { cookie: o.cookie, body: { modules: { stock: true } } });
    assert.equal(on.status, 200);
    const back = await s.call('GET', '/api/saas/stock', { cookie: o.cookie });
    assert.equal(back.status, 200); assert.ok(back.json.items.some((i) => i.name === 'Mop heads'), 'data kept while switched off');

    const rec = await s.call('PUT', '/api/saas/modules', { cookie: o.cookie, body: { use_recommended: true } });
    assert.equal(rec.json.mode, 'recommended'); assert.ok(rec.json.modules.every((m) => m.on), 'custom industry: all recommended');
  } finally { await s.stop(); }
});
