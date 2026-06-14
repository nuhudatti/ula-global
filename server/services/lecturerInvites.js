import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { getAppPublicUrl, sendLecturerInvitationEmail } from './email.js';
import { INSTITUTION_EMAIL_SELECT } from './email/emailBranding.js';
import { userEmailWhere } from './tenantScope.js';
import { syncLecturerCourses } from './lecturerCourses.js';
import { emailLog } from './email/logger.js';

const prisma = new PrismaClient();

export const INVITE_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function buildInvitationUrl(token, institutionSlug = null) {
  const base = getAppPublicUrl();
  const path = institutionSlug ? `/${institutionSlug}/accept-invitation` : '/accept-invitation';
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

export function invitationPath(token, institutionSlug = null) {
  const path = institutionSlug ? `/${institutionSlug}/accept-invitation` : '/accept-invitation';
  return `${path}?token=${encodeURIComponent(token)}`;
}

export function inviteDeliveryMeta(token, institutionSlug, emailResult) {
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

export function logInvitationEvent(action, meta = {}) {
  emailLog.info('lecturer_invitation', { action, ...meta, ts: new Date().toISOString() });
}

function roleLabel(departmentRole) {
  if (departmentRole === 'HOD') return 'Head of Department';
  return departmentRole || 'Lecturer';
}

function mapInvitePublic(invite, institutionSlug) {
  const lifecycle = resolveInviteLifecycle(invite);
  const slug =
    institutionSlug ||
    invite.institution?.slug ||
    invite.department?.faculty?.institution?.slug ||
    null;
  return {
    id: invite.id,
    email: invite.email,
    fullName: invite.fullName,
    staffId: invite.staffId,
    departmentRole: invite.departmentRole,
    status: lifecycle,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    createdAt: invite.createdAt,
    resentCount: invite.resentCount ?? 0,
    invitedBy: invite.invitedBy?.fullName || null,
    institutionName: invite.institution?.shortName || invite.institution?.name || null,
    departmentName: invite.department?.name || invite.institution?.name || null,
    inviteUrl: invitationPath(invite.token, slug),
  };
}

export function resolveInviteLifecycle(invite) {
  if (invite.status === INVITE_STATUS.CANCELLED) return INVITE_STATUS.CANCELLED;
  if (invite.status === INVITE_STATUS.ACCEPTED) return INVITE_STATUS.ACCEPTED;
  if (invite.status === INVITE_STATUS.EXPIRED || new Date() > invite.expiresAt) return INVITE_STATUS.EXPIRED;
  return INVITE_STATUS.PENDING;
}

async function loadDepartmentContext(departmentId) {
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      id: true,
      name: true,
      faculty: {
        select: {
          institutionId: true,
          name: true,
          institution: { select: INSTITUTION_EMAIL_SELECT },
        },
      },
    },
  });
  if (!dept?.faculty?.institutionId) {
    throw Object.assign(new Error('Department institution not found'), { status: 400 });
  }
  return dept;
}

