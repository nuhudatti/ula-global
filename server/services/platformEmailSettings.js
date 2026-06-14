import { PrismaClient } from '@prisma/client';
import { enforceHttps } from './urlUtils.js';

const prisma = new PrismaClient();
const SETTINGS_ID = 'default';

/** In-memory cache — env vars fill gaps when DB fields are empty. */
let cached = null;

const DEFAULT_TEMPLATES = {
  password_reset: { subject: 'Reset your password', preheader: 'Secure password recovery' },
  institution_activation: { subject: 'Activate your institution', preheader: 'Set your administrator password' },
  account_invitation: { subject: 'You are invited', preheader: 'Accept your invitation' },
  notification: { subject: 'Notification', preheader: 'Message from ULA' },
};

function envOr(dbVal, envVal) {
  const d = dbVal?.trim?.() ?? dbVal;
  if (d !== null && d !== undefined && d !== '') return d;
  return envVal?.trim?.() ?? envVal ?? '';
}

function mergeEffective(row) {
  return {
    smtpHost: envOr(row?.smtpHost, process.env.SMTP_HOST),
    smtpPort: row?.smtpPort ?? (Number(process.env.SMTP_PORT) || 587),
    smtpSecure: row?.smtpSecure ?? process.env.SMTP_SECURE === 'true',
    smtpUser: envOr(row?.smtpUser, process.env.SMTP_USER),
    smtpPass: envOr(row?.smtpPass, process.env.SMTP_PASS),
    smtpFrom: envOr(row?.smtpFrom, process.env.SMTP_FROM),
    smtpFromName: envOr(row?.smtpFromName, process.env.SMTP_FROM_NAME) || 'ULA Platform',
    smtpReplyTo: envOr(row?.smtpReplyTo, process.env.SMTP_REPLY_TO || process.env.SMTP_FROM),
    appPublicUrl: envOr(row?.appPublicUrl, process.env.APP_PUBLIC_URL || process.env.CLIENT_ORIGIN),
    retryMax: row?.retryMax ?? Math.max(1, Math.min(5, Number(process.env.SMTP_RETRY_MAX) || 3)),
    retryDelayMs: row?.retryDelayMs ?? Math.max(500, Number(process.env.SMTP_RETRY_DELAY_MS) || 1000),
    devOutbox: row?.devOutbox ?? process.env.EMAIL_DEV_OUTBOX !== 'false',
    mirrorOutbox: row?.mirrorOutbox ?? process.env.EMAIL_MIRROR_OUTBOX !== 'false',
    templates: parseTemplates(row?.templatesJson),
    source: row ? 'database' : 'environment',
  };
}

function parseTemplates(json) {
  if (!json) return { ...DEFAULT_TEMPLATES };
  try {
    const parsed = JSON.parse(json);
    return { ...DEFAULT_TEMPLATES, ...parsed };
  } catch {
    return { ...DEFAULT_TEMPLATES };
  }
}

export function getEffectiveEmailSettings() {
  if (cached) return cached;
  return mergeEffective(null);
}

export async function loadPlatformEmailSettings() {
  const row = await prisma.platformEmailSettings.findUnique({ where: { id: SETTINGS_ID } });
  cached = mergeEffective(row);
  return cached;
}

export function maskPass(pass) {
  if (!pass) return '';
  return '••••••••';
}

export function toPublicSettings(effective, row) {
  const hasDbPass = Boolean(row?.smtpPass?.trim());
  const hasEnvPass = Boolean(process.env.SMTP_PASS?.trim());
  return {
    smtpHost: row?.smtpHost ?? '',
    smtpPort: row?.smtpPort ?? 587,
    smtpSecure: row?.smtpSecure ?? false,
    smtpUser: row?.smtpUser ?? '',
    smtpPassSet: hasDbPass || hasEnvPass,
    smtpFrom: row?.smtpFrom ?? '',
    smtpFromName: row?.smtpFromName ?? 'ULA Platform',
    smtpReplyTo: row?.smtpReplyTo ?? '',
    appPublicUrl: row?.appPublicUrl ?? '',
    retryMax: row?.retryMax ?? 3,
    retryDelayMs: row?.retryDelayMs ?? 1000,
    devOutbox: row?.devOutbox ?? true,
    mirrorOutbox: row?.mirrorOutbox ?? true,
    templates: parseTemplates(row?.templatesJson),
    effective: {
      smtpHost: effective.smtpHost,
      smtpPort: effective.smtpPort,
      smtpSecure: effective.smtpSecure,
      smtpUser: effective.smtpUser ? `${effective.smtpUser.slice(0, 3)}…` : '',
      smtpFrom: effective.smtpFrom,
      smtpFromName: effective.smtpFromName,
      smtpReplyTo: effective.smtpReplyTo,
      appPublicUrl: enforceHttps(effective.appPublicUrl?.replace(/\/$/, '') || 'http://localhost:5173'),
      source: effective.source,
    },
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function getPlatformEmailSettingsPublic() {
  const row = await prisma.platformEmailSettings.findUnique({ where: { id: SETTINGS_ID } });
  const effective = mergeEffective(row);
  return toPublicSettings(effective, row);
}

export async function updatePlatformEmailSettings(input, operatorId) {
  const existing = await prisma.platformEmailSettings.findUnique({ where: { id: SETTINGS_ID } });
  const data = {};

  const strFields = ['smtpHost', 'smtpUser', 'smtpFrom', 'smtpFromName', 'smtpReplyTo', 'appPublicUrl'];
  for (const key of strFields) {
    if (input[key] !== undefined) data[key] = String(input[key] || '').trim() || null;
  }
  if (input.smtpPort !== undefined) data.smtpPort = Number(input.smtpPort) || 587;
  if (input.smtpSecure !== undefined) data.smtpSecure = Boolean(input.smtpSecure);
  if (input.retryMax !== undefined) data.retryMax = Math.max(1, Math.min(5, Number(input.retryMax) || 3));
  if (input.retryDelayMs !== undefined) data.retryDelayMs = Math.max(500, Number(input.retryDelayMs) || 1000);
  if (input.devOutbox !== undefined) data.devOutbox = Boolean(input.devOutbox);
  if (input.mirrorOutbox !== undefined) data.mirrorOutbox = Boolean(input.mirrorOutbox);
  if (input.smtpPass !== undefined && input.smtpPass !== '' && input.smtpPass !== '••••••••') {
    data.smtpPass = String(input.smtpPass).trim();
  }
  if (input.templates !== undefined) {
    data.templatesJson = JSON.stringify({ ...DEFAULT_TEMPLATES, ...input.templates });
  }
  data.updatedById = operatorId;

  const row = existing
    ? await prisma.platformEmailSettings.update({ where: { id: SETTINGS_ID }, data })
    : await prisma.platformEmailSettings.create({ data: { id: SETTINGS_ID, ...data } });

  cached = mergeEffective(row);
  const { invalidateEmailTransport } = await import('./email/transport.js');
  invalidateEmailTransport();
  return getPlatformEmailSettingsPublic();
}
