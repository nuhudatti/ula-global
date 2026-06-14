import { computeLecturerStats, kindLabel, type LecturerCourse, type LecturerResource } from '../../lib/lecturer';

type Props = {
  resources: LecturerResource[];
  courses: LecturerCourse[];
};

export function LecturerAnalytics({ resources, courses }: Props) {
  const stats = computeLecturerStats(resources, courses);
  const maxTrend = Math.max(1, ...stats.trend.map((t) => t.count));
  const maxTop = Math.max(1, ...stats.topByDownloads.map((r) => r.downloadCount));

  return (
    <div className="space-y-8 animate-in">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-700">Insights</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-dark-900">Academic analytics</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-dark-500">
          Understand how students engage with your materials across courses and sessions.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="ula-lecturer-stat sm:col-span-1">
          <p className="text-[12px] font-medium text-dark-500">Total student accesses</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-dark-900">
            {stats.totalDownloads.toLocaleString()}
          </p>
        </div>
        <div className="ula-lecturer-stat sm:col-span-1">
          <p className="text-[12px] font-medium text-dark-500">Resources in archive</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-dark-900">{stats.totalResources}</p>
        </div>
        <div className="ula-lecturer-stat sm:col-span-1">
          <p className="text-[12px] font-medium text-dark-500">Courses with materials</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-dark-900">{stats.activeCourses}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ula-lecturer-surface p-6 md:p-8">
          <h3 className="text-[15px] font-semibold text-dark-900">Publishing trend</h3>
          <p className="mt-1 mb-6 text-[13px] text-dark-500">Resources added per month</p>
          {stats.trend.length === 0 ? (
            <p className="text-[13px] text-dark-400">Publish materials to see trends.</p>
          ) : (
            <div className="flex items-end gap-3" style={{ minHeight: 140 }}>
              {stats.trend.map((t) => (
                <div key={t.month} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-primary-800 to-primary-500/80 transition-all"
                    style={{ height: `${Math.max(8, (t.count / maxTrend) * 120)}px` }}
                    title={`${t.count} resources`}
                  />
                  <span className="text-[10px] font-medium tabular-nums text-dark-400">
                    {t.month.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ula-lecturer-surface p-6 md:p-8">
          <h3 className="text-[15px] font-semibold text-dark-900">Most accessed</h3>
          <p className="mt-1 mb-6 text-[13px] text-dark-500">By download count</p>
          {stats.topByDownloads.length === 0 ? (
            <p className="text-[13px] text-dark-400">No download data yet.</p>
          ) : (
            <ul className="space-y-4">
              {stats.topByDownloads.map((r) => (
                <li key={r.id}>
                  <div className="mb-1 flex justify-between gap-2 text-[13px]">
                    <span className="truncate font-medium text-dark-800">{r.title}</span>
                    <span className="shrink-0 tabular-nums text-dark-500">{r.downloadCount}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-dark-100">
                    <div
                      className="h-full rounded-full bg-primary-600/90"
                      style={{ width: `${(r.downloadCount / maxTop) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-dark-400">
                    {r.course.code} · {kindLabel(r.kind)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
