import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { getAppPublicUrl, sendLecturerInvitationEmail } from './email.js';
import { INSTITUTION_EMAIL_SELECT } from './email/emailBranding.js';
import { userEmailWhere } from './tenantScope.js';
import { buildInvitationUrl, invitationPath } from './lecturerInvites.js';

const prisma = new PrismaClient();

const INVITE_TTL_DAYS = 14;

function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

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

function inviteStatus(invite) {
  if (invite.status === 'REVOKED') return 'REVOKED';
  if (invite.status === 'ACCEPTED') return 'ACCEPTED';
  if (invite.status === 'EXPIRED' || new Date() > invite.expiresAt) return 'EXPIRED';
  return 'PENDING';
}

async function dispatchFacultyAdminEmail(invite, token, faculty, inviterName) {
  const slug = faculty.institution?.slug;
  try {
    return await sendLecturerInvitationEmail({
      to: invite.email,
      fullName: invite.fullName,
      departmentName: faculty.name,
      roleLabel: 'Faculty Administrator',
      invitedBy: inviterName || 'ULA Platform Admin',
      invitationUrl: buildInvitationUrl(token, slug),
      expiresAt: invite.expiresAt,
      institutionName: faculty.institution?.shortName || faculty.institution?.name,
      branding: faculty.institution,
    });
  } catch (e) {
    console.error('[ula-email] Faculty admin invitation failed:', e.message);
    return { sent: false, error: e.message };
  }
}

