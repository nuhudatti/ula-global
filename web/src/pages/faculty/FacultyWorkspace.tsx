import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type {
  FacultyAnalytics,
  FacultyAuditEntry,
  FacultyCatalogCourse,
  FacultyDepartment,
  FacultyOverview,
  FacultyPendingInvite,
  FacultyPerson,
  FacultySection,
} from '../../lib/faculty';
import { FacultyOverview as FacultyOverviewPanel } from '../../components/faculty/FacultyOverview';
import { FacultyDepartments } from '../../components/faculty/FacultyDepartments';
import { FacultyPeople } from '../../components/faculty/FacultyPeople';
import { FacultyCatalog } from '../../components/faculty/FacultyCatalog';
import { FacultyAnalyticsPanel } from '../../components/faculty/FacultyAnalytics';
import { FacultyAuditTrail } from '../../components/faculty/FacultyAuditTrail';
import { FacultyBrandingPanel } from '../../components/settings/FacultyBrandingPanel';
import { InstitutionHeaderMark } from '../../components/InstitutionBrand';
import { WorkspaceBrandHeader } from '../../components/WorkspaceBrandHeader';
import { WorkspaceSidebarAccount } from '../../components/WorkspaceSidebarAccount';
import { UserProfileChip } from '../../components/UserProfileChip';
import { useLogoPlacement } from '../../context/BrandingContext';
import '../../styles/department-workspace.css';
import '../../styles/faculty-workspace.css';
import '../../styles/identity-settings.css';
import '../../styles/institution-brand.css';

const NAV: { id: FacultySection; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'fa-gauge-high' },
  { id: 'departments', label: 'Departments', icon: 'fa-building-columns' },
  { id: 'people', label: 'Department leaders', icon: 'fa-user-tie' },
  { id: 'catalog', label: 'Knowledge archive', icon: 'fa-book' },
  { id: 'analytics', label: 'Institution intelligence', icon: 'fa-chart-line' },
  { id: 'audit', label: 'Governance timeline', icon: 'fa-clock-rotate-left' },
  { id: 'settings', label: 'Settings', icon: 'fa-gear' },
];

