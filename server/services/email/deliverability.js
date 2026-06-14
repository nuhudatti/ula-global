import { getAppPublicUrl, getEmailConfig } from './config.js';

/** Headers and metadata that improve inbox placement for transactional mail. */
export function buildDeliverabilityHeaders({ type = 'transactional' } = {}) {
  return {
    'X-ULA-Email-Type': type,
    'X-Auto-Response-Suppress': 'All',
  };
}

export function getFromAddress() {
  const cfg = getEmailConfig();
  const configured = cfg.from?.trim();
  if (configured && configured.includes('<')) return configured;
  const name = cfg.fromName || 'ULA Platform';
  const email = configured || cfg.replyTo || 'noreply@ula.local';
  if (configured && !configured.includes('<')) return `${name} <${email}>`;
  return `${name} <${email}>`;
}

export function getReplyToAddress() {
  return getEmailConfig().replyTo?.trim() || undefined;
}

/** SendGrid-specific settings — disable tracking (spam trigger), force live send. */
export function getSendGridMailSettings() {
  return {
    sandboxMode: { enable: process.env.SENDGRID_SANDBOX === 'true' },
    bypassListManagement: { enable: true },
    footer: { enable: false },
    spamCheck: { enable: false },
  };
}

export function getSendGridTrackingSettings() {
  return {
    clickTracking: { enable: false, enableText: false },
    openTracking: { enable: false },
    subscriptionTracking: { enable: false },
    ganalytics: { enable: false },
  };
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function buildPlainLinkFallback(url, label = 'Open link') {
  const safe = String(url || '').trim();
  if (!safe) return '';
  const href = escapeAttr(safe);
  return `
    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;word-break:break-all">
      ${label}:<br>
      <a href="${href}" style="color:#0f4c81;text-decoration:underline">${href}</a>
    </p>`;
}

export function buildTransactionalFooter() {
  const reply = getEmailConfig().replyTo?.trim();
  const app = getAppPublicUrl();
  const lines = [
    'This is an automated message from ULA Platform.',
    reply ? `Questions? Reply to ${reply}` : null,
    app ? `App: ${app}` : null,
  ].filter(Boolean);
  return lines.join(' · ');
}
