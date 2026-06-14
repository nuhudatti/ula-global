import { useLocation } from 'react-router-dom';
import { tenantPathsFor } from '../lib/tenant';
import { useInstitutionSlug } from './useInstitutionSlug';

export function useTenantPaths() {
  const { pathname } = useLocation();
  const slug = useInstitutionSlug();
  return tenantPathsFor(pathname, slug);
}
