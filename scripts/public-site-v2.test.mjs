// TR-14: Integrations and Security pages exist, are routed and linked, and only name services the code connects to.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PUBLIC_ROUTES } from '../src/public-site.js';
import { INTEGRATIONS, SECURITY, PLANS } from './site/content.mjs';

test('integrations and security pages are built, routed and in the footer', () => {
  for (const [route, file] of [['/integrations', 'integrations.html'], ['/security', 'security.html']]) {
    assert.ok(PUBLIC_ROUTES.some(([r, f]) => r === route && f === file), route);
    assert.ok(fs.existsSync('saas/site/' + file), file);
    assert.match(fs.readFileSync('saas/site/home.html', 'utf8'), new RegExp(`href="${route}"`), 'footer links ' + route);
  }
  assert.ok(SECURITY.length >= 5);
});

test('every listed integration has code behind it', () => {
  const code = ['src/channel-providers.js', 'src/payments.js', 'src/meeting-extras.js', 'src/seo/google.js'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const proof = { 'Facebook and Instagram': 'graph.facebook.com', TikTok: 'tiktok', YouTube: 'youtube', X: "'x'", Snapchat: 'snapchat', 'Google Business Profile': 'mybusiness', 'WhatsApp Business': 'whatsapp', Gmail: 'gmail', 'Email and SMS': 'email_sms', 'Your website': "website: 'Website'", 'Google Search and Analytics': 'searchAnalytics', Stripe: 'Stripe', PayPal: 'PayPal', Zoom: 'Zoom' };
  for (const g of INTEGRATIONS) for (const [name] of g.items) { assert.ok(proof[name], 'no proof recorded for ' + name); assert.ok(code.includes(proof[name]), name); }
});

test('site plan prices match the server seed', () => {
  const db = fs.readFileSync('src/db.js', 'utf8');
  for (const p of PLANS) assert.match(db, new RegExp(`'${p.id}','${p.name}',0,${p.price * 100},'AUD'|${p.id}[^\\n]*${p.price * 100}`), p.id);
  assert.match(fs.readFileSync('saas/ds/site.js', 'utf8'), /\/api\/saas\/plans/);
});
