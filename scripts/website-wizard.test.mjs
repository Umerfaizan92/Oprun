// W-03 (T-149) Build wizard API: saved and resumed per business, pre-filled from Oprun, owner/admin only, generates
// drafts through W-04 and never publishes by itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

function addMember(s, owner, role) {
  const db = new Database(s.dbPath), uid = randomUUID(), token = randomBytes(24).toString('hex'), now = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,full_name,password_hash,password_salt,created_at,updated_at,email_verified,phone_verified) VALUES (?,?,?,?,?,?,?,1,1)').run(uid, role + '@harbour.example.test', 'A ' + role, 'x', 'x', now, now);
  db.prepare('INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,?,?)').run(owner.org, uid, role, now);
  db.prepare('INSERT INTO user_sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').run(randomUUID(), uid, createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 36e5).toISOString(), now, now);
  db.close();
  return 'fp_session=' + token;
}
const DATA = { mode: 'new', business: { name: 'Harbour Plumbing', phone: '08 9000 1234', services: ['Blocked drains', 'Hot water systems'], areas: [{ name: 'Fremantle', fact: 'Our van is based in South Fremantle.' }, { name: 'Cockburn', fact: '' }], hours: 'Monday to Friday, 7am to 5pm', mobile_service: true }, style: { key: 'clean_trade', color: '#1f4e79' }, pages: { core: ['home', 'services', 'areas', 'faq', 'contact'], service_pages: true } };

test('wizard: save and resume, generate drafts, review with checks, nothing published, roles and isolation', async () => {
  const s = await startServer();
  try {
    const owner = await seedOwner(s, { business: 'Harbour Plumbing' }), other = await seedOwner(s, { business: 'Other Co', email: 'other@example.test' });
    let r = await s.call('GET', '/api/saas/website/wizard', { cookie: owner.cookie });
    assert.equal(r.status, 200, r.text); assert.equal(r.json.enabled, true); assert.equal(r.json.step, 1); assert.equal(r.json.site, null);
    assert.equal(r.json.data.business.name, 'Harbour Plumbing', 'pre-filled from Oprun');
    assert.equal((await s.call('POST', '/api/saas/website/wizard/generate', { cookie: owner.cookie, body: {} })).status, 400, 'nothing to generate before details are saved');
    assert.equal((await s.call('PUT', '/api/saas/website/wizard', { cookie: owner.cookie, body: { step: 2, data: { ...DATA, business: { ...DATA.business, abn: '123' } } } })).status, 400, 'ABN checked');
    r = await s.call('PUT', '/api/saas/website/wizard', { cookie: owner.cookie, body: { step: 4, data: DATA } });
    assert.equal(r.status, 200, r.text); assert.equal(r.json.step, 4); assert.deepEqual(r.json.missing, []);
    r = await s.call('GET', '/api/saas/website/wizard', { cookie: owner.cookie }); assert.equal(r.json.step, 4); assert.equal(r.json.data.business.areas[0].fact, DATA.business.areas[0].fact, 'resumes where the owner left');
    const manager = addMember(s, owner, 'manager');
    assert.equal((await s.call('PUT', '/api/saas/website/wizard', { cookie: manager, body: { step: 2, data: DATA } })).status, 403, 'managers do not run the wizard');
    assert.equal((await s.call('GET', '/api/saas/website/wizard', { cookie: other.cookie })).json.step, 1, 'another business sees its own wizard');

    r = await s.call('POST', '/api/saas/website/wizard/generate', { cookie: owner.cookie, body: {} });
    assert.equal(r.status, 201, r.text);
    const slugs = r.json.pages.map((p) => p.slug);
    assert.deepEqual(slugs, ['home', 'services', 'blocked-drains', 'hot-water-systems', 'areas', 'area-fremantle', 'faq', 'contact']);
    assert.match(r.json.notes.join(' '), /No page for Cockburn/);
    assert.ok(r.json.pages.every((p) => p.wording === 'plain'), 'no AI in tests: plain wording from the facts');
    r = await s.call('GET', '/api/saas/website/wizard', { cookie: owner.cookie });
    assert.equal(r.json.step, 8); assert.equal(r.json.site.build_status, 'review'); assert.equal(r.json.allowance.website_generation.used, 1);
    const pages = r.json.review.pages; assert.equal(pages.length, 8);
    assert.ok(pages.every((p) => !p.published && p.preview_url && p.checks), 'drafts with previews and pre-publish checks');
    const faq = pages.find((p) => p.slug === 'faq'); assert.ok(faq.blocks.some((b) => b.type === 'faq' && b.items >= 1));
    const db = new Database(s.dbPath);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM seo_site_pages WHERE owner_key=? AND published_version IS NOT NULL").get(owner.org).n, 0, 'nothing is published by the wizard');
    assert.equal(db.prepare("SELECT COUNT(*) n FROM usage_events WHERE organisation_id=? AND kind='website_generation'").get(owner.org).n, 1);
    db.close();
    // Section rewrite needs the AI; without it the section is left unchanged and the owner is told.
    const home = pages.find((p) => p.slug === 'home');
    r = await s.call('POST', '/api/saas/website/wizard/section', { cookie: owner.cookie, body: { page_id: home.id, index: 0 } });
    assert.equal(r.status, 502); assert.match(r.json.error, /unchanged/);
    assert.equal((await s.call('POST', '/api/saas/website/wizard/section', { cookie: other.cookie, body: { page_id: home.id, index: 0 } })).status, 404, 'another business cannot rewrite it');
    // Generating again updates the same site's drafts (no second site).
    r = await s.call('POST', '/api/saas/website/wizard/generate', { cookie: owner.cookie, body: {} }); assert.equal(r.status, 201, r.text);
    const db2 = new Database(s.dbPath); assert.equal(db2.prepare('SELECT COUNT(*) n FROM seo_sites WHERE owner_key=?').get(owner.org).n, 1); db2.close();
  } finally { await s.stop(); }
});
