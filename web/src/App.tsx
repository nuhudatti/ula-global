import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { BrowsePage } from './pages/BrowsePage';
import { InstitutionFinderPage } from './pages/InstitutionFinderPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LecturerPage } from './pages/LecturerPage';
import { DepartmentPage } from './pages/DepartmentPage';
import { FacultyPage } from './pages/FacultyPage';
import { DashboardRedirect } from './components/DashboardRedirect';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { AcceptInvitationPage } from './pages/AcceptInvitationPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ForceChangePasswordPage } from './pages/ForceChangePasswordPage';
import { StudentContributePage } from './pages/student/StudentContributePage';
import { SettingsPage } from './pages/SettingsPage';
import { ArmPage } from './pages/ArmPage';
import { AdminPage } from './pages/AdminPage';
import { DiscussionFab } from './components/DiscussionFab';
import { PlatformLoginPage } from './pages/platform/PlatformLoginPage';
import { PlatformSetupPage } from './pages/platform/PlatformSetupPage';
import { PlatformForgotPasswordPage } from './pages/platform/PlatformForgotPasswordPage';
import { PlatformResetPasswordPage } from './pages/platform/PlatformResetPasswordPage';
import { PlatformWorkspace } from './pages/platform/PlatformWorkspace';
import { TenantShell } from './components/TenantShell';
import { TenantRouteSync } from './components/TenantRouteSync';

const INSTITUTION_ROLES = ['STUDENT', 'LECTURER', 'HOD', 'DEPARTMENT_ADMIN', 'FACULTY_ADMIN', 'INSTITUTION_ADMIN', 'SUPER_ADMIN', 'ACADEMIC_RESOURCES_MANAGER'] as const;

const RESOURCE_WORKSPACE_ROLES = ['ACADEMIC_RESOURCES_MANAGER', 'INSTITUTION_ADMIN', 'SUPER_ADMIN'] as const;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <TenantRouteSync />
        <BrandingProvider>
        <ToastProvider>
        <Routes>
          <Route path="/platform/setup" element={<PlatformSetupPage />} />
          <Route path="/platform/login" element={<PlatformLoginPage />} />
          <Route path="/platform/forgot-password" element={<PlatformForgotPasswordPage />} />
          <Route path="/platform/reset-password" element={<PlatformResetPasswordPage />} />
          <Route path="/platform" element={<PlatformWorkspace />} />

          <Route
            path="/lecturer"
            element={
              <ProtectedRoute roles={['LECTURER']}>
                <LecturerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/department"
            element={
              <ProtectedRoute roles={['HOD', 'DEPARTMENT_ADMIN']}>
                <DepartmentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty"
            element={
              <ProtectedRoute roles={['FACULTY_ADMIN']}>
                <FacultyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resources"
            element={
              <ProtectedRoute roles={[...RESOURCE_WORKSPACE_ROLES]}>
                <ArmPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['INSTITUTION_ADMIN', 'SUPER_ADMIN']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          <Route element={<Layout />}>
            <Route path="/" element={<InstitutionFinderPage />} />
            <Route path="/dashboard" element={<DashboardRedirect />} />
            <Route path="/login" element={<Navigate to="/?signin=1" replace />} />
            <Route path="/register" element={<Navigate to="/?register=1" replace />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute roles={[...INSTITUTION_ROLES]}>
                  <ForceChangePasswordPage />
                </ProtectedRoute>
              }
            />
            <Route path="/student" element={<Navigate to="/" replace />} />
            <Route path="/assignments" element={<Navigate to="/" replace />} />
            <Route
              path="/contribute"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <StudentContributePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute roles={[...INSTITUTION_ROLES]}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="/:tenantSlug" element={<TenantShell />}>
            <Route element={<Layout />}>
              <Route index element={<BrowsePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
              <Route path="accept-invite" element={<AcceptInvitePage />} />
              <Route path="accept-invitation" element={<AcceptInvitationPage />} />
              <Route
                path="resources"
                element={
                  <ProtectedRoute roles={[...RESOURCE_WORKSPACE_ROLES]}>
                    <ArmPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <ProtectedRoute roles={['INSTITUTION_ADMIN', 'SUPER_ADMIN']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <DiscussionFab />
        </ToastProvider>
        </BrandingProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
