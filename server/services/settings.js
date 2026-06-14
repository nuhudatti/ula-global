import { PrismaClient } from '@prisma/client';
import { normalizeStoredMediaUrl } from './mediaUrls.js';

const prisma = new PrismaClient();

export async function ensureInstitution(institutionId = 'ibbul') {
  const existing = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (existing) return existing;
  return prisma.institution.findFirst({ where: { slug: 'ibbul' } });
}

export async function buildSettingsContext(userId, options = {}) {
  const facultyIdOverride =
    options.facultyIdOverride && String(options.facultyIdOverride).trim()
      ? String(options.facultyIdOverride).trim()
      : null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      institutionId: true,
      email: true,
      fullName: true,
      role: true,
      bio: true,
      staffId: true,
      profilePhotoUrl: true,
      bannerUrl: true,
      departmentId: true,
      facultyId: true,
      department: {
        select: {
          id: true,
          name: true,
          tagline: true,
          logoUrl: true,
          bannerUrl: true,
          faculty: { select: { id: true, name: true, code: true, tagline: true, logoUrl: true, bannerUrl: true } },
        },
      },
      faculty: {
        select: { id: true, name: true, code: true, tagline: true, logoUrl: true, bannerUrl: true },
      },
    },
  });
  if (!user) return null;

  const institution = await ensureInstitution(user.institutionId || 'ibbul');

  const canEditDepartment = ['HOD', 'DEPARTMENT_ADMIN'].includes(user.role) && !!user.departmentId;
  const canEditInstitution = ['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(user.role);

  let facultyRecord = null;
  if (user.role === 'FACULTY_ADMIN') {
    facultyRecord = user.faculty;
  } else if (['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(user.role) && facultyIdOverride) {
    facultyRecord = await prisma.faculty.findFirst({
      where: { id: facultyIdOverride, institutionId: user.institutionId },
      select: { id: true, name: true, code: true, tagline: true, logoUrl: true, bannerUrl: true },
    });
  }

  const canEditFaculty =
    (user.role === 'FACULTY_ADMIN' && !!user.facultyId) ||
    (['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(user.role) && !!facultyRecord && !!facultyIdOverride);

  const showDepartment = canEditDepartment;
  const showFaculty = canEditFaculty;
  const showInstitution = ['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(user.role) && !facultyIdOverride;

  return {
    scopes: {
      profile: true,
      department: showDepartment,
      faculty: showFaculty,
      institution: showInstitution,
    },
    profile: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      bio: user.bio,
      staffId: user.staffId,
      profilePhotoUrl: normalizeStoredMediaUrl(user.profilePhotoUrl),
      bannerUrl: normalizeStoredMediaUrl(user.bannerUrl),
      canEdit: true,
    },
    department:
      showDepartment && user.department
        ? {
            id: user.department.id,
            name: user.department.name,
            tagline: user.department.tagline,
            logoUrl: normalizeStoredMediaUrl(user.department.logoUrl),
            bannerUrl: normalizeStoredMediaUrl(user.department.bannerUrl),
            facultyName: user.department.faculty.name,
            canEdit: canEditDepartment,
          }
        : null,
    faculty:
      showFaculty && facultyRecord
        ? {
            id: facultyRecord.id,
            name: facultyRecord.name,
            code: facultyRecord.code,
            tagline: facultyRecord.tagline,
            logoUrl: normalizeStoredMediaUrl(facultyRecord.logoUrl),
            bannerUrl: normalizeStoredMediaUrl(facultyRecord.bannerUrl),
            canEdit: canEditFaculty,
          }
        : null,
    institution: showInstitution
      ? {
          id: institution.id,
          name: institution.name,
          shortName: institution.shortName,
          tagline: institution.tagline,
          logoUrl: normalizeStoredMediaUrl(institution.logoUrl),
          bannerUrl: normalizeStoredMediaUrl(institution.bannerUrl),
          logoPlacement: institution.logoPlacement === 'right' ? 'right' : 'left',
          canEdit: canEditInstitution,
        }
      : null,
  };
}
