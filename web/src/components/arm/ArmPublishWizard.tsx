import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { fileExt, formatBytes } from '../../lib/format';
import { canShowAttachThumbnail, canShowFilePreview, FilePreviewPane } from '../FilePreviewPane';
import { DocumentPreviewModal } from '../DocumentPreviewModal';
import { buildAcademicSessions } from '../lecturer/PublishWizard';
import { CourseTypeIn, isCourseTypeInValid, type CourseTypeInValue } from '../lecturer/CourseTypeIn';
import {
  ARM_PUBLISH_KINDS,
  LEVEL_OPTIONS,
  SEMESTER_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  type ArmCourse,
  type ArmDepartment,
  type ArmFaculty,
} from '../../lib/arm';

const MAX_BYTES = 40 * 1024 * 1024;
const MAX_LABEL = '40 MB';

const fieldCls =
  'w-full rounded-xl border-0 bg-white py-3 px-4 text-[15px] text-dark-900 ring-1 ring-dark-200/70 transition placeholder:text-dark-400 focus:ring-2 focus:ring-primary-600/20';

type Props = {
  onPublished: () => void;
};

export function ArmPublishWizard({ onPublished }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canSetUlaSource = user?.role === 'ACADEMIC_RESOURCES_MANAGER' || user?.role === 'INSTITUTION_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [step, setStep] = useState<'details' | 'review'>('details');
  const [faculties, setFaculties] = useState<ArmFaculty[]>([]);
  const [departments, setDepartments] = useState<ArmDepartment[]>([]);
  const [courses, setCourses] = useState<ArmCourse[]>([]);

  const [facultyId, setFacultyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [level, setLevel] = useState('');
  const [semester, setSemester] = useState('');
  const [courseFields, setCourseFields] = useState<CourseTypeInValue>({ code: '', title: '' });
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [kind, setKind] = useState('LECTURE_NOTES');
  const [sourceType, setSourceType] = useState('INSTITUTION');
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
  const selectedFaculty = faculties.find((f) => f.id === facultyId);
  const selectedDepartment = departments.find((d) => d.id === departmentId);

  useEffect(() => {
    api<ArmFaculty[]>('/api/meta/faculties').then(setFaculties).catch(() => setFaculties([]));
  }, []);

  useEffect(() => {
    if (!facultyId) {
      setDepartments([]);
      setDepartmentId('');
      return;
    }
    api<ArmDepartment[]>(`/api/meta/departments?facultyId=${encodeURIComponent(facultyId)}`)
      .then(setDepartments)
      .catch(() => setDepartments([]));
    setDepartmentId('');
  }, [facultyId]);

  useEffect(() => {
    if (!departmentId) {
      setCourses([]);
      return;
    }
    const params = new URLSearchParams({ departmentId });
    if (level) params.set('level', level);
    api<ArmCourse[]>(`/api/meta/courses?${params}`)
      .then(setCourses)
      .catch(() => setCourses([]));
  }, [departmentId, level]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!isCourseTypeInValid(courseFields) || !departmentId) {
      setCourseId('');
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api<ArmCourse>('/api/meta/courses/resolve', {
        method: 'POST',
        body: JSON.stringify({
          departmentId,
          code: courseFields.code,
          title: courseFields.title,
          level: level || undefined,
          semester: semester || undefined,
        }),
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
  }, [courseFields.code, courseFields.title, departmentId, level, semester]);

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
    const resolved = await api<ArmCourse>('/api/meta/courses/resolve', {
      method: 'POST',
      body: JSON.stringify({
        departmentId,
        code: courseFields.code,
        title: courseFields.title,
        level: level || undefined,
        semester: semester || undefined,
      }),
    });
    setCourseId(resolved.id);
    return resolved.id;
  }

  const hierarchyComplete = Boolean(facultyId && departmentId && level && semester);
  const detailsComplete = hierarchyComplete && isCourseTypeInValid(courseFields) && title.trim().length > 0 && Boolean(file);

  async function onReview() {
    if (!detailsComplete) {
      toast({
        title: 'Almost there',
        message: 'Select faculty through semester, add the course, title, and file.',
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
      if (semester) fd.append('semester', semester);
      if (kind === 'PAST_QUESTIONS' && examYear) fd.append('examYear', examYear);
      if (canSetUlaSource && sourceType) fd.append('sourceType', sourceType);
      fd.append('governanceStatus', 'VERIFIED');

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
        title: 'Published institution-wide',
        message: `${publishedTitle} is live for ${publishedCode} students.`,
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-700">Institution publish</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-dark-900 md:text-[1.75rem]">
            {step === 'details' ? 'Upload academic resource' : 'Review before publishing'}
          </h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-dark-500">
            {step === 'details'
              ? 'Pick faculty, department, level, and semester — then attach the file. Students see it automatically.'
              : 'Confirm placement and document, then publish across your institution.'}
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
              {s === 'details' ? 'Placement & file' : 'Review & publish'}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={onPublish}>
        {step === 'details' ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-dark-800">Faculty</label>
                <select className={fieldCls} value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
                  <option value="">Select faculty</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-dark-800">Department</label>
                <select
                  className={fieldCls}
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={!facultyId}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-dark-800">Level</label>
                <select className={fieldCls} value={level} onChange={(e) => setLevel(e.target.value)} disabled={!departmentId}>
                  <option value="">Select level</option>
                  {LEVEL_OPTIONS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv} level
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-dark-800">Semester</label>
                <select className={fieldCls} value={semester} onChange={(e) => setSemester(e.target.value)} disabled={!level}>
                  <option value="">Select semester</option>
                  {SEMESTER_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {hierarchyComplete ? (
              <CourseTypeIn
                courses={courses.map((c) => ({
                  id: c.id,
                  code: c.code,
                  title: c.title,
                  level: c.level,
                  departmentId: c.departmentId,
                  department: {
                    name: selectedDepartment?.name ?? '',
                    faculty: { name: selectedFaculty?.name ?? '', code: selectedFaculty?.code ?? '' },
                  },
                }))}
                value={courseFields}
                onChange={setCourseFields}
                departmentName={selectedDepartment?.name}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-dark-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-dark-500">
                Complete faculty, department, level, and semester to add the course.
              </div>
            )}

            <div>
              <label className="mb-2 block text-[13px] font-semibold text-dark-800">Resource type</label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ARM_PUBLISH_KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] ring-1 transition ${
                      kind === k.value
                        ? 'bg-primary-50 ring-primary-300 text-primary-900'
                        : 'bg-white ring-dark-200/70 text-dark-700 hover:ring-primary-200'
                    }`}
                  >
                    <i className={`fa-solid ${k.icon} text-primary-700`} aria-hidden />
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            {canSetUlaSource ? (
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-dark-800">Source attribution</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SOURCE_TYPE_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSourceType(s.value)}
                      className={`rounded-xl px-4 py-3 text-left ring-1 transition ${
                        sourceType === s.value
                          ? 'bg-primary-50 ring-primary-300'
                          : 'bg-white ring-dark-200/70 hover:ring-primary-200'
                      }`}
                    >
                      <p className="text-[13px] font-semibold text-dark-900">{s.label}</p>
                      <p className="mt-1 text-[11px] text-dark-500">{s.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-[13px] font-semibold text-dark-800" htmlFor="arm-title">
                Title
              </label>
              <input
                id="arm-title"
                className={fieldCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. CSC201 Past Questions — 2024/2025"
              />
            </div>

            {kind === 'PAST_QUESTIONS' ? (
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-dark-800">Exam session</label>
                <select className={fieldCls} value={examYear} onChange={(e) => setExamYear(e.target.value)}>
                  {sessions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {!showDescription ? (
              <button
                type="button"
                className="text-[13px] font-medium text-primary-700 hover:underline"
                onClick={() => setShowDescription(true)}
              >
                + Add description (optional)
              </button>
            ) : (
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-dark-800">Description</label>
                <textarea
                  className={`${fieldCls} min-h-[88px] resize-y`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief note for students…"
                />
              </div>
            )}

            <div
              className={`relative rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                dragOver ? 'border-primary-400 bg-primary-50/50' : 'border-dark-200 bg-slate-50/60'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files[0] ?? null);
              }}
            >
              <input
                type="file"
                className="absolute inset-0 cursor-pointer opacity-0"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.rar,image/*"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null, e.target)}
              />
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <i className={`fa-solid ${fileTypeIcon} text-3xl text-primary-700`} aria-hidden />
                  <p className="text-[14px] font-semibold text-dark-900">{file.name}</p>
                  <p className="text-[12px] text-dark-500">
                    {formatBytes(file.size)} · {fileExt(file.name)}
                  </p>
                  <button type="button" className="text-[12px] font-medium text-primary-700 hover:underline" onClick={() => setFile(null)}>
                    Choose a different file
                  </button>
                </div>
              ) : (
                <>
                  <i className="fa-solid fa-cloud-arrow-up text-3xl text-primary-600" aria-hidden />
                  <p className="mt-3 text-[14px] font-medium text-dark-800">Drop file here or click to browse</p>
                  <p className="mt-1 text-[12px] text-dark-500">PDF, Word, PowerPoint, ZIP — max {MAX_LABEL}</p>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void onReview()}
                disabled={!detailsComplete || resolvingCourse}
                className="rounded-xl bg-primary-700 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {resolvingCourse ? 'Registering course…' : 'Review & publish'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 rounded-xl bg-slate-50/80 p-5 text-sm md:grid-cols-2">
              <p>
                <span className="text-dark-400">Faculty</span> · <strong>{selectedFaculty?.name}</strong>
              </p>
              <p>
                <span className="text-dark-400">Department</span> · <strong>{selectedDepartment?.name}</strong>
              </p>
              <p>
                <span className="text-dark-400">Course</span> · <strong>{courseFields.code}</strong> — {courseFields.title}
              </p>
              <p>
                <span className="text-dark-400">Level / Semester</span> · {level} ·{' '}
                {SEMESTER_OPTIONS.find((s) => s.value === semester)?.label ?? semester}
              </p>
              <p>
                <span className="text-dark-400">Type</span> · <strong>{ARM_PUBLISH_KINDS.find((k) => k.value === kind)?.label}</strong>
              </p>
              {canSetUlaSource ? (
                <p>
                  <span className="text-dark-400">Source</span> ·{' '}
                  <strong>{SOURCE_TYPE_OPTIONS.find((s) => s.value === sourceType)?.label}</strong>
                </p>
              ) : null}
              {kind === 'PAST_QUESTIONS' ? (
                <p>
                  <span className="text-dark-400">Session</span> · <strong>{sessionLabel}</strong>
                </p>
              ) : null}
            </div>

            {file && previewUrl && reviewPreviewReady && canShowFilePreview(file) ? (
              <FilePreviewPane file={file} previewUrl={previewUrl} className="max-h-[420px]" />
            ) : file && canShowAttachThumbnail(file) && previewUrl ? (
              <img src={previewUrl} alt="" className="mx-auto max-h-64 rounded-xl object-contain" />
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button type="button" className="rounded-xl px-5 py-2.5 text-sm font-medium text-dark-600 ring-1 ring-dark-200" onClick={() => setStep('details')}>
                Back
              </button>
              {file && canShowFilePreview(file) ? (
                <button type="button" className="rounded-xl px-5 py-2.5 text-sm font-medium text-primary-700 ring-1 ring-primary-200" onClick={() => setFullPreviewOpen(true)}>
                  Full preview
                </button>
              ) : null}
              <button type="submit" disabled={uploading} className="ml-auto rounded-xl bg-primary-700 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {uploading ? 'Publishing…' : 'Publish now'}
              </button>
            </div>
          </div>
        )}
      </form>

      {fullPreviewOpen && file && previewUrl ? (
        <DocumentPreviewModal file={file} previewUrl={previewUrl} onClose={() => setFullPreviewOpen(false)} />
      ) : null}
    </div>
  );
}
