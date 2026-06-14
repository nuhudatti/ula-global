import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logPlatformAudit } from './platformAudit.js';
import { getAppPublicUrl } from './email.js';
import { getInstitutionJwtSecret, isInstitutionJwtConfigured } from './jwtSecrets.js';
import {
  createInstitutionAdminInvite,
  getLatestInstitutionAdminInvite,
  getInstitutionAdminInviteLink,
  mapInviteSummary,
  resendInstitutionAdminInvite,
  revokeInstitutionAdminInvite,
} from './institutionAdminInvites.js';

const prisma = new PrismaClient();

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export const RESERVED_SLUGS = new Set([
  'platform', 'api', 'admin', 'login', 'register', 'lecturer', 'department', 'faculty',
  'settings', 'dashboard', 'contribute', 'student', 'assignments', 'uploads', 'health',
]);

export function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

export function validateSlug(slug) {
  const s = normalizeSlug(slug);
  if (!s || s.length < 2) return 'Slug must be at least 2 characters';
  if (!SLUG_RE.test(s)) return 'Slug may only use lowercase letters, numbers, and hyphens';
  if (RESERVED_SLUGS.has(s)) return 'This slug is reserved';
  return null;
}

export async function resolveTenantBySlug(slug) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  const tenant = await prisma.institution.findUnique({ where: { slug: normalized } });
  if (!tenant || tenant.status === 'ARCHIVED') return null;
  return tenant;
}

/** Header, path param, query param, or signed-in user's institution — for API tenant isolation. */
export async function resolveTenantSlugFromRequest(req) {
  const headerSlug = req.headers['x-institution-slug'];
  const paramSlug = req.params?.tenantSlug;
  const querySlug = req.query?.institution || req.query?.tenant;
  const slug = normalizeSlug(headerSlug || paramSlug || querySlug || '');
  if (slug) return slug;

  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !isInstitutionJwtConfigured()) return '';

  try {
    const payload = jwt.verify(token, getInstitutionJwtSecret());
    const institutionId = payload.institutionId || null;
    if (!institutionId) return '';
    const row = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { slug: true, status: true },
    });
    if (!row || row.status === 'ARCHIVED') return '';
    return normalizeSlug(row.slug);
  } catch {
    return '';
  }
}

/** Authenticated users always operate in their own institution tenant. */
export async function resolveTenantForUser(user, currentTenant) {
  if (!user?.institutionId) return currentTenant;
  if (currentTenant?.id === user.institutionId) return currentTenant;
  return prisma.institution.findUnique({ where: { id: user.institutionId } });
}

export async function getDefaultTenant() {
  const slug = process.env.DEFAULT_INSTITUTION_SLUG || 'ibbul';
  return resolveTenantBySlug(slug);
}

const adminUserSelect = {
  id: true,
  email: true,
  fullName: true,
  accountStatus: true,
  mustChangePassword: true,
  lastActiveAt: true,
  createdAt: true,
};

async function loadAdminInvites(institutionIds) {
  if (!institutionIds.length) return new Map();
  const invites = await prisma.lecturerInvite.findMany({
    where: {
      institutionId: { in: institutionIds },
      departmentRole: 'INSTITUTION_ADMIN',
    },
    orderBy: { createdAt: 'desc' },
    include: {
      institution: { select: { slug: true } },
      invitedBy: { select: { fullName: true } },
    },
  });
  const map = new Map();
  for (const invite of invites) {
    if (!map.has(invite.institutionId)) map.set(invite.institutionId, invite);
  }
  return map;
}

