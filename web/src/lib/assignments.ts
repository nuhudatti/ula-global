import { buildApiHeaders } from './api';
import { downloadMySubmission, downloadQuestionPaper, downloadSecureStream } from './secureFile';
import type { FileAccess } from './secureFile';

export type AssignmentCourse = {
  id: string;
  code: string;
  title: string;
  level?: number | null;
  departmentId?: string;
  department?: {
    id: string;
    name: string;
    facultyId?: string;
    faculty?: { name: string; code: string };
  };
};

export type AssignmentStats = {
  totalStudents: number;
  submitted: number;
  late: number;
  pending: number;
  completionPct: number;
};

export type Assignment = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  dueAt: string;
  allowedTypes: string[];
  hasAttachment?: boolean;
  attachmentName?: string | null;
  attachmentAccess?: FileAccess | null;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  course?: AssignmentCourse;
  lecturerName?: string;
  mine?: boolean;
  forMe?: boolean;
  stats?: AssignmentStats;
  myStatus?: 'NOT_SUBMITTED' | 'SUBMITTED' | 'LATE';
  overdue?: boolean;
  mySubmission?: {
    id: string;
    status: string;
    submittedAt: string;
    fileName: string;
    fileAccess: FileAccess;
  } | null;
};

export type SubmissionRow = {
  id: string;
  studentName: string;
  matricNumber: string;
  email: string;
  submittedAt: string;
  status: 'SUBMITTED' | 'LATE';
  fileName: string;
  fileAccess: FileAccess;
  sizeBytes: number | null;
};

export const STUDENT_STATUS_META: Record<
  string,
  { label: string; cls: string }
> = {
  NOT_SUBMITTED: { label: 'Not submitted', cls: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { label: 'Submitted', cls: 'bg-emerald-50 text-emerald-700' },
  LATE: { label: 'Late', cls: 'bg-amber-50 text-amber-700' },
};

export function formatDue(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function dueCountdown(iso: string): { text: string; urgent: boolean; past: boolean } {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { text: 'Due date passed', urgent: true, past: true };
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return { text: `Due in ${Math.max(hours, 1)}h`, urgent: true, past: false };
  const days = Math.floor(hours / 24);
  return { text: `Due in ${days} day${days === 1 ? '' : 's'}`, urgent: days <= 2, past: false };
}

export { downloadQuestionPaper, downloadMySubmission };

/** Authenticated non-file endpoints (CSV / ZIP) — saves with server-provided name. */
export async function downloadAssignmentExport(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(path, { headers: buildApiHeaders() });
  if (!res.ok) {
    let msg = 'Download failed';
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const dispo = res.headers.get('Content-Disposition');
  const match = dispo ? /filename="([^"]+)"/i.exec(dispo) : null;
  const name = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Lecturer — download a single student submission via canonical file API. */
export function downloadSubmissionFile(submissionId: string, fileName: string): Promise<void> {
  return downloadSecureStream('assignment-submission', submissionId, fileName);
}
