import { Router } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadRateLimit } from '../middleware/rateLimitMiddleware.js';
import { requireCloudinary } from '../services/cloudinaryService.js';
import { fileErrorStatus, uploadAppFile, uploadWithRollback } from '../services/fileService.js';
import {
  VALID_KINDS,
  MAX_STUDENT_FILE_BYTES,
  MAX_PENDING_PER_STUDENT,
  loadLecturerContext,
  loadStudentContext,
  searchDepartmentStudents,
  formatPermission,
  formatSuggestion,
  countPendingForStudent,
  approveSuggestion,
} from '../services/suggestions.js';

const prisma = new PrismaClient();
const router = Router();

const studentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_STUDENT_FILE_BYTES },
});

router.use(requireAuth);

/** Lecturer — search registered students in department */
router.get('/lecturer/students', requireRole('LECTURER'), async (req, res) => {
  try {
    const lecturer = await loadLecturerContext(req.user.id);
    const q = req.query.q ? String(req.query.q) : '';
    const students = await searchDepartmentStudents(lecturer.departmentId, q);
    const granted = await prisma.suggestPermission.findMany({
      where: { lecturerId: lecturer.id },
      select: { studentId: true },
    });
    const grantedSet = new Set(granted.map((g) => g.studentId));
    res.json(
      students.map((s) => ({
        ...s,
        alreadyGranted: grantedSet.has(s.id),
      }))
    );
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Search failed' });
  }
});

