import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  assignFacultyAdmin,
  createFaculty,
  deleteFaculty,
  findUserByEmail,
  getFacultyDetail,
  getPlatformOverview,
  listFaculties,
  removeFacultyAdmin,
  updateFaculty,
} from '../services/adminFaculties.js';
import {
  createFacultyAdminInvite,
  deactivateFacultyAdmin,
  getFacultyAdminInviteLink,
  resendFacultyAdminInvite,
  revokeFacultyAdminInvite,
} from '../services/facultyAdminInvites.js';
import {
  createArmInvite,
  getArmInviteLink,
  listArmManagers,
  resendArmInvite,
  revokeArmInvite,
  suspendArmManager,
} from '../services/armInvites.js';

const router = Router();

router.use(requireAuth, requireRole('INSTITUTION_ADMIN', 'SUPER_ADMIN'));

router.get('/overview', async (req, res) => {
  try {
    const data = await getPlatformOverview(req.user.institutionId);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load platform overview' });
  }
});

router.get('/faculties', async (req, res) => {
  try {
    const faculties = await listFaculties(req.user.institutionId);
    res.json(faculties);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list faculties' });
  }
});

router.get('/faculties/:id', async (req, res) => {
  try {
    const faculty = await getFacultyDetail(req.params.id, req.user.institutionId);
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
    res.json(faculty);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load faculty' });
  }
});

router.post('/faculties', async (req, res) => {
  try {
    const faculty = await createFaculty({ ...req.body, institutionId: req.user.institutionId });
    res.status(201).json(faculty);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to create faculty' });
  }
});

router.patch('/faculties/:id', async (req, res) => {
  try {
    const faculty = await updateFaculty(req.params.id, { ...req.body, institutionId: req.user.institutionId });
    res.json(faculty);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to update faculty' });
  }
});

router.delete('/faculties/:id', async (req, res) => {
  try {
    const result = await deleteFaculty(req.params.id, req.user.institutionId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to delete faculty' });
  }
});

router.get('/users/lookup', async (req, res) => {
  try {
    const email = String(req.query.email || '');
    const user = await findUserByEmail(email, req.user.institutionId);
    if (!user) return res.status(404).json({ error: 'No user with that email' });
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

router.post('/faculties/:id/admins/invite', async (req, res) => {
  try {
    const { email, fullName } = req.body;
    if (!email || !fullName) {
      return res.status(400).json({ error: 'email and fullName are required' });
    }
    const result = await createFacultyAdminInvite({
      facultyId: req.params.id,
      invitedById: req.user.id,
      email,
      fullName,
    });
    res.status(201).json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to send invitation' });
  }
});

router.post('/faculties/:id/admins/invites/:inviteId/resend', async (req, res) => {
  try {
    const result = await resendFacultyAdminInvite(req.params.id, req.params.inviteId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to resend invitation' });
  }
});

router.get('/faculties/:id/admins/invites/:inviteId/activation-link', async (req, res) => {
  try {
    const result = await getFacultyAdminInviteLink(req.params.id, req.params.inviteId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to get activation link' });
  }
});

router.post('/faculties/:id/admins/invites/:inviteId/revoke', async (req, res) => {
  try {
    const result = await revokeFacultyAdminInvite(req.params.id, req.params.inviteId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to revoke invitation' });
  }
});

router.post('/faculties/:id/admins/:userId/deactivate', async (req, res) => {
  try {
    const result = await deactivateFacultyAdmin(req.params.id, req.params.userId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to deactivate administrator' });
  }
});

router.post('/faculties/:id/admins/assign', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const admin = await assignFacultyAdmin(req.params.id, userId);
    res.status(201).json(admin);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to assign admin' });
  }
});

router.delete('/faculties/:id/admins/:userId', async (req, res) => {
  try {
    const result = await removeFacultyAdmin(req.params.id, req.params.userId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to remove admin' });
  }
});

router.get('/arm-managers', async (req, res) => {
  try {
    const managers = await listArmManagers(req.user.institutionId);
    res.json(managers);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load resources team' });
  }
});

router.post('/arm-managers/invite', async (req, res) => {
  try {
    const { email, fullName } = req.body;
    if (!email || !fullName) {
      return res.status(400).json({ error: 'email and fullName are required' });
    }
    const result = await createArmInvite({
      institutionId: req.user.institutionId,
      email,
      fullName,
      invitedById: req.user.id,
    });
    res.status(201).json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to send invitation' });
  }
});

router.post('/arm-managers/invites/:inviteId/resend', async (req, res) => {
  try {
    const result = await resendArmInvite(req.user.institutionId, req.params.inviteId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to resend invitation' });
  }
});

router.get('/arm-managers/invites/:inviteId/activation-link', async (req, res) => {
  try {
    const result = await getArmInviteLink(req.user.institutionId, req.params.inviteId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to get activation link' });
  }
});

router.post('/arm-managers/invites/:inviteId/revoke', async (req, res) => {
  try {
    const result = await revokeArmInvite(req.user.institutionId, req.params.inviteId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to revoke invitation' });
  }
});

router.post('/arm-managers/:userId/suspend', async (req, res) => {
  try {
    const result = await suspendArmManager(req.user.institutionId, req.params.userId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to suspend manager' });
  }
});

export default router;
