import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { parseLocalStoredName } from '../server/services/localUpload.js';

const prisma = new PrismaClient();
const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

const users = await prisma.user.findMany({
  where: { profilePhotoUrl: { not: null } },
  select: { id: true, email: true, profilePhotoUrl: true },
});

let cleared = 0;
for (const u of users) {
  const name = parseLocalStoredName(u.profilePhotoUrl);
  if (!name) continue;
  try {
    await fs.access(path.join(uploadsDir, name));
  } catch {
    await prisma.user.update({
      where: { id: u.id },
      data: { profilePhotoUrl: null, profilePhotoPublicId: null },
    });
    console.log('Cleared orphan photo:', u.email);
    cleared++;
  }
}
console.log(`Done. Cleared ${cleared} orphan profile photo(s).`);
await prisma.$disconnect();
