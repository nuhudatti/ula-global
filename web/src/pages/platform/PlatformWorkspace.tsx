import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { BackupManagement } from '../../components/admin/BackupManagement';
import { PlatformAuditLog } from '../../components/platform/PlatformAuditLog';
import { PlatformDashboard } from '../../components/platform/PlatformDashboard';
import { PlatformMonitoring } from '../../components/platform/PlatformMonitoring';
import { PlatformSettings } from '../../components/platform/PlatformSettings';
import { TenantManagement } from '../../components/platform/TenantManagement';
import { getPlatformToken, platformApi, setPlatformToken } from '../../lib/platformApi';
import '../../styles/platform-workspace.css';

type Section = 'overview' | 'tenants' | 'backup' | 'monitoring' | 'settings' | 'audit';

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'fa-gauge-high' },
  { id: 'tenants', label: 'Institutions', icon: 'fa-building-columns' },
  { id: 'backup', label: 'Backup & recovery', icon: 'fa-database' },
  { id: 'monitoring', label: 'Monitoring', icon: 'fa-heart-pulse' },
  { id: 'settings', label: 'Platform settings', icon: 'fa-sliders' },
  { id: 'audit', label: 'Audit log', icon: 'fa-clipboard-list' },
];

export function PlatformWorkspace() {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('overview');
  const [operatorName, setOperatorName] = useState('Platform Operator');

  const load = useCallback(async () => {
    const me = await platformApi<{ fullName: string }>('/api/platform/auth/me');
    setOperatorName(me.fullName);
  }, []);

  useEffect(() => {
    if (!getPlatformToken()) return;
    void load().catch(() => {
      setPlatformToken(null);
      navigate('/platform/login', { replace: true });
    });
  }, [load, navigate]);

  if (!getPlatformToken()) return <Navigate to="/platform/login" replace />;

  function signOut() {
    setPlatformToken(null);
    navigate('/platform/login', { replace: true });
  }

  return (
    <div className="ula-platform-root flex min-h-dvh w-full max-w-[100vw] overflow-x-hidden">
      <aside className="ula-platform-sidebar flex shrink-0 flex-col p-4">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">ULA Global</p>
          <h1 className="mt-1 text-lg font-semibold text-white">Platform Ops</h1>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={section === item.id}
              className="ula-platform-nav-item"
              onClick={() => setSection(item.id)}
            >
              <i className={`fa-solid ${item.icon} w-4 text-center text-xs`} aria-hidden />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-4 text-xs text-slate-400">
          <p className="font-medium text-slate-200">{operatorName}</p>
          <button type="button" onClick={signOut} className="mt-2 text-slate-400 hover:text-white">
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-8">
        {section === 'overview' ? <PlatformDashboard /> : null}
        {section === 'tenants' ? <TenantManagement /> : null}
        {section === 'backup' ? <BackupManagement /> : null}
        {section === 'monitoring' ? <PlatformMonitoring /> : null}
        {section === 'settings' ? <PlatformSettings /> : null}
        {section === 'audit' ? <PlatformAuditLog /> : null}
      </main>
    </div>
  );
}
