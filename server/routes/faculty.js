import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { requireFacultyAdmin, loadFacultyContext } from '../middleware/facultyAdmin.js';
import {
  getFacultyOverview,
  listFacultyDepartments,
  listFacultyPeople,
  listFacultyCatalog,
  getFacultyAnalytics,
  buildFacultyAuditLog,
  getDepartmentIds,
  assignDepartmentHod,
  listHodAssignCandidates,
  createHodInvite,
  updateFacultyPersonStatus,
  resendFacultyPersonInvite,
  resendFacultyPersonUserInvite,
  getFacultyPersonInviteLink,
  revokeFacultyPersonInvite,
} from '../services/faculty.js';

const prisma = new PrismaClient();
const router = Router();

router.use(requireAuth, requireFacultyAdmin, loadFacultyContext);

router.get('/context', (req, res) => {
  res.json({
    faculty: req.faculty,
    admin: { id: req.facultyAdmin.id, fullName: req.facultyAdmin.fullName, role: req.facultyAdmin.role },
  });
});

router.get('/overview', async (req, res) => {
  try {
    const data = await getFacultyOverview(req.facultyId);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

router.get('/departments', async (req, res) => {
  try {
    const rows = await listFacultyDepartments(req.facultyId);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load departments' });
  }
});

router.post('/departments', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const dept = await prisma.department.create({
      data: { name: name.trim(), facultyId: req.facultyId },
    });
    res.status(201).json(dept);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Department name already exists in this faculty' });
    console.error(e);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

router.patch('/departments/:id', async (req, res) => {
  try {
    const existing = await prisma.department.findFirst({
      where: { id: req.params.id, facultyId: req.facultyId },
    });
    if (!existing) return res.status(404).json({ error: 'Department not found' });

    const { name, hodUserId } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();

    const dept = await prisma.department.update({
      where: { id: existing.id },
      data,
    });

    if (hodUserId) {
      const assignment = await assignDepartmentHod(existing.id, req.facultyId, hodUserId);
      const summary = await listFacultyDepartments(req.facultyId);
      const row = summary.find((d) => d.id === dept.id);
      return res.json({ ...row, assignment });
    }

    const summary = await listFacultyDepartments(req.facultyId);
    const row = summary.find((d) => d.id === dept.id);
    res.json(row ?? dept);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    if (e.code === 'P2002') return res.status(409).json({ error: 'Department name already exists' });
    console.error(e);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

router.delete('/departments/:id', async (req, res) => {
  try {
    const existing = await prisma.department.findFirst({
      where: { id: req.params.id, facultyId: req.facultyId },
    });
    if (!existing) return res.status(404).json({ error: 'Department not found' });

    const [users, resources] = await Promise.all([
      prisma.user.count({ where: { departmentId: existing.id } }),
      prisma.resource.count({ where: { course: { departmentId: existing.id } } }),
    ]);
    if (users > 0 || resources > 0) {
      return res.status(409).json({
        error: 'Department must be empty (no users or published resources) before removal',
      });
    }

    await prisma.course.deleteMany({ where: { departmentId: existing.id } });
    await prisma.department.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

router.get('/departments/:id', async (req, res) => {
  try {
    const dept = await prisma.department.findFirst({
      where: { id: req.params.id, facultyId: req.facultyId },
      select: { id: true, name: true, createdAt: true },
    });
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const summary = (await listFacultyDepartments(req.facultyId)).find((d) => d.id === dept.id);
    res.json(summary);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load department' });
  }
});

router.get('/hod-candidates', async (req, res) => {
  try {
    const items = await listHodAssignCandidates(req.facultyId);
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load assignable staff' });
  }
});

router.get('/people', async (req, res) => {
  try {
    const people = await listFacultyPeople(req.facultyId);
    const pendingInvites = await prisma.lecturerInvite.findMany({
      where: {
        department: { facultyId: req.facultyId },
        status: 'PENDING',
        departmentRole: 'HOD',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        departmentRole: true,
        createdAt: true,
        expiresAt: true,
        department: { select: { id: true, name: true } },
      },
    });
    res.json({ people, pendingInvites });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load people' });
  }
});

router.patch('/people/:userId', async (req, res) => {
  try {
    const { accountStatus } = req.body;
    if (!accountStatus) return res.status(400).json({ error: 'accountStatus is required' });
    const updated = await updateFacultyPersonStatus(req.facultyId, req.params.userId, accountStatus);
    res.json(updated);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to update person' });
  }
});

router.post('/people/:userId/resend-invite', async (req, res) => {
  try {
    const result = await resendFacultyPersonUserInvite(req.facultyId, req.params.userId, req.facultyAdmin.id);
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to resend invite' });
  }
});

router.post('/people/invites/:inviteId/resend', async (req, res) => {
  try {
    const result = await resendFacultyPersonInvite(req.facultyId, req.params.inviteId);
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

router.get('/people/invites/:inviteId/activation-link', async (req, res) => {
  try {
    const result = await getFacultyPersonInviteLink(req.facultyId, req.params.inviteId);
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to load activation link' });
  }
});

router.post('/people/invites/:inviteId/revoke', async (req, res) => {
  try {
    const result = await revokeFacultyPersonInvite(req.facultyId, req.params.inviteId);
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

router.post('/people/hod-invite', async (req, res) => {
  try {
    const { departmentId, email, fullName, staffId } = req.body;
    if (!departmentId || !email || !fullName) {
      return res.status(400).json({ error: 'departmentId, email, and fullName are required' });
    }
    const result = await createHodInvite({
      facultyId: req.facultyId,
      departmentId,
      invitedById: req.facultyAdmin.id,
      email,
      fullName,
      staffId,
    });
    res.status(201).json({
      type: 'invite',
      inviteUrl: result.inviteUrl,
      invite: result.invite,
      oneTimePassword: result.otp,
      emailSent: result.emailSent,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to create HOD invite' });
  }
});

router.get('/catalog', async (req, res) => {
  try {
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : '';
    const rows = await listFacultyCatalog(req.facultyId, departmentId || undefined);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load catalog' });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const data = await getFacultyAnalytics(req.facultyId);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

router.get('/audit', async (req, res) => {
  try {
    const departmentIds = await getDepartmentIds(req.facultyId);
    const entries = await buildFacultyAuditLog(req.facultyId, departmentIds, 60);
    res.json(entries);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load audit trail' });
  }
});

export default router;
