import { useCallback, useEffect, useRef, useState } from 'react';
import '../styles/docx-preview.css';
import { fetchFileBuffer, type FileAccess } from '../lib/secureFile';

type Source = File | string;

type Props = {
  source: Source;
  className?: string;
  title?: string;
  paginated?: boolean;
  onReady?: () => void;
  fileAccess?: FileAccess;
};

async function loadDocxBuffer(source: Source, fileAccess?: FileAccess): Promise<ArrayBuffer> {
  if (source instanceof File) return source.arrayBuffer();
  return fetchFileBuffer(source, fileAccess);
}

export function DocxPreview({
  source,
  className = '',
  title = 'Document preview',
  paginated = true,
  onReady,
  fileAccess,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(0);

  const applyPage = useCallback((index: number, total: number) => {
    const el = containerRef.current;
    if (!el || total < 1) return;
    const sections = el.querySelectorAll('.docx-wrapper > section');
    sections.forEach((node, i) => {
      node.classList.toggle('docx-page-active', i === index);
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    el.innerHTML = '';
    setLoading(true);
    setError(null);
    setPage(0);
    setPageCount(0);

    (async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        const buffer = await loadDocxBuffer(source, fileAccess);
        if (cancelled) return;

        await renderAsync(buffer, el, undefined, {
          className: 'docx-preview',
          inWrapper: true,
          breakPages: true,
          ignoreWidth: true,
          ignoreHeight: false,
          renderHeaders: true,
          renderFooters: true,
        });

        if (cancelled) return;

        const sections = el.querySelectorAll('.docx-wrapper > section');
        const total = Math.max(1, sections.length);
        setPageCount(total);
        if (paginated && total > 0) {
          applyPage(0, total);
        } else {
          sections.forEach((node) => node.classList.add('docx-page-active'));
        }
        setLoading(false);
        onReady?.();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Preview failed');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, fileAccess?.kind, fileAccess?.id, paginated, applyPage]);

  useEffect(() => {
    if (paginated && pageCount > 0) applyPage(page, pageCount);
  }, [page, pageCount, paginated, applyPage]);

  const canPrev = page > 0;
  const canNext = page < pageCount - 1;

  return (
    <div className={`docx-preview-shell ${className}`} aria-label={title}>
      {paginated && pageCount > 1 ? (
        <div className="docx-preview-shell__toolbar">
          <button
            type="button"
            className="docx-preview-shell__nav h-9 w-9"
            disabled={!canPrev || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Previous page"
          >
            <i className="fa-solid fa-chevron-left text-[11px]" aria-hidden />
          </button>
          <span className="docx-preview-shell__page-label">
            Page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            className="docx-preview-shell__nav h-9 w-9"
            disabled={!canNext || loading}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            aria-label="Next page"
          >
            <i className="fa-solid fa-chevron-right text-[11px]" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="docx-preview-shell__viewport">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700" aria-hidden />
            <p className="text-[12px] text-dark-400">Rendering document…</p>
          </div>
        ) : null}
        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <i className="fa-regular fa-file-word text-2xl text-dark-300" aria-hidden />
            <p className="text-[13px] text-dark-500">{error}</p>
          </div>
        ) : null}
        <div
          ref={containerRef}
          className="docx-preview-host"
          data-paginated={paginated ? 'true' : 'false'}
          hidden={loading || Boolean(error)}
        />
      </div>
    </div>
  );
}
