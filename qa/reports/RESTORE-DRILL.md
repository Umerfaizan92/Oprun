# Backup restore drill (TR-73), 24 Nov 2026

## Drill run here (same tools as production)

- Database: copy of a test server holding three businesses with sample records, website drafts and inbox
  (3.5 MB, 267 tables, 126 audit rows).
- Litestream 0.3.13 replicated it to a file replica; `scripts/restore-drill.mjs --compare` restored it into a new file.
- Result: **RESTORE DRILL PASSED** in **0.19 s** (restore 0.1 s): `integrity_check=ok`, audit chain verified (126 rows),
  row counts match the original.
- `scripts/restore-drill.test.mjs` (25-row chain) also passes with Litestream installed.

## Production backups (read from the live service logs, nothing changed)

- Litestream replicates the live database to `s3://oprun-ai-backup-…-ap-southeast-2/oprun-ai/db` every 5 s
  (log 22 Nov 19:00 UTC), uploaded files are copied to S3, and a daily snapshot is saved
  (23 Nov 17:00 UTC: 2,173 KB in 2.7 s).

## Still to do before release (needs the owner, about 5 minutes)

The drill against the real S3 backup needs the backup keys, which only the live service has. In Render → live
service → Shell, run (read-only towards S3; it never touches the live database file):

    npm run backup:restore-drill -- --compare /var/data/super-pro.sqlite

and paste the last lines (they show the time taken and whether counts match). If the database path differs, use
the value of `DATABASE_PATH` from the service's Environment page.
