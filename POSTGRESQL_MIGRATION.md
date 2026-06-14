# ULA — SQLite to PostgreSQL Migration Guide

This guide migrates the ULA backend from SQLite to PostgreSQL **without changing APIs, auth, audit logs, or business logic**. Only the database layer and connection setup change.

---

## What changed in the codebase

| Item | Purpose |
|------|---------|
| `prisma/schema.prisma` | Supports both providers via `npm run db:use:sqlite` / `db:use:postgres` |
| `prisma/schema.sqlite.prisma` | Frozen SQLite schema backup for reference |
| `prisma/migrations/` | PostgreSQL migration (`20250610000000_init_postgresql`) — **no auto-drop** |
| `scripts/db-use-provider.js` | Switch Prisma provider + regenerate client |
| `scripts/migrate-sqlite-to-postgres.js` | Export SQLite → import PostgreSQL with verification |
| `scripts/backup-sqlite-file.js` | Timestamped SQLite file backup before migration |
| `server/services/dbEngine.js` | Engine detection from `DATABASE_URL` |
| `server/services/backupService.js` | PostgreSQL backups via `pg_dump` / restore via `psql` |

### Important: `.env` alone is not enough

Prisma compiles the client for a specific provider. After changing `DATABASE_URL`:

```bash
# For SQLite (file:./dev.db)
npm run db:use:sqlite

# For PostgreSQL (postgresql://...)
npm run db:use:postgres
```

Then restart the API.

---

## Pre-migration checklist

- [ ] Stop accepting new production traffic (maintenance window) or run on staging first
- [ ] Confirm Cloudinary, JWT, and SMTP env vars are set
- [ ] Run a manual platform backup (Platform → Backup) while still on SQLite
- [ ] Copy `prisma/dev.db` (or `prod.db`) to a safe off-server location

---

## Step 1 — Install PostgreSQL

