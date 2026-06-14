/** Centralized email / SendGrid SMTP configuration. */

import { getEffectiveEmailSettings } from '../platformEmailSettings.js';
export { getAppPublicUrl, getPublicBaseUrl, getClientOrigin, enforceHttps } from '../publicUrl.js';

export function getEmailConfig() {
  const s = getEffectiveEmailSettings();
  const host = s.smtpHost || '';
  const port = s.smtpPort || 587;
  const secure = Boolean(s.smtpSecure);
  const user = s.smtpUser || '';
  const pass = s.smtpPass || '';
  const from = s.smtpFrom || '';
  const replyTo = s.smtpReplyTo || s.smtpFrom || '';
  const provider = detectProvider(host);

  return {
    host,
    port,
    secure,
    user,
    pass: pass ? '***' : '',
    from,
    fromName: s.smtpFromName || 'ULA Platform',
    replyTo,
    provider,
    retries: s.retryMax ?? 3,
    retryDelayMs: s.retryDelayMs ?? 1000,
    devOutbox: s.devOutbox !== false,
    mirrorOutbox: s.mirrorOutbox !== false,
    templates: s.templates || {},
    source: s.source || 'environment',
  };
}

/** Raw SMTP password for transport layer (never expose via API). */
export function getSmtpPass() {
  return getEffectiveEmailSettings().smtpPass?.trim() || '';
}

function detectProvider(host) {
  const h = host.toLowerCase();
  if (h.includes('sendgrid')) return 'sendgrid';
  if (h.includes('resend')) return 'resend';
  if (h.includes('amazonaws')) return 'ses';
  return host ? 'smtp' : 'none';
}

export function isSmtpConfigured() {
  const { host, from, user } = getEmailConfig();
  const realPass = getSmtpPass();
  const fromOk = from && !from.includes('yourdomain.com');
  return Boolean(host && fromOk && user && realPass);
}

export function isEmailConfigured() {
  const key = (process.env.SENDGRID_API_KEY || getSmtpPass() || '').trim();
  return isSmtpConfigured() || key.startsWith('SG.');
}

export function shouldUseDevOutbox() {
  if (process.env.NODE_ENV === 'production') return false;
  const cfg = getEmailConfig();
  return cfg.devOutbox !== false && !isSmtpConfigured();
}

/** In development, also save a copy to data/email-outbox/ after SendGrid/SMTP sends. */
export function shouldMirrorToDevOutbox() {
  if (process.env.NODE_ENV === 'production') return false;
  const cfg = getEmailConfig();
  if (cfg.mirrorOutbox === false) return false;
  return true;
}

export function warnIfProductionWithoutSmtp() {
  if (process.env.NODE_ENV === 'production' && !isEmailConfigured()) {
    console.error(
      '[ula-email] FATAL: Email is not configured in production. Set SMTP_PASS (SendGrid API key) and SMTP_FROM (verified sender).',
    );
    process.exit(1);
  }
  const from = process.env.SMTP_FROM?.trim() || '';
  if (from.includes('yourdomain.com')) {
    console.warn('[ula-email] WARNING: SMTP_FROM still uses placeholder yourdomain.com — verify a sender in SendGrid and update .env');
  }
}
