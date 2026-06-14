import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { requireDepartmentAdmin, loadDepartmentContext } from '../middleware/departmentAdmin.js';
import {
  getDepartmentOverview,
  listDepartmentLecturers,
  createLecturerDirect,
  createLecturerInvite,
  getPendingInviteLink,
  resendPendingLecturerInvite,
  revokePendingLecturerInvite,
  syncLecturerCourses,
  getDepartmentAnalytics,
} from '../services/department.js';
import { listDepartmentInvitations } from '../services/lecturerInvites.js';

const prisma = new PrismaClient();
const router = Router();

router.use(requireAuth, requireDepartmentAdmin, loadDepartmentContext);

router.get('/context', (req, res) => {
  res.json({
    department: req.deptAdmin.department,
    admin: {
      id: req.deptAdmin.id,
      role: req.deptAdmin.role,
    },
  });
});

router.get('/overview', async (req, res) => {
  try {
    const data = await getDepartmentOverview(req.departmentId);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

router.get('/lecturers', async (req, res) => {
  try {
    const data = await listDepartmentLecturers(req.departmentId);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load lecturers' });
  }
});

router.post('/lecturers', async (req, res) => {
  try {
    const {
      email,
      fullName,
      staffId,
      departmentRole,
      password,
      canUpload,
      courseIds,
      semester,
      mode,
      accountStatus,
    } = req.body;

    if (!email || !fullName) {
      return res.status(400).json({ error: 'email and fullName are required' });
    }

    if (mode === 'invite') {
      const result = await createLecturerInvite({
        departmentId: req.departmentId,
        invitedById: req.deptAdmin.id,
        email,
        fullName,
        staffId,
        departmentRole,
        canUpload,
        courseIds,
      });
      return res.status(201).json({
        type: 'invite',
        invite: result.invite,
        inviteUrl: result.inviteUrl,
        emailSent: result.emailSent,
        emailError: result.emailError,
        devActivationUrl: result.devActivationUrl,
        outboxFile: result.outboxFile,
      });
    }

    const direct = await createLecturerDirect({
      departmentId: req.departmentId,
      email,
      fullName,
      staffId,
      departmentRole,
      password,
      canUpload,
      courseIds,
      semester,
      accountStatus: accountStatus || 'ACTIVE',
    });
    res.status(201).json({
      type: 'direct',
      user: direct.user,
      oneTimePassword: direct.temporaryPassword,
      emailSent: direct.emailSent,
    });
  } catch (e) {
    if (e.status === 409) return res.status(409).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to add lecturer' });
  }
});

router.patch('/lecturers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const lecturer = await prisma.user.findFirst({
      where: { id, departmentId: req.departmentId, role: 'LECTURER' },
    });
    if (!lecturer) return res.status(404).json({ error: 'Lecturer not found' });

    const { accountStatus, canUpload, departmentRole, courseIds, semester, fullName, staffId } =
      req.body;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(accountStatus !== undefined ? { accountStatus } : {}),
        ...(canUpload !== undefined ? { canUpload } : {}),
        ...(departmentRole !== undefined ? { departmentRole } : {}),
        ...(fullName !== undefined ? { fullName: fullName.trim() } : {}),
        ...(staffId !== undefined ? { staffId: staffId?.trim() || null } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        staffId: true,
        accountStatus: true,
        departmentRole: true,
        canUpload: true,
      },
    });

    if (courseIds !== undefined) {
      await syncLecturerCourses(id, courseIds, semester);
    }

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update lecturer' });
  }
});

router.post('/lecturers/:id/resend-invite', async (req, res) => {
  try {
    const lecturer = await prisma.user.findFirst({
      where: { id: req.params.id, departmentId: req.departmentId, role: 'LECTURER' },
    });
    if (!lecturer) return res.status(404).json({ error: 'Lecturer not found' });
    if (lecturer.accountStatus !== 'PENDING') {
      return res.status(409).json({ error: 'This lecturer is already active — resend is only for pending accounts' });
    }

    const result = await createLecturerInvite({
      departmentId: req.departmentId,
      invitedById: req.deptAdmin.id,
      email: lecturer.email,
      fullName: lecturer.fullName,
      staffId: lecturer.staffId,
      departmentRole: lecturer.departmentRole,
      canUpload: lecturer.canUpload,
      allowExisting: true,
    });

    await prisma.user.update({
      where: { id: lecturer.id },
      data: { accountStatus: 'PENDING' },
    });

    res.json({
      invite: result.invite,
      inviteUrl: result.inviteUrl,
      emailSent: result.emailSent,
      emailError: result.emailError,
      devActivationUrl: result.devActivationUrl,
      outboxFile: result.outboxFile,
    });
  } catch (e) {
    if (e.status === 409) return res.status(409).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to resend invite' });
  }
});

router.get('/invitations', async (req, res) => {
  try {
    const invitations = await listDepartmentInvitations(req.departmentId);
    res.json(invitations);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load invitations' });
  }
});

