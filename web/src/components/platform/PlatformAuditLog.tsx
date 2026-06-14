import { useCallback, useEffect, useState } from 'react';
import { platformApi } from '../../lib/platformApi';

export type AuditLogEntry = {
  id: string;
  action: string;
  actionLabel: string;
  actorType: string;
  institutionId: string | null;
  institutionName: string | null;
  institutionSlug: string | null;
  detail: string | null;
  createdAt: string;
};

type AuditResponse = {
  items: AuditLogEntry[];
  pagination: { page: number; take: number; total: number; totalPages: number };
};

const ACTION_LABELS: Record<string, string> = {
  INSTITUTION_CREATED: 'Institution created',
  INSTITUTION_SUSPENDED: 'Institution suspended',
  INSTITUTION_REACTIVATED: 'Institution activated',
  INSTITUTION_ADMIN_ASSIGNED: 'Institution admin invited',
  INSTITUTION_ADMIN_LOGIN: 'Institution admin login',
  RESOURCE_UPLOADED: 'Resource uploaded',
  RESULT_UPLOADED: 'Result uploaded',
  BULK_IMPORT_PERFORMED: 'Bulk import performed',
  BACKUP_CREATED: 'Backup created',
  BACKUP_COMPLETED: 'Backup created',
  RESTORE_COMPLETED: 'Backup restored',
  BACKUP_FAILED: 'Backup failed',
  RESTORE_FAILED: 'Backup restore failed',
  FAILED_LOGIN: 'Failed login attempt',
  RESOURCE_DOWNLOAD: 'Resource downloaded',
  RESULT_DOWNLOAD: 'Result downloaded',
};

export function PlatformAuditLog() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [actionFilter, setActionFilter] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number, action: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        take: '30',
      });
      if (action) params.set('action', action);
      const data = await platformApi<AuditResponse>(`/api/platform/audit?${params}`);
      setItems(data.items);
      setPagination(data.pagination);
      setPage(data.pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void platformApi<{ items: string[] }>('/api/platform/audit/actions')
      .then((res) => setActions(res.items))
      .catch(() => setActions(Object.keys(ACTION_LABELS)));
  }, []);

  useEffect(() => {
    void load(1, actionFilter);
  }, [load, actionFilter]);

  return (
    <div className="max-w-5xl space-y-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Compliance</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">Platform audit log</h2>
        <p className="mt-2 text-sm text-slate-500">
          Institution-level events only — emails and personal records are never shown.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          Filter
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800"
          >
            <option value="">All events</option>
            {actions.map((code) => (
              <option key={code} value={code}>
                {ACTION_LABELS[code] ?? code.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        {loading ? <span className="text-xs text-slate-400">Loading…</span> : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="ula-platform-kpi overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-4">Event</th>
                <th className="pb-2 pr-4">Institution</th>
                <th className="pb-2 pr-4">Detail</th>
                <th className="pb-2">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-slate-900">{entry.actionLabel}</p>
                    <p className="font-mono text-[10px] text-slate-400">{entry.action}</p>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-700">
                    {entry.institutionName ? (
                      <>
                        <p>{entry.institutionName}</p>
                        {entry.institutionSlug ? (
                          <p className="text-xs text-slate-400">/{entry.institutionSlug}</p>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-400">Platform</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-600">{entry.detail ?? '—'}</td>
                  <td className="py-2.5 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No audit events match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
            <p className="text-slate-500">
              Page {page} of {pagination.totalPages} · {pagination.total} events
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => void load(page - 1, actionFilter)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => void load(page + 1, actionFilter)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
