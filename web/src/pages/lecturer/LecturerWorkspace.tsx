import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  type LecturerCourse,
  type LecturerResource,
  type LecturerSection,
} from '../../lib/lecturer';
import { LecturerDashboardHome } from '../../components/lecturer/LecturerDashboardHome';
import { LecturerAnalytics } from '../../components/lecturer/LecturerAnalytics';
import { LecturerResourceLibrary } from '../../components/lecturer/LecturerResourceLibrary';
import { PublishWizard } from '../../components/lecturer/PublishWizard';
import { LecturerContributors } from '../../components/lecturer/LecturerContributors';
import { LecturerSuggestionInbox } from '../../components/lecturer/LecturerSuggestionInbox';
import { LecturerAssignments } from '../../components/lecturer/LecturerAssignments';
import { LecturerProfilePanel } from '../../components/settings/LecturerProfilePanel';
import { IdentityAvatar } from '../../components/IdentityAvatar';
import { InstitutionHeaderMark } from '../../components/InstitutionBrand';
import { WorkspaceBrandHeader } from '../../components/WorkspaceBrandHeader';
import { WorkspaceSidebarAccount } from '../../components/WorkspaceSidebarAccount';
import { UserProfileChip } from '../../components/UserProfileChip';
import { useLogoPlacement } from '../../context/BrandingContext';
import type { SettingsContext } from '../../lib/settings';
import '../../styles/lecturer-workspace.css';
import '../../styles/student-contribute.css';
import '../../styles/identity-settings.css';

type NavItem = { id: LecturerSection; label: string; icon: string };

// Ordered by daily priority: teach first, then content, then student interactions.
const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [{ id: 'dashboard', label: 'Home', icon: 'fa-house' }],
  },
  {
    label: 'Teaching',
    items: [
      { id: 'publish', label: 'Publish material', icon: 'fa-cloud-arrow-up' },
      { id: 'assignments', label: 'Assignments', icon: 'fa-clipboard-list' },
      { id: 'library', label: 'My materials', icon: 'fa-folder-open' },
    ],
  },
  {
    label: 'Students',
    items: [
      { id: 'inbox', label: 'Inbox', icon: 'fa-inbox' },
      { id: 'contributors', label: 'Contributors', icon: 'fa-user-check' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' },
      { id: 'settings', label: 'Settings', icon: 'fa-gear' },
    ],
  },
];

const SECTION_TITLES: Partial<Record<LecturerSection, string>> = {
  ...Object.fromEntries(NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.label]))),
  profile: 'My profile',
};

