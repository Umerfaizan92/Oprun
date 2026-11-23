// TR-50: guided onboarding interview. Answers are saved on the server as they are given, can be corrected, and the
// next visit resumes where the owner left off. Acceptance: resume after closing the browser (browser test in
// scripts/test-onboarding-interview-ui.mjs; this file covers the server rules).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { CORE_QUESTIONS } from '../src/onboarding-interview.js';
import { MESSAGES } from '../saas/locale-catalog.js';

test('answers are saved one by one, corrected, resumed and finished; nothing in the workspace changes', async () => {
  const s = await startServer({});
  try {
    const owner = await seedOwner(s);
    const call = (m, u, body) => s.call(m, u, { cookie: owner.cookie, body });
    assert.equal((await s.call('GET', '/api/saas/onboarding/interview', {})).status, 401, 'signed-in owners only');
    let r = await call('GET', '/api/saas/onboarding/interview');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.questions.map((q) => q.key), CORE_QUESTIONS.map((q) => q.key));
    let session = r.json.session;
    assert.deepEqual([session.step, session.answered, session.status], [0, 0, 'in_progress']);

    const put = (key, value, extra = {}) => call('PUT', `/api/saas/onboarding/interview/answers/${key}`, { value, revision: session.revision, ...extra });
    r = await put('business', 'x'); assert.equal(r.status, 400, 'required answers need some content');
    r = await put('business', 'Residential plumbing and hot water repairs', { source: 'voice', language: 'en-AU' }); assert.equal(r.status, 200); session = r.json.session;
    assert.equal(session.step, 1);
    r = await put('services', 'नल ठीक करना, गर्म पानी की टंकी लगाना', { language: 'hi' }); session = r.json.session;
    assert.deepEqual([session.step, session.answered], [2, 2]);
    assert.equal(session.answers.services.language, 'hi', 'the answer is kept in the language it was given');
    assert.equal(session.answers.business.source, 'voice');

    // A stale save is refused instead of overwriting a newer answer.
    r = await call('PUT', '/api/saas/onboarding/interview/answers/service_area', { value: 'Perth', revision: 1 });
    assert.equal(r.status, 409); assert.ok(r.json.session, 'the latest answers come back with the refusal');

    // "Close the browser" and come back: a fresh GET has everything, and opens at question 3.
    r = await call('GET', '/api/saas/onboarding/interview'); session = r.json.session;
    assert.deepEqual([session.step, session.first_unanswered, session.answered], [2, 2, 2]);
    assert.equal(session.answers.business.value, 'Residential plumbing and hot water repairs');

    // Correct an earlier answer: the owner stays on the question they were on; the old text is kept as history.
    r = await put('business', 'Residential and small commercial plumbing'); session = r.json.session;
    assert.equal(session.step, 2, 'a correction does not move the owner');
    assert.equal(session.answers.business.corrections, 1);
    // Going back and forward is saved too.
    r = await call('PUT', '/api/saas/onboarding/interview/step', { step: 0, revision: session.revision }); session = r.json.session;
    assert.equal(session.step, 0);
    r = await call('PUT', '/api/saas/onboarding/interview/step', { step: 99, revision: session.revision }); assert.equal(r.status, 400);

    // Finishing needs the required answers.
    r = await call('POST', '/api/saas/onboarding/interview/finish', {}); assert.equal(r.status, 400);
    assert.deepEqual(r.json.missing, ['service_area', 'team']);
    for (const [k, v] of [['service_area', 'Perth northern suburbs'], ['team', 'Me and two apprentices']]) { r = await put(k, v); session = r.json.session; }
    assert.equal((await put('hours', 'y'.repeat(600))).status, 400, 'length limits apply');
    r = await call('POST', '/api/saas/onboarding/interview/finish', {}); assert.equal(r.status, 200);
    assert.equal(r.json.session.status, 'answered');
    assert.deepEqual(r.json.session.missing_required, []);

    // Nothing in the workspace changed: no business profile was written.
    const profile = (await call('GET', '/api/saas/onboarding')).json.profile;
    assert.equal(profile.completed_at, null, 'the workspace is untouched until a proposal is approved (TR-52)');
    assert.equal(profile.business_type, '');
  } finally { await s.stop(); }
});

test('every question has text in English, Hindi, Urdu and Arabic, and the page loads the interview', () => {
  for (const lang of ['en', 'hi', 'ur', 'ar']) for (const q of CORE_QUESTIONS) {
    assert.ok(MESSAGES[lang][`ob.q.${q.key}`], `${lang} question ${q.key}`);
    assert.ok(MESSAGES[lang][`ob.h.${q.key}`], `${lang} hint ${q.key}`);
  }
  const html = readFileSync(new URL('../saas/workspace.html', import.meta.url), 'utf8');
  assert.match(html, /workspace-interview\.js\?v=/);
  const js = readFileSync(new URL('../saas/workspace-interview.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /localStorage|sessionStorage/, 'progress lives on the server, not in the browser');
  assert.match(js, /SuperProAIClient\?\.listen/, 'reuses the existing dictation');
});
