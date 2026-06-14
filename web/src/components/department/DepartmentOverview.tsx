import type { DepartmentSection, DeptAuditEntry, DeptOverview } from '../../lib/department';

function formatWhen(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function auditIcon(category: string) {
  if (category === 'publish') return 'fa-file-arrow-up';
  if (category === 'invite') return 'fa-envelope';
  return 'fa-user';
}

export function DepartmentOverview({
  data,
  loading,
  deptName,
  hodName,
  onNavigate,
}: {
  data: DeptOverview | null;
  loading: boolean;
  deptName: string;
  hodName: string;
  onNavigate: (section: DepartmentSection) => void;
}) {
  if (loading || !data) {
    return (
      <div className="ula-dept-v2 space-y-5">
        <div className="ula-dept-v2-hero ula-dept-skeleton h-28" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="ula-dept-v2-kpi ula-dept-skeleton h-24" />
          ))}
        </div>
      </div>
    );
  }

  const { stats } = data;
  const score = stats.engagementScore ?? 0;
  const audit: DeptAuditEntry[] =
    data.auditLog ??
    data.activity?.map((a) => ({
      id: a.id,
      category: (a.type === 'upload' ? 'publish' : a.type === 'invite' ? 'invite' : 'lecturer') as DeptAuditEntry['category'],
      title: a.label,
      description: a.meta,
      actor: '',
      reference: '',
      status: 'ACTIVE',
      at: a.at,
    })) ??
    [];
  const recent = audit.slice(0, 3);

  const metrics = [
    { label: 'Lecturers', value: stats.lecturers, section: 'lecturers' as const },
    { label: 'Catalog', value: stats.courses, section: 'courses' as const },
    { label: 'Live resources', value: stats.publishedMaterials, section: 'resources' as const },
    { label: 'Health', value: `${score}%`, section: 'analytics' as const },
  ];

  const actions = [
    { label: 'Add lecturer', icon: 'fa-user-plus', section: 'lecturers' as const },
    { label: 'View catalog', icon: 'fa-book', section: 'courses' as const },
    { label: 'Resource library', icon: 'fa-folder-open', section: 'resources' as const },
    { label: 'Intelligence', icon: 'fa-chart-line', section: 'analytics' as const },
  ];

  return (
    <div className="ula-dept-v2 ula-dept-animate-in max-w-5xl">
      {/* Hero — one glance */}
      <header className="ula-dept-v2-hero">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Command overview</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Hello, {hodName}</h2>
        <p className="mt-1 text-sm text-slate-500">{deptName}</p>
      </header>

      {/* 4 metrics only */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => onNavigate(m.section)}
              className="ula-dept-v2-kpi group"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{m.value}</p>
              <p className="mt-2 text-[11px] font-medium text-[#0f4c81] opacity-0 transition-opacity group-hover:opacity-100">
                Open →
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Action center */}
      <section aria-label="Actions" className="ula-dept-v2-panel">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">What would you like to do?</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onNavigate(a.section)}
              className="ula-dept-v2-action"
            >
              <i className={`fa-solid ${a.icon} text-[#0f4c81]`} aria-hidden />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Insight preview — minimal */}
      <section className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onNavigate('analytics')}
          className="ula-dept-v2-panel text-left transition-shadow hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Department health</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f4c81]">{score}%</p>
          <p className="mt-2 text-sm text-slate-500">Performance index · tap for full intelligence</p>
        </button>

        <div className="ula-dept-v2-panel">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent activity</p>
            <button
              type="button"
              onClick={() => onNavigate('audit')}
              className="text-[11px] font-semibold text-[#0f4c81] hover:underline"
            >
              View all logs →
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {recent.length === 0 ? (
              <li className="py-4 text-center text-sm text-slate-400">No recent events</li>
            ) : (
              recent.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl bg-slate-50/80 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#0f4c81] shadow-sm">
                    <i className={`fa-solid ${auditIcon(e.category)} text-xs`} aria-hidden />
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
