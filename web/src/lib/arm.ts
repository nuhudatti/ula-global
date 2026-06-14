import type { InviteLinkResponse } from './adminFaculties';

export type ArmSection = 'dashboard' | 'publish' | 'library';

export type ArmFaculty = { id: string; name: string; code: string };
export type ArmDepartment = { id: string; name: string; facultyId: string };
export type ArmCourse = {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  level: number | null;
  semester?: string | null;
};

export type ArmResource = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  sourceType: string;
  semester: string | null;
  examYear: number | null;
  governanceStatus: string;
  hasFile: boolean;
  fileAccess: { kind: string; id: string };
  originalFileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  downloadCount: number;
  avgRating: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  course: {
    id: string;
    code: string;
    title: string;
    level: number | null;
    semester?: string | null;
    department: {
      id: string;
      name: string;
      faculty: { id: string; name: string; code: string };
    };
  };
  uploadedBy?: { id: string; fullName: string; email: string; role?: string };
};

export type ArmManagerUser = {
  id: string;
  email: string;
  fullName: string;
  accountStatus: string;
  mustChangePassword: boolean;
  lastActiveAt: string | null;
  createdAt: string;
};

export type ArmManagerInvite = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  resentCount?: number;
};

export type ArmManagerRow = {
  type: 'active' | 'pending';
  user: ArmManagerUser | null;
  invite: ArmManagerInvite | null;
  invitationStatus: string;
};

export type ArmInviteResult = InviteLinkResponse & {
  invite: ArmManagerInvite;
  invitationStatus: string;
};

export const ARM_PUBLISH_KINDS: { value: string; label: string; icon: string }[] = [
  { value: 'PAST_QUESTIONS', label: 'Past questions', icon: 'fa-file-lines' },
  { value: 'LECTURE_NOTES', label: 'Lecture notes', icon: 'fa-book-open' },
  { value: 'HANDOUT', label: 'Handout', icon: 'fa-scroll' },
  { value: 'LAB_MANUAL', label: 'Lab manual', icon: 'fa-flask' },
  { value: 'ASSIGNMENT', label: 'Assignment', icon: 'fa-pen-to-square' },
  { value: 'PROJECT', label: 'Course materials', icon: 'fa-desktop' },
  { value: 'OTHER', label: 'Other', icon: 'fa-folder' },
];

export const SOURCE_TYPE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'INSTITUTION', label: 'Institution', hint: 'Official material from your university' },
  { value: 'ULA_TEAM', label: 'ULA Team', hint: 'Curated or verified by the ULA platform team' },
  { value: 'LECTURER', label: 'Lecturer', hint: 'Attributed to a lecturer contributor' },
];

export const SEMESTER_OPTIONS = [
  { value: 'FIRST', label: 'First semester' },
  { value: 'SECOND', label: 'Second semester' },
  { value: 'HARMATTAN', label: 'Harmattan' },
  { value: 'RAIN', label: 'Rain' },
];

export const LEVEL_OPTIONS = ['100', '200', '300', '400', '500'] as const;

export const GOVERNANCE_LABELS: Record<string, string> = {
  VERIFIED: 'Published',
  PUBLISHED: 'Published',
  PENDING_REVIEW: 'Pending review',
  ARCHIVED: 'Archived',
  REJECTED: 'Rejected',
};

export function armKindLabel(kind: string): string {
  return ARM_PUBLISH_KINDS.find((k) => k.value === kind)?.label ?? kind.replace(/_/g, ' ');
}

export function sourceTypeLabel(source: string): string {
  return SOURCE_TYPE_OPTIONS.find((s) => s.value === source)?.label ?? source.replace(/_/g, ' ');
}
