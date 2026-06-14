import { isTenantPath, resolveInstitutionSlug } from './tenant';

const TOKEN_KEY = 'ibbul_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

type Json = Record<string, unknown>;

let institutionSlugHeader: string | null = null;

/** Slug sent on tenant-scoped API calls — URL wins; no default institution. */
export function resolveRequestInstitutionSlug(): string | null {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (isTenantPath(pathname)) {
      return resolveInstitutionSlug(pathname, null);
    }
  }
  return institutionSlugHeader;
}

export function getInstitutionSlugHeader(): string | null {
  return resolveRequestInstitutionSlug();
}

export function setInstitutionSlugHeader(slug: string | null) {
  institutionSlugHeader = slug || null;
}

/** Auth + tenant headers for any direct fetch (downloads, uploads, streams). */
export function buildApiHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const tenantSlug = resolveRequestInstitutionSlug();
  if (tenantSlug) headers.set('X-Institution-Slug', tenantSlug);
  return headers;
}

export async function api<T = Json>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = buildApiHeaders(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
