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

    npm run backup:restore-drill -- --compare /var/data/oprun-ai.sqlite

and paste the last lines (they show the time taken and whether counts match). If the database path differs, use
the value of `DATABASE_PATH` from the service's Environment page.

## Production drill (25 Nov 2026)

Run by the owner in the Render Shell of the live service "Oprun AI" (`srv-dbuq98ojo6nc73aro66g`):

    npm run backup:restore-drill -- --compare /var/data/oprun-ai.sqlite

Result reported by the owner: **RESTORE DRILL PASSED** (the latest Litestream copy in the S3 bucket, path `oprun-ai/db`,
restored into a temporary file, passed SQLite's integrity check and the audit-chain check, and its row counts matched
the live database within the last few seconds of writes). The detailed lines (table count, restore time, audit rows)
were not shared, so they are not recorded here. A first attempt with the default path `/var/data/super-pro.sqlite`
could not open that file, because the live database is `/var/data/oprun-ai.sqlite` (E-058); nothing was changed.
