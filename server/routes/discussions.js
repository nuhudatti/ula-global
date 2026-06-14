import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import {
  createDiscussionPost,
  getParticipantActivity,
  getParticipantCourses,
  getStudentDiscussionSummary,
  listCourseDiscussions,
  listDiscussionFeed,
  listStaffDiscussionFeed,
} from '../services/discussions.js';
import { tenantId } from '../services/tenantScope.js';

const prisma = new PrismaClient();
const router = Router();

router.get('/feed', async (req, res) => {
  try {
    const items = await listDiscussionFeed(28, tenantId(req));
    res.set('Cache-Control', 'public, max-age=15');
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load discussions' });
  }
});

router.get('/course/:courseId', async (req, res) => {
  try {
    const items = await listCourseDiscussions(req.params.courseId, 80, tenantId(req));
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load course discussion' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { courseId, parentId, topic, body } = req.body;
    const post = await createDiscussionPost({
      userId: req.user.id,
      userRole: req.user.role,
      courseId,
      parentId,
      topic,
      body,
    });
    res.status(201).json(post);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to post message' });
  }
});

router.get('/participant/courses', requireAuth, async (req, res) => {
  try {
    const courses = await getParticipantCourses(req.user.id, req.user.role);
    res.json({ courses });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load courses' });
  }
});

router.get('/staff/feed', requireAuth, async (req, res) => {
  try {
    if (!['LECTURER', 'HOD', 'DEPARTMENT_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff feed only' });
    }
    const staff = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { departmentId: true },
    });
    const items = await listStaffDiscussionFeed(staff?.departmentId ?? null);
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load staff discussions' });
  }
});

router.get('/participant/activity', requireAuth, async (req, res) => {
  try {
    const staff = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { departmentId: true },
    });
    const data = await getParticipantActivity(req.user.id, req.user.role, staff?.departmentId ?? null);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

router.get('/student/summary', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Student summary only' });
    }
    const student = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { departmentId: true },
    });
    const data = await getStudentDiscussionSummary(req.user.id, student?.departmentId ?? null);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load student summary' });
  }
});

export default router;