/** Lecturer — list students allowed to suggest */
router.get('/lecturer/permissions', requireRole('LECTURER'), async (req, res) => {
  try {
    const lecturer = await loadLecturerContext(req.user.id);
    const rows = await prisma.suggestPermission.findMany({
      where: { lecturerId: lecturer.id },
      include: {
        student: { select: { id: true, fullName: true, email: true, matricNumber: true } },
        _count: { select: { suggestions: { where: { status: 'PENDING' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows.map((r) => formatPermission({ ...r, lecturer: null })));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to load permissions' });
  }
});

/** Lecturer — allow a student */
router.post('/lecturer/permissions', requireRole('LECTURER'), async (req, res) => {
  try {
    const lecturer = await loadLecturerContext(req.user.id);
    const { studentId, note } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        departmentId: lecturer.departmentId,
      },
    });
    if (!student) {
      return res.status(404).json({ error: 'Student not found in your department' });
    }

    const permission = await prisma.suggestPermission.upsert({
      where: { lecturerId_studentId: { lecturerId: lecturer.id, studentId } },
      create: {
        lecturerId: lecturer.id,
        studentId,
        departmentId: lecturer.departmentId,
        note: note?.trim() || null,
      },
      update: { note: note?.trim() || null },
      include: { student: { select: { id: true, fullName: true, email: true, matricNumber: true } } },
    });

    res.status(201).json(formatPermission({ ...permission, _count: { suggestions: 0 } }));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Could not grant access' });
  }
});

/** Lecturer — revoke */
router.delete('/lecturer/permissions/:studentId', requireRole('LECTURER'), async (req, res) => {
  try {
    const lecturer = await loadLecturerContext(req.user.id);
    await prisma.suggestPermission.deleteMany({
      where: { lecturerId: lecturer.id, studentId: req.params.studentId },
    });
    res.status(204).end();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Revoke failed' });
  }
});

/** Lecturer — inbox */
router.get('/lecturer/inbox', requireRole('LECTURER'), async (req, res) => {
  try {
    const lecturer = await loadLecturerContext(req.user.id);
    const status = req.query.status ? String(req.query.status) : 'PENDING';
    const where = { lecturerId: lecturer.id };
    if (status !== 'all') where.status = status;

    const rows = await prisma.materialSuggestion.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, email: true, matricNumber: true } },
        course: { select: { id: true, code: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
    res.json(rows.map(formatSuggestion));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Inbox failed' });
  }
});

/** Lecturer — approve → publish under lecturer, attribute student */
router.post('/lecturer/:id/approve', requireRole('LECTURER'), async (req, res) => {
  try {
    const lecturer = await loadLecturerContext(req.user.id);
    if (!lecturer.canUpload) {
      return res.status(403).json({ error: 'Upload access disabled on your account' });
    }
    const { title, description } = req.body || {};
    const resource = await approveSuggestion({
      suggestionId: req.params.id,
      lecturerId: lecturer.id,
      title,
      description,
    });
    res.json(resource);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Approve failed' });
  }
});

/** Lecturer — reject */
router.post('/lecturer/:id/reject', requireRole('LECTURER'), async (req, res) => {
  try {
    const lecturer = await loadLecturerContext(req.user.id);
    const { reason } = req.body || {};
    const updated = await prisma.materialSuggestion.updateMany({
      where: { id: req.params.id, lecturerId: lecturer.id, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        rejectReason: reason?.trim() || 'Not accepted for the archive',
        reviewedAt: new Date(),
      },
    });
    if (!updated.count) return res.status(404).json({ error: 'Suggestion not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Reject failed' });
  }
});

/** Student — can I contribute? */
router.get('/student/access', requireRole('STUDENT'), async (req, res) => {
  try {
    const student = await loadStudentContext(req.user.id);
    if (!student.departmentId) {
      return res.json({ canContribute: false, permissions: [], reason: 'no_department' });
    }
    const permissions = await prisma.suggestPermission.findMany({
      where: { studentId: student.id },
      include: {
        lecturer: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const pending = await countPendingForStudent(student.id);
    res.json({
      canContribute: permissions.length > 0,
      permissions: permissions.map((p) => ({
        id: p.id,
        note: p.note,
        lecturer: p.lecturer,
        createdAt: p.createdAt,
      })),
      pendingCount: pending,
      maxPending: MAX_PENDING_PER_STUDENT,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Access check failed' });
  }
});

/** Student — courses for submission (department catalog) */
router.get('/student/courses', requireRole('STUDENT'), async (req, res) => {
  try {
    const student = await loadStudentContext(req.user.id);
    if (!student.departmentId) return res.json([]);
    const courses = await prisma.course.findMany({
      where: { departmentId: student.departmentId },
      select: { id: true, code: true, title: true },
      orderBy: { code: 'asc' },
    });
    res.json(courses);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to load courses' });
  }
});

/** Student — my submissions */
router.get('/student/mine', requireRole('STUDENT'), async (req, res) => {
  try {
    const student = await loadStudentContext(req.user.id);
    const rows = await prisma.materialSuggestion.findMany({
      where: { studentId: student.id },
      include: {
        lecturer: { select: { fullName: true } },
        course: { select: { code: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    res.json(rows.map(formatSuggestion));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Failed to load submissions' });
  }
});

/** Student — submit material to lecturer inbox */
router.post(
  '/student',
  requireRole('STUDENT'),
  uploadRateLimit,
  studentUpload.single('file'),
  async (req, res) => {
    try {
      const student = await loadStudentContext(req.user.id);
      if (!student.departmentId) {
        return res.status(403).json({ error: 'Your profile needs a department — contact your faculty office' });
      }

      const file = req.file;
      if (!file?.buffer) return res.status(400).json({ error: 'file is required' });

      const permissionId = req.body.permissionId?.trim();
      const courseId = req.body.courseId?.trim();
      const title = req.body.title?.trim();
      const reason = req.body.reason?.trim();
      const kind = req.body.kind || 'OTHER';
      const confirm = req.body.confirm === 'true' || req.body.confirm === true;

      if (!permissionId || !courseId || !title || !reason) {
        return res.status(400).json({ error: 'permissionId, courseId, title, and reason are required' });
      }
      if (title.length > 120) return res.status(400).json({ error: 'Title too long (max 120)' });
      if (reason.length > 280) return res.status(400).json({ error: 'Reason too long (max 280)' });
      if (!confirm) return res.status(400).json({ error: 'Please confirm this material is course-related' });
      if (!VALID_KINDS.includes(kind)) return res.status(400).json({ error: 'Invalid material type' });

      const permission = await prisma.suggestPermission.findFirst({
        where: { id: permissionId, studentId: student.id },
      });
      if (!permission) {
        return res.status(403).json({ error: 'You are not authorized to submit to this lecturer' });
      }

      const pending = await countPendingForStudent(student.id);
      if (pending >= MAX_PENDING_PER_STUDENT) {
        return res.status(429).json({ error: 'Too many pending submissions — wait for lecturer review' });
      }

      const course = await prisma.course.findFirst({
        where: { id: courseId, departmentId: student.departmentId },
      });
      if (!course) return res.status(400).json({ error: 'Invalid course' });

      const dupPending = await prisma.materialSuggestion.findFirst({
        where: {
          studentId: student.id,
          courseId,
          lecturerId: permission.lecturerId,
          status: 'PENDING',
        },
      });
      if (dupPending) {
        return res.status(409).json({ error: 'You already have a pending submission for this course with this lecturer' });
      }

      let examYear = null;
      const rawExam = req.body.examYear;
      if (rawExam != null && String(rawExam).trim() !== '') {
        const y = Number(String(rawExam).trim());
        if (!Number.isNaN(y) && y >= 1990 && y <= 2100) examYear = y;
      }

      requireCloudinary();
      const suggestion = await uploadWithRollback({
        upload: () =>
          uploadAppFile({
            buffer: file.buffer,
            originalName: file.originalname || 'suggestion',
            mimetype: file.mimetype,
            size: file.size,
            subfolder: 'suggestions',
            maxBytes: MAX_STUDENT_FILE_BYTES,
            userId: req.user.id,
          }),
        persist: (stored) =>
          prisma.materialSuggestion.create({
            data: {
              permissionId: permission.id,
              studentId: student.id,
              lecturerId: permission.lecturerId,
              courseId: course.id,
              title,
              reason,
              kind,
              examYear,
              fileUrl: stored.fileUrl,
              cloudinaryPublicId: stored.publicId,
              originalFileName: file.originalname || 'upload',
              mimeType: file.mimetype || null,
              sizeBytes: file.size || null,
            },
            include: {
              student: { select: { fullName: true } },
              course: { select: { code: true, title: true } },
              lecturer: { select: { fullName: true } },
            },
          }),
      });

      res.status(201).json(formatSuggestion(suggestion));
    } catch (e) {
      const status = fileErrorStatus(e);
      if (status >= 500) console.error(e);
      res.status(status).json({ error: e.message || 'Submission failed' });
    }
  }
);

export default router;
