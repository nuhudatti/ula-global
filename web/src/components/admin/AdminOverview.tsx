import type { PlatformOverview } from '../../lib/adminFaculties';

function Kpi({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="ula-admin-kpi">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function AdminOverview({
  data,
  onManageFaculties,
  onSelectFaculty,
}: {
  data: PlatformOverview | null;
  onManageFaculties: () => void;
  onSelectFaculty?: (facultyId: string) => void;
}) {
  const stats = data?.stats;

  return (
    <div className="ula-dept-animate-in max-w-5xl space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Platform</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">University control centre</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Create faculties and assign administrators. Day-to-day department governance stays with faculty
          administrators in their own workspace — not here.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Faculties" value={stats?.faculties ?? 0} hint="Academic tenant roots" />
        <Kpi label="Departments" value={stats?.departments ?? 0} hint="Across all faculties" />
        <Kpi label="Active users" value={stats?.activeUsers ?? 0} hint="Signed-in accounts" />
        <Kpi label="Live resources" value={stats?.liveResources ?? 0} hint="Published archive items" />
      </div>

      <div className="ula-dept-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-slate-900">Recent faculties</h3>
          <button
            type="button"
            onClick={onManageFaculties}
            className="rounded-xl bg-primary-700 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-800"
          >
            Manage all faculties
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.recentFaculties ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No faculties yet — create your first one.</p>
          ) : (
            data?.recentFaculties.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <button
                  type="button"
                  onClick={() => onSelectFaculty?.(f.id)}
                  className="min-w-0 flex-1 text-left hover:text-primary-800"
                >
                  <p className="font-medium text-slate-900">{f.name}</p>
                  <p className="text-xs text-slate-500">
                    {f.code} · {f.departmentCount} dept{f.departmentCount === 1 ? '' : 's'} · {f.adminCount} admin
                    {f.adminCount === 1 ? '' : 's'}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectFaculty?.(f.id)}
                  className="shrink-0 rounded-lg bg-primary-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-800"
                >
                  Manage faculty →
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="ula-dept-surface p-5">
          <h3 className="font-semibold text-slate-900">What super admin controls</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <i className="fa-solid fa-check text-primary-600 mt-0.5 text-xs" aria-hidden />
              Faculty lifecycle (create, edit, retire)
            </li>
            <li className="flex gap-2">
              <i className="fa-solid fa-check text-primary-600 mt-0.5 text-xs" aria-hidden />
              Faculty administrator assignment
            </li>
            <li className="flex gap-2">
              <i className="fa-solid fa-check text-primary-600 mt-0.5 text-xs" aria-hidden />
              Institution branding (university-wide)
            </li>
          </ul>
        </div>
        <div className="ula-dept-surface p-5">
          <h3 className="font-semibold text-slate-900">Delegated to faculty admins</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <i className="fa-solid fa-arrow-right text-slate-400 mt-0.5 text-xs" aria-hidden />
              Faculty logo, banner & tagline (/faculty → Settings)
            </li>
            <li className="flex gap-2">
              <i className="fa-solid fa-arrow-right text-slate-400 mt-0.5 text-xs" aria-hidden />
              Department structure & HOD invites (/faculty)
            </li>
            <li className="flex gap-2">
              <i className="fa-solid fa-arrow-right text-slate-400 mt-0.5 text-xs" aria-hidden />
              Faculty-wide archive & analytics (/faculty)
            </li>
            <li className="flex gap-2">
              <i className="fa-solid fa-arrow-right text-slate-400 mt-0.5 text-xs" aria-hidden />
              Lecturer publishing (unchanged)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