export function FacultyWorkspace() {
  const { user } = useAuth();
  const logoPlacement = useLogoPlacement();
  const [section, setSection] = useState<FacultySection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<FacultyOverview | null>(null);
  const [departments, setDepartments] = useState<FacultyDepartment[]>([]);
  const [people, setPeople] = useState<FacultyPerson[]>([]);
  const [pendingInvites, setPendingInvites] = useState<FacultyPendingInvite[]>([]);
  const [facultyContextName, setFacultyContextName] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<FacultyCatalogCourse[]>([]);
  const [analytics, setAnalytics] = useState<FacultyAnalytics | null>(null);
  const [audit, setAudit] = useState<FacultyAuditEntry[]>([]);

  const refreshDepartments = useCallback(async () => {
    const depts = await api<FacultyDepartment[]>('/api/faculty/departments');
    setDepartments(depts);
  }, []);

  const refreshLeaders = useCallback(async () => {
    const ppl = await api<{
      people: FacultyPerson[];
      pendingInvites: FacultyPendingInvite[];
    }>('/api/faculty/people');
    setPeople(ppl.people);
    setPendingInvites(ppl.pendingInvites);
  }, []);

  const refresh = useCallback(async () => {
    const [ctx, ov, depts, ppl, cat, an, aud] = await Promise.all([
      api<{ faculty: { name: string } }>('/api/faculty/context'),
      api<FacultyOverview>('/api/faculty/overview'),
      api<FacultyDepartment[]>('/api/faculty/departments'),
      api<{
        people: FacultyPerson[];
        pendingInvites: FacultyPendingInvite[];
      }>('/api/faculty/people'),
      api<FacultyCatalogCourse[]>('/api/faculty/catalog'),
      api<FacultyAnalytics>('/api/faculty/analytics'),
      api<FacultyAuditEntry[]>('/api/faculty/audit'),
    ]);

    setFacultyContextName(ctx.faculty.name);
    setOverview(ov);
    setDepartments(depts);
    setPeople(ppl.people);
    setPendingInvites(ppl.pendingInvites);
    setCatalog(cat);
    setAnalytics(an);
    setAudit(aud);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load faculty workspace');
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const facultyName = useMemo(() => {
    if (facultyContextName) return facultyContextName;
    return user?.faculty?.name ?? user?.department?.faculty?.name ?? 'Faculty';
  }, [facultyContextName, user?.faculty?.name, user?.department?.faculty?.name]);

  const sectionTitle = NAV.find((n) => n.id === section)?.label ?? 'Faculty';

  return (
    <div className="ula-faculty-root ula-dept-root flex min-h-dvh">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-slate-900/30 lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className="ula-faculty-sidebar ula-dept-sidebar flex shrink-0 flex-col" data-open={sidebarOpen}>
        <WorkspaceBrandHeader subtitle="Faculty governance" accentClass="text-[#0f4c81]" />

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Faculty navigation">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={section === item.id}
              className="ula-faculty-nav-item ula-dept-nav-item"
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

        <WorkspaceSidebarAccount roleLabel="Faculty Administrator" />
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0f4c81]">
              TEAM 5IRE · Faculty command
            </p>
            <h1 className="truncate text-base font-semibold text-slate-900">{sectionTitle}</h1>
          </div>
          <button
            type="button"
            className="hidden rounded-xl bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white sm:inline-flex"
            onClick={() => setSection('departments')}
          >
            <i className="fa-solid fa-plus mr-1.5" aria-hidden />
            Add department
          </button>
          {logoPlacement === 'right' ? <InstitutionHeaderMark className="hidden sm:flex" /> : null}
          <UserProfileChip
            name={user?.fullName ?? 'Admin'}
            subtitle={facultyName}
            imageUrl={user?.profilePhotoUrl}
            compact
            showSettings={false}
            profileActionLabel="Faculty branding"
            onOpenProfile={() => setSection('settings')}
          />
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
          {loading ? (
            <div className="ula-dept-surface flex min-h-[40vh] items-center justify-center">
              <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                <i className="fa-solid fa-spinner fa-spin text-[#0f4c81]" aria-hidden />
                Loading faculty command…
              </p>
            </div>
          ) : error ? (
            <div className="ula-dept-surface border-red-200 bg-red-50/80 p-8 text-center text-red-900">{error}</div>
          ) : (
            <>
              {section === 'overview' ? (
                <FacultyOverviewPanel
                  data={overview}
                  loading={false}
                  facultyName={facultyName}
                  adminName={user?.fullName?.split(' ')[0] ?? 'Dean'}
                  onNavigate={setSection}
                />
              ) : null}
              {section === 'departments' ? (
                <FacultyDepartments
                  departments={departments}
                  loading={false}
                  onRefreshDepartments={refreshDepartments}
                  onRefreshLeaders={refreshLeaders}
                />
              ) : null}
              {section === 'people' ? (
                <FacultyPeople
                  people={people}
                  pendingInvites={pendingInvites}
                  loading={false}
                  onRefresh={refreshLeaders}
                />
              ) : null}
              {section === 'catalog' ? (
                <FacultyCatalog courses={catalog} departments={departments} loading={false} />
              ) : null}
              {section === 'analytics' ? (
                <FacultyAnalyticsPanel data={analytics} loading={false} />
              ) : null}
              {section === 'audit' ? (
                <FacultyAuditTrail entries={audit} />
              ) : null}
              {section === 'settings' ? <FacultyBrandingPanel /> : null}
            </>
          )}
        </main>

        <footer className="border-t border-slate-100 px-6 py-3 text-center text-[10px] text-slate-400">
          ULA · TEAM 5IRE · Faculty governance · {facultyName}
        </footer>
      </div>
    </div>
  );
}
