import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import {
  cancelLecturerInvitation,
  getInvitationLink,
  resendLecturerInvitation,
} from './lecturerInvites.js';
import { createLecturerInvite } from './department.js';

const prisma = new PrismaClient();

export function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function getDepartmentIds(facultyId) {
  const rows = await prisma.department.findMany({
    where: { facultyId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function getFacultyOverview(facultyId) {
  const departmentIds = await getDepartmentIds(facultyId);
  const deptCount = departmentIds.length;

  const [lecturerCount, activeLecturers, hodCount, courseCount, resources, suggestionsPending] =
    await Promise.all([
      prisma.user.count({
        where: { departmentId: { in: departmentIds }, role: 'LECTURER' },
      }),
      prisma.user.count({
        where: { departmentId: { in: departmentIds }, role: 'LECTURER', accountStatus: 'ACTIVE' },
      }),
      prisma.user.count({
        where: { departmentId: { in: departmentIds }, role: 'HOD' },
      }),
      prisma.course.count({ where: { departmentId: { in: departmentIds } } }),
      prisma.resource.findMany({
        where: { course: { departmentId: { in: departmentIds } } },
        select: { id: true, downloadCount: true, governanceStatus: true, createdAt: true, courseId: true },
      }),
      prisma.materialSuggestion.count({
        where: {
          status: 'PENDING',
          course: { departmentId: { in: departmentIds } },
        },
      }),
    ]);

  const liveResources = resources.filter((r) => r.governanceStatus !== 'ARCHIVED').length;
  const totalDownloads = resources.reduce((s, r) => s + r.downloadCount, 0);
  const approvedSuggestions = await prisma.materialSuggestion.count({
    where: { status: 'APPROVED', course: { departmentId: { in: departmentIds } } },
  });
  const totalSuggestions = await prisma.materialSuggestion.count({
    where: { course: { departmentId: { in: departmentIds } } },
  });

  const engagementScore = Math.min(
    100,
    Math.round(
      deptCount * 8 +
        activeLecturers * 10 +
        courseCount * 3 +
        liveResources * 2 +
        Math.log10(totalDownloads + 1) * 12
    )
  );

  const growthPct =
    resources.length > 0
      ? Math.min(
          99,
          Math.round(
            (resources.filter((r) => {
              const d = new Date(r.createdAt);
              const cutoff = new Date();
              cutoff.setDate(cutoff.getDate() - 30);
              return d >= cutoff;
            }).length /
              Math.max(liveResources, 1)) *
              100
          )
        )
      : 0;

  const auditLog = await buildFacultyAuditLog(facultyId, departmentIds, 24);
  const activity = auditLog.slice(0, 12).map((e) => ({
    id: e.id,
    type: e.category === 'publish' ? 'upload' : e.category === 'invite' ? 'invite' : e.category,
    label: e.title,
    meta: e.description,
    at: e.at,
  }));

  return {
    stats: {
      departments: deptCount,
      lecturers: lecturerCount,
      hods: hodCount,
      courses: courseCount,
      liveResources,
      totalDownloads,
      pendingSuggestions: suggestionsPending,
      suggestionApprovalRate:
        totalSuggestions > 0 ? Math.round((approvedSuggestions / totalSuggestions) * 100) : null,
      engagementScore,
      growthPct,
    },
    activity,
    auditLog,
    policy: {
      publishing: 'lecturer_trusted',
      catalog: 'organic',
      facultyRole: 'structure_and_visibility',
    },
  };
}

export async function buildFacultyAuditLog(facultyId, departmentIds, take = 40) {
  if (!departmentIds.length) return [];

  const [resources, invites, suggestions, depts] = await Promise.all([
    prisma.resource.findMany({
      where: { course: { departmentId: { in: departmentIds } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        kind: true,
        createdAt: true,
        governanceStatus: true,
        uploadedBy: { select: { fullName: true } },
        course: { select: { code: true, title: true, department: { select: { name: true } } } },
      },
    }),
    prisma.lecturerInvite.findMany({
      where: { departmentId: { in: departmentIds } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        createdAt: true,
        department: { select: { name: true } },
        departmentRole: true,
      },
    }),
    prisma.materialSuggestion.findMany({
      where: { course: { departmentId: { in: departmentIds } } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        student: { select: { fullName: true } },
        course: { select: { code: true, department: { select: { name: true } } } },
      },
    }),
    prisma.department.findMany({
      where: { facultyId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, name: true, createdAt: true },
    }),
  ]);

  const kindLabel = (k) =>
    String(k || 'OTHER')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const entries = [
    ...resources.map((r) => ({
      id: `res-${r.id}`,
      category: 'publish',
      title: `${r.course.department.name} — resource published`,
      description: `${r.title} (${r.course.code}) · ${r.uploadedBy.fullName}`,
      actor: r.uploadedBy.fullName,
      reference: kindLabel(r.kind),
      status: r.governanceStatus,
      at: r.createdAt,
    })),
    ...invites.map((inv) => ({
      id: `inv-${inv.id}`,
      category: 'invite',
      title: `${inv.department.name} — ${inv.departmentRole === 'HOD' ? 'HOD' : 'Lecturer'} invitation`,
      description: inv.fullName,
      actor: 'Faculty governance',
      reference: inv.email,
      status: inv.status,
      at: inv.createdAt,
    })),
    ...suggestions.map((s) => ({
      id: `sug-${s.id}`,
      category: 'suggestion',
      title: `${s.course.department.name} — student contribution`,
      description: `${s.title} (${s.course.code}) · ${s.student.fullName}`,
      actor: s.student.fullName,
      reference: s.status,
      status: s.status,
      at: s.createdAt,
    })),
    ...depts.map((d) => ({
      id: `dept-${d.id}`,
      category: 'governance',
      title: 'Academic unit established',
      description: d.name,
      actor: 'Faculty administration',
      reference: '',
      status: 'ACTIVE',
      at: d.createdAt,
    })),
  ];

  return entries.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, take);
}

export async function listFacultyDepartments(facultyId) {
  const departments = await prisma.department.findMany({
    where: { facultyId },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          courses: true,
          users: true,
        },
      },
    },
  });

  const ids = departments.map((d) => d.id);
  const [lecturerCounts, resourceCounts, hods] = await Promise.all([
    prisma.user.groupBy({
      by: ['departmentId'],
      where: { departmentId: { in: ids }, role: 'LECTURER' },
      _count: { id: true },
    }),
    prisma.resource.groupBy({
      by: ['courseId'],
      where: { course: { departmentId: { in: ids } }, governanceStatus: { not: 'ARCHIVED' } },
      _count: { id: true },
    }),
    prisma.user.findMany({
      where: { departmentId: { in: ids }, role: 'HOD' },
      select: { id: true, fullName: true, email: true, departmentId: true, accountStatus: true },
    }),
  ]);

  const courses = await prisma.course.findMany({
    where: { departmentId: { in: ids } },
    select: { id: true, departmentId: true },
  });
  const courseDept = new Map(courses.map((c) => [c.id, c.departmentId]));
  const resPerDept = new Map();
  for (const r of resourceCounts) {
    const deptId = courseDept.get(r.courseId);
    if (deptId) resPerDept.set(deptId, (resPerDept.get(deptId) ?? 0) + r._count.id);
  }

  const lecMap = new Map(lecturerCounts.map((l) => [l.departmentId, l._count.id]));
  const hodMap = new Map(hods.map((h) => [h.departmentId, h]));

  const pendingHodInvites = await prisma.lecturerInvite.findMany({
    where: {
      departmentId: { in: ids },
      status: 'PENDING',
      departmentRole: 'HOD',
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      departmentId: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  const pendingHodMap = new Map();
  for (const inv of pendingHodInvites) {
    if (!pendingHodMap.has(inv.departmentId)) pendingHodMap.set(inv.departmentId, inv);
  }

  return departments.map((d) => ({
    id: d.id,
    name: d.name,
    createdAt: d.createdAt,
    courseCount: d._count.courses,
    userCount: d._count.users,
    staffCount: lecMap.get(d.id) ?? 0,
    lecturerCount: lecMap.get(d.id) ?? 0,
    resourceCount: resPerDept.get(d.id) ?? 0,
    hod: hodMap.get(d.id) ?? null,
    pendingHodInvite: pendingHodMap.get(d.id) ?? null,
  }));
}

/** Active institution staff who can be assigned as HOD of a faculty department. */
export async function listHodAssignCandidates(facultyId) {
  const faculty = await prisma.faculty.findUnique({
    where: { id: facultyId },
    select: { institutionId: true },
  });
  if (!faculty) return [];

  return prisma.user.findMany({
    where: {
      institutionId: faculty.institutionId,
      role: { in: ['LECTURER', 'HOD'] },
      accountStatus: 'ACTIVE',
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: { fullName: 'asc' },
  });
}

export async function listFacultyPeople(facultyId) {
  const departmentIds = await getDepartmentIds(facultyId);
  const users = await prisma.user.findMany({
    where: {
      departmentId: { in: departmentIds },
      role: { in: ['HOD', 'LECTURER', 'DEPARTMENT_ADMIN'] },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      departmentRole: true,
      accountStatus: true,
      staffId: true,
      profilePhotoUrl: true,
      lastActiveAt: true,
      updatedAt: true,
      department: { select: { id: true, name: true } },
      _count: { select: { uploads: true } },
    },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  });
  return users;
}

export async function listFacultyCatalog(facultyId, departmentFilter) {
  const departmentIds = await getDepartmentIds(facultyId);
  const filterIds = departmentFilter
    ? departmentIds.filter((id) => id === departmentFilter)
    : departmentIds;

  const courses = await prisma.course.findMany({
    where: { departmentId: { in: filterIds } },
    include: {
      department: { select: { id: true, name: true } },
      resources: {
        select: { uploadedBy: { select: { id: true, fullName: true } } },
      },
      _count: { select: { resources: true } },
    },
    orderBy: [{ department: { name: 'asc' } }, { code: 'asc' }],
  });

  return courses.map((c) => {
    const publishers = new Map();
    for (const r of c.resources) {
      publishers.set(r.uploadedBy.id, r.uploadedBy.fullName);
    }
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      department: c.department,
      resourceCount: c._count.resources,
      publishers: [...publishers.values()],
    };
  });
}

export async function getFacultyAnalytics(facultyId) {
  const departmentIds = await getDepartmentIds(facultyId);
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [byDept, resources30, suggestions] = await Promise.all([
    prisma.department.findMany({
      where: { facultyId },
      select: {
        id: true,
        name: true,
        courses: {
          select: {
            _count: { select: { resources: true } },
          },
        },
      },
    }),
    prisma.resource.count({
      where: {
        course: { departmentId: { in: departmentIds } },
        createdAt: { gte: since },
      },
    }),
    prisma.materialSuggestion.groupBy({
      by: ['status'],
      where: { course: { departmentId: { in: departmentIds } } },
      _count: { id: true },
    }),
  ]);

  const departmentGrowth = byDept.map((d) => ({
    id: d.id,
    name: d.name,
    resourceCount: d.courses.reduce((s, c) => s + c._count.resources, 0),
  }));

  const topCourses = await prisma.course.findMany({
    where: { departmentId: { in: departmentIds } },
    select: {
      id: true,
      code: true,
      title: true,
      department: { select: { name: true } },
      _count: { select: { resources: true } },
    },
    orderBy: { resources: { _count: 'desc' } },
    take: 8,
  });

  return {
    uploads30d: resources30,
    departmentGrowth,
    topCourses: topCourses.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      departmentName: c.department.name,
      resourceCount: c._count.resources,
    })),
    suggestionBreakdown: suggestions.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
  };
}

export async function assignDepartmentHod(departmentId, facultyId, hodUserId) {
  const dept = await prisma.department.findFirst({
    where: { id: departmentId, facultyId },
    select: { id: true, name: true, faculty: { select: { institutionId: true } } },
  });
  if (!dept) {
    const err = new Error('Department not found in your faculty');
    err.status = 404;
    throw err;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: hodUserId,
      institutionId: dept.faculty.institutionId,
      role: { in: ['LECTURER', 'HOD'] },
      accountStatus: 'ACTIVE',
    },
    select: { id: true, fullName: true, email: true, role: true, departmentId: true },
  });
  if (!user) {
    const err = new Error('Select an active lecturer or HOD from your institution');
    err.status = 400;
    throw err;
  }

  await prisma.lecturerInvite.updateMany({
    where: {
      departmentId,
      departmentRole: 'HOD',
      status: 'PENDING',
    },
    data: { status: 'CANCELLED' },
  });

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { departmentId, role: 'HOD', id: { not: hodUserId } },
      data: { role: 'LECTURER', departmentRole: 'LECTURER' },
    }),
    prisma.user.update({
      where: { id: hodUserId },
      data: {
        departmentId,
        role: 'HOD',
        departmentRole: 'HOD',
        accountStatus: 'ACTIVE',
      },
    }),
  ]);

  const assigned = await prisma.user.findUnique({
    where: { id: hodUserId },
    select: { id: true, fullName: true, email: true, role: true, departmentId: true },
  });

  return {
    department: { id: dept.id, name: dept.name },
    hod: assigned,
    message: `${assigned.fullName} is now Head of Department for ${dept.name}.`,
  };
}

