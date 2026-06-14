#!/usr/bin/env node
/**
 * ULA production HTTPS verification.
 * Run on server after deploy, or locally against staging:
 *   BASE_URL=https://ula.example.com node scripts/verify-https-deployment.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const BASE = (process.env.BASE_URL || process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');

const checks = [];
let failed = 0;

function pass(name) {
  checks.push({ name, ok: true });
  console.log(`  ✓ ${name}`);
}

function fail(name, detail = '') {
  checks.push({ name, ok: false, detail });
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  failed += 1;
}

async function fetchJson(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { res, json, text };
}

async function main() {
  console.log('ULA HTTPS deployment verifier\n');

  if (!BASE) {
    console.error('Set BASE_URL or APP_PUBLIC_URL (must be https://your-domain)');
    process.exit(1);
  }

  if (!BASE.startsWith('https://')) {
    fail('BASE_URL uses HTTPS', BASE);
  } else {
    pass('BASE_URL uses HTTPS');
  }

  const envVars = ['CLIENT_ORIGIN', 'APP_PUBLIC_URL', 'PUBLIC_BASE_URL'];
  if (process.env.NODE_ENV === 'production') {
    for (const key of envVars) {
      const v = (process.env[key] || '').trim();
      if (!v.startsWith('https://')) fail(`${key} is https`, v || 'unset');
      else pass(`${key} is https`);
    }
  } else {
    console.log('  ℹ NODE_ENV≠production — skipping strict .env URL checks');
  }

  try {
    const healthUrl = `${BASE}/api/health`;
    const { res, json } = await fetchJson(healthUrl);
    if (res.ok && json?.ok) pass('/api/health returns ok:true');
    else fail('/api/health', `status ${res.status}`);

    if (json?.https?.enforced) pass('Health reports HTTPS enforcement');
    else if (json?.https) fail('Health reports HTTPS enforcement');
    else console.log('  ℹ Health HTTPS block not present (dev mode)');

    for (const key of ['clientOrigin', 'appPublicUrl', 'publicBaseUrl']) {
      const v = json?.https?.[key];
      if (v && v.startsWith('https://')) pass(`Health ${key} is https`);
      else if (v) fail(`Health ${key} is https`, v);
    }
  } catch (e) {
    fail('/api/health reachable', e.message);
  }

  const linkPaths = [
    '/platform/login',
    '/platform/forgot-password',
    '/ibbul/login',
    '/ibbul/forgot-password',
    '/ibbul/accept-invitation',
  ];

  for (const p of linkPaths) {
    try {
      const { res } = await fetch(`${BASE}${p}`, { redirect: 'follow' });
      if (res.ok) pass(`Route ${p} loads over HTTPS`);
      else fail(`Route ${p} loads`, `HTTP ${res.status}`);
    } catch (e) {
      fail(`Route ${p} loads`, e.message);
    }
  }

  try {
    const { buildPlatformResetUrl } = await import('../server/services/authLifecycle.js');
    const sample = buildPlatformResetUrl('test-token');
    if (sample.startsWith('https://')) pass('Email platform reset links use HTTPS');
    else fail('Email platform reset links use HTTPS', sample);
  } catch (e) {
    console.log(`  ℹ Email link check skipped: ${e.message}`);
  }

  console.log('\n────────────────────────────');
  console.log(`Checks: ${checks.length}  Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
