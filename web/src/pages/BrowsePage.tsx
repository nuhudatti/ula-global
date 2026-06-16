import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useInstitutionSlug } from '../hooks/useInstitutionSlug';
import { RESOURCE_KIND_THEMES } from '../lib/resourceThemes';
import { type ResourceCardModel } from '../components/ResourceCard';
import { ResourceGrid } from '../components/ResourceGrid';
import { AssignmentFeedCard } from '../components/AssignmentFeedCard';
import { type Assignment } from '../lib/assignments';
import { downloadResourceFile, type DownloadPhase } from '../lib/download';

type Faculty = { id: string; name: string; code: string };
type Department = { id: string; name: string; facultyId: string };
type Course = {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  level: number | null;
};

const LEVEL_OPTIONS = ['100', '200', '300', '400', '500'] as const;

const KIND_LABEL: Record<string, string> = {
  LECTURE_NOTES: 'Lecture notes',
  PAST_QUESTIONS: 'Past questions',
  HANDOUT: 'Handout',
  ASSIGNMENT: 'Assignment',
  PROJECT: 'Project',
  OTHER: 'Other',
};

const pqTheme = RESOURCE_KIND_THEMES.PAST_QUESTIONS;
const lnTheme = RESOURCE_KIND_THEMES.LECTURE_NOTES;

const themedShortcut =
  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors';

