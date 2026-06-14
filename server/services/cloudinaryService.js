import {
  cloudinary,
  CLOUDINARY_ROOT_FOLDER,
  configureCloudinary,
  isCloudinaryConfigured,
  requireCloudinary,
} from '../config/cloudinary.js';
import { cloudinaryAttachmentUrl, cloudinaryInlineUrl } from './cloudinaryUrls.js';

export { configureCloudinary, isCloudinaryConfigured, requireCloudinary };

const DEFAULT_SIGNED_TTL_SEC = Number(process.env.SIGNED_URL_TTL_SEC) || 900;

function safeSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64);
}

/** Infer Cloudinary resource_type from mime for signed delivery. */
export function inferResourceType(mimeType, fileName) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  const ext = String(fileName || '')
    .split('.')
    .pop()
    ?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  return 'raw';
}

function resourceTypesToTry(storedType, mimeType, fileName) {
  return [...new Set([storedType, inferResourceType(mimeType, fileName), 'raw', 'image', 'video'].filter(Boolean))];
}

/**
 * Signed URL — tries authenticated delivery type (private assets).
 */
export function getSignedDeliveryUrl(publicId, options = {}) {
  requireCloudinary();
  configureCloudinary();
  if (!publicId) {
    const err = new Error('Missing public_id for signed delivery');
    err.status = 404;
    throw err;
  }

  const resourceType = options.resourceType || 'raw';
  const deliveryType = options.deliveryType || 'authenticated';
  const expiresAt = Math.floor(Date.now() / 1000) + (options.expiresInSec ?? DEFAULT_SIGNED_TTL_SEC);
  const urlOptions = {
    resource_type: resourceType,
    type: deliveryType,
    sign_url: deliveryType === 'authenticated',
    secure: true,
    ...(deliveryType === 'authenticated' ? { expires_at: expiresAt } : {}),
  };
  if (options.attachment) urlOptions.flags = 'attachment';
  if (options.format) urlOptions.format = options.format;

  return {
    url: cloudinary.url(publicId, urlOptions),
    expiresAt: deliveryType === 'authenticated' ? new Date(expiresAt * 1000).toISOString() : null,
  };
}

/**
 * Fast Cloudinary fetch — stored fileUrl first (exact, never breaks signed URLs).
 * Fallback: one public-id URL only when fileUrl missing or failed.
 */
export async function fetchCloudinaryResponse(meta, { attachment = false } = {}) {
  const fileUrl = meta.fileUrl;
  const publicId = meta.publicId || meta.cloudinaryPublicId;
  let lastStatus = 0;

  if (fileUrl?.includes('cloudinary.com')) {
    const res = await fetch(fileUrl);
    if (res.ok) return res;
    lastStatus = res.status;

    if (attachment && !/\/upload\/s--[^/]+--\//.test(fileUrl)) {
      const attachUrl = cloudinaryAttachmentUrl(fileUrl);
      if (attachUrl !== fileUrl) {
        const res2 = await fetch(attachUrl);
        if (res2.ok) return res2;
        lastStatus = res2.status;
      }
    }
  }

  if (publicId && isCloudinaryConfigured()) {
    configureCloudinary();
    const rt = resourceTypesToTry(meta.resourceType, meta.mimeType, meta.fileName || meta.originalFileName)[0] || 'image';
    const built = cloudinary.url(publicId, {
      resource_type: rt,
      secure: true,
      type: 'upload',
      ...(attachment ? { flags: 'attachment' } : {}),
    });
    const res = await fetch(built);
    if (res.ok) return res;
    lastStatus = res.status;
  }

  const err = new Error(`CDN returned ${lastStatus || 404}`);
  err.statusCode = 502;
  throw err;
}

/**
 * Stream upload from memory buffer — no disk writes.
 * All academic files use access_mode: authenticated (signed URL delivery only).
 * @returns {{ secure_url: string, public_id: string, bytes?: number, format?: string, resource_type?: string }}
 */
export function uploadFromBuffer(buffer, options = {}) {
  requireCloudinary();
  if (!buffer?.length) {
    const err = new Error('Empty file buffer');
    err.status = 400;
    return Promise.reject(err);
  }

  const subfolder = safeSegment(options.subfolder || 'general');
  const folder = `${CLOUDINARY_ROOT_FOLDER}/${subfolder}`.replace(/\/+/g, '/');
  const resourceType = options.resourceType || 'auto';
  const accessMode = options.accessMode || 'authenticated';

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        access_mode: accessMode,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        quality: 'auto',
        fetch_format: 'auto',
        ...(resourceType === 'image' || resourceType === 'auto'
          ? { flags: 'attachment' }
          : {}),
        ...(options.originalName
          ? { filename_override: safeSegment(options.originalName).slice(0, 120) }
          : {}),
      },
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        if (!result?.secure_url || !result?.public_id) {
          reject(new Error('Cloudinary upload returned incomplete result'));
          return;
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          bytes: result.bytes,
          format: result.format,
          resource_type: result.resource_type,
        });
      },
    );
    uploadStream.end(buffer);
  });
}

/** Delete asset from Cloudinary by public_id. */
export async function deleteByPublicId(publicId, resourceType = 'image') {
  if (!publicId || !isCloudinaryConfigured()) return;
  configureCloudinary();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    } catch {
      try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
      } catch {
        /* best-effort cleanup */
      }
    }
  }
}

/** Fetch asset bytes from Cloudinary with multi-strategy URL fallback. */
export async function fetchFileBufferByPublicId(publicId, resourceType = 'raw', mimeType, fileName, fileUrl) {
  const res = await fetchCloudinaryResponse(
    { publicId, fileUrl, mimeType, originalFileName: fileName, resourceType },
    { attachment: true },
  );
  return Buffer.from(await res.arrayBuffer());
}

/** Fetch file bytes — prefers resilient Cloudinary fetch when publicId is available. */
export async function fetchFileBuffer(secureUrl, { publicId, mimeType, fileName, resourceType } = {}) {
  const res = await fetchCloudinaryResponse(
    { publicId, fileUrl: secureUrl, mimeType, originalFileName: fileName, resourceType },
    { attachment: true },
  );
  return Buffer.from(await res.arrayBuffer());
}
