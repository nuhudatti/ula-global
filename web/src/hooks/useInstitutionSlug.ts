import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { readLastInstitutionSlug } from '../lib/signOut';
import { isTenantPath, resolveInstitutionSlug } from '../lib/tenant';

export function useInstitutionSlug(): string | null {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const userSlug = isTenantPath(pathname) ? null : user?.institution?.slug ?? readLastInstitutionSlug();
  return resolveInstitutionSlug(pathname, userSlug);
}
