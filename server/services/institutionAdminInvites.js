import { PrismaClient } from '@prisma/client';
import { INSTITUTION_EMAIL_SELECT } from './email/emailBranding.js';
import { userEmailWhere } from './tenantScope.js';
import {
  INVITE_STATUS,
  buildInvitationUrl,
  generateInvitationToken,
  invitationPath,
  resolveInviteLifecycle,
} from './lecturerInvites.js';
import { sendLecturerInvitationEmail } from './email.js';
import { logPlatformAudit } from './platformAudit.js';

const prisma = new PrismaClient();

export const INSTITUTION_ADMIN_ROLE = 'INSTITUTION_ADMIN';
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function inviteDeliveryMeta(token, institutionSlug, emailResult) {
  const inviteUrl = invitationPath(token, institutionSlug);
  const activationUrl = buildInvitationUrl(token, institutionSlug);
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    inviteUrl,
    activationUrl,
    emailSent: emailResult?.sent === true,
    emailError: emailResult?.error || null,
    outboxFile: emailResult?.outboxFile || null,
    ...(isDev ? { devActivationUrl: activationUrl } : {}),
  };
}

const inviteInclude = {
  institution: { select: INSTITUTION_EMAIL_SELECT },
  invitedBy: { select: { fullName: true } },
};

export function displayInvitationStatus(invite, admin) {
  if (admin && !admin.mustChangePassword) {
    return 'ACCEPTED';
  }
  if (!invite) {
    if (admin?.mustChangePassword) return 'PENDING';
    return admin ? 'ACCEPTED' : 'PENDING';
  }

  const lifecycle = resolveInviteLifecycle(invite);
  if (lifecycle === INVITE_STATUS.ACCEPTED) return 'ACCEPTED';
  if (lifecycle === INVITE_STATUS.EXPIRED) return 'EXPIRED';
  if (lifecycle === INVITE_STATUS.CANCELLED) return 'REVOKED';
  if (lifecycle === INVITE_STATUS.PENDING && (invite.resentCount ?? 0) > 0) return 'RESENT';
  return 'PENDING';
}

async function dispatchInstitutionAdminEmail(invite, token) {
  const institution = invite.institution;
  const slug = institution?.slug;
  try {
    return await sendLecturerInvitationEmail({
      to: invite.email,
      fullName: invite.fullName,
      departmentName: institution?.name || 'Institution administration',
      roleLabel: 'Institution Administrator',
      invitedBy: invite.invitedBy?.fullName || 'ULA Platform Operations',
      invitationUrl: buildInvitationUrl(token, slug),
      expiresAt: invite.expiresAt,
      institutionName: institution?.shortName || institution?.name,
      branding: institution,
    });
  } catch (e) {
    console.error('[ula-email] Institution admin invitation failed:', e.message);
    return { sent: false, error: e.message };
  }
}

export async function getLatestInstitutionAdminInvite(institutionId) {
  return prisma.lecturerInvite.findFirst({
    where: { institutionId, departmentRole: INSTITUTION_ADMIN_ROLE },
    orderBy: { createdAt: 'desc' },
    include: inviteInclude,
  });
}

export async function createInstitutionAdminInvite({
  institutionId,
  email,
  fullName,
  actorId = null,
  allowExistingAdmin = false,
}) {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: INSTITUTION_EMAIL_SELECT,
  });
  if (!institution) throw Object.assign(new Error('Institution not found'), { status: 404 });

  const normalized = email.trim().toLowerCase();
  const name = fullName.trim();
  if (!normalized || !name) {
    throw Object.assign(new Error('email and fullName are required'), { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: userEmailWhere(institutionId, normalized),
  });
  if (existingUser?.role === 'INSTITUTION_ADMIN' && !existingUser.mustChangePassword && !allowExistingAdmin) {
    throw Object.assign(new Error('Institution administrator has already accepted their invitation'), {
      status: 409,
    });
  }
  if (existingUser && existingUser.role !== 'INSTITUTION_ADMIN') {
    throw Object.assign(new Error('Email already registered with a different role'), { status: 409 });
  }

  await prisma.lecturerInvite.updateMany({
    where: {
      institutionId,
      departmentRole: INSTITUTION_ADMIN_ROLE,
      status: INVITE_STATUS.PENDING,
    },
    data: { status: INVITE_STATUS.CANCELLED },
  });

  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invite = await prisma.lecturerInvite.create({
    data: {
      institutionId,
      email: normalized,
      fullName: name,
      departmentRole: INSTITUTION_ADMIN_ROLE,
      departmentId: null,
      invitedById: null,
      token,
      expiresAt,
    },
    include: inviteInclude,
  });

  const emailResult = await dispatchInstitutionAdminEmail(invite, token);

  if (actorId) {
    await logPlatformAudit({
      action: 'INSTITUTION_ADMIN_ASSIGNED',
      actorId,
      institutionId,
      detail: `${institution.slug}:${normalized}`,
    });
  }

  return {
    invite,
    invitationStatus: 'PENDING',
    ...inviteDeliveryMeta(token, institution.slug, emailResult),
  };
}

