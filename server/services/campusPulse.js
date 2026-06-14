import { PrismaClient } from '@prisma/client';
import { courseInstitutionWhere, resourceInstitutionWhere, userInstitutionWhere } from './tenantScope.js';

const prisma = new PrismaClient();

const KIND_LABEL = {
  LECTURE_NOTES: 'lecture notes',
  PAST_QUESTIONS: 'past questions',
  HANDOUT: 'a handout',
  ASSIGNMENT: 'an assignment',
  PROJECT: 'a project',
  OTHER: 'a resource',
};

function relTime(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Public live activity — powers browse + sign-in campus pulse. */
export async function getCampusPulse(institutionId) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since15m = new Date(Date.now() - 15 * 60 * 1000);
  const resourceScope = institutionId
    ? { governanceStatus: { not: 'ARCHIVED' }, ...resourceInstitutionWhere(institutionId) }
    : { governanceStatus: { not: 'ARCHIVED' } };
  const suggestionScope = institutionId ? { course: courseInstitutionWhere(institutionId) } : {};
  const userScope = institutionId ? userInstitutionWhere(institutionId) : {};

  const [resources, suggestions, onlineNow, uploadsToday, suggestionsToday] = await Promise.all([
    prisma.resource.findMany({
      where: resourceScope,
      orderBy: { createdAt: 'desc' },
      take: 18,
      select: {
        id: true,
        title: true,
        kind: true,
        createdAt: true,
        downloadCount: true,
        uploadedBy: { select: { fullName: true, role: true } },
        course: {
          select: {
            code: true,
            title: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
    prisma.materialSuggestion.findMany({
      where: suggestionScope,
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        student: { select: { fullName: true } },
        course: {
          select: {
            code: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.count({ where: { ...userScope, lastActiveAt: { gte: since15m } } }),
    prisma.resource.count({ where: { ...resourceScope, createdAt: { gte: since24h } } }),
    prisma.materialSuggestion.count({ where: { ...suggestionScope, createdAt: { gte: since24h } } }),
  ]);

  const items = [];

  for (const r of resources) {
    const kind = KIND_LABEL[r.kind] ?? 'materials';
    const actor = r.uploadedBy?.fullName?.split(' ')[0] ?? 'A lecturer';
    items.push({
      id: `res-${r.id}`,
      type: r.downloadCount >= 20 ? 'trending' : 'upload',
      actor,
      actorRole: r.uploadedBy?.role === 'LECTURER' ? 'Lecturer' : 'Contributor',
      department: r.course.department.name,
      courseCode: r.course.code,
      message:
        r.downloadCount >= 20
          ? `${r.course.code} ${kind} — ${r.downloadCount} downloads and counting`
          : `${actor} shared ${kind} for ${r.course.code}`,
      at: r.createdAt,
      rel: relTime(r.createdAt),
    });
  }

  for (const s of suggestions) {
    const first = s.student.fullName.split(' ')[0];
    const verb =
      s.status === 'APPROVED'
        ? 'contribution was approved'
        : s.status === 'PENDING'
          ? 'shared a study tip'
          : 'joined the conversation';
    items.push({
      id: `sug-${s.id}`,
      type: s.status === 'PENDING' ? 'discussion' : 'contribution',
      actor: first,
      actorRole: 'Student',
      department: s.course.department.name,
      courseCode: s.course.code,
      message: `${first} ${verb} on ${s.course.code}`,
      at: s.createdAt,
      rel: relTime(s.createdAt),
    });
  }

  items.sort((a, b) => new Date(b.at) - new Date(a.at));

  return {
    items: items.slice(0, 24),
    stats: {
      onlineNow: Math.max(onlineNow, 1),
      uploadsToday,
      discussionsToday: suggestionsToday,
      refreshedAt: new Date().toISOString(),
    },
  };
}
