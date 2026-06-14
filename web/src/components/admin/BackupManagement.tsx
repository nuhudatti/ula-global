import { useCallback, useEffect, useState } from 'react';
import { formatBytes } from '../../lib/format';
import {
  deleteBackup,
  fetchBackups,
  fetchBackupStatus,
  restoreBackup,
  runBackupNow,
  runRetentionNow,
  validateBackup,
  type BackupRecord,
  type BackupStatus,
  type ValidationReport,
} from '../../lib/backup';

function formatDt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function StatusPill({ ok, label }: { ok: boolean | null | undefined; label: string }) {
  if (ok == null) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
        {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
        ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
      }`}
    >
      {label}
    </span>
  );
}

function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  tone = 'danger',
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="ula-platform-kpi w-full max-w-md">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              tone === 'danger' ? 'bg-red-700 hover:bg-red-800' : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BackupManagement() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [items, setItems] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  const [lastValidation, setLastValidation] = useState<ValidationReport | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupRecord | null>(null);

  const refresh = useCallback(async () => {
    const [s, list] = await Promise.all([fetchBackupStatus(), fetchBackups()]);
    setStatus(s);
    setItems(list.items);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch (e) {
        setMessage({ tone: 'err', text: e instanceof Error ? e.message : 'Could not load backups' });
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  async function withAction(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : 'Action failed' });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="inline-flex items-center gap-2 text-sm text-slate-500">
          <i className="fa-solid fa-spinner fa-spin" aria-hidden />
          Loading backup &amp; recovery…
        </p>
      </div>
    );
  }

  const healthOk = status?.health?.ok !== false;

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Data protection</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">Backup &amp; recovery</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Enterprise SQLite snapshots: integrity-checked before upload, Cloudinary primary storage, optional off-site
          copy, grandfather–father–son retention, and audited restore. Cloudinary file assets remain on CDN — this
          protects all tenant metadata and catalogue records.
        </p>
      </header>

      {message ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            message.tone === 'ok'
              ? 'bg-emerald-50 text-emerald-900'
              : message.tone === 'warn'
                ? 'bg-amber-50 text-amber-950'
                : 'bg-red-50 text-red-900'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div
        className={`ula-platform-kpi flex flex-wrap items-center justify-between gap-3 ${
          healthOk ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              healthOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
            }`}
          >
            <i className={`fa-solid ${healthOk ? 'fa-shield-halved' : 'fa-triangle-exclamation'}`} aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-slate-900">{healthOk ? 'Backup system healthy' : 'Attention needed'}</p>
            <p className="text-xs text-slate-600">
              Engine: {status?.engine ?? 'sqlite'}
              {status?.health?.dbSizeBytes != null ? ` · Live DB ${formatBytes(status.health.dbSizeBytes)}` : ''}
              {status?.health?.writeLocked ? ' · Restore in progress (read-only)' : ''}
            </p>
          </div>
        </div>
        {status?.lastFailed ? (
          <p className="text-xs text-amber-800">
            Last failure {formatDt(status.lastFailed.createdAt)}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="ula-platform-kpi">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Completed</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{status?.totalCompleted ?? 0}</p>
          <p className="mt-2 text-xs text-slate-500">
            {status?.lastBackup ? `Latest ${formatDt(status.lastBackup.createdAt)}` : 'Run your first backup'}
          </p>
        </div>
        <div className="ula-platform-kpi">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Daily schedule</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{status?.cronEnabled ? 'Active' : 'Disabled'}</p>
          <p className="mt-2 font-mono text-xs text-slate-500">{status?.cronSchedule}</p>
        </div>
        <div className="ula-platform-kpi">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Retention policy</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {status?.retention.daily}d · {status?.retention.weekly}w · {status?.retention.monthly}m
          </p>
          <p className="mt-2 text-xs text-slate-500">Daily · weekly · monthly keeps</p>
        </div>
        <div className="ula-platform-kpi">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Off-site copy</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{status?.offsite.enabled ? 'Enabled' : 'Not set'}</p>
          <p className="mt-2 truncate text-xs text-slate-500" title={status?.offsite.localDir ?? ''}>
            {status?.offsite.isDevDefault
              ? 'Dev default (../ula-backups)'
              : status?.offsite.rcloneEnabled
                ? 'Local + rclone'
                : status?.offsite.localDir ?? 'Set BACKUP_OFFSITE_DIR'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy) || status?.health?.writeLocked}
          onClick={() =>
            void withAction('run', async () => {
              const result = await runBackupNow();
              const r = result.record;
              setMessage({
                tone: 'ok',
                text: `Backup completed — ${formatBytes(r.size ?? 0)} · integrity verified · ID ${r.id.slice(0, 8)}…`,
              });
              if (result.offsite?.errors?.length) {
                setMessage({
                  tone: 'warn',
                  text: `Backup saved to Cloudinary. Off-site copy warnings: ${result.offsite.errors.join('; ')}`,
                });
              }
            })
          }
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy === 'run' ? (
            <i className="fa-solid fa-spinner fa-spin" aria-hidden />
          ) : (
            <i className="fa-solid fa-cloud-arrow-up" aria-hidden />
          )}
          Run backup now
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() =>
            void withAction('retention', async () => {
              const r = await runRetentionNow();
              setMessage({ tone: 'ok', text: `Retention applied — removed ${r.deleted}, keeping ${r.retained}.` });
            })
          }
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Apply retention
        </button>
      </div>

      {lastValidation ? (
        <div
          className={`ula-platform-kpi border ${
            lastValidation.valid ? 'border-emerald-200' : 'border-red-200'
          }`}
        >
          <p className="font-semibold text-slate-900">
            Validation {lastValidation.valid ? 'passed' : 'failed'} — {formatDt(lastValidation.validatedAt)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Decompressed {formatBytes(lastValidation.checks.decompressedSize)} · integrity:{' '}
            {lastValidation.integrity ?? '—'}
            {lastValidation.integrityNote ? ` (${lastValidation.integrityNote})` : ''}
          </p>
        </div>
      ) : null}

      <div className="ula-platform-kpi overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-slate-900">Backup registry</h3>
          <p className="mt-1 text-xs text-slate-500">
            Each backup is gzip-compressed, SHA-256 checksumed, and validated before completion. Validate again before
            restore. Restore replaces the live database — restart the API afterward.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Size</th>
                <th className="px-5 py-3">Integrity</th>
                <th className="px-5 py-3">Off-site</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No backups yet. Run your first backup to protect tenant data.
                  </td>
                </tr>
              ) : (
                items.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{formatDt(b.createdAt)}</p>
                      <p className="text-[11px] text-slate-400">
                        {b.trigger} · v{b.version} · {b.status}
                      </p>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-slate-600">{formatBytes(b.size)}</td>
                    <td className="px-5 py-3">
                      {b.integrityChecked ? (
                        <StatusPill ok={b.validationOk ?? true} label="Verified at backup" />
                      ) : b.validatedAt ? (
                        <StatusPill ok={b.validationOk} label={formatDt(b.validatedAt)} />
                      ) : (
                        <StatusPill ok={null} label="Not re-tested" />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill ok={b.offsiteCopied} label={b.offsiteCopied ? 'Copied' : 'Cloud only'} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        {b.status === 'COMPLETED' ? (
                          <>
                            <button
                              type="button"
                              disabled={Boolean(busy)}
                              onClick={() =>
                                void withAction(`val-${b.id}`, async () => {
                                  const report = await validateBackup(b.id);
                                  setLastValidation(report);
                                  setMessage({
                                    tone: report.valid ? 'ok' : 'err',
                                    text: report.valid
                                      ? 'Restore drill validation passed.'
                                      : 'Restore drill validation failed.',
                                  });
                                })
                              }
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
                            >
                              Validate
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busy)}
                              onClick={() => setRestoreTarget(b)}
                              className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                            >
                              Restore
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => setDeleteTarget(b)}
                          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {status?.recentAudits?.length ? (
        <div className="ula-platform-kpi">
          <h3 className="text-sm font-semibold text-slate-900">Audit trail</h3>
          <p className="mt-1 text-xs text-slate-500">Backup, restore, and retention events (platform operators).</p>
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs text-slate-600">
            {status.recentAudits.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-slate-100 pb-2">
                <span className="font-mono font-semibold text-slate-800">{a.action}</span>
                <span className="text-slate-400">{formatDt(a.createdAt)}</span>
                {a.detail ? <span className="w-full truncate text-slate-500">{a.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(restoreTarget)}
        title="Restore database"
        body={
          restoreTarget
            ? `This will replace the live SQLite database with the backup from ${formatDt(restoreTarget.createdAt)}. All current data since that point will be lost unless you have a newer backup. The API must be restarted after restore.`
            : ''
        }
        confirmLabel="Restore database"
        tone="danger"
        busy={busy?.startsWith('restore-')}
        onCancel={() => setRestoreTarget(null)}
        onConfirm={() => {
          if (!restoreTarget) return;
          const id = restoreTarget.id;
          setRestoreTarget(null);
          void withAction(`restore-${id}`, async () => {
            await restoreBackup(id);
            setMessage({
              tone: 'warn',
              text: 'Database restored. Restart the API server now (npm run dev or pm2 restart ula).',
            });
          });
        }}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete backup"
        body={
          deleteTarget
            ? `Remove backup from ${formatDt(deleteTarget.createdAt)} from Cloudinary and the registry? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete backup"
        tone="danger"
        busy={busy?.startsWith('del-')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTarget(null);
          void withAction(`del-${id}`, async () => {
            await deleteBackup(id);
            setMessage({ tone: 'ok', text: 'Backup deleted from registry and Cloudinary.' });
          });
        }}
      />
    </div>
  );
}
