import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { fileExt, formatBytes } from '../../lib/format';
import { canShowAttachThumbnail, canShowFilePreview, FilePreviewPane } from '../FilePreviewPane';
import { DocumentPreviewModal } from '../DocumentPreviewModal';
import { PUBLISH_KINDS, kindLabel, type LecturerCourse } from '../../lib/lecturer';
import { CourseTypeIn, isCourseTypeInValid, type CourseTypeInValue } from './CourseTypeIn';

const MAX_BYTES = 40 * 1024 * 1024;
const MAX_LABEL = '40 MB';

const fieldCls =
  'w-full rounded-xl border-0 bg-white py-3 px-4 text-[15px] text-dark-900 ring-1 ring-dark-200/70 transition placeholder:text-dark-400 focus:ring-2 focus:ring-primary-600/20';

/**
 * Academic sessions in 2025/2026 format, generated from the system clock —
 * when a new academic year starts (September), it appears automatically.
 */
export function buildAcademicSessions(count = 6): { value: string; label: string }[] {
  const now = new Date();
  // From September the new session (e.g. 2026/2027) is the active one.
  const activeStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => {
    const start = activeStart - i;
    return { value: String(start), label: `${start}/${start + 1}` };
  });
}

type Props = {
  courses: LecturerCourse[];
  departmentName?: string;
  onPublished: () => void;
};

