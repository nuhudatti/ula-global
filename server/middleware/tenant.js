import { resolveTenantBySlug, resolveTenantSlugFromRequest } from '../services/tenantService.js';

/**
 * Resolve tenant from X-Institution-Slug header or :slug path param.
 * Attaches req.tenant (Institution row or null).
 */
async function attachTenantFromSlug(req, res, slug) {
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) {
    res.status(404).json({ error: 'Institution not found' });
    return false;
  }
  if (tenant.status === 'SUSPENDED') {
    res.status(403).json({ error: 'This institution is temporarily suspended' });
    return false;
  }
  req.tenant = tenant;
  return true;
}

export async function resolveTenantMiddleware(req, res, next) {
  try {
    const slug = await resolveTenantSlugFromRequest(req);

    if (slug) {
      const ok = await attachTenantFromSlug(req, res, slug);
      if (!ok) return;
      return next();
    }

    return res.status(400).json({ error: 'Institution context required. Open your university URL (e.g. /ibbul).' });
  } catch (e) {
    console.error('[tenant]', e);
    res.status(500).json({ error: 'Tenant resolution failed' });
  }
}

/** For public auth routes — attach tenant when slug is sent, but do not require it. */
export async function optionalTenantMiddleware(req, res, next) {
  try {
    const slug = await resolveTenantSlugFromRequest(req);

    if (slug) {
      const ok = await attachTenantFromSlug(req, res, slug);
      if (!ok) return;
    }

    return next();
  } catch (e) {
    console.error('[tenant]', e);
    res.status(500).json({ error: 'Tenant resolution failed' });
  }
}

/** Require authenticated user belongs to req.tenant. */
export function requireTenantMember(req, res, next) {
  if (!req.tenant?.id) return res.status(400).json({ error: 'Tenant context required' });
  if (!req.user?.institutionId) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.institutionId !== req.tenant.id) {
    return res.status(403).json({ error: 'Access denied for this institution' });
  }
  next();
}
