import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const p = new PrismaClient();
const email = 'lecturer@demo.ibbul.edu';
const password = 'LecturerDemo123!';

console.log('JWT_SECRET set:', Boolean(process.env.JWT_SECRET));

const user = await p.user.findUnique({ where: { email } });
const ok = user && (await bcrypt.compare(password, user.passwordHash));
console.log('password ok:', ok);

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

try {
  const token = jwt.sign({ sub: profile.id, role: profile.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  console.log('token ok, len:', token.length);
} catch (e) {
  console.error('JWT ERR:', e.message);
}

await p.$disconnect();
