import { PrismaClient } from '@prisma/client';
import {
  generateOneTimePassword,
  generateSecureToken,
  hashSecret,
  verifySecret,
  normalizeOtp,
} from './authCrypto.js';
import {
  getAppPublicUrl,
  sendInviteEmail,
  sendWelcomeCredentialsEmail,
  sendPasswordResetEmail,
  sendInstitutionActivationEmail,
} from './email.js';
import { INSTITUTION_EMAIL_SELECT } from './email/emailBranding.js';

const prisma = new PrismaClient();

const RESET_TTL_MS = 60 * 60 * 1000;

export function buildActivationUrl(token, institutionSlug = null) {
  const base = getAppPublicUrl();
  const path = institutionSlug ? `/${institutionSlug}/accept-invite` : '/accept-invite';
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

export function buildResetUrl(token, institutionSlug = null) {
  const base = getAppPublicUrl();
  const path = institutionSlug ? `/${institutionSlug}/reset-password` : '/reset-password';
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

export function buildPlatformResetUrl(token) {
  const base = getAppPublicUrl();
  return `${base}/platform/reset-password?token=${encodeURIComponent(token)}`;
}

export async function attachInviteOtp(inviteId) {
  const otp = generateOneTimePassword();
  const otpHash = await hashSecret(otp);
  const invite = await prisma.lecturerInvite.findUnique({ where: { id: inviteId } });
  await prisma.lecturerInvite.update({
    where: { id: inviteId },
    data: {
      otpHash,
      otpExpiresAt: invite?.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      otpUsedAt: null,
    },
  });
  return otp;
}

export async function dispatchInviteEmail(inviteId, token, plainOtp = null) {
  const invite = await prisma.lecturerInvite.findUnique({
    where: { id: inviteId },
    include: {
      department: {
        include: {
          faculty: { include: { institution: { select: INSTITUTION_EMAIL_SELECT } } },
        },
      },
      invitedBy: { select: { fullName: true } },
    },
  });
  if (!invite) return { sent: false };

  let otp = plainOtp;
  if (!invite.otpHash) {
    otp = await attachInviteOtp(inviteId);
  }

  const roleLabel =
    invite.departmentRole === 'HOD' ? 'Head of Department' : invite.departmentRole || 'Lecturer';

  try {
    const result = await sendInviteEmail({
      to: invite.email,
      fullName: invite.fullName,
      departmentName: invite.department.name,
      roleLabel,
      invitedBy: invite.invitedBy.fullName,
      activationUrl: buildActivationUrl(token, invite.department?.faculty?.institution?.slug),
      oneTimePassword: otp || '(check your original invitation email)',
      expiresAt: invite.expiresAt,
      branding: invite.department?.faculty?.institution,
    });
    return result;
  } catch (e) {
    console.error('[ula-email] Invite email failed:', e.message);
    return { sent: false, error: e.message };
  }
}

export async function dispatchWelcomeEmail({
  email,
  fullName,
  departmentName,
  temporaryPassword,
  institutionSlug,
  institutionName,
  branding,
}) {
  try {
    const base = getAppPublicUrl();
    const loginUrl = institutionSlug ? `${base}/${institutionSlug}/login` : `${base}/?signin=1`;
    return await sendWelcomeCredentialsEmail({
      to: email,
      fullName,
      departmentName,
      temporaryPassword,
      loginUrl,
      institutionName,
      branding,
    });
  } catch (e) {
    console.error('[ula-email] Welcome email failed:', e.message);
    return { sent: false, error: e.message };
  }
}

export async function requestPasswordReset(email, institutionId = null) {
  const normalized = email.trim().toLowerCase();
  const user = institutionId
    ? await prisma.user.findUnique({
        where: { institutionId_email: { institutionId, email: normalized } },
        include: { institution: { select: INSTITUTION_EMAIL_SELECT } },
      })
    : await prisma.user.findFirst({
        where: { email: normalized },
        include: { institution: { select: INSTITUTION_EMAIL_SELECT } },
      });
  if (!user) return { ok: true, found: false, emailSent: false };

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = generateSecureToken();
  const tokenHash = await hashSecret(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = buildResetUrl(rawToken, user.institution?.slug);
  let emailSent = false;
  let emailError = null;
  let outboxFile = null;

  try {
    const sendResult = await sendPasswordResetEmail({
      to: user.email,
      fullName: user.fullName,
      resetUrl,
      expiresMinutes: 60,
      institutionName: user.institution?.shortName || user.institution?.name,
      branding: user.institution,
    });
    emailSent = sendResult?.sent === true;
    outboxFile = sendResult?.outboxFile || null;
  } catch (e) {
    emailError = e.message;
    console.error('[ula-email] Reset email failed:', e.message);
  }

  const isDev = process.env.NODE_ENV !== 'production';
  return {
    ok: true,
    found: true,
    emailSent,
    emailError,
    outboxFile,
    devResetUrl: isDev ? resetUrl : undefined,
  };
}

export async function validateResetToken(rawToken) {
  if (!rawToken) return null;
  const rows = await prisma.passwordResetToken.findMany({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: { email: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  for (const row of rows) {
    if (await verifySecret(rawToken, row.tokenHash)) return row;
  }
  return null;
}

/** Institution admin activation — secure set-password link (reuses reset token infrastructure). */
export async function dispatchInstitutionAdminActivation(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { institution: { select: INSTITUTION_EMAIL_SELECT } },
  });
  if (!user) return { sent: false, found: false };

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = generateSecureToken();
  const tokenHash = await hashSecret(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const activationUrl = buildResetUrl(rawToken, user.institution?.slug);
  let emailSent = false;
  let emailError = null;
  let outboxFile = null;

  try {
    const sendResult = await sendInstitutionActivationEmail({
      to: user.email,
      fullName: user.fullName,
      institutionName: user.institution?.name,
      institutionSlug: user.institution?.slug,
      activationUrl,
      expiresMinutes: 60,
      branding: user.institution,
    });
    emailSent = sendResult?.sent === true;
    outboxFile = sendResult?.outboxFile || null;
  } catch (e) {
    emailError = e.message;
    console.error('[ula-email] Institution activation email failed:', e.message);
  }

  const isDev = process.env.NODE_ENV !== 'production';
  return {
    ok: true,
    found: true,
    emailSent,
    emailError,
    outboxFile,
    activationUrl,
    devActivationUrl: isDev ? activationUrl : undefined,
  };
}

export async function requestPlatformPasswordReset(email) {
  const normalized = email.trim().toLowerCase();
  const operator = await prisma.platformOperator.findUnique({ where: { email: normalized } });
  if (!operator || operator.accountStatus !== 'ACTIVE') {
    return { ok: true, found: false, emailSent: false };
  }

  await prisma.platformPasswordResetToken.updateMany({
    where: { operatorId: operator.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = generateSecureToken();
  const tokenHash = await hashSecret(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.platformPasswordResetToken.create({
    data: { operatorId: operator.id, tokenHash, expiresAt },
  });

  const resetUrl = buildPlatformResetUrl(rawToken);
  let emailSent = false;
  let emailError = null;
  let outboxFile = null;

  try {
    const sendResult = await sendPasswordResetEmail({
      to: operator.email,
      fullName: operator.fullName,
      resetUrl,
      expiresMinutes: 60,
      institutionName: 'ULA Platform Operations',
    });
    emailSent = sendResult?.sent === true;
    outboxFile = sendResult?.outboxFile || null;
  } catch (e) {
    emailError = e.message;
    console.error('[ula-email] Platform reset email failed:', e.message);
  }

  const isDev = process.env.NODE_ENV !== 'production';
  return {
    ok: true,
    found: true,
    emailSent,
    emailError,
    outboxFile,
    devResetUrl: isDev ? resetUrl : undefined,
  };
}

export async function validatePlatformResetToken(rawToken) {
  if (!rawToken) return null;
  const rows = await prisma.platformPasswordResetToken.findMany({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    include: { operator: { select: { email: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  for (const row of rows) {
    if (await verifySecret(rawToken, row.tokenHash)) return row;
  }
  return null;
}

export async function resetPlatformPasswordWithToken(rawToken, newPassword) {
  const row = await validatePlatformResetToken(rawToken);
  if (!row) {
    const err = new Error('Invalid or expired reset link');
    err.status = 400;
    throw err;
  }

  const passwordHash = await hashSecret(newPassword);
  await prisma.$transaction([
    prisma.platformOperator.update({
      where: { id: row.operatorId },
      data: { passwordHash },
    }),
    prisma.platformPasswordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { operatorId: row.operatorId, email: row.operator.email, fullName: row.operator.fullName };
}

export async function resetPasswordWithToken(rawToken, newPassword) {
  const row = await validateResetToken(rawToken);
  if (!row) {
    const err = new Error('Invalid or expired reset link');
    err.status = 400;
    throw err;
  }

  const passwordHash = await hashSecret(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        accountStatus: 'ACTIVE',
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { userId: row.userId, email: row.user.email, fullName: row.user.fullName };
}

export async function verifyInviteOtp(invite, otp) {
  if (!invite.otpHash) return true;
  if (invite.otpUsedAt) return false;
  if (invite.otpExpiresAt && new Date() > invite.otpExpiresAt) return false;
  return verifySecret(normalizeOtp(otp), invite.otpHash);
}

export async function markInviteOtpUsed(inviteId) {
  await prisma.lecturerInvite.update({
    where: { id: inviteId },
    data: { otpUsedAt: new Date() },
  });
}
