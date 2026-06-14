import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenantMiddleware } from '../middleware/tenant.js';
import { canManageResources } from '../constants/academicRoles.js';
import { deleteArmResource, listArmResources, updateArmResource } from '../services/armResources.js';

const router = Router();

router.use(requireAuth, resolveTenantMiddleware);

function requireResourceManager(req, res, next) {
  if (!canManageResources(req.user.role)) {
    return res.status(403).json({ error: 'Academic resource management access required' });
  }
  next();
}

router.get('/resources', requireResourceManager, async (req, res) => {
  try {
    const result = await listArmResources(req.tenant.id, {
      search: req.query.search ? String(req.query.search) : '',
      facultyId: req.query.facultyId ? String(req.query.facultyId) : '',
      departmentId: req.query.departmentId ? String(req.query.departmentId) : '',
      courseId: req.query.courseId ? String(req.query.courseId) : '',
      kind: req.query.kind ? String(req.query.kind) : '',
      governanceStatus: req.query.governanceStatus ? String(req.query.governanceStatus) : '',
      take: Number(req.query.take) || 40,
      skip: Number(req.query.skip) || 0,
    });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load resources' });
  }
});

router.patch('/resources/:id', requireResourceManager, async (req, res) => {
  try {
    const updated = await updateArmResource(req.params.id, req.tenant.id, req.user.role, req.body);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Update failed' });
  }
});

router.delete('/resources/:id', requireResourceManager, async (req, res) => {
  try {
    await deleteArmResource(req.params.id, req.tenant.id, req.user.role);
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Delete failed' });
  }
});

export default router;