export function PublishWizard({ courses, departmentName, onPublished }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<'details' | 'review'>('details');
  const [courseFields, setCourseFields] = useState<CourseTypeInValue>({ code: '', title: '' });
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [kind, setKind] = useState('LECTURE_NOTES');
  const sessions = useMemo(() => buildAcademicSessions(), []);
  const [examYear, setExamYear] = useState(sessions[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [resolvingCourse, setResolvingCourse] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [reviewPreviewReady, setReviewPreviewReady] = useState(false);

  const sessionLabel = sessions.find((s) => s.value === examYear)?.label ?? examYear;

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canPreviewInline = canShowFilePreview(file);

  // Resolve course in the background so "Review" opens instantly.
  useEffect(() => {
    if (!isCourseTypeInValid(courseFields)) {
      setCourseId('');
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api<LecturerCourse>('/api/meta/my-courses/resolve', {
        method: 'POST',
        body: JSON.stringify({ code: courseFields.code, title: courseFields.title }),
      })
        .then((resolved) => {
          if (!cancelled) setCourseId(resolved.id);
        })
        .catch(() => {
          if (!cancelled) setCourseId('');
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [courseFields.code, courseFields.title]);

  // Defer heavy DOCX/PDF preview until after the review step paints.
  useEffect(() => {
    if (step !== 'review') {
      setReviewPreviewReady(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setReviewPreviewReady(true));
    return () => window.cancelAnimationFrame(id);
  }, [step, file]);

  const pickFile = useCallback(
    (next: File | null, input?: HTMLInputElement | null) => {
      if (!next) {
        setFile(null);
        return;
      }
      if (next.size > MAX_BYTES) {
        toast({
          title: 'File too large',
          message: `${formatBytes(next.size)} exceeds the ${MAX_LABEL} limit.`,
          tone: 'error',
        });
        setFile(null);
        if (input) input.value = '';
        return;
      }
      setFile(next);
    },
    [toast],
  );

  const fileTypeIcon = useMemo(() => {
    if (!file) return 'fa-file-lines';
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return 'fa-file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'fa-file-word';
    if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint';
    if (['zip', 'rar'].includes(ext)) return 'fa-file-zipper';
    if (file.type.startsWith('image/')) return 'fa-file-image';
    return 'fa-file-lines';
  }, [file]);

  async function resolveCourse(): Promise<string> {
    const resolved = await api<LecturerCourse>('/api/meta/my-courses/resolve', {
      method: 'POST',
      body: JSON.stringify({ code: courseFields.code, title: courseFields.title }),
    });
    setCourseId(resolved.id);
    return resolved.id;
  }

  const detailsComplete = isCourseTypeInValid(courseFields) && title.trim().length > 0 && Boolean(file);

  async function onReview() {
    if (!detailsComplete) {
      toast({
        title: 'Almost there',
        message: 'Add the course, a title, and attach your file.',
        tone: 'error',
      });
      return;
    }
    if (courseId) {
      setStep('review');
      return;
    }
    setResolvingCourse(true);
    try {
      await resolveCourse();
      setStep('review');
    } catch (err) {
      toast({
        title: 'Course not registered',
        message: err instanceof Error ? err.message : 'Could not register course',
        tone: 'error',
      });
    } finally {
      setResolvingCourse(false);
    }
  }

  async function onPublish(e: FormEvent) {
    e.preventDefault();
    if (!file || !title.trim() || uploading) return;

    const publishedTitle = title.trim();
    const publishedCode = courseFields.code;

    setUploading(true);
    try {
      const id = courseId || (await resolveCourse());
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', publishedTitle);
      fd.append('courseId', id);
      fd.append('kind', kind);
      if (description.trim()) fd.append('description', description.trim());
      if (examYear) fd.append('examYear', examYear);

      await api('/api/resources', { method: 'POST', body: fd });

      setTitle('');
      setDescription('');
      setShowDescription(false);
      setFile(null);
      setCourseId('');
      setCourseFields({ code: '', title: '' });
      setStep('details');
      setUploading(false);

      toast({
        title: 'Published to students',
        message: `${publishedTitle} is live on ${publishedCode}.`,
        tone: 'success',
      });
      onPublished();
    } catch (err) {
      toast({
        title: 'Publish failed',
        message: err instanceof Error ? err.message : 'Try again in a moment.',
        tone: 'error',
      });
      setUploading(false);
    }
  }

  return (
    <div className="ula-lecturer-surface p-6 md:p-8 lg:p-10 animate-in">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-700">Publish</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-dark-900 md:text-[1.75rem]">
            {step === 'details' ? 'Publish material' : 'Review before publishing'}
          </h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-dark-500">
            {step === 'details'
              ? 'One page — course, title, file. Done in under a minute.'
              : 'Check the document and details, then publish to students.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          {(['details', 'review'] as const).map((s, i) => (
            <div
              key={s}
              className="ula-lecturer-wizard-step"
              data-active={step === s}
              data-done={s === 'details' && step === 'review'}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] ${
                  step === s || (s === 'details' && step === 'review')
                    ? 'bg-primary-700 text-white'
                    : 'bg-dark-100 text-dark-400'
                }`}
              >
                {s === 'details' && step === 'review' ? (
                  <i className="fa-solid fa-check text-[10px]" aria-hidden />
                ) : (
                  i + 1
                )}
              </span>
              {s === 'details' ? 'Details' : 'Review & publish'}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={onPublish}>
        {step === 'details' ? (
          <div className="space-y-6">
            <CourseTypeIn
              courses={courses}
              value={courseFields}
              onChange={setCourseFields}
              departmentName={departmentName}
            />

            <div>
              <label className="mb-2 block text-[13px] font-semibold text-dark-800" htmlFor="pub-title">
                Title
              </label>
              <input
                id="pub-title"
                className={fieldCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Introduction to Computing (Week 4)"
                required
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-dark-800" htmlFor="pub-kind">
                  Type
                </label>
                <select id="pub-kind" className={fieldCls} value={kind} onChange={(e) => setKind(e.target.value)}>
                  {PUBLISH_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-dark-800" htmlFor="pub-session">
                  Academic session
                </label>
                <select
                  id="pub-session"
                  className={fieldCls}
                  value={examYear}
                  onChange={(e) => setExamYear(e.target.value)}
                >
                  {sessions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {showDescription ? (
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-dark-800" htmlFor="pub-desc">
                  Description <span className="font-normal text-dark-400">(optional)</span>
                </label>
                <textarea
                  id="pub-desc"
                  className={`${fieldCls} min-h-[90px]`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Topics covered, learning outcomes…"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDescription(true)}
                className="text-[13px] font-medium text-primary-700 hover:underline"
              >
                <i className="fa-solid fa-plus mr-1.5 text-[11px]" aria-hidden />
                Add a description (optional)
              </button>
            )}

            <section
              className="ula-publish-attach"
              data-ready={file ? 'true' : 'false'}
              data-active={dragOver ? 'true' : 'false'}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
            >
              {file ? (
                <div className="ula-publish-attach__ready">
                  <div className="ula-publish-attach__preview">
                    {canShowAttachThumbnail(file) ? (
                      <FilePreviewPane
                        file={file}
                        url={previewUrl}
                        title="File preview"
                        variant="compact"
                        heightClass="ula-publish-attach__iframe h-full min-h-[120px]"
                        className="ula-publish-attach__iframe"
                      />
                    ) : (
                      <div className="ula-publish-attach__icon-fallback">
                        <i className={`fa-solid ${fileTypeIcon} text-2xl text-primary-600`} aria-hidden />
                        <span className="mt-2 rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-800">
                          {fileExt(file.name)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="ula-publish-attach__meta">
                    <span className="ula-publish-attach__badge">
                      <i className="fa-solid fa-circle-check text-[10px]" aria-hidden />
                      File attached
                    </span>
                    <p className="ula-publish-attach__name" title={file.name}>
                      {file.name}
                    </p>
                    <p className="ula-publish-attach__size">
                      {formatBytes(file.size)} · {fileExt(file.name)}
                    </p>
                    <div className="ula-publish-attach__actions">
                      <label className="ula-publish-attach__btn ula-publish-attach__btn--primary">
                        <i className="fa-solid fa-arrows-rotate text-[11px]" aria-hidden />
                        Replace
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(e) => pickFile(e.target.files?.[0] ?? null, e.target)}
                        />
                      </label>
                      <button
                        type="button"
                        className="ula-publish-attach__btn ula-publish-attach__btn--ghost"
                        onClick={() => pickFile(null)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ula-publish-attach__empty">
                  <div className="ula-publish-attach__empty-icon">
                    <i className="fa-solid fa-cloud-arrow-up text-xl" aria-hidden />
                  </div>
                  <p className="text-[15px] font-semibold text-dark-900 sm:text-base">Drop your file here</p>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-dark-500">
                    PDF, Word, slides, or images — up to {MAX_LABEL}
                  </p>
                  <label className="ula-publish-attach__choose">
                    <i className="fa-solid fa-folder-open text-[13px]" aria-hidden />
                    Choose file
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(e) => pickFile(e.target.files?.[0] ?? null, e.target)}
                    />
                  </label>
                </div>
              )}
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!detailsComplete || resolvingCourse}
                onClick={() => void onReview()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-800 px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-900 disabled:opacity-40"
              >
                {resolvingCourse ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-[13px]" aria-hidden />
                    Preparing review…
                  </>
                ) : (
                  <>
                    Review &amp; publish
                    <i className="fa-solid fa-arrow-right text-[12px]" aria-hidden />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <dl className="grid gap-3 rounded-2xl bg-dark-50/80 p-5 text-[14px] ring-1 ring-dark-100/80 sm:grid-cols-2">
              <div>
                <dt className="text-[12px] font-medium text-dark-400">Course</dt>
                <dd className="mt-0.5 font-semibold text-dark-900">
                  <span className="font-mono text-primary-800">{courseFields.code}</span> · {courseFields.title}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium text-dark-400">Title</dt>
                <dd className="mt-0.5 font-semibold text-dark-900">{title}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium text-dark-400">Type · Session</dt>
                <dd className="mt-0.5 font-medium text-dark-800">
                  {kindLabel(kind)} · {sessionLabel}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium text-dark-400">File</dt>
                <dd className="mt-0.5 truncate font-medium text-dark-800">
                  {file?.name} <span className="tabular-nums text-dark-400">({file ? formatBytes(file.size) : ''})</span>
                </dd>
              </div>
              {description.trim() ? (
                <div className="sm:col-span-2">
                  <dt className="text-[12px] font-medium text-dark-400">Description</dt>
                  <dd className="mt-0.5 text-dark-700">{description}</dd>
                </div>
              ) : null}
            </dl>

            <div className="overflow-hidden rounded-2xl ring-1 ring-dark-200/70">
              <div className="flex items-center justify-between border-b border-dark-100 bg-dark-50/60 px-4 py-2.5">
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-dark-700">
                  <i className="fa-regular fa-eye text-[12px] text-primary-600" aria-hidden />
                  Document preview — this is exactly what students get
                </p>
                {canPreviewInline && file ? (
                  <button
                    type="button"
                    onClick={() => setFullPreviewOpen(true)}
                    className="text-[12px] font-medium text-primary-700 hover:underline"
                  >
                    Open full screen
                  </button>
                ) : null}
              </div>
              {uploading && file ? (
                <div className="flex h-32 items-center justify-center bg-dark-50/40 px-6 text-center text-[13px] text-dark-500">
                  Uploading {file.name}…
                </div>
              ) : canPreviewInline && file && reviewPreviewReady ? (
                <FilePreviewPane file={file} url={previewUrl} title="Document preview" heightClass="h-[min(62dvh,560px)]" />
              ) : canPreviewInline && file ? (
                <div className="flex h-[min(62dvh,560px)] items-center justify-center bg-dark-50/40">
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700" aria-hidden />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                  <i className="fa-regular fa-file-lines text-2xl text-dark-300" aria-hidden />
                  <p className="text-[14px] font-medium text-dark-700">{file?.name}</p>
                  <p className="text-[12px] text-dark-400">
                    No inline preview for this format — students download it as-is.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep('details')}
                disabled={uploading}
                className="rounded-xl border border-dark-200 px-5 py-2.5 text-[14px] font-medium text-dark-600 hover:bg-dark-50 disabled:opacity-50"
              >
                <i className="fa-solid fa-arrow-left mr-2 text-[12px]" aria-hidden />
                Edit details
              </button>
              <button
                type="submit"
                disabled={uploading || !file}
                aria-busy={uploading}
                className="inline-flex min-w-[11rem] items-center justify-center gap-2 rounded-xl bg-primary-800 px-8 py-3 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(20,83,45,0.25)] hover:bg-primary-900 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-[14px]" aria-hidden />
                    Publishing…
                  </>
                ) : (
                  'Publish to students'
                )}
              </button>
            </div>
          </div>
        )}
      </form>

      {fullPreviewOpen && file ? (
        <DocumentPreviewModal
          title={title || file.name}
          fileName={file.name}
          file={file}
          url={previewUrl}
          mimeType={file.type}
          onClose={() => setFullPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
