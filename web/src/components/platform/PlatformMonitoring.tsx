import { useEffect, useState } from 'react';

type HealthPayload = {
  ok: boolean;
  service: string;
  ts: string;
  storage: string;
  folder: string;
  fileAccess: string;
  backupCron: boolean;
};

export function PlatformMonitoring() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/health')
      .then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json() as Promise<HealthPayload>;
      })
      .then(setHealth)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Health check failed'));
  }, []);

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Observability</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">Monitoring</h2>
        <p className="mt-2 text-sm text-slate-500">Live API health, storage backend, and scheduled jobs.</p>
      </header>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="ula-platform-kpi">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">API status</p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {health?.ok ? 'Operational' : 'Checking…'}
          </p>
          <p className="mt-2 text-xs text-slate-500">Service: {health?.service ?? '—'}</p>
          <p className="text-xs text-slate-500">Checked: {health?.ts ? new Date(health.ts).toLocaleString() : '—'}</p>
        </div>
        <div className="ula-platform-kpi">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Infrastructure</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li>Storage: {health?.storage ?? '—'}</li>
            <li>CDN folder: {health?.folder ?? '—'}</li>
            <li>File access: {health?.fileAccess ?? '—'}</li>
            <li>Backup cron: {health?.backupCron ? 'enabled' : 'disabled'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
