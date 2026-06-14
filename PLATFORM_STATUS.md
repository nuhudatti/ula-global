# ULA Global Platform — Status, Deployment & Scaling

Last updated: June 2026  
Stack: React (Vite) · Express · Prisma · SQLite · Cloudinary · Nodemailer SMTP

This document summarizes **what is built**, **what must be done before production**, and **recommended SMTP providers** for a multi-university SaaS deployment.

Related docs: [DEPLOYMENT.md](./DEPLOYMENT.md) · [LOGIN_DETAILS.md](./LOGIN_DETAILS.md) · [CLOUDINARY.md](./CLOUDINARY.md)

---

## 1) What is done

### Multi-tenant architecture (ULA Global Platform)

| Area | Status | Notes |
|------|--------|-------|
| Institution model (`slug`, branding, status) | ✅ | `Institution` table with colors, logos, contact fields |
| Path-based tenants | ✅ | `/{slug}` — browse, login, register, admin |
| Institution finder (no default tenant) | ✅ | `/` asks for slug; unknown slugs show **Institution not found** |
| Platform operator layer | ✅ | `/platform/login` → `/platform` (separate JWT scope from institution users) |
| Tenant API isolation | ✅ | `X-Institution-Slug` header + `req.tenant` middleware; downloads/API calls tenant-scoped |
| Scoped data APIs | ✅ | Resources, assignments, discussions, ratings, campus pulse, meta (faculties/depts/courses) |
| Institution admin split | ✅ | `INSTITUTION_ADMIN` role; backup moved to platform-only |
| Tenant provisioning | ✅ | Platform UI: create institution, resend admin credentials, suspend/archive |
| Institution activation email | ✅ | On provision/resend: secure set-password link (reuses reset-token infra; no plaintext password in email) |
| Platform audit log | ✅ | Operator actions recorded |
| Logout tenant isolation | ✅ | Sign-out returns to `/{slug}/login`, not global `/` |

### Centralized email infrastructure

| Area | Status | Notes |
|------|--------|-------|
| Unified email service | ✅ | `server/services/email/` — transport, templates, flows, branding |
| Institution forgot/reset password | ✅ | `POST /api/auth/forgot-password` + `/{slug}/forgot-password` |
| **Platform forgot/reset password** | ✅ | Reuses same lifecycle pattern — `POST /api/platform/auth/forgot-password`, `/platform/forgot-password` |
| Institution activation on provision | ✅ | `sendInstitutionActivationEmail` — branded CTA link to set admin password |
| Staff invitations (link-only) | ✅ | Faculty admin, HOD, lecturer — `/accept-invitation?token=…` (no OTP) |
| Per-institution email branding | ✅ | Logo, colors, institution name in transactional mail via `emailBranding.js` |
| Central delivery (not per-user SMTP) | ✅ | Single ULA SMTP/SendGrid; institutions customize branding only |
| **Platform Settings → Email config** | ✅ | SMTP credentials, sender, delivery settings, template subjects, verify + test send |
| DB-backed email settings | ✅ | `PlatformEmailSettings` singleton; empty fields fall back to `.env` |
| Dev email outbox | ✅ | `data/email-outbox/` when SMTP unavailable in development |
| SendGrid API + SMTP | ✅ | API key path preferred; SMTP fallback; mirror-to-outbox in dev |

### Production HTTPS / TLS (deploy-ready)

| Area | Status | Notes |
|------|--------|-------|
| Nginx reverse proxy config | ✅ | `deploy/nginx/ula.conf.template` — HTTP→HTTPS, proxy, rate limits |
| Let's Encrypt automation | ✅ | `deploy/scripts/ssl-setup.sh` + certbot renewal hook |
| TLS 1.2 / 1.3 + modern ciphers | ✅ | `deploy/nginx/snippets/ssl-params.conf` |
| HSTS + security headers + CSP | ✅ | Nginx snippets + Express `helmet` |
| HTTPS-only public URLs | ✅ | `server/services/publicUrl.js` — validates env on production boot |
| Email/activation/reset links | ✅ | `enforceHttps()` on all `getAppPublicUrl()` output |
| Node binds localhost only | ✅ | `HOST=127.0.0.1` in production / PM2 ecosystem |
| Health check with TLS status | ✅ | `GET /api/health` → `tls`, `https` blocks |
| Deployment verification | ✅ | `deploy/scripts/verify-https.sh`, `npm run verify:https` |

