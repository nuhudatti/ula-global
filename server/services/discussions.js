import { PrismaClient } from '@prisma/client';
import { courseInstitutionWhere, discussionInstitutionWhere } from './tenantScope.js';

const prisma = new PrismaClient();

const TOPICS = new Set(['GENERAL', 'ASSIGNMENT', 'LECTURE', 'EXAM']);
const POST_ROLES = new Set(['STUDENT', 'LECTURER', 'HOD', 'DEPARTMENT_ADMIN']);
const STAFF_ROLES = new Set(['LECTURER', 'HOD', 'DEPARTMENT_ADMIN']);

function relTime(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function mapPost(row) {
  return {
    id: row.id,
    courseId: row.courseId,
    parentId: row.parentId,
    topic: row.topic,
    body: row.body,
    createdAt: row.createdAt,
    rel: relTime(row.createdAt),
    replyCount: row._count?.replies ?? 0,
    author: {
      id: row.author.id,
      fullName: row.author.fullName,
      role: row.author.role,
      profilePhotoUrl: row.author.profilePhotoUrl,
    },
    course: row.course
      ? {
          code: row.course.code,
          title: row.course.title,
          departmentName: row.course.department?.name,
        }
      : undefined,
    repliedTo: row.parent
      ? {
          id: row.parent.id,
          authorId: row.parent.author?.id ?? null,
          authorName: row.parent.author?.fullName ?? 'Unknown',
          preview: String(row.parent.body).slice(0, 140),
        }
      : null,
  };
}

const discussionInclude = {
  author: { select: { id: true, fullName: true, role: true, profilePhotoUrl: true } },
  course: {
    select: {
      code: true,
      title: true,
      department: { select: { name: true } },
    },
  },
  parent: {
    select: {
      id: true,
      body: true,
      author: { select: { id: true, fullName: true } },
    },
  },
  _count: { select: { replies: true } },
};

async function fetchAllThreadReplies(rootIds) {
  const all = [];
  const seen = new Set(rootIds);
  let parentIds = [...rootIds];

  while (parentIds.length > 0) {
    const batch = await prisma.courseDiscussion.findMany({
      where: { parentId: { in: parentIds } },
      orderBy: { createdAt: 'asc' },
      include: discussionInclude,
    });
    const next = batch.filter((row) => !seen.has(row.id));
    if (next.length === 0) break;
    for (const row of next) {
      seen.add(row.id);
      all.push(row);
    }
    parentIds = next.map((row) => row.id);
  }

  return all;
}

async function listDiscussionFeedForCourseIds(courseIds, take = 40) {
  if (!courseIds.length) return [];
  const rootTake = Math.max(12, Math.floor(take / 2));
  const roots = await prisma.courseDiscussion.findMany({
    where: { parentId: null, courseId: { in: courseIds } },
    orderBy: { createdAt: 'desc' },
    take: rootTake,
    include: discussionInclude,
  });
  const rootIds = roots.map((r) => r.id);
  const replies = rootIds.length > 0 ? await fetchAllThreadReplies(rootIds) : [];
  return [...roots, ...replies].map(mapPost);
}

export async function listDiscussionFeed(take = 40, institutionId = null) {
  const rootTake = Math.max(12, Math.floor(take / 2));
  const roots = await prisma.courseDiscussion.findMany({
    where: {
      parentId: null,
      ...(institutionId ? discussionInstitutionWhere(institutionId) : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: rootTake,
    include: discussionInclude,
  });
  const rootIds = roots.map((r) => r.id);
  const replies = rootIds.length > 0 ? await fetchAllThreadReplies(rootIds) : [];
  return [...roots, ...replies].map(mapPost);
}

export async function listStaffDiscussionFeed(departmentId, take = 40) {
  if (!departmentId) return [];
  const courses = await prisma.course.findMany({
    where: { departmentId },
    select: { id: true },
  });
  return listDiscussionFeedForCourseIds(
    courses.map((c) => c.id),
    take,
  );
}

export async function listCourseDiscussions(courseId, take = 80, institutionId = null) {
  if (institutionId) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, ...courseInstitutionWhere(institutionId) },
      select: { id: true },
    });
    if (!course) return [];
  }
  const rows = await prisma.courseDiscussion.findMany({
    where: { courseId },
    orderBy: { createdAt: 'asc' },
    take,
    include: discussionInclude,
  });
  return rows.map(mapPost);
}

