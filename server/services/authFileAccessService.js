import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STAFF = ['LECTURER', 'HOD', 'DEPARTMENT_ADMIN'];
const PLATFORM_ADMINS = ['INSTITUTION_ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN', 'DEPARTMENT_ADMIN'];

function deny(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function loadUser(userId) {
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, departmentId: true, facultyId: true, accountStatus: true },
  });
}

function assertActive(user) {
  if (!user) throw deny(401, 'Authentication required');
  if (user.accountStatus === 'SUSPENDED') throw deny(403, 'Account suspended');
}

async function canAccessDepartment(user, departmentId) {
  if (!user || !departmentId) return false;
  if (['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return true;
  if (user.role === 'FACULTY_ADMIN' && user.facultyId) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { facultyId: true },
    });
    return dept?.facultyId === user.facultyId;
  }
  if (PLATFORM_ADMINS.includes(user.role) && user.departmentId === departmentId) return true;
  if (STAFF.includes(user.role) && user.departmentId === departmentId) return true;
  if (user.role === 'STUDENT' && user.departmentId === departmentId) return true;
  return false;
}

async function loadResourceFileMeta(resourceId) {
  return prisma.resource.findUnique({
    where: { id: resourceId },
    select: {
      id: true,
      governanceStatus: true,
      uploadedById: true,
      fileUrl: true,
      cloudinaryPublicId: true,
      originalFileName: true,
      mimeType: true,
    },
  });
}

/**
 * Public catalogue — verified materials are viewable/downloadable without login.
 * (Rating, contribute, and assignment submit remain auth-only elsewhere.)
 */
export async function assertResourceAccess(userId, resourceId) {
  const resource = await loadResourceFileMeta(resourceId);
  if (!resource) throw deny(404, 'Resource not found');

  if (resource.governanceStatus === 'VERIFIED') return resource;

  if (!userId) throw deny(401, 'Sign in to access this material');

  const user = await loadUser(userId);
  assertActive(user);
  if (resource.uploadedById === user.id) return resource;

  throw deny(403, 'This material is not available');
}

/** Assignment question paper — public when assignment is open in the catalogue. */
export async function assertAssignmentAttachmentAccess(userId, assignmentId) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      status: true,
      lecturerId: true,
      attachmentUrl: true,
      attachmentCloudinaryPublicId: true,
      attachmentName: true,
      course: { select: { departmentId: true } },
    },
  });
  if (!assignment?.attachmentUrl) throw deny(404, 'No question file for this assignment');

  if (assignment.status === 'OPEN') return assignment;

  if (!userId) throw deny(401, 'Sign in to access this file');

  const user = await loadUser(userId);
  assertActive(user);
  if (assignment.lecturerId === user.id) return assignment;
  const allowed = await canAccessDepartment(user, assignment.course.departmentId);
  if (!allowed) throw deny(403, 'You do not have permission to access this file');
  return assignment;
}

/** Student submission — owner student or department staff. */
export async function assertSubmissionAccess(userId, submissionId) {
  const user = await loadUser(userId);
  assertActive(user);

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      fileUrl: true,
      cloudinaryPublicId: true,
      originalFileName: true,
      mimeType: true,
      assignment: {
        select: {
          lecturerId: true,
          course: { select: { departmentId: true } },
        },
      },
    },
  });
  if (!submission) throw deny(404, 'Submission not found');

  if (submission.studentId === user.id) return submission;
  if (submission.assignment.lecturerId === user.id) return submission;

  if (STAFF.includes(user.role)) {
    const allowed = await canAccessDepartment(user, submission.assignment.course.departmentId);
    if (allowed) return submission;
  }

  throw deny(403, 'You do not have permission to access this submission');
}

/** Student suggestion file — submitter or reviewing lecturer. */
export async function assertSuggestionAccess(userId, suggestionId) {
  const user = await loadUser(userId);
  assertActive(user);

  const suggestion = await prisma.materialSuggestion.findUnique({
    where: { id: suggestionId },
    select: {
      id: true,
      studentId: true,
      lecturerId: true,
      fileUrl: true,
      cloudinaryPublicId: true,
      originalFileName: true,
      mimeType: true,
    },
  });
  if (!suggestion) throw deny(404, 'Suggestion not found');

  if (suggestion.studentId === user.id || suggestion.lecturerId === user.id) return suggestion;
  if (['INSTITUTION_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return suggestion;

  throw deny(403, 'You do not have permission to access this file');
}

/** Student's own submission resolved by assignment id. */
export async function assertMySubmissionByAssignment(userId, assignmentId) {
  const user = await loadUser(userId);
  assertActive(user);
  if (user.role !== 'STUDENT') throw deny(403, 'Student account required');

  const submission = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: userId } },
    select: {
      id: true,
      fileUrl: true,
      cloudinaryPublicId: true,
      originalFileName: true,
      mimeType: true,
    },
  });
  if (!submission) throw deny(404, 'You have not submitted this assignment yet');
  return submission;
}

const AUTH_REQUIRED_KINDS = new Set([
  'assignment-submission',
  'my-assignment-submission',
  'suggestion',
]);

export function requiresAuthForKind(kind) {
  return AUTH_REQUIRED_KINDS.has(kind);
}

/** Resolve file metadata for a given kind + entity id after permission check. */
export async function resolveSecuredFile(userId, kind, id) {
  if (requiresAuthForKind(kind) && !userId) {
    throw deny(401, 'Authentication required');
  }
  switch (kind) {
    case 'resource': {
      const row = await assertResourceAccess(userId, id);
      return {
        publicId: row.cloudinaryPublicId,
        fileUrl: row.fileUrl,
        fileName: row.originalFileName,
        mimeType: row.mimeType,
      };
    }
    case 'assignment-attachment': {
      const row = await assertAssignmentAttachmentAccess(userId, id);
      return {
        publicId: row.attachmentCloudinaryPublicId,
        fileUrl: row.attachmentUrl,
        fileName: row.attachmentName || 'assignment-question.pdf',
        mimeType: 'application/pdf',
      };
    }
    case 'assignment-submission': {
      const row = await assertSubmissionAccess(userId, id);
      return {
        publicId: row.cloudinaryPublicId,
        fileUrl: row.fileUrl,
        fileName: row.originalFileName,
        mimeType: row.mimeType,
      };
    }
    case 'my-assignment-submission': {
      const row = await assertMySubmissionByAssignment(userId, id);
      return {
        publicId: row.cloudinaryPublicId,
        fileUrl: row.fileUrl,
        fileName: row.originalFileName,
        mimeType: row.mimeType,
      };
    }
    case 'suggestion': {
      const row = await assertSuggestionAccess(userId, id);
      return {
        publicId: row.cloudinaryPublicId,
        fileUrl: row.fileUrl,
        fileName: row.originalFileName,
        mimeType: row.mimeType,
      };
    }
    default:
      throw deny(400, 'Unknown file kind');
  }
}