### JWT secret management

| Area | Status | Notes |
|------|--------|-------|
| Cryptographic secret generation | ✅ | `npm run jwt:generate` — 64-char base64url secrets |
| Startup validation | ✅ | `server/services/jwtSecrets.js` — production hard-fail on weak/missing |
| Institution JWT (`JWT_SECRET`) | ✅ | Tenant users — sign/verify via `getInstitutionJwtSecret()` |
| Platform JWT (`PLATFORM_JWT_SECRET`) | ✅ | Operators — separate secret; dev falls back to `JWT_SECRET` |
| Health check JWT status | ✅ | `/api/health` → `jwt` block (lengths only, never secrets) |
| Secrets in env only | ✅ | Never stored in source code or database |

### Routing model

```
/platform/login           → Platform operators (SaaS ops)
/platform/forgot-password → Platform operator password recovery
/platform/reset-password  → Platform operator set new password
/platform                 → Overview, institutions, backup, monitoring, settings, audit

/                         → Institution finder (enter university slug)
/{slug}                   → Tenant browse (materials, assignments, pulse)
/{slug}/login             → Tenant sign-in
/{slug}/forgot-password   → Institution password recovery
/{slug}/reset-password    → Institution set new password
/{slug}/register          → Student registration (tenant-scoped departments)
/{slug}/accept-invitation → Staff invite acceptance (link-only)
/{slug}/admin             → Institution administrator workspace

/lecturer, /department, /faculty, /admin  → Legacy role routes (still work for signed-in users)
/ibbul                    → IBBUL workspace (first seeded tenant — not a global default)
```

### Backend modules (tenant-aware)

- `server/middleware/tenant.js` — resolve tenant from header; **no default institution** on scoped routes
- `server/services/tenantService.js` — CRUD, provision, activation email, resend credentials
- `server/services/tenantScope.js` — Prisma `where` helpers per `institutionId`
- `server/services/authLifecycle.js` — password reset, institution activation, platform reset tokens
- `server/services/platformEmailSettings.js` — centralized SMTP config (DB + env merge)
- `server/middleware/auth.js` — JWT scoped to user institution
- `server/routes/platform.js` + `platformAuth.js` — operator APIs, email settings, verify/test
- `server/services/email/` — invites, activation, password reset, notifications, test mail
- `server/services/lecturerInvites.js` + `facultyAdminInvites.js` — link-only invitation flows

### Frontend modules

- `TenantShell` + `TenantContext` — validate slug before rendering tenant UI
- `TenantRouteSync` — keeps API header aligned with URL
- `InstitutionFinderPage` — neutral entry (no IBBUL fallback)
- `InstitutionNotFoundPage` — invalid slug handling
- `BrandingContext` — loads `/api/meta/tenant/{slug}` per URL
- `BrowsePage` — tenant-scoped assignments; student submissions visible on browse
- `ForgotPasswordPage` / `ResetPasswordPage` — institution recovery (tenant-prefixed routes)
- `PlatformForgotPasswordPage` / `PlatformResetPasswordPage` — platform recovery
- `AcceptInvitationPage` — unified staff invite acceptance
- `PlatformSettings` — interactive email configuration UI (SMTP, test, verify)
- Platform UI: tenant management, monitoring, provision result modal

### Core product (per institution)

- Student browse, search, download, rate materials
- Lecturer publish; lecturers see **only their** assignments
- Students see institution-wide open assignments; submit requires login
- HOD / department workspace (leader assign, lecturer invites)
- Faculty admin workspace (departments only — not direct lecturer management)
- Institution branding (logo, banner, colors)
- Academic discussions, campus pulse
- Auth lifecycle: register, login (email or matric), forgot/reset password, link-only invites, forced password change
- Cloudinary file storage (production-required)
- Automated backup service (platform operator UI) — integrity-checked, audited, off-site copy; see [BACKUP_OPS.md](./BACKUP_OPS.md)

### Demo / seed data

- Platform: `platform@ula.global` / `PlatformDemo123!`
- IBBUL institution: `admin@demo.ibbul.edu` / `InstAdmin123!` + student/lecturer/HOD/faculty demos  
- Run: `npm run db:seed`

---

## 2) What must be done before deployment (P0)

