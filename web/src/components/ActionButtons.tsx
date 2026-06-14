import type { DownloadPhase } from '../lib/download';

type ActionButtonsProps = {
  onDownload: () => void;
  onView?: () => void;
  viewUrl?: string;
  showView?: boolean;
  viewLoading?: boolean;
  downloadPhase?: DownloadPhase;
  downloadProgress?: number;
};

export function ActionButtons({
  onDownload,
  onView,
  viewUrl,
  showView = Boolean(onView || viewUrl),
  viewLoading = false,
  downloadPhase = 'idle',
  downloadProgress = 0,
}: ActionButtonsProps) {
  const canViewLink = showView && Boolean(viewUrl) && !onView;
  const busy = downloadPhase !== 'idle' && downloadPhase !== 'error';
  const done = downloadPhase === 'done';

  const secondary =
    'inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-dark-800 px-5 text-[15px] font-medium text-white shadow-sm transition-colors duration-200 hover:bg-dark-900 active:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dark-900/40 sm:flex-initial sm:min-w-[7.25rem]';

  const primaryBase =
    'relative inline-flex min-h-[44px] flex-1 flex-col items-center justify-center overflow-hidden rounded-xl bg-primary-800 px-5 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(20,83,45,0.35)] transition-[background-color,transform,opacity] duration-200 hover:bg-primary-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-900 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial sm:min-w-[9rem]';

  let primaryLabel = 'Download';
  let primaryIcon = 'fa-arrow-down-to-bracket';

  if (downloadPhase === 'connecting') {
    primaryLabel = 'Starting…';
    primaryIcon = 'fa-spinner fa-spin';
  } else if (downloadPhase === 'downloading') {
    primaryLabel = downloadProgress > 0 ? `Downloading ${downloadProgress}%` : 'Downloading…';
    primaryIcon = 'fa-spinner fa-spin';
  } else if (downloadPhase === 'saving') {
    primaryLabel = 'Saving…';
    primaryIcon = 'fa-spinner fa-spin';
  } else if (done) {
    primaryLabel = 'Saved';
    primaryIcon = 'fa-check';
  }

  const showBar = downloadPhase === 'downloading' && downloadProgress > 0;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-end sm:gap-2">
      {showView ? (
        onView ? (
          <button
            type="button"
            onClick={onView}
            disabled={viewLoading}
            className={`${secondary} ${viewLoading ? 'cursor-wait opacity-70' : ''}`}
            aria-busy={viewLoading}
          >
            <i className={`fa-regular ${viewLoading ? 'fa-spinner fa-spin' : 'fa-eye'} text-[15px] opacity-90`} aria-hidden />
            {viewLoading ? 'Loading…' : 'View'}
          </button>
        ) : canViewLink ? (
          <a href={viewUrl} target="_blank" rel="noopener noreferrer" className={secondary}>
            <i className="fa-regular fa-eye text-[15px] opacity-90" aria-hidden />
            View
          </a>
        ) : (
          <button
            type="button"
            disabled={viewLoading}
            className={`${secondary} cursor-wait opacity-70`}
            aria-busy={viewLoading}
          >
            <i className={`fa-regular ${viewLoading ? 'fa-spinner fa-spin' : 'fa-eye'} text-[15px] opacity-90`} aria-hidden />
            {viewLoading ? 'Loading…' : 'View'}
          </button>
        )
      ) : null}
      <button
        type="button"
        onClick={onDownload}
        disabled={busy}
        aria-busy={busy}
        aria-live="polite"
        className={`${primaryBase} ${done ? 'bg-primary-700' : ''} ${busy && !done ? 'active:scale-100' : 'active:scale-[0.99]'}`}
      >
        {showBar ? (
          <span
            className="absolute inset-x-0 bottom-0 h-0.5 bg-white/25"
            aria-hidden
          >
            <span
              className="block h-full bg-white/90 transition-[width] duration-150 ease-out"
              style={{ width: `${downloadProgress}%` }}
            />
          </span>
        ) : null}
        <span className="inline-flex items-center justify-center gap-2">
          <i className={`fa-solid ${primaryIcon} text-[14px] opacity-95`} aria-hidden />
          {primaryLabel}
        </span>
      </button>
    </div>
  );
}
