import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmailConfig, getSmtpPass, isSmtpConfigured, shouldMirrorToDevOutbox, shouldUseDevOutbox } from './config.js';
import { buildDeliverabilityHeaders, getFromAddress, getReplyToAddress } from './deliverability.js';
import { emailLog } from './logger.js';
import { isSendGridApiConfigured, sendViaSendGridApi, verifySendGridApi } from './sendgridApi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTBOX_DIR = path.join(__dirname, '..', '..', '..', 'data', 'email-outbox');

let transporter = null;
let transporterVerified = false;

export function invalidateEmailTransport() {
  transporter = null;
  transporterVerified = false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureOutbox() {
  await fs.mkdir(OUTBOX_DIR, { recursive: true });
}

async function writeOutbox({ to, subject, html, text, from, replyTo }) {
  await ensureOutbox();
  const safe = String(to).replace(/[^a-z0-9@._-]/gi, '_');
  const file = path.join(OUTBOX_DIR, `${Date.now()}-${safe}.html`);
  const meta = `<!-- To: ${to} | From: ${from} | Reply-To: ${replyTo || ''} -->\n`;
  const body = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject}</title></head><body>${meta}${html}<hr><pre>${text || ''}</pre></body></html>`;
  await fs.writeFile(file, body, 'utf8');
  emailLog.info('email_outbox_written', { to, subject, file });
  return file;
}

export async function getTransporter({ forceNew = false } = {}) {
  if (transporter && !forceNew) return transporter;
  if (!isSmtpConfigured()) return null;

  const nodemailer = await import('nodemailer');
  const cfg = getEmailConfig();
  transporter = nodemailer.default.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user?.trim(),
      pass: getSmtpPass(),
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    tls: { minVersion: 'TLSv1.2' },
  });
  transporterVerified = false;
  return transporter;
}

/** Verify email delivery (SendGrid API first, then SMTP). */
export async function verifySmtpConnection() {
  if (isSendGridApiConfigured()) {
    const api = await verifySendGridApi();
    if (api.ok) {
      transporterVerified = true;
      return api;
    }
    emailLog.warn('sendgrid_api_verify_failed', { error: api.error });
  }

  if (!isSmtpConfigured()) {
    return { ok: false, mode: 'outbox', error: 'Email not configured (no API key or SMTP)' };
  }

  try {
    const tx = await getTransporter({ forceNew: true });
    await tx.verify();
    transporterVerified = true;
    const cfg = getEmailConfig();
    emailLog.info('smtp_verified', { provider: cfg.provider, host: cfg.host, port: cfg.port });
    return { ok: true, mode: 'smtp', provider: cfg.provider };
  } catch (e) {
    transporterVerified = false;
    if (isSendGridApiConfigured()) {
      return { ok: false, mode: 'smtp', error: e.message, code: e.code, note: 'SMTP blocked; ensure SendGrid API key is valid' };
    }
    emailLog.error('smtp_verify_failed', { error: e.message, code: e.code });
    return { ok: false, mode: 'smtp', error: e.message, code: e.code };
  }
}

function buildMailOptions({ to, subject, html, text, from, replyTo, headers = {}, type = 'transactional' }) {
  const fromAddr = from || getFromAddress();
  const reply = replyTo || getReplyToAddress();
  const plain = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    from: fromAddr,
    to,
    replyTo: reply,
    subject,
    html,
    text: plain,
    headers: {
      ...buildDeliverabilityHeaders({ type }),
      ...headers,
    },
  };
}

async function mirrorToOutboxIfDev(mail, result) {
  if (!shouldMirrorToDevOutbox()) return result;
  try {
    const outboxFile = await writeOutbox(mail);
    return { ...result, outboxFile, mirrored: true };
  } catch (e) {
    emailLog.warn('email_outbox_mirror_failed', { error: e.message, to: mail.to });
    return result;
  }
}

async function trySendGridApi(mail, meta) {
  const info = await sendViaSendGridApi(mail);
  emailLog.info('email_sent', { ...meta, mode: 'sendgrid_api', messageId: info.messageId });
  return mirrorToOutboxIfDev(mail, {
    sent: true,
    mode: 'sendgrid_api',
    messageId: info.messageId,
    attempts: 1,
  });
}

async function trySmtp(mail, meta, cfg) {
  let lastError = null;
  for (let attempt = 1; attempt <= cfg.retries; attempt++) {
    try {
      const tx = await getTransporter();
      const info = await tx.sendMail(mail);
      emailLog.info('email_sent', { ...meta, attempt, mode: 'smtp', messageId: info.messageId });
      return mirrorToOutboxIfDev(mail, {
        sent: true,
        mode: 'smtp',
        messageId: info.messageId,
        attempts: attempt,
      });
    } catch (e) {
      lastError = e;
      emailLog.warn('email_send_retry', {
        ...meta,
        attempt,
        maxAttempts: cfg.retries,
        mode: 'smtp',
        error: e.message,
        code: e.code,
      });
      if (attempt < cfg.retries) await sleep(cfg.retryDelayMs * attempt);
    }
  }
  throw lastError;
}

/**
 * Send email: SendGrid HTTPS API → SMTP → dev outbox (last resort).
 */
export async function deliverEmail(payload) {
  const { to, subject, type = 'generic' } = payload;
  const cfg = getEmailConfig();
  const mail = buildMailOptions(payload);
  const meta = { type, to, subject, provider: cfg.provider };

  const hasApi = isSendGridApiConfigured();
  const hasSmtp = isSmtpConfigured();

  if (!hasApi && !hasSmtp) {
    if (shouldUseDevOutbox()) {
      const outboxFile = await writeOutbox(mail);
      return { sent: true, mode: 'outbox', attempts: 0, outboxFile };
    }
    const err = 'Email is not configured';
    emailLog.error('email_send_failed', { ...meta, error: err });
    return { sent: false, mode: 'none', error: err };
  }

  let lastError = null;

  if (hasApi) {
    for (let attempt = 1; attempt <= cfg.retries; attempt++) {
      try {
        return await trySendGridApi(mail, { ...meta, attempt });
      } catch (e) {
        lastError = e;
        emailLog.warn('sendgrid_api_retry', { ...meta, attempt, error: e.message, code: e.code });
        if (attempt < cfg.retries) await sleep(cfg.retryDelayMs * attempt);
      }
    }
  }

  if (hasSmtp) {
    try {
      return await trySmtp(mail, meta, cfg);
    } catch (e) {
      lastError = e;
    }
  }

  emailLog.error('email_send_failed', {
    ...meta,
    error: lastError?.message,
    code: lastError?.code,
  });

  if (shouldUseDevOutbox()) {
    const outboxFile = await writeOutbox(mail);
    return { sent: true, mode: 'outbox_fallback', error: lastError?.message, outboxFile };
  }

  throw Object.assign(new Error(lastError?.message || 'Email delivery failed'), {
    code: lastError?.code,
    status: 502,
  });
}

export function getTransportStatus() {
  const cfg = getEmailConfig();
  const hasApi = isSendGridApiConfigured();
  const hasSmtp = isSmtpConfigured();
  let mode = 'none';
  if (hasApi) mode = 'sendgrid_api';
  else if (hasSmtp) mode = 'smtp';
  else if (shouldUseDevOutbox()) mode = 'outbox';

  return {
    configured: hasApi || hasSmtp,
    sendGridApi: hasApi,
    verified: transporterVerified,
    provider: hasApi ? 'sendgrid_api' : cfg.provider,
    host: cfg.host || null,
    port: cfg.port,
    from: cfg.from || null,
    replyTo: cfg.replyTo || null,
    mode,
    retries: cfg.retries,
    devOutbox: shouldUseDevOutbox(),
    mirrorOutbox: shouldMirrorToDevOutbox(),
  };
}
