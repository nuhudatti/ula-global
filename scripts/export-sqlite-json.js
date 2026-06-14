#!/usr/bin/env node
/**
 * Export all SQLite tables to prisma/sqlite-export.json.
 * Run after: npm run db:use:sqlite (with DATABASE_URL=file:./dev.db)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const exportPath = path.join(rootDir, 'prisma', 'sqlite-export.json');

const SQLITE_URL = process.env.SQLITE_DATABASE_URL || process.env.DATABASE_URL || 'file:./dev.db';

const TABLE_ORDER = [
  'institution',
  'platformOperator',
  'platformEmailSettings',
  'faculty',
  'department',
  'course',
  'user',
  'platformPasswordResetToken',
  'passwordResetToken',
  'lecturerInvite',
  'facultyAdminInvite',
  'departmentNotice',
  'lecturerCourseAssignment',
  'suggestPermission',
  'resource',
  'materialSuggestion',
  'rating',
  'assignment',
  'assignmentSubmission',
  'courseDiscussion',
  'backup',
  'systemAuditLog',
];

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: SQLITE_URL } },
  });
  const payload = {};

  try {
    for (const table of TABLE_ORDER) {
      if (typeof prisma[table]?.findMany !== 'function') {
        console.warn(`  skip unknown delegate: ${table}`);
        continue;
      }
      const rows = await prisma[table].findMany();
      payload[table] = rows;
      console.log(`  exported ${table}: ${rows.length}`);
    }
  } finally {
    await prisma.$disconnect();
  }

  fs.writeFileSync(exportPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`  saved → ${exportPath}`);
}

main().catch((e) => {
  console.error('Export failed:', e.message);
  process.exit(1);
});
