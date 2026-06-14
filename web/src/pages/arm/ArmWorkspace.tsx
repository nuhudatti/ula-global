import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTenantPaths } from '../../hooks/useTenantPaths';
import { ArmPublishWizard } from '../../components/arm/ArmPublishWizard';
import { ArmResourceLibrary } from '../../components/arm/ArmResourceLibrary';
import { InstitutionHeaderMark } from '../../components/InstitutionBrand';
import { WorkspaceBrandHeader } from '../../components/WorkspaceBrandHeader';
import { WorkspaceSidebarAccount } from '../../components/WorkspaceSidebarAccount';
import { UserProfileChip } from '../../components/UserProfileChip';
import { useLogoPlacement } from '../../context/BrandingContext';
import type { ArmResource, ArmSection } from '../../lib/arm';
import '../../styles/lecturer-workspace.css';

const NAV: { id: ArmSection; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: 'fa-house' },
  { id: 'publish', label: 'Publish resource', icon: 'fa-cloud-arrow-up' },
  { id: 'library', label: 'Institution library', icon: 'fa-books' },
];

export function ArmWorkspace() {
  const { user } = useAuth();
  const paths = useTenantPaths();
  const logoPlacement = useLogoPlacement();
  const [section, setSection] = useState<ArmSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({ total: 0, published: 0, archived: 0 });
  const [loading, setLoading] = useState(true);

  const roleLabel =
    user?.role === 'INSTITUTION_ADMIN' || user?.role === 'SUPER_ADMIN'
      ? 'Institution Admin · Resources'
      : 'Academic Resources Manager';

  const refresh = useCallback(async () => {
    const res = await api<{ items: ArmResource[]; total: number }>('/api/arm/resources?take=100');
    const published = res.items.filter((r) => r.governanceStatus === 'VERIFIED' || r.governanceStatus === 'PUBLISHED').length;
    const archived = res.items.filter((r) => r.governanceStatus === 'ARCHIVED').length;
    setStats({ total: res.total, published, archived });
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const sectionTitle = NAV.find((n) => n.id === section)?.label ?? 'Resources';

  return (
    <div className="ula-lecturer-root ula-dept-root flex min-h-dvh">
      {sidebarOpen ? (
        <button type="button" className="fixed inset-0 z-50 bg-slate-900/30 lg:hidden" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <aside className="ula-lecturer-sidebar ula-dept-sidebar flex shrink-0 flex-col" data-open={sidebarOpen}>
        <WorkspaceBrandHeader subtitle="Academic resources" accentClass="text-primary-700" />

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Resources navigation">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={section === item.id}
              className="ula-lecturer-nav-item ula-dept-nav-item"
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

        <div className="border-t border-slate-100 p-3">
          <Link to={paths.home} className="ula-lecturer-nav-item text-[13px] text-primary-800">
            <i className="fa-solid fa-compass w-4 text-center" aria-hidden />
            Student browse
          </Link>
        </div>

        <WorkspaceSidebarAccount roleLabel={roleLabel} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[var(--lw-header)] items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur-md md:px-8">
          <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-50 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <i className="fa-solid fa-bars" aria-hidden />
          </button>
          {logoPlacement === 'left' ? <InstitutionHeaderMark className="hidden sm:flex" /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-700">Institution resources</p>
            <h1 className="truncate text-base font-semibold text-slate-900">{sectionTitle}</h1>
          </div>
          <button
            type="button"
            className="hidden rounded-xl bg-primary-700 px-4 py-2 text-xs font-semibold text-white sm:inline-flex"
            onClick={() => setSection('publish')}
          >
            <i className="fa-solid fa-cloud-arrow-up mr-1.5" aria-hidden />
            Publish
          </button>
          {logoPlacement === 'right' ? <InstitutionHeaderMark className="hidden sm:flex" /> : null}
          <UserProfileChip name={user?.fullName ?? 'Manager'} subtitle={roleLabel} imageUrl={user?.profilePhotoUrl} compact showSettings={false} />
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          {section === 'dashboard' ? (
            <div className="space-y-6 animate-in">
              <header>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-700">Scale faster</p>
                <h2 className="mt-1 text-2xl font-semibold text-dark-900">Academic resources workspace</h2>
                <p className="mt-2 max-w-2xl text-[14px] text-dark-500">
                  Upload past questions, lecture notes, handouts, and lab manuals for any faculty. Students and lecturers see published materials automatically on browse.
                </p>
              </header>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'Total resources', value: loading ? '…' : stats.total, icon: 'fa-books' },
                  { label: 'Published', value: loading ? '…' : stats.published, icon: 'fa-circle-check' },
                  { label: 'Archived', value: loading ? '…' : stats.archived, icon: 'fa-box-archive' },
                ].map((card) => (
                  <div key={card.label} className="ula-lecturer-surface p-5">
                    <i className={`fa-solid ${card.icon} text-primary-700`} aria-hidden />
                    <p className="mt-3 text-2xl font-semibold text-dark-900">{card.value}</p>
                    <p className="text-[13px] text-dark-500">{card.label}</p>
                  </div>
                ))}
              </div>
              <div className="ula-lecturer-surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-dark-900">Ready to publish?</h3>
                  <p className="mt-1 text-[13px] text-dark-500">Select faculty → department → level → semester → course, then upload.</p>
                </div>
                <button type="button" className="rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white" onClick={() => setSection('publish')}>
                  Start publishing
                </button>
              </div>
            </div>
          ) : null}

          {section === 'publish' ? <ArmPublishWizard onPublished={() => void refresh()} /> : null}
          {section === 'library' ? <ArmResourceLibrary refreshKey={refreshKey} onChanged={() => void refresh()} /> : null}
        </main>
      </div>
    </div>
  );
}
