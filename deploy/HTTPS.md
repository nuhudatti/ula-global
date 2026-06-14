# ULA — Enterprise HTTPS / SSL Deployment

Production ULA uses **Nginx** as TLS terminator and reverse proxy, **Let's Encrypt** for certificates, and application-level HTTPS enforcement so all auth, JWT, password reset, invitation, and activation links use `https://` only.

**Related:** [DEPLOYMENT.md](../DEPLOYMENT.md) · [PLATFORM_STATUS.md](../PLATFORM_STATUS.md)

---

## Architecture

```text
Internet
   │
   ▼
Nginx :443 (TLS 1.2/1.3, HSTS, security headers, rate limits)
   │  proxy_pass → 127.0.0.1:4000
   ▼
Node.js Express (HOST=127.0.0.1, trust proxy, helmet, HTTPS URL enforcement)
   │
   ├── web/dist (SPA — tenant + platform routes)
   └── /api/* (auth, platform, tenant-scoped APIs)
```

| Layer | Responsibility |
|-------|----------------|
| **Nginx** | TLS termination, HTTP→HTTPS redirect, HSTS, CSP, auth rate limits |
| **Certbot** | Let's Encrypt issuance + automatic renewal |
| **Express** | `trust proxy`, backup HTTPS redirect, helmet headers on API |
| **`publicUrl.js`** | Forces `https://` for email links in production; validates env on boot |

---

## Quick start (Ubuntu 22.04+ VPS)

Replace `ula.yourdomain.com` with your production hostname.

### 1. DNS

Create an **A record**:

```text
ula.yourdomain.com  →  YOUR_SERVER_IP
```

Wait for propagation (`dig ula.yourdomain.com`).

### 2. Application environment

Copy the production template and set **all three URLs to HTTPS**:

```bash
cp .env.production.example .env
nano .env
```

Required:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=4000

CLIENT_ORIGIN=https://ula.yourdomain.com
APP_PUBLIC_URL=https://ula.yourdomain.com
PUBLIC_BASE_URL=https://ula.yourdomain.com
```

The server **exits on startup** if any of these are missing or use `http://` when `NODE_ENV=production`.

Also set in **Platform Settings → Public app URL** (optional DB override; env is fallback).

### 3. Build and start Node (localhost only)

```bash
npm ci
npx prisma db push
npm run build
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save && pm2 startup
```

Verify Node is **not** exposed publicly:

```bash
curl http://127.0.0.1:4000/api/health   # works on server
curl http://YOUR_SERVER_IP:4000/api/health   # should FAIL (connection refused)
```

