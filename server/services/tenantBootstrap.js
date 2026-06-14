import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TENANT = {
  id: 'ibbul',
  slug: 'ibbul',
  name: 'Ibrahim Badamasi Babangida University, Lapai',
  shortName: 'IBBUL',
  tagline: 'Learning for Service',
};

/** One-time / startup backfill for multi-tenant schema on existing single-uni DB. */
export async function bootstrapTenants() {
  let institution = await prisma.institution.findFirst({
    where: { OR: [{ id: DEFAULT_TENANT.id }, { slug: DEFAULT_TENANT.slug }] },
  });

  if (!institution) {
    institution = await prisma.institution.create({
      data: {
        id: DEFAULT_TENANT.id,
        slug: DEFAULT_TENANT.slug,
        name: DEFAULT_TENANT.name,
        shortName: DEFAULT_TENANT.shortName,
        tagline: DEFAULT_TENANT.tagline,
        status: 'ACTIVE',
      },
    });
  } else if (!institution.slug) {
    institution = await prisma.institution.update({
      where: { id: institution.id },
      data: {
        slug: DEFAULT_TENANT.slug,
        status: institution.status || 'ACTIVE',
        shortName: institution.shortName || DEFAULT_TENANT.shortName,
      },
    });
  }

  const superUsers = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' } });
  for (const u of superUsers) {
    await prisma.user.update({
      where: { id: u.id },
      data: { role: 'INSTITUTION_ADMIN' },
    });
  }

  return institution;
}
