import type { Role } from '../context/AuthContext';

/** Home route after sign-in, invite activation, or role-based entry. */
export function homePathForRole(role: Role | string, institutionSlug?: string | null): string {
  const browse = institutionSlug ? `/${institutionSlug}` : '/';
  if (role === 'FACULTY_ADMIN') return '/faculty';
  if (role === 'INSTITUTION_ADMIN' || role === 'SUPER_ADMIN') {
    return institutionSlug ? `/${institutionSlug}/admin` : '/admin';
  }
  if (role === 'LECTURER') return '/lecturer';
  if (role === 'ACADEMIC_RESOURCES_MANAGER') return institutionSlug ? `/${institutionSlug}/resources` : '/resources';
  if (role === 'HOD' || role === 'DEPARTMENT_ADMIN') return '/department';
  if (role === 'STUDENT') return browse;
  return browse;
}
