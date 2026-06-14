import { api } from '../../lib/api';
import type { DeptResource } from '../../lib/department';
import { GOVERNANCE_LABELS, isResourceLive } from '../../lib/department';

export function DepartmentResources({
  resources,
  loading,
  onRefresh,
}: {
  resources: DeptResource[];
  loading: boolean;
  onRefresh: () => void;
}) {
  async function setGovernance(id: string, governanceStatus: string) {
    try {
      await api(`/api/department/resources/${id}/governance`, {
        method: 'PATCH',
        body: JSON.stringify({ governanceStatus }),
      });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed');
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Resource governance</h2>
        <p className="text-sm text-slate-500">
          Oversight only — lecturers are trusted; uploads go live immediately. Use archive if content must be
          removed.
        </p>
      </div>

      <div className="ula-dept-surface overflow-hidden">
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-500">Loading resources…</p>
        ) : resources.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-semibold text-slate-900">No department resources yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Materials appear here when lecturers publish — courses register automatically in the catalog.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-5 py-3">Lecturer</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{r.title}</p>
                      <p className="text-xs text-slate-500">
                        {r.course.code} · {r.kind} · {r.downloadCount} downloads
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{r.uploadedBy.fullName}</td>
                    <td className="px-5 py-4">
                      <span
                        className="ula-dept-badge"
                        data-status={
                          r.governanceStatus === 'VERIFIED'
                            ? 'ACTIVE'
                            : r.governanceStatus === 'ARCHIVED'
                              ? 'SUSPENDED'
                              : 'PENDING'
                        }
                      >
                        {GOVERNANCE_LABELS[r.governanceStatus] || r.governanceStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {!isResourceLive(r.governanceStatus) && r.governanceStatus !== 'ARCHIVED' ? (
                          <button
                            type="button"
                            onClick={() => void setGovernance(r.id, 'VERIFIED')}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
                          >
                            Mark live
                          </button>
                        ) : null}
                        {r.governanceStatus !== 'ARCHIVED' ? (
                          <button
                            type="button"
                            onClick={() => void setGovernance(r.id, 'ARCHIVED')}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void setGovernance(r.id, 'PUBLISHED')}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
