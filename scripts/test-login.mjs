import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const email = 'lecturer@demo.ibbul.edu';
const user = await p.user.findUnique({ where: { email } });
console.log('user found:', !!user);
try {
  const profile = await p.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      facultyId: true,
      bio: true,
      profilePhotoUrl: true,
      bannerUrl: true,
      mustChangePassword: true,
      accountStatus: true,
      department: {
        select: {
          id: true,
          name: true,
          faculty: { select: { id: true, name: true, code: true } },
        },
      },
      faculty: { select: { id: true, name: true, code: true } },
    },
  });
  console.log('profile ok', JSON.stringify(profile, null, 2));
} catch (e) {
  console.error('PROFILE ERR', e);
}
await p.$disconnect();
