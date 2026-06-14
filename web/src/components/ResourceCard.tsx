import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { canPreviewInBrowser, fileExt, formatBytes } from '../lib/format';
import { api } from '../lib/api';
import { downloadResourceFile, type DownloadPhase } from '../lib/download';
import { useAuth } from '../context/AuthContext';
import { useTenantPaths } from '../hooks/useTenantPaths';
import { themeForKind } from '../lib/resourceThemes';
import { fetchFileDelivery, type FileDelivery } from '../lib/secureFile';
import { MetaInfoRow } from './MetaInfoRow';
import { ActionButtons } from './ActionButtons';
import { ResourcePreviewModal } from './ResourcePreviewModal';

export type ResourceCardModel = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  examYear: number | null;
  avgRating: number;
  ratingCount: number;
  userRating: number | null;
  hasFile: boolean;
  fileAccess: { kind: string; id: string };
  originalFileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  downloadCount: number;
  createdAt: string;
  course: {
    code: string;
    title: string;
    level: number | null;
    department: { name: string; faculty: { name: string; code: string } };
  };
  uploadedBy: { id: string; fullName: string; profilePhotoUrl?: string | null };
  contributedBy?: { id: string; fullName: string } | null;
};

const KIND_LABEL: Record<string, string> = {
  LECTURE_NOTES: 'Lecture notes',
  PAST_QUESTIONS: 'Past questions',
  HANDOUT: 'Handout',
  ASSIGNMENT: 'Assignment',
  PROJECT: 'Project',
  OTHER: 'Other',
};

type Props = {
  r: ResourceCardModel;
  onDownload?: (
    id: string,
    fileName: string,
    onPhase?: (phase: DownloadPhase, progressPercent?: number) => void,
  ) => Promise<void>;
  onRated?: () => void;
};

/** Read-only average — tight, low-noise (FA solid / regular). */
function RatingStarsDisplay({ score }: { score: number }) {
  const filled = Math.min(5, Math.max(0, Math.round(score)));
  return (
    <span className="inline-flex items-center gap-px" aria-hidden>
      {[1, 2, 3, 4, 5].map((s) => (
        <i
          key={s}
          className={`fa-star text-[10px] leading-none ${s <= filled ? 'fa-solid text-amber-400/95' : 'fa-regular text-dark-200/75'}`}
        />
      ))}
    </span>
  );
}

