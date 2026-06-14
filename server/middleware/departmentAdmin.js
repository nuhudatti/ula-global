import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEPT_ADMIN_ROLES = new Set(['DEPARTMENT_ADMIN', 'HOD']);

export function requireDepartmentAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!DEPT_ADMIN_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Department admin access required' });
  }
  next();
}

/** Attach departmentId from DB user record. */
export async function loadDepartmentContext(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        role: true,
        departmentId: true,
        department: {
          select: {
            id: true,
            name: true,
            tagline: true,
            logoUrl: true,
            bannerUrl: true,
            faculty: { select: { id: true, name: true, code: true, logoUrl: true } },
          },
        },
      },
    });
    if (!user?.departmentId) {
      return res.status(403).json({ error: 'No department assigned to this account' });
    }
    req.deptAdmin = user;
    req.departmentId = user.departmentId;
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load department context' });
  }
}
