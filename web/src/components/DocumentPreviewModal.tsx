import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { inferPreviewMode, type PreviewMode } from '../lib/format';
import type { FileAccess } from '../lib/secureFile';
import { FilePreviewPane } from './FilePreviewPane';

type Props = {
  title: string;
  fileName: string;
  file?: File | null;
  url?: string | null;
  mimeType?: string | null;
  fileAccess?: FileAccess;
  onClose: () => void;
};

export function DocumentPreviewModal({
  title,
  fileName,
  file,
  url,
  mimeType,
  fileAccess,
  onClose,
}: Props) {
  const mode: PreviewMode = file
    ? inferPreviewMode(file.type, file.name)
    : inferPreviewMode(mimeType, fileName);

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
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-dark-900/55 p-0 backdrop-blur-[4px] sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-dark-100 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id="doc-preview-title" className="truncate text-[16px] font-semibold text-dark-900">
              {title}
            </h2>
            <p className="truncate text-[12px] text-dark-400">{fileName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dark-50 text-dark-500 hover:bg-dark-100"
          >
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1">
          {mode === 'none' ? (
            <p className="px-6 py-14 text-center text-[13px] text-dark-500">Preview not available for this format.</p>
          ) : (
            <FilePreviewPane
              file={file}
              url={url}
              mimeType={mimeType}
              fileName={fileName}
              title={title}
              fileAccess={fileAccess}
              heightClass="h-[min(78dvh,640px)]"
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
