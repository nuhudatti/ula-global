import { Router } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { uploadRateLimit } from '../middleware/rateLimitMiddleware.js';
import { requireCloudinary } from '../services/cloudinaryService.js';
import {
  fileErrorStatus,
  removeAppFile,
  sanitizeResource,
  uploadAppFile,
  uploadWithRollback,
} from '../services/fileService.js';
import { CLOUDINARY_MAX_BYTES } from '../config/cloudinary.js';
import { resourceInstitutionWhere, tenantId, courseInstitutionWhere } from '../services/tenantScope.js';
import { logPlatformAudit } from '../services/platformAudit.js';
import {
  canPublishResources,
  resolveUploadSourceType,
  RESOURCE_KINDS,
  ROLES,
} from '../constants/academicRoles.js';

const prisma = new PrismaClient();
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CLOUDINARY_MAX_BYTES },
});

function parseInclude(includeStr) {
  if (!includeStr) return {};
  const allowed = ['course', 'uploadedBy', 'department'];
  const parts = String(includeStr)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => allowed.includes(s));
  const inc = {};
  if (parts.includes('course')) {
    inc.course = {
      include: {
        department: {
          include: { faculty: true },
        },
      },
    };
  }
  if (parts.includes('uploadedBy')) {
    inc.uploadedBy = { select: { id: true, fullName: true, email: true, profilePhotoUrl: true } };
    inc.contributedBy = { select: { id: true, fullName: true } };
  }
  return inc;
}

function utcYearRange(y) {
  return {
    gte: new Date(`${y}-01-01T00:00:00.000Z`),
    lt: new Date(`${y + 1}-01-01T00:00:00.000Z`),
  };
}

/** Public browse list + filters — optional JWT attaches `userRating` per row */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const take = Math.min(Number(req.query.take) || 40, 100);
    const skip = Number(req.query.skip) || 0;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const facultyId = req.query.facultyId ? String(req.query.facultyId) : '';
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : '';
    const courseId = req.query.courseId ? String(req.query.courseId) : '';
    const kind = req.query.kind ? String(req.query.kind) : '';
    const level = req.query.level ? String(req.query.level) : '';
    const examYearParam =
      req.query.examYear != null && req.query.examYear !== ''
        ? String(req.query.examYear)
        : req.query.year != null && req.query.year !== ''
          ? String(req.query.year)
          : '';
    const uploadYearParam =
      req.query.uploadYear != null && req.query.uploadYear !== '' ? String(req.query.uploadYear) : '';

    const VALID_KINDS = RESOURCE_KINDS;

    /** @type {Record<string, unknown>[]} */
    const clauses = [];
    const institutionId = tenantId(req);
    if (institutionId) clauses.push(resourceInstitutionWhere(institutionId));
    /* SQLite: no case-insensitive mode — use plain contains */
    if (search) {
      clauses.push({
        OR: [{ title: { contains: search } }, { description: { contains: search } }],
      });
    }
    if (kind && VALID_KINDS.includes(kind)) clauses.push({ kind });
    if (courseId) clauses.push({ courseId });
    if (departmentId) clauses.push({ course: { departmentId } });
    if (facultyId) clauses.push({ course: { department: { facultyId } } });

    if (level && level !== 'all') {
      const lv = Number(level);
      if (!Number.isNaN(lv)) clauses.push({ course: { level: lv } });
    }

    if (examYearParam && examYearParam !== 'all') {
      const y = Number(examYearParam);
      if (!Number.isNaN(y)) {
        clauses.push({
          OR: [{ examYear: y }, { AND: [{ examYear: null }, { createdAt: utcYearRange(y) }] }],
        });
      }
    }

    if (uploadYearParam && uploadYearParam !== 'all') {
      const y = Number(uploadYearParam);
      if (!Number.isNaN(y)) {
        clauses.push({ createdAt: utcYearRange(y) });
      }
    }

    const where = clauses.length ? { AND: clauses } : {};

    const include = parseInclude(req.query.include);

    const [items, total] = await Promise.all([
      prisma.resource.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include:
          Object.keys(include).length > 0
            ? include
            : {
                course: {
                  include: {
                    department: {
                      include: { faculty: true },
                    },
                  },
                },
                uploadedBy: {
                  select: { id: true, fullName: true, profilePhotoUrl: true },
                },
                contributedBy: {
                  select: { id: true, fullName: true },
                },
              },
      }),
      prisma.resource.count({ where }),
    ]);

    let payloadItems = items;
    if (req.user?.id && items.length > 0) {
      const ids = items.map((i) => i.id);
      const rated = await prisma.rating.findMany({
        where: { userId: req.user.id, resourceId: { in: ids } },
        select: { resourceId: true, value: true },
      });
      const ratingMap = new Map(rated.map((r) => [r.resourceId, r.value]));
      payloadItems = items.map((row) => ({
        ...sanitizeResource(row),
        userRating: ratingMap.get(row.id) ?? null,
      }));
    } else {
      payloadItems = items.map((row) => ({ ...sanitizeResource(row), userRating: null }));
    }

    res.json({ items: payloadItems, total, skip, take });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load resources' });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const items = await prisma.resource.findMany({
      where: { uploadedById: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        course: {
          include: {
            department: { include: { faculty: true } },
          },
        },
        contributedBy: { select: { id: true, fullName: true } },
      },
    });
    res.json(items.map(sanitizeResource));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load uploads' });
  }
});