export async function listFacultyAdminInvites(facultyId) {
  const rows = await prisma.facultyAdminInvite.findMany({
    where: { facultyId, status: { in: ['PENDING', 'EXPIRED'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      acceptedAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    lifecycleStatus: inviteStatus(r),
  }));
}

export async function createFacultyAdminInvite({ facultyId, invitedById, email, fullName }) {
  const faculty = await prisma.faculty.findUnique({
    where: { id: facultyId },
    select: {
      id: true,
      name: true,
      institutionId: true,
      institution: { select: INSTITUTION_EMAIL_SELECT },
    },
  });
  if (!faculty) throw Object.assign(new Error('Faculty not found'), { status: 404 });

  const normalized = email.trim().toLowerCase();
  const name = fullName.trim();
  if (!normalized || !name) {
    throw Object.assign(new Error('email and fullName are required'), { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: userEmailWhere(faculty.institutionId, normalized),
  });
  if (existingUser) {
    throw Object.assign(
      new Error('Email already registered — use assign existing or a different email'),
      { status: 409 },
    );
  }

  await prisma.facultyAdminInvite.updateMany({
    where: { email: normalized, facultyId, status: 'PENDING' },
    data: { status: 'REVOKED' },
  });

  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  const inviter = await prisma.user.findUnique({
    where: { id: invitedById },
    select: { fullName: true },
  });

  const invite = await prisma.facultyAdminInvite.create({
    data: {
      email: normalized,
      fullName: name,
      facultyId,
      invitedById,
      token,
      expiresAt,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const emailResult = await dispatchFacultyAdminEmail(invite, token, faculty, inviter?.fullName);

  return {
    invite: { ...invite, lifecycleStatus: 'PENDING' },
    ...inviteDeliveryMeta(token, faculty.institution?.slug, emailResult),
  };
}

export async function resendFacultyAdminInvite(facultyId, inviteId) {
  const invite = await prisma.facultyAdminInvite.findFirst({
    where: { id: inviteId, facultyId },
    include: {
      faculty: { include: { institution: { select: INSTITUTION_EMAIL_SELECT } } },
      invitedBy: { select: { fullName: true } },
    },
  });
  if (!invite) throw Object.assign(new Error('Invitation not found'), { status: 404 });
  if (invite.status === 'ACCEPTED') {
    throw Object.assign(new Error('This invitation has already been accepted'), { status: 409 });
  }
  if (invite.status === 'REVOKED') {
    throw Object.assign(new Error('This invitation was revoked — send a new invitation'), { status: 409 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  await prisma.facultyAdminInvite.update({
    where: { id: invite.id },
    data: {
      status: 'PENDING',
      expiresAt,
    },
  });

  const emailResult = await dispatchFacultyAdminEmail(
    { ...invite, expiresAt },
    invite.token,
    invite.faculty,
    invite.invitedBy?.fullName,
  );

  return inviteDeliveryMeta(invite.token, invite.faculty?.institution?.slug, emailResult);
}

export function getFacultyAdminActivationUrl(token, institutionSlug = null) {
  return buildInvitationUrl(token, institutionSlug);
}

export async function getFacultyAdminInviteLink(facultyId, inviteId) {
  const invite = await prisma.facultyAdminInvite.findFirst({
    where: { id: inviteId, facultyId },
    include: {
      faculty: { select: { institution: { select: { slug: true } } } },
    },
  });
  if (!invite) throw Object.assign(new Error('Invitation not found'), { status: 404 });
  if (invite.status === 'ACCEPTED') {
    throw Object.assign(new Error('Invitation already accepted'), { status: 409 });
  }
  if (invite.status === 'REVOKED') {
    throw Object.assign(new Error('Invitation was revoked'), { status: 409 });
  }
  if (new Date() > invite.expiresAt) {
    throw Object.assign(new Error('Invitation expired — resend to issue a new link'), { status: 410 });
  }
  const slug = invite.faculty?.institution?.slug;
  return inviteDeliveryMeta(invite.token, slug, null);
}

export async function revokeFacultyAdminInvite(facultyId, inviteId) {
  const invite = await prisma.facultyAdminInvite.findFirst({
    where: { id: inviteId, facultyId, status: 'PENDING' },
  });
  if (!invite) throw Object.assign(new Error('Pending invitation not found'), { status: 404 });
  await prisma.facultyAdminInvite.update({
    where: { id: invite.id },
    data: { status: 'REVOKED' },
  });
  return { ok: true };
}

export async function deactivateFacultyAdmin(facultyId, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.facultyId !== facultyId || user.role !== 'FACULTY_ADMIN') {
    throw Object.assign(new Error('User is not an active faculty administrator for this faculty'), {
      status: 400,
    });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: 'SUSPENDED', facultyId: null },
  });
  return { ok: true };
}

export async function acceptFacultyAdminInvite({ token, password, firstName, lastName }) {
  const invite = await prisma.facultyAdminInvite.findUnique({
    where: { token },
    include: {
      faculty: {
        select: {
          name: true,
          institutionId: true,
          institution: { select: INSTITUTION_EMAIL_SELECT },
        },
      },
    },
  });
  if (!invite || invite.status !== 'PENDING') {
    throw Object.assign(new Error('Invalid or expired invite'), { status: 400 });
  }
  if (new Date() > invite.expiresAt) {
    await prisma.facultyAdminInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' },
    });
    throw Object.assign(new Error('Invite has expired'), { status: 400 });
  }

  const resolvedName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ') || invite.fullName;
  const exists = await prisma.user.findUnique({
    where: userEmailWhere(invite.faculty.institutionId, invite.email),
  });
  if (exists) {
    throw Object.assign(new Error('An account with this email already exists'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      institutionId: invite.faculty.institutionId,
      email: invite.email,
      passwordHash,
      fullName: resolvedName,
      role: 'FACULTY_ADMIN',
      facultyId: invite.facultyId,
      accountStatus: 'ACTIVE',
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  await prisma.facultyAdminInvite.update({
    where: { id: invite.id },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      fullName: resolvedName,
    },
  });

  return user;
}

export async function previewFacultyAdminInvite(token) {
  const invite = await prisma.facultyAdminInvite.findUnique({
    where: { token },
    include: {
      faculty: {
        select: {
          name: true,
          institution: { select: INSTITUTION_EMAIL_SELECT },
        },
      },
      invitedBy: { select: { fullName: true } },
    },
  });
  if (!invite) return null;

  if (invite.status === 'ACCEPTED') return { invalid: true, status: 'ACCEPTED' };
  if (invite.status === 'REVOKED') return { invalid: true, status: 'REVOKED' };
  if (invite.status === 'EXPIRED' || new Date() > invite.expiresAt) {
    if (invite.status === 'PENDING') {
      await prisma.facultyAdminInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
    }
    return { invalid: true, status: 'EXPIRED' };
  }
  if (invite.status !== 'PENDING') return null;

  const nameParts = invite.fullName.trim().split(/\s+/);
  return {
    inviteType: 'faculty_admin',
    email: invite.email,
    fullName: invite.fullName,
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' '),
    faculty: invite.faculty.name,
    department: invite.faculty.name,
    institution: invite.faculty.institution?.shortName || invite.faculty.institution?.name,
    institutionSlug: invite.faculty.institution?.slug,
    role: 'FACULTY_ADMIN',
    invitedBy: invite.invitedBy.fullName,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    requiresOtp: false,
  };
}