export async function resendInstitutionAdminInvite(institutionId, actorId = null) {
  const invite = await getLatestInstitutionAdminInvite(institutionId);
  if (!invite) {
    throw Object.assign(new Error('No institution administrator invitation found'), { status: 404 });
  }
  if (invite.status === INVITE_STATUS.ACCEPTED) {
    throw Object.assign(new Error('Invitation already accepted'), { status: 409 });
  }
  if (invite.status === INVITE_STATUS.CANCELLED) {
    throw Object.assign(new Error('Invitation was revoked — create a new invitation'), { status: 409 });
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const updated = await prisma.lecturerInvite.update({
    where: { id: invite.id },
    data: {
      status: INVITE_STATUS.PENDING,
      expiresAt,
      resentCount: { increment: 1 },
    },
    include: inviteInclude,
  });

  const emailResult = await dispatchInstitutionAdminEmail(updated, updated.token);

  if (actorId) {
    await logPlatformAudit({
      action: 'INSTITUTION_ADMIN_INVITE_RESENT',
      actorId,
      institutionId,
      detail: invite.institution?.slug ?? institutionId,
    });
  }

  return {
    invite: updated,
    invitationStatus: 'RESENT',
    ...inviteDeliveryMeta(updated.token, updated.institution?.slug, emailResult),
  };
}

export async function getInstitutionAdminInviteLink(institutionId) {
  const invite = await getLatestInstitutionAdminInvite(institutionId);
  if (!invite) throw Object.assign(new Error('No invitation found'), { status: 404 });
  if (resolveInviteLifecycle(invite) !== INVITE_STATUS.PENDING) {
    throw Object.assign(new Error('Only pending invitations have an active link'), { status: 409 });
  }
  return inviteDeliveryMeta(invite.token, invite.institution?.slug, null);
}

export async function revokeInstitutionAdminInvite(institutionId, actorId = null) {
  const invite = await prisma.lecturerInvite.findFirst({
    where: {
      institutionId,
      departmentRole: INSTITUTION_ADMIN_ROLE,
      status: INVITE_STATUS.PENDING,
    },
    include: { institution: { select: { slug: true } } },
  });
  if (!invite) throw Object.assign(new Error('Pending invitation not found'), { status: 404 });

  await prisma.lecturerInvite.update({
    where: { id: invite.id },
    data: { status: INVITE_STATUS.CANCELLED },
  });

  if (actorId) {
    await logPlatformAudit({
      action: 'INSTITUTION_ADMIN_INVITE_REVOKED',
      actorId,
      institutionId,
      detail: invite.institution?.slug ?? institutionId,
    });
  }

  return { ok: true, invitationStatus: 'REVOKED' };
}

export function mapInviteSummary(invite, admin) {
  const status = displayInvitationStatus(invite, admin);
  return {
    id: invite?.id ?? null,
    status,
    email: invite?.email ?? admin?.email ?? null,
    expiresAt: invite?.expiresAt ?? null,
    resentCount: invite?.resentCount ?? 0,
    canCopyLink: status === 'PENDING' || status === 'RESENT',
    canResend: ['PENDING', 'RESENT', 'EXPIRED', 'REVOKED'].includes(status) || (admin?.mustChangePassword && !invite),
    canRevoke: status === 'PENDING' || status === 'RESENT',
  };
}
