import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type {
  DepartmentSection,
  DeptCourse,
  DeptInvitation,
  DeptLecturer,
  DeptOverview,
  DeptResource,
} from '../../lib/department';
import { DepartmentOverview } from '../../components/department/DepartmentOverview';
import { DepartmentLecturers } from '../../components/department/DepartmentLecturers';
import { DepartmentCatalog } from '../../components/department/DepartmentCatalog';
import { DepartmentResources } from '../../components/department/DepartmentResources';
import { DepartmentAnalytics } from '../../components/department/DepartmentAnalytics';
import { DepartmentNotices } from '../../components/department/DepartmentNotices';
import { DepartmentVerification } from '../../components/department/DepartmentVerification';
import { DepartmentAuditTrail } from '../../components/department/DepartmentAuditTrail';
import type { DeptAuditEntry } from '../../lib/department';
import { DepartmentBrandingPanel } from '../../components/settings/DepartmentBrandingPanel';
import { InstitutionHeaderMark } from '../../components/InstitutionBrand';
import { WorkspaceBrandHeader } from '../../components/WorkspaceBrandHeader';
import { WorkspaceSidebarAccount } from '../../components/WorkspaceSidebarAccount';
import { UserProfileChip } from '../../components/UserProfileChip';
import { useLogoPlacement } from '../../context/BrandingContext';
import '../../styles/department-workspace.css';
import '../../styles/identity-settings.css';

const NAV: { id: DepartmentSection; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'fa-gauge-high' },
  { id: 'audit', label: 'Audit trail', icon: 'fa-list-check' },
  { id: 'lecturers', label: 'People', icon: 'fa-chalkboard-user' },
  { id: 'courses', label: 'Catalog', icon: 'fa-book' },
  { id: 'resources', label: 'Resources', icon: 'fa-folder-tree' },
  { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' },
  { id: 'notices', label: 'Department Notices', icon: 'fa-bullhorn' },
  { id: 'verification', label: 'Verification', icon: 'fa-shield-check' },
  { id: 'settings', label: 'Settings', icon: 'fa-gear' },
];

