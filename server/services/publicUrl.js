import { getEffectiveEmailSettings } from './platformEmailSettings.js';
import { enforceHttps, stripTrailingSlash } from './urlUtils.js';

const isProd = process.env.NODE_ENV === 'production';

export { enforceHttps } from './urlUtils.js';

export function getClientOrigin() {
  const origin = stripTrailingSlash(process.env.CLIENT_ORIGIN) || 'http://localhost:5173';
  return enforceHttps(origin);
}

export function getAppPublicUrl() {
  const s = getEffectiveEmailSettings();
  const url =
    stripTrailingSlash(s.appPublicUrl) ||
    stripTrailingSlash(process.env.APP_PUBLIC_URL) ||
    stripTrailingSlash(process.env.CLIENT_ORIGIN) ||
    'http://localhost:5173';
  return enforceHttps(url);
}

export function getPublicBaseUrl() {
  const url =
    stripTrailingSlash(process.env.PUBLIC_BASE_URL) ||
    stripTrailingSlash(process.env.APP_PUBLIC_URL) ||
    stripTrailingSlash(process.env.CLIENT_ORIGIN) ||
    (isProd ? '' : 'http://localhost:4000');
  return enforceHttps(url);
}

function isLocalhostUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

/** Collect public URL errors for production boot (no exit). */
export function getProductionUrlErrors() {
  if (!isProd) return [];

  const checks = [
    ['CLIENT_ORIGIN', process.env.CLIENT_ORIGIN],
    ['APP_PUBLIC_URL', process.env.APP_PUBLIC_URL],
    ['PUBLIC_BASE_URL', process.env.PUBLIC_BASE_URL],
  ];

  const issues = [];
  for (const [name, value] of checks) {
    const v = stripTrailingSlash(value);
    if (!v) {
      issues.push(`${name} is required in production (HTTPS public URL, e.g. https://ula.yourdomain.com)`);
    } else if (!v.startsWith('https://')) {
      issues.push(`${name} must start with https:// in production (got ${v})`);
    } else if (isLocalhostUrl(v)) {
      issues.push(`${name} must not use localhost in production (got ${v})`);
    }
  }

  return issues;
}

/** Fail fast in production if public URLs are missing or not HTTPS. */
export function validateProductionUrls() {
  const issues = getProductionUrlErrors();
  if (issues.length) {
    return { ok: false, issues };
  }
  return { ok: true, issues: [] };
}

export function getUrlSecurityStatus() {
  return {
    enforced: isProd,
    clientOrigin: getClientOrigin(),
    appPublicUrl: getAppPublicUrl(),
    publicBaseUrl: getPublicBaseUrl(),
  };
}
