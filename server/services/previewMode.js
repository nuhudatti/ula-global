/** How the browser should render a file — CDN path beats declared mime (PDF→JPG on Cloudinary). */
export function inferPreviewAs({ fileUrl, mimeType, fileName }) {
  const u = String(fileUrl || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  const ext = String(fileName || '').split('.').pop()?.toLowerCase() || '';

  if (/\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/.test(u)) return 'image';
  if (/\/image\/upload\//.test(u) && !/\.pdf(\?|#|$)/.test(u)) return 'image';
  if (mime.startsWith('image/')) return 'image';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) && !mime.includes('pdf')) return 'image';

  if (['doc', 'docx'].includes(ext) || mime.includes('wordprocessingml') || mime === 'application/msword') {
    return 'docx';
  }

  if (/\.pdf(\?|#|$)/.test(u) || /\/raw\/upload\//.test(u)) return 'pdf';
  if (mime.includes('pdf') && ext === 'pdf') return 'pdf';

  return 'image';
}