Do **not** go live without these.

### Infrastructure & secrets

| # | Task | Why |
|---|------|-----|
| 1 | **Production JWT secrets** — `JWT_SECRET` + `PLATFORM_JWT_SECRET` (64+ chars each); `npm run jwt:generate` | Validated on boot — server refuses weak/missing secrets |
| 2 | **`NODE_ENV=production`** | Enables production email enforcement, Cloudinary requirement |
| 3 | **HTTPS** on real domain (Let’s Encrypt + Nginx) | Use `deploy/HTTPS.md` + `deploy/scripts/ssl-setup.sh` |
| 4 | **Set all public URLs** — `CLIENT_ORIGIN`, `APP_PUBLIC_URL`, `PUBLIC_BASE_URL` (or Platform Settings → Public app URL) | CORS, activation/reset/invite links must hit live domain |
| 5 | **Cloudinary** — all `CLOUDINARY_*` vars set | Server refuses to start without it in production |
| 6 | **Real SMTP configured & verified** | Platform Settings → Verify SMTP + Send test; or `.env` + `npm run email:verify` |
| 7 | **Email DNS** — SPF, DKIM, DMARC on sending domain | Inbox placement for activation, reset, invites (see Section 4) |
| 8 | **Remove or rotate demo accounts** | Do not run `db:seed` on production; change `platform@ula.global` password |
| 9 | **Daily automated backups** + off-server copy | SQLite + Cloudinary inventory |
| 10 | **Process manager** (PM2 or systemd) | Auto-restart on crash/reboot |
| 11 | **Firewall** — only 22, 80, 443 | Reduce attack surface |
| 12 | **Staging environment** — full test pass before prod | See checklist below + [DEPLOYMENT.md](./DEPLOYMENT.md) |

### Email & auth (P0 — new flows)

| # | Task | Why |
|---|------|-----|
| 13 | **Confirm Platform Settings email** saved on staging (or `.env` fallback documented) | Central delivery for all tenants |
| 14 | **Test institution activation email** — provision tenant → admin receives link → sets password | Replaces plaintext temp password in email |
| 15 | **Test institution forgot password** — `/{slug}/forgot-password` → real inbox | Existing flow; must not regress |
| 16 | **Test platform forgot password** — `/platform/forgot-password` → real inbox | New platform operator recovery |
| 17 | **Test staff invitation** — faculty admin / HOD / lecturer link → `/accept-invitation` | Link-only; no OTP dependency |
| 18 | **Mark test emails “Not spam”** in Gmail/Outlook | Improves deliverability for all future mail |

### Staging test checklist (minimum)

| Flow | Pass? |
|------|-------|
| Institution finder → `/ibbul` loads IBBUL only | ☐ |
| Unknown slug → “Institution not found” (not IBBUL) | ☐ |
| Sign out from `/ibbul` → stays on `/ibbul/login` | ☐ |
| Platform login → **Platform settings** → email verify + test send | ☐ |
| Platform login → provision new institution → **activation email** (not plaintext password) | ☐ |
| Activation link opens `/{slug}/reset-password` → admin sets password → can sign in | ☐ |
| New institution browse/login/register isolated from IBBUL | ☐ |
| Student register + login (matric) per tenant | ☐ |
| Lecturer publish + student download (tenant header present) | ☐ |
| Lecturer sees only own assignments; student sees institution assignments | ☐ |
| Assignment create + student submit | ☐ |
| Institution forgot password (`/ibbul/forgot-password`) → real inbox | ☐ |
| Platform forgot password (`/platform/forgot-password`) → real inbox | ☐ |
| Staff invite link → accept → account active | ☐ |
| HTTPS — no mixed-content warnings | ☐ |
| `GET /api/health` monitored (`email.configured: true`) | ☐ |

---

## 3) What to do before scaling (P1 → P2)

### P1 — First 3–6 months live (1–20 institutions)

