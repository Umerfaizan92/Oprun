#!/usr/bin/env node
// Backup restore drill. Restores the latest Litestream copy of the database from S3 into a temporary file,
// checks its integrity and audit chain, and compares row counts with the live database when one is given.
// It is read-only towards S3 and never touches the live database file.
//   npm run backup:restore-drill                         restore and check
//   npm run backup:restore-drill -- --compare /var/data/oprun-ai.sqlite
//   npm run backup:restore-drill -- --compare /var/data/oprun-ai.sqlite --record
//     --record (T-045) adds one result row to the live database so Founder Console > Storage & backups shows when the
//     drill last ran and whether it passed. That single insert is the only write; nothing else in the file changes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { applyBackupEnv } from '../src/backup-env.js';
import { verifyAuditChain } from '../src/db.js';

const env = process.env;
const creds = applyBackupEnv(env);
const bin = env.LITESTREAM_BIN || path.resolve('bin', 'litestream');
const compareIdx = process.argv.indexOf('--compare');
const livePath = compareIdx > 0 ? process.argv[compareIdx + 1] : '';
const record = process.argv.includes('--record');
const drillStarted = new Date();
let replicaLabel = null, drillSeconds = null, drillFacts = {};
function recordResult(status, error = null) {
  if (!record || !livePath) return;
  try {
    const live = new Database(livePath, { fileMustExist: true });
    live.pragma('busy_timeout = 5000');
    live.exec("CREATE TABLE IF NOT EXISTS reliability_restore_tests (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL, backup_key TEXT, seconds REAL, checksum_ok INTEGER, integrity TEXT, audit_ok INTEGER, tables INTEGER, gaps_json TEXT, error TEXT, trigger TEXT NOT NULL DEFAULT 'schedule')");
    live.prepare("INSERT INTO reliability_restore_tests (id,started_at,finished_at,status,backup_key,seconds,integrity,audit_ok,tables,gaps_json,error,trigger) VALUES (?,?,?,?,?,?,?,?,?,?,?,'litestream_drill')")
      .run(crypto.randomUUID(), drillStarted.toISOString(), new Date().toISOString(), status, replicaLabel, drillSeconds, drillFacts.integrity ?? null, drillFacts.audit_ok ?? null, drillFacts.tables ?? null, JSON.stringify(drillFacts.gaps || []), error ? String(error).slice(0, 500) : null);
    live.close();
    console.log('Result recorded for Founder Console > Storage & backups.');
  } catch (e) { console.error('Could not record the result: ' + e.message); }
}
const fail = (msg) => { console.error('RESTORE DRILL FAILED: ' + msg); recordResult('failed', msg); process.exit(1); };

const fileReplica = String(env.BACKUP_FILE_DIR || '').trim();
if (!fileReplica && (!creds.bucket || !creds.id || !creds.secret)) fail('backup bucket or AWS keys are not set (names checked: BACKUP_S3_BUCKET/AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).');
if (!fs.existsSync(bin)) fail(`Litestream is not installed at ${bin}. Run npm ci on Linux or set LITESTREAM_BIN.`);

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-restore-'));
const target = path.join(work, 'restored.sqlite');
const replica = fileReplica ? 'file://' + path.resolve(fileReplica) : `s3://${creds.bucket}/${env.BACKUP_S3_DB_PREFIX || 'super-pro/db'}`;
replicaLabel = fileReplica ? 'file replica' : `s3://${creds.bucket}/${env.BACKUP_S3_DB_PREFIX || 'super-pro/db'}`;
const started = Date.now();
const r = spawnSync(bin, ['restore', '-o', target, replica], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...env, AWS_REGION: creds.region || env.AWS_REGION || 'us-east-1' } });
if (r.status !== 0) fail('litestream restore exited with ' + r.status + ': ' + String(r.stderr).split('\n').slice(-3).join(' '));
const seconds = ((Date.now() - started) / 1000).toFixed(1);
drillSeconds = Number(seconds);

const restored = new Database(target, { readonly: true });
const integrity = restored.pragma('integrity_check', { simple: true });
const audit = verifyAuditChain(restored);
const tables = restored.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((t) => t.name);
const count = (db, t) => { try { return db.prepare(`SELECT COUNT(*) n FROM "${t}"`).get().n; } catch { return null; } };
const restoredCounts = Object.fromEntries(tables.map((t) => [t, count(restored, t)]));
console.log(`Restored ${tables.length} tables in ${seconds}s. integrity_check=${integrity}. audit chain ${audit.ok ? 'verified' : 'BROKEN'} (${audit.checked} rows).`);

let mismatches = [];
if (livePath) {
  const live = new Database(livePath, { readonly: true, fileMustExist: true });
  for (const t of tables) {
    const a = count(live, t), b = restoredCounts[t];
    // The live database keeps changing, so the restored copy may trail by the last few seconds of writes.
    if (a !== null && b !== null && b < a - 50) mismatches.push(`${t}: live ${a}, restored ${b}`);
  }
  live.close();
  console.log(mismatches.length ? `Row count gaps larger than 50:\n  ${mismatches.join('\n  ')}` : 'Row counts match the live database (within the last few seconds of writes).');
}
restored.close();
fs.rmSync(work, { recursive: true, force: true });
drillFacts = { integrity: String(integrity), audit_ok: audit.ok ? 1 : 0, tables: tables.length, gaps: mismatches };
if (integrity !== 'ok' || !audit.ok || mismatches.length) fail(mismatches.length ? `${mismatches.length} table(s) differ from the live database.` : integrity !== 'ok' ? 'integrity check failed.' : 'audit chain broken.');
recordResult('passed');
console.log('RESTORE DRILL PASSED.');
