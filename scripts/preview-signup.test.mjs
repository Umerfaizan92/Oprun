// Test sign-up on the isolated test site: off by default; with PREVIEW_ALLOW_SIGNUP=1 an account can be created and the
// email and SMS codes are returned for the screen, because no email or SMS provider is allowed on that site.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { assertIsolatedPreview } from '../src/preview-preflight.js';

const PW = 'Preview-signup-pass-2026!';
const preview = { SUPERPRO_ISOLATED_PREVIEW: '1', PREVIEW_BUSINESS_PASSWORD: 'synthetic-preview-password-1234567890' };
const body = (email) => ({ country: 'GB', business_name: 'Thames Test Cleaning', address_line1: '1 Test Street', city: 'London', postal_code: 'SW1A 1AA', full_name: 'Alex Tester', email, phone: '07400 111222', password: PW, confirm_password: PW, plan_id: 'starter', accept_terms: true, terms_version: 'terms-2026-10-26' });

test('the safety check names blocked settings without their values', () => {
  const env = { ...preview, DATABASE_PATH: '/tmp/p/app.sqlite', UPLOAD_DIR: '/tmp/p/uploads', OPENAI_API_KEY: 'value-never-printed', SMTP_HOST: 'value-two' };
  assert.throws(() => assertIsolatedPreview(env), (e) => /OPENAI_API_KEY, SMTP_HOST$/.test(e.message) && !/value-never-printed|value-two/.test(e.message));
});

test('test sign-up is off unless PREVIEW_ALLOW_SIGNUP=1', async () => {
  const s = await startServer(preview);
  try { assert.equal((await s.call('POST', '/api/saas/registration/start', { body: body('off@thamestest.example') })).status, 403); }
  finally { await s.stop(); }
});

test('with PREVIEW_ALLOW_SIGNUP=1 an account is created with on-screen codes', async () => {
  const s = await startServer({ ...preview, PREVIEW_ALLOW_SIGNUP: '1' });
  try {
    const r = await s.call('POST', '/api/saas/registration/start', { body: body('on@thamestest.example') });
    assert.equal(r.status, 202, r.text); assert.equal(r.json.test_mode, true);
    const codes = r.json.delivery.test_codes; assert.match(codes.email, /^\d{6}$/); assert.match(codes.sms, /^\d{6}$/);
    assert.equal((await s.call('POST', '/api/saas/registration/verify', { body: { pending_id: r.json.pending_id, email_code: codes.email, sms_code: codes.sms } })).status, 201);
    const db = new Database(s.dbPath, { readonly: true }); const row = db.prepare("SELECT modules_json FROM organisations WHERE name='Thames Test Cleaning'").get(); db.close();
    assert.deepEqual(JSON.parse(row.modules_json), { auto: true }, 'TR-24: a new business starts with its industry\'s recommended modules');
    assert.equal((await s.call('POST', '/api/public/support-ticket', { body: {} })).status, 403, 'other public intake stays closed');
  } finally { await s.stop(); }
});

test('with a Telnyx Verify profile present, test sign-up still accepts the latest on-screen codes after resends', async () => {
  const s = await startServer({ ...preview, PREVIEW_ALLOW_SIGNUP: '1', TELNYX_VERIFY_PROFILE_ID: 'profile-id-from-production-env' });
  try {
    const r = await s.call('POST', '/api/saas/registration/start', { body: body('resend@thamestest.example') });
    assert.equal(r.status, 202, r.text);
    let email = r.json.delivery.test_codes.email, sms = r.json.delivery.test_codes.sms;
    for (let i = 0; i < 2; i++) {
      const e = await s.call('POST', '/api/saas/registration/resend', { body: { pending_id: r.json.pending_id, channel: 'email' } }); assert.equal(e.status, 200, e.text); email = e.json.test_code;
      const m = await s.call('POST', '/api/saas/registration/resend', { body: { pending_id: r.json.pending_id, channel: 'sms' } }); assert.equal(m.status, 200, m.text); sms = m.json.test_code;
      assert.match(m.json.message, /Test mode/);
    }
    assert.equal((await s.call('POST', '/api/saas/registration/verify', { body: { pending_id: r.json.pending_id, email_code: email, sms_code: sms } })).status, 201);
  } finally { await s.stop(); }
});
