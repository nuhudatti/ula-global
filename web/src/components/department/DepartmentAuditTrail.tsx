import { useMemo, useState } from 'react';
import type { DeptAuditEntry } from '../../lib/department';

type Filter = 'all' | 'publish' | 'invite' | 'lecturer';

function formatWhen(iso: string) {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs} hours ago`;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function auditIcon(category: string) {
  if (category === 'publish') return 'fa-file-circle-check';
  if (category === 'invite') return 'fa-envelope-circle-check';
  return 'fa-user-check';
}

export function DepartmentAuditTrail({ entries }: { entries: DeptAuditEntry[] }) {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.category === filter);
  }, [entries, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'publish', label: 'Publications' },
    { id: 'invite', label: 'Invitations' },
    { id: 'lecturer', label: 'People' },
  ];

  return (
    <div className="ula-dept-animate-in max-w-3xl">
      <header className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Audit trail</h2>
        <p className="mt-1 text-sm text-slate-500">
          Full institutional log — publishing, invitations, and lecturer activity.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              filter === f.id ? 'bg-[#0f4c81] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="ula-dept-surface divide-y divide-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No events in this category.</p>
        ) : (
          filtered.map((e) => (
            <article key={e.id} className="flex gap-4 px-5 py-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  e.category === 'publish'
                    ? 'bg-blue-50 text-blue-600'
                    : e.category === 'invite'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-[#0f4c81]'
                }`}
              >
                <i className={`fa-solid ${auditIcon(e.category)}`} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{e.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">{e.description}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {e.actor}
                  {e.reference ? ` · ${e.reference}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-medium text-slate-400">{formatWhen(e.at)}</p>
                <p className="mt-1 text-[10px] uppercase text-slate-300">{e.status.replace(/_/g, ' ')}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
