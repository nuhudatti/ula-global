import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Faculty workspace — FACULTY_ADMIN only (not institutional super admin). */
export function requireFacultyAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'FACULTY_ADMIN') {
    return res.status(403).json({ error: 'Faculty administrator access required' });
  }
  next();
}

export async function loadFacultyContext(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        role: true,
        fullName: true,
        email: true,
        facultyId: true,
        faculty: { select: { id: true, name: true, code: true } },
      },
    });
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.facultyId) {
      return res.status(403).json({ error: 'No faculty assigned to this account' });
    }

    const faculty = await prisma.faculty.findUnique({
      where: { id: user.facultyId },
      select: { id: true, name: true, code: true, tagline: true, logoUrl: true, bannerUrl: true },
    });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });

    req.facultyAdmin = user;
    req.facultyId = faculty.id;
    req.faculty = faculty;
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load faculty context' });
  }
}
