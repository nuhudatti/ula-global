/** Normalize stored media URLs so images load in dev (Vite proxy) and production (same host). */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith('/uploads/')) {
      return parsed.pathname;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

/** Defeat browser cache when the same path is replaced or branding updates. */
export function withCacheBust(url: string | null | undefined, epoch: number | string): string | null {
  const resolved = resolveImageUrl(url);
  if (!resolved) return null;
  if (resolved.startsWith('blob:') || resolved.startsWith('data:')) return resolved;
  const sep = resolved.includes('?') ? '&' : '?';
  return `${resolved}${sep}v=${encodeURIComponent(String(epoch))}`;
}
