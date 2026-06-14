export type FacultySection =
  | 'overview'
  | 'departments'
  | 'people'
  | 'catalog'
  | 'analytics'
  | 'audit'
  | 'settings';

export type FacultyAuditEntry = {
  id: string;
  category: 'publish' | 'invite' | 'suggestion' | 'governance' | string;
  title: string;
  description: string;
  actor: string;
  reference: string;
  status: string;
  at: string;
};

export type FacultyOverview = {
  stats: {
    departments: number;
    lecturers: number;
    hods: number;
    courses: number;
    liveResources: number;
    totalDownloads: number;
    pendingSuggestions: number;
    suggestionApprovalRate: number | null;
    engagementScore: number;
    growthPct: number;
  };
  activity: { id: string; type: string; label: string; meta: string; at: string }[];
  auditLog?: FacultyAuditEntry[];
};

export type FacultyDepartment = {
  id: string;
  name: string;
  createdAt: string;
  courseCount: number;
  userCount: number;
  staffCount?: number;
  lecturerCount: number;
  resourceCount: number;
  hod: { id: string; fullName: string; email: string; accountStatus: string } | null;
  pendingHodInvite?: {
    id: string;
    email: string;
    fullName: string;
    expiresAt: string;
    createdAt: string;
  } | null;
};

export type HodAssignCandidate = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department: { id: string; name: string };
};

export type FacultyPerson = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  departmentRole: string | null;
  accountStatus: string;
  staffId: string | null;
  profilePhotoUrl?: string | null;
  lastActiveAt?: string | null;
  updatedAt?: string;
  department: { id: string; name: string };
  _count: { uploads: number };
};

export type FacultyPendingInvite = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  departmentRole: string;
  createdAt: string;
  expiresAt: string;
  department: { id: string; name: string };
};

export type FacultyPersonnelTab = 'all' | 'active' | 'inactive' | 'pending';

export type FacultyCatalogCourse = {
  id: string;
  code: string;
  title: string;
  department: { id: string; name: string };
  resourceCount: number;
  publishers: string[];
};

export type FacultyAnalytics = {
  uploads30d: number;
  departmentGrowth: { id: string; name: string; resourceCount: number }[];
  topCourses: {
    id: string;
    code: string;
    title: string;
    departmentName: string;
    resourceCount: number;
  }[];
  suggestionBreakdown: { status: string; count: number }[];
};