async function dispatchInvitationEmail(invite, token) {
  const institution = invite.department?.faculty?.institution || invite.institution;
  const slug = institution?.slug;

  if (invite.departmentRole === 'INSTITUTION_ADMIN') {
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

  try {
    const result = await sendLecturerInvitationEmail({
      to: invite.email,
      fullName: invite.fullName,
      departmentName: invite.department.name,
      roleLabel: roleLabel(invite.departmentRole),
      invitedBy: invite.invitedBy?.fullName || 'Department Administrator',
      invitationUrl: buildInvitationUrl(token, slug),
      expiresAt: invite.expiresAt,
      institutionName: institution?.shortName || institution?.name,
      branding: institution,
    });
    return result;
  } catch (e) {
    console.error('[ula-email] Lecturer invitation failed:', e.message);
    return { sent: false, error: e.message };
  }
}

export async function createLecturerInvitation({
  departmentId,
  invitedById,
  email,
  fullName,
  staffId,
  departmentRole,
  canUpload,
  courseIds,
  allowExisting = false,
}) {
  const normalized = email.trim().toLowerCase();
  const dept = await loadDepartmentContext(departmentId);
  const institutionId = dept.faculty.institutionId;
  const slug = dept.faculty.institution?.slug;

  const existing = await prisma.user.findUnique({
    where: { institutionId_email: { institutionId, email: normalized } },
  });
  if (existing?.accountStatus === 'ACTIVE' && existing.role !== 'STUDENT') {
    throw Object.assign(
      new Error('This lecturer already has an active account. Ask them to use Forgot Password to sign in.'),
      { status: 409 },
    );
  }
  if (existing && !allowExisting) {
    throw Object.assign(new Error('User with this email already exists'), { status: 409 });
  }
  if (existing && allowExisting && existing.role === 'STUDENT') {
    throw Object.assign(new Error('This email belongs to a student account'), { status: 409 });
  }

  await prisma.lecturerInvite.updateMany({
    where: {
      email: normalized,
      institutionId,
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
      fullName: fullName.trim(),
      staffId: staffId?.trim() || null,
      departmentRole: departmentRole || 'LECTURER',
      departmentId,
      invitedById,
      token,
      canUpload: canUpload !== false,
      courseIdsJson: courseIds?.length ? JSON.stringify(courseIds) : null,
      expiresAt,
    },
    include: {
      department: { select: { name: true, faculty: { select: { institution: { select: INSTITUTION_EMAIL_SELECT } } } } },
      invitedBy: { select: { fullName: true } },
      institution: { select: INSTITUTION_EMAIL_SELECT },
    },
  });

  const emailResult = await dispatchInvitationEmail(invite, token);
  logInvitationEvent('created', {
    inviteId: invite.id,
    email: invite.email,
    departmentId,
    institutionId,
    emailSent: emailResult?.sent === true,
  });

  return {
    invite: mapInvitePublic(invite, slug),
    ...inviteDeliveryMeta(token, slug, emailResult),
  };
}

export async function listDepartmentInvitations(departmentId) {
  const dept = await loadDepartmentContext(departmentId);
  const slug = dept.faculty.institution?.slug;
  const rows = await prisma.lecturerInvite.findMany({
    where: { departmentId },
    orderBy: { createdAt: 'desc' },
    include: {
      invitedBy: { select: { fullName: true } },
      institution: { select: INSTITUTION_EMAIL_SELECT },
      department: { select: { name: true } },
    },
  });
  return rows.map((row) => mapInvitePublic(row, slug));
}

export async function getInvitationLink(inviteId, departmentId) {
  const invite = await prisma.lecturerInvite.findFirst({
    where: { id: inviteId, departmentId },
    include: {
      department: { select: { faculty: { select: { institution: { select: { slug: true } } } } } },
    },
  });
  if (!invite) throw Object.assign(new Error('Invitation not found'), { status: 404 });
  if (resolveInviteLifecycle(invite) !== INVITE_STATUS.PENDING) {
    throw Object.assign(new Error('Only pending invitations have an active link'), { status: 409 });
  }
  const slug = invite.department?.faculty?.institution?.slug;
  return inviteDeliveryMeta(invite.token, slug, null);
}

export async function resendLecturerInvitation(inviteId, departmentId) {
  const invite = await prisma.lecturerInvite.findFirst({
    where: { id: inviteId, departmentId },
    include: {
      department: {
        include: {
          faculty: { include: { institution: { select: INSTITUTION_EMAIL_SELECT } } },
        },
      },
      invitedBy: { select: { fullName: true } },
      institution: { select: INSTITUTION_EMAIL_SELECT },
    },
  });
  if (!invite) throw Object.assign(new Error('Invitation not found'), { status: 404 });
  if (resolveInviteLifecycle(invite) !== INVITE_STATUS.PENDING) {
    throw Object.assign(new Error('Only pending invitations can be resent'), { status: 409 });
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const updated = await prisma.lecturerInvite.update({
    where: { id: invite.id },
    data: { expiresAt, status: INVITE_STATUS.PENDING },
    include: {
      department: {
        include: {
          faculty: { include: { institution: { select: INSTITUTION_EMAIL_SELECT } } },
        },
      },
      invitedBy: { select: { fullName: true } },
      institution: { select: INSTITUTION_EMAIL_SELECT },
    },
  });

  const slug = updated.department?.faculty?.institution?.slug;
  const emailResult = await dispatchInvitationEmail(updated, updated.token);
  logInvitationEvent('resent', { inviteId: invite.id, email: invite.email, departmentId });

  return {
    invite: mapInvitePublic(updated, slug),
    ...inviteDeliveryMeta(updated.token, slug, emailResult),
  };
}

export async function cancelLecturerInvitation(inviteId, departmentId) {
  const invite = await prisma.lecturerInvite.findFirst({
    where: { id: inviteId, departmentId, status: INVITE_STATUS.PENDING },
  });
  if (!invite) throw Object.assign(new Error('Pending invitation not found'), { status: 404 });
  await prisma.lecturerInvite.update({
    where: { id: invite.id },
    data: { status: INVITE_STATUS.CANCELLED },
  });
  logInvitationEvent('cancelled', { inviteId: invite.id, email: invite.email, departmentId });
  return { ok: true };
}

export async function previewLecturerInvitation(token) {
  const invite = await prisma.lecturerInvite.findUnique({
    where: { token },
    include: {
      department: { include: { faculty: { select: { name: true, institution: { select: INSTITUTION_EMAIL_SELECT } } } } },
      invitedBy: { select: { fullName: true } },
      institution: { select: INSTITUTION_EMAIL_SELECT },
    },
  });
  if (!invite) return null;

  const lifecycle = resolveInviteLifecycle(invite);
  if (lifecycle === INVITE_STATUS.EXPIRED && invite.status === INVITE_STATUS.PENDING) {
    await prisma.lecturerInvite.update({
      where: { id: invite.id },
      data: { status: INVITE_STATUS.EXPIRED },
    });
  }
  if (lifecycle !== INVITE_STATUS.PENDING) return { invalid: true, status: lifecycle };

  const nameParts = invite.fullName.trim().split(/\s+/);

  if (invite.departmentRole === 'INSTITUTION_ADMIN') {
    return {
      inviteType: 'institution_admin',
      email: invite.email,
      fullName: invite.fullName,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' '),
      department: invite.institution?.name || 'Institution administration',
      institution: invite.institution?.shortName || invite.institution?.name,
      institutionSlug: invite.institution?.slug,
      role: 'INSTITUTION_ADMIN',
      invitedBy: invite.invitedBy?.fullName || 'ULA Platform Operations',
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      requiresOtp: false,
    };
  }

  if (invite.departmentRole === 'ACADEMIC_RESOURCES_MANAGER') {
    return {
      inviteType: 'arm',
      email: invite.email,
      fullName: invite.fullName,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' '),
      department: invite.institution?.name || 'Academic resources',
      institution: invite.institution?.shortName || invite.institution?.name,
      institutionSlug: invite.institution?.slug,
      role: 'ACADEMIC_RESOURCES_MANAGER',
      invitedBy: invite.invitedBy?.fullName || 'Institution Administrator',
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      requiresOtp: false,
    };
  }

  return {
    inviteType: 'lecturer',
    email: invite.email,
    fullName: invite.fullName,
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' '),
    department: invite.department.name,
    faculty: invite.department.faculty.name,
    institution: invite.institution?.shortName || invite.institution?.name,
    institutionSlug: invite.department.faculty.institution?.slug,
    role: invite.departmentRole,
    invitedBy: invite.invitedBy?.fullName || 'Department Administrator',
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    requiresOtp: false,
  };
}

