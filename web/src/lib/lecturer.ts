export type LecturerSection =
  | 'dashboard'
  | 'courses'
  | 'assignments'
  | 'publish'
  | 'contributors'
  | 'inbox'
  | 'library'
  | 'analytics'
  | 'drafts'
  | 'department'
  | 'profile'
  | 'settings';

export type LecturerCourse = {
  id: string;
  code: string;
  title: string;
  level: number | null;
  departmentId: string;
  department: {
    name: string;
    faculty: { name: string; code: string };
  };
};

export type LecturerResource = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  examYear: number | null;
  hasFile: boolean;
  fileAccess: { kind: string; id: string };
  originalFileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  downloadCount: number;
  avgRating: number;
  ratingCount: number;
  createdAt: string;
  course: LecturerCourse;
};

export const PUBLISH_KINDS: { value: string; label: string; icon: string }[] = [
  { value: 'LECTURE_NOTES', label: 'Lecture notes', icon: 'fa-book-open' },
  { value: 'PAST_QUESTIONS', label: 'Past questions', icon: 'fa-file-lines' },
  { value: 'HANDOUT', label: 'Tutorial / Handout', icon: 'fa-scroll' },
  { value: 'ASSIGNMENT', label: 'Assignment', icon: 'fa-pen-to-square' },
  { value: 'PROJECT', label: 'Slides / Project', icon: 'fa-desktop' },
  { value: 'OTHER', label: 'Lab manual / Research', icon: 'fa-flask' },
];

export const KIND_LABEL: Record<string, string> = Object.fromEntries(
  PUBLISH_KINDS.map((k) => [k.value, k.label]),
);

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.replace(/_/g, ' ');
}

export function computeLecturerStats(resources: LecturerResource[], courses: LecturerCourse[]) {
  const totalDownloads = resources.reduce((s, r) => s + r.downloadCount, 0);
  const courseIds = new Set(resources.map((r) => r.course.id));
  const activeCourses = courseIds.size;
  const avgRating =
    resources.filter((r) => r.ratingCount > 0).length > 0
      ? resources.reduce((s, r) => s + r.avgRating, 0) / resources.filter((r) => r.ratingCount > 0).length
      : 0;

  const topByDownloads = [...resources].sort((a, b) => b.downloadCount - a.downloadCount).slice(0, 5);

  const byMonth = new Map<string, number>();
  for (const r of resources) {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const trend = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, count]) => ({ month, count }));

  return {
    totalResources: resources.length,
    totalDownloads,
    activeCourses,
    coursesAvailable: courses.length,
    avgRating,
    topByDownloads,
    trend,
  };
}

export function greetingName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`;
  return parts[0] ?? fullName;
}
