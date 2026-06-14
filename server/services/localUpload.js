/**
 * Local disk storage has been removed. All files use Cloudinary via fileService.js.
 * This module exists only so old imports fail loudly with a clear message.
 */
export function saveLocalUpload() {
  const err = new Error(
    'Local file storage is disabled. Configure Cloudinary (see CLOUDINARY.md) and use uploadAppFile().',
  );
  err.status = 503;
  throw err;
}

export async function removeLocalStoredFile() {
  /* no-op — nothing on disk */
}

export function parseLocalStoredName() {
  return null;
}

export const UPLOAD_DIR = null;

export async function ensureUploadDir() {
  /* no-op */
}
