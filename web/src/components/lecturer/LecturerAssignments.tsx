import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, buildApiHeaders } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { fileExt, formatBytes } from '../../lib/format';
import type { LecturerCourse } from '../../lib/lecturer';
import {
  type Assignment,
  type SubmissionRow,
  downloadAssignmentExport,
  downloadSubmissionFile,
  formatDue,
} from '../../lib/assignments';
import { CourseTypeIn, isCourseTypeInValid, type CourseTypeInValue } from './CourseTypeIn';

const ALL_TYPES = ['pdf', 'docx', 'pptx', 'zip', 'png', 'jpg'];
const ATTACH_MAX_BYTES = 25 * 1024 * 1024;
const ATTACH_MAX_LABEL = '25 MB';

const inputCls =
  'w-full rounded-xl border-0 bg-dark-50 py-2.5 px-3 text-sm text-dark-800 ring-1 ring-dark-200 focus:ring-2 focus:ring-primary-500';

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'bg-emerald-50 text-emerald-700',
    CLOSED: 'bg-slate-100 text-slate-600',
    SUBMITTED: 'bg-emerald-50 text-emerald-700',
    LATE: 'bg-amber-50 text-amber-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function CreateAssignmentForm({
  courses,
  departmentName,
  onCreated,
  onCancel,
}: {
  courses: LecturerCourse[];
  departmentName?: string;
  onCreated: (title: string, courseCode: string) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [courseFields, setCourseFields] = useState<CourseTypeInValue>({ code: '', title: '' });
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [types, setTypes] = useState<string[]>(['pdf', 'docx']);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachPreviewUrl, setAttachPreviewUrl] = useState<string | null>(null);
  const [attachDragOver, setAttachDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!attachment) {
      setAttachPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(attachment);
    setAttachPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  const canPreviewAttachment = Boolean(
    attachment && (attachment.type === 'application/pdf' || attachment.type.startsWith('image/')),
  );

  const attachmentTypeIcon = useMemo(() => {
    if (!attachment) return 'fa-file-lines';
    const ext = attachment.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return 'fa-file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'fa-file-word';
    if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint';
    if (['zip', 'rar'].includes(ext)) return 'fa-file-zipper';
    if (attachment.type.startsWith('image/')) return 'fa-file-image';
    return 'fa-file-lines';
  }, [attachment]);

  const pickAttachment = useCallback(
    (next: File | null, input?: HTMLInputElement | null) => {
      if (!next) {
        setAttachment(null);
        return;
      }
      if (next.size > ATTACH_MAX_BYTES) {
        toast({
          title: 'File too large',
          message: `${formatBytes(next.size)} exceeds the ${ATTACH_MAX_LABEL} limit.`,
          tone: 'error',
        });
        setAttachment(null);
        if (input) input.value = '';
        return;
      }
      setAttachment(next);
    },
    [toast],
  );

  function toggleType(t: string) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function resolveCourse(): Promise<string> {
    const resolved = await api<LecturerCourse>('/api/meta/my-courses/resolve', {
      method: 'POST',
      body: JSON.stringify({ code: courseFields.code, title: courseFields.title }),
    });
    setCourseId(resolved.id);
    return resolved.id;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isCourseTypeInValid(courseFields)) {
      toast({ title: 'Course required', message: 'Enter a course code and title.', tone: 'error' });
      return;
    }
    if (!dueAt) {
      toast({ title: 'Due date required', message: 'Set when submissions close.', tone: 'error' });
      return;
    }
    if (!types.length) {
      toast({ title: 'File types required', message: 'Allow at least one submission format.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const id = courseId || (await resolveCourse());
      const form = new FormData();
      form.append('courseId', id);
      form.append('title', title);
      form.append('description', description);
      form.append('instructions', instructions);
      form.append('dueAt', new Date(dueAt).toISOString());
      form.append('allowedTypes', types.join(','));
      if (attachment) form.append('attachment', attachment);

      const res = await fetch('/api/assignments', { method: 'POST', headers: buildApiHeaders(), body: form });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not create assignment');
      toast({
        title: 'Assignment published',
        message: `${title.trim()} is live for ${courseFields.code} students.`,
        tone: 'success',
      });
      onCreated(title.trim(), courseFields.code);
    } catch (err) {
      toast({
        title: 'Could not publish',
        message: err instanceof Error ? err.message : 'Try again in a moment.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="ula-lecturer-surface space-y-4 p-6 animate-in">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-dark-900">New assignment</h3>
        <button type="button" className="text-[13px] font-medium text-dark-500 hover:text-dark-800" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <CourseTypeIn
        courses={courses}
        value={courseFields}
        onChange={(next) => {
          setCourseFields(next);
          setCourseId('');
        }}
        departmentName={departmentName}
        newCourseHint="New course — added to your department catalogue when you publish"
      />
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-dark-700">Due date</label>
        <input
          type="datetime-local"
          className={inputCls}
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-dark-700">Title</label>
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Assignment 2 — Normalisation"
          maxLength={160}
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-dark-700">Description</label>
        <textarea
          className={inputCls}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What students should do (optional)"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-dark-700">Instructions</label>
        <textarea
          className={inputCls}
          rows={2}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Submission rules, format notes (optional)"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-dark-700">
          Question file <span className="font-normal text-dark-400">(optional — students download before submitting)</span>
        </label>
        <section
          className="ula-publish-attach"
          data-ready={attachment ? 'true' : 'false'}
          data-active={attachDragOver ? 'true' : 'false'}
          onDragOver={(e) => {
            e.preventDefault();
            setAttachDragOver(true);
          }}
          onDragLeave={() => setAttachDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setAttachDragOver(false);
            pickAttachment(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          {attachment ? (
            <div className="ula-publish-attach__ready">
              <div className="ula-publish-attach__preview">
                {canPreviewAttachment && attachPreviewUrl ? (
                  attachment.type === 'application/pdf' ? (
                    <iframe src={attachPreviewUrl} title="Question preview" className="ula-publish-attach__iframe" />
                  ) : (
                    <img src={attachPreviewUrl} alt="" className="ula-publish-attach__thumb" />
                  )
                ) : (
                  <div className="ula-publish-attach__icon-fallback">
                    <i className={`fa-solid ${attachmentTypeIcon} text-2xl text-primary-600`} aria-hidden />
                    <span className="mt-2 rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-800">
                      {fileExt(attachment.name)}
                    </span>
                  </div>
                )}
              </div>
              <div className="ula-publish-attach__meta">
                <span className="ula-publish-attach__badge">
                  <i className="fa-solid fa-circle-check text-[10px]" aria-hidden />
                  Question attached
                </span>
                <p className="ula-publish-attach__name" title={attachment.name}>
                  {attachment.name}
                </p>
                <p className="ula-publish-attach__size">
                  {formatBytes(attachment.size)} · {fileExt(attachment.name)}
                </p>
                <p className="mt-1 text-[11px] text-primary-700/75">Students will see a download button for this file.</p>
                <div className="ula-publish-attach__actions">
                  <label className="ula-publish-attach__btn ula-publish-attach__btn--primary">
                    <i className="fa-solid fa-arrows-rotate text-[11px]" aria-hidden />
                    Replace
                    <input
                      type="file"
                      accept=".pdf,.docx,.pptx,.zip,.png,.jpg,.jpeg"
                      className="sr-only"
                      onChange={(e) => pickAttachment(e.target.files?.[0] ?? null, e.target)}
                    />
                  </label>
                  <button
                    type="button"
                    className="ula-publish-attach__btn ula-publish-attach__btn--ghost"
                    onClick={() => pickAttachment(null)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="ula-publish-attach__empty">
              <div className="ula-publish-attach__empty-icon">
                <i className="fa-solid fa-file-arrow-up text-xl" aria-hidden />
              </div>
              <p className="text-[15px] font-semibold text-dark-900 sm:text-base">Attach the question paper</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-dark-500">
                Optional — PDF, Word, slides, or images up to {ATTACH_MAX_LABEL}
              </p>
              <label className="ula-publish-attach__choose">
                <i className="fa-solid fa-folder-open text-[13px]" aria-hidden />
                Choose file
                <input
                  type="file"
                  accept=".pdf,.docx,.pptx,.zip,.png,.jpg,.jpeg"
                  className="sr-only"
                  onChange={(e) => pickAttachment(e.target.files?.[0] ?? null, e.target)}
                />
              </label>
            </div>
          )}
        </section>
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-dark-700">Allowed file types</label>
        <div className="flex flex-wrap gap-2">
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase transition ${
                types.includes(t)
                  ? 'bg-primary-800 text-white'
                  : 'bg-dark-50 text-dark-500 ring-1 ring-dark-200 hover:bg-dark-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-primary-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-900 disabled:opacity-50"
      >
        {busy ? 'Publishing…' : 'Publish assignment'}
      </button>
    </form>
  );
}

function SubmissionsPanel({ assignment, onBack }: { assignment: Assignment; onBack: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [busyAction, setBusyAction] = useState('');

  useEffect(() => {
    api<{ submissions: SubmissionRow[]; totalStudents: number }>(
      `/api/assignments/${assignment.id}/submissions`,
    )
      .then((res) => {
        setRows(res.submissions);
        setTotalStudents(res.totalStudents);
      })
      .catch((e) =>
        toast({
          title: 'Could not load submissions',
          message: e instanceof Error ? e.message : 'Refresh the page.',
          tone: 'error',
        }),
      )
      .finally(() => setLoading(false));
  }, [assignment.id, toast]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = rows;
    if (term) {
      list = list.filter(
        (r) =>
          r.studentName.toLowerCase().includes(term) || r.matricNumber.toLowerCase().includes(term),
      );
    }
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    return [...list].sort((a, b) => {
      const d = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      return sortAsc ? d : -d;
    });
  }, [rows, q, statusFilter, sortAsc]);

  async function handleDownload(kind: 'zip' | 'csv') {
    setBusyAction(kind);
    try {
      const path =
        kind === 'zip'
          ? `/api/assignments/${assignment.id}/download.zip`
          : `/api/assignments/${assignment.id}/export.csv`;
      await downloadAssignmentExport(path, `${assignment.course?.code ?? 'course'}_submissions.${kind}`);
      toast({
        title: kind === 'zip' ? 'ZIP ready' : 'CSV exported',
        message:
          kind === 'zip'
            ? `${rows.length} submission${rows.length === 1 ? '' : 's'} packaged for download.`
            : 'Spreadsheet saved to your downloads folder.',
        tone: 'success',
      });
    } catch (e) {
      toast({
        title: 'Download failed',
        message: e instanceof Error ? e.message : 'Try again in a moment.',
        tone: 'error',
      });
    } finally {
      setBusyAction('');
    }
  }

  return (
    <div className="space-y-5 animate-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="text-[13px] font-medium text-primary-700 hover:underline">
            <i className="fa-solid fa-arrow-left mr-1.5" aria-hidden />
            All assignments
          </button>
          <h2 className="mt-2 text-xl font-semibold text-dark-900">
            {assignment.course?.code} — {assignment.title}
          </h2>
          <p className="mt-1 text-[13px] text-dark-500">
            Due {formatDue(assignment.dueAt)} · {rows.length}/{totalStudents} submitted
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleDownload('csv')}
            disabled={busyAction !== '' || rows.length === 0}
            className="rounded-xl border border-dark-200 bg-white px-4 py-2 text-[13px] font-semibold text-dark-700 hover:bg-dark-50 disabled:opacity-50"
          >
            {busyAction === 'csv' ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={() => void handleDownload('zip')}
            disabled={busyAction !== '' || rows.length === 0}
            className="rounded-xl bg-primary-800 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50"
          >
            {busyAction === 'zip' ? 'Packaging…' : 'Download all ZIP'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="w-64 rounded-xl border-0 bg-dark-50 py-2 px-3 text-[13px] ring-1 ring-dark-200"
          placeholder="Search name or matric…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-xl border-0 bg-dark-50 py-2 px-3 text-[13px] ring-1 ring-dark-200"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="LATE">Late</option>
        </select>
        <button
          type="button"
          className="rounded-xl border border-dark-200 bg-white px-3 py-2 text-[12px] font-medium text-dark-600 hover:bg-dark-50"
          onClick={() => setSortAsc((s) => !s)}
        >
          Time {sortAsc ? '↑' : '↓'}
        </button>
      </div>

      <div className="ula-lecturer-surface overflow-x-auto">
        {loading ? (
          <p className="p-8 text-center text-sm text-dark-500">Loading submissions…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-dark-500">
            {rows.length === 0 ? 'No submissions yet.' : 'No matches for your search.'}
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-dark-100 text-[11px] uppercase tracking-wide text-dark-400">
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Matric number</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">File</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-dark-50 last:border-0 hover:bg-dark-50/50">
                  <td className="px-4 py-3 font-medium text-dark-900">{r.studentName}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-dark-600">{r.matricNumber}</td>
                  <td className="px-4 py-3 text-dark-600">{formatDue(r.submittedAt)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-dark-600" title={r.fileName}>
                    {r.fileName}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        void downloadSubmissionFile(r.id, r.fileName).catch((e: Error) =>
                          toast({ title: 'Download failed', message: e.message, tone: 'error' }),
                        );
                      }}
                      className="font-semibold text-primary-700 hover:underline"
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function LecturerAssignments({
  courses,
  departmentName,
}: {
  courses: LecturerCourse[];
  departmentName?: string;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [extendValue, setExtendValue] = useState('');
  const [extendBusy, setExtendBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: Assignment[] }>('/api/assignments/lecturer');
      setItems(res.items);
    } catch (e) {
      toast({
        title: 'Could not load assignments',
        message: e instanceof Error ? e.message : 'Refresh the page.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus(a: Assignment) {
    try {
      await api(`/api/assignments/${a.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: a.status === 'OPEN' ? 'CLOSED' : 'OPEN' }),
      });
      await load();
      toast({
        title: a.status === 'OPEN' ? 'Assignment closed' : 'Assignment reopened',
        message: a.title,
        tone: 'info',
      });
    } catch (e) {
      toast({
        title: 'Update failed',
        message: e instanceof Error ? e.message : 'Try again.',
        tone: 'error',
      });
    }
  }

  async function extendDueDate(a: Assignment) {
    if (!extendValue) return;
    setExtendBusy(true);
    try {
      await api(`/api/assignments/${a.id}/due-date`, {
        method: 'PATCH',
        body: JSON.stringify({ dueAt: new Date(extendValue).toISOString() }),
      });
      setExtendingId(null);
      setExtendValue('');
      await load();
      toast({
        title: 'Due date extended',
        message: `Submissions reopened for ${a.title}.`,
        tone: 'success',
      });
    } catch (e) {
      toast({
        title: 'Could not extend',
        message: e instanceof Error ? e.message : 'Pick a future date.',
        tone: 'error',
      });
    } finally {
      setExtendBusy(false);
    }
  }

  if (selected) return <SubmissionsPanel assignment={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-dark-900">Assignments</h2>
          <p className="mt-1 text-[14px] text-dark-500">
            Post coursework, track submissions, download everything in one click.
          </p>
        </div>
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-xl bg-primary-800 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-900"
          >
            <i className="fa-solid fa-plus mr-2" aria-hidden />
            New assignment
          </button>
        ) : null}
      </header>

      {creating ? (
        <CreateAssignmentForm
          courses={courses}
          departmentName={departmentName}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      ) : null}

      {loading ? (
        <div className="ula-lecturer-surface p-10 text-center text-sm text-dark-500">Loading assignments…</div>
      ) : items.length === 0 && !creating ? (
        <div className="ula-lecturer-surface p-10 text-center">
          <p className="text-[15px] font-medium text-dark-700">No assignments yet</p>
          <p className="mt-2 text-[13px] text-dark-500">
            Create your first assignment — students in your department see it instantly.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((a) => (
            <article key={a.id} className="ula-lecturer-surface flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-primary-700">{a.course?.code}</p>
                  <h3 className="mt-0.5 truncate font-semibold text-dark-900" title={a.title}>
                    {a.title}
                  </h3>
                </div>
                <StatusPill status={a.status} />
              </div>
              <p className="mt-2 text-[13px] text-dark-500">
                Due {formatDue(a.dueAt)}
                {new Date(a.dueAt).getTime() < Date.now() ? (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    Submissions closed
                  </span>
                ) : null}
              </p>

              {extendingId === a.id ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-dark-50 p-3">
                  <input
                    type="datetime-local"
                    className="flex-1 rounded-lg border-0 bg-white py-2 px-3 text-[13px] ring-1 ring-dark-200"
                    value={extendValue}
                    onChange={(e) => setExtendValue(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={extendBusy || !extendValue}
                    onClick={() => void extendDueDate(a)}
                    className="rounded-lg bg-primary-800 px-3 py-2 text-[12px] font-semibold text-white hover:bg-primary-900 disabled:opacity-50"
                  >
                    {extendBusy ? 'Saving…' : 'Save new due date'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExtendingId(null);
                      setExtendValue('');
                    }}
                    className="px-2 text-[12px] font-medium text-dark-500 hover:text-dark-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}

              {a.stats ? (
                <>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: 'Students', value: a.stats.totalStudents },
                      { label: 'Submitted', value: a.stats.submitted },
                      { label: 'Pending', value: a.stats.pending },
                      { label: 'Late', value: a.stats.late },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl bg-dark-50 px-2 py-2.5">
                        <p className="text-lg font-semibold tabular-nums text-dark-900">{s.value}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-dark-400">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-dark-100">
                      <div
                        className="h-full rounded-full bg-primary-700 transition-all"
                        style={{ width: `${a.stats.completionPct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] font-medium text-dark-400">
                      {a.stats.completionPct}% complete
                    </p>
                  </div>
                </>
              ) : null}

              <div className="mt-4 flex gap-2 border-t border-dark-50 pt-4">
                <button
                  type="button"
                  onClick={() => setSelected(a)}
                  className="flex-1 rounded-xl bg-primary-800 px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-900"
                >
                  View submissions
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExtendingId(extendingId === a.id ? null : a.id);
                    setExtendValue('');
                  }}
                  className="rounded-xl border border-dark-200 bg-white px-3 py-2 text-[13px] font-medium text-dark-600 hover:bg-dark-50"
                >
                  Extend
                </button>
                <button
                  type="button"
                  onClick={() => void toggleStatus(a)}
                  className="rounded-xl border border-dark-200 bg-white px-3 py-2 text-[13px] font-medium text-dark-600 hover:bg-dark-50"
                >
                  {a.status === 'OPEN' ? 'Close' : 'Reopen'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
