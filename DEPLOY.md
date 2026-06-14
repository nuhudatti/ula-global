# ULA — Deploy to GitHub + Render

Step-by-step guide to push the platform live on [Render](https://render.com) (or a similar Node + PostgreSQL host).

---

## 1. Prepare locally

```bash
# Generate production JWT secrets (save output — never commit)
npm run jwt:generate

# Build frontend + Prisma client
npm run build
```

Ensure `.env` is **not** committed (already in `.gitignore`).

---

## 2. Push to GitHub

```bash
cd "path/to/ibbul-ula"
git init
git add .
git commit -m "ULA platform — production ready"
git branch -M main
git remote add origin https://github.com/YOUR_USER/ibbul-ula.git
git push -u origin main
```

**Do not push:** `.env`, `prisma/dev.db`, `prisma/sqlite-export.json`, `node_modules/`.

---

## 3. Create PostgreSQL on Render

1. Render Dashboard → **New** → **PostgreSQL**
2. Name: `ula-db`, region near your users
3. Copy the **Internal Database URL** (starts with `postgresql://`)

---

## 4. Create Web Service on Render

1. **New** → **Web Service** → connect your GitHub repo
2. Settings:

| Field | Value |
|-------|--------|
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |

`npm start` runs: validate config → `prisma migrate deploy` → API server.

---

## 5. Environment variables (Render → Environment)

Copy from `.env.production.example` and set every value:

### Required

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=10000

DATABASE_URL=<Render PostgreSQL Internal URL>

JWT_SECRET=<64+ char random from npm run jwt:generate>
PLATFORM_JWT_SECRET=<different 64+ char random>

CLIENT_ORIGIN=https://YOUR-SERVICE.onrender.com
APP_PUBLIC_URL=https://YOUR-SERVICE.onrender.com
PUBLIC_BASE_URL=https://YOUR-SERVICE.onrender.com

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=ula_files

SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<SendGrid API key>
SMTP_FROM=ULA Platform <noreply@yourdomain.com>
```

### Do NOT set in production

```env
SEED_DEMO_ACCOUNTS=false   # or omit — never seed demo passwords in prod
```

---

## 6. First deploy

1. Click **Deploy** — wait for build + migrate
2. Open `https://YOUR-SERVICE.onrender.com/api/health` — should return `{ "ok": true }`
3. Open `https://YOUR-SERVICE.onrender.com/platform/setup`

### First-time super admin (one-time only)

1. Fill in **full name**, **email**, **strong password** (12+ chars, mixed case, number, symbol)
2. Submit — account is created with bcrypt hash
3. Audit log records **"First super admin created"**
4. Setup page is **permanently locked** — all future visits redirect to `/platform/login`
5. Redeploys/restarts **do not** re-trigger setup if a super admin exists

---

## 7. Custom domain (optional)

1. Render → your service → **Settings** → **Custom Domains**
2. Add `ula.yourdomain.com`
3. Update env vars to HTTPS custom domain:

```env
CLIENT_ORIGIN=https://ula.yourdomain.com
APP_PUBLIC_URL=https://ula.yourdomain.com
PUBLIC_BASE_URL=https://ula.yourdomain.com
```

4. Redeploy

---

## 8. After go-live

| Task | How |
|------|-----|
| Provision first university | Platform → Institutions → create tenant + admin invite |
| Backups | Platform → Backup (requires `pg_dump` on host — use VPS for full backup cron, or Neon/Render managed backups) |
| Rotate secrets | Update JWT vars in Render → Manual Deploy |
| Forgot platform password | `/platform/forgot-password` (SMTP required) |

---

## 9. Render blueprint (optional)

A `render.yaml` is included in the repo root. Deploy via **New → Blueprint** and connect the repo.

---

## 10. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Boot blocked with red error box | Fix JWT secrets, HTTPS URLs, `DATABASE_URL`, Cloudinary in Render env |
| `/platform/setup` redirects to login | Super admin already exists — use login or forgot-password |
| `/platform/login` redirects to setup | Empty DB — complete setup first |
| Slow dashboard | Fixed in latest build (SQL aggregates + caching); redeploy |
| Migration failed | Check `DATABASE_URL` and Render Postgres is running |

---

## Security checklist

- [ ] Strong unique `JWT_SECRET` and `PLATFORM_JWT_SECRET`
- [ ] All public URLs use `https://`
- [ ] No `SEED_DEMO_ACCOUNTS` in production
- [ ] Cloudinary + SMTP configured
- [ ] First super admin created via `/platform/setup` (not seed)
- [ ] GitHub repo is private if credentials docs are included

---

## Alternative hosts

Same flow works on **Railway**, **Fly.io**, or a **VPS** with PM2:

```bash
# VPS
cp .env.production.example .env   # fill values
npm run build
pm2 start deploy/pm2/ecosystem.config.cjs
```

See `POSTGRESQL_MIGRATION.md` and `deploy/pm2/ecosystem.config.cjs` for VPS details.
