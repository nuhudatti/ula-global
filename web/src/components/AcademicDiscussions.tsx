import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenantPaths } from '../hooks/useTenantPaths';
import { isDiscussionParticipant, isDiscussionStaff } from '../lib/discussionAccess';
import { api } from '../lib/api';
import type { DiscussionPost, DiscussionTopic } from '../lib/discussions';
import { TOPIC_LABELS, roleBadge } from '../lib/discussions';
import { buildDiscussionThreads } from '../lib/discussionThreads';
import { IdentityAvatar } from './IdentityAvatar';
import '../styles/academic-discussions.css';

type CourseOption = { id: string; code: string; title: string; level?: number | null };

const MIN_POST_LEN = 3;
const LIVE_POLL_MS = 5000;
const IDLE_POLL_MS = 20000;

function DiscussionMessage({
  item,
  isReply,
  depth = 1,
  currentUserId,
  canReply,
  onReply,
}: {
  item: DiscussionPost;
  isReply?: boolean;
  depth?: number;
  currentUserId?: string;
  canReply: boolean;
  onReply: (post: DiscussionPost) => void;
}) {
  const badge = roleBadge(item.author.role);
  const isLecturer = item.author.role === 'LECTURER' || item.author.role === 'HOD' || item.author.role === 'DEPARTMENT_ADMIN';
  const isReplyToMe = Boolean(currentUserId && item.repliedTo?.authorId === currentUserId);

  return (
    <article
      className={`ula-acad-disc__msg ${isReply ? 'ula-acad-disc__msg--reply' : ''} ${isLecturer ? 'ula-acad-disc__msg--lecturer' : ''} ${isReplyToMe ? 'ula-acad-disc__msg--to-me' : ''}`}
      style={isReply ? { marginLeft: `${Math.min(depth, 4) * 1.25}rem` } : undefined}
    >
      <IdentityAvatar name={item.author.fullName} imageUrl={item.author.profilePhotoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{item.author.fullName}</span>
          <span className={`ula-acad-disc__badge ula-acad-disc__badge--${badge.tone}`}>{badge.label}</span>
          {item.course ? (
            <span className="text-[11px] font-semibold text-[#0f4c81]">{item.course.code}</span>
          ) : null}
          {!item.parentId ? (
            <span className="text-[10px] font-medium uppercase text-slate-400">
              {TOPIC_LABELS[item.topic] ?? item.topic}
            </span>
          ) : null}
          <span className="text-[10px] text-slate-400">{item.rel}</span>
          {isReplyToMe ? <span className="ula-acad-disc__to-me">Reply to you</span> : null}
        </div>

        {item.repliedTo ? (
          <p className="ula-acad-disc__reply-to mt-1">
            <i className="fa-solid fa-reply text-[10px] opacity-70" aria-hidden />
            <span>
              <strong>{item.author.fullName}</strong> replied to <strong>{item.repliedTo.authorName}</strong>
            </span>
          </p>
        ) : null}

        <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{item.body}</p>

        {canReply ? (
          <button
            type="button"
            className="mt-1.5 text-[11px] font-semibold text-[#0f4c81] hover:underline"
            onClick={() => onReply(item)}
          >
            Reply
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function AcademicDiscussions({
  variant = 'full',
  courses: coursesProp,
  defaultCourseId,
  showCompose = true,
  live = false,
  onPosted,
}: {
  variant?: 'full' | 'popup';
  courses?: CourseOption[];
  defaultCourseId?: string;
  showCompose?: boolean;
  live?: boolean;
  onPosted?: () => void;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const paths = useTenantPaths();
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<DiscussionPost[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>(coursesProp ?? []);
  const [loading, setLoading] = useState(true);
  const [courseId, setCourseId] = useState(defaultCourseId ?? '');
  const [topic, setTopic] = useState<DiscussionTopic>('GENERAL');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<DiscussionPost | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStudent = user?.role === 'STUDENT';
  const isStaff = isDiscussionStaff(user?.role);
  const canParticipate = isDiscussionParticipant(user?.role);
  const canCreateThread = (isStudent || isStaff) && showCompose;
  const canReply = canParticipate && showCompose;
  const trimmedLen = body.trim().length;
  const needsCourse = isStaff && canCreateThread && !replyTo;
  const canSubmit =
    trimmedLen >= MIN_POST_LEN && !busy && (!needsCourse || Boolean(courseId));

  const load = useCallback(async () => {
    try {
      const useCourse = courseId && (variant === 'full' || isStaff);
      let path = '/api/discussions/feed';
      if (isStaff && !useCourse) path = '/api/discussions/staff/feed';
      else if (useCourse) path = `/api/discussions/course/${courseId}`;
      const res = await api<{ items: DiscussionPost[] }>(path);
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [variant, courseId, isStaff]);

  useEffect(() => {
    setLoading(true);
    void load();
    const pollMs = live ? LIVE_POLL_MS : IDLE_POLL_MS;
    const id = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(id);
  }, [load, live]);

  useEffect(() => {
    if (coursesProp) setCourses(coursesProp);
  }, [coursesProp]);

  useEffect(() => {
    if (!canParticipate || coursesProp?.length) return;
    void api<{ courses: CourseOption[] }>('/api/discussions/participant/courses')
      .then((res) => setCourses(res.courses))
      .catch(() => setCourses([]));
  }, [canParticipate, coursesProp]);

  useEffect(() => {
    if (defaultCourseId) setCourseId(defaultCourseId);
  }, [defaultCourseId]);

  const threads = useMemo(() => buildDiscussionThreads(items), [items]);

  function startReply(post: DiscussionPost) {
    setReplyTo(post);
    setError(null);
    setTimeout(() => composeRef.current?.focus(), 50);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canParticipate || !canSubmit) return;
    if (isStaff && !replyTo && !courseId) {
      setError('Pick a course to send your message to students.');
      return;
    }
    if (isStudent && !replyTo && !courseId) {
      /* General comment — server assigns department default course */
    }
    setBusy(true);
    setError(null);
    try {
      await api<DiscussionPost>('/api/discussions', {
        method: 'POST',
        body: JSON.stringify({
          courseId: replyTo ? null : courseId || null,
          parentId: replyTo?.id ?? null,
          topic: replyTo ? null : topic,
          body: body.trim(),
        }),
      });
      setBody('');
      setReplyTo(null);
      await load();
      onPosted?.();
      setTimeout(() => streamRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 80);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post');
    } finally {
      setBusy(false);
    }
  }

  const shellClass =
    variant === 'popup' ? 'ula-acad-disc ula-acad-disc--popup' : 'ula-acad-disc ula-acad-disc--full';

  return (
    <section className={shellClass}>
      {variant === 'full' ? (
        <div className="ula-acad-disc__head">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0f4c81]">
              <i className="fa-solid fa-comments" aria-hidden />
              Campus discussions
            </p>
            <h2 className="ula-acad-disc__title mt-1">Live academic Q&amp;A</h2>
            <p className="ula-acad-disc__sub">Post globally — everyone sees it. Reply to any message or reply.</p>
          </div>
          {courses.length > 0 ? (
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">All campus (live feed)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : (
        <p className="ula-acad-disc__live-hint px-4 pt-2 text-[11px] text-slate-500">
          <i className="fa-solid fa-circle text-[6px] text-emerald-500 mr-1.5" aria-hidden />
          {isStaff
            ? 'Post to your department courses or reply to students'
            : 'Drop a comment or tag a course — lecturers can reply'}
        </p>
      )}

      <div className="ula-acad-disc__stream" ref={streamRef}>
        {loading && threads.length === 0 ? (
          <p className="text-sm text-slate-500">Loading discussions…</p>
        ) : threads.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
            {isStaff
              ? 'No student questions on your courses yet.'
              : 'No posts yet — pick a course and ask a question below.'}
          </p>
        ) : (
          threads.map((thread) => (
            <div key={thread.root.id} className="ula-acad-disc__thread">
              <DiscussionMessage
                item={thread.root}
                currentUserId={user?.id}
                canReply={canReply}
                onReply={startReply}
              />
              {thread.replies.map((reply) => (
                <DiscussionMessage
                  key={reply.id}
                  item={reply}
                  isReply
                  depth={reply.depth}
                  currentUserId={user?.id}
                  canReply={canReply}
                  onReply={startReply}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {showCompose ? (
        canParticipate ? (
          <form className="ula-acad-disc__compose" onSubmit={onSubmit}>
            {replyTo ? (
              <div className="ula-acad-disc__reply-banner mb-2">
                <p className="text-xs text-slate-700">
                  <i className="fa-solid fa-reply mr-1 text-[#0f4c81]" aria-hidden />
                  Replying to <strong>{replyTo.author.fullName}</strong>
                  {replyTo.course ? ` · ${replyTo.course.code}` : ''}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{replyTo.body}</p>
                <button
                  type="button"
                  className="mt-1 text-[11px] font-semibold text-[#0f4c81] hover:underline"
                  onClick={() => setReplyTo(null)}
                >
                  Cancel reply
                </button>
              </div>
            ) : (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {isStudent ? (
                  <select
                    className="rounded-lg border border-slate-200 px-2 py-1 text-base"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value as DiscussionTopic)}
                  >
                    {(Object.keys(TOPIC_LABELS) as DiscussionTopic[]).map((t) => (
                      <option key={t} value={t}>
                        {TOPIC_LABELS[t]}
                      </option>
                    ))}
                  </select>
                ) : null}
                <select
                  className="rounded-lg border border-slate-200 px-2 py-1 text-base"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required={isStaff}
                >
                  <option value="">
                    {isStudent ? 'General comment (optional course)' : 'Select course (required)'}
                  </option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
            <textarea
              ref={composeRef}
              className="ula-acad-disc__input"
              rows={2}
              placeholder={
                replyTo
                  ? `Reply to ${replyTo.author.fullName.split(' ')[0]}…`
                  : isStaff
                    ? 'Message your students about this course…'
                    : 'Share a comment or ask your lecturer…'
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400">
                {trimmedLen < MIN_POST_LEN
                  ? `${MIN_POST_LEN - trimmedLen} more chars`
                  : needsCourse && !courseId
                    ? 'Select a course'
                    : 'Ready to post'}
              </span>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-xl bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Posting…' : replyTo ? 'Post reply' : 'Post'}
              </button>
            </div>
          </form>
        ) : (
          <div className="ula-acad-disc__compose text-center">
            <p className="text-sm text-slate-600">Sign in to ask course questions or reply.</p>
            <Link
              to={paths.login}
              state={{ from: location.pathname }}
              className="mt-2 inline-flex rounded-xl bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white"
            >
              Sign in
            </Link>
          </div>
        )
      ) : null}
    </section>
  );
}
