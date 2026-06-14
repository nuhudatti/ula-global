type Analytics = {
  activeLecturers: number;
  uploadFrequency30d: number;
  publicationTrend: { period: string; count: number }[];
  topCourses: { id: string; code: string; title: string; resourceCount: number; recentUploads: number }[];
  governanceBreakdown: { status: string; count: number }[];
  resourceGrowth: number;
};

export function DepartmentAnalytics({ data, loading }: { data: Analytics | null; loading: boolean }) {
  if (loading || !data) {
    return <div className="ula-dept-surface h-64 animate-pulse bg-slate-100/50" />;
  }

  const maxTrend = Math.max(...data.publicationTrend.map((t) => t.count), 1);

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Department analytics</h2>
        <p className="text-sm text-slate-500">Calm, intentional insights — not chart overload.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="ula-dept-stat">
          <p className="text-xs font-semibold uppercase text-slate-400">Active lecturers (30d)</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{data.activeLecturers}</p>
        </div>
        <div className="ula-dept-stat">
          <p className="text-xs font-semibold uppercase text-slate-400">Uploads (30d)</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{data.uploadFrequency30d}</p>
        </div>
        <div className="ula-dept-stat">
          <p className="text-xs font-semibold uppercase text-slate-400">Resource growth</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{data.resourceGrowth}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="ula-dept-surface p-6">
          <h3 className="text-sm font-semibold text-slate-900">Publication trend</h3>
          <div className="mt-6 flex items-end gap-2 h-40">
            {data.publicationTrend.length === 0 ? (
              <p className="text-sm text-slate-500">Not enough data yet.</p>
            ) : (
              data.publicationTrend.map((t) => (
                <div key={t.period} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-[#0f4c81] to-[#15803d]/70"
                    style={{ height: `${(t.count / maxTrend) * 100}%`, minHeight: t.count ? 8 : 4 }}
                    title={`${t.count} uploads`}
                  />
                  <span className="text-[9px] text-slate-400 truncate max-w-full">{t.period}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="ula-dept-surface p-6">
          <h3 className="text-sm font-semibold text-slate-900">Most active courses</h3>
          <ul className="mt-4 space-y-3">
            {data.topCourses.length === 0 ? (
              <li className="text-sm text-slate-500">No course activity yet.</li>
            ) : (
              data.topCourses.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {c.code} — {c.title}
                    </p>
                    <p className="text-xs text-slate-500">{c.resourceCount} total resources</p>
                  </div>
                  <span className="text-sm font-semibold text-[#0f4c81]">+{c.recentUploads}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="ula-dept-surface p-6">
        <h3 className="text-sm font-semibold text-slate-900">Governance breakdown</h3>
        <div className="mt-4 flex flex-wrap gap-4">
          {data.governanceBreakdown.map((g) => (
            <div key={g.status} className="rounded-xl bg-slate-50 px-5 py-3 ring-1 ring-slate-100">
              <p className="text-xs text-slate-500">{g.status.replace('_', ' ')}</p>
              <p className="text-xl font-semibold text-slate-900">{g.count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
