/** Stable pseudo-rating (4.2–5.0) until real peer ratings exist — deterministic per id */
export function stableRating(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i);
  }
  const u = Math.abs(h) % 81; // 0..80
  return Math.round((4.2 + u / 100) * 10) / 10;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb >= 10 ? kb.toFixed(0) : kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)} MB`;
}

export function fileExt(name: string): string {
  const p = name.split('.').pop();
  return p ? p.toUpperCase().slice(0, 8) : 'FILE';
}

export type PreviewMode = 'image' | 'pdf' | 'docx' | 'none';

export function inferPreviewMode(mime: string | null | undefined, fileName: string): PreviewMode {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const m = (mime || '').toLowerCase();
  if (['doc', 'docx'].includes(ext) || m.includes('wordprocessingml') || m === 'application/msword') return 'docx';
  if (m.includes('pdf') || ext === 'pdf') return 'pdf';
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  return 'none';
}

export function canPreviewInBrowser(mime: string | null | undefined, fileName: string): boolean {
  return inferPreviewMode(mime, fileName) !== 'none';
}

export function inferPreviewModeFromFile(file: File): PreviewMode {
  return inferPreviewMode(file.type, file.name);
}
