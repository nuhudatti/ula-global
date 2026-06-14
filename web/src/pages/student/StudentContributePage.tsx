import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, buildApiHeaders } from '../../lib/api';
import { formatBytes } from '../../lib/format';
import {
  type MaterialSuggestion,
  type StudentAccess,
  SUGGEST_KINDS,
  SUGGEST_STATUS,
} from '../../lib/suggestions';
import '../../styles/student-contribute.css';

const MAX_BYTES = 15 * 1024 * 1024;

type Course = { id: string; code: string; title: string };

const fieldCls =
  'w-full rounded-xl border-0 bg-white py-3 px-4 text-[15px] text-dark-900 ring-1 ring-dark-200/70 focus:ring-2 focus:ring-[#0f4c81]/20';

export function StudentContributePage() {
  const { user } = useAuth();
  const [access, setAccess] = useState<StudentAccess | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [mine, setMine] = useState<MaterialSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [permissionId, setPermissionId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [kind, setKind] = useState('PAST_QUESTIONS');
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(y - i));
  }, []);

  const refresh = useCallback(async () => {
    const [acc, crs, subs] = await Promise.all([
      api<StudentAccess>('/api/suggestions/student/access'),
      api<Course[]>('/api/suggestions/student/courses'),
      api<MaterialSuggestion[]>('/api/suggestions/student/mine'),
    ]);
    setAccess(acc);
    setCourses(crs);
    setMine(subs);
    setPermissionId((prev) => prev || acc.permissions[0]?.id || '');
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const selectedLecturer = access?.permissions.find((p) => p.id === permissionId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !permissionId || !courseId || !title.trim() || !reason.trim() || !confirm) {
      setMsg({ type: 'err', text: 'Complete all fields, attach a file, and confirm.' });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMsg({ type: 'err', text: `File too large (max ${formatBytes(MAX_BYTES)}).` });
      return;
    }

    setSubmitting(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('permissionId', permissionId);
      fd.append('courseId', courseId);
      fd.append('title', title.trim());
      fd.append('reason', reason.trim());
      fd.append('kind', kind);
      fd.append('examYear', examYear);
      fd.append('confirm', 'true');

      const res = await fetch('/api/suggestions/student', {
        method: 'POST',
        headers: buildApiHeaders(),
        body: fd,
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || res.statusText);
      }

      setTitle('');
      setReason('');
      setFile(null);
      setConfirm(false);
      setCourseId('');
      setMsg({
        type: 'ok',
        text: `Sent to ${selectedLecturer?.lecturer.fullName ?? 'your lecturer'}. You'll see status below when reviewed.`,
      });
      await refresh();
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="ula-contribute-root flex items-center justify-center px-4 py-20">
        <p className="text-sm text-dark-500">Loading…</p>
      </div>
    );
  }

  if (!access?.canContribute) {
    return (
      <div className="ula-contribute-root mx-auto max-w-lg px-4 py-16">
        <div className="ula-contribute-card px-8 py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <i className="fa-solid fa-lock text-2xl" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-dark-900">Contribution by invitation</h1>
          <p className="mt-3 text-sm leading-relaxed text-dark-500">
            {access?.reason === 'no_department'
              ? 'Your account is not linked to a department yet. Contact your faculty office.'
              : 'A lecturer in your department must allow you before you can suggest materials. Ask your course lecturer to enable you in their workspace.'}
          </p>
          <Link to="/" className="mt-8 inline-block text-sm font-semibold text-[#0f4c81] hover:underline">
            Back to catalogue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ula-contribute-root mx-auto max-w-2xl px-4 py-8 md:py-12">
      <header className="ula-contribute-hero mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f4c81]">Student contribution</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-dark-900">
          Suggest material, {user?.fullName?.split(' ')[0]}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-dark-600">
          Your lecturer reviews every submission. Nothing goes public until they approve and publish under their
          name — with you credited as compilation contributor.
        </p>
        {access.pendingCount > 0 ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            <i className="fa-solid fa-hourglass-half" aria-hidden />
            {access.pendingCount} awaiting review (max {access.maxPending} pending)
          </p>
        ) : null}
      </header>

      {msg ? (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            msg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="ula-contribute-card p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-dark-400">Submit to</h2>
          {access.permissions.map((p) => (
            <button
              key={p.id}
              type="button"
              className="ula-contribute-lecturer-pill"
              data-active={permissionId === p.id}
              onClick={() => setPermissionId(p.id)}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f4c81]/10 text-[#0f4c81]">
                <i className="fa-solid fa-chalkboard-user" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-dark-900">{p.lecturer.fullName}</span>
                <span className="block truncate text-xs text-dark-500">{p.lecturer.email}</span>
                {p.note ? <span className="mt-1 block text-xs text-dark-400">{p.note}</span> : null}
              </span>
            </button>
          ))}
        </section>

        <section className="ula-contribute-card p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-dark-400">Material details</h2>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-dark-600">Course</label>
            <select className={fieldCls} value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-dark-600">Title</label>
            <input
              className={fieldCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. CSC212 — 2024 CAT past questions"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-dark-600">Why should this be in the archive?</label>
            <textarea
              className={`${fieldCls} min-h-[88px]`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={280}
              placeholder="One or two sentences — exam session, topic, why peers need this…"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-dark-600">Type</label>
              <select className={fieldCls} value={kind} onChange={(e) => setKind(e.target.value)}>
                {SUGGEST_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-dark-600">Session year</label>
              <select className={fieldCls} value={examYear} onChange={(e) => setExamYear(e.target.value)}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="ula-contribute-card p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-dark-400">File</h2>
          <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-dark-200/80 bg-dark-50/50 px-6 py-10 text-center hover:border-[#0f4c81]/40">
            <i className="fa-solid fa-file-arrow-up mb-3 text-2xl text-[#0f4c81]" aria-hidden />
            <span className="text-sm font-medium text-dark-800">{file ? file.name : 'Choose PDF or document'}</span>
            <span className="mt-1 text-xs text-dark-400">Max {formatBytes(MAX_BYTES)}</span>
            <input
              type="file"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="flex items-start gap-3 text-sm text-dark-600">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              className="mt-1 rounded"
            />
            <span>I confirm this is course-related, appropriate, and I have the right to share it.</span>
          </label>
        </section>

        <button
          type="submit"
          disabled={submitting || access.pendingCount >= access.maxPending}
          className="w-full rounded-xl bg-[#0f4c81] py-3.5 text-[15px] font-semibold text-white shadow-sm hover:bg-[#0c3d66] disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Send to lecturer for review'}
        </button>
      </form>

      {mine.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-xs font-bold uppercase tracking-wider text-dark-400">Your submissions</h2>
          <ul className="mt-3 space-y-2">
            {mine.map((s) => {
              const st = SUGGEST_STATUS[s.status] ?? { label: s.status, tone: 'slate' as const };
              return (
                <li key={s.id} className="ula-contribute-card flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-dark-900">{s.title}</p>
                    <p className="text-xs text-dark-500">
                      {s.course.code} · {s.lecturer?.fullName}
                    </p>
                  </div>
                  <span className="ula-contribute-status shrink-0" data-tone={st.tone}>
                    {st.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
