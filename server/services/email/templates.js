import { buildPlainLinkFallback, buildTransactionalFooter } from './deliverability.js';
import { institutionDisplayName } from './emailBranding.js';

/** Responsive, institution-branded ULA email templates. */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(String(value ?? ''));
}

export function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderInstitutionHeader(branding) {
  if (!branding) {
    return `
      <tr>
        <td style="padding:28px 32px 20px;border-bottom:1px solid #e2e8f0;background:#ffffff">
          <p style="margin:0;font-size:20px;font-weight:700;color:#0f4c81;line-height:1.3">ULA Global</p>
          <p style="margin:6px 0 0;font-size:13px;color:#64748b">University Learning Architecture</p>
        </td>
      </tr>`;
  }

  const primary = escapeAttr(branding.primaryColor || '#0f4c81');
  const secondary = escapeAttr(branding.secondaryColor || '#14532d');
  const title = escapeHtml(branding.shortName || branding.name);
  const fullName = escapeHtml(branding.name);
  const tagline = escapeHtml(branding.tagline || 'University Learning Archive');
  const logo = branding.logoUrl
    ? `<img src="${escapeAttr(branding.logoUrl)}" alt="${title} logo" width="52" height="52" style="display:block;border-radius:10px;object-fit:contain;background:#ffffff" />`
    : `<div style="width:52px;height:52px;border-radius:10px;background:${primary};color:#fff;font-size:14px;font-weight:700;line-height:52px;text-align:center">${escapeHtml((branding.shortName || 'ULA').slice(0, 2).toUpperCase())}</div>`;

  const banner = branding.bannerUrl
    ? `<tr>
        <td style="padding:0;line-height:0">
          <img src="${escapeAttr(branding.bannerUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;max-height:120px;object-fit:cover" />
        </td>
      </tr>`
    : '';

  return `
    ${banner}
    <tr>
      <td style="padding:0;border-bottom:1px solid #e2e8f0;background:linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:24px 32px">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px">${logo}</td>
                  <td style="vertical-align:middle">
                    <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.25">${title} <span style="font-size:13px;font-weight:600;opacity:0.9">ULA</span></p>
                    <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.88)">${fullName}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.75)">${tagline}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.bodyHtml
 * @param {object} [opts.branding] - institution logo, colors, banner
 * @param {string} [opts.institutionName] - legacy fallback
 */
export function renderEmailDocument({
  title,
  bodyHtml,
  preheader,
  ctaLabel,
  ctaUrl,
  footer,
  institutionName,
  branding,
}) {
  const brand = branding || (institutionName ? { shortName: institutionName, name: institutionName } : null);
  const primary = escapeAttr(brand?.primaryColor || '#0f4c81');
  const display = institutionDisplayName(brand) || institutionName || 'ULA';
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader || `${display} — ${title}`);
  const safeFooter = escapeHtml(
    footer || (brand ? `${display} · ULA Platform` : buildTransactionalFooter()),
  );

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
          <tr>
            <td style="padding:8px 32px 28px">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:10px;background:${primary}">
                    <a href="${escapeAttr(ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(ctaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,system-ui,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${safePreheader}&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08)">
          ${renderInstitutionHeader(brand)}
          <tr>
            <td style="padding:28px 32px 8px">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.35">${safeTitle}</h1>
              <div style="font-size:15px;line-height:1.65;color:#334155">${bodyHtml}</div>
            </td>
          </tr>
          ${ctaBlock}
          ${
            ctaUrl
              ? `<tr><td style="padding:0 32px 8px">${buildPlainLinkFallback(ctaUrl, 'If the button does not work, use this link')}</td></tr>`
              : ''
          }
          <tr>
            <td style="padding:8px 32px 28px">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8">${safeFooter}</p>
              <p style="margin:10px 0 0;font-size:11px;line-height:1.5;color:#cbd5e1">Official message from ${escapeHtml(display)} via ULA Platform. If this landed in Junk or Spam, mark it as <strong>Not spam</strong> so future university mail reaches your inbox.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const plainBody = [
    brand ? `${display} (ULA Platform)` : 'ULA Platform',
    title,
    '',
    htmlToPlainText(bodyHtml),
    ctaUrl ? `\n${ctaLabel || 'Link'}: ${ctaUrl}` : '',
    '',
    footer || (brand ? `${display} · ULA Platform` : buildTransactionalFooter()),
    'If this email is in Junk/Spam, mark it as Not spam for future messages.',
  ]
    .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n');

  return { html, text: plainBody };
}

export function otpBlock(label, code, primaryColor = '#0f4c81') {
  const accent = escapeAttr(primaryColor);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
      <tr>
        <td style="padding:18px 20px">
          <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">${escapeHtml(label)}</p>
          <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:0.2em;color:${accent};font-family:Consolas,Monaco,monospace">${escapeHtml(code)}</p>
        </td>
      </tr>
    </table>`;
}
