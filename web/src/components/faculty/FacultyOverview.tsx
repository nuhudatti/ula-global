import type { FacultyAuditEntry, FacultyOverview, FacultySection } from '../../lib/faculty';

function formatWhen(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function streamIcon(category: string) {
  if (category === 'publish') return 'fa-file-arrow-up';
  if (category === 'invite') return 'fa-envelope';
  if (category === 'suggestion') return 'fa-user-graduate';
  if (category === 'governance') return 'fa-building';
  return 'fa-circle-dot';
}

export function FacultyOverview({
  data,
  loading,
  facultyName,
  adminName,
  onNavigate,
}: {
  data: FacultyOverview | null;
  loading: boolean;
  facultyName: string;
  adminName: string;
  onNavigate: (s: FacultySection) => void;
}) {
  if (loading || !data) {
    return (
      <div className="ula-dept-v2 space-y-5 max-w-5xl">
        <div className="ula-dept-v2-hero ula-dept-skeleton h-32" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="ula-dept-v2-kpi ula-dept-skeleton h-24" />
          ))}
        </div>
      </div>
    );
  }

  const { stats } = data;
  const recent: FacultyAuditEntry[] = (data.auditLog ?? []).slice(0, 3);

  const metrics = [
    { label: 'Departments', value: stats.departments, section: 'departments' as const },
    { label: 'Department leaders', value: stats.hods, section: 'people' as const },
    { label: 'Archive courses', value: stats.courses, section: 'catalog' as const },
    { label: 'Live assets', value: stats.liveResources, section: 'catalog' as const },
  ];

  const actions = [
    { label: 'Add department', icon: 'fa-plus', section: 'departments' as const },
    { label: 'Manage departments', icon: 'fa-building-columns', section: 'departments' as const },
    { label: 'Knowledge archive', icon: 'fa-book', section: 'catalog' as const },
    { label: 'Intelligence', icon: 'fa-chart-line', section: 'analytics' as const },
  ];

  return (
    <div className="ula-dept-v2 ula-dept-animate-in w-full max-w-6xl">
      <header className="ula-dept-v2-hero">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f4c81]">
          Faculty intelligence
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Hello, {adminName}</h2>
        <p className="mt-1 text-sm text-slate-500">{facultyName}</p>
        {stats.growthPct > 0 ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            <i className="fa-solid fa-arrow-trend-up text-[10px]" aria-hidden />
            {stats.growthPct}% archive expansion (30d)
          </p>
        ) : null}
      </header>

      <section aria-label="Governance metrics">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((m) => (
            <button key={m.label} type="button" onClick={() => onNavigate(m.section)} className="ula-dept-v2-kpi group">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{m.value}</p>
              <p className="mt-2 text-[11px] font-medium text-[#0f4c81] opacity-0 transition-opacity group-hover:opacity-100">
                Open →
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="ula-dept-v2-panel">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Governance actions</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {actions.map((a) => (
            <button key={a.label} type="button" onClick={() => onNavigate(a.section)} className="ula-dept-v2-action">
              <i className={`fa-solid ${a.icon} text-[#0f4c81]`} aria-hidden />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onNavigate('analytics')}
          className="ula-dept-v2-panel text-left transition-shadow hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Institutional health</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f4c81]">{stats.engagementScore}%</p>
          <p className="mt-2 text-sm text-slate-500">
            {stats.hods} HODs · {stats.pendingSuggestions} pending student contributions
          </p>
        </button>

        <div className="ula-dept-v2-panel">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Live governance stream</p>
            <button
              type="button"
              onClick={() => onNavigate('audit')}
              className="text-[11px] font-semibold text-[#0f4c81] hover:underline"
            >
              Full timeline →
            </button>
          </div>
          <ul className="mt-3 space-y-0">
            {recent.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-400">No recent faculty-wide events</li>
            ) : (
              recent.map((e) => (
                <li key={e.id} className="ula-faculty-stream-item">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#0f4c81] shadow-sm">
                    <i className={`fa-solid ${streamIcon(e.category)} text-xs`} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{e.title}</span>
                    <span className="block truncate text-xs text-slate-500">{e.description}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-medium text-slate-400">{formatWhen(e.at)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
