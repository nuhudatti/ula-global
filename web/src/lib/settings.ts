export type IdentityScope = 'profile' | 'department' | 'faculty' | 'institution';
export type ImageKind = 'photo' | 'logo' | 'banner';

export type SettingsProfile = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  bio: string | null;
  staffId: string | null;
  profilePhotoUrl: string | null;
  bannerUrl: string | null;
  canEdit: boolean;
};

export type SettingsOrg = {
  id: string;
  name: string;
  tagline?: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  logoPlacement?: LogoPlacement;
  canEdit: boolean;
  code?: string;
  shortName?: string;
  facultyName?: string;
};

export type IdentityScopes = {
  profile: boolean;
  department: boolean;
  faculty: boolean;
  institution: boolean;
};

export type SettingsContext = {
  scopes: IdentityScopes;
  profile: SettingsProfile;
  department: SettingsOrg | null;
  faculty: SettingsOrg | null;
  institution: SettingsOrg | null;
};

export type LogoPlacement = 'left' | 'right';

export type InstitutionPublic = {
  id: string;
  name: string;
  shortName: string;
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  logoPlacement?: LogoPlacement;
  updatedAt?: string;
};
