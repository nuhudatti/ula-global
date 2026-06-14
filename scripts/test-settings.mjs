import { PrismaClient } from '@prisma/client';
import { buildSettingsContext } from '../server/services/settings.js';

const prisma = new PrismaClient();
const u = await prisma.user.findUnique({ where: { email: 'lecturer@demo.ibbul.edu' } });
try {
  const ctx = await buildSettingsContext(u.id);
  console.log('OK', JSON.stringify({ scopes: ctx.scopes, photo: ctx.profile.profilePhotoUrl }, null, 2));
} catch (e) {
  console.error('ERR', e);
}
await prisma.$disconnect();
