import {
  applyRetentionPolicy,
  deleteBackupRecord,
  getBackupStatus,
  listBackups,
  restoreDatabaseBackup,
  runDatabaseBackup,
  validateDatabaseBackup,
} from '../services/backupService.js';

/** Platform routes use req.platformUser; legacy institution routes use req.user. */
function getBackupActorId(req) {
  return req.platformUser?.id ?? req.user?.id ?? null;
}

export async function getStatus(_req, res) {
  try {
    const status = await getBackupStatus();
    res.json(status);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load backup status' });
  }
}

export async function runBackup(req, res) {
  try {
    const result = await runDatabaseBackup({ actorId: getBackupActorId(req), trigger: 'manual' });
    res.status(201).json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Backup failed' });
  }
}

export async function getBackups(_req, res) {
  try {
    const items = await listBackups();
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list backups' });
  }
}

export async function runRetention(req, res) {
  try {
    const result = await applyRetentionPolicy(getBackupActorId(req));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Retention failed' });
  }
}

export async function validateBackup(req, res) {
  try {
    const report = await validateDatabaseBackup(req.params.id, getBackupActorId(req));
    res.json(report);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Validation failed' });
  }
}

export async function restoreBackup(req, res) {
  try {
    const result = await restoreDatabaseBackup(req.params.id, getBackupActorId(req));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Restore failed' });
  }
}

export async function removeBackup(req, res) {
  try {
    const result = await deleteBackupRecord(req.params.id, getBackupActorId(req));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Delete failed' });
  }
}
