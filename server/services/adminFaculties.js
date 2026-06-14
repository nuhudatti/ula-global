import { PrismaClient } from '@prisma/client';
import { listFacultyAdminInvites } from './facultyAdminInvites.js';
import { userEmailWhere } from './tenantScope.js';

const prisma = new PrismaClient();

function normalizeCode(code) {
  return String(code)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

function facultySelect() {
  return {
    id: true,
    name: true,
    code: true,
    tagline: true,
    logoUrl: true,
    bannerUrl: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { departments: true, admins: true } },
  };
}

export async function getPlatformOverview(institutionId) {
  const facultyWhere = institutionId ? { institutionId } : {};
  const userWhere = institutionId
    ? { institutionId, accountStatus: 'ACTIVE' }
    : { accountStatus: 'ACTIVE' };
  const resourceWhere = institutionId
    ? { governanceStatus: { not: 'ARCHIVED' }, course: { department: { faculty: { institutionId } } } }
    : { governanceStatus: { not: 'ARCHIVED' } };
  const deptWhere = institutionId ? { faculty: { institutionId } } : {};

  const [facultyCount, departmentCount, userCount, resourceCount, faculties] = await Promise.all([
    prisma.faculty.count({ where: facultyWhere }),
    prisma.department.count({ where: deptWhere }),
    prisma.user.count({ where: userWhere }),
    prisma.resource.count({ where: resourceWhere }),
    prisma.faculty.findMany({
      where: facultyWhere,
      take: 6,
      orderBy: { updatedAt: 'desc' },
      select: facultySelect(),
    }),
  ]);

  return {
    stats: {
      faculties: facultyCount,
      departments: departmentCount,
      activeUsers: userCount,
      liveResources: resourceCount,
    },
    recentFaculties: faculties.map(mapFacultyRow),
  };
}

function mapFacultyRow(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    tagline: row.tagline,
    logoUrl: row.logoUrl,
    bannerUrl: row.bannerUrl,
    departmentCount: row._count?.departments ?? 0,
    adminCount: row._count?.admins ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listFaculties(institutionId) {
  const rows = await prisma.faculty.findMany({
    where: institutionId ? { institutionId } : undefined,
    orderBy: { name: 'asc' },
    select: facultySelect(),
  });
  return rows.map(mapFacultyRow);
}

export async function getFacultyDetail(facultyId, institutionId = null) {
  const faculty = await prisma.faculty.findFirst({
    where: {
      id: facultyId,
      ...(institutionId ? { institutionId } : {}),
    },
    select: {
      ...facultySelect(),
      admins: {
        where: { role: 'FACULTY_ADMIN', accountStatus: 'ACTIVE' },
        select: {
          id: true,
          email: true,
          fullName: true,
          accountStatus: true,
          lastActiveAt: true,
          profilePhotoUrl: true,
          createdAt: true,
        },
        orderBy: { fullName: 'asc' },
      },
    },
  });
  if (!faculty) return null;

  const lecturerCount = await prisma.user.count({
    where: {
      role: { in: ['LECTURER', 'HOD', 'DEPARTMENT_ADMIN'] },
      department: { facultyId },
    },
  });

  const pendingInvites = await listFacultyAdminInvites(facultyId);

  return {
    ...mapFacultyRow(faculty),
    admins: faculty.admins.map((a) => ({
      ...a,
      lifecycleStatus: a.accountStatus === 'ACTIVE' ? 'ACTIVE' : 'DEACTIVATED',
    })),
    pendingInvites,
    lecturerCount,
  };
}

export async function createFaculty({ name, code, tagline, institutionId }) {
  const trimmedName = String(name || '').trim();
  const normalizedCode = normalizeCode(code);
  if (!trimmedName) throw Object.assign(new Error('Faculty name is required'), { status: 400 });
  if (!normalizedCode || normalizedCode.length < 2) {
    throw Object.assign(new Error('Faculty code must be at least 2 characters (e.g. FAC_SCI)'), { status: 400 });
  }
  if (!institutionId) throw Object.assign(new Error('Institution context required'), { status: 400 });

  const exists = await prisma.faculty.findUnique({
    where: { institutionId_code: { institutionId, code: normalizedCode } },
  });
  if (exists) throw Object.assign(new Error('Faculty code already in use'), { status: 409 });

  const faculty = await prisma.faculty.create({
    data: {
      institutionId,
      name: trimmedName,
      code: normalizedCode,
      tagline: tagline?.trim() || null,
    },
    select: facultySelect(),
  });
  return mapFacultyRow(faculty);
}

export async function updateFaculty(facultyId, { name, code, tagline, institutionId = null }) {
  const existing = await prisma.faculty.findFirst({
    where: { id: facultyId, ...(institutionId ? { institutionId } : {}) },
  });
  if (!existing) throw Object.assign(new Error('Faculty not found'), { status: 404 });

  const data = {};
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw Object.assign(new Error('Faculty name cannot be empty'), { status: 400 });
    data.name = trimmed;
  }
  if (code !== undefined) {
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode || normalizedCode.length < 2) {
      throw Object.assign(new Error('Faculty code must be at least 2 characters'), { status: 400 });
    }
    if (normalizedCode !== existing.code) {
      const clash = await prisma.faculty.findUnique({
        where: { institutionId_code: { institutionId: existing.institutionId, code: normalizedCode } },
      });
      if (clash) throw Object.assign(new Error('Faculty code already in use'), { status: 409 });
      data.code = normalizedCode;
    }
  }
  if (tagline !== undefined) data.tagline = tagline?.trim() || null;

  const faculty = await prisma.faculty.update({
    where: { id: facultyId },
    data,
    select: facultySelect(),
  });
  return mapFacultyRow(faculty);
}