| Task | Priority | Notes |
|------|----------|-------|
| JWT secret rotation runbook | P1 | Document rotation procedure without invalidating all sessions at once |
| **Encrypt SMTP credentials at rest** | P1 | `PlatformEmailSettings.smtpPass` stored plain in SQLite; encrypt with app secret |
| **Wire template overrides into senders** | P1 | UI saves subject overrides; `flows.js` should read `getEmailConfig().templates` |
| Rate limiting on all sensitive endpoints | P1 | Login/upload/backup limited; add forgot-password + provision rate limits at Nginx |
| Fix remaining TypeScript errors | P1 | e.g. `IdentitySettingsPanel.tsx` type mismatches |
| Tenant-prefixed role routes | P1 | e.g. `/ibbul/lecturer` instead of global `/lecturer` |
| Full API scoping audit | P1 | Verify every route respects `institutionId` (downloads, assignments, invites) |
| Institution status emails | P1 | Suspend/archive tenant → notify admin via `sendNotificationEmail` |
| Per-tenant branding in Platform Settings preview | P1 | Test-send with selected institution branding |
| Log rotation + structured logging | P1 | PM2 or `/var/log/ula/`; email delivery events already in `emailLog` |
| Uptime + error monitoring | P1 | UptimeRobot, Better Stack, or Sentry on `/api/health` |
| CI pipeline | P1 | `lint` + `build` + `prisma validate` on every push |
| Security headers (Helmet + Nginx) | ✅ Done | See `deploy/nginx/snippets/security-headers.conf` |
| Email bounce / complaint webhooks | P1 | SendGrid event webhook → mark bad addresses, audit log |
| Document operator onboarding | P1 | How to add `PlatformOperator` rows without seed script |

### P2 — Scale path (20–100+ institutions)

| Task | When | Notes |
|------|------|-------|
| **SQLite → PostgreSQL** | ~50+ concurrent users or multi-server | Prisma supports both; plan maintenance window |
| Database indexes on `institutionId` | Before 50+ tenants | Audit slow queries on browse/assignments |
| Redis (sessions / rate limits) | High traffic | Optional; reduces DB load |
| Horizontal scaling | 100+ institutions | PostgreSQL required; stateless Node behind load balancer |
| CDN | Already via Cloudinary | Ensure `f_auto,q_auto` transforms |
| **Custom domains per institution** | Enterprise tier | `abu.ula.app` or `ula.abu.edu.ng` — DNS + SSL automation |
| **Optional per-institution SMTP override** | Enterprise tier | Keep central default; allow branded sender domain for large tenants |
| Read replicas | Heavy reporting | PostgreSQL read replica for analytics |
| **Queue for email (BullMQ + Redis)** | Bulk invites / provisioning | Avoid blocking API on SendGrid calls |
| Automated integration tests | Ongoing | Auth, tenant isolation, platform reset, activation, file upload |
| Multi-region backup | Compliance | Geo-redundant backup + restore drill |
| SOC2 / penetration test | Enterprise sales | Document security posture for university procurement |

### Known gaps (not blockers for first deploy, but plan them)

- Global role routes (`/lecturer`, `/admin`) still work for backward compatibility — prefer tenant URLs long term
- Per-institution SMTP not implemented (by design: central ULA delivery + tenant branding only)
- Platform email settings live in SQLite — fine for single-server; move to secrets manager at scale
- SQLite single-writer limit under heavy concurrent writes
- No automated penetration test / security audit documented
- Legacy `/accept-invite` path retained — redirect to `/accept-invitation` long term

---

## 4) Best SMTP providers for ULA

