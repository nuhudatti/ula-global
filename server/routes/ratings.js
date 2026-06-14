import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { resourceInstitutionWhere } from '../services/tenantScope.js';

const prisma = new PrismaClient();
const router = Router();

// POST /api/ratings
// body: { resourceId: string, value: number(1-5) }
router.post('/', requireAuth, async (req, res) => {
  try {
    const resourceId = String(req.body?.resourceId || '').trim();
    const value = Number(req.body?.value);

    if (!resourceId) {
      return res.status(400).json({ error: 'resourceId is required' });
    }
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return res.status(400).json({ error: 'value must be an integer between 1 and 5' });
    }

    const resource = await prisma.resource.findFirst({
      where: {
        id: resourceId,
        ...(req.user.institutionId ? resourceInstitutionWhere(req.user.institutionId) : {}),
      },
      select: { id: true, uploadedById: true },
    });
    if (!resource) return res.status(404).json({ error: 'Resource not found' });
    if (resource.uploadedById === req.user.id) {
      return res.status(400).json({ error: 'You cannot rate your own upload' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.rating.findUnique({
        where: { userId_resourceId: { userId: req.user.id, resourceId } },
        select: { value: true },
      });

      await tx.rating.upsert({
        where: { userId_resourceId: { userId: req.user.id, resourceId } },
        create: { userId: req.user.id, resourceId, value },
        update: { value },
      });

      // Fast aggregate update path without scanning all rows.
      const snapshot = await tx.resource.findUnique({
        where: { id: resourceId },
        select: { avgRating: true, ratingCount: true },
      });
      if (!snapshot) throw new Error('Resource not found during rating update');

      const hadExisting = Boolean(existing);
      const prevCount = snapshot.ratingCount;
      const prevAvg = snapshot.avgRating || 0;

      const nextCount = hadExisting ? prevCount : prevCount + 1;
      const nextAvg = hadExisting
        ? (prevAvg * prevCount - (existing?.value || 0) + value) / (nextCount || 1)
        : (prevAvg * prevCount + value) / (nextCount || 1);

      const updatedResource = await tx.resource.update({
        where: { id: resourceId },
        data: {
          ratingCount: nextCount,
          avgRating: Number(nextAvg.toFixed(4)),
        },
        select: { avgRating: true, ratingCount: true },
      });

      const userRating = await tx.rating.findUnique({
        where: { userId_resourceId: { userId: req.user.id, resourceId } },
        select: { value: true },
      });

      return {
        avgRating: updatedResource.avgRating,
        ratingCount: updatedResource.ratingCount,
        userRating: userRating?.value ?? null,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to save rating' });
  }
});

export default router;
