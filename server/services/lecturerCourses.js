import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function syncLecturerCourses(userId, courseIds, semester) {
  const unique = [...new Set((courseIds || []).filter(Boolean))];
  if (unique.length === 0) {
    await prisma.lecturerCourseAssignment.deleteMany({ where: { userId } });
    return;
  }
  await prisma.lecturerCourseAssignment.deleteMany({
    where: { userId, courseId: { notIn: unique } },
  });
  for (const courseId of unique) {
    await prisma.lecturerCourseAssignment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, semester: semester || null },
      update: { semester: semester || null },
    });
  }
}
