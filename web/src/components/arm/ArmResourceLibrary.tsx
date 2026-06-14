import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { formatBytes } from '../../lib/format';
import { ArmResourcePreviewModal } from './ArmResourcePreviewModal';
import {
  ARM_PUBLISH_KINDS,
  GOVERNANCE_LABELS,
  armKindLabel,
  sourceTypeLabel,
  type ArmFaculty,
  type ArmResource,
} from '../../lib/arm';

type Props = {
  refreshKey: number;
  onChanged: () => void;
};

export function ArmResourceLibrary({ refreshKey, onChanged }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<ArmResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [faculties, setFaculties] = useState<ArmFaculty[]>([]);
  const [preview, setPreview] = useState<ArmResource | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api<ArmFaculty[]>('/api/meta/faculties').then(setFaculties).catch(() => setFaculties([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (facultyId) params.set('facultyId', facultyId);
      if (kind) params.set('kind', kind);
      if (status) params.set('governanceStatus', status);
      const res = await api<{ items: ArmResource[]; total: number }>(`/api/arm/resources?${params}`);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      toast({ title: 'Could not load library', message: e instanceof Error ? e.message : 'Try again', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, facultyId, kind, status, toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const filteredLabel = useMemo(() => {
    if (!facultyId && !kind && !status && !search.trim()) return `${total} resources`;
    return `${items.length} shown · ${total} total`;
  }, [facultyId, kind, status, search, items.length, total]);

  async function patchResource(id: string, patch: Record<string, unknown>, success: string) {
    setBusyId(id);
    try {
      await api(`/api/arm/resources/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      toast({ title: success, tone: 'success' });
      onChanged();
      await load();
    } catch (e) {
      toast({ title: 'Update failed', message: e instanceof Error ? e.message : 'Try again', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function deleteResource(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await api(`/api/arm/resources/${id}`, { method: 'DELETE' });
      toast({ title: 'Resource deleted', tone: 'success' });
      onChanged();
      await load();
    } catch (e) {
      toast({ title: 'Delete failed', message: e instanceof Error ? e.message : 'Try again', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-700">Institution library</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-dark-900">Manage resources</h2>
          <p className="mt-2 text-[14px] text-dark-500">{filteredLabel} — publish, archive, or remove across all faculties.</p>
        </div>
        <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-dark-400" aria-hidden />
            <input
              type="search"
              placeholder="Search title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border-0 bg-white py-2.5 pl-10 pr-4 text-[14px] ring-1 ring-dark-200/70"
            />
          </div>
          <select className="rounded-xl bg-white px-3 py-2.5 text-[13px] ring-1 ring-dark-200/70" value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
            <option value="">All faculties</option>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <select className="rounded-lg bg-white px-3 py-2 text-[12px] ring-1 ring-dark-200/70" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All types</option>
          {ARM_PUBLISH_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <select className="rounded-lg bg-white px-3 py-2 text-[12px] ring-1 ring-dark-200/70" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="VERIFIED">Published</option>
          <option value="PENDING_REVIEW">Pending review</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {loading ? (
        <div className="ula-lecturer-surface flex min-h-[30vh] items-center justify-center text-sm text-dark-500">
          <i className="fa-solid fa-spinner fa-spin mr-2 text-primary-700" aria-hidden />
          Loading resources…
        </div>
      ) : items.length === 0 ? (
        <div className="ula-lecturer-surface py-20 text-center">
          <p className="text-[15px] font-medium text-dark-700">No resources match</p>
          <p className="mt-2 text-[13px] text-dark-500">Upload from Publish to scale materials across your institution.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((r) => (
            <article key={r.id} className="ula-lecturer-surface flex flex-col gap-4 p-5 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-800">
                    {armKindLabel(r.kind)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                    {GOVERNANCE_LABELS[r.governanceStatus] ?? r.governanceStatus}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                    {sourceTypeLabel(r.sourceType)}
                  </span>
                </div>
                <h3 className="mt-2 truncate text-[15px] font-semibold text-dark-900">{r.title}</h3>
                <p className="mt-1 text-[13px] text-dark-500">
                  {r.course.code} · {r.course.title} · {r.course.department.name} ({r.course.department.faculty.code})
                </p>
                <p className="mt-1 text-[12px] text-dark-400">
                  {r.originalFileName}
                  {r.sizeBytes ? ` · ${formatBytes(r.sizeBytes)}` : ''}
                  {r.uploadedBy ? ` · ${r.uploadedBy.fullName}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-[12px] font-semibold text-primary-800 ring-1 ring-primary-200"
                  onClick={() => setPreview(r)}
                >
                  Preview
                </button>
                {r.governanceStatus === 'ARCHIVED' ? (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    className="rounded-lg px-3 py-2 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-200 disabled:opacity-50"
                    onClick={() => void patchResource(r.id, { governanceStatus: 'VERIFIED' }, 'Resource republished')}
                  >
                    Publish
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    className="rounded-lg px-3 py-2 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200 disabled:opacity-50"
                    onClick={() => void patchResource(r.id, { governanceStatus: 'ARCHIVED' }, 'Resource archived')}
                  >
                    Archive
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === r.id}
                  className="rounded-lg px-3 py-2 text-[12px] font-semibold text-red-700 ring-1 ring-red-200 disabled:opacity-50"
                  onClick={() => void deleteResource(r.id, r.title)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {preview ? <ArmResourcePreviewModal resource={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}
