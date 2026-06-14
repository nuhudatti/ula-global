import { mapInstitutionPublic } from '../brandingPayload.js';

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

export function toEmailBranding(institution) {
  if (!institution) return null;
  const mapped = mapInstitutionPublic(institution);
  if (!mapped) return null;
  return {
    name: mapped.name,
    shortName: mapped.shortName,
    tagline: mapped.tagline || 'University Learning Archive',
    logoUrl: mapped.logoUrl || null,
    bannerUrl: mapped.bannerUrl || null,
    primaryColor: mapped.primaryColor || '#0f4c81',
    secondaryColor: mapped.secondaryColor || '#14532d',
  };
}

export function institutionDisplayName(branding) {
  if (!branding) return null;
  return branding.shortName || branding.name || null;
}
