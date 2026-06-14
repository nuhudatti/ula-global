import { CLOUDINARY_MAX_BYTES } from '../config/cloudinary.js';
import { deleteByPublicId, uploadFromBuffer } from './cloudinaryService.js';
import { assertWritable } from './backupService.js';

const uploadBuckets = new Map();
const UPLOAD_WINDOW_MS = 60 * 60_000;
const UPLOAD_MAX_PER_HOUR = Number(process.env.UPLOAD_MAX_PER_USER_HOUR) || 30;

/** Canonical file kinds — must match authFileAccessService + fileController. */
export const FILE_KIND = {
  RESOURCE: 'resource',
  ASSIGNMENT_ATTACHMENT: 'assignment-attachment',
  ASSIGNMENT_SUBMISSION: 'assignment-submission',
  SUGGESTION: 'suggestion',
};

export function buildFileAccess(kind, id) {
  return { kind, id };
}

export function sanitizeResource(row) {
  if (!row) return row;
  const { fileUrl: _u, cloudinaryPublicId: _p, ...rest } = row;
  return {
    ...rest,
    hasFile: Boolean(_u || _p),
    fileAccess: buildFileAccess(FILE_KIND.RESOURCE, row.id),
  };
}

export function sanitizeAssignment(row, extra = {}) {
  if (!row) return row;
  const { attachmentUrl: _a, attachmentCloudinaryPublicId: _ap, ...rest } = row;
  const base = {
    id: rest.id,
    title: rest.title,
    description: rest.description,
    instructions: rest.instructions,
    dueAt: rest.dueAt,
    allowedTypes: typeof rest.allowedTypes === 'string' ? rest.allowedTypes.split(',') : rest.allowedTypes,
    hasAttachment: Boolean(_a || _ap),
    attachmentName: rest.attachmentName ?? null,
    status: rest.status,
    createdAt: rest.createdAt,
    course: rest.course,
    lecturerName: rest.lecturer?.fullName ?? rest.lecturerName,
  };
  return { ...base, ...extra };
}

export function sanitizeSubmissionFile(submission) {
  if (!submission) return submission;
  const { fileUrl: _u, cloudinaryPublicId: _p, ...rest } = submission;
  return {
    ...rest,
    fileName: rest.originalFileName ?? rest.fileName,
    fileAccess: buildFileAccess(FILE_KIND.ASSIGNMENT_SUBMISSION, rest.id),
  };
}

export function sanitizeSuggestion(row) {
  if (!row) return row;
  const { fileUrl: _u, cloudinaryPublicId: _p, ...rest } = row;
  return {
    ...rest,
    hasFile: Boolean(_u || _p),
    fileAccess: buildFileAccess(FILE_KIND.SUGGESTION, row.id),
  };
}

function trackUpload(userId) {
  if (!userId) return;
  const now = Date.now();
  let bucket = uploadBuckets.get(userId);
  if (!bucket) {
    bucket = [];
    uploadBuckets.set(userId, bucket);
  }
  while (bucket.length && now - bucket[0] > UPLOAD_WINDOW_MS) bucket.shift();
  bucket.push(now);
}

function assertUploadQuota(userId) {
  if (!userId) return;
  const bucket = uploadBuckets.get(userId) || [];
  const now = Date.now();
  const recent = bucket.filter((t) => now - t <= UPLOAD_WINDOW_MS);
  if (recent.length >= UPLOAD_MAX_PER_HOUR) {
    const err = new Error(`Upload limit reached (max ${UPLOAD_MAX_PER_HOUR} per hour)`);
    err.status = 429;
    throw err;
  }
}

/**
 * Upload to Cloudinary then persist DB — rolls back Cloudinary asset if DB write fails.
 */
export async function uploadWithRollback({ upload, persist }) {
  let uploaded = null;
  try {
    uploaded = await upload();
    return await persist(uploaded);
  } catch (err) {
    if (uploaded?.publicId) {
      await removeAppFile(uploaded.publicId).catch((cleanupErr) => {
        console.error('[fileService] orphan cleanup failed:', cleanupErr.message);
      });
    }
    throw err;
  }
}

/**
 * Single upload entry point — Cloudinary stream only, no disk.
 */
export async function uploadAppFile({
  buffer,
  originalName,
  mimetype,
  size,
  subfolder,
  maxBytes = CLOUDINARY_MAX_BYTES,
  userId = null,
  accessMode = 'authenticated',
}) {
  assertWritable();

  if (!buffer?.length) {
    const err = new Error('File is required');
    err.status = 400;
    throw err;
  }
  if (size != null && size > maxBytes) {
    const err = new Error(`File too large (max ${Math.round(maxBytes / (1024 * 1024))} MB)`);
    err.status = 400;
    throw err;
  }

  assertUploadQuota(userId);

  const result = await uploadFromBuffer(buffer, {
    subfolder,
    originalName: originalName || 'upload',
    accessMode,
  });

  if (userId) trackUpload(userId);

  return {
    fileUrl: result.secure_url,
    publicId: result.public_id,
    mimeType: mimetype || null,
    sizeBytes: result.bytes ?? size ?? null,
    originalFileName: originalName || 'upload',
    resourceType: result.resource_type,
  };
}

export async function removeAppFile(publicId) {
  if (!publicId) return;
  await deleteByPublicId(publicId);
}

/** Map upload errors to clean HTTP status codes. */
export function fileErrorStatus(err) {
  if (err?.status) return err.status;
  if (err?.statusCode) return err.statusCode;
  return 500;
}