export async function acceptLecturerInvitation({ token, password, firstName, lastName }) {
  const invite = await prisma.lecturerInvite.findUnique({
    where: { token },
    include: {
      department: { include: { faculty: { select: { institutionId: true } } } },
      institution: { select: { id: true } },
    },
  });
  if (!invite) {
    throw Object.assign(new Error('Invalid invitation link'), { status: 400 });
  }

  const lifecycle = resolveInviteLifecycle(invite);
  if (lifecycle === INVITE_STATUS.EXPIRED && invite.status === INVITE_STATUS.PENDING) {
    await prisma.lecturerInvite.update({ where: { id: invite.id }, data: { status: INVITE_STATUS.EXPIRED } });
  }
  if (lifecycle !== INVITE_STATUS.PENDING) {
    throw Object.assign(new Error('This invitation is no longer valid'), { status: 400 });
  }

  const resolvedName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ') || invite.fullName;
  const passwordHash = await bcrypt.hash(password, 12);
  const courseIds = invite.courseIdsJson ? JSON.parse(invite.courseIdsJson) : [];

  const isInstitutionAdmin = invite.departmentRole === 'INSTITUTION_ADMIN';
  const isArm = invite.departmentRole === 'ACADEMIC_RESOURCES_MANAGER';
  const institutionId = isInstitutionAdmin || isArm
    ? invite.institutionId
    : invite.department?.faculty?.institutionId;
  if (!institutionId) {
    throw Object.assign(new Error('Invitation institution context missing'), { status: 400 });
  }

  const inviteRole = isInstitutionAdmin
    ? 'INSTITUTION_ADMIN'
    : isArm
      ? 'ACADEMIC_RESOURCES_MANAGER'
      : invite.departmentRole === 'HOD'
        ? 'HOD'
        : 'LECTURER';

  const existing = await prisma.user.findUnique({
    where: userEmailWhere(institutionId, invite.email),
  });

  let userId;
  if (existing) {
    if (existing.role === 'STUDENT') {
      throw Object.assign(
        new Error('This email is already registered as a student account. Use a different institutional email.'),
        { status: 409 },
      );
    }
    if (isInstitutionAdmin && existing.role !== 'INSTITUTION_ADMIN') {
      throw Object.assign(new Error('This email is already registered with a different role'), { status: 409 });
    }
    if (isArm && existing.role !== 'ACADEMIC_RESOURCES_MANAGER') {
      throw Object.assign(new Error('This email is already registered with a different role'), { status: 409 });
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        fullName: resolvedName,
        departmentId: isInstitutionAdmin || isArm ? null : invite.departmentId,
        staffId: invite.staffId,
        departmentRole: isInstitutionAdmin || isArm ? null : invite.departmentRole,
        canUpload: invite.canUpload,
        accountStatus: 'ACTIVE',
        role: inviteRole,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });
    userId = updated.id;
  } else {
    const created = await prisma.user.create({
      data: {
        institutionId,
        email: invite.email,
        passwordHash,
        fullName: resolvedName,
        role: inviteRole,
        departmentId: isInstitutionAdmin || isArm ? null : invite.departmentId,
        staffId: invite.staffId,
        departmentRole: isInstitutionAdmin || isArm ? null : invite.departmentRole,
        canUpload: invite.canUpload,
        accountStatus: 'ACTIVE',
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });
    userId = created.id;
  }

  if (!isInstitutionAdmin && courseIds.length) await syncLecturerCourses(userId, courseIds);

  await prisma.lecturerInvite.update({
    where: { id: invite.id },
    data: {
      status: INVITE_STATUS.ACCEPTED,
      acceptedAt: new Date(),
      fullName: resolvedName,
    },
  });

  logInvitationEvent('accepted', { inviteId: invite.id, email: invite.email, userId });
  return userId;
}