export function DepartmentWorkspace() {
  const { user, refresh: refreshAuth } = useAuth();
  const logoPlacement = useLogoPlacement();
  const [section, setSection] = useState<DepartmentSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [openAddLecturer, setOpenAddLecturer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<DeptOverview | null>(null);
  const [lecturers, setLecturers] = useState<DeptLecturer[]>([]);
  const [invitations, setInvitations] = useState<DeptInvitation[]>([]);
  const [courses, setCourses] = useState<DeptCourse[]>([]);
  const [resources, setResources] = useState<DeptResource[]>([]);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof loadAnalytics>> | null>(null);
  const [notices, setNotices] = useState<
    { id: string; title: string; body: string; createdAt: string; createdBy: { fullName: string } }[]
  >([]);
  const [verification, setVerification] = useState<
    {
      id: string;
      title: string;
      kind: string;
      governanceStatus: string;
      createdAt: string;
      uploadedBy: { fullName: string };
      course: { code: string };
    }[]
  >([]);

  async function loadAnalytics() {
    return api<{
      activeLecturers: number;
      uploadFrequency30d: number;
      publicationTrend: { period: string; count: number }[];
      topCourses: { id: string; code: string; title: string; resourceCount: number; recentUploads: number }[];
      governanceBreakdown: { status: string; count: number }[];
      resourceGrowth: number;
    }>('/api/department/analytics');
  }

  const refresh = useCallback(async () => {
    const [ov, lec, crs, res, an, nt, vq] = await Promise.all([
      api<DeptOverview>('/api/department/overview'),
      api<{ lecturers: DeptLecturer[]; invitations: DeptInvitation[] }>('/api/department/lecturers'),
      api<DeptCourse[]>('/api/department/courses'),
      api<DeptResource[]>('/api/department/resources'),
      loadAnalytics(),
      api<typeof notices>('/api/department/notices'),
      api<typeof verification>('/api/department/verification'),
    ]);
    setOverview(ov);
    setLecturers(lec.lecturers);
    setInvitations(lec.invitations ?? []);
    setCourses(crs);
    setResources(res);
    setAnalytics(an);
    setNotices(nt);
    setVerification(vq);
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load department workspace');
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const sectionTitle = NAV.find((n) => n.id === section)?.label ?? 'Governance';
  const deptName = user?.department?.name ?? 'Department';
  const notificationCount =
    invitations.filter((inv) => inv.status === 'PENDING').length + verification.length;

  function openPeopleSection(openWizard = false) {
    setSection('lecturers');
    if (openWizard) setOpenAddLecturer(true);
  }

  return (
    <div className="ula-dept-root flex min-h-dvh">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-slate-900/30 lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className="ula-dept-sidebar flex shrink-0 flex-col" data-open={sidebarOpen}>
        <WorkspaceBrandHeader subtitle="Department governance" accentClass="text-[#0f4c81]" />

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Department navigation">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={section === item.id}
              className="ula-dept-nav-item"
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

        <WorkspaceSidebarAccount
          roleLabel={user?.role === 'HOD' ? 'Head of Department' : 'Department Admin'}
        />
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
              TEAM 5IRE · Academic Infrastructure
            </p>
            <h1 className="truncate text-base font-semibold text-slate-900">{sectionTitle}</h1>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <div className="relative">
              <i
                className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search lecturers…"
                className="ula-dept-search w-52"
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                onFocus={() => openPeopleSection(false)}
              />
            </div>
          </div>

          <button
            type="button"
            className="hidden rounded-xl bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white sm:inline-flex"
            onClick={() => openPeopleSection(true)}
          >
            <i className="fa-solid fa-user-plus mr-1.5" aria-hidden />
            Add lecturer
          </button>

          <button
            type="button"
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-50"
            aria-label={`Notifications${notificationCount ? ` (${notificationCount})` : ''}`}
            onClick={() =>
              setSection(
                verification.length > 0 ? 'verification' : notificationCount > 0 ? 'lecturers' : 'notices',
              )
            }
          >
            <i className="fa-regular fa-bell text-lg" aria-hidden />
            {notificationCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            ) : null}
          </button>

          {logoPlacement === 'right' ? <InstitutionHeaderMark className="hidden sm:flex" /> : null}
          <UserProfileChip
            name={user?.fullName ?? 'Admin'}
            subtitle={deptName}
            imageUrl={user?.profilePhotoUrl}
            compact
            showSettings={false}
            profileActionLabel="Department branding"
            onOpenProfile={() => setSection('settings')}
          />
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          {loading ? (
            <div className="ula-dept-surface flex min-h-[40vh] items-center justify-center">
              <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                <i className="fa-solid fa-spinner fa-spin text-[#0f4c81]" aria-hidden />
                Loading governance workspace…
              </p>
            </div>
          ) : error ? (
            <div className="ula-dept-surface border-red-200 bg-red-50/80 p-8 text-center text-red-900">{error}</div>
          ) : (
            <>
              {section === 'overview' ? (
                <DepartmentOverview
                  data={overview}
                  loading={false}
                  deptName={deptName}
                  hodName={user?.fullName?.split(' ')[0] ?? 'HOD'}
                  onNavigate={setSection}
                />
              ) : null}

              {section === 'audit' ? (
                <DepartmentAuditTrail
                  entries={
                    (overview?.auditLog ??
                      overview?.activity?.map((a) => ({
                        id: a.id,
                        category: (a.type === 'upload'
                          ? 'publish'
                          : a.type === 'invite'
                            ? 'invite'
                            : 'lecturer') as DeptAuditEntry['category'],
                        title: a.label,
                        description: a.meta,
                        actor: '—',
                        reference: '',
                        status: 'ACTIVE',
                        at: a.at,
                      })) ??
                      []) as DeptAuditEntry[]
                  }
                />
              ) : null}

              {section === 'lecturers' ? (
                <DepartmentLecturers
                  lecturers={lecturers}
                  invitations={invitations}
                  loading={false}
                  searchQuery={peopleSearch}
                  onSearchChange={setPeopleSearch}
                  openWizard={openAddLecturer}
                  onWizardOpenChange={setOpenAddLecturer}
                  onRefresh={() => void refresh()}
                />
              ) : null}

              {section === 'courses' ? (
                <DepartmentCatalog courses={courses} loading={false} />
              ) : null}

              {section === 'resources' ? (
                <DepartmentResources resources={resources} loading={false} onRefresh={() => void refresh()} />
              ) : null}

              {section === 'analytics' ? (
                <DepartmentAnalytics data={analytics} loading={false} />
              ) : null}

              {section === 'notices' ? (
                <DepartmentNotices notices={notices} loading={false} onRefresh={() => void refresh()} />
              ) : null}

              {section === 'verification' ? (
                <DepartmentVerification queue={verification} loading={false} onRefresh={() => void refresh()} />
              ) : null}

              {section === 'settings' ? <DepartmentBrandingPanel /> : null}
            </>
          )}
        </main>

        <footer className="border-t border-slate-100 px-6 py-3 text-center text-[10px] text-slate-400">
          ULA · Built under TEAM 5IRE · Learning · Collaboration · Impact
        </footer>
      </div>
    </div>
  );
}
