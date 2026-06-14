import { PrismaClient } from '@prisma/client';
import { INSTITUTION_EMAIL_SELECT } from './email/emailBranding.js';
import { userEmailWhere } from './tenantScope.js';
import { ARM_INVITE_ROLE } from '../constants/academicRoles.js';
import {
  INVITE_STATUS,
  buildInvitationUrl,
  generateInvitationToken,
  invitationPath,
  resolveInviteLifecycle,
} from './lecturerInvites.js';
import { sendLecturerInvitationEmail } from './email.js';

const prisma = new PrismaClient();

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

export function displayArmInvitationStatus(invite, user) {
  if (user && user.accountStatus === 'ACTIVE' && !user.mustChangePassword) return 'ACCEPTED';
  if (!invite) return user ? 'ACCEPTED' : 'PENDING';
  const lifecycle = resolveInviteLifecycle(invite);
  if (lifecycle === INVITE_STATUS.ACCEPTED) return 'ACCEPTED';
  if (lifecycle === INVITE_STATUS.EXPIRED) return 'EXPIRED';
  if (lifecycle === INVITE_STATUS.CANCELLED) return 'REVOKED';
  if (lifecycle === INVITE_STATUS.PENDING && (invite.resentCount ?? 0) > 0) return 'RESENT';
  return 'PENDING';
}

async function dispatchArmEmail(invite, token) {
  const institution = invite.institution;
  const slug = institution?.slug;
  try {
    return await sendLecturerInvitationEmail({
      to: invite.email,
      fullName: invite.fullName,
      departmentName: institution?.name || 'Academic resources',
      roleLabel: 'Academic Resources Manager',
      invitedBy: invite.invitedBy?.fullName || 'Institution Administrator',
      invitationUrl: buildInvitationUrl(token, slug),
      expiresAt: invite.expiresAt,
      institutionName: institution?.shortName || institution?.name,
      branding: institution,
    });
  } catch (e) {
    console.error('[ula-email] ARM invitation failed:', e.message);
    return { sent: false, error: e.message };
  }
}

const inviteInclude = {
  institution: { select: INSTITUTION_EMAIL_SELECT },
  invitedBy: { select: { fullName: true } },
};

export async function listArmManagers(institutionId) {
  const [users, invites] = await Promise.all([
    prisma.user.findMany({
      where: { institutionId, role: ARM_INVITE_ROLE },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        accountStatus: true,
        mustChangePassword: true,
        lastActiveAt: true,
        createdAt: true,
      },
    }),
    prisma.lecturerInvite.findMany({
      where: { institutionId, departmentRole: ARM_INVITE_ROLE },
      orderBy: { createdAt: 'desc' },
      include: inviteInclude,
    }),
  ]);

  const inviteByEmail = new Map();
  for (const inv of invites) {
    if (!inviteByEmail.has(inv.email)) inviteByEmail.set(inv.email, inv);
  }

  const active = users.map((user) => {
    const invite = inviteByEmail.get(user.email) ?? null;
    return {
      type: 'active',
      user,
      invite,
      invitationStatus: displayArmInvitationStatus(invite, user),
    };
  });

  const pendingOnly = invites
    .filter((inv) => !users.some((u) => u.email === inv.email))
    .filter((inv, idx, arr) => arr.findIndex((x) => x.email === inv.email) === idx)
    .map((invite) => ({
      type: 'pending',
      user: null,
      invite,
      invitationStatus: displayArmInvitationStatus(invite, null),
    }));

  return [...active, ...pendingOnly];
}

export async function createArmInvite({ institutionId, email, fullName, invitedById }) {
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

  const existing = await prisma.user.findUnique({
    where: userEmailWhere(institutionId, normalized),
  });
  if (existing?.role === ARM_INVITE_ROLE && existing.accountStatus === 'ACTIVE' && !existing.mustChangePassword) {
    throw Object.assign(new Error('This person is already an active Academic Resources Manager'), { status: 409 });
  }
  if (existing && existing.role !== ARM_INVITE_ROLE && existing.role !== 'STUDENT') {
    throw Object.assign(new Error('Email already registered with a different role'), { status: 409 });
  }

  await prisma.lecturerInvite.updateMany({
    where: { institutionId, departmentRole: ARM_INVITE_ROLE, email: normalized, status: INVITE_STATUS.PENDING },
    data: { status: INVITE_STATUS.CANCELLED },
  });

  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invite = await prisma.lecturerInvite.create({
    data: {
      institutionId,
      email: normalized,
      fullName: name,
      departmentRole: ARM_INVITE_ROLE,
      departmentId: null,
      invitedById,
      token,
      expiresAt,
    },
    include: inviteInclude,
  });

  const emailResult = await dispatchArmEmail(invite, token);
  return { invite, invitationStatus: 'PENDING', ...inviteDeliveryMeta(token, institution.slug, emailResult) };
}

export async function resendArmInvite(institutionId, inviteId) {
  const invite = await prisma.lecturerInvite.findFirst({
    where: { id: inviteId, institutionId, departmentRole: ARM_INVITE_ROLE },
    include: inviteInclude,
  });
  if (!invite) throw Object.assign(new Error('Invitation not found'), { status: 404 });
  if (invite.status === INVITE_STATUS.ACCEPTED) {
    throw Object.assign(new Error('Invitation already accepted'), { status: 409 });
  }
  if (invite.status === INVITE_STATUS.CANCELLED) {
    throw Object.assign(new Error('Invitation was revoked'), { status: 409 });
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const updated = await prisma.lecturerInvite.update({
    where: { id: invite.id },
    data: { status: INVITE_STATUS.PENDING, expiresAt, resentCount: { increment: 1 } },
    include: inviteInclude,
  });

  const emailResult = await dispatchArmEmail(updated, updated.token);
  return { invite: updated, invitationStatus: 'RESENT', ...inviteDeliveryMeta(updated.token, updated.institution?.slug, emailResult) };
}

export async function getArmInviteLink(institutionId, inviteId) {
  const invite = await prisma.lecturerInvite.findFirst({
    where: { id: inviteId, institutionId, departmentRole: ARM_INVITE_ROLE },
    include: { institution: { select: { slug: true } } },
  });
  if (!invite) throw Object.assign(new Error('Invitation not found'), { status: 404 });
  if (resolveInviteLifecycle(invite) !== INVITE_STATUS.PENDING) {
    throw Object.assign(new Error('Only pending invitations have an active link'), { status: 409 });
  }
  return inviteDeliveryMeta(invite.token, invite.institution?.slug, null);
}

export async function revokeArmInvite(institutionId, inviteId) {
  const invite = await prisma.lecturerInvite.findFirst({
    where: { id: inviteId, institutionId, departmentRole: ARM_INVITE_ROLE, status: INVITE_STATUS.PENDING },
  });
  if (!invite) throw Object.assign(new Error('Pending invitation not found'), { status: 404 });
  await prisma.lecturerInvite.update({
    where: { id: invite.id },
    data: { status: INVITE_STATUS.CANCELLED },
  });
  return { ok: true, invitationStatus: 'REVOKED' };
}

export async function suspendArmManager(institutionId, userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, institutionId, role: ARM_INVITE_ROLE },
  });
  if (!user) throw Object.assign(new Error('Academic Resources Manager not found'), { status: 404 });
  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: 'SUSPENDED' },
  });
  return { ok: true };
}
