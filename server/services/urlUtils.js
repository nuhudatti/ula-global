const isProd = process.env.NODE_ENV === 'production';

export function stripTrailingSlash(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

/** In production, upgrade http → https for public-facing links. */
export function enforceHttps(url) {
  const raw = stripTrailingSlash(url);
  if (!raw) return raw;
  if (isProd && /^http:\/\//i.test(raw)) {
    return raw.replace(/^http:\/\//i, 'https://');
  }
  return raw;
}
