/** Store and serve upload paths relative to the app host (/uploads/...) for Vite + API parity. */
export function normalizeStoredMediaUrl(url) {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith('/uploads/')) return parsed.pathname;
  } catch {
    /* keep external URLs (e.g. Cloudinary) as-is */
  }
  return trimmed;
}

/** Resolve relative media paths to absolute HTTPS URLs for clients and email. */
export function absolutizePublicMediaUrl(url, baseUrl = '') {
  const normalized = normalizeStoredMediaUrl(url);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) {
    return normalized.startsWith('http://') ? `https://${normalized.slice(7)}` : normalized;
  }
  if (normalized.startsWith('/') && baseUrl) {
    return `${String(baseUrl).replace(/\/$/, '')}${normalized}`;
  }
  return normalized;
}

export function normalizeMediaFields(row, fields = ['logoUrl', 'bannerUrl', 'profilePhotoUrl']) {
  if (!row) return row;
  const out = { ...row };
  for (const f of fields) {
    if (f in out) out[f] = normalizeStoredMediaUrl(out[f]);
  }
  return out;
}
