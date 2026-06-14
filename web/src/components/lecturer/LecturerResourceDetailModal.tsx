import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { canPreviewInBrowser, fileExt, formatBytes } from '../../lib/format';
import { kindLabel, type LecturerResource } from '../../lib/lecturer';
import { themeForKind } from '../../lib/resourceThemes';
import { downloadResourceFile } from '../../lib/download';
import { fetchFileDelivery, type FileDelivery } from '../../lib/secureFile';
import { FilePreviewPane } from '../FilePreviewPane';
import { DocumentPreviewModal } from '../DocumentPreviewModal';

type Props = {
  resource: LecturerResource;
  onClose: () => void;
  onDelete: (id: string) => void;
};

export function LecturerResourceDetailModal({ resource: r, onClose, onDelete }: Props) {
  const theme = themeForKind(r.kind);
  const preview = canPreviewInBrowser(r.mimeType, r.originalFileName);
  const session = r.examYear ? `${r.examYear}/${r.examYear + 1}` : 'Current session';
  const [delivery, setDelivery] = useState<FileDelivery | null>(null);
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);

  useEffect(() => {
    if (!preview) {
      setDelivery(null);
      return;
    }
    let cancelled = false;
    fetchFileDelivery('resource', r.id)
      .then((d) => {
        if (!cancelled) setDelivery(d);
      })
      .catch(() => {
        if (!cancelled) setDelivery(null);
      });
    return () => {
      cancelled = true;
    };
  }, [r.id, preview]);

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

  function handleDelete() {
    if (window.confirm(`Remove “${r.title}” from your library? Students will no longer see it.`)) {
      onDelete(r.id);
      onClose();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-dark-900/45 p-3 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`h-1 shrink-0 bg-gradient-to-r ${theme.ribbon}`} aria-hidden />

        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-dark-100/80 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${theme.badge}`}>
                <i className={`fa-solid ${theme.iconClass} text-[10px]`} aria-hidden />
                {kindLabel(r.kind)}
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-100">
                Published
              </span>
            </div>
            <p className="mt-2 text-[12px] font-semibold text-primary-700">
              {r.course.code} · {r.course.title}
            </p>
            <h2 id="material-detail-title" className="mt-1 text-xl font-semibold leading-snug text-dark-900 sm:text-[1.35rem]">
              {r.title}
            </h2>
            {r.description ? (
              <p className="mt-2 text-[14px] leading-relaxed text-dark-600">{r.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-xl p-2.5 text-dark-400 transition hover:bg-dark-50 hover:text-dark-700"
            aria-label="Close"
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark text-[15px]" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
            <div className="rounded-xl bg-dark-50 p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-dark-400">Posted</dt>
              <dd className="mt-1 font-medium text-dark-800">
                {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </dd>
            </div>
            <div className="rounded-xl bg-dark-50 p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-dark-400">Session</dt>
              <dd className="mt-1 font-medium text-dark-800">{session}</dd>
            </div>
            <div className="rounded-xl bg-dark-50 p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-dark-400">Downloads</dt>
              <dd className="mt-1 font-medium tabular-nums text-dark-800">{r.downloadCount.toLocaleString()}</dd>
            </div>
            <div className="rounded-xl bg-dark-50 p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-dark-400">Rating</dt>
              <dd className="mt-1 font-medium tabular-nums text-dark-800">
                {r.ratingCount > 0 ? `${r.avgRating.toFixed(1)} (${r.ratingCount})` : '—'}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-dark-500">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-dark-50 px-2.5 py-1.5">
              <i className="fa-solid fa-sitemap text-[10px] text-dark-400" aria-hidden />
              {r.course.department.name}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-dark-50 px-2.5 py-1.5">
              <i className="fa-regular fa-file-lines text-[10px] text-dark-400" aria-hidden />
              {fileExt(r.originalFileName)} · {formatBytes(r.sizeBytes)}
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-dark-200/70">
            <div className="flex items-center justify-between border-b border-dark-100 bg-dark-50/60 px-4 py-2.5">
              <p className="text-[12px] font-semibold text-dark-600">
                <i className="fa-regular fa-eye mr-1.5 text-primary-600" aria-hidden />
                Document preview
              </p>
              {preview && delivery?.url ? (
                <button
                  type="button"
                  onClick={() => setFullPreviewOpen(true)}
                  className="text-[12px] font-medium text-primary-700 hover:underline"
                >
                  Open full screen
                </button>
              ) : null}
            </div>
            {preview && delivery?.url ? (
              <FilePreviewPane
                url={delivery.url}
                mimeType={delivery.mimeType}
                fileName={delivery.fileName}
                title={r.title}
                fileAccess={{ kind: 'resource', id: r.id }}
                heightClass="h-[min(52vh,420px)]"
              />
            ) : preview ? (
              <div className="flex h-[min(52vh,420px)] items-center justify-center bg-dark-50/40">
                <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700" aria-hidden />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                  <i className="fa-regular fa-file-lines text-2xl" aria-hidden />
                </span>
                <p className="text-[14px] font-medium text-dark-700">{r.originalFileName}</p>
                <p className="text-[12px] text-dark-400">No inline preview — open or download the file.</p>
              </div>
            )}
          </div>

          <p className="mt-4 text-[12px] text-dark-400">
            To change title or file, publish an updated version from Publish material.
          </p>
        </div>

        <footer className="flex shrink-0 flex-wrap gap-2 border-t border-dark-100/80 bg-white px-5 py-4 sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200/80 px-4 py-2.5 text-[13px] font-semibold text-red-700 hover:bg-red-50 sm:mr-auto"
          >
            <i className="fa-solid fa-trash-can text-[11px]" aria-hidden />
            Remove
          </button>
          <button
            type="button"
            onClick={() => void downloadResourceFile(r.id, r.originalFileName)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dark-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-dark-700 hover:bg-dark-50 sm:flex-initial"
          >
            <i className="fa-solid fa-arrow-down-to-bracket text-[12px]" aria-hidden />
            Download
          </button>
          {preview && delivery?.url ? (
            <button
              type="button"
              onClick={() => setFullPreviewOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-800 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-900 sm:flex-initial"
            >
              <i className="fa-regular fa-eye text-[12px]" aria-hidden />
              View file
            </button>
          ) : null}
        </footer>
      </div>

      {fullPreviewOpen && delivery?.url ? (
        <DocumentPreviewModal
          title={r.title}
          fileName={r.originalFileName}
          url={delivery.url}
          mimeType={delivery.mimeType}
          fileAccess={{ kind: 'resource', id: r.id }}
          onClose={() => setFullPreviewOpen(false)}
        />
      ) : null}
    </div>,
    document.body,
  );
}
