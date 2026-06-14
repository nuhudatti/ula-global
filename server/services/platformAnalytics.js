import { PrismaClient } from '@prisma/client';

import { getBackupStatus } from './backupService.js';

import { displayInvitationStatus } from './institutionAdminInvites.js';



const prisma = new PrismaClient();



const RESULT_KIND = 'PAST_QUESTIONS';

const METRICS_CACHE_MS = 30_000;



let resourceMetricsCache = { at: 0, data: null };

let backupStatusCache = { at: 0, data: null };



function startOfMonth() {

  const d = new Date();

  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

}



function startOfToday() {

  const d = new Date();

  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

}



async function cachedBackupStatus() {

  const now = Date.now();

  if (backupStatusCache.data && now - backupStatusCache.at < METRICS_CACHE_MS) {

    return backupStatusCache.data;

  }

  const data = await getBackupStatus().catch(() => null);

  backupStatusCache = { at: now, data };

  return data;

}



/** SQL aggregates — avoids loading every resource row into memory. */

async function aggregateResourceMetrics() {

  const now = Date.now();

  if (resourceMetricsCache.data && now - resourceMetricsCache.at < METRICS_CACHE_MS) {

    return resourceMetricsCache.data;

  }



  const rows = await prisma.$queryRaw`

    SELECT

      f."institutionId" AS "institutionId",

      r.kind AS kind,

      COALESCE(SUM(r."downloadCount"), 0)::int AS downloads,

      COALESCE(SUM(COALESCE(r."sizeBytes", 0)), 0)::bigint AS "storageBytes"

    FROM "Resource" r

    INNER JOIN "Course" c ON r."courseId" = c.id

    INNER JOIN "Department" d ON c."departmentId" = d.id

    INNER JOIN "Faculty" f ON d."facultyId" = f.id

    GROUP BY f."institutionId", r.kind

  `;



  const byInstitution = new Map();

  let totalResourceDownloads = 0;

  let totalResultDownloads = 0;

  let totalStorageBytes = 0;



  for (const row of rows) {

    const institutionId = row.institutionId;

    const downloads = Number(row.downloads) || 0;

    const storageBytes = Number(row.storageBytes) || 0;

    const kind = row.kind;



    if (!byInstitution.has(institutionId)) {

      byInstitution.set(institutionId, {

        resourceDownloads: 0,

        resultDownloads: 0,

        storageBytes: 0,

      });

    }

    const entry = byInstitution.get(institutionId);

    entry.storageBytes += storageBytes;

    totalStorageBytes += storageBytes;



    if (kind === RESULT_KIND) {

      entry.resultDownloads += downloads;

      totalResultDownloads += downloads;

    } else {
      entry.resourceDownloads += downloads;
      totalResourceDownloads += downloads;
    }

  }



  const result = { byInstitution, totalResourceDownloads, totalResultDownloads, totalStorageBytes };

  resourceMetricsCache = { at: now, data: result };

  return result;

}



async function aggregateMonthlyDownloads() {

  const since = startOfMonth();

  const rows = await prisma.systemAuditLog.groupBy({

    by: ['institutionId', 'action'],

    where: {

      institutionId: { not: null },

      action: { in: ['RESOURCE_DOWNLOAD', 'RESULT_DOWNLOAD'] },

      createdAt: { gte: since },

    },

    _count: { _all: true },

  });



  const byInstitution = new Map();

  for (const row of rows) {

    if (!row.institutionId) continue;

    if (!byInstitution.has(row.institutionId)) {

      byInstitution.set(row.institutionId, { resourceDownloads: 0, resultDownloads: 0 });

    }

    const entry = byInstitution.get(row.institutionId);

    if (row.action === 'RESULT_DOWNLOAD') entry.resultDownloads += row._count._all;

    else entry.resourceDownloads += row._count._all;

  }

  return byInstitution;

}



export async function getAnalyticsOverview() {

  const todayStart = startOfToday();



  const [

    institutions,

    activeTodayGroups,

    totalStudents,

    totalLecturers,

    resourceMetrics,

    successfulBackups,

    failedBackups,

    backupStatus,

  ] = await Promise.all([

    prisma.institution.findMany({

      select: { id: true, status: true },

    }),

    prisma.user.groupBy({

      by: ['institutionId'],

      where: { lastActiveAt: { gte: todayStart } },

      _count: { _all: true },

    }),

    prisma.user.count({ where: { role: 'STUDENT' } }),

    prisma.user.count({ where: { role: 'LECTURER' } }),

    aggregateResourceMetrics(),

    prisma.backup.count({ where: { status: 'COMPLETED' } }),

    prisma.backup.count({ where: { status: 'FAILED' } }),

    cachedBackupStatus(),

  ]);



  const activeInstitutionsToday = activeTodayGroups.length;

  const activeInstitutions = institutions.filter((i) => i.status === 'ACTIVE').length;



  const lastBackup = backupStatus?.lastBackup ?? null;

  const lastFailed = backupStatus?.lastFailed ?? null;



  return {

    totals: {

      institutions: institutions.length,

      activeInstitutions,

      activeInstitutionsToday,

      students: totalStudents,

      lecturers: totalLecturers,

      resourceDownloads: resourceMetrics.totalResourceDownloads,

      resultDownloads: resourceMetrics.totalResultDownloads,

      storageBytes: resourceMetrics.totalStorageBytes,

      successfulBackups,

      failedBackups,

    },

    backupHealth: {

      ok: backupStatus?.health?.ok ?? false,

      cronEnabled: backupStatus?.cronEnabled ?? false,

      lastBackupStatus: lastBackup?.status ?? (lastFailed ? 'FAILED' : null),

      lastBackupDate: lastBackup?.createdAt ?? lastFailed?.createdAt ?? null,

    },

  };

}



