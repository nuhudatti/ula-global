import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';

type Notice = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  createdBy: { fullName: string };
};

export function DepartmentNotices({
  notices,
  loading,
  onRefresh,
}: {
  notices: Notice[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await api('/api/department/notices', {
        method: 'POST',
        body: JSON.stringify({ title, body }),
      });
      setTitle('');
      setBody('');
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post notice');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Department notices</h2>
        <p className="text-sm text-slate-500">Institutional communications for your academic unit.</p>
      </div>

      <form onSubmit={onSubmit} className="ula-dept-surface space-y-4 p-6">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Title</label>
          <input
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Message</label>
          <textarea
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 min-h-[100px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#0f4c81] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Publishing…' : 'Publish notice'}
        </button>
      </form>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading notices…</p>
        ) : notices.length === 0 ? (
          <div className="ula-dept-surface p-10 text-center text-sm text-slate-500">
            No notices published. Share guidance with lecturers and students.
          </div>
        ) : (
          notices.map((n) => (
            <article key={n.id} className="ula-dept-surface p-5">
              <div className="flex justify-between gap-4">
                <h3 className="font-semibold text-slate-900">{n.title}</h3>
                <time className="shrink-0 text-xs text-slate-400">
                  {new Date(n.createdAt).toLocaleDateString()}
                </time>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{n.body}</p>
              <p className="mt-3 text-xs text-slate-400">— {n.createdBy.fullName}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
