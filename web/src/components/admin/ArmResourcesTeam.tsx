import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { ArmManagerRow } from '../../lib/arm';
import { ArmManagerRoster } from './ArmManagerRoster';

export function ArmResourcesTeam() {
  const [rows, setRows] = useState<ArmManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await api<ArmManagerRow[]>('/api/admin/arm-managers');
    setRows(data);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load resources team');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  return (
    <div className="ula-dept-animate-in max-w-4xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Scale uploads</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Academic resources team</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Invite Academic Resources Managers to publish past questions, lecture notes, and course materials across every faculty — without giving them user, billing, or settings access.
          </p>
        </div>
        <Link to="/resources" className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-4 py-2.5 text-xs font-semibold text-white">
          <i className="fa-solid fa-cloud-arrow-up" aria-hidden />
          Open publish workspace
        </Link>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      {loading ? (
        <div className="ula-dept-surface flex min-h-[24vh] items-center justify-center text-sm text-slate-500">
          <i className="fa-solid fa-spinner fa-spin mr-2 text-primary-700" aria-hidden />
          Loading team…
        </div>
      ) : (
        <ArmManagerRoster rows={rows} busy={busy} onBusyChange={setBusy} onChanged={() => void load()} onError={setError} />
      )}
    </div>
  );
}
