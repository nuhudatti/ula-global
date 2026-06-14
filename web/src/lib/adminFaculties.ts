export type AdminFacultyRow = {
  id: string;
  name: string;
  code: string;
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  departmentCount: number;
  adminCount: number;
  createdAt: string;
  updatedAt: string;
};

export type FacultyAdminLifecycle = 'ACTIVE' | 'DEACTIVATED';

export type FacultyAdmin = {
  id: string;
  email: string;
  fullName: string;
  accountStatus: string;
  lifecycleStatus: FacultyAdminLifecycle;
  lastActiveAt: string | null;
  profilePhotoUrl: string | null;
  createdAt?: string;
};

export type FacultyAdminInvite = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  lifecycleStatus: 'PENDING' | 'EXPIRED' | 'REVOKED' | 'ACCEPTED';
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
};

export type AdminFacultyDetail = AdminFacultyRow & {
  admins: FacultyAdmin[];
  pendingInvites: FacultyAdminInvite[];
  lecturerCount: number;
};

export type PlatformOverview = {
  stats: {
    faculties: number;
    departments: number;
    activeUsers: number;
    liveResources: number;
  };
  recentFaculties: AdminFacultyRow[];
};

export type UserLookup = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  facultyId: string | null;
  accountStatus: string;
  faculty: { name: string } | null;
};

export type AdminSection = 'overview' | 'faculties' | 'institution' | 'resources';

export type InviteLinkResponse = {
  inviteUrl?: string;
  activationUrl?: string;
  devActivationUrl?: string;
  emailSent?: boolean;
  emailError?: string | null;
};

export type InviteAdminResult = InviteLinkResponse & {
  invite: FacultyAdminInvite;
};

export type ResendInviteResult = InviteLinkResponse;