router.get('/invites/:id/link', async (req, res) => {
  try {
    const result = await getPendingInviteLink(req.params.id, req.departmentId);
    res.json(result);
  } catch (e) {
    if (e.status === 404 || e.status === 410) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to load invite link' });
  }
});

router.post('/invites/:id/resend', async (req, res) => {
  try {
    const result = await resendPendingLecturerInvite(req.params.id, req.departmentId);
    res.json(result);
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

router.delete('/invites/:id', async (req, res) => {
  try {
    const result = await revokePendingLecturerInvite(req.params.id, req.departmentId);
    res.json(result);
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

router.get('/courses', async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: { departmentId: req.departmentId },
      include: {
        resources: {
          select: { uploadedBy: { select: { id: true, fullName: true } } },
        },
        _count: { select: { resources: true } },
      },
      orderBy: { code: 'asc' },
    });
    res.json(
      courses.map((c) => {
        const publishers = new Map();
        for (const r of c.resources) {
          publishers.set(r.uploadedBy.id, {
            id: r.uploadedBy.id,
            fullName: r.uploadedBy.fullName,
          });
        }
        return {
          id: c.id,
          code: c.code,
          title: c.title,
          resourceCount: c._count.resources,
          publishers: [...publishers.values()],
        };
      })
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load catalog' });
  }
});

router.post('/courses', async (req, res) => {
  try {
    const { code, title, level, semester, lecturerId } = req.body;
    if (!code?.trim() || !title?.trim()) {
      return res.status(400).json({ error: 'code and title are required' });
    }

    const course = await prisma.course.create({
      data: {
        code: code.trim().toUpperCase(),
        title: title.trim(),
        level: level != null ? Number(level) : null,
        semester: semester?.trim() || null,
        departmentId: req.departmentId,
      },
    });

    if (lecturerId) {
      await syncLecturerCourses(lecturerId, [course.id], semester);
    }

    res.status(201).json(course);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Course code already exists' });
    console.error(e);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.patch('/courses/:id', async (req, res) => {
  try {
    const existing = await prisma.course.findFirst({
      where: { id: req.params.id, departmentId: req.departmentId },
    });
    if (!existing) return res.status(404).json({ error: 'Course not found' });

    const { title, level, semester, lecturerId } = req.body;
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(level !== undefined ? { level: level != null ? Number(level) : null } : {}),
        ...(semester !== undefined ? { semester: semester?.trim() || null } : {}),
      },
    });

    if (lecturerId) {
      const current = await prisma.lecturerCourseAssignment.findMany({
        where: { courseId: course.id },
        select: { userId: true },
      });
      const ids = [...new Set([...current.map((c) => c.userId), lecturerId])];
      for (const uid of ids) {
        await syncLecturerCourses(uid, [course.id], semester);
      }
    }

    res.json(course);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

router.get('/resources', async (req, res) => {
  try {
    const { status } = req.query;
    const resources = await prisma.resource.findMany({
      where: {
        course: { departmentId: req.departmentId },
        ...(status ? { governanceStatus: String(status) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        kind: true,
        governanceStatus: true,
        downloadCount: true,
        createdAt: true,
        uploadedBy: { select: { id: true, fullName: true, email: true } },
        course: { select: { code: true, title: true } },
      },
    });
    res.json(resources);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load resources' });
  }
});

router.patch('/resources/:id/governance', async (req, res) => {
  try {
    const { governanceStatus } = req.body;
    const allowed = ['PUBLISHED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'ARCHIVED'];
    if (!allowed.includes(governanceStatus)) {
      return res.status(400).json({ error: 'Invalid governance status' });
    }

    const resource = await prisma.resource.findFirst({
      where: { id: req.params.id, course: { departmentId: req.departmentId } },
    });
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    const updated = await prisma.resource.update({
      where: { id: resource.id },
      data: { governanceStatus },
      select: {
        id: true,
        title: true,
        governanceStatus: true,
      },
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update resource' });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const data = await getDepartmentAnalytics(req.departmentId);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

router.get('/notices', async (req, res) => {
  try {
    const notices = await prisma.departmentNotice.findMany({
      where: { departmentId: req.departmentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { createdBy: { select: { fullName: true } } },
    });
    res.json(notices);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load notices' });
  }
});

router.post('/notices', async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'title and body are required' });
    }
    const notice = await prisma.departmentNotice.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        departmentId: req.departmentId,
        createdById: req.deptAdmin.id,
      },
      include: { createdBy: { select: { fullName: true } } },
    });
    res.status(201).json(notice);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create notice' });
  }
});

router.get('/verification', async (req, res) => {
  try {
    const queue = await prisma.resource.findMany({
      where: {
        course: { departmentId: req.departmentId },
        governanceStatus: 'PENDING_REVIEW',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        kind: true,
        governanceStatus: true,
        createdAt: true,
        uploadedBy: { select: { fullName: true } },
        course: { select: { code: true } },
      },
    });
    res.json(queue);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load verification queue' });
  }
});

export default router;
