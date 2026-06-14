import { Router } from 'express';
import multer from 'multer';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { uploadRateLimit } from '../middleware/rateLimitMiddleware.js';
import { fileErrorStatus, uploadAppFile, uploadWithRollback } from '../services/fileService.js';
import { requireCloudinary } from '../services/cloudinaryService.js';
import {
  ASSIGNMENT_FILE_TYPES,
  MAX_SUBMISSION_BYTES,
  buildSubmissionFileName,
  buildSubmissionsCsv,
  createAssignment,
  extendAssignmentDueDate,
  listAssignmentFeed,
  listLecturerAssignments,
  listStudentAssignments,
  listSubmissions,
  loadSubmissionsForZip,
  readSubmissionFile,
  setAssignmentStatus,
  submitAssignment,
} from '../services/assignments.js';
import { tenantId } from '../services/tenantScope.js';

const router = Router();
const STAFF = ['LECTURER', 'HOD', 'DEPARTMENT_ADMIN'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SUBMISSION_BYTES },
});

/** Public — assignments shown in the catalogue beside resources (status added for signed-in students). */
router.get('/feed', optionalAuth, async (req, res) => {
  try {
    const items = await listAssignmentFeed({
      userId: req.user?.id,
      userRole: req.user?.role,
      institutionId: tenantId(req),
      take: req.query.take,
    });
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load assignments' });
  }
});

/** Deprecated — use /api/files/stream?kind=assignment-attachment&id=:id */
router.get('/:id/attachment.file', requireAuth, (_req, res) => {
  res.status(410).json({
    error: 'This endpoint is retired. Use GET /api/files/stream?kind=assignment-attachment&id=:id',
  });
});

/** Deprecated — use /api/files/stream?kind=my-assignment-submission&id=:assignmentId */
router.get('/:id/submission/mine', requireAuth, (_req, res) => {
  res.status(410).json({
    error:
      'This endpoint is retired. Use GET /api/files/stream?kind=my-assignment-submission&id=:assignmentId',
  });
});

router.use(requireAuth);

router.get('/meta', (_req, res) => {
  res.json({ allowedTypes: ASSIGNMENT_FILE_TYPES, maxBytes: MAX_SUBMISSION_BYTES });
});

/** Lecturer — create assignment (optional attachment with the brief) */
router.post('/', requireRole(...STAFF), uploadRateLimit, upload.single('attachment'), async (req, res) => {
  try {
    const { courseId, title, description, instructions, dueAt, allowedTypes } = req.body;

    const assignment = req.file?.buffer?.length
      ? await uploadWithRollback({
          upload: async () => {
            requireCloudinary();
            return uploadAppFile({
              buffer: req.file.buffer,
              originalName: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size,
              subfolder: 'assignments/attachments',
              maxBytes: MAX_SUBMISSION_BYTES,
              userId: req.user.id,
            });
          },
          persist: (stored) =>
            createAssignment({
              lecturerId: req.user.id,
              institutionId: tenantId(req),
              courseId,
              title,
              description,
              instructions,
              dueAt,
              allowedTypes,
              attachment: {
                fileUrl: stored.fileUrl,
                publicId: stored.publicId,
                name: req.file.originalname,
              },
            }),
        })
      : await createAssignment({
          lecturerId: req.user.id,
          institutionId: tenantId(req),
          courseId,
          title,
          description,
          instructions,
          dueAt,
          allowedTypes,
          attachment: null,
        });

    res.status(201).json(assignment);
  } catch (e) {
    const status = fileErrorStatus(e);
    if (status >= 500) console.error(e);
    res.status(status).json({ error: e.message || 'Failed to create assignment' });
  }
});

/** Lecturer — list with stats */
router.get('/lecturer', requireRole(...STAFF), async (req, res) => {
  try {
    res.json({ items: await listLecturerAssignments(req.user.id, tenantId(req)) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to load assignments' });
  }
});

/** Student — list open institution assignments with own status */
router.get('/student', requireRole('STUDENT'), async (req, res) => {
  try {
    res.json({ items: await listStudentAssignments(req.user.id, tenantId(req)) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to load assignments' });
  }
});

/** Student — submit work (identity from session only) */
router.post('/:id/submit', requireRole('STUDENT'), uploadRateLimit, upload.single('file'), async (req, res) => {
  try {
    const result = await submitAssignment({
      assignmentId: req.params.id,
      studentId: req.user.id,
      institutionId: tenantId(req),
      file: req.file,
      saveFile: null,
    });
    res.status(201).json(result);
  } catch (e) {
    const status = fileErrorStatus(e);
    if (status >= 500) console.error(e);
    res.status(status).json({ error: e.message || 'Submission failed' });
  }
});

/** Lecturer — submissions table */
router.get('/:id/submissions', requireRole(...STAFF), async (req, res) => {
  try {
    res.json(await listSubmissions(req.params.id, req.user.id, tenantId(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to load submissions' });
  }
});

/** Lecturer — extend due date (reopens submissions) */
router.patch('/:id/due-date', requireRole(...STAFF), async (req, res) => {
  try {
    res.json(await extendAssignmentDueDate(req.params.id, req.user.id, req.body?.dueAt, tenantId(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to update due date' });
  }
});

/** Lecturer — close / reopen */
router.patch('/:id/status', requireRole(...STAFF), async (req, res) => {
  try {
    res.json(await setAssignmentStatus(req.params.id, req.user.id, req.body?.status, tenantId(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

/** Lecturer — CSV export */
router.get('/:id/export.csv', requireRole(...STAFF), async (req, res) => {
  try {
    const { assignment, submissions } = await (async () => {
      const data = await listSubmissions(req.params.id, req.user.id, tenantId(req));
      return { assignment: data.assignment, submissions: data.submissions };
    })();
    const csv = buildSubmissionsCsv(assignment, submissions);
    const name = `${assignment.course?.code ?? 'COURSE'}_${assignment.title.replace(/[^a-zA-Z0-9]+/g, '_')}_submissions.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(csv);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Export failed' });
  }
});

/** Lecturer — download all submissions as ZIP (includes submission-report.csv) */
router.get('/:id/download.zip', requireRole(...STAFF), async (req, res) => {
  try {
    const { assignment, rows } = await loadSubmissionsForZip(req.params.id, req.user.id, tenantId(req));
    if (!rows.length) return res.status(404).json({ error: 'No submissions yet' });

    const zipName = `${assignment.course.code}_${assignment.title.replace(/[^a-zA-Z0-9]+/g, '_')}_submissions.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('[assignments] zip error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'ZIP failed' });
      else res.end();
    });
    archive.pipe(res);

    const csvRows = rows.map((s) => ({
      studentName: s.student.fullName,
      matricNumber: s.student.matricNumber ?? '—',
      email: s.student.email,
      submittedAt: s.submittedAt,
      status: s.status,
      fileName: s.originalFileName,
    }));
    archive.append(buildSubmissionsCsv(assignment, csvRows), { name: 'submission-report.csv' });

    for (const submission of rows) {
      try {
        const buffer = await readSubmissionFile(submission);
        archive.append(buffer, { name: buildSubmissionFileName(assignment, submission) });
      } catch (fileErr) {
        console.warn('[assignments] skipping missing file:', submission.originalFileName, fileErr.message);
      }
    }

    await archive.finalize();
  } catch (e) {
    if (e.status && !res.headersSent) return res.status(e.status).json({ error: e.message });
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
  }
});

export default router;
