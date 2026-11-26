// TR-52: proposed workspace. Acceptance: approval required (nothing changes before it) and consent recorded.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { buildProposal, splitServices, isSolo, CONSENT_TEXT, CONSENT_VERSION } from '../src/onboarding-proposal.js';

async function answer(s, owner, pairs) {
  let r = await s.call('GET', '/api/saas/onboarding/interview', { cookie: owner.cookie });
  for (const [k, v] of pairs) r = await s.call('PUT', `/api/saas/onboarding/interview/answers/${k}`, { cookie: owner.cookie, body: { value: v, revision: r.json.session.revision } });
  return s.call('POST', '/api/saas/onboarding/interview/finish', { cookie: owner.cookie, body: {} });
}
function addMember(s, owner, role) {
  const db = new Database(s.dbPath), uid = randomUUID(), token = randomBytes(24).toString('hex'), now = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,full_name,password_hash,password_salt,created_at,updated_at,email_verified,phone_verified) VALUES (?,?,?,?,?,?,?,1,1)').run(uid, role + '@harbour.example.test', 'A ' + role, 'x', 'x', now, now);
  db.prepare('INSERT INTO memberships (organisation_id,user_id,role,created_at) VALUES (?,?,?,?)').run(owner.org, uid, role, now);
  db.prepare('INSERT INTO user_sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').run(randomUUID(), uid, createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 36e5).toISOString(), now, now);
  db.close();
  return 'fp_session=' + token;
}

test('proposal helpers', () => {
  assert.deepEqual(splitServices('Blocked drains, hot water systems and leak repairs'), ['Blocked drains', 'Hot water systems', 'Leak repairs']);
  assert.deepEqual(splitServices('', ['Fallback']), ['Fallback']);
  assert.equal(isSolo('Just me for now'), true); assert.equal(isSolo('Me and two apprentices'), false);
  const p = buildProposal({ answers: { business: { value: 'Residential plumbing' }, services: { value: 'Blocked drains, hot water' }, team: { value: 'just me' }, service_area: { value: 'Perth' } }, businessName: 'Harbour Plumbing' });
  assert.equal(p.industry.code, 'construction_trades');
  assert.equal(p.profile.team_mode, 'solo');
  assert.equal(p.modules.find((m) => m.key === 'hiring').on, false, 'a one-person business does not get Hiring switched on');
  assert.equal(p.stages.find((s) => s.key === 'allocation').on, false, 'nobody to allocate');
  assert.match(p.templates[0].body, /Harbour Plumbing/); assert.match(p.templates[0].body, /blocked drains/);
  const shop = buildProposal({ answers: { business: { value: 'Online clothing shop' }, services: { value: 'Dresses, shirts' }, team: { value: 'three staff' } } });
  assert.equal(shop.stages.find((s) => s.key === 'quotation').on, false, 'shops do not quote');
  assert.ok(!shop.templates.some((t) => t.key === 'quote_follow_up'));
});

