import { Router } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import {
  validateIdentityImage,
  storeIdentityImage,
  removeStoredImage,
} from '../services/identityImages.js';
import { buildSettingsContext, ensureInstitution } from '../services/settings.js';
import {
  brandingPayloadForScope,
  mapInstitutionPublic,
} from '../services/brandingPayload.js';
import { normalizeStoredMediaUrl } from '../services/mediaUrls.js';

const prisma = new PrismaClient();
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(requireAuth);

router.get('/context', async (req, res) => {
  try {
    const facultyIdOverride =
      ['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(req.user.role) && req.query.facultyId
        ? String(req.query.facultyId)
        : undefined;
    const ctx = await buildSettingsContext(req.user.id, { facultyIdOverride });
    if (!ctx) return res.status(404).json({ error: 'User not found' });
    res.json(ctx);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const { fullName, bio } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(fullName !== undefined ? { fullName: String(fullName).trim() } : {}),
        ...(bio !== undefined ? { bio: bio?.trim() || null } : {}),
      },
      select: { id: true, fullName: true, bio: true, profilePhotoUrl: true, bannerUrl: true },
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.patch('/department', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, departmentId: true },
    });
    if (!user?.departmentId || !['HOD', 'DEPARTMENT_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Department admin access required' });
    }
    const { tagline } = req.body;
    const dept = await prisma.department.update({
      where: { id: user.departmentId },
      data: { ...(tagline !== undefined ? { tagline: tagline?.trim() || null } : {}) },
      select: { id: true, name: true, tagline: true, logoUrl: true, bannerUrl: true },
    });
    res.json(dept);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update department identity' });
  }
});

router.patch('/faculty', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, facultyId: true },
    });
    if (!['FACULTY_ADMIN', 'INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(user?.role)) {
      return res.status(403).json({ error: 'Faculty admin access required' });
    }

    let targetFacultyId = user.facultyId;
    if (['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(user.role) && req.body.facultyId) {
      targetFacultyId = String(req.body.facultyId);
    }
    if (!targetFacultyId) {
      return res.status(400).json({ error: 'facultyId is required for this update' });
    }

    const exists = await prisma.faculty.findFirst({
      where: { id: targetFacultyId, institutionId: req.user.institutionId },
      select: { id: true },
    });
    if (!exists) return res.status(404).json({ error: 'Faculty not found' });

    const { tagline } = req.body;
    const faculty = await prisma.faculty.update({
      where: { id: targetFacultyId },
      data: { ...(tagline !== undefined ? { tagline: tagline?.trim() || null } : {}) },
      select: { id: true, name: true, code: true, tagline: true, logoUrl: true, bannerUrl: true },
    });
    res.json(faculty);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update faculty identity' });
  }
});

router.patch('/institution', async (req, res) => {
  try {
    if (!['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Institution admin access required' });
    }
    await ensureInstitution(req.user.institutionId);
    const { name, shortName, tagline, logoPlacement } = req.body;
    const placement =
      logoPlacement === 'right' || logoPlacement === 'left' ? logoPlacement : undefined;
    const inst = await prisma.institution.update({
      where: { id: req.user.institutionId },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(shortName !== undefined ? { shortName: String(shortName).trim() } : {}),
        ...(tagline !== undefined ? { tagline: tagline?.trim() || null } : {}),
        ...(placement ? { logoPlacement: placement } : {}),
      },
    });
    res.json(mapInstitutionPublic(inst));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update institution' });
  }
});

const IMAGE_FIELDS = {
  profile: { photo: ['profilePhotoUrl', 'profilePhotoPublicId'], banner: ['bannerUrl', 'bannerPublicId'] },
  department: { logo: ['logoUrl', 'logoPublicId'], banner: ['bannerUrl', 'bannerPublicId'] },
  faculty: { logo: ['logoUrl', 'logoPublicId'], banner: ['bannerUrl', 'bannerPublicId'] },
  institution: { logo: ['logoUrl', 'logoPublicId'], banner: ['bannerUrl', 'bannerPublicId'] },
};

