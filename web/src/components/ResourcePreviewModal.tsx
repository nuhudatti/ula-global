import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import '../styles/resource-preview.css';
import { fileExt, formatBytes } from '../lib/format';
import { secureViewPath, type FileDelivery } from '../lib/secureFile';
import { FilePreviewPane } from './FilePreviewPane';
import { themeForKind } from '../lib/resourceThemes';
import type { ResourceCardModel } from './ResourceCard';

const KIND_LABEL: Record<string, string> = {
  LECTURE_NOTES: 'Lecture notes',
  PAST_QUESTIONS: 'Past questions',
  HANDOUT: 'Handout',
  ASSIGNMENT: 'Assignment',
  PROJECT: 'Project',
  OTHER: 'Other',
};

type Props = {
  resource: ResourceCardModel;
  delivery: FileDelivery | null;
  onClose: () => void;
  onDownload: () => void;
};

export function ResourcePreviewModal({ resource: r, delivery, onClose, onDownload }: Props) {
  const theme = themeForKind(r.kind);
  const label = KIND_LABEL[r.kind] || r.kind;
  const fullScreenUrl = secureViewPath('resource', r.id);
  const [loaded, setLoaded] = useState(false);
  const showPdf = delivery?.previewAs === 'pdf';
  const showDocx = delivery?.previewAs === 'docx';
  const cdnUrl = delivery?.url;

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

  useEffect(() => {
    setLoaded(false);
  }, [cdnUrl]);

  return createPortal(
    <div
      className="ula-preview-root fixed inset-0 z-[80] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div className="ula-preview-backdrop absolute inset-0 bg-dark-900/55 backdrop-blur-[6px]" aria-hidden />

      <div
        className="ula-preview-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.35rem] bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.18)] sm:max-h-[88vh] sm:max-w-3xl sm:rounded-2xl sm:shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`h-1 shrink-0 bg-gradient-to-r ${theme.ribbon}`} aria-hidden />

        <div className="flex shrink-0 justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-dark-200" />
        </div>

        <header className="flex shrink-0 items-start gap-3 border-b border-dark-100/90 px-4 pb-3 pt-2 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${theme.badge}`}>
                <i className={`fa-solid ${theme.iconClass} text-[9px]`} aria-hidden />
                {label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
                <i className="fa-solid fa-shield-halved text-[9px]" aria-hidden />
                Verified
              </span>
            </div>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-primary-700">{r.course.code}</p>
            <h2 id="resource-preview-title" className="mt-0.5 line-clamp-2 text-[17px] font-semibold leading-snug text-dark-900 sm:text-lg">
              {r.title}
            </h2>
            <p className="mt-1 truncate text-[12px] text-dark-500">
              {r.course.department.name} · {r.uploadedBy.fullName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dark-50 text-dark-500 transition hover:bg-dark-100 hover:text-dark-800 active:scale-95"
          >
            <i className="fa-solid fa-xmark text-lg" aria-hidden />
          </button>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#f8faf9]">
          {!cdnUrl || (!loaded && !showDocx) ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#f8faf9]">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700" aria-hidden />
              <p className="text-[12px] text-dark-400">{cdnUrl ? 'Loading preview…' : 'Opening…'}</p>
            </div>
          ) : null}

          {cdnUrl && showDocx ? (
            <FilePreviewPane
              url={cdnUrl}
              mimeType={delivery?.mimeType}
              fileName={delivery?.fileName ?? r.originalFileName}
              title={r.title}
              fileAccess={{ kind: 'resource', id: r.id }}
              onReady={() => setLoaded(true)}
              heightClass="h-full min-h-[50dvh] sm:min-h-[52vh]"
            />
          ) : cdnUrl && showPdf ? (
            <iframe
              src={cdnUrl}
              title={r.title}
              className="h-full min-h-[50dvh] w-full bg-white sm:min-h-[52vh]"
              onLoad={() => setLoaded(true)}
            />
          ) : cdnUrl ? (
            <div className="flex h-full min-h-[40dvh] items-center justify-center overflow-auto p-3 sm:min-h-[48vh] sm:p-5">
              <img
                src={cdnUrl}
                alt={r.title}
                decoding="async"
                className="max-h-[min(68dvh,520px)] w-auto max-w-full rounded-lg shadow-md ring-1 ring-dark-200/60"
                onLoad={() => setLoaded(true)}
                onError={() => setLoaded(true)}
              />
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-dark-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
          <div className="mb-3 flex items-center justify-between gap-2 text-[11px] text-dark-400">
            <span className="inline-flex items-center gap-1.5 truncate">
              <i className="fa-regular fa-file-lines" aria-hidden />
              {fileExt(r.originalFileName)} · {formatBytes(r.sizeBytes)}
            </span>
            <span className="shrink-0 tabular-nums">{r.downloadCount.toLocaleString()} saves</span>
          </div>
          <div className="flex gap-2">
            {!showDocx ? (
              <a
                href={fullScreenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-dark-200 bg-white px-4 text-[14px] font-semibold text-dark-700 transition hover:bg-dark-50 active:scale-[0.98] sm:flex-initial sm:px-5"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-[12px]" aria-hidden />
                Full screen
              </a>
            ) : null}
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex min-h-[44px] flex-[1.2] items-center justify-center gap-2 rounded-xl bg-primary-800 px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary-900 active:scale-[0.98] sm:flex-initial"
            >
              <i className="fa-solid fa-arrow-down-to-bracket text-[13px]" aria-hidden />
              Download
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
