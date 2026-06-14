import type { IdentityUploadResult } from './brandingUpload';
import type { InstitutionPublic } from './settings';
import type { ScopeBranding } from '../context/BrandingContext';

export function brandingMessage(result: IdentityUploadResult): string {
  const kind =
    result.kind === 'banner' ? 'Banner' : result.kind === 'photo' ? 'Profile photo' : 'Logo';
  if (result.scope === 'institution') {
    return `${kind} saved — now visible on browse, login, and every workspace.`;
  }
  if (result.scope === 'profile') {
    return `${kind} saved — updated on your profile and workspace.`;
  }
  return `${kind} saved — updated in your ${result.scope} workspace.`;
}

export type BrandingSyncFns = {
  applyUploadBranding: (result: IdentityUploadResult, options?: { syncScope?: boolean }) => void;
  refreshInstitution: () => Promise<void>;
  refreshScope: () => Promise<void>;
};

export async function syncBrandingAfterUpload(
  result: IdentityUploadResult,
  fns: BrandingSyncFns,
  options?: { syncScope?: boolean }
) {
  const syncScope = options?.syncScope !== false;
  fns.applyUploadBranding(result, { syncScope });

  if (result.institution) {
    await fns.refreshInstitution();
  }
  if (syncScope && (result.faculty || result.department)) {
    await fns.refreshScope();
  }

  window.dispatchEvent(new CustomEvent('ula-branding-changed', { detail: result }));
}

export function patchSettingsContext<T extends {
  profile: { profilePhotoUrl?: string | null; bannerUrl?: string | null };
  department?: { logoUrl?: string | null; bannerUrl?: string | null } | null;
  faculty?: { logoUrl?: string | null; bannerUrl?: string | null } | null;
  institution?: InstitutionPublic | null;
}>(ctx: T, result: IdentityUploadResult): T {
  const next = { ...ctx, profile: { ...ctx.profile } };
  const field = result.kind === 'photo' ? 'photo' : result.kind === 'banner' ? 'banner' : 'logo';

  if (result.scope === 'profile') {
    if (result.profile) {
      next.profile = { ...next.profile, ...result.profile };
    } else if (field === 'photo') {
      next.profile = { ...next.profile, profilePhotoUrl: result.url };
    } else if (field === 'banner') {
      next.profile = { ...next.profile, bannerUrl: result.url };
    }
  }

  if (result.scope === 'department' && next.department) {
    next.department = result.department
      ? { ...next.department, ...result.department }
      : {
          ...next.department,
          logoUrl: field === 'logo' ? result.url : next.department.logoUrl,
          bannerUrl: field === 'banner' ? result.url : next.department.bannerUrl,
        };
  }

  if (result.scope === 'faculty' && next.faculty) {
    next.faculty = result.faculty
      ? { ...next.faculty, ...(result.faculty as ScopeBranding) }
      : {
          ...next.faculty,
          logoUrl: field === 'logo' ? result.url : next.faculty.logoUrl,
          bannerUrl: field === 'banner' ? result.url : next.faculty.bannerUrl,
        };
  }

  if (result.scope === 'institution' && next.institution) {
    next.institution = result.institution
      ? { ...next.institution, ...result.institution }
      : {
          ...next.institution,
          logoUrl: field === 'logo' ? result.url : next.institution.logoUrl,
          bannerUrl: field === 'banner' ? result.url : next.institution.bannerUrl,
        };
  }

  return next;
}
