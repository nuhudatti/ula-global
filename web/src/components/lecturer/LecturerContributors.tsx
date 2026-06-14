import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { StudentSearchHit, SuggestPermission } from '../../lib/suggestions';

const inputCls =
  'w-full rounded-xl border-0 bg-white py-2.5 px-3.5 text-sm text-dark-900 ring-1 ring-dark-200/80 focus:ring-2 focus:ring-primary-600/25';

export function LecturerContributors() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<StudentSearchHit[]>([]);
  const [permissions, setPermissions] = useState<SuggestPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const loadPermissions = useCallback(async () => {
    const rows = await api<SuggestPermission[]>('/api/suggestions/lecturer/permissions');
    setPermissions(rows);
  }, []);

  useEffect(() => {
    void loadPermissions().finally(() => setLoading(false));
  }, [loadPermissions]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      api<StudentSearchHit[]>(`/api/suggestions/lecturer/students?q=${encodeURIComponent(query.trim())}`)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  async function grant(studentId: string) {
    setMsg(null);
    try {
      await api('/api/suggestions/lecturer/permissions', {
        method: 'POST',
        body: JSON.stringify({ studentId }),
      });
      setQuery('');
      setHits([]);
      await loadPermissions();
      setMsg('Student can now submit materials to your inbox.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not grant access');
    }
  }

  async function revoke(studentId: string) {
    if (!confirm('Revoke contribution access for this student?')) return;
    try {
      await api(`/api/suggestions/lecturer/permissions/${studentId}`, { method: 'DELETE' });
      await loadPermissions();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Revoke failed');
    }
  }

  return (
    <div className="ula-dept-animate-in max-w-2xl space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Trusted contributors</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Allow students to suggest</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Search registered students in your department by name, email, or matric number. Only students you allow
          can submit — you remain the publisher when you approve.
        </p>
      </header>

      {msg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{msg}</div>
      ) : null}

      <div className="ula-dept-v2-panel space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Find student</label>
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Name, email, or matric number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {searching ? <p className="text-xs text-slate-400">Searching…</p> : null}
        {hits.length > 0 ? (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
            {hits.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{s.fullName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {s.matricNumber ? (
                      <span className="font-mono font-medium text-slate-600">{s.matricNumber}</span>
                    ) : null}
                    {s.matricNumber ? <span className="text-slate-300"> · </span> : null}
                    {s.email}
                  </p>
                </div>
                {s.alreadyGranted ? (
                  <span className="text-xs font-medium text-emerald-700">Already allowed</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void grant(s.id)}
                    className="shrink-0 rounded-lg bg-[#0f4c81] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Allow
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : query.trim().length >= 2 && !searching ? (
          <p className="text-sm text-slate-500">No students found in your department.</p>
        ) : null}
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Allowed contributors ({permissions.length})
        </h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        ) : permissions.length === 0 ? (
          <div className="ula-dept-surface mt-3 px-6 py-10 text-center">
            <p className="text-sm text-slate-500">No students allowed yet. Search above to invite contributors.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {permissions.map((p) => (
              <li key={p.id} className="ula-dept-surface flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{p.student.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {p.student.matricNumber ? (
                      <span className="font-mono font-medium text-slate-600">{p.student.matricNumber}</span>
                    ) : null}
                    {p.student.matricNumber ? <span className="text-slate-300"> · </span> : null}
                    {p.student.email}
                  </p>
                  {p.pendingCount ? (
                    <p className="mt-1 text-xs font-medium text-amber-700">{p.pendingCount} pending in inbox</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void revoke(p.student.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
