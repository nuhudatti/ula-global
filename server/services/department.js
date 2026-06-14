import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateOneTimePassword } from './authCrypto.js';
import { dispatchWelcomeEmail } from './authLifecycle.js';
import { syncLecturerCourses } from './lecturerCourses.js';
import {
  cancelLecturerInvitation,
  createLecturerInvitation,
  getInvitationLink,
  listDepartmentInvitations,
  resendLecturerInvitation,
} from './lecturerInvites.js';

const prisma = new PrismaClient();

export { syncLecturerCourses };
export { createLecturerInvitation as createLecturerInvite };
export { getInvitationLink as getPendingInviteLink };
export { resendLecturerInvitation as resendPendingLecturerInvite };
export { cancelLecturerInvitation as revokePendingLecturerInvite };

export async function getDepartmentOverview(departmentId) {
  const [lecturerCount, activeLecturerCount, courseCount, resources, recentResources, lecturers] =
    await Promise.all([
    prisma.user.count({
      where: { departmentId, role: 'LECTURER' },
    }),
    prisma.user.count({
      where: { departmentId, role: 'LECTURER', accountStatus: 'ACTIVE' },
    }),
    prisma.course.count({ where: { departmentId } }),
    prisma.resource.findMany({
      where: { course: { departmentId } },
      select: {
        id: true,
        downloadCount: true,
        governanceStatus: true,
        createdAt: true,
      },
    }),
    prisma.resource.findMany({
      where: { course: { departmentId }, governanceStatus: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        title: true,
        kind: true,
        createdAt: true,
        governanceStatus: true,
        uploadedBy: { select: { fullName: true } },
        course: { select: { code: true, title: true } },
      },
    }),
    prisma.user.findMany({
      where: { departmentId, role: 'LECTURER' },
      select: {
        id: true,
        fullName: true,
        email: true,
        accountStatus: true,
        lastActiveAt: true,
        updatedAt: true,
        _count: { select: { uploads: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
  ]);

  const publishedCount = resources.filter((r) => r.governanceStatus !== 'ARCHIVED').length;
  const totalDownloads = resources.reduce((s, r) => s + r.downloadCount, 0);
  const pendingVerification = resources.filter((r) => r.governanceStatus === 'PENDING_REVIEW').length;
  const approvedCount = resources.filter((r) => r.governanceStatus === 'VERIFIED').length;
  const engagementScore = Math.min(
    100,
    Math.round(
      activeLecturerCount * 12 +
        courseCount * 4 +
        approvedCount * 3 +
        Math.log10(totalDownloads + 1) * 15
    )
  );

  const recentInvites = await prisma.lecturerInvite.findMany({
    where: { departmentId },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { id: true, fullName: true, email: true, createdAt: true, status: true },
  });

  const kindLabel = (k) =>
    String(k || 'OTHER')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const auditLog = [
    ...recentResources.map((r) => ({
      id: `res-${r.id}`,
      category: 'publish',
      title: 'Resource published',
      description: `${r.title} — ${r.course.code} ${r.course.title}`,
      actor: r.uploadedBy.fullName,
      reference: kindLabel(r.kind),
      status: r.governanceStatus,
      at: r.createdAt,
    })),
    ...recentInvites.map((inv) => ({
      id: `inv-${inv.id}`,
      category: 'invite',
      title: 'Lecturer invitation issued',
      description: `Onboarding invite for ${inv.fullName}`,
      actor: 'Department administration',
      reference: inv.email,
      status: inv.status,
      at: inv.createdAt,
    })),
    ...lecturers.slice(0, 8).map((l) => ({
      id: `lec-${l.id}`,
      category: 'lecturer',
      title: 'Lecturer account activity',
      description: `${l._count.uploads} material(s) in department repository`,
      actor: l.fullName,
      reference: l.email,
      status: l.accountStatus,
      at: l.lastActiveAt || l.updatedAt,
    })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 24);

  const activity = auditLog.map((e) => ({
    id: e.id,
    type: e.category === 'publish' ? 'upload' : e.category === 'invite' ? 'invite' : 'lecturer',
    label: e.category === 'publish' ? `${e.actor} published` : e.title,
    meta: e.description,
    at: e.at,
  }));

  return {
    stats: {
      lecturers: lecturerCount,
      courses: courseCount,
      publishedMaterials: publishedCount,
      totalDownloads,
      pendingVerification,
      studentEngagement: totalDownloads,
      engagementScore,
    },
    recentUploads: recentResources,
    activity,
    auditLog,
    recentLecturerActions: lecturers,
    policy: {
      lecturerPublishing: 'trusted',
      requiresApproval: false,
    },
  };
}

export async function listDepartmentLecturers(departmentId) {
  const lecturers = await prisma.user.findMany({
    where: { departmentId, role: 'LECTURER' },
    select: {
      id: true,
      fullName: true,
      email: true,
      profilePhotoUrl: true,
      staffId: true,
      accountStatus: true,
      departmentRole: true,
      canUpload: true,
      lastActiveAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { uploads: true } },
    },
    orderBy: { fullName: 'asc' },
  });

  const invitations = await listDepartmentInvitations(departmentId);
  const pendingInvites = invitations.filter((inv) => inv.status === 'PENDING');

  return { lecturers, pendingInvites, invitations };
}

export async function createLecturerDirect({
  departmentId,
  email,
  fullName,
  staffId,
  departmentRole,
  password,
  canUpload,
  courseIds,
  semester,
  accountStatus = 'ACTIVE',
}) {
  const normalized = email.trim().toLowerCase();
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      name: true,
      faculty: {
        select: {
          institutionId: true,
          institution: {
            select: {
              slug: true,
              name: true,
              shortName: true,
              tagline: true,
              logoUrl: true,
              bannerUrl: true,
              primaryColor: true,
              secondaryColor: true,
              logoPlacement: true,
            },
          },
        },
      },
    },
  });
  if (!dept?.faculty?.institutionId) {
    throw Object.assign(new Error('Department institution not found'), { status: 400 });
  }

  const exists = await prisma.user.findUnique({
    where: {
      institutionId_email: { institutionId: dept.faculty.institutionId, email: normalized },
    },
  });
  if (exists) throw Object.assign(new Error('Email already registered'), { status: 409 });

  const temporaryPassword = password || generateOneTimePassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const user = await prisma.user.create({
    data: {
      institutionId: dept.faculty.institutionId,
      email: normalized,
      passwordHash,
      fullName: fullName.trim(),
      role: 'LECTURER',
      departmentId,
      staffId: staffId?.trim() || null,
      departmentRole: departmentRole || 'LECTURER',
      canUpload: canUpload !== false,
      accountStatus,
      mustChangePassword: !password,
      passwordChangedAt: password ? new Date() : null,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      staffId: true,
      accountStatus: true,
      departmentRole: true,
    },
  });

  await syncLecturerCourses(user.id, courseIds, semester);

  const emailResult = await dispatchWelcomeEmail({
    email: normalized,
    fullName: user.fullName,
    departmentName: dept?.name || 'your department',
    temporaryPassword,
    institutionSlug: dept?.faculty?.institution?.slug,
    institutionName: dept?.faculty?.institution?.shortName || dept?.faculty?.institution?.name,
    branding: dept?.faculty?.institution,
  });

  return { user, temporaryPassword: !password ? temporaryPassword : undefined, emailSent: emailResult.sent };
}

export async function getDepartmentAnalytics(departmentId) {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [activeLecturers, uploads30, courses, resources] = await Promise.all([
    prisma.user.count({
      where: {
        departmentId,
        role: 'LECTURER',
        accountStatus: 'ACTIVE',
        OR: [{ lastActiveAt: { gte: since30 } }, { updatedAt: { gte: since30 } }],
      },
    }),
    prisma.resource.findMany({
      where: { course: { departmentId }, createdAt: { gte: since30 } },
      select: { createdAt: true, courseId: true },
    }),
    prisma.course.findMany({
      where: { departmentId },
      select: {
        id: true,
        code: true,
        title: true,
        _count: { select: { resources: true } },
      },
      orderBy: { resources: { _count: 'desc' } },
      take: 5,
    }),
    prisma.resource.groupBy({
      by: ['governanceStatus'],
      where: { course: { departmentId } },
      _count: true,
    }),
  ]);

  const uploadsByWeek = {};
  for (const u of uploads30) {
    const d = new Date(u.createdAt);
    const key = `${d.getFullYear()}-W${Math.ceil((d.getDate() + 1) / 7)}`;
    uploadsByWeek[key] = (uploadsByWeek[key] || 0) + 1;
  }

  const courseUploads = {};
  for (const u of uploads30) {
    courseUploads[u.courseId] = (courseUploads[u.courseId] || 0) + 1;
  }

  return {
    activeLecturers,
    uploadFrequency30d: uploads30.length,
    publicationTrend: Object.entries(uploadsByWeek).map(([period, count]) => ({ period, count })),
    topCourses: courses.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      resourceCount: c._count.resources,
      recentUploads: courseUploads[c.id] || 0,
    })),
    governanceBreakdown: resources.map((r) => ({
      status: r.governanceStatus,
      count: r._count,
    })),
    resourceGrowth: uploads30.length,
  };
}
