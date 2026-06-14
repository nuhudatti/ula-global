import { PrismaClient } from '@prisma/client';
import { RESOURCE_KINDS, canManageResources } from '../constants/academicRoles.js';
import { resourceInstitutionWhere } from './tenantScope.js';
import { removeAppFile, sanitizeResource } from './fileService.js';

const prisma = new PrismaClient();

const GOVERNANCE_STATUSES = ['VERIFIED', 'PUBLISHED', 'PENDING_REVIEW', 'ARCHIVED', 'REJECTED'];

export async function assertResourceInInstitution(resourceId, institutionId) {
  const resource = await prisma.resource.findFirst({
    where: {
      id: resourceId,
      ...resourceInstitutionWhere(institutionId),
    },
    include: {
      course: {
        include: { department: { include: { faculty: true } } },
      },
      uploadedBy: { select: { id: true, fullName: true, email: true } },
    },
  });
  if (!resource) {
    const err = new Error('Resource not found');
    err.status = 404;
    throw err;
  }
  return resource;
}

export async function listArmResources(institutionId, { search, facultyId, departmentId, courseId, kind, governanceStatus, take = 40, skip = 0 } = {}) {
  const clauses = [resourceInstitutionWhere(institutionId)];
  if (search) {
    clauses.push({
      OR: [{ title: { contains: search } }, { description: { contains: search } }],
    });
  }
  if (kind && RESOURCE_KINDS.includes(kind)) clauses.push({ kind });
  if (governanceStatus && GOVERNANCE_STATUSES.includes(governanceStatus)) clauses.push({ governanceStatus });
  if (courseId) clauses.push({ courseId });
  if (departmentId) clauses.push({ course: { departmentId } });
  if (facultyId) clauses.push({ course: { department: { facultyId } } });

  const where = { AND: clauses };
  const [items, total] = await Promise.all([
    prisma.resource.findMany({
      where,
      skip,
      take: Math.min(take, 100),
      orderBy: { updatedAt: 'desc' },
      include: {
        course: {
          include: {
            department: { include: { faculty: { select: { id: true, name: true, code: true } } } },
          },
        },
        uploadedBy: { select: { id: true, fullName: true, email: true, role: true } },
      },
    }),
    prisma.resource.count({ where }),
  ]);

  return { items: items.map(sanitizeResource), total };
}

export async function updateArmResource(resourceId, institutionId, actorRole, patch) {
  if (!canManageResources(actorRole)) {
    const err = new Error('Not allowed to manage resources');
    err.status = 403;
    throw err;
  }

  const existing = await assertResourceInInstitution(resourceId, institutionId);
  const data = {};

  if (patch.title != null) data.title = String(patch.title).trim();
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.kind != null && RESOURCE_KINDS.includes(patch.kind)) data.kind = patch.kind;
  if (patch.examYear !== undefined) {
    const y = patch.examYear === null || patch.examYear === '' ? null : Number(patch.examYear);
    data.examYear = y != null && !Number.isNaN(y) ? y : null;
  }
  if (patch.semester !== undefined) data.semester = patch.semester?.trim() || null;
  if (patch.sourceType != null) data.sourceType = patch.sourceType;
  if (patch.governanceStatus != null && GOVERNANCE_STATUSES.includes(patch.governanceStatus)) {
    data.governanceStatus = patch.governanceStatus;
  }

  if (!Object.keys(data).length) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  const updated = await prisma.resource.update({
    where: { id: existing.id },
    data,
    include: {
      course: {
        include: { department: { include: { faculty: true } } },
      },
      uploadedBy: { select: { id: true, fullName: true, email: true, role: true } },
    },
  });

  return sanitizeResource(updated);
}

export async function deleteArmResource(resourceId, institutionId, actorRole) {
  if (!canManageResources(actorRole)) {
    const err = new Error('Not allowed to delete resources');
    err.status = 403;
    throw err;
  }

  const existing = await assertResourceInInstitution(resourceId, institutionId);
  await prisma.resource.delete({ where: { id: existing.id } });
  if (existing.cloudinaryPublicId) {
    await removeAppFile(existing.cloudinaryPublicId);
  }
  return { ok: true };
}
