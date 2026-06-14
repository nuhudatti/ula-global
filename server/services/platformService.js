import { PrismaClient } from '@prisma/client';
import { getBackupStatus } from './backupService.js';
import { listPlatformAudits } from './platformAudit.js';
import { getTenantStats } from './tenantService.js';

const prisma = new PrismaClient();

export async function getPlatformOverview() {
  const institutions = await prisma.institution.findMany({
    select: { id: true, status: true, slug: true, name: true, createdAt: true },
  });

  const activeInstitutions = institutions.filter((i) => i.status === 'ACTIVE').length;
  const totalUsers = await prisma.user.count();
  const activeUsers = await prisma.user.count({ where: { accountStatus: 'ACTIVE' } });
  const totalResources = await prisma.resource.count();
  const totalSubmissions = await prisma.assignmentSubmission.count();
  const storage = await prisma.resource.aggregate({ _sum: { sizeBytes: true } });

  let backupStatus = null;
  try {
    backupStatus = await getBackupStatus();
  } catch {
    backupStatus = { cronEnabled: false, totalCompleted: 0, lastBackup: null };
  }

  const recentEvents = await listPlatformAudits({ take: 12 });

  const institutionHealth = await Promise.all(
    institutions.slice(0, 8).map(async (inst) => {
      const stats = await getTenantStats(inst.id);
      return {
        id: inst.id,
        slug: inst.slug,
        name: inst.name,
        status: inst.status,
        ...stats,
      };
    }),
  );

  return {
    totals: {
      institutions: institutions.length,
      activeInstitutions,
      users: totalUsers,
      activeUsers,
      resources: totalResources,
      submissions: totalSubmissions,
      storageBytes: storage._sum.sizeBytes || 0,
    },
    systemHealth: 'operational',
    backupStatus,
    recentEvents,
    institutionHealth,
  };
}