### 4. Install Nginx configuration

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
chmod +x deploy/scripts/*.sh
sudo deploy/scripts/install-nginx.sh ula.yourdomain.com
```

This installs:

- `deploy/nginx/ula.conf.template` → `/etc/nginx/sites-available/ula`
- TLS, security header, and proxy snippets under `/etc/nginx/snippets/`
- Rate-limit zones in `/etc/nginx/conf.d/ula-rate-limit.conf`

### 5. Obtain Let's Encrypt certificate

```bash
sudo deploy/scripts/ssl-setup.sh ula.yourdomain.com admin@yourdomain.com
```

Certbot will:

- Complete HTTP-01 challenge via `/.well-known/acme-challenge/`
- Install certificate paths in Nginx
- Enable **HTTP → HTTPS** redirect
- Register **certbot.timer** for automatic renewal
- Add deploy hook to `reload nginx` after renewal

### 6. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Port **4000 must not** be open publicly.

### 7. Verify deployment

```bash
chmod +x deploy/scripts/verify-https.sh
./deploy/scripts/verify-https.sh https://ula.yourdomain.com

# Or Node verifier (from server or CI):
BASE_URL=https://ula.yourdomain.com node scripts/verify-https-deployment.js
```

---

## What is configured

### TLS (modern)

File: `deploy/nginx/snippets/ssl-params.conf`

- TLS 1.2 and 1.3 only
- Strong cipher suites (Mozilla Intermediate)
- OCSP stapling
- Session cache + ticket disabled

### Security headers

File: `deploy/nginx/snippets/security-headers.conf` + Express `helmet`

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | Self + Cloudinary + Google Fonts + Font Awesome; `upgrade-insecure-requests` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Restricts camera, mic, geolocation |

### Rate limiting (Nginx)

| Zone | Limit | Applies to |
|------|-------|------------|
| `ula_auth` | 10 req/min | `/api/auth/login`, forgot-password, register, platform auth |
| `ula_api` | 120 req/min | All other `/api/*` |

### HTTPS-only links (emails)

All transactional links are built via `getAppPublicUrl()` → `enforceHttps()` in production:

| Flow | Example path |
|------|----------------|
| Institution forgot password | `https://domain/{slug}/reset-password?token=…` |
| Platform forgot password | `https://domain/platform/reset-password?token=…` |
| Institution activation | `https://domain/{slug}/reset-password?token=…` |
| Staff invitation | `https://domain/{slug}/accept-invitation?token=…` |

### Mixed-content prevention

- SPA and API share one HTTPS origin (Nginx → Express)
- Frontend uses relative `/api` paths (no hardcoded `http://localhost`)
- CSP `upgrade-insecure-requests` upgrades any stray HTTP sub-resources
- Cloudinary assets are loaded over HTTPS

---

## Automatic certificate renewal

Let's Encrypt certificates expire every 90 days. Certbot's systemd timer handles renewal:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

Deploy hook (created by `ssl-setup.sh`):

```text
/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Manual renewal test:

```bash
sudo certbot renew --dry-run
```

---

## Health check (monitoring)

```bash
curl -s https://ula.yourdomain.com/api/health | jq .
```

Production response includes:

```json
{
  "ok": true,
  "nodeEnv": "production",
  "tls": { "secure": true, "forwardedProto": "https" },
  "https": {
    "enforced": true,
    "clientOrigin": "https://ula.yourdomain.com",
    "appPublicUrl": "https://ula.yourdomain.com",
    "publicBaseUrl": "https://ula.yourdomain.com"
  }
}
```

Point UptimeRobot / Better Stack at this URL. Alert if `ok` is false or `tls.secure` is false.

---

## Deployment verification checklist

| # | Check | Command / action |
|---|-------|------------------|
| 1 | HTTP redirects to HTTPS | `curl -I http://ula.yourdomain.com` → `301` → `https://` |
| 2 | Valid TLS certificate | Browser padlock; `openssl s_client -connect domain:443` |
| 3 | HSTS header present | `curl -I https://ula.yourdomain.com` |
| 4 | Health endpoint | `curl https://ula.yourdomain.com/api/health` |
| 5 | Platform login | `https://ula.yourdomain.com/platform/login` |
| 6 | Platform forgot password | `/platform/forgot-password` |
| 7 | Institution finder | `https://ula.yourdomain.com/` |
| 8 | Tenant routes | `https://ula.yourdomain.com/ibbul/login` |
| 9 | Institution forgot password | `/{slug}/forgot-password` |
| 10 | Email link test | Provision institution → activation link uses `https://` |
| 11 | Password reset email | Forgot password → reset link uses `https://` |
| 12 | Staff invite email | Invite link uses `https://` |
| 13 | No mixed content | Browser DevTools → Console (no blocked HTTP resources) |
| 14 | Node not public | Port 4000 closed on firewall |
| 15 | Cert renewal dry-run | `sudo certbot renew --dry-run` |

Automated: `./deploy/scripts/verify-https.sh https://ula.yourdomain.com`

---

## File reference

| Path | Purpose |
|------|---------|
| `deploy/nginx/ula.conf.template` | Main Nginx site (HTTP redirect + HTTPS proxy) |
| `deploy/nginx/snippets/ssl-params.conf` | TLS 1.2/1.3 cipher configuration |
| `deploy/nginx/snippets/security-headers.conf` | HSTS, CSP, frame/options headers |
| `deploy/nginx/snippets/proxy.conf` | `X-Forwarded-*` headers for Express |
| `deploy/scripts/install-nginx.sh` | Install configs to `/etc/nginx/` |
| `deploy/scripts/ssl-setup.sh` | Certbot + renewal hook |
| `deploy/scripts/verify-https.sh` | Post-deploy shell verification |
| `deploy/pm2/ecosystem.config.cjs` | PM2 — binds `127.0.0.1` only |
| `server/services/publicUrl.js` | HTTPS URL normalization + production validation |
| `server/middleware/security.js` | Trust proxy, helmet, HTTPS redirect |
| `scripts/verify-https-deployment.js` | Node verification script |

---

## Troubleshooting

### Redirect loop

- Ensure Nginx sends `X-Forwarded-Proto: https` (included in `proxy.conf`).
- Express `trust proxy` must be enabled (automatic in production).

### Certificate renewal fails

- Port 80 must be open for HTTP-01 challenge.
- Check `/.well-known/acme-challenge/` location in Nginx.

### Email links still show `http://`

- Set `APP_PUBLIC_URL=https://…` in `.env` **and** Platform Settings.
- Restart PM2 after env change: `pm2 restart ula`.

### Mixed-content warnings

- All three URL env vars must be `https://`.
- Cloudinary URLs are HTTPS by default.

### `FATAL: Invalid production URL configuration`

Production boot requires `CLIENT_ORIGIN`, `APP_PUBLIC_URL`, and `PUBLIC_BASE_URL` all starting with `https://`.

---

## Development (unchanged)

Local dev continues to use:

```env
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
APP_PUBLIC_URL=http://localhost:5173
```

Vite proxies `/api` → `http://localhost:4000`. No Nginx or TLS required for development.

---

*Before go-live: complete this guide, run the verification checklist, then follow [DEPLOYMENT.md](../DEPLOYMENT.md) Milestone 4.*
