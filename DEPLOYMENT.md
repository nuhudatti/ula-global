# IBBUL ULA — Production Deployment Guide

Use this document end-to-end to take ULA from your laptop to a **live, secure, backed-up** production site that can run for years.

**Stack today:** React (Vite) + Express API + Prisma + SQLite + local disk or Cloudinary for files.

**Recommended production shape:** One Linux VPS (or managed Node host) → Nginx (HTTPS) → Node (`npm start`) → SQLite + daily backups + Cloudinary for uploads.

---

## Quick go-live checklist

Copy this list. Do not skip **P0** items.

| # | Item | Priority |
|---|------|----------|
| 1 | Strong `JWT_SECRET` + `PLATFORM_JWT_SECRET` (64+ chars each; `npm run jwt:generate`) | **P0** |
| 2 | `NODE_ENV=production` | **P0** |
| 3 | HTTPS on public domain (Let’s Encrypt) | **P0** |
| 4 | `CLIENT_ORIGIN` + `APP_PUBLIC_URL` + `PUBLIC_BASE_URL` set to real URLs | **P0** |
| 5 | Cloudinary configured — **required** (see [CLOUDINARY.md](./CLOUDINARY.md)) | **P0** |
| 6 | Real SMTP for invites / password emails | **P0** |
| 7 | Database file backed up daily (automated) | **P0** |
| 8 | `uploads/` backed up if any local files remain | **P0** |
| 9 | Firewall: only 22, 80, 443 open | **P0** |
| 10 | Process manager (PM2 or systemd) — app restarts on crash/reboot | **P0** |
| 11 | Health check monitored (`GET /api/health`) | **P1** |
| 12 | Remove demo seed accounts or change passwords | **P1** |
| 13 | Off-server backup copy (S3, Google Drive, second server) | **P1** |
| 14 | Staging environment tested first | **P1** |
| 15 | PostgreSQL migration plan (when traffic grows) | **P2** |

---

## Milestones (recommended order)

### Milestone 0 — Decide hosting (1 day)

**Pick one:**

| Option | Best for | Notes |
|--------|----------|-------|
| **VPS** (DigitalOcean, Hetzner, AWS EC2, university server) | Full control, years of scale | Follow this guide exactly |
| **Railway / Render** | Fast first deploy | Set env vars in dashboard; attach persistent volume for SQLite + uploads |
| **University IT managed VM** | Official campus hosting | Give IT this doc + env list below |

**Minimum server (launch):** 2 vCPU, 2 GB RAM, 40 GB SSD  
**Comfortable (2–3 years):** 4 vCPU, 4–8 GB RAM, 80+ GB SSD

**Domain example:** `ula.ibbul.edu.ng` → DNS A record → server IP

---

### Milestone 1 — Security baseline (before any public URL)

#### P0 — Must have before students use it

1. **Secrets**
   - Generate JWT secrets (on server or locally):
     ```bash
     npm run jwt:generate
     ```
     Copy `JWT_SECRET` and `PLATFORM_JWT_SECRET` into production `.env` (must differ; each ≥ 64 characters).
   - Never commit `.env` to Git.
   - Store production secrets in the host’s secret manager or a password vault only IT can access.

2. **Environment**
   ```env
   NODE_ENV=production
   JWT_SECRET=<64-char-random-string>
   PLATFORM_JWT_SECRET=<separate-64-char-random-string>
   PORT=4000
   ```

3. **URLs (all three must match your live domain)**
   ```env
   CLIENT_ORIGIN=https://ula.ibbul.edu.ng
   APP_PUBLIC_URL=https://ula.ibbul.edu.ng
   PUBLIC_BASE_URL=https://ula.ibbul.edu.ng
   ```
   - `CLIENT_ORIGIN` — CORS (browser API calls)
   - `APP_PUBLIC_URL` — links inside emails (activation, reset)
   - `PUBLIC_BASE_URL` — file URLs when using local disk storage

