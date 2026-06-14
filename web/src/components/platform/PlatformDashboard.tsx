import { useCallback, useEffect, useState } from 'react';
import { formatBytes } from '../../lib/format';
import { platformApi } from '../../lib/platformApi';
import { InvitationStatusBadge } from './InvitationStatusBadge';
export type AnalyticsOverview = {
  totals: {
    institutions: number;
    activeInstitutions: number;
    activeInstitutionsToday: number;
    students: number;
    lecturers: number;
    resourceDownloads: number;
    resultDownloads: number;
    storageBytes: number;
    successfulBackups: number;
    failedBackups: number;
  };
  backupHealth: {
    ok: boolean;
    cronEnabled: boolean;
    lastBackupStatus: string | null;
    lastBackupDate: string | null;
  };
};

export type InstitutionAnalyticsRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
  adminName: string | null;
  adminEmail: string | null;
  invitationStatus: string;
  lastActivityAt: string | null;
  studentCount: number;
  lecturerCount: number;
  resourceDownloadsThisMonth: number;
  resultDownloadsThisMonth: number;
  storageBytes: number;
  lastBackupStatus: string | null;
  lastBackupDate: string | null;
};
type InstitutionAnalyticsResponse = {
  items: InstitutionAnalyticsRow[];
  pagination: { page: number; take: number; total: number; totalPages: number };
};

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="ula-platform-kpi">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function formatTimestamp(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function PlatformDashboard() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionAnalyticsRow[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const ov = await platformApi<AnalyticsOverview>('/api/platform/analytics/overview');
      setOverview(ov);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load overview');
    }
  }, []);

  const loadInstitutions = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const inst = await platformApi<InstitutionAnalyticsResponse>(
        `/api/platform/analytics/institutions?page=${nextPage}&take=15`,
      );
      setInstitutions(inst.items);
      setPagination(inst.pagination);
      setPage(inst.pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load institutions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    void loadInstitutions(1);
  }, [loadOverview, loadInstitutions]);

  async function copyInvitationLink(row: InstitutionAnalyticsRow) {
    setBusyId(row.id);
    setActionMessage(null);
    try {
      const result = await platformApi<{ activationUrl: string }>(`/api/platform/tenants/${row.id}/invitation/link`);
      await navigator.clipboard.writeText(result.activationUrl);
      setActionMessage(`Invitation link copied for ${row.name}.`);
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Could not copy link');
    } finally {
      setBusyId(null);
    }
  }

  async function resendInvitation(row: InstitutionAnalyticsRow) {
    if (!row.adminEmail) return;
    if (!window.confirm(`Resend invitation to ${row.adminEmail}?`)) return;
    setBusyId(row.id);
    setActionMessage(null);
    try {
      await platformApi(`/api/platform/tenants/${row.id}/invitation/resend`, { method: 'POST' });
      setActionMessage(`Invitation resent to ${row.adminEmail}.`);
      await loadInstitutions(page);
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Resend failed');
    } finally {
      setBusyId(null);
    }
  }

  async function revokeInvitation(row: InstitutionAnalyticsRow) {
    if (!window.confirm(`Revoke invitation for ${row.name}?`)) return;
    setBusyId(row.id);
    setActionMessage(null);
    try {
      await platformApi(`/api/platform/tenants/${row.id}/invitation/revoke`, { method: 'POST' });
      setActionMessage(`Invitation revoked for ${row.name}.`);
      await loadInstitutions(page);
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setBusyId(null);
    }
  }

  function canCopyLink(status: string) {
    return status === 'PENDING' || status === 'RESENT';
  }

  function canResend(status: string) {
    return ['PENDING', 'RESENT', 'EXPIRED', 'REVOKED'].includes(status);
  }

  function canRevoke(status: string) {
    return status === 'PENDING' || status === 'RESENT';
  }

  const t = overview?.totals;
  const backup = overview?.backupHealth;

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Operations</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">Analytics &amp; audit overview</h2>
        <p className="mt-2 text-sm text-slate-500">
          Aggregated institution metrics — no student passwords, personal records, or individual results.
        </p>
      </header>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {actionMessage ? <p className="text-sm text-slate-700">{actionMessage}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Total institutions" value={t?.institutions ?? 0} hint={`${t?.activeInstitutions ?? 0} active`} />
        <Kpi
          label="Active today"
          value={t?.activeInstitutionsToday ?? 0}
          hint="Institutions with user activity today"
        />
        <Kpi label="Total students" value={(t?.students ?? 0).toLocaleString()} />
        <Kpi label="Total lecturers" value={(t?.lecturers ?? 0).toLocaleString()} />
        <Kpi
          label="Resource downloads"
          value={(t?.resourceDownloads ?? 0).toLocaleString()}
          hint="Materials excluding past questions"
        />
        <Kpi
          label="Result downloads"
          value={(t?.resultDownloads ?? 0).toLocaleString()}
          hint="Past questions / exam materials"
        />
        <Kpi label="Storage used" value={formatBytes(t?.storageBytes)} hint="Catalogue file bytes" />
        <Kpi
          label="Successful backups"
          value={t?.successfulBackups ?? 0}
          hint={backup?.cronEnabled ? 'Scheduled backups on' : 'Scheduled backups off'}
        />
        <Kpi label="Failed backups" value={t?.failedBackups ?? 0} hint="Platform-wide SQLite backups" />
      </div>

      <div className="ula-platform-kpi">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Backup health</h3>
            <p className="mt-2 inline-flex items-center gap-2 text-sm">
              <span
                className={`h-2 w-2 rounded-full ${backup?.ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              <span className={backup?.ok ? 'text-emerald-700' : 'text-amber-700'}>
                {backup?.ok ? 'Healthy' : 'Attention needed'}
              </span>
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Last status: {backup?.lastBackupStatus?.toLowerCase() ?? '—'}</p>
            <p>Last run: {formatTimestamp(backup?.lastBackupDate ?? null)}</p>
          </div>
        </div>
      </div>

      <div className="ula-platform-kpi overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Institution analytics</h3>
            <p className="mt-1 text-xs text-slate-500">
              Per-tenant usage. Monthly download counts track from audit events going forward.
            </p>
          </div>
          {loading ? <span className="text-xs text-slate-400">Loading…</span> : null}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2 pr-3">Institution</th>
                <th className="pb-2 pr-3">Admin</th>
                <th className="pb-2 pr-3">Invitation</th>
                <th className="pb-2 pr-3">Created</th>
                <th className="pb-2 pr-3">Last activity</th>
                <th className="pb-2 pr-3">Students</th>
                <th className="pb-2 pr-3">Lecturers</th>
                <th className="pb-2 pr-3">Storage</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {institutions.map((row) => (
                <tr key={row.id}>
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-400">/{row.slug}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-600">
                    <p className="font-medium text-slate-800">{row.adminName ?? '—'}</p>
                    <p>{row.adminEmail ?? '—'}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    <InvitationStatusBadge status={row.invitationStatus} />
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-600">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-600">{formatTimestamp(row.lastActivityAt)}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{row.studentCount}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{row.lecturerCount}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{formatBytes(row.storageBytes)}</td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {canCopyLink(row.invitationStatus) ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void copyInvitationLink(row)}
                          className="rounded border px-2 py-1 text-[11px]"
                        >
                          Copy link
                        </button>
                      ) : null}
                      {canResend(row.invitationStatus) ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void resendInvitation(row)}
                          className="rounded border px-2 py-1 text-[11px]"
                        >
                          Resend
                        </button>
                      ) : null}
                      {canRevoke(row.invitationStatus) ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void revokeInvitation(row)}
                          className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && institutions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500">
                    No institutions yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-slate-500">
              Page {page} of {pagination.totalPages} · {pagination.total} institutions
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => void loadInstitutions(page - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => void loadInstitutions(page + 1)}
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
