// R-15/R-18 (T-135, T-138): receptionist settings API: per-part saves with validation, stale-edit protection,
// masked team numbers, go-live checks, pause/resume, calls list; roles enforced; one business only.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';

test('receptionist settings: save each part, protect against stale edits, go live only when ready', async (t) => {
  const s = await startServer({ RECEPTIONIST_ENABLED: '1', RECEPTIONIST_VOICES_JSON: JSON.stringify([{ id: 'v-ava', name: 'Ava', description: 'Warm and calm' }]) }); t.after(() => s.stop());
  const owner = await seedOwner(s, { business: 'Setup Plumbing' });
  const other = await seedOwner(s, { business: 'Other Co', email: 'other-rx@other.example.test' });
  const O = (m, u, b) => s.call(m, u, { cookie: owner.cookie, body: b });
  const sql = (q, ...a) => { const d = new Database(s.dbPath); try { return /^\s*select/i.test(q) ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } };
  let r = await O('GET', '/api/saas/receptionist'); assert.equal(r.status, 200); assert.equal(r.json.enabled, true); assert.equal(r.json.config, null); assert.equal(r.json.voices[0].name, 'Ava');
  r = await O('PUT', '/api/saas/receptionist/config', { part: 'settings', values: { greeting: 'Thanks for calling Setup Plumbing, how can I help?', hours: { mon: [['07:00', '17:00']], tue: [['07:00', '17:00']] }, timezone: 'Australia/Perth', spend_cap_dollars: 50 } });
  assert.equal(r.status, 200, r.text); assert.equal(r.json.config.spend_cap_dollars, 50);
  const stamp = r.json.config.updated_at;
  assert.equal((await O('PUT', '/api/saas/receptionist/config', { part: 'settings', values: { hours: { mon: [['17:00', '07:00']] } } })).status, 400, 'closing before opening');
  assert.equal((await O('PUT', '/api/saas/receptionist/config', { part: 'voice', values: { voice_id: 'not-in-list', voice_speed: 'normal' } })).status, 400);
  r = await O('PUT', '/api/saas/receptionist/config', { part: 'voice', updated_at: stamp, values: { voice_id: 'v-ava', voice_speed: 'slower', languages: ['hi'] } });
  assert.equal(r.status, 200, r.text); assert.deepEqual(r.json.config.languages, ['en-AU', 'hi']); assert.equal(r.json.config.wizard_step, 3);
  assert.equal((await O('PUT', '/api/saas/receptionist/config', { part: 'voice', updated_at: stamp, values: { voice_speed: 'normal' } })).status, 409, 'someone else changed it');
  r = await O('PUT', '/api/saas/receptionist/config', { part: 'booking', values: { booking_mode: 'approve', services: [{ name: 'Blocked drain', duration_min: 60, price_from_dollars: 120 }], buffer_min: 30, lead_time_hours: 24, window_days: 14, service_area: ['Joondalup'], crews: 1 } });
  assert.equal(r.status, 200, r.text); assert.equal(r.json.config.booking_rules.services[0].price_from_dollars, 120);
  assert.equal(JSON.parse(sql('SELECT booking_rules_json FROM receptionist_config WHERE organisation_id=?', owner.org)[0].booking_rules_json).services[0].price_from_cents, 12000);
  assert.equal((await O('PUT', '/api/saas/receptionist/config', { part: 'approvals', values: { approval_level: 'auto_confirmations', transfer_when: 'on_request', transfer_targets: [{ name: 'Sam', e164: '0400555666' }] } })).status, 400, 'E.164 only');
  r = await O('PUT', '/api/saas/receptionist/config', { part: 'approvals', values: { approval_level: 'auto_confirmations', transfer_when: 'on_request', transfer_targets: [{ name: 'Sam', e164: '+61400555666', role: 'owner' }] } });
  assert.equal(r.status, 200, r.text); assert.equal(r.json.config.transfer_targets[0].number, '•••666'); assert.ok(!r.text.includes('+61400555666'), 'numbers are masked');
  // Saving again without retyping the number keeps it.
  r = await O('PUT', '/api/saas/receptionist/config', { part: 'approvals', values: { approval_level: 'auto_confirmations', transfer_when: 'urgent', transfer_targets: [{ name: 'Sam', role: 'owner' }] } });
  assert.equal(JSON.parse(sql('SELECT transfer_targets_json FROM receptionist_config WHERE organisation_id=?', owner.org)[0].transfer_targets_json)[0].e164, '+61400555666');
  // Go live needs a number and approved knowledge.
  r = await O('POST', '/api/saas/receptionist/go-live', {}); assert.equal(r.status, 409); assert.ok(r.json.missing.some((m) => /phone number/.test(m))); assert.ok(r.json.missing.some((m) => /knows/.test(m)));
  const now = new Date().toISOString();
  sql("INSERT INTO receptionist_numbers (id,organisation_id,e164,origin,status,is_primary,created_at,updated_at) VALUES (?,?,'+61862891786','bought','active',1,?,?)", crypto.randomUUID(), owner.org, now, now);
  sql("INSERT INTO receptionist_knowledge (id,organisation_id,revision,status,facts_json,prompt_block,created_at) VALUES (?,?,1,'approved','{}','Facts',?)", crypto.randomUUID(), owner.org, now);
  r = await O('POST', '/api/saas/receptionist/go-live', {}); assert.equal(r.status, 200, r.text); assert.equal(r.json.config.status, 'live');
  assert.equal((await O('POST', '/api/saas/receptionist/resume', {})).status, 409);
  assert.equal((await O('POST', '/api/saas/receptionist/pause', {})).json.config.status, 'paused');
  assert.equal((await O('POST', '/api/saas/receptionist/resume', {})).json.config.status, 'live');
  // Calls list and isolation.
  sql("INSERT INTO voice_calls (call_control_id,organisation_id,scope,from_number,stage,started_at,updated_at,outcome,summary_json) VALUES ('c1',?,'business','+61412000000','ended',?,?,'completed','{\"summary\":\"Needs a plumber\"}')", owner.org, now, now);
  r = await O('GET', '/api/saas/receptionist/calls'); assert.equal(r.json.calls.length, 1); assert.equal(r.json.calls[0].summary, 'Needs a plumber');
  assert.equal((await s.call('GET', '/api/saas/receptionist/calls', { cookie: other.cookie })).json.calls.length, 0);
  assert.equal((await s.call('GET', '/api/saas/receptionist', { cookie: other.cookie })).json.config, null);
  assert.ok(sql("SELECT COUNT(*) n FROM audit_logs WHERE organisation_id=? AND action LIKE 'receptionist.%'", owner.org)[0].n >= 5);
});

test('without the service switched on, nothing can go live', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s);
  const r = await s.call('POST', '/api/saas/receptionist/go-live', { cookie: owner.cookie, body: {} });
  assert.equal(r.status, 409); assert.match(r.json.error, /not switched on/);
  assert.equal((await s.call('GET', '/api/saas/receptionist', { cookie: owner.cookie })).json.enabled, false);
});
