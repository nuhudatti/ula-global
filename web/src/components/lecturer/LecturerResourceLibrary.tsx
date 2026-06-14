import { useMemo, useState } from 'react';
import type { LecturerResource } from '../../lib/lecturer';
import { LecturerResourceCard } from './LecturerResourceCard';
import { LecturerResourceDetailModal } from './LecturerResourceDetailModal';

type Props = {
  resources: LecturerResource[];
  onDelete: (id: string) => void;
};

export function LecturerResourceLibrary({ resources, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<LecturerResource | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.course.code.toLowerCase().includes(q) ||
        r.course.title.toLowerCase().includes(q),
    );
  }, [resources, query]);

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-700">Library</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-dark-900">My materials</h2>
          <p className="mt-2 text-[14px] text-dark-500">
            {resources.length} published {resources.length === 1 ? 'resource' : 'resources'} — open any card for preview,
            download, or remove.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <i
            className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-dark-400"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search course, title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border-0 bg-white py-2.5 pl-10 pr-4 text-[14px] ring-1 ring-dark-200/70 focus:ring-2 focus:ring-primary-600/20"
          />
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="ula-lecturer-surface py-20 text-center">
          <p className="text-[15px] font-medium text-dark-700">No materials found</p>
          <p className="mt-2 text-[13px] text-dark-500">
            {resources.length === 0 ? 'Publish your first resource from Publish material.' : 'Try a different search.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <LecturerResourceCard key={r.id} resource={r} onOpen={setDetail} />
          ))}
        </div>
      )}

      {detail ? (
        <LecturerResourceDetailModal
          resource={detail}
          onClose={() => setDetail(null)}
          onDelete={(id) => {
            onDelete(id);
            setDetail(null);
          }}
        />
      ) : null}
    </div>
  );
}
