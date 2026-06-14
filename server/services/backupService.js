import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { promisify } from 'util';
import { execFile } from 'child_process';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { configureCloudinary, requireCloudinary } from '../config/cloudinary.js';
import { deleteByPublicId, uploadFromBuffer } from './cloudinaryService.js';
import { computeRetainedIds, getRetentionConfig, listExpiredBackupIds } from './backupRetention.js';
import { copyBackupOffsite, getOffsiteConfig } from './offsiteBackup.js';
import { logPlatformAudit } from './platformAudit.js';
import { detectDbEngine } from './dbEngine.js';
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');

export const BACKUP_VERSION = '1';

let restoreInProgress = false;
let writeLocked = false;

export function isSystemWriteLocked() {
  return restoreInProgress || writeLocked;
}

export function assertWritable() {
  if (isSystemWriteLocked()) {
    const err = new Error('System is temporarily read-only during backup restore');
    err.status = 503;
    throw err;
  }
}

function resolveDbPath() {
  const engine = detectDbEngine();
  if (engine === 'postgresql') {
    const err = new Error('Use PostgreSQL backup path — pg_dump is used automatically');
    err.status = 501;
    throw err;
  }
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  const match = url.match(/^file:(.+)$/);
  if (!match) {
    const err = new Error('Only SQLite database backups are supported');
    err.status = 501;
    throw err;
  }
  let rel = match[1].replace(/^\.\//, '');
  if (path.isAbsolute(rel)) return rel;
  return path.join(rootDir, 'prisma', rel);
}

async function postgresDumpToBuffer() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is required for PostgreSQL backup');
  const tmpSql = path.join(os.tmpdir(), `ula-pg-dump-${Date.now()}.sql`);
  try {
    await execFileAsync('pg_dump', ['--dbname', dbUrl, '--no-owner', '--no-acl', '--format=plain', '-f', tmpSql], {
      timeout: 300_000,
      env: process.env,
    });
    return fs.readFileSync(tmpSql);
  } catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('pg_dump not found — install PostgreSQL client tools');
      err.status = 501;
      throw err;
    }
    throw e;
  } finally {
    try {
      fs.unlinkSync(tmpSql);
    } catch {
      /* ignore */
    }
  }
}

function validatePostgresDumpPayload(raw) {
  const text = raw.slice(0, 2048).toString('utf8');
  const checks = {
    decompressedSize: raw.length,
    postgresDumpHeader: text.includes('PostgreSQL database dump') || text.includes('CREATE TABLE'),
    gzipValid: true,
  };
  const valid = checks.postgresDumpHeader && raw.length > 128;
  return {
    valid,
    checks,
    integrity: valid ? 'ok' : 'invalid_header',
    integrityNote: valid ? null : 'Missing PostgreSQL dump header',
  };
}

async function validatePostgresCompressedBackup(compressed) {
  const raw = await gunzip(compressed);
  return validatePostgresDumpPayload(raw);
}

