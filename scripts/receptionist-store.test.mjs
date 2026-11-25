// R-03 (T-123): AI Receptionist data model and the legacy copy step (dry run first, never overwrites, keeps sources).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { migrateReceptionist, copyLegacyReceptionist } from '../src/comms/receptionist-store.js';

test('the server creates every receptionist table and column; constraints hold', async (t) => {
  const s = await startServer(); t.after(() => s.stop());
  const owner = await seedOwner(s);
  const db = new Database(s.dbPath);
  try {
    for (const tname of ['receptionist_config', 'receptionist_knowledge', 'receptionist_numbers', 'receptionist_port_orders', 'receptionist_followups', 'receptionist_slot_holds', 'receptionist_blocklist', 'receptionist_tool_calls', 'receptionist_duplicate_candidates'])
      assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(tname), tname);
    const vc = new Set(db.prepare('PRAGMA table_info(voice_calls)').all().map((c) => c.name));
    for (const c of ['customer_id', 'enquiry_id', 'thread_id', 'intent', 'outcome', 'billable', 'latency_p50_ms', 'summary_json', 'worker_session_id']) assert.ok(vc.has(c), 'voice_calls.' + c);
    assert.ok(db.prepare('PRAGMA table_info(tenant_customers)').all().some((c) => c.name === 'caller_note'));
    const now = new Date().toISOString();
    db.prepare('INSERT INTO receptionist_config (organisation_id,updated_at) VALUES (?,?)').run(owner.org, now);
    const cfg = db.prepare('SELECT * FROM receptionist_config WHERE organisation_id=?').get(owner.org);
    assert.equal(cfg.status, 'draft'); assert.equal(cfg.booking_mode, 'approve'); assert.equal(cfg.approval_level, 'approve_all'); assert.equal(cfg.recording_enabled, 0);
    assert.deepEqual(JSON.parse(cfg.booking_rules_json).services, [], 'no services = take a message');
    assert.throws(() => db.prepare("UPDATE receptionist_config SET status='on' WHERE organisation_id=?").run(owner.org), /CHECK/);
    db.prepare("INSERT INTO receptionist_numbers (id,organisation_id,e164,origin,created_at,updated_at) VALUES (?,?,?,'bought',?,?)").run(crypto.randomUUID(), owner.org, '+61862891786', now, now);
    assert.throws(() => db.prepare("INSERT INTO receptionist_numbers (id,organisation_id,e164,origin,created_at,updated_at) VALUES (?,?,?,'bought',?,?)").run(crypto.randomUUID(), owner.org, '+61862891786', now, now), /UNIQUE/, 'a number belongs to one business');
    db.prepare("INSERT INTO receptionist_blocklist (id,organisation_id,e164,created_at) VALUES (?,NULL,'+61400000001',?)").run(crypto.randomUUID(), now);
    assert.throws(() => db.prepare("INSERT INTO receptionist_blocklist (id,organisation_id,e164,created_at) VALUES (?,NULL,'+61400000001',?)").run(crypto.randomUUID(), now), /UNIQUE/, 'shared list has each number once');
  } finally { db.close(); }
});

