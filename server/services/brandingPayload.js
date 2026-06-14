import { PrismaClient } from '@prisma/client';
import { normalizeMediaFields, normalizeStoredMediaUrl } from './mediaUrls.js';

const prisma = new PrismaClient();

export function mapInstitutionPublic(row) {
  if (!row) return null;
  return normalizeMediaFields({
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    tagline: row.tagline,
    logoUrl: row.logoUrl,
    bannerUrl: row.bannerUrl,
    logoPlacement: row.logoPlacement === 'right' ? 'right' : 'left',
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    status: row.status,
    updatedAt: row.updatedAt,
  });
}

export function mapFacultyScope(row) {
  if (!row) return null;
  return normalizeMediaFields({
    id: row.id,
    name: row.name,
    code: row.code,
    tagline: row.tagline,
    logoUrl: row.logoUrl,
    bannerUrl: row.bannerUrl,
  });
}

export function mapDepartmentScope(row) {
  if (!row) return null;
  return normalizeMediaFields({
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    logoUrl: row.logoUrl,
    bannerUrl: row.bannerUrl,
    facultyName: row.faculty?.name ?? undefined,
  });
}

export function mapProfileMedia(row) {
  if (!row) return null;
  return normalizeMediaFields(
    {
      profilePhotoUrl: row.profilePhotoUrl,
      bannerUrl: row.bannerUrl,
    },
    ['profilePhotoUrl', 'bannerUrl']
  );
}

export async function brandingPayloadForScope(scope, userId, facultyId = null, institutionId = null) {
  const payload = {};

  if (scope === 'institution') {
    let instId = institutionId;
    if (!instId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { institutionId: true },
      });
      instId = user?.institutionId;
    }
    const inst = instId
      ? await prisma.institution.findUnique({ where: { id: instId } })
      : null;
    payload.institution = mapInstitutionPublic(inst);
  }

  if (scope === 'profile') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profilePhotoUrl: true, bannerUrl: true },
    });
    payload.profile = mapProfileMedia(user);
  }

  if (scope === 'faculty' && facultyId) {
    const faculty = await prisma.faculty.findUnique({
      where: { id: facultyId },
      select: { id: true, name: true, code: true, tagline: true, logoUrl: true, bannerUrl: true },
    });
    payload.faculty = mapFacultyScope(faculty);
  }

  if (scope === 'department') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    if (user?.departmentId) {
      const department = await prisma.department.findUnique({
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
      payload.department = mapDepartmentScope(department);
    }
  }

  return payload;
}