function mapTenantRow(row, invite = null) {
  const admin = row.users?.[0] ?? null;
  const loginUrl = `${getAppPublicUrl()}/${row.slug}/login`;
  const workspaceUrl = `${getAppPublicUrl()}/${row.slug}`;
  const adminUrl = `${getAppPublicUrl()}/${row.slug}/admin`;
  const invitation = mapInviteSummary(invite, admin);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    status: row.status,
    contactEmail: row.contactEmail,
    website: row.website,
    createdAt: row.createdAt,
    loginUrl,
    workspaceUrl,
    adminUrl,
    _count: row._count,
    admin: admin
      ? {
          id: admin.id,
          email: admin.email,
          fullName: admin.fullName,
          accountStatus: admin.accountStatus,
          mustChangePassword: admin.mustChangePassword,
          lastActiveAt: admin.lastActiveAt,
          createdAt: admin.createdAt,
          activated: !admin.mustChangePassword,
        }
      : invite
        ? {
            id: null,
            email: invite.email,
            fullName: invite.fullName,
            accountStatus: 'PENDING',
            mustChangePassword: true,
            lastActiveAt: null,
            createdAt: invite.createdAt,
            activated: false,
          }
        : null,
    invitation,
    lastActivityAt: admin?.lastActiveAt ?? null,
  };
}

export async function listTenants({ status } = {}) {
  const rows = await prisma.institution.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, faculties: true } },
      users: {
        where: { role: 'INSTITUTION_ADMIN' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: adminUserSelect,
      },
    },
  });
  const inviteMap = await loadAdminInvites(rows.map((r) => r.id));
  return rows.map((row) => mapTenantRow(row, inviteMap.get(row.id) ?? null));
}

export async function getTenantDetail(id) {
  const row = await prisma.institution.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, faculties: true } },
      users: {
        where: { role: 'INSTITUTION_ADMIN' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: adminUserSelect,
      },
    },
  });
  if (!row) {
    const err = new Error('Institution not found');
    err.status = 404;
    throw err;
  }
  const invite = await getLatestInstitutionAdminInvite(id);
  const stats = await getTenantStats(id);
  return { ...mapTenantRow(row, invite), stats };
}

export async function getTenantStats(institutionId) {
  const [users, activeUsers, resources, submissions, faculties] = await Promise.all([
    prisma.user.count({ where: { institutionId } }),
    prisma.user.count({ where: { institutionId, accountStatus: 'ACTIVE' } }),
    prisma.resource.count({
      where: { course: { department: { faculty: { institutionId } } } },
    }),
    prisma.assignmentSubmission.count({
      where: { assignment: { course: { department: { faculty: { institutionId } } } } },
    }),
    prisma.faculty.count({ where: { institutionId } }),
  ]);

  const storage = await prisma.resource.aggregate({
    where: { course: { department: { faculty: { institutionId } } } },
    _sum: { sizeBytes: true },
  });

  return {
    users,
    activeUsers,
    resources,
    submissions,
    faculties,
    storageBytes: storage._sum.sizeBytes || 0,
    health: 'healthy',
  };
}

export async function provisionInstitution(input, actorId) {
  const slugErr = validateSlug(input.slug);
  if (slugErr) {
    const err = new Error(slugErr);
    err.status = 400;
    throw err;
  }

  const slug = normalizeSlug(input.slug);
  const exists = await prisma.institution.findUnique({ where: { slug } });
  if (exists) {
    const err = new Error('Institution slug already exists');
    err.status = 409;
    throw err;
  }

  if (!input.name?.trim() || !input.shortName?.trim() || !input.adminEmail?.trim()) {
    const err = new Error('Institution name, short name, and admin email are required');
    err.status = 400;
    throw err;
  }

  const adminEmail = input.adminEmail.trim().toLowerCase();
  const adminName = input.adminName?.trim() || `${input.shortName.trim()} Administrator`;

  const institution = await prisma.institution.create({
    data: {
      slug,
      name: input.name.trim(),
      shortName: input.shortName.trim(),
      tagline: input.tagline?.trim() || 'Academic Learning Platform',
      contactEmail: input.contactEmail?.trim() || adminEmail,
      website: input.website?.trim() || null,
      primaryColor: input.primaryColor || '#14532d',
      secondaryColor: input.secondaryColor || '#166534',
      logoUrl: input.logoUrl || null,
      status: 'ACTIVE',
    },
  });

  const inviteResult = await createInstitutionAdminInvite({
    institutionId: institution.id,
    email: adminEmail,
    fullName: adminName,
    actorId,
  });

  await logPlatformAudit({
    action: 'INSTITUTION_CREATED',
    actorId,
    institutionId: institution.id,
    detail: `${institution.slug}:${institution.name}`,
  });

  const loginUrl = `${getAppPublicUrl()}/${institution.slug}/login`;

  return {
    institution: mapTenantRow(
      {
        ...institution,
        _count: { users: 0, faculties: 0 },
        users: [],
      },
      inviteResult.invite,
    ),
    adminEmail,
    adminName,
    loginUrl,
    invitationUrl: inviteResult.activationUrl,
    inviteUrl: inviteResult.inviteUrl,
    emailSent: inviteResult.emailSent === true,
    emailMode: inviteResult.emailSent ? 'smtp' : 'outbox',
    devActivationUrl: inviteResult.devActivationUrl,
    invitationStatus: inviteResult.invitationStatus,
  };
}

