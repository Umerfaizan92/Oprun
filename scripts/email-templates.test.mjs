import test from 'node:test';
import assert from 'node:assert/strict';
import {renderEmail,platformBrand} from '../src/email-templates.js';
import {sendSaasVerificationEmail} from '../src/mailer.js';
test('email frame preserves branded actions, plain text and escaped private values',()=>{
 const result=renderEmail(platformBrand({PUBLIC_BASE_URL:'https://example.test'}),{heading:'Join <team>',paragraphs:['Welcome & verify'],facts:[['Code','123456']],button:{label:'Continue',url:'https://example.test/invite#private'},notes:['Expires in 10 minutes']});
 assert.match(result.html,/Join &lt;team&gt;/);assert.match(result.html,/background:#090b10/);assert.match(result.html,/https:\/\/example.test\/invite#private/);
 assert.match(result.text,/Code: 123456/);assert.match(result.text,/Continue: https:\/\/example.test\/invite#private/);
 assert.doesNotMatch(renderEmail({name:'Business',color:'#000000'},{heading:'Review',button:{label:'Open',url:'javascript:alert(1)'}}).html,/javascript:/);
 assert.match(renderEmail({name:'Business',color:'#000000'},{heading:'Review',button:{label:'Open',url:'https://example.test'}}).html,/color:#ffffff;text-decoration:none/);
});

test('registration sender stays scoped to registration and never falls back when rejected', async (t) => {
  const senders = [];
  let rejectedSender;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { from } = JSON.parse(options.body);
    senders.push(from);
    if (from === rejectedSender) {
      return Response.json({ name: 'validation_error', message: 'Sender domain is not verified' }, { status: 403 });
    }
    return Response.json({ id: 'receipt' });
  });
  const env = {
    RESEND_API_KEY: 'fixture-resend-key',
    SAAS_REGISTRATION_FROM: 'security@oprun.ai',
    SAAS_VERIFY_FROM: 'Existing Security <security@example.test>',
    NOTIFY_FROM: 'Notifications <notifications@example.test>'
  };
  const message = { to: 'recipient@example.test', code: '123456', businessName: 'Example' };
  const registration = { ...message, registration: true };

  await sendSaasVerificationEmail(env, registration);
  await sendSaasVerificationEmail(env, message);
  await sendSaasVerificationEmail({ ...env, SAAS_REGISTRATION_FROM: '' }, registration);
  rejectedSender = 'Oprun AI Security <security@oprun.ai>';
  await assert.rejects(sendSaasVerificationEmail(env, registration), /Sender domain is not verified/);
  assert.deepEqual(await sendSaasVerificationEmail({ ...env, SAAS_REGISTRATION_FROM: 'invalid' }, registration), {
    sent: false, reason: 'sender_not_configured'
  });
  assert.deepEqual(senders, [rejectedSender, env.SAAS_VERIFY_FROM, env.SAAS_VERIFY_FROM, rejectedSender]);
});

test('verification uses the dedicated outbound key and retains legacy compatibility', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push({
      authorization: new Headers(options.headers).get('authorization'),
      message: JSON.parse(options.body)
    });
    return Response.json({ id: 'fixture-receipt' });
  });
  const from = 'Oprun AI Security <security@oprun.ai>';
  const env = {
    RESEND_API_KEY: 'fixture-legacy-key',
    RESEND_OUTBOUND_API_KEY: 'fixture-outbound-key',
    SAAS_VERIFY_FROM: from,
    SAAS_REGISTRATION_FROM: from
  };
  const message = { to: 'recipient@example.test', code: '123456', businessName: 'Account recovery' };

  assert.equal((await sendSaasVerificationEmail(env, { ...message, recovery: true })).sent, true);
  assert.equal((await sendSaasVerificationEmail(env, { ...message, registration: true })).sent, true);
  assert.equal((await sendSaasVerificationEmail({ ...env, RESEND_OUTBOUND_API_KEY: '' }, message)).sent, true);
  assert.deepEqual(requests.map(({authorization, message}) => [authorization, message.from]), [
    ['Bearer fixture-outbound-key', from],
    ['Bearer fixture-outbound-key', from],
    ['Bearer fixture-legacy-key', from]
  ]);
  const recovery = requests[0].message;
  assert.equal(recovery.subject, 'Your Oprun password recovery code');
  assert.match(recovery.html, /Recover your account/);
  assert.match(recovery.text, /Recovery code: 123456/);
  assert.doesNotMatch(recovery.html.split('<table')[0], /123456/);
  assert.match(recovery.html, /https:\/\/www.oprun.ai\/saas\/oprun-icon-192.png/);
  assert.match(requests[1].message.text, /Verification code: 123456/);
});
