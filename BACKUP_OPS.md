# ULA Backup & Recovery — Operations Guide

Platform operators manage backups from **Platform → Backup & recovery**.

## Architecture

| Layer | Role |
|-------|------|
| **SQLite** | Live database (`DATABASE_URL`, e.g. `file:./dev.db`) |
| **PostgreSQL** | Live database (`DATABASE_URL`, e.g. `postgresql://ula_app@127.0.0.1:5432/ula`) |
| **Integrity check** | SQLite: gzip + header + `PRAGMA integrity_check`. PostgreSQL: gzip + `pg_dump` header |
| **Cloudinary** | Primary off-app storage (`ula_backups/` authenticated raw files) |
| **Off-site dir** | Optional local copy outside repo (`BACKUP_OFFSITE_DIR` or dev `../ula-backups`) |
| **rclone** | Optional second destination (`BACKUP_RCLONE_REMOTE`) |
| **Audit** | `SystemAuditLog` — `BACKUP_*`, `RESTORE_*`, `RETENTION_*` with platform `actorId` |

PostgreSQL: **automated** via `pg_dump` when `DATABASE_URL` uses `postgresql://`. Requires `pg_dump` and `psql` on server PATH. See [POSTGRESQL_MIGRATION.md](./POSTGRESQL_MIGRATION.md).

## Environment variables

```env
BACKUP_CRON_ENABLED=true
BACKUP_CRON_SCHEDULE="0 2 * * *"
BACKUP_VALIDATE_ENABLED=true
BACKUP_VALIDATE_CRON="0 3 * * 0"

BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=4
BACKUP_RETENTION_MONTHLY=12

# Production — outside application directory
BACKUP_OFFSITE_DIR=/var/backups/ula-offsite
BACKUP_RCLONE_REMOTE=gdrive:ula-backups
```

Development: if `BACKUP_OFFSITE_DIR` is unset, copies go to `../ula-backups` (sibling of project folder).

## Daily automation

- **02:00** (configurable): compress DB → validate → upload → off-site copy → retention
- **Sunday 03:00** (configurable): validate latest completed backup (restore drill)

## Manual operations (Platform UI)

1. **Run backup now** — immediate snapshot; integrity verified before `COMPLETED`
2. **Apply retention** — grandfather–father–son policy (daily / weekly / monthly keeps)
3. **Validate** — download from Cloudinary, decompress, integrity check (no live DB change)
4. **Restore** — replaces live SQLite; creates `.pre-restore-{timestamp}` sibling file; **restart API required**
5. **Delete** — removes Cloudinary asset + registry row (audited)

## Restore testing procedure (staging)

Run before every production go-live and quarterly in production:

1. Note current `totalCompleted` and latest backup timestamp
2. Click **Validate** on the latest backup — must pass
3. On **staging only**: click **Restore** on a backup from known-good state
4. Restart API: `pm2 restart ula` or `npm run dev`
5. Verify:
   - Platform login works
   - Institution browse/login (`/ibbul`)
   - Sample download and assignment flow
6. If restore was wrong, stop API and copy `.pre-restore-*` file back over `dev.db` / `prod.db`

## Production restore (emergency)

```bash
pm2 stop ula
# Prefer UI restore, or manual from off-site:
# gunzip -c /var/backups/ula-offsite/ula-db-*.db.gz > prisma/prod.db
pm2 start ula
curl -s https://your-domain/api/health
```

## Health monitoring

- `GET /api/platform/backup/status` — cron, retention, last backup/failure, audit trail
- `GET /api/health` — `backupCron: true/false`
- Alert if `lastFailed` is newer than `lastBackup`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot read properties of undefined (reading 'id')` | Fixed — platform uses `req.platformUser.id` |
| Backup fails integrity | Check disk space; ensure DB not corrupted (`sqlite3 prisma/dev.db "PRAGMA integrity_check;"`) |
| Cloudinary error | Verify `CLOUDINARY_*` env vars |
| Off-site warnings | Non-fatal — backup still in Cloudinary; fix `BACKUP_OFFSITE_DIR` permissions |
| Restore后 login fails | Restart API — Prisma must reconnect to replaced file |

## Future: PostgreSQL

PostgreSQL backup/restore is implemented. Switch engines via `DATABASE_URL` + `npm run db:use:postgres`. Full migration guide: [POSTGRESQL_MIGRATION.md](./POSTGRESQL_MIGRATION.md).

---

*Related: [DEPLOYMENT.md](./DEPLOYMENT.md) · [PLATFORM_STATUS.md](./PLATFORM_STATUS.md)*