/** Resend institution administrator invitation (replaces legacy credential resend). */
export async function resendInstitutionAdminInvitation(institutionId, actorId) {
  const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) {
    const err = new Error('Institution not found');
    err.status = 404;
    throw err;
  }
  if (institution.status === 'ARCHIVED') {
    const err = new Error('Cannot resend invitation for an archived institution');
    err.status = 400;
    throw err;
  }

  let inviteResult;
  const existingInvite = await getLatestInstitutionAdminInvite(institutionId);
  const admin = await prisma.user.findFirst({
    where: { institutionId, role: 'INSTITUTION_ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: adminUserSelect,
  });

  if (!existingInvite) {
    if (!admin) {
      const err = new Error('No institution administrator invitation or account found');
      err.status = 404;
      throw err;
    }
    inviteResult = await createInstitutionAdminInvite({
      institutionId,
      email: admin.email,
      fullName: admin.fullName,
      actorId,
      allowExistingAdmin: admin.mustChangePassword,
    });
  } else {
    inviteResult = await resendInstitutionAdminInvite(institutionId, actorId);
  }

  const loginUrl = `${getAppPublicUrl()}/${institution.slug}/login`;

  return {
    institution: mapTenantRow(
      {
        ...institution,
        _count: { users: admin ? 1 : 0, faculties: 0 },
        users: admin ? [admin] : [],
      },
      inviteResult.invite,
    ),
    adminEmail: inviteResult.invite.email,
    adminName: inviteResult.invite.fullName,
    loginUrl,
    invitationUrl: inviteResult.activationUrl,
    inviteUrl: inviteResult.inviteUrl,
    emailSent: inviteResult.emailSent === true,
    emailMode: inviteResult.emailSent ? 'smtp' : 'outbox',
    devActivationUrl: inviteResult.devActivationUrl,
    invitationStatus: inviteResult.invitationStatus,
  };
}

export async function copyInstitutionAdminInvitationLink(institutionId) {
  return getInstitutionAdminInviteLink(institutionId);
}

export async function revokeInstitutionAdminInvitation(institutionId, actorId) {
  return revokeInstitutionAdminInvite(institutionId, actorId);
}

/** @deprecated Use resendInstitutionAdminInvitation */
export const resendInstitutionAdminCredentials = resendInstitutionAdminInvitation;

export async function updateInstitutionStatus(id, status, actorId) {
  const valid = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'];
  if (!valid.includes(status)) {
    const err = new Error('Invalid status');
    err.status = 400;
    throw err;
  }

  const institution = await prisma.institution.update({
    where: { id },
    data: { status },
  });

  const action =
    status === 'SUSPENDED'
      ? 'INSTITUTION_SUSPENDED'
      : status === 'ACTIVE'
        ? 'INSTITUTION_REACTIVATED'
        : 'INSTITUTION_ARCHIVED';

  await logPlatformAudit({
    action,
    actorId,
    institutionId: institution.id,
    detail: institution.slug,
  });

  return institution;
}
