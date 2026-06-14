import type { InstitutionPublic } from './settings';
import type { ScopeBranding } from '../context/BrandingContext';

export type IdentityUploadResult = {
  url: string | null;
  kind: string;
  scope: string;
  institution?: InstitutionPublic | null;
  faculty?: ScopeBranding | null;
  department?: ScopeBranding | null;
  profile?: { profilePhotoUrl?: string | null; bannerUrl?: string | null } | null;
};