export function LecturerWorkspace() {
  const { user, refresh: refreshAuth } = useAuth();
  const logoPlacement = useLogoPlacement();
  const [section, setSection] = useState<LecturerSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [courses, setCourses] = useState<LecturerCourse[]>([]);
  const [resources, setResources] = useState<LecturerResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inboxPending, setInboxPending] = useState(0);
  const [identity, setIdentity] = useState<SettingsContext['profile'] | null>(null);

  const profilePhoto = user?.profilePhotoUrl ?? identity?.profilePhotoUrl ?? null;
  const profileBanner = user?.bannerUrl ?? identity?.bannerUrl ?? null;
  const profileBio = user?.bio ?? identity?.bio ?? null;

  const refresh = useCallback(async () => {
    const [c, r] = await Promise.all([
      api<LecturerCourse[]>('/api/meta/my-courses'),
      api<LecturerResource[]>('/api/resources/mine'),
    ]);
    setCourses(c);
    setResources(r);
    try {
      const inbox = await api<{ id: string }[]>('/api/suggestions/lecturer/inbox?status=PENDING');
      setInboxPending(inbox.length);
    } catch {
      setInboxPending(0);
    }
  }, []);

  const loadIdentity = useCallback(async () => {
    await refreshAuth();
    try {
      const ctx = await api<SettingsContext>('/api/settings/context');
      setIdentity(ctx.profile);
    } catch {
      /* optional */
    }
  }, [refreshAuth]);

  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  useEffect(() => {
    if (section === 'settings' || section === 'profile') void loadIdentity();
  }, [section, loadIdentity]);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load workspace');
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  async function handleDelete(id: string) {
    try {
      await api(`/api/resources/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const sectionTitle = SECTION_TITLES[section] ?? 'Workspace';

  return (
    <div className="ula-lecturer-root flex min-h-dvh">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-dark-900/30 lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className="ula-lecturer-sidebar flex shrink-0 flex-col" data-open={sidebarOpen}>
        <WorkspaceBrandHeader subtitle="Lecturer workspace" accentClass="text-primary-600" />

        <nav className="flex-1 space-y-5 overflow-y-auto p-3" aria-label="Lecturer navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.label ?? 'top'}>
              {group.label ? (
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-dark-400">
                  {group.label}
                </p>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-active={section === item.id}
                    className="ula-lecturer-nav-item"
                    onClick={() => {
                      setSection(item.id);
                      setSidebarOpen(false);
                    }}
                  >
                    <i className={`fa-solid ${item.icon} w-4 text-center text-[13px] opacity-80`} aria-hidden />
                    <span className="flex flex-1 items-center justify-between gap-2">
                      {item.label}
                      {item.id === 'inbox' && inboxPending > 0 ? (
                        <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {inboxPending}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <WorkspaceSidebarAccount roleLabel="Lecturer" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[var(--lw-header)] items-center gap-4 border-b border-dark-100/80 bg-white/80 px-4 backdrop-blur-md md:px-8">
          <button
            type="button"
            className="rounded-lg p-2 text-dark-600 hover:bg-dark-50 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <i className="fa-solid fa-bars" aria-hidden />
          </button>
          {logoPlacement === 'left' ? <InstitutionHeaderMark className="hidden sm:flex" /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-dark-400">TEAM 5IRE · ULA</p>
            <h1 className="truncate text-[15px] font-semibold text-dark-900 md:text-base">{sectionTitle}</h1>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <div className="relative">
              <i
                className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-dark-400"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search workspace…"
                className="w-48 rounded-lg border-0 bg-dark-50 py-2 pl-9 pr-3 text-[13px] ring-1 ring-dark-200/60 lg:w-56"
                onFocus={() => setSection('library')}
              />
            </div>
          </div>
          <button
            type="button"
            className="relative rounded-lg p-2 text-dark-500 hover:bg-dark-50"
            aria-label="Notifications"
          >
            <i className="fa-regular fa-bell text-[17px]" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setSection('publish')}
            className="hidden rounded-xl bg-primary-800 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-900 sm:inline-flex"
          >
            Publish
          </button>
          {logoPlacement === 'right' ? <InstitutionHeaderMark className="hidden sm:flex" /> : null}
          <UserProfileChip
            name={user?.fullName ?? 'Lecturer'}
            subtitle={user?.department?.name}
            imageUrl={profilePhoto}
            compact
            priority
            showSettings={false}
            profileActionLabel="My profile"
            onOpenProfile={() => setSection('profile')}
          />
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 lg:px-10">
          {loading ? (
            <div className="ula-lecturer-surface flex min-h-[40vh] items-center justify-center">
              <p className="inline-flex items-center gap-2 text-[14px] text-dark-500">
                <i className="fa-solid fa-spinner fa-spin text-primary-600" aria-hidden />
                Loading workspace…
              </p>
            </div>
          ) : error ? (
            <div className="ula-lecturer-surface border-red-200/80 bg-red-50/50 p-8 text-center text-red-900">
              {error}
            </div>
          ) : (
            <>
              {section === 'dashboard' ? (
                <LecturerDashboardHome
                  fullName={user?.fullName ?? 'Lecturer'}
                  email={user?.email}
                  departmentName={user?.department?.name}
                  profilePhotoUrl={profilePhoto}
                  bannerUrl={profileBanner}
                  bio={profileBio}
                  courses={courses}
                  resources={resources}
                  onPublish={() => setSection('publish')}
                  onAssignments={() => setSection('assignments')}
                  onLibrary={() => setSection('library')}
                  onEditIdentity={() => setSection('settings')}
                />
              ) : null}

              {section === 'assignments' ? (
                <LecturerAssignments courses={courses} departmentName={user?.department?.name} />
              ) : null}

              {section === 'publish' ? (
                <PublishWizard
                  courses={courses}
                  departmentName={user?.department?.name}
                  onPublished={() => void refresh()}
                />
              ) : null}

              {section === 'contributors' ? <LecturerContributors /> : null}

              {section === 'inbox' ? (
                <LecturerSuggestionInbox onPublished={() => void refresh()} />
              ) : null}

              {section === 'library' ? (
                <LecturerResourceLibrary resources={resources} onDelete={handleDelete} />
              ) : null}

              {section === 'analytics' ? (
                <LecturerAnalytics resources={resources} courses={courses} />
              ) : null}

              {section === 'profile' ? (
                <div className="ula-lecturer-surface max-w-xl p-8 animate-in">
                  <div className="flex items-start gap-4">
                    <IdentityAvatar name={user?.fullName ?? 'Lecturer'} imageUrl={profilePhoto} size="lg" />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-semibold text-dark-900">{user?.fullName}</h2>
                      <p className="mt-1 text-[14px] text-dark-500">{user?.email}</p>
                      {user?.bio ? (
                        <p className="mt-3 text-[14px] leading-relaxed text-dark-600">{user.bio}</p>
                      ) : null}
                      <Link
                        to="/settings"
                        className="mt-4 inline-flex rounded-xl border border-dark-200 px-4 py-2 text-[13px] font-medium text-dark-700 hover:bg-dark-50"
                      >
                        Edit photo & identity
                      </Link>
                    </div>
                  </div>
                  <dl className="mt-8 space-y-4 border-t border-dark-100 pt-6 text-[14px]">
                    <div>
                      <dt className="text-dark-400">Role</dt>
                      <dd className="font-medium text-dark-900">Lecturer</dd>
                    </div>
                    <div>
                      <dt className="text-dark-400">Department</dt>
                      <dd className="font-medium text-dark-900">{user?.department?.name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-dark-400">Faculty</dt>
                      <dd className="font-medium text-dark-900">{user?.department?.faculty.name ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {section === 'settings' ? (
                <LecturerProfilePanel onChange={() => void loadIdentity()} />
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
