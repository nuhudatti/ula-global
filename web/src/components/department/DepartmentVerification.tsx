import { api } from '../../lib/api';

type QueueItem = {
  id: string;
  title: string;
  kind: string;
  governanceStatus: string;
  createdAt: string;
  uploadedBy: { fullName: string };
  course: { code: string };
};

export function DepartmentVerification({
  queue,
  loading,
  onRefresh,
}: {
  queue: QueueItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  async function verify(id: string) {
    await api(`/api/department/resources/${id}/governance`, {
      method: 'PATCH',
      body: JSON.stringify({ governanceStatus: 'VERIFIED' }),
    });
    onRefresh();
  }

  const pending = queue.filter((q) => q.governanceStatus !== 'VERIFIED');

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Verification queue</h2>
        <p className="text-sm text-slate-500">
          Lecturers are trusted — new uploads publish automatically. This queue is only used if manual review
          was requested.
        </p>
      </div>

      <div className="ula-dept-surface">
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-500">Loading queue…</p>
        ) : pending.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <i className="fa-solid fa-shield-check" />
            </div>
            <p className="font-semibold text-slate-900">No approval needed</p>
            <p className="mt-1 text-sm text-slate-500">
              Lecturer uploads go live immediately. Nothing is waiting for HOD approval.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {item.course.code} · {item.uploadedBy.fullName} · {item.kind}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void verify(item.id)}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Approve & verify
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
