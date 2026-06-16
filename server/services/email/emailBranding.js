import { mapInstitutionPublic } from '../brandingPayload.js';
import { getPublicBaseUrl } from './config.js';

/** Prisma select for institution fields used in transactional email. */
export const INSTITUTION_EMAIL_SELECT = {
  slug: true,
  name: true,
  shortName: true,
  tagline: true,
  logoUrl: true,
  bannerUrl: true,
  primaryColor: true,
  secondaryColor: true,
  logoPlacement: true,
};

/** Email clients (especially mobile) require absolute https:// image URLs. */
export function ensureEmailSafeImageUrl(url) {
  if (!url?.trim()) return null;
  let value = String(url).trim();

  if (value.startsWith('/')) {
    const base = getPublicBaseUrl();
    if (!base) return null;
    value = `${base.replace(/\/$/, '')}${value}`;
  }

  if (value.startsWith('http://')) {
    value = `https://${value.slice(7)}`;
  }

  if (!value.startsWith('https://')) return null;

  // Cloudinary authenticated URLs do not render in email — prefer public delivery
  if (value.includes('res.cloudinary.com') && value.includes('/authenticated/')) {
    value = value.replace('/authenticated/', '/upload/');
  }

  return value;
}

export function toEmailBranding(institution) {
  if (!institution) return null;
  const mapped = mapInstitutionPublic(institution);
  if (!mapped) return null;
  return {
    name: mapped.name,
    shortName: mapped.shortName,
    tagline: mapped.tagline || 'University Learning Archive',
    logoUrl: ensureEmailSafeImageUrl(mapped.logoUrl),
    bannerUrl: ensureEmailSafeImageUrl(mapped.bannerUrl),
    primaryColor: mapped.primaryColor || '#0f4c81',
    secondaryColor: mapped.secondaryColor || '#14532d',
  };
}

export function institutionDisplayName(branding) {
  if (!branding) return null;
  return branding.shortName || branding.name || null;
}
