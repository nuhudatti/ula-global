import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { LecturerCourse } from '../../lib/lecturer';

const fieldCls =
  'w-full rounded-xl border-0 bg-white py-3 px-4 text-[15px] text-dark-900 ring-1 ring-dark-200/70 transition placeholder:text-dark-400 focus:ring-2 focus:ring-primary-600/20';

export type CourseTypeInValue = {
  code: string;
  title: string;
};

type Props = {
  courses: LecturerCourse[];
  value: CourseTypeInValue;
  onChange: (next: CourseTypeInValue) => void;
  departmentName?: string;
  /** Shown when registering a new course — defaults to publish wording. */
  newCourseHint?: string;
};

export function CourseTypeIn({
  courses,
  value,
  onChange,
  departmentName,
  newCourseHint = 'New course — added to department catalogue on publish',
}: Props) {
  const [titleTouched, setTitleTouched] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = value.code.trim().toLowerCase();
    if (!q) return courses.slice(0, 8);
    return courses
      .filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          `${c.code} ${c.title}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [courses, value.code]);

  const exactMatch = useMemo(
    () => courses.find((c) => c.code.toLowerCase() === value.code.trim().toLowerCase()),
    [courses, value.code],
  );

  const isNewCourse = value.code.trim().length >= 2 && value.title.trim().length >= 3 && !exactMatch;

  useEffect(() => {
    if (titleTouched || !exactMatch) return;
    onChange({ code: exactMatch.code, title: exactMatch.title });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exactMatch?.id, titleTouched]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setSuggestionsOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pickCourse(c: LecturerCourse) {
    setTitleTouched(false);
    onChange({ code: c.code, title: c.title });
    setSuggestionsOpen(false);
    setActiveIndex(-1);
  }

  function onCodeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!suggestionsOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setSuggestionsOpen(true);
      return;
    }
    if (!suggestionsOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pickCourse(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setSuggestionsOpen(false);
    }
  }

  return (
    <div className="space-y-5">
      <div ref={wrapRef} className="relative">
        <label className="mb-2 block text-[13px] font-semibold text-dark-800" htmlFor="pub-course-code">
          Course code
        </label>
        <input
          ref={codeRef}
          id="pub-course-code"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. CSC101"
          value={value.code}
          onChange={(e) => {
            onChange({ ...value, code: e.target.value.toUpperCase() });
            setSuggestionsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onKeyDown={onCodeKeyDown}
          className={`${fieldCls} font-mono tracking-wide uppercase`}
        />
        {suggestionsOpen && suggestions.length > 0 ? (
          <ul
            className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-dark-100/90 bg-white py-1 shadow-[0_16px_48px_-12px_rgba(15,23,42,0.18)]"
            role="listbox"
          >
            <li className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-dark-400">
              Department catalogue
            </li>
            {suggestions.map((c, i) => (
              <li key={c.id} role="option" aria-selected={activeIndex === i}>
                <button
                  type="button"
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors ${
                    activeIndex === i ? 'bg-primary-50' : 'hover:bg-dark-50'
                  }`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => pickCourse(c)}
                >
                  <span className="font-mono text-[13px] font-semibold text-primary-800">{c.code}</span>
                  <span className="text-[13px] text-dark-600">{c.title}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-1.5 text-[12px] text-dark-400">Type a code — pick from catalogue or register a new course.</p>
      </div>

      <div>
        <label className="mb-2 block text-[13px] font-semibold text-dark-800" htmlFor="pub-course-title">
          Course title
        </label>
        <input
          id="pub-course-title"
          type="text"
          autoComplete="off"
          placeholder="e.g. Introduction to Computing"
          value={value.title}
          onChange={(e) => {
            setTitleTouched(true);
            onChange({ ...value, title: e.target.value });
          }}
          className={fieldCls}
        />
        {isNewCourse ? (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary-700">
            <i className="fa-solid fa-circle-plus text-[10px]" aria-hidden />
            {newCourseHint}
          </p>
        ) : exactMatch ? (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-dark-500">
            <i className="fa-solid fa-circle-check text-[10px] text-emerald-600" aria-hidden />
            Matched catalogue entry
          </p>
        ) : null}
      </div>

      {(exactMatch || value.title.trim()) && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/40 p-5 ring-1 ring-dark-100/80">
          <p className="text-[11px] font-medium uppercase tracking-wide text-dark-400">Publishing under</p>
          <p className="mt-1 font-mono text-[15px] font-semibold text-dark-900">
            {(exactMatch?.code ?? value.code.trim().toUpperCase()) || '—'}
          </p>
          <p className="text-[14px] text-dark-700">{value.title.trim() || exactMatch?.title}</p>
          {departmentName ? (
            <p className="mt-2 text-[12px] text-dark-500">{departmentName}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function isCourseTypeInValid(value: CourseTypeInValue): boolean {
  return value.code.trim().length >= 2 && value.title.trim().length >= 3;
}
