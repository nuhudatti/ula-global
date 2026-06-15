import { api, buildApiHeaders, resolveRequestInstitutionSlug } from './api';

export type FileAccess = { kind: string; id: string };

export type DownloadPhase = 'idle' | 'connecting' | 'downloading' | 'saving' | 'done' | 'error';

export function secureStreamPath(kind: string, id: string, inline = false, embed = false): string {
  const params = new URLSearchParams();
  params.set('kind', kind);
  params.set('id', id);
  if (inline) params.set('inline', '1');
  if (embed) params.set('embed', '1');
  const slug = resolveRequestInstitutionSlug();
  if (slug) params.set('institution', slug);
  return `/api/files/stream?${params.toString()}`;
}

/** New tab — fast redirect to CDN. */
export function secureViewPath(kind: string, id: string): string {
  return secureStreamPath(kind, id, true);
}

/** In-app modal iframe — proxied inline so embedding always works. */
export function secureEmbedPath(kind: string, id: string): string {
  return secureStreamPath(kind, id, true, true);
}

export type FileDelivery = {
  url: string;
  previewAs: 'image' | 'pdf' | 'docx';
  fileName: string;
  mimeType: string | null;
};

/** Load file bytes — CDN first, API stream proxy if CORS blocks (DOCX). */
export async function fetchFileBuffer(
  directUrl: string | undefined,
  fallback?: FileAccess,
): Promise<ArrayBuffer> {
  if (directUrl) {
    try {
      const res = await fetch(directUrl);
      if (res.ok) return res.arrayBuffer();
    } catch {
      /* try proxy */
    }
  }
  if (!fallback) throw new Error('Could not load document');
  const res = await fetch(secureStreamPath(fallback.kind, fallback.id, true, true), {
    headers: buildApiHeaders(),
  });
  if (!res.ok) throw new Error('Could not load document');
  return res.arrayBuffer();
}

/** Fast CDN preview URL — direct Cloudinary link, no proxy hop. */
export async function fetchFileDelivery(kind: string, id: string): Promise<FileDelivery> {
  return api<FileDelivery>(
    `/api/files/delivery?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`,
  );
}

/** @deprecated use fetchFileDelivery */
export async function fetchDeliveryUrl(kind: string, id: string): Promise<string> {
  const data = await fetchFileDelivery(kind, id);
  return data.url;
}

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* ignore */
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  if (plain?.[1]) return plain[1];
  return null;
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

async function tryMobileFileShare(blob: Blob, fileName: string): Promise<boolean> {
  if (!navigator.share || typeof File === 'undefined') return false;
  try {
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
    if (!navigator.canShare?.({ files: [file] })) return false;
    await navigator.share({ files: [file], title: fileName });
    return true;
  } catch {
    return false;
  }
}

async function triggerBlobDownload(blob: Blob, fileName: string): Promise<void> {
  const url = URL.createObjectURL(blob);

  if (isMobileDevice()) {
    const shared = await tryMobileFileShare(blob, fileName);
    if (!shared) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener';
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Download via authenticated backend stream — single canonical download path. */
export async function downloadSecureStream(
  kind: string,
  id: string,
  suggestedName: string,
  onPhase?: (phase: DownloadPhase, progressPercent?: number) => void,
): Promise<void> {
  onPhase?.('connecting', 0);

  const res = await fetch(secureStreamPath(kind, id), { headers: buildApiHeaders() });
  if (!res.ok) {
    onPhase?.('error', 0);
    let msg = 'Download failed';
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const total = Number(res.headers.get('Content-Length')) || 0;
  const fileName =
    parseFilenameFromDisposition(res.headers.get('Content-Disposition')) || suggestedName || 'download';

  const body = res.body;
  if (!body) {
    onPhase?.('error', 0);
    throw new Error('Empty download response');
  }

  onPhase?.('downloading', 0);

  const reader = body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (total > 0) {
        onPhase?.('downloading', Math.min(99, Math.round((received / total) * 100)));
      }
    }
  }

  onPhase?.('saving', total > 0 ? 100 : undefined);
  const blob = new Blob(chunks, { type: res.headers.get('Content-Type') || 'application/octet-stream' });
  await triggerBlobDownload(blob, fileName);
  onPhase?.('done', 100);
}

/** Resource download — canonical /api/files/stream path. */
export function downloadResourceFile(
  resourceId: string,
  suggestedName: string,
  onPhase?: (phase: DownloadPhase, progressPercent?: number) => void,
): Promise<void> {
  return downloadSecureStream('resource', resourceId, suggestedName, onPhase);
}

export function downloadQuestionPaper(assignmentId: string, fileName: string): Promise<void> {
  return downloadSecureStream('assignment-attachment', assignmentId, fileName);
}

export function downloadMySubmission(assignmentId: string, fileName: string): Promise<void> {
  return downloadSecureStream('my-assignment-submission', assignmentId, fileName);
}
