import type { Role } from '../context/AuthContext';

export const DISCUSSION_PARTICIPANT_ROLES: Role[] = ['STUDENT', 'LECTURER', 'HOD', 'DEPARTMENT_ADMIN'];
export const DISCUSSION_STAFF_ROLES: Role[] = ['LECTURER', 'HOD', 'DEPARTMENT_ADMIN'];

export function showsDiscussionFab(role?: string | null): boolean {
  if (!role) return true;
  return role !== 'FACULTY_ADMIN' && role !== 'SUPER_ADMIN';
}

export function isDiscussionParticipant(role?: string | null): boolean {
  return Boolean(role && DISCUSSION_PARTICIPANT_ROLES.includes(role as Role));
}

export function isDiscussionStaff(role?: string | null): boolean {
  return Boolean(role && DISCUSSION_STAFF_ROLES.includes(role as Role));
}
