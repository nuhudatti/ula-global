import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { logPlatformAudit } from './platformAudit.js';
import { validateStrongPassword } from './passwordPolicy.js';

const prisma = new PrismaClient();

export const PLATFORM_SUPER_ADMIN_ROLE = 'PLATFORM_SUPER_ADMIN';

/** Setup runs only when no platform super admin exists in the database. */
export async function isPlatformSetupRequired() {
  const count = await prisma.platformOperator.count({
    where: { role: PLATFORM_SUPER_ADMIN_ROLE },
  });
  return count === 0;
}

export async function getPlatformSetupStatus() {
  const setupRequired = await isPlatformSetupRequired();
  return { setupRequired, role: PLATFORM_SUPER_ADMIN_ROLE };
}

/**
 * Create the first and only bootstrap super admin.
 * Permanently locked after creation — subsequent calls return 403.
 */
export async function createFirstPlatformSuperAdmin({ email, password, fullName }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const name = String(fullName || '').trim();
  const pwd = String(password || '');

  if (!normalizedEmail || !name) {
    const err = new Error('Email and full name are required');
    err.status = 400;
    throw err;
  }

  const policy = validateStrongPassword(pwd, { label: 'Password' });
  if (!policy.valid) {
    const err = new Error(policy.errors.join('. '));
    err.status = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.platformOperator.count({
      where: { role: PLATFORM_SUPER_ADMIN_ROLE },
    });
    if (existing > 0) {
      const err = new Error('Platform setup already completed — sign in at /platform/login');
      err.status = 403;
      throw err;
    }

    const duplicate = await tx.platformOperator.findUnique({ where: { email: normalizedEmail } });
    if (duplicate) {
      const err = new Error('An operator with this email already exists');
      err.status = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(pwd, 12);
    const operator = await tx.platformOperator.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: name,
        role: PLATFORM_SUPER_ADMIN_ROLE,
        accountStatus: 'ACTIVE',
      },
      select: { id: true, email: true, fullName: true, role: true },
    });

    await logPlatformAudit({
      action: 'FIRST_SUPER_ADMIN_CREATED',
      actorId: operator.id,
      actorType: 'platform',
      detail: `First ${PLATFORM_SUPER_ADMIN_ROLE} created`,
    });

    return operator;
  });
}

/** Block delete/deactivate of the sole platform super admin. */
export async function assertNotLastSuperAdmin(operatorId) {
  const active = await prisma.platformOperator.findMany({
    where: { role: PLATFORM_SUPER_ADMIN_ROLE, accountStatus: 'ACTIVE' },
    select: { id: true },
  });
  if (active.length === 1 && active[0].id === operatorId) {
    const err = new Error('Cannot remove or deactivate the only platform super admin');
    err.status = 403;
    throw err;
  }
}