export function ResourceCard({ r, onDownload, onRated }: Props) {
  const { user } = useAuth();
  const location = useLocation();
  const paths = useTenantPaths();
  const theme = themeForKind(r.kind);
  const label = KIND_LABEL[r.kind] || r.kind;
  const preview = canPreviewInBrowser(r.mimeType, r.originalFileName);
  const own = user?.id === r.uploadedBy.id;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDelivery, setPreviewDelivery] = useState<FileDelivery | null>(null);
  const [viewBusy, setViewBusy] = useState(false);
  const [avg, setAvg] = useState(r.avgRating);
  const [count, setCount] = useState(r.ratingCount);
  const [mine, setMine] = useState(r.userRating);
  const [busy, setBusy] = useState(false);
  const [downloadPhase, setDownloadPhase] = useState<DownloadPhase>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAvg(r.avgRating);
    setCount(r.ratingCount);
    setMine(r.userRating);
  }, [r.id, r.avgRating, r.ratingCount, r.userRating]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const displayAvg = useMemo(() => {
    if (count <= 0) return null;
    return avg;
  }, [avg, count]);

  async function handleView() {
    if (viewBusy || !preview) return;
    setPreviewOpen(true);
    setPreviewDelivery(null);
    setViewBusy(true);
    try {
      const delivery = await fetchFileDelivery('resource', r.id);
      setPreviewDelivery(delivery);
    } catch (error) {
      setPreviewOpen(false);
      alert(error instanceof Error ? error.message : 'Could not open preview');
    } finally {
      setViewBusy(false);
    }
  }

  async function handleDownload() {
    if (downloadPhase !== 'idle' && downloadPhase !== 'error' && downloadPhase !== 'done') return;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    setDownloadPhase('connecting');
    setDownloadProgress(0);

    try {
      const run = onDownload ?? downloadResourceFile;
      await run(r.id, r.originalFileName, (phase, pct) => {
        setDownloadPhase(phase);
        if (pct != null) setDownloadProgress(pct);
      });
      resetTimerRef.current = setTimeout(() => {
        setDownloadPhase('idle');
        setDownloadProgress(0);
      }, 2200);
    } catch (error) {
      setDownloadPhase('error');
      setDownloadProgress(0);
      alert(error instanceof Error ? error.message : 'Download failed');
      resetTimerRef.current = setTimeout(() => {
        setDownloadPhase('idle');
      }, 1200);
    }
  }

  async function submitRating(value: number) {
    if (!user || own) return;
    setBusy(true);
    try {
      const res = await api<{ avgRating: number; ratingCount: number; userRating: number | null }>(`/api/ratings`, {
        method: 'POST',
        body: JSON.stringify({ resourceId: r.id, value }),
      });
      setAvg(res.avgRating);
      setCount(res.ratingCount);
      setMine(res.userRating);
      onRated?.();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not save rating');
    } finally {
      setBusy(false);
    }
  }

  const canRate = Boolean(user) && !own;
  const ratingHint = own ? 'Own upload' : !user ? 'Sign in to rate' : null;

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-dark-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-[box-shadow,border-color,transform] duration-300 hover:-translate-y-px hover:border-dark-300/90 hover:shadow-[0_8px_30px_-12px_rgba(15,23,42,0.08)] ${theme.glow}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.ribbon}`} aria-hidden />

      <header className="relative mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${theme.badge}`}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${theme.iconBox}`}>
            <i className={`fa-solid ${theme.iconClass} text-[13px]`} aria-hidden />
          </span>
          {label}
        </div>
        {r.examYear ? (
          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-dark-50 px-2.5 py-1 text-[11px] font-medium tabular-nums text-dark-500 ring-1 ring-dark-100/90">
            <i className="fa-regular fa-calendar text-[10px]" aria-hidden />
            {r.examYear}/{r.examYear + 1}
          </span>
        ) : null}
      </header>

      <div className="mb-4 space-y-1.5">
        <p className="text-[13px] font-semibold tracking-wide text-primary-700">{r.course.code}</p>
        <h3 className="text-[17px] font-semibold leading-snug tracking-tight text-dark-900 md:text-lg">{r.title}</h3>
        <p className="text-[14px] leading-snug text-dark-500">{r.course.title}</p>
        <p className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-dark-400">
          <i className="fa-regular fa-file-lines text-[11px]" aria-hidden />
          {fileExt(r.originalFileName)} · {formatBytes(r.sizeBytes)}
        </p>
      </div>

      <div className="mb-3">
        <MetaInfoRow
          department={r.course.department.name}
          level={r.course.level}
          lecturerName={r.uploadedBy.fullName}
          lecturerPhotoUrl={r.uploadedBy.profilePhotoUrl}
          contributorName={r.contributedBy?.fullName}
        />
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[13px] text-dark-500">
        <span className="tabular-nums">
          <span className="font-medium text-dark-800">{r.downloadCount.toLocaleString()}</span>
          <span className="text-dark-400"> downloads</span>
        </span>
        {count > 0 && displayAvg != null ? (
          <div
            className="flex items-center gap-2.5 tabular-nums"
            role="img"
            aria-label={`${displayAvg.toFixed(1)} out of 5 stars, ${count} ratings`}
          >
            <RatingStarsDisplay score={displayAvg} />
            <span className="flex items-baseline gap-1.5">
              <span className="text-[14px] font-semibold text-dark-900">{displayAvg.toFixed(1)}</span>
              <span className="text-dark-300" aria-hidden>
                ·
              </span>
              <span className="text-[13px] text-dark-400">{count}</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-dark-400">
            <RatingStarsDisplay score={0} />
            <span className="text-[13px]">No score yet</span>
          </div>
        )}
      </div>

      {canRate ? (
        <div className={count > 0 ? 'mb-4 border-t border-dark-100/80 pt-2.5' : 'mb-4'}>
          <div className="flex items-center gap-0.5" role="group" aria-label="Your rating, 1 to 5 stars">
            {[1, 2, 3, 4, 5].map((s) => {
              const filled = mine != null ? s <= mine : false;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  aria-label={`${s} of 5 stars`}
                  aria-pressed={mine != null && s <= mine}
                  onClick={() => void submitRating(s)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md text-[15px] transition-colors duration-150 disabled:opacity-40 ${
                    filled ? 'text-amber-500' : 'text-dark-200 hover:bg-dark-50/80 hover:text-amber-500/85'
                  }`}
                >
                  <i className={`${filled ? 'fa-solid' : 'fa-regular'} fa-star`} aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
      ) : !user ? (
        <p className="mb-4 text-[12px] text-dark-500">
          <Link to={paths.login} state={{ from: location.pathname }} className="font-semibold text-primary-700 hover:underline">
            Sign in
          </Link>{' '}
          to rate this material
        </p>
      ) : ratingHint ? (
        <p className="mb-4 text-[12px] text-dark-400">{ratingHint}</p>
      ) : null}

      <div className="mt-auto pt-3">
        <ActionButtons
          onDownload={() => void handleDownload()}
          onView={preview ? () => void handleView() : undefined}
          viewLoading={viewBusy}
          downloadPhase={downloadPhase}
          downloadProgress={downloadProgress}
          showView={preview}
        />
      </div>

      {previewOpen ? (
        <ResourcePreviewModal
          resource={r}
          delivery={previewDelivery}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewDelivery(null);
          }}
          onDownload={() => void handleDownload()}
        />
      ) : null}
    </article>
  );
}