export async function createHodInvite({
  facultyId,
  departmentId,
  invitedById,
  email,
  fullName,
  staffId,
}) {
  const dept = await prisma.department.findFirst({
    where: { id: departmentId, facultyId },
  });
  if (!dept) {
    const err = new Error('Department not found');
    err.status = 404;
    throw err;
  }

  const faculty = await prisma.faculty.findUnique({
    where: { id: facultyId },
    select: { institutionId: true },
  });
  if (!faculty) {
    const err = new Error('Faculty not found');
    err.status = 404;
    throw err;
  }

  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: {
      institutionId_email: { institutionId: faculty.institutionId, email: normalized },
    },
  });
  if (existing) {
    const err = new Error('Email already registered — assign existing user instead');
    err.status = 409;
    throw err;
  }

  const result = await createLecturerInvite({
    departmentId,
    invitedById,
    email: normalized,
    fullName,
    staffId,
    departmentRole: 'HOD',
    canUpload: true,
    courseIds: [],
  });

  return {
    invite: result.invite,
    inviteUrl: result.inviteUrl,
    activationUrl: result.activationUrl,
    devActivationUrl: result.devActivationUrl,
    emailSent: result.emailSent,
    emailError: result.emailError,
  };
}

async function findFacultyPerson(facultyId, userId) {
  const departmentIds = await getDepartmentIds(facultyId);
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      departmentId: { in: departmentIds },
      role: { in: ['HOD', 'LECTURER', 'DEPARTMENT_ADMIN'] },
    },
  });
  if (!user) {
    const err = new Error('Person not found in this faculty');
    err.status = 404;
    throw err;
  }
  return user;
}

