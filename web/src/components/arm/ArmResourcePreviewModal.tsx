import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { canPreviewInBrowser, formatBytes } from '../../lib/format';
import { armKindLabel, type ArmResource } from '../../lib/arm';
import { downloadResourceFile } from '../../lib/download';
import { fetchFileDelivery, type FileDelivery } from '../../lib/secureFile';
import { FilePreviewPane } from '../FilePreviewPane';
import { DocumentPreviewModal } from '../DocumentPreviewModal';

export function ArmResourcePreviewModal({ resource: r, onClose }: { resource: ArmResource; onClose: () => void }) {
  const preview = canPreviewInBrowser(r.mimeType, r.originalFileName);
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

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal onClick={onClose}>
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">{armKindLabel(r.kind)}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{r.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {r.course.code} · {r.course.department.name}
                {r.sizeBytes ? ` · ${formatBytes(r.sizeBytes)}` : ''}
              </p>
            </div>
            <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-50" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden />
            </button>
          </div>

          {preview && delivery?.url ? (
            <div className="mt-4 max-h-[50vh] overflow-hidden rounded-xl ring-1 ring-slate-200">
              <FilePreviewPane
                url={delivery.url}
                mimeType={delivery.mimeType}
                fileName={delivery.fileName}
                title={r.title}
                fileAccess={{ kind: 'resource', id: r.id }}
                className="max-h-[50vh]"
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Preview not available for this file type.</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {preview && delivery?.url ? (
              <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold text-primary-800 ring-1 ring-primary-200" onClick={() => setFullPreviewOpen(true)}>
                Full preview
              </button>
            ) : null}
            <button type="button" className="rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => void downloadResourceFile(r.id, r.originalFileName)}>
              Download
            </button>
          </div>
        </div>
      </div>

      {fullPreviewOpen && delivery?.url ? (
        <DocumentPreviewModal
          title={r.title}
          fileName={delivery.fileName}
          url={delivery.url}
          mimeType={delivery.mimeType}
          fileAccess={{ kind: 'resource', id: r.id }}
          onClose={() => setFullPreviewOpen(false)}
        />
      ) : null}
    </>,
    document.body,
  );
}