test('legacy copy: dry run writes nothing; apply copies settings, knowledge and numbers once; sources kept', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-rcp-')), file = path.join(dir, 'db.sqlite');
  const db = new Database(file); const now = new Date().toISOString();
  db.exec(`CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE tenant_customers (id TEXT PRIMARY KEY, organisation_id TEXT, name TEXT);
    CREATE TABLE voice_calls (call_control_id TEXT PRIMARY KEY, organisation_id TEXT);
    CREATE TABLE tenant_receptionist_profiles(organisation_id TEXT PRIMARY KEY,greeting TEXT NOT NULL,knowledge TEXT NOT NULL,hours TEXT NOT NULL,timezone TEXT NOT NULL,transfer_destination TEXT,revision INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'draft',updated_by TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE voice_settings (owner_key TEXT PRIMARY KEY, mode TEXT, transfer_number TEXT, recording_notice INTEGER, voicemail_greeting TEXT, transfer_when TEXT, updated_by TEXT, updated_at TEXT);
    CREATE TABLE comms_channels (organisation_id TEXT, channel TEXT, address TEXT, status TEXT);`);
  db.prepare("INSERT INTO organisations VALUES ('a','A'),('b','B')").run();
  db.prepare("INSERT INTO tenant_receptionist_profiles VALUES ('a','Thanks for calling A Plumbing','We fix drains in Joondalup.','Mon-Fri 7-5','Australia/Perth','+61400111222',3,'live','u',?)").run(now);
  db.prepare("INSERT INTO voice_settings VALUES ('b','assistant','+61400333444',0,'Leave a message','urgent','u',?)").run(now);
  db.prepare("INSERT INTO comms_channels VALUES ('a','voice','+61862891786','active'),('b','voice','+61862890000','pending')").run();
  const before = db.prepare('SELECT * FROM tenant_receptionist_profiles').all();

  const dry = copyLegacyReceptionist(db, { now });
  assert.equal(dry.applied, false); assert.equal(dry.config.length, 2); assert.equal(dry.knowledge.length, 1); assert.equal(dry.numbers.length, 1, 'only active numbers');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM receptionist_config').get().n, 0, 'dry run writes nothing');

  const r = copyLegacyReceptionist(db, { apply: true, now });
  assert.equal(r.applied, true);
  const a = db.prepare("SELECT * FROM receptionist_config WHERE organisation_id='a'").get(), b = db.prepare("SELECT * FROM receptionist_config WHERE organisation_id='b'").get();
  assert.equal(a.status, 'draft', 'nothing goes live by migration'); assert.equal(a.greeting, 'Thanks for calling A Plumbing'); assert.equal(JSON.parse(a.transfer_targets_json)[0].e164, '+61400111222');
  assert.equal(b.transfer_when, 'urgent'); assert.equal(b.recording_notice, 0); assert.equal(b.voicemail_greeting, 'Leave a message');
  const k = db.prepare("SELECT * FROM receptionist_knowledge WHERE organisation_id='a'").get();
  assert.equal(k.status, 'draft', 'knowledge waits for the owner to approve'); assert.match(k.prompt_block, /drains in Joondalup/);
  assert.equal(db.prepare("SELECT origin,status,is_primary FROM receptionist_numbers WHERE e164='+61862891786'").get().origin, 'bought');
  assert.deepEqual(db.prepare('SELECT * FROM tenant_receptionist_profiles').all(), before, 'legacy rows unchanged');

  // Running again changes nothing, and an owner's later edit is never overwritten.
  db.prepare("UPDATE receptionist_config SET greeting='Edited by owner' WHERE organisation_id='a'").run();
  const again = copyLegacyReceptionist(db, { apply: true, now });
  assert.equal(again.config.length, 0); assert.equal(again.numbers.length, 0);
  assert.equal(db.prepare("SELECT greeting FROM receptionist_config WHERE organisation_id='a'").get().greeting, 'Edited by owner');
  db.close();

  // The command-line script defaults to a dry run.
  const out = spawnSync(process.execPath, ['scripts/receptionist-copy.mjs', '--db', file], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr); assert.match(out.stdout, /DRY RUN/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('migration is additive and repeatable', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE organisations (id TEXT PRIMARY KEY); CREATE TABLE voice_calls (call_control_id TEXT PRIMARY KEY); CREATE TABLE tenant_customers (id TEXT PRIMARY KEY, notes TEXT);');
  migrateReceptionist(db); migrateReceptionist(db);
  assert.ok(db.prepare('PRAGMA table_info(tenant_customers)').all().some((c) => c.name === 'notes'), 'existing columns kept');
  db.close();
});
