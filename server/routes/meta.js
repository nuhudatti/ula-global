import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { resolveDepartmentCourse } from '../services/courseResolve.js';
import { resolveTenantMiddleware } from '../middleware/tenant.js';
import { normalizeSlug, resolveTenantBySlug } from '../services/tenantService.js';
import { mapDepartmentScope, mapFacultyScope, mapInstitutionPublic } from '../services/brandingPayload.js';
import { getCampusPulse } from '../services/campusPulse.js';
import { courseInstitutionWhere, departmentInstitutionWhere } from '../services/tenantScope.js';

const prisma = new PrismaClient();
const router = Router();

/** Faculty / department logos for the signed-in user's workspace (public institution is separate). */
router.get('/scope-branding', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, facultyId: true, departmentId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let faculty = null;
    let department = null;

    if (user.role === 'FACULTY_ADMIN' && user.facultyId) {
      faculty = await prisma.faculty.findUnique({
        where: { id: user.facultyId },
        select: { id: true, name: true, code: true, tagline: true, logoUrl: true, bannerUrl: true },
      });
    }

    if (user.departmentId) {
      department = await prisma.department.findUnique({
        where: { id: user.departmentId },
        select: {
          id: true,
          name: true,
          tagline: true,
          logoUrl: true,
          bannerUrl: true,
          faculty: { select: { name: true } },
        },
      });
      department = mapDepartmentScope(department);
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      faculty: mapFacultyScope(faculty),
      department,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load scope branding' });
  }
});

/** Live campus activity — public browse + sign-in pulse */
router.get('/campus-pulse', async (req, res) => {
  try {
    const data = await getCampusPulse(req.tenant?.id);
    res.set('Cache-Control', 'public, max-age=20');
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load campus pulse' });
  }
});

router.get('/tenant/:slug', async (req, res) => {
  try {
    const tenant = await resolveTenantBySlug(req.params.slug);
    if (!tenant) return res.status(404).json({ error: 'Institution not found' });
    res.set('Cache-Control', 'public, max-age=60');
    res.json(mapInstitutionPublic(tenant));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load institution' });
  }
});

router.get('/institution', resolveTenantMiddleware, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(mapInstitutionPublic(req.tenant));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load institution' });
  }
});

router.get('/faculties', resolveTenantMiddleware, async (req, res) => {
  try {
    const rows = await prisma.faculty.findMany({
      where: { institutionId: req.tenant.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load faculties' });
  }
});

router.get('/departments', async (req, res) => {
  try {
    const { facultyId } = req.query;
    const institutionId = req.tenant?.id;
    const rows = await prisma.department.findMany({
      where: {
        ...(institutionId ? departmentInstitutionWhere(institutionId) : {}),
        ...(facultyId ? { facultyId: String(facultyId) } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        facultyId: true,
        faculty: { select: { name: true, code: true } },
      },
    });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load departments' });
  }
});

/** Browse filters — by department and/or faculty */
router.get('/courses', async (req, res) => {
  try {
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : '';
    const facultyId = req.query.facultyId ? String(req.query.facultyId) : '';
    const levelRaw = req.query.level ? String(req.query.level) : '';

    const institutionId = req.tenant?.id;
    const clauses = [];
    if (institutionId) clauses.push(courseInstitutionWhere(institutionId));
    if (departmentId) clauses.push({ departmentId });
    else if (facultyId) clauses.push({ department: { facultyId } });
    if (levelRaw) {
      const lv = Number(levelRaw);
      if (!Number.isNaN(lv)) clauses.push({ level: lv });
    }

    const rows = await prisma.course.findMany({
      where: clauses.length ? { AND: clauses } : undefined,
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        title: true,
        level: true,
        departmentId: true,
        department: {
          select: {
            name: true,
            faculty: { select: { name: true, code: true } },
          },
        },
      },
    });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load courses' });
  }
});

/** Lecturer upload dropdown — courses in lecturer's department only */
router.get('/my-courses', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, departmentId: true },
    });
    if (!user || user.role !== 'LECTURER' || !user.departmentId) {
      return res.status(403).json({ error: 'Lecturer profile with department assignment required' });
    }

    const rows = await prisma.course.findMany({
      where: { departmentId: user.departmentId },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        title: true,
        level: true,
        departmentId: true,
        department: {
          select: {
            name: true,
            faculty: { select: { name: true, code: true } },
          },
        },
      },
    });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load courses' });
  }
});

/** Resolve typed course code + title to a department course (find or create). */
router.post('/my-courses/resolve', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, departmentId: true },
    });
    if (!user || user.role !== 'LECTURER' || !user.departmentId) {
      return res.status(403).json({ error: 'Lecturer profile with department assignment required' });
    }

    const course = await resolveDepartmentCourse({
      departmentId: user.departmentId,
      code: req.body?.code,
      title: req.body?.title,
      level: req.body?.level,
    });

    res.json(course);
  } catch (e) {
    const code = e.statusCode === 400 ? 400 : 500;
    console.error(e);
    res.status(code).json({ error: e.message || 'Could not resolve course' });
  }
});

/** Resolve course for resource managers — any department in institution */
router.post('/courses/resolve', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, institutionId: true },
    });
    const allowed = ['ACADEMIC_RESOURCES_MANAGER', 'INSTITUTION_ADMIN', 'SUPER_ADMIN'];
    if (!user || !allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Resource manager access required' });
    }

    const departmentId = String(req.body?.departmentId || '').trim();
    if (!departmentId) {
      return res.status(400).json({ error: 'departmentId is required' });
    }

    const dept = await prisma.department.findFirst({
      where: { id: departmentId, faculty: { institutionId: user.institutionId } },
      select: { id: true },
    });
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const course = await resolveDepartmentCourse({
      departmentId,
      code: req.body?.code,
      title: req.body?.title,
      level: req.body?.level,
      semester: req.body?.semester,
    });

    res.json(course);
  } catch (e) {
    const code = e.statusCode === 400 ? 400 : 500;
    console.error(e);
    res.status(code).json({ error: e.message || 'Could not resolve course' });
  }
});

export default router;
