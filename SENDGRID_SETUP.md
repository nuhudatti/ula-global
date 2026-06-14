# SendGrid SMTP Setup — ULA Platform

Complete guide to configure **Twilio SendGrid** as the production email provider for ULA (password reset, invitations, institution onboarding, welcome emails, and system notifications).

All email sending goes through one service: `server/services/email/` (Nodemailer → SendGrid SMTP).

---

## 1) Create a SendGrid account

1. Go to [https://sendgrid.com](https://sendgrid.com) and sign up (free tier: **100 emails/day**).
2. Complete account verification (email + phone if prompted).
3. In the dashboard, go to **Settings → API Keys**.

---

## 2) Create an API key (SMTP password)

1. Click **Create API Key**.
2. Name: `ULA Production SMTP`
3. Permissions: **Restricted Access** → enable only **Mail Send → Full Access** (minimum required).
4. Click **Create & View** — copy the key immediately (`SG.xxxxx...`). You will not see it again.

> SendGrid SMTP uses username `apikey` and password = your API key.

---

## 3) Verify your sender domain (critical for inbox delivery)

Without domain authentication, emails land in **Spam** on Gmail, Outlook, and Yahoo.

### Option A — Single domain (recommended for launch)

1. SendGrid → **Settings → Sender Authentication → Authenticate Your Domain**
2. Choose your DNS host (Cloudflare, Namecheap, etc.)
3. Add the **CNAME** records SendGrid provides (DKIM + mail subdomain)
4. Wait for verification (usually 5–30 minutes)

### Option B — Single Sender Verification (quick test only)

1. **Settings → Sender Authentication → Verify a Single Sender**
2. Verify one email address (e.g. `noreply@yourdomain.com`)
3. Good for testing — **not recommended for production scale**

### DNS records checklist

| Record | Purpose |
|--------|---------|
| CNAME (DKIM) | Proves emails are legitimately from your domain |
| SPF (via SendGrid) | Included when you authenticate domain |
| DMARC (optional start) | `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com` |

---

## 4) Configure `.env`

Copy from `.env.example` and fill in:

```env
# Public URL — used in all email links
APP_PUBLIC_URL=https://ula.yourdomain.com
CLIENT_ORIGIN=https://ula.yourdomain.com

# SendGrid SMTP
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.your_sendgrid_api_key_here
SMTP_FROM="ULA Platform <noreply@yourdomain.com>"
SMTP_REPLY_TO=support@yourdomain.com

# Optional tuning
SMTP_RETRY_MAX=3
SMTP_RETRY_DELAY_MS=1000
EMAIL_DEV_OUTBOX=true
EMAIL_TEST_TO=your.personal@gmail.com
```

### Variable reference

| Variable | Required | Value |
|----------|----------|-------|
| `SMTP_HOST` | Yes (prod) | `smtp.sendgrid.net` |
| `SMTP_PORT` | Yes | `587` |
| `SMTP_SECURE` | Yes | `false` (STARTTLS on 587) |
| `SMTP_USER` | Yes | `apikey` (literal string) |
| `SMTP_PASS` | Yes | Your SendGrid API key |
| `SMTP_FROM` | Yes | `"ULA Platform <noreply@yourdomain.com>"` — must match verified domain/sender |
| `SMTP_REPLY_TO` | Recommended | `support@yourdomain.com` |
| `APP_PUBLIC_URL` | Yes | HTTPS URL for reset/invite links |
| `EMAIL_DEV_OUTBOX` | Dev only | `true` = save to `data/email-outbox/` when SMTP empty |

### Development vs production

| Environment | SMTP empty | Behaviour |
|-------------|------------|-----------|
| Development | Yes | Emails → `data/email-outbox/` (HTML files) |
| Development | No | Real SendGrid delivery |
| Production | Yes | **Server refuses to start** |
| Production | No | Real SendGrid delivery with retry |

---

## 5) Verify SMTP connection

Restart the API after editing `.env`:

```bash
npm run dev
```

### Method 1 — CLI script

```bash
# Verify SMTP handshake only
npm run email:verify

# Send test email to your Gmail
npm run email:test -- your.name@gmail.com
```

### Method 2 — Platform API (signed in as platform operator)

1. Sign in at `/platform/login` (`platform@ula.global` / `PlatformDemo123!` in dev)
2. Verify connection:

```bash
curl -X POST http://localhost:4000/api/platform/email/verify \
  -H "Authorization: Bearer YOUR_PLATFORM_JWT"
```

3. Send test email:

```bash
curl -X POST http://localhost:4000/api/platform/email/test \
  -H "Authorization: Bearer YOUR_PLATFORM_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"your.name@gmail.com\"}"
```

4. Check status:

```bash
curl http://localhost:4000/api/platform/email/status \
  -H "Authorization: Bearer YOUR_PLATFORM_JWT"
```

### Method 3 — Health endpoint

```bash
curl http://localhost:4000/api/health
```

Look for `"email": { "mode": "smtp", "provider": "sendgrid", "configured": true }`.

---

## 6) Test every email flow

Use a **real inbox** you control (Gmail + Outlook recommended).

### A) SMTP test email

```bash
npm run email:test -- your@gmail.com
```

**Pass:** Email arrives in inbox within 1–2 minutes, branded ULA template, not broken HTML.

---

### B) Password reset

1. Open `https://ula.yourdomain.com/ibbul/login` (or your institution slug).
2. Click **Forgot password?**
3. Enter a registered user email (e.g. `student@demo.ibbul.edu` after seed).
4. Check inbox for **"ULA — Reset your password"**.

**Pass:** Link opens `/reset-password?token=...` on your `APP_PUBLIC_URL` domain.

**API test:**

```bash
curl -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -H "X-Institution-Slug: ibbul" \
  -d "{\"email\":\"student@demo.ibbul.edu\"}"
```

---

### C) Lecturer / HOD invitation (department)

1. Sign in as HOD or department admin.
2. Department workspace → add lecturer by email (invite flow).
3. Check invitee inbox for **"ULA invitation — {department} (Lecturer)"** with OTP + activation link.

**Pass:** `/accept-invite?token=...` works; OTP activates account.

---

### D) Faculty administrator invitation

1. Sign in as institution admin or faculty-level admin.
2. Invite faculty administrator by email.
3. Check inbox for **"ULA invitation — {faculty} (Faculty Administrator)"**.

---

### E) Direct account creation (welcome email)

1. Department admin creates lecturer account directly (no invite link).
2. Check inbox for **"ULA account created — {department}"** with temporary password.

---

### F) Institution admin provisioning (platform)

1. Sign in at `/platform/login`.
2. **Institutions → Provision** new university with admin email.
3. Check admin inbox for **"ULA — {Institution} administrator account"**.

**Pass:** Login URL is `/{slug}/login` with one-time password.

---

### G) Resend institution admin credentials

1. Platform → Institutions → **Resend access** on an institution.
2. Admin receives a new welcome email with fresh temporary password.

---

## 7) Email flows reference

| Flow | Function | Subject line |
|------|----------|--------------|
| Password reset | `sendPasswordResetEmail` | `ULA — Reset your password` |
| Lecturer/HOD invite | `sendInviteEmail` | `ULA invitation — {dept} ({role})` |
| Faculty admin invite | `sendInviteEmail` | `ULA invitation — {faculty} (Faculty Administrator)` |
| Account activation | `sendInviteEmail` | Same as invite (OTP + link) |
| Welcome / direct create | `sendWelcomeCredentialsEmail` | `ULA account created — {dept}` |
| Institution admin | `sendInstitutionAdminWelcomeEmail` | `ULA — {institution} administrator account` |
| System notification | `sendNotificationEmail` | Custom title |
| SMTP test | `sendTestEmail` | `ULA — SendGrid email test` |

---

## 8) Architecture (what was implemented)

```
server/services/email/
  config.js      → env parsing, prod guard
  logger.js      → structured JSON logs [ula-email]
  transport.js   → Nodemailer pool, retry (3x), verify, dev outbox
  templates.js   → responsive HTML + plain-text fallback
  flows.js       → all transactional email types
  index.js       → public exports
```

**Features:**
- HTML + plain-text multipart (better deliverability)
- Reply-To header support
- Retry with exponential backoff
- Dev outbox fallback (development only)
- Production hard-fail if SMTP missing
- Mobile-responsive table-based templates
- ULA Global branding (not institution-specific spam triggers)
- Centralized logging for every send attempt

---

## 9) Troubleshooting

### Server won't start in production

```
FATAL: SMTP is not configured in production
```

**Fix:** Set all `SMTP_*` variables in `.env` on the server.

---

### `403 Forbidden` when sending (API verify OK but mail fails)

**Cause:** `SMTP_FROM` email is **not verified** in SendGrid.

**Fix:**
1. SendGrid → **Settings → Sender Authentication → Verify a Single Sender**
2. Add **the exact email** in your `SMTP_FROM` (e.g. `nuhumuhammaddatti@gmail.com`)
3. Open the verification email from SendGrid and click confirm
4. Restart `npm run dev` and run `npm run email:test -- your@gmail.com`

---

### `SMTP verify failed` / `535 Authentication failed`

| Cause | Fix |
|-------|-----|
| Wrong API key | Regenerate key in SendGrid; update `SMTP_PASS` |
| `SMTP_USER` not `apikey` | Must be literal `apikey` |
| Key lacks Mail Send permission | Edit API key → enable Mail Send |
| Extra spaces in `.env` | No quotes around password unless needed |

---

### Emails land in Spam / Junk (Gmail, Outlook)

**Why:** Sending **from a `@gmail.com` address through SendGrid** often fails SPF/DKIM alignment. Gmail expects mail from `@gmail.com` to come from Google servers, not SendGrid — so inbox providers mark it as suspicious.

**Fix for real inbox delivery (recommended):**

1. Buy or use a domain you control (e.g. `ula.edu.ng`, `universitylearningarchive.com`)
2. SendGrid → **Settings → Sender Authentication → Authenticate Your Domain**
3. Add the **DKIM CNAME** records to your domain DNS
4. Wait until status is **Verified**
5. Update `.env`:
   ```env
   SMTP_FROM="ULA Platform <noreply@yourdomain.com>"
   SMTP_REPLY_TO=universitylearningarchive@gmail.com
   ```
6. SendGrid → **Settings → Mail Settings → Sandbox Mode** → **OFF**
7. Send a test: `npm run email:test -- your@gmail.com`
8. In Gmail: open the first message → **Not spam** → add sender to contacts (helps reputation)

**Single Sender Verification** only proves you own one address — it does **not** guarantee inbox placement. **Domain authentication** is required for consistent inbox delivery.

---

### Email sent but lands in Spam

| Cause | Fix |
|-------|-----|
| Domain not authenticated | Complete SendGrid domain authentication |
| `SMTP_FROM` doesn't match verified domain | Use `noreply@yourdomain.com` on verified domain |
| New SendGrid account | Warm up: start with low volume; avoid burst sends |
| Missing DMARC | Add DMARC DNS record (start with `p=none`) |

**Test deliverability:** [https://www.mail-tester.com](https://www.mail-tester.com) — send test email to the address they provide; aim for **9/10+**.

---

### Links in email point to localhost

**Fix:** Set `APP_PUBLIC_URL=https://ula.yourdomain.com` (HTTPS, no trailing slash).

---

### Emails go to `data/email-outbox/` instead of inbox

**Cause:** `SMTP_HOST` or `SMTP_PASS` is empty in development.

**Fix:** Fill SendGrid vars in `.env` and restart API. Or keep outbox for local dev without SendGrid.

---

### `Connection timeout` on port 587

| Cause | Fix |
|-------|-----|
| Firewall blocks outbound 587 | Allow outbound SMTP on VPS |
| Wrong port | Try `SMTP_PORT=465` + `SMTP_SECURE=true` (SSL) |

---

### SendGrid dashboard shows "Processed" but no inbox delivery

- Check **Suppressions** (bounces, blocks, spam reports) in SendGrid.
- Recipient may have previously marked sender as spam.
- Verify single-recipient test first before bulk invites.

---

## 10) Production checklist

| Step | Done? |
|------|-------|
| SendGrid account created | ☐ |
| API key with Mail Send permission | ☐ |
| Domain authenticated (DKIM) | ☐ |
| `SMTP_*` vars set on server | ☐ |
| `APP_PUBLIC_URL` = HTTPS production domain | ☐ |
| `npm run email:verify` passes | ☐ |
| Test email arrives in Gmail inbox | ☐ |
| Password reset tested | ☐ |
| Invitation email tested | ☐ |
| Institution provision email tested | ☐ |
| DMARC record added | ☐ |
| Demo accounts removed or passwords rotated | ☐ |

---

## 11) Quick copy-paste `.env` block (SendGrid)

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.paste_your_key_here
SMTP_FROM="ULA Platform <noreply@yourdomain.com>"
SMTP_REPLY_TO=support@yourdomain.com
APP_PUBLIC_URL=https://ula.yourdomain.com
CLIENT_ORIGIN=https://ula.yourdomain.com
```

Restart: `npm run dev` (development) or `npm start` (production).

Verify: `npm run email:verify`  
Test inbox: `npm run email:test -- your@gmail.com`

---

*See also: [PLATFORM_STATUS.md](./PLATFORM_STATUS.md) · [DEPLOYMENT.md](./DEPLOYMENT.md)*
