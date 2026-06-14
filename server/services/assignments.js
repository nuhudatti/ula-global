import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fetchFileBuffer } from './cloudinaryService.js';
import { assignmentInstitutionWhere, courseInstitutionWhere } from './tenantScope.js';
import {
  buildFileAccess,
  FILE_KIND,
  removeAppFile,
  sanitizeSubmissionFile,
  uploadAppFile,
  uploadWithRollback,
} from './fileService.js';

const prisma = new PrismaClient();

export const ASSIGNMENT_FILE_TYPES = ['pdf', 'docx', 'pptx', 'zip', 'png', 'jpg'];
export const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024; // 25 MB

const MIME_BY_EXT = {
  pdf: ['application/pdf'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
  pptx: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
  ],
  zip: ['application/zip', 'application/x-zip-compressed'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
};

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeAllowedTypes(input) {
  if (!input) return ASSIGNMENT_FILE_TYPES.join(',');
  const list = (Array.isArray(input) ? input : String(input).split(','))
    .map((t) => String(t).trim().toLowerCase().replace(/^\./, ''))
    .map((t) => (t === 'jpeg' ? 'jpg' : t))
    .filter((t) => ASSIGNMENT_FILE_TYPES.includes(t));
  if (!list.length) return ASSIGNMENT_FILE_TYPES.join(',');
  return [...new Set(list)].join(',');
}

export function fileExtOf(name) {
  const ext = path.extname(name || '').toLowerCase().replace('.', '');
  return ext === 'jpeg' ? 'jpg' : ext;
}

function submissionStatusFor(assignment, submittedAt) {
  return submittedAt > assignment.dueAt ? 'LATE' : 'SUBMITTED';
}

async function loadStaffContext(userId, institutionId = null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, departmentId: true, fullName: true, institutionId: true },
  });
  if (!user || !['LECTURER', 'HOD', 'DEPARTMENT_ADMIN'].includes(user.role)) {
    throw httpError(403, 'Lecturer account required');
  }
  if (!user.departmentId) throw httpError(403, 'No department assigned to your account');
  if (institutionId && user.institutionId !== institutionId) {
    throw httpError(403, 'Access denied for this institution');
  }
  return user;
}

async function loadOwnedAssignment(assignmentId, lecturerId, institutionId = null) {
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      ...(institutionId ? assignmentInstitutionWhere(institutionId) : {}),
    },
    include: { course: { select: { id: true, code: true, title: true, departmentId: true } } },
  });
  if (!assignment) throw httpError(404, 'Assignment not found');
  const staff = await loadStaffContext(lecturerId, institutionId);
  const owns =
    assignment.lecturerId === lecturerId ||
    (['HOD', 'DEPARTMENT_ADMIN'].includes(staff.role) &&
      assignment.course.departmentId === staff.departmentId);
  if (!owns) throw httpError(403, 'You can only manage assignments you created');
  return assignment;
}

async function countDepartmentStudents(departmentId) {
  return prisma.user.count({
    where: { role: 'STUDENT', departmentId, accountStatus: 'ACTIVE' },
  });
}

function mapAssignment(row, extra = {}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    dueAt: row.dueAt,
    allowedTypes: row.allowedTypes.split(','),
    hasAttachment: Boolean(row.attachmentUrl || row.attachmentCloudinaryPublicId),
    attachmentName: row.attachmentName ?? null,
    attachmentAccess: row.attachmentUrl || row.attachmentCloudinaryPublicId
      ? buildFileAccess(FILE_KIND.ASSIGNMENT_ATTACHMENT, row.id)
      : null,
    status: row.status,
    createdAt: row.createdAt,
    course: row.course
      ? {
          id: row.course.id,
          code: row.course.code,
          title: row.course.title,
          level: row.course.level ?? null,
          departmentId: row.course.departmentId ?? undefined,
          department: row.course.department
            ? {
                id: row.course.department.id,
                name: row.course.department.name,
                facultyId: row.course.department.facultyId,
                faculty: row.course.department.faculty
                  ? { name: row.course.department.faculty.name, code: row.course.department.faculty.code }
                  : undefined,
              }
            : undefined,
        }
      : undefined,
    lecturerName: row.lecturer?.fullName,
    ...extra,
  };
}

