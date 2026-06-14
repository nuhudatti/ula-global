export const RESERVED_SLUGS = new Set([
  'platform', 'api', 'admin', 'login', 'register', 'lecturer', 'department', 'faculty',
  'settings', 'dashboard', 'contribute', 'student', 'assignments', 'uploads', 'health',
  'accept-invite', 'accept-invitation', 'forgot-password', 'reset-password', 'change-password',
]);

/** Resolve tenant slug from URL path; on legacy routes use signed-in user's institution only. */
export function resolveInstitutionSlug(pathname: string, userSlug?: string | null): string | null {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg && !RESERVED_SLUGS.has(seg) && seg !== 'platform') {
    return seg;
  }
  if (userSlug) return userSlug;
  return null;
}

export function normalizeSlugInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
}

export function isTenantPath(pathname: string): boolean {
  const seg = pathname.split('/').filter(Boolean)[0];
  return Boolean(seg && !RESERVED_SLUGS.has(seg) && seg !== 'platform');
}

/** Tenant-aware paths — when slug is known (URL or signed-in user), stay in that institution. */
export function tenantPathsFor(pathname: string, slug: string | null = resolveInstitutionSlug(pathname, null)) {
  const base = slug ? `/${slug}` : '';
  return {
    slug,
    base,
    home: base || '/',
    login: slug ? `${base}/login` : '/?signin=1',
    register: slug ? `${base}/register` : '/?register=1',
    admin: slug ? `${base}/admin` : '/admin',
    forgotPassword: slug ? `${base}/forgot-password` : '/forgot-password',
    resetPassword: slug ? `${base}/reset-password` : '/reset-password',
    acceptInvite: slug ? `${base}/accept-invite` : '/accept-invite',
    acceptInvitation: slug ? `${base}/accept-invitation` : '/accept-invitation',
  };
}
