import type { FacultyAnalytics } from '../../lib/faculty';

export function FacultyAnalyticsPanel({ data, loading }: { data: FacultyAnalytics | null; loading: boolean }) {
  if (loading || !data) {
    return <p className="text-sm text-slate-500">Loading intelligence…</p>;
  }

  const maxDept = Math.max(...data.departmentGrowth.map((d) => d.resourceCount), 1);

  return (
    <div className="ula-dept-animate-in max-w-4xl space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Intelligence</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Institution intelligence</h2>
        <p className="mt-2 text-sm text-slate-500">Executive visibility across academic units — calm, factual, actionable.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="ula-dept-v2-kpi">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Uploads (30d)</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{data.uploads30d}</p>
        </div>
        {data.suggestionBreakdown.map((s) => (
          <div key={s.status} className="ula-dept-v2-kpi">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.status}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{s.count}</p>
          </div>
        ))}
      </div>

      <div className="ula-dept-v2-panel">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Growth by department</h3>
        <ul className="mt-4 space-y-3">
          {data.departmentGrowth.map((d) => (
            <li key={d.id}>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-800">{d.name}</span>
                <span className="tabular-nums text-slate-500">{d.resourceCount}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#0f4c81]/70 transition-all"
                  style={{ width: `${(d.resourceCount / maxDept) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="ula-dept-v2-panel">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Most active courses</h3>
        <ul className="mt-3 divide-y divide-slate-100">
          {data.topCourses.map((c) => (
            <li key={c.id} className="flex justify-between py-3 text-sm">
              <span>
                <span className="font-mono text-[#0f4c81]">{c.code}</span> · {c.title}
                <span className="block text-xs text-slate-500">{c.departmentName}</span>
              </span>
              <span className="font-semibold tabular-nums text-slate-700">{c.resourceCount}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