export async function deleteFaculty(facultyId, institutionId = null) {
  const faculty = await prisma.faculty.findFirst({
    where: { id: facultyId, ...(institutionId ? { institutionId } : {}) },
    select: { id: true, name: true, _count: { select: { departments: true } } },
  });
  if (!faculty) throw Object.assign(new Error('Faculty not found'), { status: 404 });
  if (faculty._count.departments > 0) {
    throw Object.assign(
      new Error('Cannot delete a faculty that still has departments. Remove all departments first.'),
      { status: 409 }
    );
  }

  const adminCount = await prisma.user.count({
    where: { facultyId, role: 'FACULTY_ADMIN' },
  });
  if (adminCount > 0) {
    throw Object.assign(
      new Error('Remove all faculty administrators before deleting this faculty.'),
      { status: 409 }
    );
  }

  await prisma.faculty.delete({ where: { id: facultyId } });
  return { ok: true, name: faculty.name };
}

export async function assignFacultyAdmin(facultyId, userId) {
  const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
  if (!faculty) throw Object.assign(new Error('Faculty not found'), { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.institutionId !== faculty.institutionId) {
    throw Object.assign(new Error('User belongs to a different institution'), { status: 403 });
  }
  if (['SUPER_ADMIN', 'INSTITUTION_ADMIN'].includes(user.role)) {
    throw Object.assign(new Error('Institution administrators cannot be assigned as faculty admins'), { status: 400 });
  }
  if (user.role === 'FACULTY_ADMIN' && user.facultyId && user.facultyId !== facultyId) {
    throw Object.assign(new Error('User is already a faculty administrator for another faculty'), { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      role: 'FACULTY_ADMIN',
      facultyId,
      departmentId: null,
      departmentRole: null,
      accountStatus: 'ACTIVE',
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      accountStatus: true,
      lastActiveAt: true,
      profilePhotoUrl: true,
    },
  });
  return updated;
}

export async function removeFacultyAdmin(facultyId, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.facultyId !== facultyId || user.role !== 'FACULTY_ADMIN') {
    throw Object.assign(new Error('User is not a faculty administrator for this faculty'), { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      facultyId: null,
      accountStatus: 'SUSPENDED',
    },
  });
  return { ok: true };
}

export async function findUserByEmail(email, institutionId) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !institutionId) return null;
  return prisma.user.findUnique({
    where: userEmailWhere(institutionId, normalized),
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      facultyId: true,
      accountStatus: true,
      faculty: { select: { name: true } },
    },
  });
}
