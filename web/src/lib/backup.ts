import { platformApi } from './platformApi';

export type BackupRecord = {
  id: string;
  fileUrl: string;
  publicId: string;
  size: number | null;
  version: string;
  status: string;
  trigger: string;
  engine: string;
  checksum: string | null;
  offsiteCopied: boolean;
  offsitePath: string | null;
  integrityChecked: boolean;
  validatedAt: string | null;
  validationOk: boolean | null;
  createdAt: string;
};

export type BackupStatus = {
  version: string;
  engine: string;
  cronEnabled: boolean;
  cronSchedule: string;
  validateCron: string;
  validateCronEnabled: boolean;
  retention: { daily: number; weekly: number; monthly: number };
  offsite: {
    localDir: string | null;
    rcloneRemote: string | null;
    enabled: boolean;
    rcloneEnabled: boolean;
    isDevDefault?: boolean;
  };
  totalCompleted: number;
  pendingCount: number;
  lastBackup: BackupRecord | null;
  lastFailed: BackupRecord | null;
  health: {
    ok: boolean;
    writeLocked: boolean;
    cloudinaryRequired: boolean;
    dbSizeBytes: number | null;
    dbPathMasked: string | null;
  };
  recentAudits: { id: string; action: string; detail: string | null; createdAt: string }[];
};

export type ValidationReport = {
  backupId: string;
  valid: boolean;
  checks: {
    downloaded: boolean;
    compressedSize: number;
    decompressedSize: number;
    sqliteHeader: boolean;
    gzipValid: boolean;
  };
  integrity: string | null;
  integrityNote: string | null;
  validatedAt: string;
};

export function fetchBackupStatus() {
  return platformApi<BackupStatus>('/api/platform/backup/status');
}

export function fetchBackups() {
  return platformApi<{ items: BackupRecord[] }>('/api/platform/backup');
}

export function runBackupNow() {
  return platformApi<{
    record: BackupRecord;
    offsite: { local: boolean; rclone: boolean; localPath?: string; errors: string[] };
    retention: { deleted: number; retained: number };
  }>('/api/platform/backup/run', { method: 'POST' });
}

export function runRetentionNow() {
  return platformApi<{ deleted: number; retained: number }>('/api/platform/backup/retention', { method: 'POST' });
}

export function validateBackup(id: string) {
  return platformApi<ValidationReport>(`/api/platform/backup/validate/${id}`, { method: 'POST' });
}

export function restoreBackup(id: string) {
  return platformApi<{ ok: boolean; restartRequired: boolean }>(`/api/platform/backup/restore/${id}`, {
    method: 'POST',
  });
}

export function deleteBackup(id: string) {
  return platformApi<{ ok: boolean }>(`/api/platform/backup/${id}`, { method: 'DELETE' });
}
