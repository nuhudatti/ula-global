export type DiscussionTopic = 'GENERAL' | 'ASSIGNMENT' | 'LECTURE' | 'EXAM';

export type DiscussionPost = {
  id: string;
  courseId: string;
  parentId: string | null;
  topic: DiscussionTopic;
  body: string;
  createdAt: string;
  rel: string;
  replyCount: number;
  author: {
    id: string;
    fullName: string;
    role: string;
    profilePhotoUrl?: string | null;
  };
  course?: {
    code: string;
    title: string;
    departmentName?: string;
  };
  repliedTo?: {
    id: string;
    authorId: string | null;
    authorName: string;
    preview: string;
  } | null;
};

export const TOPIC_LABELS: Record<DiscussionTopic, string> = {
  GENERAL: 'General',
  ASSIGNMENT: 'Assignment',
  LECTURE: 'Lecture',
  EXAM: 'Exam prep',
};

export function roleBadge(role: string): { label: string; tone: 'student' | 'lecturer' | 'staff' } {
  if (role === 'LECTURER') return { label: 'Lecturer', tone: 'lecturer' };
  if (role === 'HOD' || role === 'DEPARTMENT_ADMIN') return { label: 'Staff', tone: 'staff' };
  return { label: 'Student', tone: 'student' };
}
