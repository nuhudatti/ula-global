import { PrismaClient } from '@prisma/client';
import { resolveSecuredFile } from '../services/authFileAccessService.js';
import { cloudinaryInlineUrl } from '../services/cloudinaryUrls.js';
import { inferPreviewAs } from '../services/previewMode.js';
import { FILE_KIND } from '../services/fileService.js';
import { streamSecureFile } from '../services/download.js';
import { logPlatformAudit } from '../services/platformAudit.js';

const prisma = new PrismaClient();

export const VALID_FILE_KINDS = [
  FILE_KIND.RESOURCE,
  FILE_KIND.ASSIGNMENT_ATTACHMENT,
  FILE_KIND.ASSIGNMENT_SUBMISSION,
  'my-assignment-submission',
  FILE_KIND.SUGGESTION,
];

function parseKindId(req) {
  const kind = String(req.query.kind || '');
  const id = String(req.query.id || '');
  if (!VALID_FILE_KINDS.includes(kind) || !id) {
    const err = new Error('Valid kind and id are required');
    err.status = 400;
    throw err;
  }
  return { kind, id };
}

async function recordDownload(kind, id, actorId = null) {
  if (kind !== FILE_KIND.RESOURCE) return;

  const row = await prisma.resource.findUnique({
    where: { id },
    select: {
      kind: true,
      course: {
        select: {
          department: {
            select: { faculty: { select: { institutionId: true } } },
          },
        },
      },
    },
  });
  if (!row) return;

  await prisma.resource.update({
    where: { id },
    data: { downloadCount: { increment: 1 } },
  });

  const institutionId = row.course?.department?.faculty?.institutionId ?? null;
  const action = row.kind === 'PAST_QUESTIONS' ? 'RESULT_DOWNLOAD' : 'RESOURCE_DOWNLOAD';
  await logPlatformAudit({
    action,
    actorId,
    actorType: 'user',
    institutionId,
    detail: null,
  });
}

/** GET /api/files/delivery?kind=&id= */
export async function getDeliveryUrl(req, res) {
  try {
    const { kind, id } = parseKindId(req);
    const file = await resolveSecuredFile(req.user?.id, kind, id);

    if (!file.fileUrl?.includes('cloudinary.com')) {
      return res.status(404).json({ error: 'Preview not available for this file' });
    }

    const cdnUrl = cloudinaryInlineUrl(file.fileUrl);
    const previewAs = inferPreviewAs({
      fileUrl: file.fileUrl,
      mimeType: file.mimeType,
      fileName: file.fileName,
    });

    res.json({
      url: cdnUrl,
      previewAs,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileAccess: { kind, id },
    });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error('[files] delivery:', e);
    res.status(status).json({ error: e.message || 'Delivery failed' });
  }
}

/** GET /api/files/stream?kind=&id= */
export async function streamFile(req, res) {
  try {
    const { kind, id } = parseKindId(req);
    const file = await resolveSecuredFile(req.user?.id, kind, id);

    await recordDownload(kind, id, req.user?.id ?? null);

    const inline = req.query.inline === '1' || req.query.inline === 'true';

    const embed = req.query.embed === '1' || req.query.embed === 'true';
    if (inline && !embed && file.fileUrl?.includes('cloudinary.com')) {
      return res.redirect(302, cloudinaryInlineUrl(file.fileUrl));
    }

    await streamSecureFile(
      {
        publicId: file.publicId,
        fileUrl: file.fileUrl,
        originalFileName: file.fileName,
        mimeType: file.mimeType,
      },
      res,
      { inline },
    );
  } catch (e) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const status = e.statusCode === 502 ? 502 : e.status || 500;
    if (status >= 500) console.error('[files] stream:', e);
    res.status(status).json({ error: e.message || 'Download failed' });
  }
}
