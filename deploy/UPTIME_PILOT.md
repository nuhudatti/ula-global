# ULA Pilot — UptimeRobot keep-warm setup

Keep your **Render free tier** service awake so students and lecturers do **not** wait 30–90 seconds on “Service waking up…”.

Render sleeps after **~15 minutes** with no HTTP traffic. UptimeRobot pings every **5 minutes** (free tier) so the app stays warm.

---

## Step 1 — Confirm your live URL

Use the same HTTPS URL as in Render env (`APP_PUBLIC_URL`), for example:

- `https://ula-platform.onrender.com` (Render default)
- or your custom domain: `https://ula.ibbul.edu.ng`

**Verify locally before creating the monitor:**

```bash
node scripts/check-uptime-endpoint.js https://YOUR-LIVE-URL
```

Or:

```bash
BASE_URL=https://YOUR-LIVE-URL npm run uptime:check
```

Expected: `✓ Request 1: HTTP 200 in …ms` and `ping: "pong"`.

**Monitor URL (copy exactly):**

```text
https://YOUR-LIVE-URL/api/health/ping
```

Do **not** use `/api/health` for keep-warm — it is heavier. Use `/api/health/ping` only.

---

## Step 2 — Create UptimeRobot account

1. Go to [https://uptimerobot.com](https://uptimerobot.com) → **Sign Up** (free).
2. Confirm your email.

---

## Step 3 — Create the monitor (exact settings)

1. Dashboard → **+ Add New Monitor**
2. Use these values:

| Field | Value |
|--------|--------|
| **Monitor Type** | HTTP(s) |
| **Friendly Name** | `ULA Pilot — Render keep-warm` |
| **URL** | `https://YOUR-LIVE-URL/api/health/ping` |
| **Monitoring Interval** | **5 minutes** (shortest on free plan) |
| **Monitor Timeout** | **60 seconds** if available; otherwise **30 seconds** |
| **HTTP Method** | GET |
| **Keyword monitoring** | Enabled |
| **Keyword** | `"ping":"pong"` |
| **Keyword type** | Keyword exists |

3. **Create Monitor**

### Why these settings?

| Setting | Reason |
|---------|--------|
| 5-minute interval | Render sleeps at ~15 min idle; ping every 5 min keeps it awake |
| 60s timeout | Cold start after deploy can take 30–90s; avoids false “down” alerts |
| Keyword `"ping":"pong"` | Confirms ULA responded, not a generic error page |
| `/api/health/ping` | Instant JSON — no database, no auth |

---

## Step 4 — Alert contacts (recommended for pilot)

1. **My Settings** → **Alert Contacts** → add your email (and SMS if you want).
2. Edit the monitor → enable **Send alert when down** and **Send alert when up**.
3. You get email if the app is truly down (bad deploy, env error, etc.).

---

## Step 5 — Render dashboard alignment

In **Render** → your web service → **Settings**:

| Setting | Value |
|---------|--------|
| **Health Check Path** | `/api/health/ping` |
| **Health Check Grace Period** | 120 seconds (first deploy) |
| **HOST** | `0.0.0.0` (auto when Render sets `PORT`; set manually if health checks fail) |

Save. Redeploy once if you changed health check path.

---

## Step 6 — Verify it works (15-minute test)

1. Open Render logs — note “Service live”.
2. Wait **20 minutes** without visiting the site in a browser.
3. Open `https://YOUR-LIVE-URL/api/health/ping` in a browser or run:

   ```bash
   npm run uptime:check
   ```

4. Response should be **under 2 seconds** (not a long “waking up” page).

5. In UptimeRobot → monitor → **Last 24 hours** should show **green / up**.

---

## Optional — GitHub Actions backup ping (every 9 minutes)

If the repo is on GitHub, a workflow is included at `.github/workflows/pilot-keep-warm.yml`.

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. New secret: `ULA_PING_URL` = `https://YOUR-LIVE-URL/api/health/ping`
3. Workflow runs automatically on schedule (redundant with UptimeRobot — extra safety).

Disable either UptimeRobot or the GitHub workflow if you only want one pinger.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| UptimeRobot shows **Down** but site works in browser | Increase timeout to 60–90s; cold start may exceed 30s |
| Keyword check fails | URL must be `/api/health/ping`; redeploy latest code |
| Still see “Service waking up” for users | Monitor not running, wrong URL, or interval >15 min; verify UptimeRobot dashboard |
| Monitor up but first user slow after deploy | Normal once after deploy; wait 2–3 min or trigger manual ping |
| Want **zero** cold starts | Upgrade Render to **Starter ($7/mo)** — always-on |

---

## What we cannot fix on free Render

- **First request after a new deploy** may still take 1–2 minutes (build + migrate + boot).
- **Free tier** can still spin down if **both** UptimeRobot and all backup pings stop (account issue, wrong URL).
- **Guaranteed no delay** requires Render **Starter** or a VPS — not code alone.

For pilot, **UptimeRobot every 5 minutes + `/api/health/ping`** is the standard, accurate free-tier setup.

---

## Quick reference

```bash
# Check live ping
npm run uptime:check

# With explicit URL
node scripts/check-uptime-endpoint.js https://YOUR-LIVE-URL
```

**UptimeRobot monitor URL:**

```text
https://YOUR-LIVE-URL/api/health/ping
```

**Success body:**

```json
{"ok":true,"ping":"pong","ts":1710000000000}
```
