import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext';
import { readLastInstitutionSlug } from '../lib/signOut';
import { tenantPathsFor } from '../lib/tenant';

export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles: Role[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const institutionSlug = user?.institution?.slug ?? readLastInstitutionSlug();
  const paths = tenantPathsFor(location.pathname, institutionSlug);
  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to={paths.login} replace />;
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (!roles.includes(user.role)) {
    const fallback =
      user.role === 'SUPER_ADMIN'
        ? '/admin'
        : user.role === 'FACULTY_ADMIN'
          ? '/faculty'
        : user.role === 'LECTURER'
          ? '/lecturer'
          : user.role === 'ACADEMIC_RESOURCES_MANAGER'
            ? '/resources'
            : user.role === 'HOD' || user.role === 'DEPARTMENT_ADMIN'
            ? '/department'
            : '/';
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}
