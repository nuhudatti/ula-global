import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const seedDemo =
  process.env.SEED_DEMO_ACCOUNTS === 'true' ||
  (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_ACCOUNTS !== 'false');

async function main() {
  if (!seedDemo) {
    console.log('Seed skipped — demo accounts disabled.');
    console.log('  Local demo data: SEED_DEMO_ACCOUNTS=true npm run db:seed');
    console.log('  Platform admin:   open /platform/setup on first run (no seed account).');
    return;
  }

  const institution = await prisma.institution.upsert({
    where: { slug: 'ibbul' },
    update: {
      name: 'Ibrahim Badamasi Babangida University, Lapai',
      shortName: 'IBBUL',
      tagline: 'Learning for Service',
      status: 'ACTIVE',
    },
    create: {
      id: 'ibbul',
      slug: 'ibbul',
      name: 'Ibrahim Badamasi Babangida University, Lapai',
      shortName: 'IBBUL',
      tagline: 'Learning for Service',
      status: 'ACTIVE',
    },
  });

  const faculty = await prisma.faculty.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'FAC_SCI' } },
    update: {},
    create: {
      institutionId: institution.id,
      name: 'Applied Sciences',
      code: 'FAC_SCI',
    },
  });

  const dept = await prisma.department.upsert({
    where: {
      facultyId_name: {
        facultyId: faculty.id,
        name: 'Computer Science',
      },
    },
    update: {},
    create: {
      name: 'Computer Science',
      facultyId: faculty.id,
    },
  });

  await prisma.course.upsert({
    where: {
      departmentId_code: {
        departmentId: dept.id,
        code: 'CSC111',
      },
    },
    update: {},
    create: {
      code: 'CSC111',
      title: 'Introduction to Computing',
      level: 100,
      departmentId: dept.id,
    },
  });

  await prisma.course.upsert({
    where: {
      departmentId_code: {
        departmentId: dept.id,
        code: 'CSC212',
      },
    },
    update: {},
    create: {
      code: 'CSC212',
      title: 'Data Structures',
      level: 200,
      departmentId: dept.id,
    },
  });

  const lecturerPass = await bcrypt.hash('LecturerDemo123!', 12);
  const studentPass = await bcrypt.hash('StudentDemo123!', 12);
  const hodPass = await bcrypt.hash('HodDemo123!', 12);
  const facultyPass = await bcrypt.hash('FacultyDemo123!', 12);
  const instAdminPass = await bcrypt.hash('InstAdmin123!', 12);

  await prisma.user.upsert({
    where: { institutionId_email: { institutionId: institution.id, email: 'lecturer@demo.ibbul.edu' } },
    update: { passwordHash: lecturerPass, fullName: 'Demo Lecturer', role: 'LECTURER', departmentId: dept.id },
    create: {
      institutionId: institution.id,
      email: 'lecturer@demo.ibbul.edu',
      passwordHash: lecturerPass,
      fullName: 'Demo Lecturer',
      role: 'LECTURER',
      departmentId: dept.id,
    },
  });

  await prisma.user.upsert({
    where: { institutionId_email: { institutionId: institution.id, email: 'hod@demo.ibbul.edu' } },
    update: {
      passwordHash: hodPass,
      fullName: 'Demo Head of Department',
      role: 'HOD',
      departmentId: dept.id,
      departmentRole: 'HOD',
      accountStatus: 'ACTIVE',
      staffId: 'HOD-CS-001',
    },
    create: {
      institutionId: institution.id,
      email: 'hod@demo.ibbul.edu',
      passwordHash: hodPass,
      fullName: 'Demo Head of Department',
      role: 'HOD',
      departmentId: dept.id,
      departmentRole: 'HOD',
      accountStatus: 'ACTIVE',
      staffId: 'HOD-CS-001',
    },
  });

  const demoStudent = await prisma.user.upsert({
    where: { institutionId_email: { institutionId: institution.id, email: 'student@demo.ibbul.edu' } },
    update: {
      passwordHash: studentPass,
      fullName: 'Demo Student',
      matricNumber: 'CSC/22/0001',
      role: 'STUDENT',
      departmentId: dept.id,
      accountStatus: 'ACTIVE',
    },
    create: {
      institutionId: institution.id,
      email: 'student@demo.ibbul.edu',
      passwordHash: studentPass,
      fullName: 'Demo Student',
      matricNumber: 'CSC/22/0001',
      role: 'STUDENT',
      departmentId: dept.id,
      accountStatus: 'ACTIVE',
    },
  });

  const demoLecturer = await prisma.user.findUnique({
    where: { institutionId_email: { institutionId: institution.id, email: 'lecturer@demo.ibbul.edu' } },
    select: { id: true },
  });

  if (demoLecturer) {
    await prisma.suggestPermission.upsert({
      where: {
        lecturerId_studentId: { lecturerId: demoLecturer.id, studentId: demoStudent.id },
      },
      update: {},
      create: {
        lecturerId: demoLecturer.id,
        studentId: demoStudent.id,
        departmentId: dept.id,
        note: 'Demo — you may submit past questions and tutorials for review.',
      },
    });
  }

  await prisma.resource.updateMany({
    where: { governanceStatus: { in: ['PUBLISHED', 'PENDING_REVIEW'] } },
    data: { governanceStatus: 'VERIFIED' },
  });

  await prisma.user.upsert({
    where: { institutionId_email: { institutionId: institution.id, email: 'faculty@demo.ibbul.edu' } },
    update: {
      passwordHash: facultyPass,
      fullName: 'Demo Faculty Administrator',
      role: 'FACULTY_ADMIN',
      facultyId: faculty.id,
      departmentId: null,
      accountStatus: 'ACTIVE',
    },
    create: {
      institutionId: institution.id,
      email: 'faculty@demo.ibbul.edu',
      passwordHash: facultyPass,
      fullName: 'Demo Faculty Administrator',
      role: 'FACULTY_ADMIN',
      facultyId: faculty.id,
      accountStatus: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { institutionId_email: { institutionId: institution.id, email: 'admin@demo.ibbul.edu' } },
    update: {
      passwordHash: instAdminPass,
      fullName: 'IBBUL Institution Administrator',
      role: 'INSTITUTION_ADMIN',
      facultyId: null,
      departmentId: null,
      accountStatus: 'ACTIVE',
    },
    create: {
      institutionId: institution.id,
      email: 'admin@demo.ibbul.edu',
      passwordHash: instAdminPass,
      fullName: 'IBBUL Institution Administrator',
      role: 'INSTITUTION_ADMIN',
      accountStatus: 'ACTIVE',
    },
  });

  console.log('Seed OK — institution demo accounts (platform admin uses /platform/setup, not seed):');
  console.log('  Inst:     admin@demo.ibbul.edu / InstAdmin123!     → /ibbul/admin');
  console.log('  Faculty:  faculty@demo.ibbul.edu / FacultyDemo123!');
  console.log('  HOD:      hod@demo.ibbul.edu / HodDemo123!');
  console.log('  Lecturer: lecturer@demo.ibbul.edu / LecturerDemo123!');
  console.log('  Student:  student@demo.ibbul.edu / StudentDemo123!');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