async function assertScopeAccess(userId, role, scope, entityId = null, institutionId = null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true, facultyId: true, role: true, institutionId: true },
  });
  const userInstitutionId = institutionId || user?.institutionId;
  if (scope === 'profile') return true;
  if (scope === 'department') {
    return user?.departmentId && ['HOD', 'DEPARTMENT_ADMIN'].includes(role);
  }
  if (scope === 'faculty') {
    if (!['FACULTY_ADMIN', 'INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(role)) return false;
    if (['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(role) && entityId) {
      const f = await prisma.faculty.findFirst({
        where: {
          id: String(entityId),
          ...(userInstitutionId ? { institutionId: userInstitutionId } : {}),
        },
        select: { id: true },
      });
      return !!f;
    }
    return !!user?.facultyId;
  }
  if (scope === 'institution') return ['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(role);
  return false;
}

async function resolveFacultyTargetId(userId, role, bodyFacultyId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { facultyId: true, role: true },
  });
  if (['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(role) && bodyFacultyId) return String(bodyFacultyId);
  return user?.facultyId;
}

router.post('/images', upload.single('file'), async (req, res) => {
  try {
    const scope = String(req.body.scope || 'profile');
    const kind = String(req.body.kind || 'photo');
    const err = validateIdentityImage(req.file);
    if (err) return res.status(400).json({ error: err });

    const entityId = req.body.entityId || req.body.facultyId || null;
    const allowed = await assertScopeAccess(req.user.id, req.user.role, scope, entityId, req.user.institutionId);
    if (!allowed) return res.status(403).json({ error: 'Not allowed to update this identity' });

    const fields = IMAGE_FIELDS[scope]?.[kind];
    if (!fields) return res.status(400).json({ error: 'Invalid scope or kind' });

    const [urlField, idField] = fields;
    const folder = `ula_identity/${scope}`;

    let oldUrl = null;
    let oldId = null;

    if (scope === 'profile') {
      const row = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { [urlField]: true, [idField]: true },
      });
      oldUrl = row?.[urlField];
      oldId = row?.[idField];
    } else if (scope === 'department') {
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { departmentId: true } });
      const row = await prisma.department.findUnique({
        where: { id: user.departmentId },
        select: { [urlField]: true, [idField]: true },
      });
      oldUrl = row?.[urlField];
      oldId = row?.[idField];
    } else if (scope === 'faculty') {
      const facultyId = await resolveFacultyTargetId(req.user.id, req.user.role, entityId);
      const row = await prisma.faculty.findUnique({
        where: { id: facultyId },
        select: { [urlField]: true, [idField]: true },
      });
      oldUrl = row?.[urlField];
      oldId = row?.[idField];
    } else if (scope === 'institution') {
      const row = await prisma.institution.findUnique({
        where: { id: req.user.institutionId },
        select: { [urlField]: true, [idField]: true },
      });
      oldUrl = row?.[urlField];
      oldId = row?.[idField];
    }

    const stored = await storeIdentityImage(req.file.buffer, req.file.originalname, folder);
    const data = {
      [urlField]: normalizeStoredMediaUrl(stored.url),
      [idField]: stored.publicId || null,
    };

    if (scope === 'profile') {
      await prisma.user.update({ where: { id: req.user.id }, data });
    } else if (scope === 'department') {
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { departmentId: true } });
      await prisma.department.update({ where: { id: user.departmentId }, data });
    } else if (scope === 'faculty') {
      const facultyId = await resolveFacultyTargetId(req.user.id, req.user.role, entityId);
      await prisma.faculty.update({ where: { id: facultyId }, data });
    } else if (scope === 'institution') {
      await prisma.institution.update({ where: { id: req.user.institutionId }, data });
    }

    if (oldUrl) await removeStoredImage(oldUrl, oldId);

    const facultyId =
      scope === 'faculty' ? await resolveFacultyTargetId(req.user.id, req.user.role, entityId) : null;
    const branding = await brandingPayloadForScope(scope, req.user.id, facultyId, req.user.institutionId);

    res.json({ url: data[urlField], kind, scope, ...branding });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
});

router.delete('/images', async (req, res) => {
  try {
    const scope = String(req.query.scope || 'profile');
    const kind = String(req.query.kind || 'photo');
    const entityId = req.query.entityId || req.query.facultyId || null;
    const allowed = await assertScopeAccess(req.user.id, req.user.role, scope, entityId, req.user.institutionId);
    if (!allowed) return res.status(403).json({ error: 'Not allowed' });

    const fields = IMAGE_FIELDS[scope]?.[kind];
    if (!fields) return res.status(400).json({ error: 'Invalid scope or kind' });
    const [urlField, idField] = fields;

    let oldUrl = null;
    let oldId = null;

    if (scope === 'profile') {
      const row = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { [urlField]: true, [idField]: true },
      });
      oldUrl = row?.[urlField];
      oldId = row?.[idField];
      await prisma.user.update({ where: { id: req.user.id }, data: { [urlField]: null, [idField]: null } });
    } else if (scope === 'department') {
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { departmentId: true } });
      const row = await prisma.department.findUnique({
        where: { id: user.departmentId },
        select: { [urlField]: true, [idField]: true },
      });
      oldUrl = row?.[urlField];
      oldId = row?.[idField];
      await prisma.department.update({
        where: { id: user.departmentId },
        data: { [urlField]: null, [idField]: null },
      });
    } else if (scope === 'faculty') {
      const facultyId = await resolveFacultyTargetId(req.user.id, req.user.role, entityId);
      const row = await prisma.faculty.findUnique({
        where: { id: facultyId },
        select: { [urlField]: true, [idField]: true },
      });
      oldUrl = row?.[urlField];
      oldId = row?.[idField];
      await prisma.faculty.update({ where: { id: facultyId }, data: { [urlField]: null, [idField]: null } });
    } else if (scope === 'institution') {
      const row = await prisma.institution.findUnique({
        where: { id: req.user.institutionId },
        select: { [urlField]: true, [idField]: true },
      });
      oldUrl = row?.[urlField];
      oldId = row?.[idField];
      await prisma.institution.update({
        where: { id: req.user.institutionId },
        data: { [urlField]: null, [idField]: null },
      });
    }

    if (oldUrl) await removeStoredImage(oldUrl, oldId);

    const facultyId =
      scope === 'faculty' ? await resolveFacultyTargetId(req.user.id, req.user.role, entityId) : null;
    const branding = await brandingPayloadForScope(scope, req.user.id, facultyId, req.user.institutionId);

    res.json({ url: null, kind, scope, ...branding });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove image' });
  }
});

export default router;
