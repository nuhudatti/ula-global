import { getAppPublicUrl } from './config.js';
import { deliverEmail } from './transport.js';
import { emailLog } from './logger.js';
import { institutionDisplayName, toEmailBranding } from './emailBranding.js';
import { escapeHtml, otpBlock, renderEmailDocument } from './templates.js';

function resolveBranding(branding, institutionName) {
  const b = branding ? toEmailBranding(branding) || branding : null;
  return { branding: b, name: institutionDisplayName(b) || institutionName || null };
}

/** Core send — all flows use this. */
export async function sendEmail({ to, subject, html, text, type = 'generic', replyTo, headers }) {
  return deliverEmail({ to, subject, html, text, type, replyTo, headers });
}

/** Staff invitation (HOD, lecturer, faculty admin) — secure link only, no OTP. */
export async function sendLecturerInvitationEmail({
  to,
  fullName,
  departmentName,
  roleLabel,
  invitedBy,
  invitationUrl,
  expiresAt,
  institutionName,
  branding,
}) {
  const { branding: b, name: instName } = resolveBranding(branding, institutionName);
  const expiry = new Date(expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' });
  const { html, text } = renderEmailDocument({
    title: 'You are invited',
    preheader: `${invitedBy} invited you to join ${instName || departmentName}`,
    branding: b,
    institutionName: instName,
    bodyHtml: `
      <p style="margin:0 0 12px">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
      <p style="margin:0 0 12px"><strong>${escapeHtml(invitedBy)}</strong> has invited you to join <strong>${escapeHtml(departmentName)}</strong> as <strong>${escapeHtml(roleLabel)}</strong>${instName ? ` at <strong>${escapeHtml(instName)}</strong>` : ''}.</p>
      <p style="margin:0 0 12px">Click the button below to accept your invitation and create your password. This secure link expires on <strong>${escapeHtml(expiry)}</strong> and can only be used once.</p>
      <p style="margin:0;font-size:13px;color:#64748b">If you did not expect this invitation, you can safely ignore this message.</p>`,
    ctaLabel: 'Accept invitation',
    ctaUrl: invitationUrl,
    footer: instName ? `${instName} · ${roleLabel} invitation` : `${roleLabel} invitation · ULA Platform`,
  });

  return sendEmail({
    to,
    subject: instName
      ? `${instName}: ${roleLabel} invitation — ${departmentName}`
      : `Invitation: ${departmentName} (${roleLabel})`,
    html,
    text,
    type: 'staff_invitation',
  });
}

export async function sendInviteEmail({
  to,
  fullName,
  departmentName,
  roleLabel,
  invitedBy,
  activationUrl,
  oneTimePassword,
  expiresAt,
  institutionName,
  branding,
}) {
  const { branding: b, name: instName } = resolveBranding(branding, institutionName);
  const expiry = new Date(expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' });
  const { html, text } = renderEmailDocument({
    title: 'You are invited',
    preheader: `${invitedBy} invited you to ${departmentName}`,
    branding: b,
    institutionName: instName,
    bodyHtml: `
      <p style="margin:0 0 12px">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
      <p style="margin:0 0 12px"><strong>${escapeHtml(invitedBy)}</strong> has invited you to <strong>${escapeHtml(departmentName)}</strong> as <strong>${escapeHtml(roleLabel)}</strong>${instName ? ` at <strong>${escapeHtml(instName)}</strong>` : ''}.</p>
      ${otpBlock('Your one-time password', oneTimePassword, b?.primaryColor)}
      <p style="margin:0 0 12px">Use this one-time password with the activation link below to set your permanent password. The code expires on <strong>${escapeHtml(expiry)}</strong>.</p>
      <p style="margin:0;font-size:13px;color:#64748b">If you did not expect this invitation, you can safely ignore this message.</p>`,
    ctaLabel: 'Activate your account',
    ctaUrl: activationUrl,
    footer: instName ? `${instName} · Account activation` : 'Account activation · ULA Platform',
  });

  const result = await sendEmail({
    to,
    subject: instName ? `${instName}: Invitation to ${departmentName}` : `Invitation: ${departmentName} (${roleLabel})`,
    html,
    text,
    type: 'invite',
  });

  if (result.mode === 'outbox' || result.mode === 'outbox_fallback') {
    emailLog.info('invite_otp_dev', { to, activationUrl, hasOtp: Boolean(oneTimePassword) });
  }
  return result;
}

export async function sendInstitutionActivationEmail({
  to,
  fullName,
  institutionName,
  institutionSlug,
  activationUrl,
  expiresMinutes = 60,
  branding,
}) {
  const { branding: b, name: instName } = resolveBranding(branding, institutionName);
  const display = instName || institutionName;
  const { html, text } = renderEmailDocument({
    title: `Activate ${display}`,
    preheader: `Set your password to activate ${display} on ULA`,
    branding: b,
    institutionName: display,
    bodyHtml: `
      <p style="margin:0 0 12px">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
      <p style="margin:0 0 12px">Your institution <strong>${escapeHtml(display)}</strong> has been provisioned on the ULA Platform.</p>
      <p style="margin:0 0 12px">Click the button below to set your administrator password and activate your workspace at <strong>/${escapeHtml(institutionSlug)}/login</strong>.</p>
      <p style="margin:0 0 12px;font-size:13px;color:#64748b">This activation link expires in <strong>${expiresMinutes} minutes</strong> and can only be used once.</p>
      <p style="margin:0;font-size:13px;color:#64748b">If you did not expect this email, contact your ULA platform administrator.</p>`,
    ctaLabel: `Activate ${display}`,
    ctaUrl: activationUrl,
    footer: `${display} · Institution activation`,
  });

  const result = await sendEmail({
    to,
    subject: `Activate ${display} on ULA`,
    html,
    text,
    type: 'institution_activation',
  });

  if (result.mode === 'outbox' || result.mode === 'outbox_fallback') {
    emailLog.info('institution_activation_dev', { to, activationUrl });
  }
  return result;
}

export async function sendInstitutionAdminWelcomeEmail({
  to,
  fullName,
  institutionName,
  institutionSlug,
  temporaryPassword,
  loginUrl,
  branding,
}) {
  const { branding: b, name: instName } = resolveBranding(branding, institutionName);
  const display = instName || institutionName;
  const { html, text } = renderEmailDocument({
    title: `Welcome to ${display}`,
    preheader: `Your ${display} administrator account is ready`,
    branding: b,
    institutionName: display,
    bodyHtml: `
      <p style="margin:0 0 12px">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
      <p style="margin:0 0 12px">Your <strong>${escapeHtml(display)}</strong> workspace on ULA is ready.</p>
      ${otpBlock('One-time temporary password', temporaryPassword, b?.primaryColor)}
      <p style="margin:0 0 12px">Sign in at <strong>/${escapeHtml(institutionSlug)}/login</strong> using your email and this password. You will set a new permanent password on first sign-in.</p>
      <p style="margin:0;font-size:13px;color:#64748b">This password is shown once. Contact your platform administrator if you need it reset.</p>`,
    ctaLabel: `Sign in to ${display}`,
    ctaUrl: loginUrl,
    footer: `${display} · Institution administration`,
  });

  const result = await sendEmail({
    to,
    subject: `Your ${display} administrator account`,
    html,
    text,
    type: 'institution_admin_welcome',
  });

  if (result.mode === 'outbox' || result.mode === 'outbox_fallback') {
    emailLog.info('institution_admin_dev', { to, loginUrl });
  }
  return result;
}

export async function sendWelcomeCredentialsEmail({
  to,
  fullName,
  departmentName,
  temporaryPassword,
  loginUrl,
  institutionName,
  branding,
}) {
  const { branding: b, name: instName } = resolveBranding(branding, institutionName);
  const { html, text } = renderEmailDocument({
    title: 'Your account is ready',
    preheader: `Your account for ${departmentName} has been created`,
    branding: b,
    institutionName: instName,
    bodyHtml: `
      <p style="margin:0 0 12px">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
      <p style="margin:0 0 12px">An administrator created your account for <strong>${escapeHtml(departmentName)}</strong>${instName ? ` at <strong>${escapeHtml(instName)}</strong>` : ''}.</p>
      ${otpBlock('Temporary password (one-time)', temporaryPassword, b?.primaryColor)}
      <p style="margin:0">Sign in and you will be prompted to set a new permanent password immediately.</p>`,
    ctaLabel: instName ? `Sign in to ${instName}` : 'Sign in to ULA',
    ctaUrl: loginUrl,
    footer: instName ? `${instName} · Account welcome` : 'Account welcome · ULA Platform',
  });

  return sendEmail({
    to,
    subject: instName ? `${instName}: Your new account` : `Your ULA account for ${departmentName}`,
    html,
    text,
    type: 'welcome_credentials',
  });
}

export async function sendPasswordResetEmail({
  to,
  fullName,
  resetUrl,
  expiresMinutes = 60,
  institutionName,
  branding,
}) {
  const { branding: b, name: instName } = resolveBranding(branding, institutionName);
  const { html, text } = renderEmailDocument({
    title: 'Reset your password',
    preheader: instName ? `${instName} password reset` : 'ULA password reset',
    branding: b,
    institutionName: instName,
    bodyHtml: `
      <p style="margin:0 0 12px">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
      <p style="margin:0 0 12px">We received a request to reset your password${instName ? ` for <strong>${escapeHtml(instName)}</strong>` : ''}. Use the button below to choose a new password.</p>
      <p style="margin:0 0 12px;font-size:13px;color:#64748b">This link expires in <strong>${expiresMinutes} minutes</strong> and can only be used once.</p>
      <p style="margin:0;font-size:13px;color:#64748b">If you did not request a password reset, you can safely ignore this message. Your password will not change.</p>`,
    ctaLabel: 'Reset password',
    ctaUrl: resetUrl,
    footer: instName ? `${instName} · Password reset` : 'Password reset · ULA Platform',
  });

  return sendEmail({
    to,
    subject: instName ? `${instName}: Reset your password` : 'Reset your ULA password',
    html,
    text,
    type: 'password_reset',
  });
}

export async function sendNotificationEmail({
  to,
  fullName,
  title,
  message,
  ctaLabel,
  ctaUrl,
  institutionName,
  branding,
}) {
  const { branding: b, name: instName } = resolveBranding(branding, institutionName);
  const { html, text } = renderEmailDocument({
    title,
    preheader: message.slice(0, 120),
    branding: b,
    institutionName: instName,
    bodyHtml: `
      <p style="margin:0 0 12px">Hello <strong>${escapeHtml(fullName || 'there')}</strong>,</p>
      <p style="margin:0">${escapeHtml(message)}</p>`,
    ctaLabel,
    ctaUrl,
    footer: instName ? `${instName} · Notification` : 'System notification · ULA Platform',
  });

  return sendEmail({
    to,
    subject: instName ? `${instName}: ${title}` : title,
    html,
    text,
    type: 'notification',
  });
}

export async function sendTestEmail({ to, requestedBy, branding }) {
  const appUrl = getAppPublicUrl();
  const { branding: b } = resolveBranding(branding, null);
  const { html, text } = renderEmailDocument({
    title: 'Email delivery test',
    preheader: 'ULA transactional email is working',
    branding: b,
    bodyHtml: `
      <p style="margin:0 0 12px">This is a test message from the ULA Platform email service.</p>
      <p style="margin:0 0 12px">If you see your institution logo and colors above, branding is configured correctly.</p>
      <p style="margin:0;font-size:13px;color:#64748b">Requested by: ${escapeHtml(requestedBy || 'platform operator')}<br>App URL: ${escapeHtml(appUrl)}</p>`,
    ctaLabel: 'Open ULA Platform',
    ctaUrl: appUrl,
    footer: 'Email connectivity test',
  });

  return sendEmail({
    to,
    subject: b ? `${institutionDisplayName(b)}: Email test` : 'ULA Platform email test',
    html,
    text,
    type: 'smtp_test',
  });
}
