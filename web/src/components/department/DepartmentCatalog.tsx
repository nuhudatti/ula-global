import type { DeptCourse } from '../../lib/department';

export function DepartmentCatalog({
  courses,
  loading,
}: {
  courses: DeptCourse[];
  loading: boolean;
}) {
  return (
    <div className="ula-dept-animate-in max-w-3xl">
      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Living catalogue</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Academic catalog</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
          Courses appear here automatically when lecturers publish — no manual setup. This scales with your
          department&apos;s real teaching activity.
        </p>
      </header>

      <div className="ula-dept-v2-panel mb-6 flex gap-3 text-sm text-slate-600">
        <i className="fa-solid fa-seedling mt-0.5 text-emerald-600" aria-hidden />
        <p>
          <strong className="text-slate-800">How it works:</strong> A lecturer enters course code + title when
          publishing. ULA registers it once, then everyone in the department can reuse that code.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading catalog…</p>
      ) : courses.length === 0 ? (
        <div className="ula-dept-surface px-8 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <i className="fa-solid fa-book-open text-xl" aria-hidden />
          </div>
          <h3 className="font-semibold text-slate-900">Catalog will grow organically</h3>
          <p className="mt-2 text-sm text-slate-500">
            When lecturers publish their first material, courses will appear here automatically.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {courses.map((c) => (
            <li key={c.id} className="ula-dept-surface flex items-center gap-4 px-5 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0f4c81]/8 font-mono text-xs font-bold text-[#0f4c81]">
                {c.code.slice(0, 4)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-semibold text-[#0f4c81]">{c.code}</p>
                <p className="truncate text-sm font-medium text-slate-900">{c.title}</p>
                {c.publishers && c.publishers.length > 0 ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {c.publishers.map((p) => p.fullName).join(', ')}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-semibold tabular-nums text-slate-900">{c.resourceCount}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">materials</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
