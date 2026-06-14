import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminFacultyDetail, AdminSection, PlatformOverview } from '../../lib/adminFaculties';
import { adminFacultyUrl } from '../../lib/facultyScope';
import { useAuth } from '../../context/AuthContext';
import { AdminOverview } from '../../components/admin/AdminOverview';
import { FacultyManagement } from '../../components/admin/FacultyManagement';
import { ArmResourcesTeam } from '../../components/admin/ArmResourcesTeam';
import { FacultySwitcher } from '../../components/admin/FacultySwitcher';
import { InstitutionBrandingPanel } from '../../components/settings/InstitutionBrandingPanel';
import { InstitutionHeaderMark } from '../../components/InstitutionBrand';
import { WorkspaceBrandHeader } from '../../components/WorkspaceBrandHeader';
import { WorkspaceSidebarAccount } from '../../components/WorkspaceSidebarAccount';
import { UserProfileChip } from '../../components/UserProfileChip';
import { useLogoPlacement } from '../../context/BrandingContext';
import '../../styles/department-workspace.css';
import '../../styles/admin-workspace.css';
import '../../styles/identity-settings.css';
import '../../styles/institution-brand.css';

const NAV: { id: AdminSection; label: string; icon: string }[] = [
  { id: 'overview', label: 'Institution overview', icon: 'fa-gauge-high' },
  { id: 'faculties', label: 'Faculty management', icon: 'fa-school' },
  { id: 'resources', label: 'Resources team', icon: 'fa-books' },
  { id: 'institution', label: 'Institution branding', icon: 'fa-landmark' },
];

export function SuperAdminWorkspace() {
  const { user } = useAuth();
  const logoPlacement = useLogoPlacement();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scopedFacultyId = searchParams.get('facultyId');

  const [section, setSection] = useState<AdminSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [scopedFaculty, setScopedFaculty] = useState<AdminFacultyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scopedFacultyId) setSection('faculties');
  }, [scopedFacultyId]);

  const loadOverview = useCallback(async () => {
    const data = await api<PlatformOverview>('/api/admin/overview');
    setOverview(data);
  }, []);

  const loadScopedFaculty = useCallback(async (id: string) => {
    const data = await api<AdminFacultyDetail>(`/api/admin/faculties/${id}`);
    setScopedFaculty(data);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadOverview();
        if (scopedFacultyId) await loadScopedFaculty(scopedFacultyId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load platform data');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadOverview, loadScopedFaculty, scopedFacultyId]);

  function onFacultySelected(id: string) {
    navigate(adminFacultyUrl(id));
  }

  function onFacultyRefresh() {
    void loadOverview();
    if (scopedFacultyId) void loadScopedFaculty(scopedFacultyId);
  }

  const sectionTitle =
    scopedFacultyId && scopedFaculty && section === 'faculties'
      ? scopedFaculty.name
      : NAV.find((n) => n.id === section)?.label ?? 'Institution Admin';

  return (
    <div className="ula-admin-root ula-dept-root flex min-h-dvh">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-slate-900/30 lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className="ula-admin-sidebar ula-dept-sidebar flex shrink-0 flex-col" data-open={sidebarOpen}>
        <WorkspaceBrandHeader subtitle="Institution Admin" accentClass="text-primary-700" />

        <div className="border-b border-slate-100 px-4 py-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Faculty scope</p>
          <FacultySwitcher
            currentFacultyId={scopedFacultyId}
            currentFacultyName={scopedFaculty?.name}
            className="w-full"
          />
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Institution admin navigation">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={section === item.id}
              className="ula-admin-nav-item ula-dept-nav-item"
              onClick={() => {
                setSection(item.id);
                setSidebarOpen(false);
              }}
            >
              <i className={`fa-solid ${item.icon} w-4 text-center text-[13px] opacity-80`} aria-hidden />
              {item.label}
            </button>
          ))}
        </nav>

        <WorkspaceSidebarAccount roleLabel="Institution Administrator" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[var(--dw-header)] items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur-md md:px-8">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <i className="fa-solid fa-bars" aria-hidden />
          </button>
          {logoPlacement === 'left' ? <InstitutionHeaderMark className="hidden sm:flex" /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-700">
              Institution administration
            </p>
            <h1 className="truncate text-base font-semibold text-slate-900">{sectionTitle}</h1>
          </div>
          <button
            type="button"
            className="hidden rounded-xl bg-primary-700 px-4 py-2 text-xs font-semibold text-white sm:inline-flex"
            onClick={() => setSection('faculties')}
          >
            <i className="fa-solid fa-plus mr-1.5" aria-hidden />
            New faculty
          </button>
          {logoPlacement === 'right' ? <InstitutionHeaderMark className="hidden sm:flex" /> : null}
          <UserProfileChip
            name={user?.fullName ?? 'Admin'}
            subtitle="Institution Admin"
            imageUrl={user?.profilePhotoUrl}
            compact
            showSettings={false}
            profileActionLabel="Institution branding"
            onOpenProfile={() => setSection('institution')}
          />
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          {scopedFacultyId && scopedFaculty && section === 'faculties' ? (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-primary-200 bg-primary-50/70 px-4 py-3 text-sm text-primary-900">
              <span>
                Managing <strong>{scopedFaculty.name}</strong> ({scopedFaculty.code}) — assign faculty administrators here.
                Branding and departments are handled by the faculty admin in their workspace.
              </span>
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="ml-auto text-xs font-semibold text-primary-800 hover:underline"
              >
                Clear scope
              </button>
            </div>
          ) : null}

          {loading && section === 'overview' ? (
            <div className="ula-dept-surface flex min-h-[40vh] items-center justify-center">
              <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                <i className="fa-solid fa-spinner fa-spin text-primary-700" aria-hidden />
                Loading platform control…
              </p>
            </div>
          ) : error && section === 'overview' ? (
            <div className="ula-dept-surface border-red-200 bg-red-50/80 p-8 text-center text-red-900">{error}</div>
          ) : (
            <>
              {section === 'overview' ? (
                <AdminOverview
                  data={overview}
                  onManageFaculties={() => setSection('faculties')}
                  onSelectFaculty={onFacultySelected}
                />
              ) : null}
              {section === 'faculties' ? (
                <FacultyManagement
                  selectedFacultyId={scopedFacultyId}
                  onSelectFaculty={onFacultySelected}
                  onRefresh={onFacultyRefresh}
                />
              ) : null}
              {section === 'resources' ? <ArmResourcesTeam /> : null}
              {section === 'institution' ? (
                <div className="ula-dept-animate-in max-w-3xl">
                  <header className="mb-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Branding</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-900">Institution identity</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      University-wide logo, name, and tagline — applied on browse, login, and every workspace header.
                    </p>
                  </header>
                  <InstitutionBrandingPanel />
                </div>
              ) : null}
            </>
          )}
        </main>

        <footer className="border-t border-slate-100 px-6 py-3 text-center text-[10px] text-slate-400">
          ULA · TEAM 5IRE · Institutional admin · Faculty workspace is separate (faculty administrators only)
        </footer>
      </div>
    </div>
  );
}

