import { emailLog } from './logger.js';
import {
  getSendGridMailSettings,
  getSendGridTrackingSettings,
} from './deliverability.js';

import { getSmtpPass } from './config.js';

function getApiKey() {
  return (process.env.SENDGRID_API_KEY || getSmtpPass() || '').trim();
}

export function isSendGridApiConfigured() {
  const key = getApiKey();
  return key.startsWith('SG.');
}

function parseFrom(from) {
  const raw = String(from || '').trim();
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { email: raw };
}

/** Send via SendGrid HTTPS API (port 443). */
export async function sendViaSendGridApi(mail) {
  const apiKey = getApiKey();
  if (!apiKey.startsWith('SG.')) {
    throw Object.assign(new Error('SendGrid API key not configured'), { code: 'SG_NO_KEY' });
  }

  const sgMail = (await import('@sendgrid/mail')).default;
  sgMail.setApiKey(apiKey);

  const from = parseFrom(mail.from);
  const msg = {
    to: mail.to,
    from,
    replyTo: mail.replyTo ? parseFrom(mail.replyTo).email || mail.replyTo : undefined,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: mail.headers,
    categories: ['ula-transactional'],
    mailSettings: getSendGridMailSettings(),
    trackingSettings: getSendGridTrackingSettings(),
  };

  try {
    const [response] = await sgMail.send(msg);
    const messageId = response?.headers?.['x-message-id'] || response?.headers?.['X-Message-Id'];
    emailLog.info('sendgrid_api_sent', {
      to: mail.to,
      subject: mail.subject,
      messageId,
      status: response?.statusCode,
      from: from.email,
    });
    return { messageId: messageId || `sg-${response?.statusCode || 202}` };
  } catch (e) {
    const detail = e?.response?.body?.errors?.[0]?.message || e.message;
    throw Object.assign(new Error(detail), {
      code: e.code || String(e?.response?.statusCode || 'SENDGRID_ERROR'),
    });
  }
}

/** Lightweight API check — does not send mail. */
export async function verifySendGridApi() {
  if (!isSendGridApiConfigured()) {
    return { ok: false, mode: 'sendgrid_api', error: 'SendGrid API key not configured' };
  }
  try {
    const key = getApiKey();
    const res = await fetch('https://api.sendgrid.com/v3/user/profile', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, mode: 'sendgrid_api', error: `API ${res.status}: ${body.slice(0, 120)}` };
    }
    return { ok: true, mode: 'sendgrid_api', sandbox: process.env.SENDGRID_SANDBOX === 'true' };
  } catch (e) {
    return { ok: false, mode: 'sendgrid_api', error: e.message, code: e.code };
  }
}
