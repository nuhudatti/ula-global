import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { fetchCloudinaryResponse } from './cloudinaryService.js';

export { cloudinaryAttachmentUrl, cloudinaryInlineUrl } from './cloudinaryUrls.js';

/** Safe filename for Content-Disposition */
export function contentDispositionFilename(name, inline = false) {
  const base = String(name || 'download')
    .replace(/[\r\n"]/g, '')
    .split(/[/\\]/)
    .pop() || 'download';
  const ascii = base.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(base);
  const disposition = inline ? 'inline' : 'attachment';
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/**
 * Stream file bytes from Cloudinary to Express response (API proxy — no broken direct links).
 */
export async function streamSecureFile(row, res, { inline = false } = {}) {
  const fileName = row.originalFileName || row.fileName || 'download';
  if (!row.publicId && !row.cloudinaryPublicId && !row.fileUrl) {
    const err = new Error('File missing');
    err.statusCode = 404;
    throw err;
  }

  res.setHeader('Content-Disposition', contentDispositionFilename(fileName, inline));
  res.setHeader('Content-Type', row.mimeType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, no-store');

  const upstream = await fetchCloudinaryResponse(
    {
      publicId: row.publicId || row.cloudinaryPublicId,
      fileUrl: row.fileUrl,
      mimeType: row.mimeType,
      originalFileName: fileName,
      resourceType: row.resourceType,
    },
    { attachment: !inline },
  );

  const len = upstream.headers.get('content-length');
  if (len) res.setHeader('Content-Length', len);
  if (!upstream.body) {
    const err = new Error('Empty CDN response');
    err.statusCode = 502;
    throw err;
  }
  await pipeline(Readable.fromWeb(upstream.body), res);
}

export const streamCloudinaryFile = streamSecureFile;
export const streamResourceFile = streamSecureFile;
