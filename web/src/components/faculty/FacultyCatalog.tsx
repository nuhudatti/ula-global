import { useMemo, useState } from 'react';
import type { FacultyCatalogCourse, FacultyDepartment } from '../../lib/faculty';

export function FacultyCatalog({
  courses,
  departments,
  loading,
}: {
  courses: FacultyCatalogCourse[];
  departments: FacultyDepartment[];
  loading: boolean;
}) {
  const [deptFilter, setDeptFilter] = useState('');

  const filtered = useMemo(() => {
    if (!deptFilter) return courses;
    return courses.filter((c) => c.department.id === deptFilter);
  }, [courses, deptFilter]);

  return (
    <div className="ula-dept-animate-in max-w-4xl space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Archive</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Faculty knowledge archive</h2>
        <p className="mt-2 text-sm text-slate-500">
          Living catalog across all academic units — organic growth from trusted publishing. Read-only at faculty level.
        </p>
      </header>

      <select
        className="ula-dept-search max-w-xs"
        value={deptFilter}
        onChange={(e) => setDeptFilter(e.target.value)}
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="text-sm text-slate-500">Loading archive…</p>
      ) : filtered.length === 0 ? (
        <div className="ula-dept-surface px-8 py-12 text-center text-sm text-slate-500">
          No catalog entries yet — courses appear when lecturers publish.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id} className="ula-dept-surface flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0f4c81]/8 font-mono text-xs font-bold text-[#0f4c81]">
                {c.code.slice(0, 4)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-semibold text-[#0f4c81]">{c.code}</p>
                <p className="font-medium text-slate-900">{c.title}</p>
                <p className="text-xs text-slate-500">{c.department.name}</p>
                {c.publishers.length > 0 ? (
                  <p className="mt-0.5 truncate text-xs text-slate-400">{c.publishers.join(', ')}</p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold tabular-nums text-slate-900">{c.resourceCount}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">assets</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