/** Lecturer creates an assignment for one of their department courses. */
export async function createAssignment({
  lecturerId,
  courseId,
  title,
  description,
  instructions,
  dueAt,
  allowedTypes,
  attachment,
  institutionId = null,
}) {
  const staff = await loadStaffContext(lecturerId, institutionId);

  const cleanTitle = String(title || '').trim();
  if (cleanTitle.length < 3 || cleanTitle.length > 160) {
    throw httpError(400, 'Title must be between 3 and 160 characters');
  }
  const due = new Date(dueAt);
  if (!dueAt || Number.isNaN(due.getTime())) throw httpError(400, 'A valid due date is required');
  if (due.getTime() < Date.now()) throw httpError(400, 'Due date must be in the future');

  const course = await prisma.course.findFirst({
    where: {
      id: courseId || '',
      ...(institutionId ? courseInstitutionWhere(institutionId) : {}),
    },
    select: { id: true, departmentId: true, code: true, title: true },
  });
  if (!course) throw httpError(404, 'Course not found');
  if (course.departmentId !== staff.departmentId) {
    throw httpError(403, 'You can only post assignments for your department courses');
  }

  const row = await prisma.assignment.create({
    data: {
      courseId: course.id,
      lecturerId: staff.id,
      title: cleanTitle,
      description: String(description || '').trim() || null,
      instructions: String(instructions || '').trim() || null,
      dueAt: due,
      allowedTypes: normalizeAllowedTypes(allowedTypes),
      attachmentUrl: attachment?.fileUrl ?? null,
      attachmentName: attachment?.name ?? null,
      attachmentCloudinaryPublicId: attachment?.publicId ?? null,
    },
    include: { course: { select: { id: true, code: true, title: true } } },
  });
  return mapAssignment(row);
}

/**
 * Public feed — assignments appear next to resources in the catalogue.
 * Everyone can see them; only the signed-in student gets their own status.
 */
export async function listAssignmentFeed({ userId, userRole, institutionId = null, take = 100 }) {
  const isStudent = userRole === 'STUDENT' && userId;
  if (isStudent) {
    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { institutionId: true },
    });
    if (institutionId && student?.institutionId !== institutionId) {
      return [];
    }
  }
  const rows = await prisma.assignment.findMany({
    where: {
      status: 'OPEN',
      ...(institutionId ? assignmentInstitutionWhere(institutionId) : {}),
    },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    take: Math.min(Number(take) || 100, 200),
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          level: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
              facultyId: true,
              faculty: { select: { name: true, code: true } },
            },
          },
        },
      },
      lecturer: { select: { fullName: true } },
      ...(isStudent
        ? {
            submissions: {
              where: { studentId: userId },
              select: { id: true, status: true, submittedAt: true, originalFileName: true },
            },
          }
        : {}),
    },
  });

  return rows.map((row) => {
    const mine = isStudent ? (row.submissions?.[0] ?? null) : null;
    return mapAssignment(row, {
      myStatus: isStudent ? (mine ? mine.status : 'NOT_SUBMITTED') : undefined,
      mySubmission: isStudent && mine ? sanitizeSubmissionFile(mine) : null,
    });
  });
}