### Ubuntu / Debian (Linux server)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Client tools for backup/restore (pg_dump, psql)
sudo apt install -y postgresql-client
```

### Create database and user (secure)

```bash
sudo -u postgres psql <<'EOF'
CREATE USER ula_app WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE ula OWNER ula_app;
GRANT ALL PRIVILEGES ON DATABASE ula TO ula_app;
\c ula
GRANT ALL ON SCHEMA public TO ula_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ula_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ula_app;
EOF
```

Restrict PostgreSQL to localhost in production (`/etc/postgresql/*/main/pg_hba.conf`):

```
host    ula    ula_app    127.0.0.1/32    scram-sha-256
```

Reload: `sudo systemctl reload postgresql`

---

## Step 2 — Backup SQLite (mandatory)

On your dev machine or server **before** migration:

```bash
# Timestamped copy: prisma/dev.db.pre-postgres-YYYY-MM-DD...
npm run db:backup:sqlite-file

# Optional: manual copy
cp prisma/dev.db prisma/dev.db.manual-backup
```

**Do not delete** the SQLite file until PostgreSQL is verified.

---

## Step 3 — Migrate data (dev or staging)

Set both URLs (source SQLite + target PostgreSQL):

```bash
# Windows PowerShell
$env:SQLITE_DATABASE_URL="file:./dev.db"
$env:POSTGRES_DATABASE_URL="postgresql://ula_app:YOUR_PASSWORD@localhost:5432/ula?schema=public"

# Linux/macOS
export SQLITE_DATABASE_URL="file:./dev.db"
export POSTGRES_DATABASE_URL="postgresql://ula_app:YOUR_PASSWORD@localhost:5432/ula?schema=public"
```

Dry run (export only, no PostgreSQL writes):

```bash
npm run db:migrate:sqlite-to-postgres -- --dry-run
```

Full migration:

```bash
npm run db:migrate:sqlite-to-postgres
```

The script will:

1. Backup SQLite file (`*.pre-postgres-*`)
2. Export all tables to `prisma/sqlite-export.json`
3. Switch Prisma to PostgreSQL and run `prisma migrate deploy`
4. Import rows in FK-safe order
5. Verify row counts → `prisma/migration-report.json`

---

## Step 4 — Point the app at PostgreSQL

Update `.env` (or production `.env`):

```env
DATABASE_URL="postgresql://ula_app:YOUR_PASSWORD@127.0.0.1:5432/ula?schema=public"
```

```bash
npm run db:use:postgres
npm run db:migrate:deploy   # idempotent on production
npm run build               # regenerate client in CI/build
npm start                   # or pm2 restart ula
```

Verify health:

```bash
curl -s http://localhost:4000/api/health
```

---

## Step 5 — Testing checklist (run after migration)

| Area | Test |
|------|------|
| **Platform admin** | Login at `/platform/login`, open Overview + Audit log |
| **Institution admin** | Login, `/admin`, faculty management, ARM invites |
| **Lecturer** | Login, upload lecture notes (`/lecturer` → Publish) |
| **Student** | Browse resources, download, register flow |
| **Past questions** | Upload + browse filter by kind `PAST_QUESTIONS` |
| **ARM workspace** | `/resources` publish + institution library |
| **Audit logs** | Platform audit shows recent actions |
| **Backups** | Platform → Run backup now (uses `pg_dump`) |
| **Restore drill** | Validate latest backup (staging only) |
| **Invitations** | Resend institution admin / ARM invite email |

---

## Rollback to SQLite

If PostgreSQL migration fails or you need to revert:

```bash
# 1. Stop API
pm2 stop ula   # or Ctrl+C dev server

# 2. Restore SQLite file
cp prisma/dev.db.pre-postgres-XXXX prisma/dev.db

# 3. Switch .env
DATABASE_URL="file:./dev.db"

# 4. Regenerate SQLite client
npm run db:use:sqlite

# 5. Restart
npm run dev    # or pm2 start ula
```

Your original SQLite data remains in the `.pre-postgres-*` backup and `sqlite-export.json`.

---

## Production deployment (Linux)

### 1. Install PostgreSQL + client tools

(See Step 1 above.)

### 2. Deploy application

```bash
git pull
npm ci
npm run build
```

### 3. Configure environment

```bash
cp .env.production.example .env
# Edit DATABASE_URL, JWT_SECRET, PLATFORM_JWT_SECRET, CLOUDINARY_*, SMTP_*, HTTPS URLs
```

### 4. Run migrations (safe — never drops data)

```bash
npm run db:use:postgres
npx prisma migrate deploy
```

### 5. Migrate data from existing SQLite server

On the **old** server, export:

```bash
SQLITE_DATABASE_URL="file:./prod.db" \
POSTGRES_DATABASE_URL="postgresql://ula_app:PASS@NEW_HOST:5432/ula?schema=public" \
npm run db:migrate:sqlite-to-postgres
```

Or copy `prod.db` to the new host and run the same command there.

### 6. Process manager

```bash
pm2 start npm --name ula -- start
pm2 save
```

### 7. Nginx + HTTPS

Follow [DEPLOYMENT.md](./DEPLOYMENT.md) — no changes required for PostgreSQL.

---

## Backup & restore on PostgreSQL

| Action | Engine | Method |
|--------|--------|--------|
| Daily cron | PostgreSQL | `pg_dump` → gzip → Cloudinary |
| Manual backup | Platform UI | Same as above |
| Validate | Both | Decompress + header check |
| Restore | PostgreSQL | `psql -f` (creates pre-restore dump) |
| Restore | SQLite | Replace `.db` file (unchanged) |

Requires `pg_dump` and `psql` on the server PATH.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `P1001: Can't reach database` | Check PostgreSQL running, credentials, `pg_hba.conf` |
| `Provider mismatch` | Run `npm run db:use:postgres` after changing `DATABASE_URL` |
| Migration count mismatch | Check `prisma/migration-report.json`; re-run import after emptying PG tables |
| `pg_dump not found` | `sudo apt install postgresql-client` |
| Login works on SQLite but not PG | Verify `User` rows imported; check `institutionId` FK |
| Backup returns 501 | Install PostgreSQL client tools |

---

## Manual export/import (alternative)

If the automated script cannot run:

```bash
# Export (while on SQLite)
npm run db:use:sqlite
node -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const users = await p.user.findMany();
console.log(JSON.stringify(users));
await p.\$disconnect();
"

# Import (on PostgreSQL) — use scripts/migrate-sqlite-to-postgres.js
# or Prisma Studio / custom seed from prisma/sqlite-export.json
```

---

## Files to keep safe

- `prisma/dev.db` / `prisma/prod.db` — original SQLite
- `prisma/*.pre-postgres-*` — auto backup before migration
- `prisma/sqlite-export.json` — JSON export (gitignored)
- `prisma/migration-report.json` — verification report (gitignored)

---

*Related: [DEPLOYMENT.md](./DEPLOYMENT.md) · [BACKUP_OPS.md](./BACKUP_OPS.md)*
