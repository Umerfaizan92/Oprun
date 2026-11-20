// T-168: country-based sign-up (docs/product-redesign/02_COUNTRY_ONBOARDING.md §6).
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { countryProfile, listCountries, normalisePhone, isDisposableEmail, blockedCountries } from '../src/country-profile.js';

const sql = (s, q, ...a) => { const db = new Database(s.dbPath); try { return /^\s*select/i.test(q) ? db.prepare(q).all(...a) : db.prepare(q).run(...a); } finally { db.close(); } };
const PW = 'International-pass-phrase-2026!';
const intl = (over = {}) => ({ country: 'GB', business_name: 'Thames Window Cleaning', address_line1: '12 River Road', city: 'London', postal_code: 'SE1 9AA', timezone: 'Europe/London', full_name: 'Alex Smith', email: 'alex@thameswindows.example', phone: '07400 123456', password: PW, confirm_password: PW, plan_id: 'operations', accept_terms: true, terms_version: 'terms-2026-10-26', ...over });

async function signIn(s, email) {
  const r = await fetch(s.base + '/api/saas/login', { method: 'POST', headers: { origin: s.base, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  assert.equal(r.status, 200, await r.text());
  return (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
}

test('country profile: Australia keeps its rules, other countries get the documents pack and their own phone rules', () => {
  assert.equal(countryProfile('AU').business_verification, 'abr');
  assert.equal(countryProfile('AU').worker_compliance, 'au');
  assert.equal(countryProfile('GB').business_verification, 'none');
  assert.equal(countryProfile('GB').tax.label, 'VAT');
  assert.equal(countryProfile('zz').code, 'AU', 'unknown input falls back safely');
  assert.equal(normalisePhone('0411 222 333', 'AU'), '+61411222333');
  assert.equal(normalisePhone('(08) 9123 4567', 'AU'), null, 'an Australian landline cannot receive the code');
  assert.equal(normalisePhone('07400 123456', 'GB'), '+447400123456');
  assert.equal(normalisePhone('020 7946 0000', 'GB'), null, 'a UK landline cannot receive an SMS code');
  assert.equal(normalisePhone('+61411222333', 'GB'), null, 'the number must belong to the chosen country');
  assert.equal(normalisePhone('0300 1234567', 'PK'), '+923001234567');
  assert.ok(isDisposableEmail('x@mailinator.com')); assert.ok(!isDisposableEmail('x@gmail.com'));
  const list = listCountries({}); assert.equal(list[0].code, 'AU'); assert.ok(list.length > 200); assert.ok(!list.some((c) => c.code === 'KP'));
  assert.equal(blockedCountries({ SIGNUP_BLOCKED_COUNTRIES: 'none' }).size, 0);
});

test('sign-up through the real server: Australia unchanged, another country by email + mobile only', async () => {
  const s = await startServer({ SAAS_VERIFICATION_TEST_MODE: '1' });
  try {
    const countries = await s.call('GET', '/api/saas/registration/countries');
    assert.equal(countries.status, 200); assert.equal(countries.json.countries[0].code, 'AU');

    // Australia: the old request (no country field) still goes through the ABN path.
    const au = await s.call('POST', '/api/saas/registration/start', { body: { business_name: 'Swan Valley Plumbing', identifier_type: 'ABN', business_identifier: '33051775556', state: 'WA', postcode: '6000', full_name: 'Sam Owner', email: 'sam@swanplumbing.example', phone: '0411222667', password: PW, confirm_password: PW, plan_id: 'starter', accept_terms: true, terms_version: 'terms-2026-10-26' } });
    assert.equal(au.status, 202, au.text);
    const auCodes = au.json.delivery.test_codes;
    assert.equal((await s.call('POST', '/api/saas/registration/verify', { body: { pending_id: au.json.pending_id, email_code: auCodes.email, sms_code: auCodes.sms } })).status, 201);
    const auOrg = sql(s, "SELECT country,verification_level,business_identifier,abn_verified_at FROM organisations WHERE name='Swan Valley Plumbing'")[0];
    assert.deepEqual([auOrg.country, auOrg.verification_level, auOrg.business_identifier], ['AU', 'business_verified', '33051775556']); assert.ok(auOrg.abn_verified_at);
    // Australia still needs an Australian mobile.
    const auBadPhone = await s.call('POST', '/api/saas/registration/start', { body: { business_name: 'Other Plumbing', identifier_type: 'ABN', business_identifier: '51824753556', state: 'WA', postcode: '6000', full_name: 'Sam Two', email: 'two@plumb.example', phone: '07400 123456', password: PW, confirm_password: PW, accept_terms: true, terms_version: 'terms-2026-10-26', country: 'AU' } });
    assert.equal(auBadPhone.status, 400);

    // United Kingdom: no ABN, no state, no business registry; created only after both codes are verified.
    assert.equal((await s.call('POST', '/api/saas/registration/start', { body: intl({ phone: '020 7946 0000' }) })).status, 400, 'landline refused');
    assert.equal((await s.call('POST', '/api/saas/registration/start', { body: intl({ email: 'alex@mailinator.com' }) })).status, 400, 'throw-away email refused');
    assert.equal((await s.call('POST', '/api/saas/registration/start', { body: intl({ country: 'KP' }) })).status, 403, 'blocked country');
    assert.equal((await s.call('POST', '/api/saas/registration/start', { body: intl({ country: 'XX' }) })).status, 400, 'unknown country');
    const gb = await s.call('POST', '/api/saas/registration/start', { body: intl() });
    assert.equal(gb.status, 202, gb.text); assert.equal(gb.json.country, 'GB'); assert.equal(gb.json.business.source, 'self_declared');
    assert.equal((await s.call('POST', '/api/saas/registration/verify', { body: { pending_id: gb.json.pending_id, email_code: gb.json.delivery.test_codes.email, sms_code: '000000' } })).status, 401, 'no account without the mobile code');
    assert.equal(sql(s, "SELECT count(*) n FROM organisations WHERE name='Thames Window Cleaning'")[0].n, 0);
    assert.equal((await s.call('POST', '/api/saas/registration/verify', { body: { pending_id: gb.json.pending_id, email_code: gb.json.delivery.test_codes.email, sms_code: gb.json.delivery.test_codes.sms } })).status, 201);
    const org = sql(s, "SELECT * FROM organisations WHERE name='Thames Window Cleaning'")[0];
    assert.deepEqual([org.country, org.verification_level, org.business_identifier, org.abn, org.abn_verified_at, org.city, org.postal_code, org.timezone], ['GB', 'contact_verified', null, null, null, 'London', 'SE1 9AA', 'Europe/London']);
    assert.equal(sql(s, "SELECT phone FROM users WHERE email='alex@thameswindows.example'")[0].phone, '+447400123456');

    // Duplicates: same email, same phone, same business name in the same country.
    assert.equal((await s.call('POST', '/api/saas/registration/start', { body: intl({ phone: '07400 999888' }) })).json.code, 'ACCOUNT_EXISTS');
    assert.equal((await s.call('POST', '/api/saas/registration/start', { body: intl({ email: 'new@thameswindows.example' }) })).json.code, 'ACCOUNT_EXISTS');
    assert.equal((await s.call('POST', '/api/saas/registration/start', { body: intl({ email: 'new@other.example', phone: '07400 999888' }) })).json.code, 'BUSINESS_EXISTS');
    // The same name in another country is a different business.
    assert.equal((await s.call('POST', '/api/saas/registration/start', { body: intl({ country: 'IE', email: 'ie@other.example', phone: '085 123 4567', city: 'Dublin', postal_code: '' }) })).status, 202);

    // Inside the workspace: country shows, workers get the documents pack, no visa or VEVO.
    const cookie = await signIn(s, 'alex@thameswindows.example');
    const me = await s.call('GET', '/api/saas/me', { cookie });
    assert.equal(me.json.organisation.country, 'GB'); assert.equal(me.json.organisation.verification_level, 'contact_verified');
    const w = await s.call('POST', '/api/saas/workers', { cookie, body: { full_name: 'Jo Worker', email: 'jo@worker.example', role_title: 'Window cleaner', employment_type: 'contractor', worker_level: 2, work_status: 'requires_review' } });
    assert.ok(w.status < 300, w.text);
    const wid = sql(s, "SELECT id FROM workers WHERE full_name='Jo Worker'")[0].id;
    assert.deepEqual(sql(s, 'SELECT document_type FROM worker_documents WHERE worker_id=? ORDER BY document_type', wid).map((r) => r.document_type), ['licence_or_certificate', 'other_document', 'photo_id']);
    const reqs = sql(s, 'SELECT requirement_code,official_source_url FROM worker_compliance_requirements WHERE worker_id=?', wid);
    assert.ok(reqs.some((r) => r.requirement_code === 'work_rights_business_review'));
    assert.ok(!reqs.some((r) => /vevo|homeaffairs/i.test(String(r.official_source_url)) || /^work_rights_(visa|pr|citizen)$/.test(r.requirement_code)), 'no Australian checks');
    const state = await s.call('GET', `/api/saas/workers/${wid}/compliance`, { cookie });
    if (state.status === 200) assert.equal((state.json.compliance || state.json.state || state.json).vevo_required ?? false, false);

    // An unpaid international trial cannot send to customers yet; the message stays approved with a clear reason.
    const now = new Date().toISOString(), orgId = org.id;
    sql(s, "INSERT INTO comms_threads (id,organisation_id,channel,contact_address,last_message_at,created_at,updated_at) VALUES ('t-gb',?,'email','customer@example.test',?,?,?)", orgId, now, now, now);
    sql(s, "INSERT INTO workspace_approvals (id,organisation_id,reference_code,title,status,requested_at,updated_at) VALUES ('a-gb',?,'APR-GB-1','Reply','approved',?,?)", orgId, now, now);
    sql(s, "INSERT INTO comms_messages (id,organisation_id,thread_id,direction,body,status,approval_id,occurred_at,created_at) VALUES ('m-gb',?,'t-gb','outbound','Hello','approved','a-gb',?,?)", orgId, now, now);
    const blocked = await s.call('POST', '/api/saas/comms/messages/m-gb/send', { cookie });
    assert.equal(blocked.status, 409, blocked.text); assert.match(blocked.json.error, /payment method/);
    assert.equal(sql(s, "SELECT status FROM comms_messages WHERE id='m-gb'")[0].status, 'approved');
    sql(s, "UPDATE organisation_subscriptions SET payment_status='paid' WHERE organisation_id=?", orgId);
    assert.doesNotMatch((await s.call('POST', '/api/saas/comms/messages/m-gb/send', { cookie })).text, /payment method/, 'paid accounts are not blocked');

    // Australian business: worker keeps the Australian pack.
    const auCookie = await signIn(s, 'sam@swanplumbing.example');
    await s.call('POST', '/api/saas/workers', { cookie: auCookie, body: { full_name: 'Kim Visa', role_title: 'Plumber', employment_type: 'contractor', worker_level: 2, work_status: 'visa_holder' } });
    const kid = sql(s, "SELECT id FROM workers WHERE full_name='Kim Visa'")[0].id;
    const auDocs = sql(s, 'SELECT document_type FROM worker_documents WHERE worker_id=?', kid).map((r) => r.document_type);
    assert.ok(auDocs.includes('identity_work_rights_evidence') && auDocs.includes('abn_details'));
    assert.ok(sql(s, 'SELECT requirement_code FROM worker_compliance_requirements WHERE worker_id=?', kid).some((r) => r.requirement_code === 'work_rights_visa'));
  } finally { await s.stop(); }
});