ULA uses **Nodemailer** with standard SMTP env vars — any provider below works without code changes.

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM="ULA Platform <noreply@yourdomain.com>"
APP_PUBLIC_URL=https://ula.yourdomain.com
```

**Requirements for ULA:** transactional email (invites, activation, password reset, platform reset, notifications), reliable deliverability, custom domain (`noreply@…`), reasonable cost at 1,000–50,000 emails/month. Configure via **Platform Settings → Email** or `.env` (env fills gaps when DB fields are empty).

### Recommended (pick one)

| Provider | Best for | Approx. cost | Why |
|----------|----------|--------------|-----|
| **[Resend](https://resend.com)** ⭐ Fastest setup | Startups, 1–50 universities | Free tier 3k/mo; then ~$20/mo | Modern API + SMTP, excellent docs, fast domain verification, good deliverability |
| **[Amazon SES](https://aws.amazon.com/ses/)** ⭐ Best at scale | 50+ institutions, high volume | ~$0.10 per 1,000 emails | Cheapest at scale; needs AWS account + domain DNS; exit sandbox for production |
| **[SendGrid](https://sendgrid.com)** (Twilio) ⭐ **Implemented** | Balanced enterprise | Free 100/day; paid from ~$20/mo | See **[SENDGRID_SETUP.md](./SENDGRID_SETUP.md)** |
| **[Postmark](https://postmarkapp.com)** | Highest deliverability | From ~$15/mo | Best inbox placement for transactional mail; premium price |
| **[Brevo](https://www.brevo.com)** (Sendinblue) | Budget / Africa-friendly | Free 300 emails/day | SMTP, simple UI, works well for Nigerian deployments |

### Not recommended for production

| Provider | Why avoid |
|----------|-----------|
| Gmail personal (`smtp.gmail.com`) | Low limits, spam risk, account lockouts |
| Outlook personal SMTP | Same issues; not built for app transactional mail |
| No SMTP (outbox only) | Acceptable in dev only — **blocks real users** |

### Our recommendation for ULA today

1. **Launch (1–10 universities):** **Resend** — fastest to configure, great deliverability, works with current Nodemailer setup.
2. **Scale (50+ universities, high email volume):** **Amazon SES** — lowest cost per email; worth the extra DNS/AWS setup.
3. **Official university domain (e.g. `noreply@ibbul.edu.ng`):** Any provider above + **SPF, DKIM, DMARC** DNS records on the university domain.

### Resend setup example

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your domain (DNS records they provide)
3. Create an API key / SMTP credentials
4. `.env`:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxx
SMTP_FROM="ULA Platform <noreply@yourdomain.com>"
APP_PUBLIC_URL=https://ula.yourdomain.com
```

### Amazon SES setup example

1. AWS Console → SES → verify domain
2. Create SMTP credentials (IAM)
3. Request production access (move out of sandbox)
4. `.env`:

```env
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=AKIAxxxxxxxxxxxx
SMTP_PASS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM="ULA Platform <noreply@yourdomain.com>"
```

### Email DNS checklist (all providers)

Add these to your sending domain before go-live:

- **SPF** — `v=spf1 include:_spf.provider.com ~all`
- **DKIM** — CNAME records from provider dashboard
- **DMARC** — `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com` (start with `p=none`, tighten later)

Send a test invite and password-reset email to Gmail and Outlook inboxes before announcing launch.

---

## 5) Production environment template

```env
# Core
NODE_ENV=production
PORT=4000
JWT_SECRET=<64-char-random-string>
PLATFORM_JWT_SECRET=<separate-64-char-random-string>
DATABASE_URL="file:./prod.db"

# Public URLs (all must match your live HTTPS domain)
CLIENT_ORIGIN=https://ula.yourdomain.com
APP_PUBLIC_URL=https://ula.yourdomain.com
PUBLIC_BASE_URL=https://ula.yourdomain.com

# Cloudinary (required)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=ula_files

# SMTP (required for production)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=
SMTP_FROM="ULA Platform <noreply@yourdomain.com>"

# Optional platform default (legacy API only — not used for tenant browse)
DEFAULT_INSTITUTION_SLUG=ibbul

# Backup (platform operator)
BACKUP_CRON_ENABLED=true
BACKUP_RCLONE_REMOTE=
```

---

## 6) Quick reference — who logs in where

| User type | URL | Notes |
|-----------|-----|-------|
| Platform operator | `/platform/login` | Manages institutions, email config, backups, audit; forgot password at `/platform/forgot-password` |
| Institution admin | `/{slug}/admin` | e.g. `/ibbul/admin` |
| Student / lecturer / HOD | `/{slug}/login` | Must use correct university slug |
| Anyone unsure of slug | `/` | Institution finder |

---

## 7) Document map

| File | Purpose |
|------|---------|
| **PLATFORM_STATUS.md** (this file) | Build status, pre-deploy checklist, scaling, SMTP |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Step-by-step VPS/Nginx/PM2 deployment |
| [deploy/HTTPS.md](./deploy/HTTPS.md) | Enterprise TLS, HSTS, certbot, verification |
| [LOGIN_DETAILS.md](./LOGIN_DETAILS.md) | Demo accounts and auth flows |
| [CLOUDINARY.md](./CLOUDINARY.md) | File storage setup |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | Older single-university status (partially outdated) |

---

*Before first production deploy: complete Section 2 P0 items, configure SMTP (Section 4), run staging checklist, then follow [DEPLOYMENT.md](./DEPLOYMENT.md).*
