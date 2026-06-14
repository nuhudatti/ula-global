#!/usr/bin/env node
/**
 * Copy SQLite database file to a timestamped backup before PostgreSQL migration.
 * Usage: node scripts/backup-sqlite-file.js [optional-source-path]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

function resolveSqlitePath() {
  const arg = process.argv[2];
  if (arg) return path.resolve(arg);
  const url = process.env.SQLITE_DATABASE_URL || process.env.DATABASE_URL || 'file:./dev.db';
  const match = url.match(/^file:(.+)$/);
  if (!match) {
    console.error('Set SQLITE_DATABASE_URL=file:./dev.db or pass a .db file path');
    process.exit(1);
  }
  let rel = match[1].replace(/^\.\//, '');
  if (path.isAbsolute(rel)) return rel;
  return path.join(rootDir, 'prisma', rel);
}

const source = resolveSqlitePath();
if (!fs.existsSync(source)) {
  console.error(`SQLite file not found: ${source}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = `${source}.pre-postgres-${stamp}`;
fs.copyFileSync(source, dest);
console.log(`[backup] SQLite copied to ${dest}`);
console.log(`[backup] Keep this file for rollback — restore by copying back over ${source}`);
