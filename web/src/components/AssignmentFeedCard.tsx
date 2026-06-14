import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenantPaths } from '../hooks/useTenantPaths';
import { useToast } from '../context/ToastContext';
import { buildApiHeaders } from '../lib/api';
import { themeForKind } from '../lib/resourceThemes';
import {
  type Assignment,
  STUDENT_STATUS_META,
  dueCountdown,
  downloadMySubmission,
  downloadQuestionPaper,
  formatDue,
} from '../lib/assignments';

type SubmitResult = {
  status: string;
  submittedAt: string;
  fileName: string;
};

/** Modals must escape the card — its hover transform/overflow would trap `position: fixed`. */
function ModalPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

function AssignmentDownloadStrip({
  assignmentId,
  fileName,
  compact,
}: {
  assignmentId: string;
  fileName: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    try {
      await downloadQuestionPaper(assignmentId, fileName);
      toast({ title: 'Question paper saved', message: fileName, tone: 'success', durationMs: 3600 });
    } catch (e) {
      toast({
        title: 'Download failed',
        message: e instanceof Error ? e.message : 'Try again',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`ula-assignment-download rounded-2xl border border-primary-200/70 bg-gradient-to-br from-primary-50 via-white to-emerald-50/40 shadow-[0_8px_24px_-12px_rgba(20,83,45,0.18)] ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5'
      }`}
      role="region"
      aria-label="Assignment question file"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 ring-1 ring-primary-200/60">
          <i className="fa-solid fa-file-arrow-down text-[14px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-primary-900 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
            {compact ? 'Question paper' : 'Download the question paper before you submit'}
          </p>
          <p className={`mt-0.5 truncate text-dark-500 ${compact ? 'text-[11px]' : 'text-[12px]'}`}>{fileName}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDownload()}
          className={`ula-assignment-download__btn shrink-0 rounded-xl bg-primary-800 font-semibold text-white shadow-[0_4px_14px_rgba(20,83,45,0.22)] hover:bg-primary-900 disabled:opacity-60 ${
            compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-2.5 text-[12px]'
          }`}
        >
          <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-download'} mr-1.5 text-[10px]`} aria-hidden />
          {busy ? 'Saving…' : 'Download'}
        </button>
      </div>
    </div>
  );
}

function StudentSubmissionStrip({
  assignmentId,
  fileName,
  submittedAt,
  status,
  compact,
}: {
  assignmentId: string;
  fileName: string;
  submittedAt: string;
  status: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const meta = STUDENT_STATUS_META[status];

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    try {
      await downloadMySubmission(assignmentId, fileName);
      toast({ title: 'Your copy saved', message: fileName, tone: 'success', durationMs: 3600 });
    } catch (e) {
      toast({
        title: 'Download failed',
        message: e instanceof Error ? e.message : 'Try again',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-white ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <i className="fa-solid fa-circle-check text-[14px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-semibold text-emerald-900 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
              Your submission
            </p>
            {meta ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>
            ) : null}
          </div>
          <p className={`mt-0.5 truncate text-dark-600 ${compact ? 'text-[11px]' : 'text-[12px]'}`}>{fileName}</p>
          <p className="mt-0.5 text-[11px] text-dark-400">Submitted {formatDue(submittedAt)}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDownload()}
          className={`shrink-0 rounded-xl border border-emerald-200 bg-white font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 ${
            compact ? 'px-3 py-2 text-[11px]' : 'px-3.5 py-2.5 text-[12px]'
          }`}
        >
          <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-download'} mr-1 text-[10px]`} aria-hidden />
          {busy ? '…' : 'My copy'}
        </button>
      </div>
    </div>
  );
}

export function AssignmentSubmitModal({
  assignment,
  onClose,
  onSubmitted,
}: {
  assignment: Assignment;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<SubmitResult | null>(null);

  const accept = assignment.allowedTypes.map((t) => `.${t}`).join(',');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function handleSubmit() {
    if (!file) {
      setError('Choose your file first');
      return;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase().replace('jpeg', 'jpg');
    if (!assignment.allowedTypes.includes(ext)) {
      setError(`Allowed types: ${assignment.allowedTypes.map((t) => t.toUpperCase()).join(', ')}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/assignments/${assignment.id}/submit`, {
        method: 'POST',
        headers: buildApiHeaders(),
        body: form,
      });
      const json = (await res.json()) as SubmitResult & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Submission failed');
      setDone(json);
      toast({
        title: json.status === 'LATE' ? 'Submitted (late)' : 'Assignment submitted',
        message: `${json.fileName} received at ${formatDue(json.submittedAt)}`,
        tone: json.status === 'LATE' ? 'info' : 'success',
      });
      onSubmitted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Submission failed';
      setError(msg);
      toast({ title: 'Submission failed', message: msg, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-dark-900/45 p-3 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <i className="fa-solid fa-check text-xl" aria-hidden />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-dark-900">Submitted successfully</h3>
            <dl className="mt-4 space-y-2 rounded-xl bg-dark-50 p-4 text-left text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-dark-400">Time</dt>
                <dd className="font-medium text-dark-800">{formatDue(done.submittedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-dark-400">File</dt>
                <dd className="max-w-[220px] truncate font-medium text-dark-800" title={done.fileName}>
                  {done.fileName}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-dark-400">Status</dt>
                <dd>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STUDENT_STATUS_META[done.status]?.cls}`}>
                    {STUDENT_STATUS_META[done.status]?.label ?? done.status}
                  </span>
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() =>
                  void downloadMySubmission(assignment.id, done.fileName).catch((e) =>
                    toast({
                      title: 'Download failed',
                      message: e instanceof Error ? e.message : 'Try again',
                      tone: 'error',
                    }),
                  )
                }
                className="w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <i className="fa-solid fa-download mr-1.5 text-[12px]" aria-hidden />
                Download my copy
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-primary-800 py-2.5 text-sm font-semibold text-white hover:bg-primary-900"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-primary-700">{assignment.course?.code}</p>
                <h3 className="mt-0.5 text-lg font-semibold leading-snug text-dark-900">{assignment.title}</h3>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-dark-400 hover:bg-dark-50 hover:text-dark-700"
                aria-label="Close"
                onClick={onClose}
              >
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </div>

            <div className="mt-4 space-y-1.5 rounded-xl bg-dark-50 p-4 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className="text-dark-400">Name</span>
                <span className="font-medium text-dark-800">{user?.fullName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-dark-400">Matric number</span>
                <span className="font-mono font-medium text-dark-800">{user?.matricNumber ?? '—'}</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-dark-400">
              Identity is taken from your account — it cannot be edited here.
            </p>

            {assignment.hasAttachment ? (
              <div className="mt-4">
                <AssignmentDownloadStrip
                  assignmentId={assignment.id}
                  fileName={assignment.attachmentName ?? 'assignment-question.pdf'}
                  compact
                />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`mt-4 flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-7 transition ${
                file ? 'border-primary-300 bg-primary-50/50' : 'border-dark-200 hover:border-primary-300 hover:bg-dark-50'
              }`}
            >
              <i
                className={`fa-solid ${file ? 'fa-file-circle-check text-primary-700' : 'fa-cloud-arrow-up text-dark-400'} text-xl`}
                aria-hidden
              />
              {file ? (
                <span className="max-w-full truncate text-[13px] font-medium text-dark-800">{file.name}</span>
              ) : (
                <span className="text-[13px] text-dark-500">Tap to choose your file</span>
              )}
              <span className="text-[11px] uppercase tracking-wide text-dark-400">
                {assignment.allowedTypes.join(' · ')} — max 25 MB
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
                setError('');
              }}
            />

            {error ? <p className="mt-3 text-[13px] text-red-700">{error}</p> : null}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={busy || !file}
              className="mt-4 w-full rounded-xl bg-primary-800 py-3 text-sm font-semibold text-white hover:bg-primary-900 disabled:opacity-50"
            >
              {busy ? 'Submitting…' : 'Submit assignment'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function AssignmentDetailsModal({
  a,
  onClose,
  onSubmit,
  canSubmit,
}: {
  a: Assignment;
  onClose: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-dark-900/45 p-3 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold text-primary-700">
              {a.course?.code} — {a.course?.title}
            </p>
            <h3 className="mt-1 text-xl font-semibold text-dark-900">{a.title}</h3>
            {a.lecturerName ? <p className="mt-1 text-[13px] text-dark-500">By {a.lecturerName}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-dark-400 hover:bg-dark-50 hover:text-dark-700"
            aria-label="Close"
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
          <div className="rounded-xl bg-dark-50 p-3">
            <dt className="text-dark-400">Posted</dt>
            <dd className="mt-0.5 font-medium text-dark-800">{new Date(a.createdAt).toLocaleDateString()}</dd>
          </div>
          <div className="rounded-xl bg-dark-50 p-3">
            <dt className="text-dark-400">Due</dt>
            <dd className="mt-0.5 font-medium text-dark-800">{formatDue(a.dueAt)}</dd>
          </div>
        </dl>

        {a.description ? (
          <section className="mt-4">
            <h4 className="text-[13px] font-semibold text-dark-700">Description</h4>
            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-dark-600">{a.description}</p>
          </section>
        ) : null}
        {a.instructions ? (
          <section className="mt-4">
            <h4 className="text-[13px] font-semibold text-dark-700">Instructions</h4>
            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-dark-600">{a.instructions}</p>
          </section>
        ) : null}

        {a.hasAttachment ? (
          <div className="mt-4">
            <AssignmentDownloadStrip
              assignmentId={a.id}
              fileName={a.attachmentName ?? 'assignment-question.pdf'}
            />
          </div>
        ) : null}

        <p className="mt-4 text-[12px] text-dark-400">
          Allowed: {a.allowedTypes.map((t) => t.toUpperCase()).join(', ')}
        </p>

        {a.mySubmission ? (
          <div className="mt-4">
            <StudentSubmissionStrip
              assignmentId={a.id}
              fileName={a.mySubmission.fileName}
              submittedAt={a.mySubmission.submittedAt}
              status={a.mySubmission.status}
            />
          </div>
        ) : null}

        {canSubmit && a.status !== 'CLOSED' ? (
          <button
            type="button"
            onClick={onSubmit}
            className="mt-5 w-full rounded-xl bg-primary-800 py-3 text-sm font-semibold text-white hover:bg-primary-900"
          >
            {a.mySubmission ? 'Resubmit' : 'Submit assignment'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Assignment card in the public catalogue — same shape as resource cards, with a clear badge. */
export function AssignmentFeedCard({ a, onChanged }: { a: Assignment; onChanged: () => void }) {
  const { user } = useAuth();
  const location = useLocation();
  const paths = useTenantPaths();
  const theme = themeForKind('ASSIGNMENT');
  const isStudent = user?.role === 'STUDENT';
  const duePassed = new Date(a.dueAt).getTime() < Date.now();
  const closed = a.status === 'CLOSED' || duePassed;
  const countdown = dueCountdown(a.dueAt);
  const statusMeta = isStudent ? STUDENT_STATUS_META[a.myStatus ?? 'NOT_SUBMITTED'] : null;

  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState(false);

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-dark-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-[box-shadow,border-color,transform] duration-300 hover:-translate-y-px hover:border-dark-300/90 hover:shadow-[0_8px_30px_-12px_rgba(15,23,42,0.08)] ${theme.glow}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.ribbon}`} aria-hidden />

      <header className="relative mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${theme.badge}`}
        >
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${theme.iconBox}`}>
            <i className="fa-solid fa-pen-to-square text-[13px]" aria-hidden />
          </span>
          Assignment
        </div>
        {statusMeta && (a.myStatus !== 'NOT_SUBMITTED' || !closed) ? (
          <span className={`mt-0.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
        ) : closed ? (
          <span className="mt-0.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            Closed
          </span>
        ) : null}
      </header>

      <div className="mb-4 space-y-1.5">
        <p className="text-[13px] font-semibold tracking-wide text-primary-700">{a.course?.code}</p>
        <h3 className="text-[17px] font-semibold leading-snug tracking-tight text-dark-900 md:text-lg">{a.title}</h3>
        <p className="text-[14px] leading-snug text-dark-500">{a.course?.title}</p>
        {a.description ? <p className="line-clamp-2 text-[13px] leading-snug text-dark-500">{a.description}</p> : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-dark-500">
        {a.course?.department?.name ? (
          <span className="inline-flex items-center gap-1.5">
            <i className="fa-solid fa-sitemap text-[10px] text-dark-400" aria-hidden />
            {a.course.department.name}
          </span>
        ) : null}
        {a.lecturerName ? (
          <span className="inline-flex items-center gap-1.5">
            <i className="fa-solid fa-user text-[10px] text-dark-400" aria-hidden />
            {a.lecturerName}
          </span>
        ) : null}
      </div>

      {a.mySubmission && isStudent ? (
        <div className="mb-4">
          <StudentSubmissionStrip
            assignmentId={a.id}
            fileName={a.mySubmission.fileName}
            submittedAt={a.mySubmission.submittedAt}
            status={a.mySubmission.status}
            compact
          />
        </div>
      ) : a.hasAttachment ? (
        <div className="mb-4">
          <AssignmentDownloadStrip
            assignmentId={a.id}
            fileName={a.attachmentName ?? 'assignment-question.pdf'}
            compact
          />
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="inline-flex items-center gap-1.5 text-dark-600">
          <i className="fa-regular fa-calendar text-[11px] text-dark-400" aria-hidden />
          Due {formatDue(a.dueAt)}
        </span>
        {!closed && (!isStudent || a.myStatus === 'NOT_SUBMITTED') ? (
          <span className={`text-[12px] font-medium ${countdown.urgent ? 'text-amber-600' : 'text-dark-400'}`}>
            {countdown.text}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-3">
        {!closed ? (
          isStudent ? (
            <button
              type="button"
              onClick={() => setSubmitting(true)}
              className="w-full rounded-xl bg-primary-800 px-4 py-3 text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(20,83,45,0.2)] hover:bg-primary-900"
            >
              <i
                className={`fa-solid ${a.myStatus === 'NOT_SUBMITTED' ? 'fa-cloud-arrow-up' : 'fa-arrows-rotate'} mr-2 text-[12px]`}
                aria-hidden
              />
              {a.myStatus === 'NOT_SUBMITTED' ? 'Submit assignment' : 'Resubmit work'}
            </button>
          ) : !user ? (
            <Link
              to={paths.login}
              state={{ from: location.pathname }}
              className="flex w-full items-center justify-center rounded-xl bg-primary-800 px-4 py-3 text-[14px] font-semibold text-white hover:bg-primary-900"
            >
              Sign in to submit
            </Link>
          ) : null
        ) : a.mySubmission && isStudent ? (
          <span className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-800 ring-1 ring-emerald-100">
            <i className="fa-solid fa-check text-[12px]" aria-hidden />
            Submitted — download your copy above
          </span>
        ) : (
          <span className="flex items-center justify-center rounded-xl bg-dark-50 px-4 py-2.5 text-[13px] font-medium text-dark-400">
            Submissions closed
          </span>
        )}
        <button
          type="button"
          onClick={() => setDetails(true)}
          className="w-full rounded-xl border border-dark-200/80 bg-white py-2.5 text-[13px] font-medium text-dark-600 hover:bg-dark-50"
        >
          View full details
        </button>
      </div>

      {details ? (
        <ModalPortal>
          <AssignmentDetailsModal
            a={a}
            canSubmit={Boolean(isStudent) && !closed}
            onClose={() => setDetails(false)}
            onSubmit={() => {
              setDetails(false);
              setSubmitting(true);
            }}
          />
        </ModalPortal>
      ) : null}

      {submitting ? (
        <ModalPortal>
          <AssignmentSubmitModal
            assignment={a}
            onClose={() => setSubmitting(false)}
            onSubmitted={onChanged}
          />
        </ModalPortal>
      ) : null}
    </article>
  );
}
