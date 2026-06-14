import { PrismaClient } from '@prisma/client';
import { logPlatformAudit } from './platformAudit.js';
import { sanitizeSuggestion } from './fileService.js';

const prisma = new PrismaClient();

const VALID_KINDS = ['LECTURE_NOTES', 'PAST_QUESTIONS', 'HANDOUT', 'ASSIGNMENT', 'PROJECT', 'OTHER'];
const MAX_PENDING_PER_STUDENT = 5;
const MAX_STUDENT_FILE_BYTES = 15 * 1024 * 1024;

export { VALID_KINDS, MAX_STUDENT_FILE_BYTES, MAX_PENDING_PER_STUDENT };

export async function loadLecturerContext(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, departmentId: true, accountStatus: true, canUpload: true },
  });
  if (!user || user.role !== 'LECTURER') {
    const err = new Error('Lecturer access required');
    err.status = 403;
    throw err;
  }
  if (!user.departmentId) {
    const err = new Error('Your account has no department');
    err.status = 403;
    throw err;
  }
  if (user.accountStatus === 'SUSPENDED') {
    const err = new Error('Account suspended');
    err.status = 403;
    throw err;
  }
  return user;
}

export async function loadStudentContext(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, departmentId: true, accountStatus: true },
  });
  if (!user || user.role !== 'STUDENT') {
    const err = new Error('Student access required');
    err.status = 403;
    throw err;
  }
  if (user.accountStatus === 'SUSPENDED') {
    const err = new Error('Account suspended');
    err.status = 403;
    throw err;
  }
  return user;
}

function normalizeMatric(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

export async function searchDepartmentStudents(departmentId, query) {
  const q = String(query || '').trim();
  const matric = normalizeMatric(q);
  const where = {
    departmentId,
    role: 'STUDENT',
    accountStatus: 'ACTIVE',
  };
  if (q.length >= 2) {
    const clauses = [
      { fullName: { contains: q } },
      { email: { contains: q } },
    ];
    if (matric.length >= 2) {
      clauses.push({ matricNumber: { contains: matric } });
      if (matric.length >= 4) {
        clauses.push({ matricNumber: matric });
      }
    }
    where.OR = clauses;
  }
  return prisma.user.findMany({
    where,
    select: { id: true, fullName: true, email: true, matricNumber: true, createdAt: true },
    orderBy: { fullName: 'asc' },
    take: 20,
  });
}

export function formatPermission(row) {
  return {
    id: row.id,
    note: row.note,
    createdAt: row.createdAt,
    student: row.student,
    lecturer: row.lecturer,
    pendingCount: row._count?.suggestions ?? 0,
  };
}

export function formatSuggestion(row) {
  return {
    ...sanitizeSuggestion(row),
    title: row.title,
    reason: row.reason,
    kind: row.kind,
    examYear: row.examYear,
    status: row.status,
    rejectReason: row.rejectReason,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    student: row.student,
    course: row.course,
    publishedResourceId: row.publishedResourceId,
  };
}

export async function countPendingForStudent(studentId) {
  return prisma.materialSuggestion.count({
    where: { studentId, status: 'PENDING' },
  });
}

export async function approveSuggestion({ suggestionId, lecturerId, title, description }) {
  const suggestion = await prisma.materialSuggestion.findFirst({
    where: { id: suggestionId, lecturerId, status: 'PENDING' },
    include: {
      course: { select: { id: true, departmentId: true } },
      student: { select: { id: true, fullName: true } },
    },
  });
  if (!suggestion) {
    const err = new Error('Suggestion not found or already reviewed');
    err.status = 404;
    throw err;
  }

  const publishTitle = (title || suggestion.title).trim();
  const resource = await prisma.$transaction(async (tx) => {
    const created = await tx.resource.create({
      data: {
        title: publishTitle,
        description: description?.trim() || suggestion.reason,
        kind: suggestion.kind,
        examYear: suggestion.examYear,
        fileUrl: suggestion.fileUrl,
        cloudinaryPublicId: suggestion.cloudinaryPublicId,
        originalFileName: suggestion.originalFileName,
        mimeType: suggestion.mimeType,
        sizeBytes: suggestion.sizeBytes,
        courseId: suggestion.courseId,
        uploadedById: lecturerId,
        contributedById: suggestion.studentId,
        suggestionId: suggestion.id,
        governanceStatus: 'VERIFIED',
      },
      include: {
        course: { include: { department: { include: { faculty: true } } } },
        uploadedBy: { select: { id: true, fullName: true, email: true } },
        contributedBy: { select: { id: true, fullName: true } },
      },
    });

    await tx.materialSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        publishedResourceId: created.id,
      },
    });

    return created;
  });

  const institutionId = resource.course?.department?.faculty?.institutionId ?? null;
  await logPlatformAudit({
    action: resource.kind === 'PAST_QUESTIONS' ? 'RESULT_UPLOADED' : 'RESOURCE_UPLOADED',
    actorId: lecturerId,
    actorType: 'user',
    institutionId,
    detail: null,
  });

  return resource;
}
