import { v2 as cloudinary } from 'cloudinary';

/** Root folder in Cloudinary Media Library — all ULA files live under here. */
export const CLOUDINARY_ROOT_FOLDER = process.env.CLOUDINARY_FOLDER || 'ula_files';

export const CLOUDINARY_MAX_BYTES = 50 * 1024 * 1024;

export function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function isCloudinaryConfigured() {
  const t = (k) => {
    const v = process.env[k];
    return v && String(v).trim().length > 0;
  };
  return t('CLOUDINARY_CLOUD_NAME') && t('CLOUDINARY_API_KEY') && t('CLOUDINARY_API_SECRET');
}

/** Fail fast in production when Cloudinary is missing. */
export function requireCloudinary() {
  if (!isCloudinaryConfigured()) {
    const err = new Error(
      'Cloudinary is required. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env',
    );
    err.status = 503;
    throw err;
  }
}

export { cloudinary };