async function resolveDefaultCourseId(userId, explicitCourseId) {
  if (explicitCourseId) {
    const match = await prisma.course.findUnique({
      where: { id: explicitCourseId },
      select: { id: true },
    });
    if (match) return match.id;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  if (user?.departmentId) {
    const deptCourse = await prisma.course.findFirst({
      where: { departmentId: user.departmentId },
      orderBy: { code: 'asc' },
      select: { id: true },
    });
    if (deptCourse) return deptCourse.id;
  }

  const fallback = await prisma.course.findFirst({
    orderBy: { code: 'asc' },
    select: { id: true },
  });
  if (!fallback) {
    const err = new Error('No courses available yet. Ask your department to add courses first.');
    err.status = 400;
    throw err;
  }
  return fallback.id;
}

export async function createDiscussionPost({ userId, userRole, courseId, parentId, topic, body }) {
  if (!POST_ROLES.has(userRole)) {
    const err = new Error('Only students and academic staff can participate in course discussions');
    err.status = 403;
    throw err;
  }

  const text = String(body || '').trim();
  if (text.length < 3 || text.length > 2000) {
    const err = new Error('Message must be between 3 and 2000 characters');
    err.status = 400;
    throw err;
  }

  const safeTopic = TOPICS.has(topic) ? topic : 'GENERAL';
  let resolvedCourseId = courseId || null;

  if (!parentId && STAFF_ROLES.has(userRole)) {
    const err = new Error('Lecturers can only reply to student questions on tagged courses');
    err.status = 403;
    throw err;
  }

  if (parentId) {
    const parent = await prisma.courseDiscussion.findUnique({
      where: { id: parentId },
      select: { id: true, courseId: true, course: { select: { departmentId: true } } },
    });
    if (!parent) {
      const err = new Error('Parent message not found');
      err.status = 404;
      throw err;
    }
    if (STAFF_ROLES.has(userRole)) {
      const staff = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      if (!staff?.departmentId || parent.course.departmentId !== staff.departmentId) {
        const err = new Error('You can only reply to questions on your department courses');
        err.status = 403;
        throw err;
      }
    }
    resolvedCourseId = parent.courseId;
  } else if (userRole === 'STUDENT') {
    if (!resolvedCourseId) {
      const err = new Error('Tag a course so your lecturer can see your question');
      err.status = 400;
      throw err;
    }
    const course = await prisma.course.findUnique({
      where: { id: resolvedCourseId },
      select: { id: true },
    });
    if (!course) {
      const err = new Error('Course not found');
      err.status = 404;
      throw err;
    }
  } else {
    resolvedCourseId = await resolveDefaultCourseId(userId, resolvedCourseId);
  }

  const row = await prisma.courseDiscussion.create({
    data: {
      courseId: resolvedCourseId,
      authorId: userId,
      parentId: parentId || null,
      topic: parentId ? 'GENERAL' : safeTopic,
      body: text,
    },
    include: {
      author: { select: { id: true, fullName: true, role: true, profilePhotoUrl: true } },
      course: {
        select: {
          code: true,
          title: true,
          department: { select: { name: true } },
        },
      },
      parent: {
        select: {
          id: true,
          body: true,
          author: { select: { id: true, fullName: true } },
        },
      },
      _count: { select: { replies: true } },
    },
  });

  return mapPost(row);
}

export async function getParticipantCourses(userId, userRole) {
  if (!POST_ROLES.has(userRole)) return [];
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  const deptCourses = user?.departmentId
    ? await prisma.course.findMany({
        where: { departmentId: user.departmentId },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, title: true, level: true },
      })
    : [];

  if (deptCourses.length > 0) return deptCourses;

  return prisma.course.findMany({
    orderBy: { code: 'asc' },
    take: 120,
    select: { id: true, code: true, title: true, level: true },
  });
}

export async function countRepliesToUser(userId) {
  return prisma.courseDiscussion.count({
    where: {
      parent: { authorId: userId },
      authorId: { not: userId },
    },
  });
}

export async function getParticipantActivity(userId, userRole, departmentId = null) {
  let feed;
  if (STAFF_ROLES.has(userRole) && departmentId) {
    feed = await listStaffDiscussionFeed(departmentId, 28);
  } else {
    feed = await listDiscussionFeed(28);
  }
  const repliesToMe = POST_ROLES.has(userRole) ? await countRepliesToUser(userId) : 0;
  return { feedCount: feed.length, repliesToMe };
}

export async function getStudentDiscussionSummary(userId, departmentId) {
  const [questions, repliesReceived, ratingsGiven, courses] = await Promise.all([
    prisma.courseDiscussion.count({ where: { authorId: userId, parentId: null } }),
    prisma.courseDiscussion.count({
      where: {
        parent: { authorId: userId },
        authorId: { not: userId },
      },
    }),
    prisma.rating.count({ where: { userId } }),
    departmentId
      ? prisma.course.findMany({
          where: { departmentId },
          orderBy: { code: 'asc' },
          select: { id: true, code: true, title: true, level: true },
        })
      : [],
  ]);

  const myRecent = await prisma.courseDiscussion.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: {
      author: { select: { id: true, fullName: true, role: true, profilePhotoUrl: true } },
      course: {
        select: {
          code: true,
          title: true,
          department: { select: { name: true } },
        },
      },
      parent: {
        select: {
          id: true,
          body: true,
          author: { select: { id: true, fullName: true } },
        },
      },
      _count: { select: { replies: true } },
    },
  });

  return {
    stats: { questions, repliesReceived, ratingsGiven },
    courses,
    myRecent: myRecent.map(mapPost),
  };
}