router.post(
  '/',
  requireAuth,
  uploadRateLimit,
  upload.single('file'),
  async (req, res) => {
    if (!canPublishResources(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to upload materials' });
    }

    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ error: 'file is required (multipart field name: file)' });
    }

    const title = req.body.title?.trim();
    const courseId = req.body.courseId?.trim();
    const kind = req.body.kind || 'OTHER';
    const description = req.body.description?.trim() || null;
    const semester = req.body.semester?.trim() || null;
    const sourceType = resolveUploadSourceType(req.user.role, req.body.sourceType);

    let examYear = null;
    const rawExam = req.body.examYear;
    if (rawExam != null && String(rawExam).trim() !== '') {
      const y = Number(String(rawExam).trim());
      if (!Number.isNaN(y) && y >= 1990 && y <= 2100) examYear = y;
    }

    if (!title || !courseId) {
      return res.status(400).json({ error: 'title and courseId are required' });
    }
    if (!RESOURCE_KINDS.includes(kind)) {
      return res.status(400).json({ error: 'Invalid resource kind' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { departmentId: true, role: true, accountStatus: true, canUpload: true, institutionId: true },
      });
      if (!user) return res.status(403).json({ error: 'User not found' });
      if (user.accountStatus === 'SUSPENDED') {
        return res.status(403).json({ error: 'Your account is suspended' });
      }

      const isLecturer = user.role === ROLES.LECTURER;
      if (isLecturer) {
        if (!user.departmentId) {
          return res.status(403).json({ error: 'Your account has no department — contact admin' });
        }
        if (!user.canUpload) {
          return res.status(403).json({ error: 'Upload access is disabled for your account' });
        }
      }

      const course = await prisma.course.findFirst({
        where: {
          id: courseId,
          ...courseInstitutionWhere(user.institutionId),
        },
        select: { id: true, departmentId: true },
      });
      if (!course) {
        return res.status(404).json({ error: 'Course not found in your institution' });
      }
      if (isLecturer && course.departmentId !== user.departmentId) {
        return res.status(403).json({ error: 'You can only upload to courses in your department' });
      }

      const governanceStatus =
        [ROLES.ACADEMIC_RESOURCES_MANAGER, ROLES.INSTITUTION_ADMIN, ROLES.SUPER_ADMIN].includes(user.role)
          ? req.body.governanceStatus === 'PENDING_REVIEW'
            ? 'PENDING_REVIEW'
            : 'VERIFIED'
          : 'VERIFIED';

      requireCloudinary();
      const resource = await uploadWithRollback({
        upload: () =>
          uploadAppFile({
            buffer: file.buffer,
            originalName: file.originalname || 'upload',
            mimetype: file.mimetype,
            size: file.size,
            subfolder: 'resources',
            userId: req.user.id,
            accessMode: 'public',
          }),
        persist: (stored) =>
          prisma.resource.create({
            data: {
              title,
              description,
              kind,
              semester,
              sourceType,
              fileUrl: stored.fileUrl,
              cloudinaryPublicId: stored.publicId,
              originalFileName: file.originalname || 'upload',
              mimeType: file.mimetype || null,
              sizeBytes: file.size || null,
              examYear,
              courseId: course.id,
              uploadedById: req.user.id,
              governanceStatus,
            },
            include: {
              course: {
                include: { department: { include: { faculty: true } } },
              },
            },
          }),
      });

      const institutionId = resource.course?.department?.faculty?.institutionId ?? null;
      await logPlatformAudit({
        action: kind === 'PAST_QUESTIONS' ? 'RESULT_UPLOADED' : 'RESOURCE_UPLOADED',
        actorId: req.user.id,
        actorType: 'user',
        institutionId,
        detail: null,
      });

      res.status(201).json(sanitizeResource(resource));
    } catch (e) {
      const status = fileErrorStatus(e);
      if (status >= 500) console.error(e);
      res.status(status).json({ error: e.message || 'Upload failed' });
    }
  }
);

/** Deprecated — all file access goes through /api/files/stream */
router.get('/:id/file', (_req, res) => {
  res.status(410).json({
    error: 'This endpoint is retired. Use GET /api/files/stream?kind=resource&id=:id',
  });
});

router.post('/:id/download', requireAuth, (_req, res) => {
  res.status(410).json({
    error: 'This endpoint is retired. Use GET /api/files/stream?kind=resource&id=:id',
  });
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await prisma.resource.findUnique({
      where: { id },
      select: {
        uploadedById: true,
        cloudinaryPublicId: true,
        fileUrl: true,
      },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const canDelete =
      existing.uploadedById === req.user.id ||
      ['INSTITUTION_ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN', 'DEPARTMENT_ADMIN', 'ACADEMIC_RESOURCES_MANAGER'].includes(req.user.role);

    if (!canDelete) return res.status(403).json({ error: 'Not allowed' });

    await prisma.resource.delete({ where: { id } });

    if (existing.cloudinaryPublicId) {
      await removeAppFile(existing.cloudinaryPublicId);
    }

    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
