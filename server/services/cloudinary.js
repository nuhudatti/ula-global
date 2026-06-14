/** @deprecated Import from cloudinaryService.js — kept for backward compatibility. */
export {
  configureCloudinary,
  isCloudinaryConfigured,
  requireCloudinary,
  uploadFromBuffer,
  deleteByPublicId,
  fetchFileBuffer,
} from './cloudinaryService.js';

/** @deprecated Use uploadFromBuffer via fileService.uploadAppFile */
export async function uploadBuffer(buffer, folder) {
  const { uploadFromBuffer } = await import('./cloudinaryService.js');
  return uploadFromBuffer(buffer, { subfolder: folder });
}