test('nothing changes until the owner approves with consent; the consent is recorded', async () => {
  const s = await startServer({});
  try {
    const owner = await seedOwner(s);
    const call = (m, u, body, cookie = owner.cookie) => s.call(m, u, body === undefined || body === null ? { cookie } : { cookie, body });
    assert.equal((await call('POST', '/api/saas/onboarding/proposal', {})).status, 409, 'questions first');
    assert.equal((await answer(s, owner, [['business', 'Residential plumbing and hot water repairs'], ['services', 'Blocked drains, hot water systems and leak repairs'], ['service_area', 'Perth northern suburbs'], ['team', 'Just me'], ['hours', 'Weekdays 7am to 4pm']])).status, 200);
    const before = { me: (await call('GET', '/api/saas/me')).json, modules: (await call('GET', '/api/saas/modules')).json.mode, profile: (await call('GET', '/api/saas/onboarding')).json.profile };

    let r = await call('POST', '/api/saas/onboarding/proposal', {});
    assert.equal(r.status, 201);
    const p = r.json.proposal;
    assert.equal(p.status, 'proposed');
    assert.equal(p.proposal.industry.code, 'construction_trades');

    // Proposed but not approved: the workspace is exactly as before.
    assert.equal((await call('GET', '/api/saas/modules')).json.mode, before.modules);
    assert.deepEqual((await call('GET', '/api/saas/onboarding')).json.profile, before.profile);
    assert.equal((await call('GET', '/api/saas/me')).json.organisation.pipeline_stages, null);
    assert.deepEqual((await call('GET', '/api/saas/workspace-templates')).json.templates, []);

    const choices = { profile: true, services: p.proposal.services, modules: Object.fromEntries(p.proposal.modules.map((m) => [m.key, m.on])), stages: p.proposal.stages.filter((x) => x.on).map((x) => x.key), templates: ['enquiry_ack', 'invoice_reminder'] };
    // A manager can see it but cannot approve.
    const manager = addMember(s, owner, 'manager');
    assert.equal((await call('GET', '/api/saas/onboarding/proposal', null, manager)).json.can_approve, false);
    assert.equal((await call('POST', `/api/saas/onboarding/proposal/${p.id}/approve`, { consent: true, consent_version: CONSENT_VERSION, choices }, manager)).status, 403);
    // No consent, wrong consent version, or dropping the Enquiry stage: refused, nothing applied.
    assert.equal((await call('POST', `/api/saas/onboarding/proposal/${p.id}/approve`, { consent: false, consent_version: CONSENT_VERSION, choices })).status, 400);
    assert.equal((await call('POST', `/api/saas/onboarding/proposal/${p.id}/approve`, { choices })).status, 400);
    assert.equal((await call('POST', `/api/saas/onboarding/proposal/${p.id}/approve`, { consent: true, consent_version: '2020-01-01', choices })).status, 400);
    assert.equal((await call('POST', `/api/saas/onboarding/proposal/${p.id}/approve`, { consent: true, consent_version: CONSENT_VERSION, choices: { ...choices, stages: ['quotation', 'payment'] } })).status, 400);
    assert.equal((await call('GET', '/api/saas/modules')).json.mode, before.modules, 'still unchanged after refusals');

    // Answers change after the proposal: it can no longer be approved.
    let iv = (await call('GET', '/api/saas/onboarding/interview')).json;
    await call('PUT', '/api/saas/onboarding/interview/answers/hours', { value: 'Weekdays 7am to 5pm', revision: iv.session.revision });
    r = await call('POST', `/api/saas/onboarding/proposal/${p.id}/approve`, { consent: true, consent_version: CONSENT_VERSION, choices });
    assert.equal(r.status, 409); assert.equal(r.json.stale, true);
    assert.equal((await call('GET', '/api/saas/onboarding/proposal')).json.proposal.stale, true);

    // A fresh proposal, approved with consent by the owner.
    const fresh = (await call('POST', '/api/saas/onboarding/proposal', {})).json.proposal;
    assert.notEqual(fresh.id, p.id);
    r = await call('POST', `/api/saas/onboarding/proposal/${fresh.id}/approve`, { consent: true, consent_version: CONSENT_VERSION, choices: { ...choices, services: ['Blocked drains', 'Hot water systems'] } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.proposal.status, 'approved');
    assert.equal((await call('POST', `/api/saas/onboarding/proposal/${fresh.id}/approve`, { consent: true, consent_version: CONSENT_VERSION, choices })).status, 409, 'only once');

    // Now, and only now, the workspace reflects the choices.
    const profile = (await call('GET', '/api/saas/onboarding')).json.profile;
    assert.equal(profile.industry_code, 'construction_trades');
    assert.deepEqual(profile.services, ['Blocked drains', 'Hot water systems']);
    assert.ok(profile.completed_at);
    const mods = (await call('GET', '/api/saas/modules')).json;
    assert.equal(mods.mode, 'custom');
    assert.equal(mods.modules.find((m) => m.key === 'hiring').on, false);
    assert.deepEqual((await call('GET', '/api/saas/me')).json.organisation.pipeline_stages, choices.stages);
    assert.ok(!choices.stages.includes('allocation'));
    assert.deepEqual((await call('GET', '/api/saas/workspace-templates')).json.templates.map((x) => x.key), ['enquiry_ack', 'invoice_reminder']);

    // The consent is on record with the exact wording, version, person and choices; the audit log has the decision.
    const db = new Database(s.dbPath, { readonly: true });
    const c = db.prepare('SELECT * FROM onboarding_consents WHERE proposal_id=?').all(fresh.id);
    assert.equal(c.length, 1);
    assert.equal(c[0].user_id, owner.uid); assert.equal(c[0].consent_text, CONSENT_TEXT); assert.equal(c[0].consent_version, CONSENT_VERSION);
    assert.deepEqual(JSON.parse(c[0].choices_json).services, ['Blocked drains', 'Hot water systems']);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM onboarding_consents').get().n, 1, 'refused attempts left no consent');
    assert.equal(db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='onboarding.proposal_approved'").get().n, 1);
    assert.equal(db.prepare("SELECT status FROM onboarding_proposals WHERE id=?").get(p.id).status, 'superseded');
    db.close();
  } finally { await s.stop(); }
});

test('declining changes nothing', async () => {
  const s = await startServer({});
  try {
    const owner = await seedOwner(s);
    await answer(s, owner, [['business', 'Small dental practice'], ['services', 'Check-ups, cleaning'], ['service_area', 'Subiaco'], ['team', 'Two dentists and a receptionist']]);
    const p = (await s.call('POST', '/api/saas/onboarding/proposal', { cookie: owner.cookie, body: {} })).json.proposal;
    assert.equal(p.proposal.stages.find((x) => x.key === 'quotation').on, false);
    assert.equal((await s.call('POST', `/api/saas/onboarding/proposal/${p.id}/decline`, { cookie: owner.cookie, body: {} })).status, 200);
    assert.equal((await s.call('GET', '/api/saas/onboarding/proposal', { cookie: owner.cookie })).json.proposal.status, 'declined');
    assert.equal((await s.call('GET', '/api/saas/onboarding', { cookie: owner.cookie })).json.profile.completed_at, null);
    assert.equal((await s.call('GET', '/api/saas/modules', { cookie: owner.cookie })).json.mode, 'all');
    const db = new Database(s.dbPath, { readonly: true });
    assert.equal(db.prepare('SELECT COUNT(*) n FROM onboarding_consents').get().n, 0);
    db.close();
  } finally { await s.stop(); }
});

// MB-28: five industries from the owner's own words to a proposed workspace that fits them.
test('five industries get a fitting proposal from plain answers', () => {
  const propose = (business, services, team) => buildProposal({ answers: { business: { value: business }, services: { value: services }, team: { value: team } }, businessName: 'Test Co' });
  const on = (p, key) => p.stages.find((s) => s.key === key).on;
  const trades = propose('Residential plumbing and hot water repairs', 'Blocked drains, hot water systems', 'Me and two apprentices');
  assert.equal(trades.industry.code, 'construction_trades'); assert.ok(on(trades, 'quotation') && on(trades, 'allocation'));
  const cleaning = propose('Commercial office cleaning', 'Office cleaning, carpet cleaning', 'A team of eight cleaners');
  assert.equal(cleaning.industry.code, 'cleaning_facilities'); assert.ok(on(cleaning, 'allocation'));
  const dental = propose('Family dental clinic', 'Check-ups, fillings, teeth whitening', 'Two dentists and a receptionist');
  assert.equal(dental.industry.code, 'dental', 'a dental clinic is a dental practice, not general healthcare');
  assert.equal(on(dental, 'quotation'), false); assert.match(dental.templates.find((t) => t.key === 'reminder').body, /appointment/);
  const shop = propose('Online clothing shop', 'Dresses, shirts', 'three staff');
  assert.equal(shop.industry.code, 'retail_ecommerce'); assert.equal(on(shop, 'quotation'), false); assert.match(shop.templates.find((t) => t.key === 'reminder').body, /order/);
  const ndis = propose('NDIS disability support services', 'Personal care, community access, respite', 'Twelve support workers');
  assert.equal(ndis.industry.code, 'ndis'); assert.equal(on(ndis, 'quotation'), false);
  for (const p of [trades, cleaning, dental, shop, ndis]) { assert.ok(p.services.length >= 2); assert.ok(p.modules.some((m) => m.on)); assert.match(p.templates[0].body, /Test Co/); }
  assert.equal(buildProposal({ answers: { business: { value: 'Vet clinic for cats and dogs' } } }).industry.code, 'veterinary');
});
