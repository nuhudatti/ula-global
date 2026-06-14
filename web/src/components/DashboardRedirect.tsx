import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../lib/authRedirects';

/** Legacy /dashboard URL — send users to their real workspace, not the old role picker. */
export function DashboardRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homePathForRole(user.role, user.institution?.slug) : '/'} replace />;
}