/** Lecturer dashboard — assignments with submission stats. */
export async function listLecturerAssignments(lecturerId, institutionId = null) {
  const staff = await loadStaffContext(lecturerId, institutionId);
  const scopeFilter =
    staff.role === 'LECTURER'
      ? { lecturerId: staff.id }
      : { course: { departmentId: staff.departmentId } };
  const rows = await prisma.assignment.findMany({
    where: {
      AND: [
        scopeFilter,
        ...(institutionId ? [assignmentInstitutionWhere(institutionId)] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      course: { select: { id: true, code: true, title: true, departmentId: true } },
      lecturer: { select: { fullName: true } },
      submissions: { select: { status: true } },
    },
  });

  const totalStudents = await countDepartmentStudents(staff.departmentId);

  return rows.map((row) => {
    const submitted = row.submissions.length;
    const late = row.submissions.filter((s) => s.status === 'LATE').length;
    const pending = Math.max(totalStudents - submitted, 0);
    return mapAssignment(row, {
      mine: row.lecturerId === lecturerId,
      stats: {
        totalStudents,
        submitted,
        late,
        pending,
        completionPct: totalStudents > 0 ? Math.round((submitted / totalStudents) * 100) : 0,
      },
    });
  });
}

/** Student view — open institution assignments with own submission status. */
export async function listStudentAssignments(studentId, institutionId = null) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true, institutionId: true },
  });
  if (!student || student.role !== 'STUDENT') throw httpError(403, 'Student account required');
  if (institutionId && student.institutionId !== institutionId) throw httpError(403, 'Access denied for this institution');

  const rows = await prisma.assignment.findMany({
    where: {
      AND: [
        { status: 'OPEN' },
        ...(institutionId ? [assignmentInstitutionWhere(institutionId)] : []),
      ],
    },
    orderBy: { dueAt: 'asc' },
    include: {
      course: { select: { id: true, code: true, title: true } },
      lecturer: { select: { fullName: true } },
      submissions: {
        where: { studentId },
        select: { id: true, status: true, submittedAt: true, originalFileName: true },
      },
    },
  });

  return rows.map((row) => {
    const mine = row.submissions[0] ?? null;
    return mapAssignment(row, {
      mySubmission: mine ? sanitizeSubmissionFile(mine) : null,
      myStatus: mine ? mine.status : 'NOT_SUBMITTED',
      overdue: !mine && row.dueAt.getTime() < Date.now(),
    });
  });
}

/** Student submits (or resubmits before close). Identity comes from session only. */
export async function submitAssignment({ assignmentId, studentId, file, saveFile, institutionId = null }) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true, departmentId: true, fullName: true, matricNumber: true, institutionId: true },
  });
  if (!student || student.role !== 'STUDENT') throw httpError(403, 'Student account required');
  if (institutionId && student.institutionId !== institutionId) throw httpError(403, 'Access denied for this institution');

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      ...(institutionId ? assignmentInstitutionWhere(institutionId) : {}),
    },
    include: { course: { select: { departmentId: true, code: true } } },
  });
  if (!assignment) throw httpError(404, 'Assignment not found');
  if (assignment.status === 'CLOSED') throw httpError(400, 'This assignment is closed');
  if (assignment.dueAt.getTime() < Date.now()) {
    throw httpError(400, 'The due date has passed — submissions are closed');
  }

  if (!file || !file.buffer?.length) throw httpError(400, 'Attach your work before submitting');
  if (file.size > MAX_SUBMISSION_BYTES) throw httpError(400, 'File too large (max 25 MB)');

  const allowed = assignment.allowedTypes.split(',');
  const ext = fileExtOf(file.originalname);
  if (!allowed.includes(ext)) {
    throw httpError(400, `Allowed file types: ${allowed.map((t) => t.toUpperCase()).join(', ')}`);
  }
  const mimeOk = (MIME_BY_EXT[ext] || []).includes(file.mimetype) || !file.mimetype;
  if (!mimeOk && ext !== 'zip') {
    throw httpError(400, 'File content does not match its extension');
  }

  const prior = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    select: { cloudinaryPublicId: true },
  });

  const now = new Date();
  const status = submissionStatusFor(assignment, now);

  const row = await uploadWithRollback({
    upload: () =>
      saveFile
        ? saveFile(file.buffer, file.originalname, file)
        : uploadAppFile({
            buffer: file.buffer,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            subfolder: 'assignments/submissions',
            maxBytes: MAX_SUBMISSION_BYTES,
            userId: studentId,
          }),
    persist: async (stored) =>
      prisma.assignmentSubmission.upsert({
        where: { assignmentId_studentId: { assignmentId, studentId } },
        create: {
          assignmentId,
          studentId,
          fileUrl: stored.fileUrl,
          cloudinaryPublicId: stored.publicId ?? null,
          originalFileName: file.originalname,
          mimeType: file.mimetype || null,
          sizeBytes: file.size,
          status,
          submittedAt: now,
        },
        update: {
          fileUrl: stored.fileUrl,
          cloudinaryPublicId: stored.publicId ?? null,
          originalFileName: file.originalname,
          mimeType: file.mimetype || null,
          sizeBytes: file.size,
          status,
          submittedAt: now,
        },
      }),
  });

  if (prior?.cloudinaryPublicId && prior.cloudinaryPublicId !== row.cloudinaryPublicId) {
    await removeAppFile(prior.cloudinaryPublicId).catch(() => {});
  }

  return {
    ...sanitizeSubmissionFile(row),
    status: row.status,
    submittedAt: row.submittedAt,
    student: { fullName: student.fullName, matricNumber: student.matricNumber },
  };
}