/** Compress PostgreSQL pg_dump snapshot, upload to Cloudinary, off-site copy, retention. */
async function runPostgresDatabaseBackup({ actorId = null, trigger = 'manual' } = {}) {
  requireCloudinary();
  configureCloudinary();
  assertWritable();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `ula-pg-${stamp}-v${BACKUP_VERSION}.sql.gz`;
  const engine = 'postgresql';

  const pending = await prisma.backup.create({
    data: {
      fileUrl: '',
      publicId: '',
      status: 'PENDING',
      version: BACKUP_VERSION,
      trigger,
      engine,
      actorId: actorId || null,
    },
  });

  try {
    const raw = await postgresDumpToBuffer();
    const compressed = await gzip(raw);
    const checksum = sha256(compressed);
    const precheck = validatePostgresDumpPayload(raw);
    if (!precheck.valid) {
      const err = new Error(`Backup integrity check failed before upload: ${precheck.integrity || 'invalid'}`);
      err.status = 422;
      throw err;
    }

    const uploaded = await uploadFromBuffer(compressed, {
      subfolder: 'ula_backups',
      originalName: fileName,
      accessMode: 'authenticated',
      resourceType: 'raw',
    });

    const offsite = await copyBackupOffsite(compressed, fileName);

    const record = await prisma.backup.update({
      where: { id: pending.id },
      data: {
        fileUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
        size: compressed.length,
        status: 'COMPLETED',
        checksum,
        offsiteCopied: offsite.local || offsite.rclone,
        offsitePath: offsite.localPath,
        validatedAt: new Date(),
        validationOk: true,
        integrityChecked: true,
      },
    });

    await logAudit(
      'BACKUP_COMPLETED',
      actorId,
      `${trigger}:${record.id}:${fileName}:engine=postgresql:sha256=${checksum.slice(0, 12)}`,
    );
    const retention = await applyRetentionPolicy(actorId);
    return { record, offsite, retention };
  } catch (e) {
    await prisma.backup.update({ where: { id: pending.id }, data: { status: 'FAILED' } });
    await logAudit('BACKUP_FAILED', actorId, `${trigger}:${pending.id}:${e.message}`);
    throw e;
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Detect backup payload format from decompressed bytes (authoritative over stale metadata). */
function sniffBackupPayloadFormat(raw) {
  if (raw.length >= 15 && raw.slice(0, 15).toString() === 'SQLite format 3') return 'sqlite';
  const text = raw.slice(0, 4096).toString('utf8');
  if (text.includes('PostgreSQL database dump') || /\bCREATE TABLE\b/i.test(text)) return 'postgresql';
  return 'unknown';
}

/**
 * Resolve backup engine from metadata + payload sniffing.
 * Declared engine wins when it matches sniffed format; payload wins on conflict.
 */
function resolveBackupFormat(backup, raw) {
  const sniffed = sniffBackupPayloadFormat(raw);
  const declared = backup.engine === 'postgresql' || backup.engine === 'sqlite' ? backup.engine : null;

  if (declared && sniffed !== 'unknown' && declared !== sniffed) {
    return { format: sniffed, declared, conflict: true };
  }
  if (declared) return { format: declared, declared, conflict: false };
  return { format: sniffed === 'unknown' ? 'sqlite' : sniffed, declared, conflict: false };
}

function assertRestoreEngineCompatible(backupFormat, liveEngine) {
  if (liveEngine === 'unknown') {
    const err = new Error('DATABASE_URL is not configured — cannot restore backup');
    err.status = 503;
    throw err;
  }
  if (backupFormat === liveEngine) return;

  const hints =
    liveEngine === 'postgresql' && backupFormat === 'sqlite'
      ? 'Legacy SQLite binary backups cannot be restored into PostgreSQL. Take a new pg_dump backup after migration, or use scripts/migrate-sqlite-to-postgres.js for one-time data import.'
      : 'Backup format does not match the active database engine.';

  const err = new Error(`Cannot restore ${backupFormat} backup on ${liveEngine} database. ${hints}`);
  err.status = 422;
  throw err;
}

async function preparePostgresSchemaForRestore(dbUrl) {
  const resetSql = `
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
`.trim();
  await execFileAsync('psql', ['--dbname', dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', resetSql], {
    timeout: 120_000,
    env: process.env,
  });
}

async function logAudit(action, actorId, detail) {
  await logPlatformAudit({ action, actorId, actorType: 'platform', detail });
}

async function validateCompressedPayload(compressed) {
  const raw = await gunzip(compressed);
  const checks = {
    decompressedSize: raw.length,
    sqliteHeader: raw.slice(0, 15).toString() === 'SQLite format 3',
    gzipValid: true,
  };

  if (!checks.sqliteHeader || raw.length < 512) {
    return { valid: false, checks, integrity: 'invalid_header', integrityNote: null };
  }

  const tmp = path.join(os.tmpdir(), `ula-preval-${Date.now()}.db`);
  fs.writeFileSync(tmp, raw);
  try {
    const integrity = await sqliteIntegrityCheck(tmp);
    if (integrity === 'ok') return { valid: true, checks, integrity, integrityNote: null };
    if (integrity === 'skipped_no_cli') {
      return { valid: true, checks, integrity, integrityNote: 'sqlite3 CLI unavailable — header check passed' };
    }
    return { valid: false, checks, integrity, integrityNote: null };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

async function sqliteIntegrityCheck(dbPath) {
  try {
    const { stdout } = await execFileAsync('sqlite3', [dbPath, 'PRAGMA integrity_check;'], { timeout: 60_000 });
    const result = stdout.trim();
    return result === 'ok' ? 'ok' : result;
  } catch (e) {
    if (e.code === 'ENOENT') return 'skipped_no_cli';
    throw e;
  }
}

/** Apply retention — delete Cloudinary + DB records outside policy. */
export async function applyRetentionPolicy(actorId = null) {
  const config = getRetentionConfig();
  const backups = await prisma.backup.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
  });
  const expiredIds = listExpiredBackupIds(backups, config);
  const deleted = [];

  for (const id of expiredIds) {
    try {
      await deleteBackupRecord(id, actorId);
      deleted.push(id);
    } catch (e) {
      console.warn(`[backup] retention delete failed ${id}:`, e.message);
    }
  }

  if (deleted.length) {
    await logAudit('RETENTION_APPLIED', actorId, `removed=${deleted.length};keep=${computeRetainedIds(backups, config).size}`);
  }

  return { deleted: deleted.length, retained: computeRetainedIds(backups, config).size, config };
}

/** Compress SQLite snapshot, upload to Cloudinary, off-site copy, retention. */
export async function runDatabaseBackup({ actorId = null, trigger = 'manual' } = {}) {
  if (detectDbEngine() === 'postgresql') {
    return runPostgresDatabaseBackup({ actorId, trigger });
  }

  requireCloudinary();
  configureCloudinary();
  assertWritable();

  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    const err = new Error('Database file not found');
    err.status = 404;
    throw err;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `ula-db-${stamp}-v${BACKUP_VERSION}.db.gz`;

  const pending = await prisma.backup.create({
    data: {
      fileUrl: '',
      publicId: '',
      status: 'PENDING',
      version: BACKUP_VERSION,
      trigger,
      engine: detectDbEngine(),
      actorId: actorId || null,
    },
  });

  try {
    const raw = fs.readFileSync(dbPath);
    const compressed = await gzip(raw);
    const checksum = sha256(compressed);

    const precheck = await validateCompressedPayload(compressed);
    if (!precheck.valid) {
      const err = new Error(`Backup integrity check failed before upload: ${precheck.integrity || 'invalid'}`);
      err.status = 422;
      throw err;
    }

    const uploaded = await uploadFromBuffer(compressed, {
      subfolder: 'ula_backups',
      originalName: fileName,
      accessMode: 'authenticated',
      resourceType: 'raw',
    });

    const offsite = await copyBackupOffsite(compressed, fileName);

    let record = await prisma.backup.update({
      where: { id: pending.id },
      data: {
        fileUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
        size: compressed.length,
        status: 'COMPLETED',
        checksum,
        offsiteCopied: offsite.local || offsite.rclone,
        offsitePath: offsite.localPath,
        validatedAt: new Date(),
        validationOk: true,
        integrityChecked: true,
      },
    });

    await logAudit(
      'BACKUP_COMPLETED',
      actorId,
      `${trigger}:${record.id}:${fileName}:sha256=${checksum.slice(0, 12)}:offsite=${offsite.local ? 'local' : ''}${offsite.rclone ? '+rclone' : ''}`,
    );
    const retention = await applyRetentionPolicy(actorId);
    return { record, offsite, retention };
  } catch (e) {
    await prisma.backup.update({
      where: { id: pending.id },
      data: { status: 'FAILED' },
    });
    await logAudit('BACKUP_FAILED', actorId, `${trigger}:${pending.id}:${e.message}`);
    throw e;
  }
}

export async function listBackups() {
  return prisma.backup.findMany({
    where: { status: { in: ['COMPLETED', 'RESTORING', 'FAILED', 'PENDING'] } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
export async function getBackupStatus() {
  const engine = detectDbEngine();
  const [lastBackup, lastFailed, total, pending, audits] = await Promise.all([
    prisma.backup.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.backup.findFirst({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.backup.count({ where: { status: 'COMPLETED' } }),
    prisma.backup.count({ where: { status: 'PENDING' } }),
    prisma.systemAuditLog.findMany({
      where: {
        OR: [
          { action: { startsWith: 'BACKUP' } },
          { action: { startsWith: 'RESTORE' } },
          { action: { startsWith: 'RETENTION' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ]);

  const offsite = getOffsiteConfig();
  const dbPath = engine === 'sqlite' ? resolveDbPath() : null;
  let dbSizeBytes = null;
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      dbSizeBytes = fs.statSync(dbPath).size;
    } catch {
      /* ignore */
    }
  }

  return {
    version: BACKUP_VERSION,
    engine,
    cronEnabled: process.env.BACKUP_CRON_ENABLED !== 'false',
    cronSchedule: process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *',
    validateCron: process.env.BACKUP_VALIDATE_CRON || '0 3 * * 0',
    validateCronEnabled: process.env.BACKUP_VALIDATE_ENABLED !== 'false',
    retention: getRetentionConfig(),
    offsite,
    totalCompleted: total,
    pendingCount: pending,
    lastBackup,
    lastFailed,
    health: {
      ok:
        (lastFailed == null || (lastBackup && lastBackup.createdAt > lastFailed.createdAt)) &&
        (engine === 'sqlite' || engine === 'postgresql'),
      writeLocked: isSystemWriteLocked(),
      cloudinaryRequired: true,
      dbSizeBytes,
      dbPathMasked: dbPath ? dbPath.replace(/[^/\\]+(?=\.db$)/, '***') : null,
      engine,
    },
    recentAudits: audits,
  };
}
/** Dry-run restore validation — does not replace live DB. */
export async function validateDatabaseBackup(backupId, actorId = null) {
  requireCloudinary();
  const backup = await prisma.backup.findUnique({ where: { id: backupId } });
  if (!backup || backup.status !== 'COMPLETED') {
    const err = new Error('Backup not found or not validatable');
    err.status = 404;
    throw err;
  }

  const { fetchFileBufferByPublicId } = await import('./cloudinaryService.js');
  const compressed = await fetchFileBufferByPublicId(backup.publicId, 'raw', null, null, backup.fileUrl);
  const raw = await gunzip(compressed);
  const { format, declared, conflict } = resolveBackupFormat(backup, raw);
  const liveEngine = detectDbEngine();

  const report = {
    backupId,
    valid: false,
    engine: format,
    declaredEngine: declared,
    payloadEngineConflict: conflict,
    liveEngine,
    restoreCompatible: format === liveEngine,
    checks: {
      downloaded: true,
      compressedSize: compressed.length,
      decompressedSize: raw.length,
      gzipValid: true,
      sqliteHeader: format === 'sqlite' && raw.slice(0, 15).toString() === 'SQLite format 3',
      postgresDumpHeader:
        format === 'postgresql'
          ? raw.slice(0, 2048).toString('utf8').includes('PostgreSQL database dump') ||
            raw.slice(0, 2048).toString('utf8').includes('CREATE TABLE')
          : false,
    },
    integrity: null,
    integrityNote: null,
    validatedAt: new Date().toISOString(),
  };

  if (conflict) {
    report.integrityNote = `Backup metadata says ${declared} but payload is ${format} — using payload format`;
  }

  if (liveEngine !== 'unknown' && format !== liveEngine) {
    report.integrityNote = [
      report.integrityNote,
      `Live database is ${liveEngine} — this ${format} backup cannot be restored here`,
    ]
      .filter(Boolean)
      .join('; ');
  }

  if (format === 'postgresql') {
    const pgCheck = validatePostgresDumpPayload(raw);
    report.valid = pgCheck.valid && format === liveEngine;
    report.integrity = pgCheck.integrity;
    if (!pgCheck.valid) report.integrityNote = pgCheck.integrityNote;
    else if (format !== liveEngine) report.valid = false;
  } else if (!report.checks.sqliteHeader || raw.length < 512) {
    await prisma.backup.update({
      where: { id: backupId },
      data: { validatedAt: new Date(), validationOk: false },
    });
    await logAudit('RESTORE_VALIDATION_FAILED', actorId, JSON.stringify(report));
    return report;
  }

  if (format === 'sqlite') {
  const tmp = path.join(os.tmpdir(), `ula-val-${backupId}-${Date.now()}.db`);
  fs.writeFileSync(tmp, raw);
  try {
    report.integrity = await sqliteIntegrityCheck(tmp);
    if (report.integrity === 'ok') {
      report.valid = format === liveEngine;
    } else if (report.integrity === 'skipped_no_cli') {
      report.valid = format === liveEngine;
      report.integrityNote = [
        report.integrityNote,
        'sqlite3 CLI unavailable — header and decompress checks passed',
      ]
        .filter(Boolean)
        .join('; ');
    }
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
  }

  await prisma.backup.update({
    where: { id: backupId },
    data: { validatedAt: new Date(), validationOk: report.valid },
  });
  await logAudit(
    report.valid ? 'RESTORE_VALIDATION_PASSED' : 'RESTORE_VALIDATION_FAILED',
    actorId,
    JSON.stringify({ backupId, valid: report.valid, integrity: report.integrity }),
  );

  return report;
}

/** Download backup from Cloudinary, replace SQLite DB, log event. */
export async function restoreDatabaseBackup(backupId, actorId) {
  requireCloudinary();
  if (restoreInProgress) {
    const err = new Error('A restore is already in progress');
    err.status = 409;
    throw err;
  }

  const backup = await prisma.backup.findUnique({ where: { id: backupId } });
  if (!backup || backup.status !== 'COMPLETED') {
    const err = new Error('Backup not found or not restorable');
    err.status = 404;
    throw err;
  }

  restoreInProgress = true;
  writeLocked = true;

  await prisma.backup.update({
    where: { id: backupId },
    data: { status: 'RESTORING' },
  });
  await logAudit('RESTORE_STARTED', actorId, backupId);

  try {
    const { fetchFileBufferByPublicId } = await import('./cloudinaryService.js');
    const compressed = await fetchFileBufferByPublicId(backup.publicId, 'raw', null, null, backup.fileUrl);
    const raw = await gunzip(compressed);
    const { format } = resolveBackupFormat(backup, raw);
    const liveEngine = detectDbEngine();
    assertRestoreEngineCompatible(format, liveEngine);

    if (format === 'postgresql') {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        const err = new Error('DATABASE_URL is required for PostgreSQL restore');
        err.status = 503;
        throw err;
      }
      const dumpPath = path.join(os.tmpdir(), `ula-pg-restore-${backupId}-${Date.now()}.sql`);
      const preRestore = path.join(os.tmpdir(), `ula-pg-pre-restore-${Date.now()}.sql`);
      try {
        const preRaw = await postgresDumpToBuffer();
        fs.writeFileSync(preRestore, preRaw);
      } catch (e) {
        console.warn('[backup] Pre-restore pg_dump failed:', e.message);
      }
      fs.writeFileSync(dumpPath, raw);
      await prisma.$disconnect();
      console.log('[backup] Resetting PostgreSQL public schema before restore…');
      await preparePostgresSchemaForRestore(dbUrl);
      await execFileAsync('psql', ['--dbname', dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', dumpPath], {
        timeout: 600_000,
        env: process.env,
      });
      try {
        fs.unlinkSync(dumpPath);
      } catch {
        /* ignore */
      }
      await prisma.backup.update({
        where: { id: backupId },
        data: { status: 'COMPLETED' },
      });
      await logAudit('RESTORE_COMPLETED', actorId, `${backupId}:postgresql restored from ${backup.createdAt.toISOString()}`);
      return { ok: true, backupId, preRestorePath: preRestore, restartRequired: true, engine: 'postgresql' };
    }

    const dbPath = resolveDbPath();
    const preRestore = `${dbPath}.pre-restore-${Date.now()}`;
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, preRestore);

    await prisma.$disconnect();
    fs.writeFileSync(dbPath, raw);

    await prisma.backup.update({
      where: { id: backupId },
      data: { status: 'COMPLETED' },
    });
    await logAudit('RESTORE_COMPLETED', actorId, `${backupId}:restored from ${backup.createdAt.toISOString()}`);

    return { ok: true, backupId, preRestorePath: preRestore, restartRequired: true, engine: 'sqlite' };
  } catch (e) {
    await prisma.backup
      .update({
        where: { id: backupId },
        data: { status: 'COMPLETED' },
      })
      .catch(() => {});
    await logAudit('RESTORE_FAILED', actorId, `${backupId}:${e.message}`);
    throw e;
  } finally {
    restoreInProgress = false;
    writeLocked = false;
  }
}

export async function deleteBackupRecord(backupId, actorId = null) {
  const backup = await prisma.backup.findUnique({ where: { id: backupId } });
  if (!backup) {
    const err = new Error('Backup not found');
    err.status = 404;
    throw err;
  }
  if (backup.publicId) await deleteByPublicId(backup.publicId, 'raw');
  await prisma.backup.delete({ where: { id: backupId } });
  await logAudit('BACKUP_DELETED', actorId, backupId);
  return { ok: true };
}
/** Daily cron — backup + retention. */
export function scheduleDailyBackup() {
  const enabled = process.env.BACKUP_CRON_ENABLED !== 'false';
  if (!enabled) {
    console.log('[backup] Daily cron disabled (BACKUP_CRON_ENABLED=false)');
    return;
  }

  const expr = process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *';
  cron.schedule(expr, async () => {
    try {
      console.log('[backup] Running scheduled daily backup…');
      const { record } = await runDatabaseBackup({ trigger: 'cron' });
      console.log(`[backup] Completed: ${record.id} (${record.size} bytes)`);
    } catch (e) {
      console.error('[backup] Scheduled backup failed:', e.message);
    }
  });
  console.log(`[backup] Daily cron scheduled (${expr})`);
}

/** Weekly automated restore validation on latest backup. */
export function scheduleBackupValidation() {
  const enabled = process.env.BACKUP_VALIDATE_ENABLED !== 'false';
  if (!enabled) {
    console.log('[backup] Validation cron disabled (BACKUP_VALIDATE_ENABLED=false)');
    return;
  }

  const expr = process.env.BACKUP_VALIDATE_CRON || '0 3 * * 0';
  cron.schedule(expr, async () => {
    try {
      const latest = await prisma.backup.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
      });
      if (!latest) return;
      console.log(`[backup] Validating latest backup ${latest.id}…`);
      const report = await validateDatabaseBackup(latest.id, null);
      console.log(`[backup] Validation ${report.valid ? 'passed' : 'failed'} (${latest.id})`);
    } catch (e) {
      console.error('[backup] Scheduled validation failed:', e.message);
    }
  });
  console.log(`[backup] Validation cron scheduled (${expr})`);
}
