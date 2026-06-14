import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isDiscussionParticipant, showsDiscussionFab } from '../lib/discussionAccess';
import { AcademicDiscussions } from './AcademicDiscussions';
import '../styles/academic-discussions.css';

type CourseOption = { id: string; code: string; title: string; level?: number | null };

/** Floating academic Q&A — students & department staff only (not faculty/platform admins). */
export function DiscussionFab() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [feedCount, setFeedCount] = useState(0);
  const [repliesToMe, setRepliesToMe] = useState(0);
  const [courses, setCourses] = useState<CourseOption[]>([]);

  const canParticipate = isDiscussionParticipant(user?.role);
  const visible = showsDiscussionFab(user?.role);

  const loadActivity = useCallback(async () => {
    try {
      if (user && isDiscussionParticipant(user.role)) {
        const res = await api<{ feedCount: number; repliesToMe: number }>('/api/discussions/participant/activity');
        setFeedCount(res.feedCount);
        setRepliesToMe(res.repliesToMe);
        return;
      }
      const res = await api<{ items: unknown[] }>('/api/discussions/feed');
      setFeedCount(res.items.length);
      setRepliesToMe(0);
    } catch {
      setFeedCount(0);
      setRepliesToMe(0);
    }
  }, [user]);

  useEffect(() => {
    if (!visible) return;
    void loadActivity();
    const id = window.setInterval(() => void loadActivity(), 30000);
    return () => window.clearInterval(id);
  }, [loadActivity, visible]);

  useEffect(() => {
    if (!canParticipate) {
      setCourses([]);
      return;
    }
    void api<{ courses: CourseOption[] }>('/api/discussions/participant/courses')
      .then((res) => setCourses(res.courses))
      .catch(() => setCourses([]));
  }, [canParticipate, user?.id]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!visible) return null;

  const badgeCount = repliesToMe > 0 ? repliesToMe : feedCount;
  const badgeTone = repliesToMe > 0 ? 'inbox' : 'feed';
  const isStaff = user?.role === 'LECTURER' || user?.role === 'HOD' || user?.role === 'DEPARTMENT_ADMIN';

  return (
    <>
      <button
        type="button"
        className="ula-disc-fab"
        aria-label="Open course discussions"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="ula-disc-fab__icon-wrap">
          <span className="ula-disc-fab__icon" aria-hidden>
            <i className="fa-solid fa-comments" />
          </span>
          {badgeCount > 0 ? (
            <span
              className={`ula-disc-fab__badge ${badgeTone === 'inbox' ? 'ula-disc-fab__badge--inbox' : ''}`}
              aria-hidden
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          ) : null}
        </span>
        <span className="ula-disc-fab__label">Q&amp;A</span>
      </button>

      {open ? (
        <div className="ula-disc-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="ula-disc-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="disc-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ula-disc-modal__head">
              <div>
                <p id="disc-modal-title" className="ula-disc-modal__title">
                  {isStaff ? 'Student questions (your courses)' : 'Course discussions'}
                </p>
                <p className="ula-disc-modal__sub">
                  {isStaff
                    ? 'Reply to questions students tagged with your department courses'
                    : 'Tag a course when you ask — lecturers for that course can reply'}
                </p>
              </div>
              <button
                type="button"
                className="ula-disc-modal__close"
                aria-label="Close discussions"
                onClick={() => setOpen(false)}
              >
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </header>
            <AcademicDiscussions
              variant="popup"
              courses={courses}
              showCompose
              live={open}
              onPosted={() => void loadActivity()}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
