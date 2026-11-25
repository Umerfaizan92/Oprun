#!/usr/bin/env node
// R-03 (T-123): copy legacy receptionist settings into receptionist_config / receptionist_knowledge and list active
// voice numbers in receptionist_numbers. Dry run by default: prints what would be written and changes nothing.
//   node scripts/receptionist-copy.mjs --db /var/data/oprun-ai.sqlite            dry run
//   node scripts/receptionist-copy.mjs --db /var/data/oprun-ai.sqlite --apply    write (existing rows are kept)
import Database from 'better-sqlite3';
import { copyLegacyReceptionist } from '../src/comms/receptionist-store.js';

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const file = arg('--db') || process.env.DATABASE_PATH;
if (!file) { console.error('Give the database file with --db (or set DATABASE_PATH).'); process.exit(1); }
const db = new Database(file, { fileMustExist: true });
db.pragma('busy_timeout = 5000'); db.pragma('foreign_keys = ON');
const r = copyLegacyReceptionist(db, { apply: process.argv.includes('--apply') });
db.close();
console.log(JSON.stringify({ applied: r.applied, config: r.config.length, knowledge: r.knowledge.length, numbers: r.numbers.length, skipped: r.skipped.length }, null, 2));
for (const c of r.config) console.log(`config   ${c.organisation_id} greeting=${c.greeting ? 'yes' : 'no'} transfer=${c.transfer_targets_json !== '[]' ? 'yes' : 'no'}`);
for (const n of r.numbers) console.log(`number   ${n.organisation_id} ${n.e164}`);
for (const s of r.skipped) console.log(`skipped  ${s.organisation_id} (${s.reason})`);
console.log(r.applied ? 'COPY APPLIED.' : 'DRY RUN: nothing was written. Add --apply to write.');
