import { useEffect, useMemo } from 'react';
import { inferPreviewMode, inferPreviewModeFromFile, type PreviewMode } from '../lib/format';
import type { FileAccess } from '../lib/secureFile';
import { DocxPreview } from './DocxPreview';

type Props = {
  file?: File | null;
  url?: string | null;
  mimeType?: string | null;
  fileName?: string;
  title?: string;
  className?: string;
  heightClass?: string;
  /** compact = icon area only (attach step); document = full paginated preview */
  variant?: 'compact' | 'document';
  fileAccess?: FileAccess;
  onReady?: () => void;
};

function resolveMode(file: File | null | undefined, mimeType: string | null | undefined, fileName: string): PreviewMode {
  if (file) return inferPreviewModeFromFile(file);
  return inferPreviewMode(mimeType, fileName);
}

export function FilePreviewPane({
  file,
  url,
  mimeType,
  fileName = '',
  title = 'Document preview',
  className = '',
  heightClass = 'h-[min(62dvh,560px)]',
  variant = 'document',
  fileAccess,
  onReady,
}: Props) {
  const mode = resolveMode(file, mimeType, fileName || file?.name || '');
  const needsBlob = Boolean(file && mode !== 'docx');
  const blobUrl = useMemo(() => (needsBlob ? URL.createObjectURL(file!) : null), [file, needsBlob]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const src = blobUrl ?? url;
  if (!src || mode === 'none') return null;

  if (mode === 'docx') {
    if (variant === 'compact') return null;
    return (
      <DocxPreview
        source={file ?? url!}
        title={title}
        fileAccess={fileAccess}
        onReady={onReady}
        paginated
        className={`${heightClass} w-full ${className}`}
      />
    );
  }

  if (mode === 'pdf') {
    return <iframe src={src} title={title} className={`${heightClass} w-full bg-white ${className}`} onLoad={onReady} />;
  }

  return (
    <div className={`flex ${heightClass} items-center justify-center overflow-auto bg-dark-50/40 p-4 ${className}`}>
      <img src={src} alt={title} className="max-h-full max-w-full rounded-lg shadow-sm object-contain" onLoad={onReady} />
    </div>
  );
}

/** Attach-step thumbnail: PDF/image only. DOCX uses icon fallback — full preview on review. */
export function canShowAttachThumbnail(file: File | null | undefined): boolean {
  if (!file) return false;
  const mode = inferPreviewModeFromFile(file);
  return mode === 'pdf' || mode === 'image';
}

export function canShowFilePreview(
  file: File | null | undefined,
  mimeType?: string | null,
  fileName?: string,
): boolean {
  if (file) return inferPreviewModeFromFile(file) !== 'none';
  return inferPreviewMode(mimeType, fileName || '') !== 'none';
}
