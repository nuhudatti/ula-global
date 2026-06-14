import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatBytes } from '../../lib/format';
import { downloadSecureStream, secureViewPath } from '../../lib/secureFile';
import { kindLabel } from '../../lib/lecturer';
import type { MaterialSuggestion } from '../../lib/suggestions';
import { SUGGEST_STATUS } from '../../lib/suggestions';

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'all';

export function LecturerSuggestionInbox({ onPublished }: { onPublished: () => void }) {
  const [tab, setTab] = useState<Tab>('PENDING');
  const [items, setItems] = useState<MaterialSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDesc, setPublishDesc] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api<MaterialSuggestion[]>(
        `/api/suggestions/lecturer/inbox?status=${encodeURIComponent(tab)}`
      );
      setItems(rows);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  function openReview(s: MaterialSuggestion) {
    setExpanded(s.id);
    setPublishTitle(s.title);
    setPublishDesc(s.reason);
  }

  async function approve(id: string) {
    setBusyId(id);
    try {
      await api(`/api/suggestions/lecturer/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ title: publishTitle, description: publishDesc }),
      });
      setExpanded(null);
      await load();
      onPublished();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = window.prompt('Optional note to student (internal):') ?? '';
    setBusyId(id);
    try {
      await api(`/api/suggestions/lecturer/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setExpanded(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'PENDING', label: 'Pending' },
    { id: 'APPROVED', label: 'Published' },
    { id: 'REJECTED', label: 'Declined' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="ula-dept-animate-in max-w-3xl space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Review queue</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Student contributions</h2>
        <p className="mt-2 text-sm text-slate-500">
          Approve to publish under your name. Students appear as compilation credit on the archive entry.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id ? 'bg-[#0f4c81] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading inbox…</p>
      ) : items.length === 0 ? (
        <div className="ula-dept-surface px-8 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <i className="fa-solid fa-inbox text-xl" aria-hidden />
          </div>
          <h3 className="font-semibold text-slate-900">Inbox clear</h3>
          <p className="mt-2 text-sm text-slate-500">No submissions in this view.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => {
            const st = SUGGEST_STATUS[s.status] ?? { label: s.status, tone: 'slate' as const };
            const isOpen = expanded === s.id;
            return (
              <li key={s.id} className="ula-dept-surface overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-start gap-4 px-5 py-4 text-left"
                  onClick={() => (isOpen ? setExpanded(null) : openReview(s))}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <i className="fa-solid fa-user-graduate text-sm" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="ula-contribute-status" data-tone={st.tone}>
                        {st.label}
                      </span>
                      <span className="font-mono text-xs text-[#0f4c81]">{s.course.code}</span>
                    </div>
                    <p className="mt-1 font-medium text-slate-900">{s.title}</p>
                    <p className="text-xs text-slate-500">
                      {s.student.fullName} · {kindLabel(s.kind)} · {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} mt-2 text-xs text-slate-400`} />
                </button>

                {isOpen ? (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5 space-y-4">
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-800">Why they shared:</span> {s.reason}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.originalFileName}
                      {s.sizeBytes ? ` · ${formatBytes(s.sizeBytes)}` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => window.open(secureViewPath('suggestion', s.id), '_blank', 'noopener,noreferrer')}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#0f4c81] hover:underline"
                    >
                      <i className="fa-solid fa-eye" aria-hidden />
                      Preview file
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void downloadSecureStream('suggestion', s.id, s.originalFileName).catch((e: Error) =>
                          window.alert(e.message),
                        );
                      }}
                      className="ml-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:underline"
                    >
                      <i className="fa-solid fa-arrow-down-to-bracket" aria-hidden />
                      Download
                    </button>

                    {s.status === 'PENDING' ? (
                      <>
                        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200/80 space-y-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            Publish as (your name on archive)
                          </p>
                          <input
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={publishTitle}
                            onChange={(e) => setPublishTitle(e.target.value)}
                            placeholder="Archive title"
                          />
                          <textarea
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[72px]"
                            value={publishDesc}
                            onChange={(e) => setPublishDesc(e.target.value)}
                            placeholder="Description (optional)"
                          />
                          <p className="text-xs text-slate-500">
                            Compilation credit: <strong>{s.student.fullName}</strong> (student contributor)
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyId === s.id || !publishTitle.trim()}
                            onClick={() => void approve(s.id)}
                            className="rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            Approve & publish
                          </button>
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() => void reject(s.id)}
                            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
                          >
                            Decline
                          </button>
                        </div>
                      </>
                    ) : s.status === 'REJECTED' && s.rejectReason ? (
                      <p className="text-sm text-rose-800">Declined: {s.rejectReason}</p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
