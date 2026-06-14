import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { readLastInstitutionSlug } from '../lib/signOut';
import { tenantPathsFor } from '../lib/tenant';
import { InstitutionBrandingPanel } from '../components/settings/InstitutionBrandingPanel';
import { FacultyBrandingPanel } from '../components/settings/FacultyBrandingPanel';
import { DepartmentBrandingPanel } from '../components/settings/DepartmentBrandingPanel';
import { LecturerProfilePanel } from '../components/settings/LecturerProfilePanel';

/** Role-specific settings — no mixed personal + org branding screens. */
export function SettingsPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const loginPath = tenantPathsFor(location.pathname, readLastInstitutionSlug()).login;

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14 text-center text-sm text-slate-500">
        Loading settings…
      </div>
    );
  }

  if (!user) {
    return <Navigate to={loginPath} replace />;
  }

  let panel: ReactNode;
  if (user.role === 'SUPER_ADMIN') {
    panel = <InstitutionBrandingPanel />;
  } else if (user.role === 'FACULTY_ADMIN') {
    panel = <FacultyBrandingPanel />;
  } else if (user.role === 'HOD' || user.role === 'DEPARTMENT_ADMIN') {
    panel = <DepartmentBrandingPanel />;
  } else {
    panel = <LecturerProfilePanel />;
  }

  return <div className="mx-auto max-w-4xl px-4 py-10 md:py-14">{panel}</div>;
}
