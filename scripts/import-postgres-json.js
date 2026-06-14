#!/usr/bin/env node
/**
 * Import prisma/sqlite-export.json into PostgreSQL.
 * Run after: npm run db:use:postgres (with DATABASE_URL=postgresql://...)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const exportPath = path.join(rootDir, 'prisma', 'sqlite-export.json');
const reportPath = path.join(rootDir, 'prisma', 'migration-report.json');

const POSTGRES_URL = process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL;
const dryRun = process.argv.includes('--dry-run');

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
  if (!POSTGRES_URL?.startsWith('postgres')) {
    console.error('Set POSTGRES_DATABASE_URL or DATABASE_URL to a postgresql:// URL');
    process.exit(1);
  }
  if (!fs.existsSync(exportPath)) {
    console.error(`Missing ${exportPath} — run export first`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  const prisma = new PrismaClient({
    datasources: { db: { url: POSTGRES_URL } },
  });
  const report = [];
  const mismatches = [];

  try {
    console.log('\nImporting into PostgreSQL…');
    for (const table of TABLE_ORDER) {
      const rows = payload[table] || [];
      if (!rows.length) {
        report.push({ table, exported: 0, imported: 0 });
        continue;
      }
      if (dryRun) {
        console.log(`  [dry-run] would import ${table}: ${rows.length}`);
        report.push({ table, exported: rows.length, imported: 0, dryRun: true });
        continue;
      }

      let imported = 0;
      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const result = await prisma[table].createMany({ data: chunk, skipDuplicates: true });
        imported += result.count;
      }
      console.log(`  imported ${table}: ${imported}/${rows.length}`);
      report.push({ table, exported: rows.length, imported });
    }

    if (!dryRun) {
      console.log('\nVerifying row counts…');
      for (const table of TABLE_ORDER) {
        const expected = (payload[table] || []).length;
        if (!expected) continue;
        const actual = await prisma[table].count();
        const ok = actual === expected;
        console.log(`  ${ok ? '✓' : '✗'} ${table}: ${actual} (expected ${expected})`);
        if (!ok) mismatches.push({ table, expected, actual });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  fs.writeFileSync(
    reportPath,
    JSON.stringify({ at: new Date().toISOString(), report, mismatches }, null, 2),
    'utf8',
  );

  if (mismatches.length) {
    console.error('\nImport finished with count mismatches — see migration-report.json');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\nDry run complete.');
    return;
  }

  console.log('\n✓ Import successful.');
}

main().catch((e) => {
  console.error('Import failed:', e.message);
  process.exit(1);
});