export function BrowsePage() {
  const { user } = useAuth();
  const institutionSlug = useInstitutionSlug();
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [facultyId, setFacultyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [courseId, setCourseId] = useState('');
  const [kind, setKind] = useState('');
  const [examYearFilter, setExamYearFilter] = useState('');
  const [uploadYearFilter, setUploadYearFilter] = useState('');
  const [search, setSearch] = useState('');

  const [items, setItems] = useState<ResourceCardModel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // null = follow the search automatically; true/false = the user decided.
  const [assignmentsChoice, setAssignmentsChoice] = useState<boolean | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'todo' | 'done'>('all');

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 14 }, (_, i) => String(y - i));
  }, []);

  const activeFilterCount = useMemo(
    () =>
      [facultyId, departmentId, levelFilter, courseId, kind, examYearFilter, uploadYearFilter, search.trim()].filter(Boolean)
        .length,
    [facultyId, departmentId, levelFilter, courseId, kind, examYearFilter, uploadYearFilter, search],
  );

  useEffect(() => {
    setFacultyId('');
    setDepartmentId('');
    setLevelFilter('');
    setCourseId('');
    setKind('');
    setExamYearFilter('');
    setUploadYearFilter('');
    setSearch('');
    setItems([]);
    setAssignments([]);
    setFaculties([]);
    setDepartments([]);
    setCourses([]);
  }, [institutionSlug]);

  useEffect(() => {
    api<Faculty[]>('/api/meta/faculties').then(setFaculties).catch(console.error);
  }, [institutionSlug]);

  useEffect(() => {
    const q = facultyId ? `?facultyId=${encodeURIComponent(facultyId)}` : '';
    api<Department[]>(`/api/meta/departments${q}`)
      .then((rows) => {
        setDepartments(rows);
        setDepartmentId('');
        setCourseId('');
      })
      .catch(console.error);
  }, [facultyId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (departmentId) params.set('departmentId', departmentId);
    else if (facultyId) params.set('facultyId', facultyId);
    const qs = params.toString();
    api<Course[]>(`/api/meta/courses${qs ? `?${qs}` : ''}`)
      .then((rows) => {
        setCourses(rows);
        setCourseId('');
      })
      .catch(console.error);
  }, [departmentId, facultyId]);

  const coursesFilteredByLevel = useMemo(() => {
    if (!levelFilter) return courses;
    const lv = Number(levelFilter);
    if (Number.isNaN(lv)) return courses;
    return courses.filter((c) => c.level === lv);
  }, [courses, levelFilter]);

  useEffect(() => {
    if (!courseId) return;
    const ok = coursesFilteredByLevel.some((c) => c.id === courseId);
    if (!ok) setCourseId('');
  }, [coursesFilteredByLevel, courseId]);

  const loadResources = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (facultyId) params.set('facultyId', facultyId);
      if (departmentId) params.set('departmentId', departmentId);
      if (courseId) params.set('courseId', courseId);
      if (kind) params.set('kind', kind);
      if (levelFilter) params.set('level', levelFilter);
      if (examYearFilter) params.set('examYear', examYearFilter);
      if (uploadYearFilter) params.set('uploadYear', uploadYearFilter);
      params.set('take', '72');
      params.set('include', 'course,uploadedBy');
      const res = await api<{ items: ResourceCardModel[]; total: number }>(`/api/resources?${params}`);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, facultyId, departmentId, courseId, kind, levelFilter, examYearFilter, uploadYearFilter, institutionSlug]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  const loadAssignments = useCallback(async () => {
    try {
      const res = await api<{ items: Assignment[] }>('/api/assignments/feed');
      setAssignments(res.items);
    } catch {
      setAssignments([]);
    }
  }, [institutionSlug]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments, user?.id, institutionSlug]);

  // Assignments live in the same catalogue, obeying the same search + scope filters.
  const visibleAssignments = useMemo(() => {
    if (kind && kind !== 'ASSIGNMENT') return [];
    if (examYearFilter || uploadYearFilter) return [];
    const term = search.trim().toLowerCase();
    return assignments.filter((a) => {
      if (facultyId && a.course?.department?.facultyId !== facultyId) return false;
      if (departmentId && a.course?.departmentId !== departmentId) return false;
      if (courseId && a.course?.id !== courseId) return false;
      if (levelFilter && String(a.course?.level ?? '') !== levelFilter) return false;
      if (term) {
        const haystack = [a.title, a.description, a.course?.code, a.course?.title, a.lecturerName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [assignments, kind, search, facultyId, departmentId, courseId, levelFilter, examYearFilter, uploadYearFilter]);

  // For students: pending work first, then submitted, then the rest.
  const orderedAssignments = useMemo(() => {
    if (user?.role !== 'STUDENT') return visibleAssignments;
    const rank = (a: Assignment) => {
      if (a.myStatus === 'NOT_SUBMITTED' && a.status === 'OPEN' && new Date(a.dueAt).getTime() > Date.now()) return 0;
      if (a.myStatus && a.myStatus !== 'NOT_SUBMITTED') return 1;
      if (a.myStatus === 'NOT_SUBMITTED') return 2;
      return 3;
    };
    return [...visibleAssignments].sort((x, y) => rank(x) - rank(y));
  }, [visibleAssignments, user?.role]);

  const pendingAssignments = useMemo(
    () =>
      user?.role === 'STUDENT'
        ? visibleAssignments.filter(
            (a) =>
              a.myStatus === 'NOT_SUBMITTED' &&
              a.status === 'OPEN' &&
              new Date(a.dueAt).getTime() > Date.now(),
          ).length
        : 0,
    [visibleAssignments, user?.role],
  );

  const submittedAssignments = useMemo(
    () =>
      user?.role === 'STUDENT'
        ? visibleAssignments.filter((a) => a.myStatus && a.myStatus !== 'NOT_SUBMITTED').length
        : 0,
    [visibleAssignments, user?.role],
  );

  const filteredAssignments = useMemo(() => {
    if (user?.role !== 'STUDENT' || assignmentFilter === 'all') return orderedAssignments;
    if (assignmentFilter === 'todo') {
      return orderedAssignments.filter(
        (a) =>
          a.myStatus === 'NOT_SUBMITTED' &&
          a.status === 'OPEN' &&
          new Date(a.dueAt).getTime() > Date.now(),
      );
    }
    return orderedAssignments.filter((a) => a.myStatus && a.myStatus !== 'NOT_SUBMITTED');
  }, [orderedAssignments, assignmentFilter, user?.role]);

  // Searching for an assignment (or filtering by type) reveals the matching cards automatically,
  // but the user can still collapse/expand manually at any time.
  const searchMatchesAssignments = Boolean(search.trim()) && visibleAssignments.length > 0;
  const showAssignmentCards =
    assignmentsChoice ??
    (searchMatchesAssignments ||
      kind === 'ASSIGNMENT' ||
      (user?.role === 'STUDENT' && (pendingAssignments > 0 || submittedAssignments > 0)));

  useEffect(() => {
    if (!search.trim() && !kind) setAssignmentsChoice(null);
  }, [search, kind]);

  const combinedTotal = total + visibleAssignments.length;

  async function trackDownload(
    id: string,
    fileName: string,
    onPhase?: (phase: DownloadPhase, progressPercent?: number) => void,
  ) {
    await downloadResourceFile(id, fileName, onPhase);
    setItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, downloadCount: r.downloadCount + 1 } : r)),
    );
  }

  const inputCls =
    'w-full rounded-2xl border-0 bg-white py-3 px-4 text-base text-dark-900 shadow-none ring-1 ring-dark-200/75 transition placeholder:text-dark-400 focus:ring-2 focus:ring-inset focus:ring-primary-600/25';

  const labelCls = 'mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-dark-800';

  const summaryLine =
    loading
      ? 'Loading…'
      : activeFilterCount
        ? `${combinedTotal.toLocaleString()} results · ${activeFilterCount} filters`
        : `${combinedTotal.toLocaleString()} results`;

  return (
    <main
      className="relative mx-auto w-full min-w-0 max-w-[var(--ula-max-width)] overflow-x-hidden px-5 pb-16 pt-10 md:px-8 md:pb-20 md:pt-12 lg:px-10"
      aria-busy={loading}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[320px] ula-ambient-page" aria-hidden />

      <header
        id="browse-repo"
        className="scroll-mt-[calc(var(--ula-nav-h)+12px)] max-w-2xl border-b border-dark-100/90 pb-8 md:pb-10"
      >
        <p className="mb-3 inline-flex items-center gap-2 text-[13px] font-medium text-dark-500">
          <i className="fa-solid fa-database text-primary-600" aria-hidden />
          Repository
        </p>
        <h1 className="text-[1.85rem] font-semibold tracking-tight text-dark-900 md:text-[2.35rem] md:leading-[1.12]">
          Course materials
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-dark-500">
          Ibrahim Badamasi Babangida University, Lapai — browse, discuss, and download with confidence.
        </p>
      </header>

      <section className="mt-10 md:mt-12">
        <div className="rounded-2xl border border-dark-200/60 bg-white/95 p-6 shadow-[0_4px_40px_rgba(15,23,42,0.06)] backdrop-blur-md md:p-8 lg:p-9">
          <div className="mb-7 flex flex-col gap-5 lg:mb-8 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1 lg:max-w-md">
              <label htmlFor="catalog-search" className="sr-only">
                Search catalogue
              </label>
              <div className="relative">
                <i
                  className="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-dark-400"
                  aria-hidden
                />
                <input
                  id="catalog-search"
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder="Search title, course, lecturer…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${inputCls} pl-11`}
                />
              </div>
            </div>
            <p className="inline-flex shrink-0 items-center gap-2 text-[14px] tabular-nums text-dark-500 lg:text-right">
              <i className="fa-solid fa-filter text-[12px] text-dark-400" aria-hidden />
              {summaryLine}
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
            <div>
              <h2 className="mb-5 flex items-center gap-2 text-[14px] font-semibold tracking-tight text-dark-900">
                <i className="fa-solid fa-location-dot text-primary-600" aria-hidden />
                Scope
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-5">
                <div>
                  <label className={labelCls} htmlFor="filter-faculty">
                    <i className="fa-solid fa-building-columns text-[12px] text-dark-500" aria-hidden />
                    Faculty
                  </label>
                  <select id="filter-faculty" className={inputCls} value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
                    <option value="">All</option>
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="filter-dept">
                    <i className="fa-solid fa-sitemap text-[12px] text-dark-500" aria-hidden />
                    Department
                  </label>
                  <select id="filter-dept" className={inputCls} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    <option value="">All</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="filter-level">
                    <i className="fa-solid fa-layer-group text-[12px] text-dark-500" aria-hidden />
                    Level
                  </label>
                  <select id="filter-level" className={inputCls} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                    <option value="">All</option>
                    {LEVEL_OPTIONS.map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="filter-course">
                    <i className="fa-solid fa-book text-[12px] text-dark-500" aria-hidden />
                    Course
                  </label>
                  <select id="filter-course" className={inputCls} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                    <option value="">All</option>
                    {coursesFilteredByLevel.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                        {c.level != null ? ` (${c.level})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h2 className="mb-5 flex items-center gap-2 text-[14px] font-semibold tracking-tight text-dark-900">
                <i className="fa-solid fa-sliders text-primary-600" aria-hidden />
                Refine
              </h2>
              <div className="space-y-5">
                <div>
                  <label className={labelCls} htmlFor="filter-kind">
                    <i className="fa-solid fa-tags text-[12px] text-dark-500" aria-hidden />
                    Type
                  </label>
                  <select id="filter-kind" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
                    <option value="">All</option>
                    {Object.entries(KIND_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor="filter-exam">
                      <i className="fa-regular fa-calendar text-[12px] text-dark-500" aria-hidden />
                      Exam session
                    </label>
                    <select id="filter-exam" className={inputCls} value={examYearFilter} onChange={(e) => setExamYearFilter(e.target.value)}>
                      <option value="">Any</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}/{Number(y) + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="filter-upload">
                      <i className="fa-solid fa-clock-rotate-left text-[12px] text-dark-500" aria-hidden />
                      Uploaded
                    </label>
                    <select
                      id="filter-upload"
                      className={inputCls}
                      value={uploadYearFilter}
                      onChange={(e) => setUploadYearFilter(e.target.value)}
                    >
                      <option value="">Any</option>
                      {years.map((y) => (
                        <option key={`up-${y}`} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-dark-100/90 pt-6">
            <p className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-dark-400">
              <i className="fa-solid fa-bolt text-[11px]" aria-hidden />
              Shortcuts
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFacultyId('');
                  setDepartmentId('');
                  setLevelFilter('');
                  setCourseId('');
                  setKind('PAST_QUESTIONS');
                  setExamYearFilter('');
                  setUploadYearFilter('');
                  setSearch('');
                }}
                className={`${themedShortcut} ${pqTheme.chipIdle}`}
              >
                <i className={`fa-solid ${pqTheme.iconClass}`} aria-hidden />
                Past questions
              </button>
              <button type="button" onClick={() => setKind('LECTURE_NOTES')} className={`${themedShortcut} ${lnTheme.chipIdle}`}>
                <i className={`fa-solid ${lnTheme.iconClass}`} aria-hidden />
                Lecture notes
              </button>
              <button
                type="button"
                onClick={() => {
                  setKind('');
                  setExamYearFilter('');
                  setUploadYearFilter(String(new Date().getFullYear()));
                }}
                className={`${themedShortcut} border border-primary-200 bg-primary-50/90 text-primary-950 hover:bg-primary-100`}
              >
                <i className="fa-solid fa-calendar-plus" aria-hidden />
                Added this year
              </button>
              <button
                type="button"
                onClick={() => {
                  setFacultyId('');
                  setDepartmentId('');
                  setLevelFilter('');
                  setCourseId('');
                  setKind('');
                  setExamYearFilter('');
                  setUploadYearFilter('');
                  setSearch('');
                }}
                className={`${themedShortcut} ml-auto border border-dark-200 bg-white text-dark-500 hover:bg-dark-50`}
              >
                <i className="fa-solid fa-rotate-left text-[12px]" aria-hidden />
                Clear all
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="ula-stat-strip mt-8 rounded-2xl px-6 py-8 md:mt-10 md:px-9 md:py-9">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-6">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 text-2xl font-semibold tabular-nums tracking-tight text-white md:text-3xl">
              <i className="fa-solid fa-file-lines text-[0.65em] text-slate-400" aria-hidden />
              {loading ? '—' : combinedTotal.toLocaleString()}
            </div>
            <div className="text-[12px] font-medium text-slate-400">Results</div>
          </div>
          <div>
            <div className="mb-1 inline-flex items-center gap-2 text-2xl font-semibold tabular-nums tracking-tight text-white md:text-3xl">
              <i className="fa-solid fa-building-columns text-[0.65em] text-slate-400" aria-hidden />
              {faculties.length}
            </div>
            <div className="text-[12px] font-medium text-slate-400">Faculties</div>
          </div>
          <div>
            <div className="mb-1 inline-flex items-center gap-2 text-2xl font-semibold tabular-nums tracking-tight text-white md:text-3xl">
              <i className="fa-solid fa-book text-[0.65em] text-slate-400" aria-hidden />
              {courses.length}
            </div>
            <div className="text-[12px] font-medium text-slate-400">Courses</div>
          </div>
          <div>
            <div className="mb-1 inline-flex items-center gap-2 text-2xl font-semibold tabular-nums tracking-tight text-white md:text-3xl">
              <i className="fa-solid fa-download text-[0.65em] text-slate-400" aria-hidden />
              {items.reduce((s, r) => s + r.downloadCount, 0).toLocaleString()}
            </div>
            <div className="text-[12px] font-medium text-slate-400">Downloads</div>
          </div>
        </div>
      </section>

      {user?.role === 'STUDENT' && submittedAssignments > 0 ? (
        <section
          className="mt-8 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 via-white to-white px-5 py-4 md:mt-10 md:px-6"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <i className="fa-solid fa-circle-check text-[16px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-emerald-900">
                {submittedAssignments === 1
                  ? 'You have submitted 1 assignment'
                  : `You have submitted ${submittedAssignments} assignments`}
              </p>
              <p className="text-[13px] text-emerald-800/80">
                Open the Submitted tab below to review your work or download your copy.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAssignmentsChoice(true);
                setAssignmentFilter('done');
              }}
              className="shrink-0 rounded-xl bg-emerald-800 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-900"
            >
              View submitted
            </button>
          </div>
        </section>
      ) : null}

      {visibleAssignments.length > 0 ? (
        <section className="mt-8 md:mt-10">
          <button
            type="button"
            onClick={() => setAssignmentsChoice(!showAssignmentCards)}
            aria-expanded={showAssignmentCards}
            className="flex w-full items-center gap-3 rounded-2xl border border-dark-200/70 bg-white px-5 py-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:border-dark-300/90 hover:shadow-[0_4px_20px_-8px_rgba(15,23,42,0.08)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <i className="fa-solid fa-pen-to-square text-[15px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-dark-900">Assignments</span>
              <span className="block truncate text-[12px] text-dark-400">
                {user?.role === 'STUDENT'
                  ? pendingAssignments > 0
                    ? `${pendingAssignments} to submit · ${submittedAssignments} submitted`
                    : submittedAssignments > 0
                      ? `${submittedAssignments} submitted — open a card to download your copy`
                      : 'Open assignments from across the university'
                  : 'Open coursework posted by lecturers'}
              </span>
            </span>
            {pendingAssignments > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                {pendingAssignments} to do
              </span>
            ) : (
              <span className="rounded-full bg-dark-50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-dark-500 ring-1 ring-dark-100">
                {visibleAssignments.length}
              </span>
            )}
            <i
              className={`fa-solid fa-chevron-down text-[12px] text-dark-400 transition-transform ${showAssignmentCards ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>

          {showAssignmentCards ? (
            <div className="mt-5 space-y-4">
              {user?.role === 'STUDENT' ? (
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'all' as const, label: 'All', count: orderedAssignments.length },
                      { id: 'todo' as const, label: 'To submit', count: pendingAssignments },
                      { id: 'done' as const, label: 'Submitted', count: submittedAssignments },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAssignmentFilter(tab.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                        assignmentFilter === tab.id
                          ? 'bg-primary-800 text-white'
                          : 'bg-white text-dark-600 ring-1 ring-dark-200 hover:bg-dark-50'
                      }`}
                    >
                      {tab.label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                          assignmentFilter === tab.id ? 'bg-white/20' : 'bg-dark-50 text-dark-500'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {filteredAssignments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-dark-200 bg-white/80 px-6 py-12 text-center">
                  <p className="text-[14px] font-medium text-dark-600">No assignments in this view.</p>
                  <p className="mt-1 text-[13px] text-dark-400">Try another tab or clear filters.</p>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredAssignments.map((a) => (
                    <AssignmentFeedCard key={a.id} a={a} onChanged={() => void loadAssignments()} />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-10 md:mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-dark-100/90 pb-5 md:mb-7 md:pb-6">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-dark-900 md:text-2xl">
            <i className="fa-solid fa-folder-open text-primary-600" aria-hidden />
            Materials
          </h2>
          {!loading && items.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] tabular-nums text-dark-400">
              <i className="fa-solid fa-layer-group text-[11px]" aria-hidden />
              {items.length} shown
            </span>
          ) : null}
        </div>

        {!loading && items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-dark-200/80 bg-white/70 px-6 py-14 text-center md:py-16">
            <p className="inline-flex items-center justify-center gap-2 text-[16px] font-medium text-dark-700">
              <i className="fa-regular fa-folder-open text-dark-400" aria-hidden />
              No materials match.
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-dark-500">Change filters or search.</p>
          </div>
        ) : loading && items.length === 0 ? (
          <div className="rounded-2xl border border-dark-100/90 bg-white/50 px-6 py-14 text-center md:py-16">
            <p className="inline-flex items-center justify-center gap-2 text-[14px] text-dark-500">
              <i className="fa-solid fa-spinner fa-spin text-primary-600" aria-hidden />
              Loading catalogue…
            </p>
          </div>
        ) : (
          <ResourceGrid items={items} onDownload={trackDownload} onRated={() => void loadResources()} />
        )}
      </section>
    </main>
  );
}
