import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { setInstitutionSlugHeader } from '../lib/api';
import { resolveInstitutionSlug } from '../lib/tenant';

/** Keeps cached API tenant header aligned with the URL (legacy paths use signed-in institution). */
export function TenantRouteSync() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const slug = resolveInstitutionSlug(pathname, user?.institution?.slug);

  useLayoutEffect(() => {
    setInstitutionSlugHeader(slug);
  }, [slug]);

  return null;
}
