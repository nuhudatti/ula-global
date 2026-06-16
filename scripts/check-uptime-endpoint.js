#!/usr/bin/env node
/**
 * Verify the live ping endpoint (UptimeRobot / keep-warm target).
 *
 * Usage:
 *   node scripts/check-uptime-endpoint.js https://your-app.onrender.com
 *   BASE_URL=https://your-app.onrender.com npm run uptime:check
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const base = (process.argv[2] || process.env.BASE_URL || process.env.APP_PUBLIC_URL || '')
  .trim()
  .replace(/\/$/, '');

if (!base) {
  console.error('Usage: node scripts/check-uptime-endpoint.js https://YOUR-LIVE-URL');
  console.error('   or: BASE_URL=https://YOUR-LIVE-URL npm run uptime:check');
  process.exit(1);
}

const pingUrl = `${base}/api/health/ping`;
const timeoutMs = Number(process.env.UPTIME_CHECK_TIMEOUT_MS || 90_000);

async function checkOnce(label) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(pingUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'ULA-Uptime-Check/1.0' },
      redirect: 'follow',
    });
    const elapsed = Date.now() - started;
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    return { label, ok: res.ok && json?.ok === true && json?.ping === 'pong', status: res.status, elapsed, json, text: text.slice(0, 200) };
  } catch (e) {
    return { label, ok: false, status: 0, elapsed: Date.now() - started, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

console.log(`ULA uptime check → ${pingUrl}`);
console.log(`Timeout: ${timeoutMs / 1000}s per request\n`);

const first = await checkOnce('Request 1');
if (first.ok) {
  console.log(`  ✓ ${first.label}: HTTP ${first.status} in ${first.elapsed}ms — warm (${JSON.stringify(first.json)})`);
} else if (first.error) {
  console.log(`  ✗ ${first.label}: ${first.error} (${first.elapsed}ms)`);
} else {
  console.log(`  ✗ ${first.label}: HTTP ${first.status} in ${first.elapsed}ms — ${first.text || 'invalid body'}`);
}

if (first.elapsed > 8000) {
  console.log('\n  ⚠ Response took >8s — likely a cold start. UptimeRobot should use 60–90s timeout.');
} else if (first.ok && first.elapsed < 2000) {
  console.log('\n  ✓ Service is warm — suitable for 5-minute UptimeRobot interval.');
}

if (!first.ok || first.elapsed > 15000) {
  console.log('\n  Retrying once (cold start may need a second request)…');
  await new Promise((r) => setTimeout(r, 3000));
  const second = await checkOnce('Request 2');
  if (second.ok) {
    console.log(`  ✓ ${second.label}: HTTP ${second.status} in ${second.elapsed}ms`);
  } else {
    console.log(`  ✗ ${second.label}: failed (${second.error || second.status})`);
    process.exit(1);
  }
}

console.log('\nReady for UptimeRobot — use this exact URL in your monitor:');
console.log(`  ${pingUrl}`);
process.exit(0);
