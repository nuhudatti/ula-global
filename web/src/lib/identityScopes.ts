import type { Role } from '../context/AuthContext';
import type { IdentityScopes, SettingsContext } from './settings';

type PanelVariant =
  | 'lecturer'
  | 'department'
  | 'department-only'
  | 'faculty'
  | 'faculty-scoped'
  | 'institution-only'
  | 'auto';

/** Which identity tabs a user may see — scoped by role and workspace context. */
export function resolveIdentityScopes(
  ctx: SettingsContext | null,
  variant: PanelVariant = 'auto',
): IdentityScopes {
  const apiScopes = ctx?.scopes ?? {
    profile: true,
    department: false,
    faculty: false,
    institution: false,
  };

  if (variant === 'lecturer') {
    return { profile: true, department: false, faculty: false, institution: false };
  }
  if (variant === 'department') {
    return {
      profile: true,
      department: apiScopes.department,
      faculty: false,
      institution: false,
    };
  }
  if (variant === 'department-only') {
    return {
      profile: false,
      department: apiScopes.department,
      faculty: false,
      institution: false,
    };
  }
  if (variant === 'faculty') {
    return {
      profile: true,
      department: false,
      faculty: apiScopes.faculty,
      institution: false,
    };
  }
  if (variant === 'faculty-scoped') {
    return {
      profile: true,
      department: false,
      faculty: apiScopes.faculty,
      institution: false,
    };
  }
  if (variant === 'institution-only') {
    return {
      profile: false,
      department: false,
      faculty: false,
      institution: apiScopes.institution,
    };
  }

  return apiScopes;
}

export function defaultIdentityTab(
  scopes: IdentityScopes,
  variant: PanelVariant,
): 'profile' | 'department' | 'faculty' | 'institution' {
  if ((variant === 'department' || variant === 'department-only') && scopes.department) return 'department';
  if ((variant === 'faculty' || variant === 'faculty-scoped') && scopes.faculty) return 'faculty';
  if (variant === 'institution-only' && scopes.institution) return 'institution';
  return 'profile';
}

export function identityPanelTitle(role: Role | string | undefined, scopes: IdentityScopes): string {
  const orgTabs = [scopes.department, scopes.faculty, scopes.institution].filter(Boolean).length;
  if (orgTabs === 0 || role === 'STUDENT' || role === 'LECTURER') {
    return 'Manage your personal profile';
  }
  if (scopes.department && !scopes.faculty && !scopes.institution) {
    return 'Personal profile & department identity';
  }
  if (scopes.faculty && !scopes.institution) {
    return 'Personal profile & faculty identity';
  }
  if (scopes.institution && !scopes.profile) {
    return 'Institution branding';
  }
  if (scopes.institution) {
    return 'Personal profile & institution branding';
  }
  if (scopes.faculty && !scopes.profile) {
    return 'Faculty branding';
  }
  return 'Manage your academic presence';
}