async function findFacultyPendingInvite(facultyId, inviteId) {
  const invite = await prisma.lecturerInvite.findFirst({
    where: {
      id: inviteId,
      status: 'PENDING',
      department: { facultyId },
    },
    include: { department: { select: { id: true, name: true } } },
  });
  if (!invite) {
    const err = new Error('Pending invitation not found');
    err.status = 404;
    throw err;
  }
  return invite;
}

export async function updateFacultyPersonStatus(facultyId, userId, accountStatus) {
  const user = await findFacultyPerson(facultyId, userId);
  if (!['ACTIVE', 'SUSPENDED'].includes(accountStatus)) {
    const err = new Error('accountStatus must be ACTIVE or SUSPENDED');
    err.status = 400;
    throw err;
  }
  return prisma.user.update({
    where: { id: user.id },
    data: { accountStatus },
    select: {
      id: true,
      fullName: true,
      email: true,
      accountStatus: true,
      role: true,
      department: { select: { name: true } },
    },
  });
}

export async function resendFacultyPersonInvite(facultyId, inviteId) {
  const invite = await findFacultyPendingInvite(facultyId, inviteId);
  return resendLecturerInvitation(inviteId, invite.departmentId);
}

export async function resendFacultyPersonUserInvite(facultyId, userId, invitedById) {
  const user = await findFacultyPerson(facultyId, userId);
  const result = await createLecturerInvite({
    departmentId: user.departmentId,
    invitedById,
    email: user.email,
    fullName: user.fullName,
    staffId: user.staffId,
    departmentRole: user.departmentRole,
    canUpload: user.canUpload,
    allowExisting: true,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { accountStatus: 'PENDING' },
  });

  return {
    inviteUrl: result.inviteUrl,
    activationUrl: result.activationUrl,
    devActivationUrl: result.devActivationUrl,
    emailSent: result.emailSent,
    emailError: result.emailError,
  };
}

export async function getFacultyPersonInviteLink(facultyId, inviteId) {
  const invite = await findFacultyPendingInvite(facultyId, inviteId);
  return getInvitationLink(inviteId, invite.departmentId);
}

export async function revokeFacultyPersonInvite(facultyId, inviteId) {
  const invite = await findFacultyPendingInvite(facultyId, inviteId);
  return cancelLecturerInvitation(inviteId, invite.departmentId);
}