/** Lecturer — submissions table for one assignment. */
export async function listSubmissions(assignmentId, lecturerId, institutionId = null) {
  const assignment = await loadOwnedAssignment(assignmentId, lecturerId, institutionId);
  const rows = await prisma.assignmentSubmission.findMany({
    where: { assignmentId },
    orderBy: { submittedAt: 'desc' },
    include: {
      student: { select: { id: true, fullName: true, matricNumber: true, email: true } },
    },
  });
  const totalStudents = await countDepartmentStudents(assignment.course.departmentId);
  return {
    assignment: mapAssignment(assignment),
    totalStudents,
    submissions: rows.map((s) => ({
      id: s.id,
      studentName: s.student.fullName,
      matricNumber: s.student.matricNumber ?? '—',
      email: s.student.email,
      submittedAt: s.submittedAt,
      status: s.status,
      fileName: s.originalFileName,
      fileAccess: buildFileAccess(FILE_KIND.ASSIGNMENT_SUBMISSION, s.id),
      sizeBytes: s.sizeBytes,
    })),
  };
}

/** Lecturer extends the deadline — reopens submissions until the new date. */
export async function extendAssignmentDueDate(assignmentId, lecturerId, dueAt, institutionId = null) {
  await loadOwnedAssignment(assignmentId, lecturerId, institutionId);
  const due = new Date(dueAt);
  if (!dueAt || Number.isNaN(due.getTime())) throw httpError(400, 'A valid due date is required');
  if (due.getTime() < Date.now()) throw httpError(400, 'New due date must be in the future');
  const row = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { dueAt: due, status: 'OPEN' },
    include: { course: { select: { id: true, code: true, title: true } } },
  });
  return mapAssignment(row);
}

export async function setAssignmentStatus(assignmentId, lecturerId, status, institutionId = null) {
  await loadOwnedAssignment(assignmentId, lecturerId, institutionId);
  if (!['OPEN', 'CLOSED'].includes(status)) throw httpError(400, 'Invalid status');
  const row = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status },
    include: { course: { select: { id: true, code: true, title: true } } },
  });
  return mapAssignment(row);
}

function sanitizeToken(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
    .slice(0, 40) || 'NA';
}

function timestampToken(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function buildSubmissionFileName(assignment, submission) {
  const ext = path.extname(submission.originalFileName || '') || '.bin';
  const course = sanitizeToken(assignment.course.code);
  const title = sanitizeToken(assignment.title).slice(0, 24);
  const matric = sanitizeToken(submission.student?.matricNumber || submission.matricNumber);
  const ts = timestampToken(submission.submittedAt);
  return `${course}_${title}_${matric}_${ts}${ext}`;
}

export function buildSubmissionsCsv(assignment, submissions) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Student Name', 'Matric Number', 'Email', 'Submission Time', 'Status', 'File Name'];
  const lines = [header.map(esc).join(',')];
  for (const s of submissions) {
    lines.push(
      [
        s.studentName,
        s.matricNumber,
        s.email,
        new Date(s.submittedAt).toISOString(),
        s.status,
        s.fileName,
      ]
        .map(esc)
        .join(','),
    );
  }
  return lines.join('\r\n');
}

/** Resolve a submission file to a Buffer from Cloudinary CDN (ZIP export). */
export async function readSubmissionFile(submission) {
  return fetchFileBuffer(submission.fileUrl, {
    publicId: submission.cloudinaryPublicId,
    mimeType: submission.mimeType,
    fileName: submission.originalFileName,
  });
}

/** Full submission rows (with student + file pointers) for ZIP packaging. */
export async function loadSubmissionsForZip(assignmentId, lecturerId, institutionId = null) {
  const assignment = await loadOwnedAssignment(assignmentId, lecturerId, institutionId);
  const rows = await prisma.assignmentSubmission.findMany({
    where: { assignmentId },
    orderBy: { submittedAt: 'asc' },
    include: {
      student: { select: { fullName: true, matricNumber: true, email: true } },
    },
  });
  return { assignment, rows };
}
