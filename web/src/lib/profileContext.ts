import type { User } from '../context/AuthContext';
import type { SettingsContext } from './settings';

/** Minimal settings context from the signed-in user when the API is temporarily unavailable. */
export function profileContextFromUser(user: User): SettingsContext {
  const department = ['HOD', 'DEPARTMENT_ADMIN'].includes(user.role);
  const faculty = user.role === 'FACULTY_ADMIN';
  const institution = user.role === 'SUPER_ADMIN';

  return {
    scopes: {
      profile: true,
      department,
      faculty,
      institution,
    },
    profile: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      bio: user.bio ?? null,
      staffId: null,
      profilePhotoUrl: user.profilePhotoUrl ?? null,
      bannerUrl: user.bannerUrl ?? null,
      canEdit: true,
    },
    department: null,
    faculty: null,
    institution: null,
  };
}