export async function getInstitutionAnalytics({ page = 1, take = 20 } = {}) {

  const skip = Math.max(0, (Math.max(1, page) - 1) * take);

  const limit = Math.min(Math.max(1, take), 100);



  const [institutions, total, resourceMetrics, backupStatus] = await Promise.all([

    prisma.institution.findMany({

      orderBy: { name: 'asc' },

      skip,

      take: limit,

      select: { id: true, slug: true, name: true, status: true, createdAt: true },

    }),

    prisma.institution.count(),

    aggregateResourceMetrics(),

    cachedBackupStatus(),

  ]);



  const institutionIds = institutions.map((i) => i.id);

  if (!institutionIds.length) {

    return {

      items: [],

      pagination: { page: Math.max(1, page), take: limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },

    };

  }



  const [roleCounts, lastActivity, monthlyDownloads, adminUsers, adminInvites] = await Promise.all([

    prisma.user.groupBy({

      by: ['institutionId', 'role'],

      where: { institutionId: { in: institutionIds } },

      _count: { _all: true },

    }),

    prisma.user.groupBy({

      by: ['institutionId'],

      where: { institutionId: { in: institutionIds } },

      _max: { lastActiveAt: true },

    }),

    aggregateMonthlyDownloads(),

    prisma.user.findMany({

      where: { role: 'INSTITUTION_ADMIN', institutionId: { in: institutionIds } },

      select: {

        institutionId: true,

        email: true,

        fullName: true,

        mustChangePassword: true,

        lastActiveAt: true,

      },

    }),

    prisma.lecturerInvite.findMany({

      where: { departmentRole: 'INSTITUTION_ADMIN', institutionId: { in: institutionIds } },

      orderBy: { createdAt: 'desc' },

      select: {

        id: true,

        institutionId: true,

        email: true,

        fullName: true,

        status: true,

        expiresAt: true,

        resentCount: true,

        createdAt: true,

      },

    }),

  ]);



  const studentsByInst = new Map();

  const lecturersByInst = new Map();

  for (const row of roleCounts) {

    if (row.role === 'STUDENT') studentsByInst.set(row.institutionId, row._count._all);

    if (row.role === 'LECTURER') lecturersByInst.set(row.institutionId, row._count._all);

  }



  const lastActivityByInst = new Map(

    lastActivity.map((r) => [r.institutionId, r._max.lastActiveAt]),

  );



  const adminByInst = new Map();

  for (const admin of adminUsers) {

    if (!adminByInst.has(admin.institutionId)) adminByInst.set(admin.institutionId, admin);

  }



  const inviteByInst = new Map();

  for (const invite of adminInvites) {

    if (!inviteByInst.has(invite.institutionId)) inviteByInst.set(invite.institutionId, invite);

  }



  const lastBackup = backupStatus?.lastBackup ?? null;

  const lastFailed = backupStatus?.lastFailed ?? null;

  const platformBackupStatus = lastBackup?.status ?? (lastFailed ? 'FAILED' : null);

  const platformBackupDate = lastBackup?.createdAt ?? lastFailed?.createdAt ?? null;



  const items = institutions.map((inst) => {

    const metrics = resourceMetrics.byInstitution.get(inst.id) ?? {

      resourceDownloads: 0,

      resultDownloads: 0,

      storageBytes: 0,

    };

    const monthly = monthlyDownloads.get(inst.id) ?? { resourceDownloads: 0, resultDownloads: 0 };

    const admin = adminByInst.get(inst.id) ?? null;

    const invite = inviteByInst.get(inst.id) ?? null;

    const invitationStatus = displayInvitationStatus(invite, admin);



    return {

      id: inst.id,

      slug: inst.slug,

      name: inst.name,

      status: inst.status,

      createdAt: inst.createdAt,

      adminName: admin?.fullName ?? invite?.fullName ?? null,

      adminEmail: admin?.email ?? invite?.email ?? null,

      invitationStatus,

      invitationId: invite?.id ?? null,

      lastActivityAt: admin?.lastActiveAt ?? lastActivityByInst.get(inst.id) ?? null,

      studentCount: studentsByInst.get(inst.id) ?? 0,

      lecturerCount: lecturersByInst.get(inst.id) ?? 0,

      resourceDownloadsThisMonth: monthly.resourceDownloads,

      resultDownloadsThisMonth: monthly.resultDownloads,

      storageBytes: metrics.storageBytes,

      lastBackupStatus: platformBackupStatus,

      lastBackupDate: platformBackupDate,

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

