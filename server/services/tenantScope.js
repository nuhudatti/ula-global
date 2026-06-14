/** Prisma where fragments scoped to an institution (via faculty chain). */
export function facultyInstitutionWhere(institutionId) {
  if (!institutionId) return {};
  return { institutionId };
}

export function departmentInstitutionWhere(institutionId) {
  if (!institutionId) return {};
  return { faculty: { institutionId } };
}

export function courseInstitutionWhere(institutionId) {
  if (!institutionId) return {};
  return { department: { faculty: { institutionId } } };
}

export function resourceInstitutionWhere(institutionId) {
  if (!institutionId) return {};
  return { course: courseInstitutionWhere(institutionId) };
}

export function assignmentInstitutionWhere(institutionId) {
  if (!institutionId) return {};
  return { course: courseInstitutionWhere(institutionId) };
}

export function discussionInstitutionWhere(institutionId) {
  if (!institutionId) return {};
  return { course: courseInstitutionWhere(institutionId) };
}

export function userInstitutionWhere(institutionId) {
  if (!institutionId) return {};
  return { institutionId };
}

export function tenantId(req) {
  return req.tenant?.id || req.user?.institutionId || null;
}

export function userEmailWhere(institutionId, email) {
  return {
    institutionId_email: {
      institutionId,
      email: String(email || '').trim().toLowerCase(),
    },
  };
}
