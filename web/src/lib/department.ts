export type DepartmentSection =
  | 'overview'
  | 'audit'
  | 'lecturers'
  | 'courses'
  | 'resources'
  | 'analytics'
  | 'notices'
  | 'verification'
  | 'settings';

export type AccountStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'UNVERIFIED';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export type DeptInvitation = {
  id: string;
  email: string;
  fullName: string;
  staffId?: string | null;
  departmentRole: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
  invitedBy?: string | null;
  institutionName?: string | null;
  departmentName?: string | null;
  inviteUrl: string;
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export type DeptAuditEntry = {
  id: string;
  category: 'publish' | 'invite' | 'lecturer' | 'governance';
  title: string;
  description: string;
  actor: string;
  reference: string;
  status: string;
  at: string;
};

export type DeptOverview = {
  stats: {
    lecturers: number;
    courses: number;
    publishedMaterials: number;
    totalDownloads: number;
    pendingVerification: number;
    studentEngagement: number;
    engagementScore?: number;
  };
  recentUploads: {
    id: string;
    title: string;
    kind: string;
    createdAt: string;
    governanceStatus: string;
    uploadedBy: { fullName: string };
    course: { code: string; title: string };
  }[];
  activity: {
    id: string;
    type: string;
    label: string;
    meta: string;
    at: string;
  }[];
  auditLog?: DeptAuditEntry[];
  policy?: { lecturerPublishing: string; requiresApproval: boolean };
  recentLecturerActions: {
    id: string;
    fullName: string;
    email: string;
    accountStatus: string;
    _count: { uploads: number };
  }[];
};

export type DeptLecturer = {
  id: string;
  fullName: string;
  email: string;
  profilePhotoUrl?: string | null;
  staffId: string | null;
  accountStatus: string;
  departmentRole: string | null;
  canUpload: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { uploads: number };
};

export type DeptCourse = {
  id: string;
  code: string;
  title: string;
  resourceCount: number;
  publishers?: { id: string; fullName: string }[];
};

export type DeptResource = {
  id: string;
  title: string;
  kind: string;
  governanceStatus: string;
  downloadCount: number;
  createdAt: string;
  uploadedBy: { id: string; fullName: string; email: string };
  course: { code: string; title: string };
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  UNVERIFIED: 'Unverified',
};

export const GOVERNANCE_LABELS: Record<string, string> = {
  PUBLISHED: 'Live',
  PENDING_REVIEW: 'Pending review',
  VERIFIED: 'Live',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
};

/** Lecturer uploads are trusted — already visible without HOD approval. */
export function isResourceLive(status: string) {
  return status === 'VERIFIED' || status === 'PUBLISHED';
}
