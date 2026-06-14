import { PrismaClient } from '@prisma/client';
import { labelAuditAction, sanitizeAuditDetail } from './auditActions.js';

const prisma = new PrismaClient();

export async function logPlatformAudit({ action, actorId, actorType = 'platform', institutionId = null, detail = null }) {
  try {
    await prisma.systemAuditLog.create({
      data: { action, actorId, actorType, institutionId, detail },
    });
  } catch (e) {
    console.warn('[audit] skipped:', e.message);
  }
}

export async function listPlatformAudits({ take = 50, institutionId = null } = {}) {
  return prisma.systemAuditLog.findMany({
    where: institutionId ? { institutionId } : undefined,
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function listPlatformAuditsPaginated({
  page = 1,
  take = 30,
  institutionId = null,
  action = null,
} = {}) {
  const limit = Math.min(Math.max(1, take), 100);
  const skip = Math.max(0, (Math.max(1, page) - 1) * limit);

  const where = {};
  if (institutionId) where.institutionId = institutionId;
  if (action) where.action = String(action);

  const [rows, total, institutions] = await Promise.all([
    prisma.systemAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.systemAuditLog.count({ where }),
    prisma.institution.findMany({
      select: { id: true, slug: true, name: true },
    }),
  ]);

  const institutionMap = new Map(institutions.map((i) => [i.id, i]));

  const items = rows.map((row) => {
    const inst = row.institutionId ? institutionMap.get(row.institutionId) : null;
    return {
      id: row.id,
      action: row.action,
      actionLabel: labelAuditAction(row.action),
      actorType: row.actorType,
      institutionId: row.institutionId,
      institutionName: inst?.name ?? null,
      institutionSlug: inst?.slug ?? null,
      detail: sanitizeAuditDetail(row.detail),
      createdAt: row.createdAt,
    };
  });

  return {
    items,
    pagination: {
      page: Math.max(1, page),
      take: limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
