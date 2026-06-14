#!/usr/bin/env node
/**
 * Safe SQLite → PostgreSQL data migration for ULA.
 *
 * Prerequisites:
 *   - PostgreSQL schema already applied (prisma migrate deploy)
 *   - SQLITE_DATABASE_URL=file:./dev.db  (source)
 *   - POSTGRES_DATABASE_URL=postgresql://...  (target)
 *
 * Usage: node scripts/migrate-sqlite-to-postgres.js [--dry-run] [--skip-deploy]
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env') });
const exportPath = path.join(rootDir, 'prisma', 'sqlite-export.json');

const dryRun = process.argv.includes('--dry-run');
const skipDeploy = process.argv.includes('--skip-deploy');

const SQLITE_URL = process.env.SQLITE_DATABASE_URL || 'file:./dev.db';
const POSTGRES_URL = process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL;

if (!POSTGRES_URL || !POSTGRES_URL.startsWith('postgres')) {
  console.error('Set POSTGRES_DATABASE_URL=postgresql://user:pass@host:5432/dbname');
  process.exit(1);
}

function run(cmd, env = {}) {
  execSync(cmd, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

async function main() {
  console.log('ULA SQLite → PostgreSQL migration');
  console.log(`  source: ${SQLITE_URL}`);
  console.log(`  target: ${POSTGRES_URL.replace(/:([^:@/]+)@/, ':***@')}`);
  if (dryRun) console.log('  mode: DRY RUN (no PostgreSQL writes)');

  console.log('\n[1/5] Backing up SQLite file…');
  run('node scripts/backup-sqlite-file.js', {
    DATABASE_URL: SQLITE_URL,
    SQLITE_DATABASE_URL: SQLITE_URL,
  });

  console.log('\n[2/5] Exporting SQLite data…');
  // Separate process so Prisma client matches sqlite provider (avoids ESM module cache)
  run('node scripts/db-use-provider.js sqlite', { DATABASE_URL: SQLITE_URL });
  run('node scripts/export-sqlite-json.js', {
    DATABASE_URL: SQLITE_URL,
    SQLITE_DATABASE_URL: SQLITE_URL,
  });

  if (!fs.existsSync(exportPath)) {
    throw new Error('Export file was not created');
  }

  console.log('\n[3/5] Applying PostgreSQL schema…');
  run('node scripts/db-use-provider.js postgresql', { DATABASE_URL: POSTGRES_URL });
  if (!skipDeploy) {
    run('npx prisma migrate deploy', { DATABASE_URL: POSTGRES_URL });
  } else {
    console.log('  (--skip-deploy: assuming schema already applied)');
  }

  console.log('\n[4/5] Importing into PostgreSQL…');
  const importFlags = dryRun ? '--dry-run' : '';
  run(`node scripts/import-postgres-json.js ${importFlags}`.trim(), {
    DATABASE_URL: POSTGRES_URL,
    POSTGRES_DATABASE_URL: POSTGRES_URL,
  });

  if (dryRun) {
    console.log('\nDry run complete. Re-run without --dry-run to import.');
    return;
  }

  console.log('\n✓ Migration successful.');
  console.log('Next steps:');
  console.log('  1. Set DATABASE_URL to your PostgreSQL URL in .env');
  console.log('  2. Run: npm run db:use:postgres');
  console.log('  3. Restart API: npm run dev');
  console.log('  4. Run the testing checklist in POSTGRESQL_MIGRATION.md');
  console.log(
    '\nRollback: copy prisma/dev.db.pre-postgres-* back to prisma/dev.db, set DATABASE_URL=file:./dev.db, npm run db:use:sqlite',
  );
}

main().catch((e) => {
  console.error('\nMigration failed:', e.message);
  process.exit(1);
});
