export type SuggestPermission = {
  id: string;
  note: string | null;
  createdAt: string;
  student: { id: string; fullName: string; email: string; matricNumber?: string | null };
  pendingCount?: number;
};

export type StudentSearchHit = {
  id: string;
  fullName: string;
  email: string;
  matricNumber?: string | null;
  createdAt: string;
  alreadyGranted: boolean;
};

export type MaterialSuggestion = {
  id: string;
  title: string;
  reason: string;
  kind: string;
  examYear: number | null;
  status: string;
  rejectReason: string | null;
  hasFile: boolean;
  fileAccess: { kind: string; id: string };
  originalFileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  reviewedAt: string | null;
  student: { id: string; fullName: string; email: string; matricNumber?: string | null };
  course: { id: string; code: string; title: string };
  publishedResourceId?: string | null;
  lecturer?: { fullName: string };
};

export type StudentAccess = {
  canContribute: boolean;
  permissions: {
    id: string;
    note: string | null;
    lecturer: { id: string; fullName: string; email: string };
    createdAt: string;
  }[];
  pendingCount: number;
  maxPending: number;
  reason?: string;
};

export const SUGGEST_KINDS = [
  { value: 'PAST_QUESTIONS', label: 'Past questions', icon: 'fa-file-lines' },
  { value: 'HANDOUT', label: 'Tutorial / handout', icon: 'fa-scroll' },
  { value: 'LECTURE_NOTES', label: 'Lecture notes', icon: 'fa-book-open' },
  { value: 'ASSIGNMENT', label: 'Assignment', icon: 'fa-pen-to-square' },
  { value: 'OTHER', label: 'Other course material', icon: 'fa-folder' },
] as const;

export const SUGGEST_STATUS: Record<string, { label: string; tone: 'amber' | 'emerald' | 'slate' | 'rose' }> = {
  PENDING: { label: 'Awaiting review', tone: 'amber' },
  APPROVED: { label: 'Published', tone: 'emerald' },
  REJECTED: { label: 'Not accepted', tone: 'rose' },
};
