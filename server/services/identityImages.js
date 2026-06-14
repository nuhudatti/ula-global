import { deleteByPublicId } from './cloudinaryService.js';
import { uploadAppFile } from './fileService.js';

export const IDENTITY_MAX_BYTES = 5 * 1024 * 1024;
export const IDENTITY_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export function validateIdentityImage(file) {
  if (!file?.buffer) return 'File is required';
  if (file.size > IDENTITY_MAX_BYTES) return 'Image must be 5 MB or smaller';
  const mime = (file.mimetype || '').toLowerCase();
  if (!IDENTITY_MIMES.has(mime)) return 'Only PNG, JPG, or WEBP images are allowed';
  return null;
}

export async function storeIdentityImage(buffer, originalName) {
  const stored = await uploadAppFile({
    buffer,
    originalName: originalName || 'image.png',
    subfolder: 'identity',
    maxBytes: IDENTITY_MAX_BYTES,
    accessMode: 'public',
  });
  return { url: stored.fileUrl, publicId: stored.publicId };
}

export async function removeStoredImage(_url, publicId) {
  if (publicId) await deleteByPublicId(publicId);
}

export function identitySelect(scope) {
  if (scope === 'profile') {
    return {
      profilePhotoUrl: true,
      profilePhotoPublicId: true,
      bannerUrl: true,
      bannerPublicId: true,
    };
  }
  if (scope === 'department' || scope === 'faculty' || scope === 'institution') {
    return {
      logoUrl: true,
      logoPublicId: true,
      bannerUrl: true,
      bannerPublicId: true,
    };
  }
  return {};
}