4. **HTTPS only**
   - Terminate SSL at Nginx (see [Deploy steps](#deploy-steps-vps--nginx--pm2)).
   - No plain HTTP except redirect → HTTPS.

5. **File storage — Cloudinary (mandatory)**
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   CLOUDINARY_FOLDER=ula_files
   ```
   ULA is **Cloudinary-only** — no local `uploads/` folder. Full setup: **[CLOUDINARY.md](./CLOUDINARY.md)**. Production server **will not start** without Cloudinary env vars.

6. **Email — real SMTP**
   ```env
   SMTP_HOST=smtp.your-provider.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=...
   SMTP_PASS=...
   SMTP_FROM="IBBUL ULA <noreply@ibbul.edu.ng>"
   ```
   If SMTP is empty, emails go to `data/email-outbox/` on the server — **not acceptable in production**.

7. **Demo data**
   - Do **not** run `npm run db:seed` on production unless you intend demo accounts.
   - If you seeded staging, change every demo password before go-live.

#### P1 — Do within first 2 weeks live

- Rate limiting on `/api/auth/login` (nginx `limit_req` or middleware)
- Fail2ban or cloud WAF on SSH and HTTP
- Separate Linux user for the app (not root)
- Log rotation (`/var/log/ula/` or PM2 logs)
- Uptime monitor on `https://your-domain/api/health`

#### P2 — Scale path (6–18 months)

- Move database from SQLite → **PostgreSQL** (Prisma supports both; plan a maintenance window)
- Redis for session/rate-limit (optional)
- CDN in front of Cloudinary assets (Cloudinary includes CDN)
- CI pipeline: build + smoke test on every release

---

### Milestone 2 — Staging deploy (test before production)

1. Clone repo on a **staging** server or use a subdomain: `staging.ula.ibbul.edu.ng`
2. Use a **separate** `.env` and **separate** database file
3. Run full [Deploy steps](#deploy-steps-vps--nginx--pm2)
4. Test manually:

| Flow | Pass? |
|------|-------|
| Student register + login (matric) | ☐ |
| Browse + download material | ☐ |
| Lecturer publish material | ☐ |
| Lecturer create assignment + student submit | ☐ |
| Assignment question download + “my copy” download | ☐ |
| Contributor allow + student suggest | ☐ |
| Email invite / activation (real inbox) | ☐ |
| HTTPS — no mixed-content warnings | ☐ |

Only promote to production when staging passes.

---

### Milestone 3 — Backup & recovery (non-negotiable)

ULA stores **three things** you can lose:

| Asset | Location | Backup method |
|-------|----------|---------------|
| Database | `prisma/prod.db` (you choose path via `DATABASE_URL`) | Daily copy + off-server |
| Uploads (if local) | `uploads/` | Daily rsync / tarball |
| Cloudinary | Cloudinary dashboard | Enable backup addon / export inventory quarterly |
| Config | `.env` (encrypted vault) | Password manager / IT vault |

#### SQLite backup script (run daily via cron)

Create `/opt/ula/scripts/backup.sh`:

```bash
#!/bin/bash
set -euo pipefail
APP_DIR=/var/www/ibbul-ula
BACKUP_ROOT=/var/backups/ula
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_ROOT/$STAMP"

# Database (adjust path to match your DATABASE_URL)
cp "$APP_DIR/prisma/prod.db" "$BACKUP_ROOT/$STAMP/prod.db"

# Local uploads (skip if 100% Cloudinary)
if [ -d "$APP_DIR/uploads" ]; then
  tar -czf "$BACKUP_ROOT/$STAMP/uploads.tar.gz" -C "$APP_DIR" uploads
fi

# Keep last 14 days
find "$BACKUP_ROOT" -maxdepth 1 -type d -mtime +14 -exec rm -rf {} \;

# Optional: copy to off-server (uncomment and configure)
# rclone copy "$BACKUP_ROOT/$STAMP" remote:ibbul-ula-backups/
```

```bash
chmod +x /opt/ula/scripts/backup.sh
sudo crontab -e
# Daily at 2:15 AM
15 2 * * * /opt/ula/scripts/backup.sh >> /var/log/ula/backup.log 2>&1
```

#### Restore drill (do once before go-live)

1. Stop app: `pm2 stop ula`
2. Restore `prod.db` from backup into `prisma/`
3. Restore `uploads/` if needed
4. Start app: `pm2 start ula`
5. Verify login + one download

**Recovery time target:** under 30 minutes with practiced restore.

---

### Milestone 4 — Production go-live

Follow [Deploy steps](#deploy-steps-vps--nginx--pm2), then [Post-launch verification](#post-launch-verification).

---

### Milestone 5 — Stay alive for years

| Cadence | Action |
|---------|--------|
| Daily | Automated backup + health check alert |
| Weekly | Review disk space (`df -h`), PM2 status, error logs |
| Monthly | `npm audit`, OS security patches, restore test on staging |
| Each release | `git pull` → `npm ci` → `npm run build` → `npx prisma db push` → `pm2 restart ula` |
| Yearly | TLS cert renewal (auto with certbot), capacity review, PostgreSQL decision |

---

## Environment variables (complete reference)

Copy `.env.example` → `.env` on the server. Production values:

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `NODE_ENV` | **Yes** | `production` | Serves SPA from `web/dist`, disables dev redirects |
| `DATABASE_URL` | **Yes** | `file:./prod.db` | SQLite path relative to `prisma/` |
| `JWT_SECRET` | **Yes** | ≥64 char random (institution users) | Validated on boot; weak values rejected in production |
| `PLATFORM_JWT_SECRET` | **Yes** | ≥64 char random (operators) | Must differ from `JWT_SECRET` |
| `PORT` | Yes | `4000` | Node listens here (Nginx proxies to it) |
| `CLIENT_ORIGIN` | **Yes** | `https://ula.ibbul.edu.ng` | CORS |
| `APP_PUBLIC_URL` | **Yes** | `https://ula.ibbul.edu.ng` | Email links |
| `PUBLIC_BASE_URL` | **Yes** | `https://ula.ibbul.edu.ng` | Local file URLs |
| `CLOUDINARY_*` | **Strongly yes** | from Cloudinary console | Durable file storage |
| `SMTP_*` | **Yes** | campus or SendGrid etc. | Real email delivery |
| `DEV_WEB_ORIGIN` | No | — | Dev only |

**Production `.env` template:**

```env
NODE_ENV=production
DATABASE_URL="file:./prod.db"
JWT_SECRET=REPLACE_WITH_64_CHAR_RANDOM_STRING
PLATFORM_JWT_SECRET=REPLACE_WITH_SEPARATE_64_CHAR_RANDOM_STRING

PORT=4000
CLIENT_ORIGIN=https://ula.ibbul.edu.ng
APP_PUBLIC_URL=https://ula.ibbul.edu.ng
PUBLIC_BASE_URL=https://ula.ibbul.edu.ng

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=ibbul_ula

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="IBBUL ULA <noreply@ibbul.edu.ng>"
```

---

## Deploy steps (VPS + Nginx + PM2)

Assumes **Ubuntu 22.04+**. Replace domain and paths as needed.

### 1. Server prep

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx git curl build-essential

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo npm install -g pm2
sudo mkdir -p /var/www/ibbul-ula /var/log/ula /var/backups/ula
sudo useradd -r -s /bin/false ula || true
```

### 2. Deploy application code

```bash
cd /var/www/ibbul-ula
sudo git clone <YOUR_REPO_URL> .
# Or upload release zip — ensure node_modules is NOT copied; install on server.

sudo chown -R $USER:ula /var/www/ibbul-ula
npm ci
```

### 3. Configure environment

```bash
cp .env.example .env
nano .env   # fill production values from Milestone 1
```

### 4. Database

```bash
# Creates/updates schema on prod.db
npx prisma db push

# OPTIONAL first-time only: create admin accounts via seed (then change passwords!)
# npm run db:seed
```

### 5. Build frontend + generate Prisma client

```bash
npm run build
```

This runs `vite build` → `web/dist` and `prisma generate`.  
In production, Express serves `web/dist` and API on the **same port** (`PORT`).

### 6. Start with PM2

```bash
cd /var/www/ibbul-ula
pm2 start npm --name ula -- start
pm2 save
pm2 startup   # run the command it prints (sudo ...)
```

Verify locally on server:

```bash
curl http://127.0.0.1:4000/api/health
```

### 7. Nginx reverse proxy + HTTPS (enterprise)

**Full guide:** **[deploy/HTTPS.md](./deploy/HTTPS.md)** — TLS 1.2/1.3, HSTS, CSP, rate limits, auto-renewal.

Quick install from repo (replace domain):

```bash
chmod +x deploy/scripts/*.sh
sudo deploy/scripts/install-nginx.sh ula.ibbul.edu.ng
sudo deploy/scripts/ssl-setup.sh ula.ibbul.edu.ng admin@ibbul.edu.ng
```

Set in `.env` before starting Node:

```env
HOST=127.0.0.1
CLIENT_ORIGIN=https://ula.ibbul.edu.ng
APP_PUBLIC_URL=https://ula.ibbul.edu.ng
PUBLIC_BASE_URL=https://ula.ibbul.edu.ng
```

Start with PM2 (localhost only — Nginx handles TLS):

```bash
pm2 start deploy/pm2/ecosystem.config.cjs
```

Verify:

```bash
./deploy/scripts/verify-https.sh https://ula.ibbul.edu.ng
BASE_URL=https://ula.ibbul.edu.ng npm run verify:https
```

### 8. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Post-launch verification

Open in browser:

1. `https://ula.ibbul.edu.ng` — catalogue loads
2. `https://ula.ibbul.edu.ng/api/health` — `{"ok":true,...}`
3. Register a **real** test student → login → browse
4. Lecturer login → publish one PDF → appears in catalogue
5. Download works (file saves, not error JSON)
6. Create assignment → student submits → both downloads work
7. Check email arrives (not outbox folder)

**PM2 on server:**

```bash
pm2 status
pm2 logs ula --lines 50
```

---

## Release process (every update)

```bash
cd /var/www/ibbul-ula
git pull origin main
npm ci
npm run build
npx prisma db push
pm2 restart ula
curl -s https://ula.ibbul.edu.ng/api/health
```

**Before restart in production:** run backup script manually.

---

## Rollback

1. `pm2 stop ula`
2. `git checkout <previous-tag-or-commit>`
3. `npm ci && npm run build`
4. Restore `prisma/prod.db` from backup if schema/data migration failed
5. `pm2 start ula`

---

## Security summary (what protects what)

| Threat | Mitigation in this guide |
|--------|---------------------------|
| Stolen JWT | Long `JWT_SECRET`, HTTPS only, short-term: add refresh/expiry policy later |
| Brute-force login | Nginx rate limit + Fail2ban (P1) |
| Data loss | Daily SQLite + uploads backup, off-server copy |
| Disk full | Monitor `df`, Cloudinary for files |
| XSS / injection | React escapes by default; keep dependencies updated |
| CORS abuse | `CLIENT_ORIGIN` locked to your domain |
| Secrets in Git | `.env` only on server, never in repo |

---

## Scaling notes (SQLite → years of use)

**SQLite is fine when:**

- Single Node server
- Moderate concurrent users (hundreds, low thousands)
- One write at a time (Prisma serializes writes)

**Move to PostgreSQL when:**

- Multiple app instances behind a load balancer
- Heavy concurrent submissions/uploads
- You need point-in-time recovery / replication

**Migration outline (future):**

1. Change `datasource` in `prisma/schema.prisma` to `postgresql`
2. Set `DATABASE_URL=postgresql://...`
3. `npx prisma db push` or proper migrations
4. Export/import data from SQLite (one-time script or Prisma tooling)

---

## Optional: Railway / Render (simpler host)

1. Connect GitHub repo
2. Build command: `npm ci && npm run build`
3. Start command: `npm start`
4. Set all env vars from [Environment variables](#environment-variables-complete-reference)
5. Attach **persistent volume** mounted at:
   - `/app/prisma` (for `prod.db`)
   - `/app/uploads` (if not using Cloudinary)
6. Add custom domain + HTTPS (provider handles SSL)

---

## Support contacts (fill in before go-live)

| Role | Name | Contact |
|------|------|---------|
| Technical lead | | |
| Server / IT | | |
| DNS / domain | | |
| Email (SMTP) | | |
| Cloudinary account | | |

---

## One-page “see it live” summary

```text
1. Buy/prepare server + domain
2. Set .env (JWT, URLs, Cloudinary, SMTP) — Milestone 1
3. npm ci → prisma db push → npm run build → pm2 start
4. Nginx + certbot HTTPS
5. Cron backup daily
6. Test all flows on staging → then production URL
7. Monitor /api/health — you are live
```

**You are production-ready when:** HTTPS works, backups run automatically, emails deliver, files persist on Cloudinary, and staging tests are green.

---

*Document version: 1.0 — matches IBBUL ULA stack (`npm start`, SQLite, Express serves `web/dist`). Update this file when you add PostgreSQL, Docker, or CI.*
