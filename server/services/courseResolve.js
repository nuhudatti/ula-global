import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Normalize course codes for consistent lookup (e.g. csc101 → CSC101). */
export function normalizeCourseCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Find course in department by code, or register a new one from lecturer input.
 */
export async function resolveDepartmentCourse({ departmentId, code, title, level, semester }) {
  const normalizedCode = normalizeCourseCode(code);
  const trimmedTitle = String(title || '').trim();

  if (!normalizedCode || normalizedCode.length < 2) {
    const err = new Error('Course code must be at least 2 characters');
    err.statusCode = 400;
    throw err;
  }
  if (!trimmedTitle || trimmedTitle.length < 3) {
    const err = new Error('Course title must be at least 3 characters');
    err.statusCode = 400;
    throw err;
  }

  let levelVal = null;
  if (level != null && String(level).trim() !== '') {
    const lv = Number(level);
    if (Number.isNaN(lv) || lv < 100 || lv > 900) {
      const err = new Error('Level should be a number like 100, 200, 300…');
      err.statusCode = 400;
      throw err;
    }
    levelVal = lv;
  }

  const existing = await prisma.course.findFirst({
    where: { departmentId, code: normalizedCode },
  });

  if (existing) {
    if (semester != null && String(semester).trim() && existing.semester !== String(semester).trim()) {
      return prisma.course.update({
        where: { id: existing.id },
        data: { semester: String(semester).trim() },
        select: {
          id: true,
          code: true,
          title: true,
          level: true,
          semester: true,
          departmentId: true,
          department: {
            select: {
              name: true,
              faculty: { select: { name: true, code: true } },
            },
          },
        },
      });
    }
    return prisma.course.findUnique({
      where: { id: existing.id },
      select: {
        id: true,
        code: true,
        title: true,
        level: true,
        semester: true,
        departmentId: true,
        department: {
          select: {
            name: true,
            faculty: { select: { name: true, code: true } },
          },
        },
      },
    });
  }

  return prisma.course.create({
    data: {
      code: normalizedCode,
      title: trimmedTitle,
      level: levelVal,
      semester: semester != null && String(semester).trim() ? String(semester).trim() : null,
      departmentId,
    },
    select: {
      id: true,
      code: true,
      title: true,
      level: true,
      semester: true,
      departmentId: true,
      department: {
        select: {
          name: true,
          faculty: { select: { name: true, code: true } },
        },
      },
    },
  });
}
