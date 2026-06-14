import type { FacultyAuditEntry } from '../../lib/faculty';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FacultyAuditTrail({ entries }: { entries: FacultyAuditEntry[] }) {
  return (
    <div className="ula-dept-animate-in max-w-3xl">
      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Memory</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Governance timeline</h2>
        <p className="mt-2 text-sm text-slate-500">Cross-faculty institutional memory — publishes, invites, contributions, structure.</p>
      </header>

      {entries.length === 0 ? (
        <div className="ula-dept-surface px-8 py-14 text-center text-sm text-slate-500">No governance events yet.</div>
      ) : (
        <ul className="ula-dept-surface divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={e.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-slate-900">{e.title}</p>
                <span className="text-[11px] text-slate-400">{formatWhen(e.at)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{e.description}</p>
              <p className="mt-2 text-xs text-slate-400">
                {e.actor}
                {e.reference ? ` · ${e.reference}` : ''} · {e.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
