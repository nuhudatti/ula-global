import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');

export function getOffsiteConfig() {
  const isDev = process.env.NODE_ENV !== 'production';
  const configured = process.env.BACKUP_OFFSITE_DIR?.trim();
  const localDir = configured || (isDev ? path.join(repoRoot, '..', 'ula-backups') : null);  const rcloneRemote = process.env.BACKUP_RCLONE_REMOTE?.trim() || null;
  return {
    localDir,
    rcloneRemote,
    enabled: Boolean(localDir),
    rcloneEnabled: Boolean(rcloneRemote),
    isDevDefault: isDev && !configured,
  };
}
/**
 * Copy gzipped DB backup to off-server path (+ optional rclone remote).
 * BACKUP_OFFSITE_DIR=/var/backups/ula-offsite
 * BACKUP_RCLONE_REMOTE=gdrive:ibbul-ula-backups
 */
export async function copyBackupOffsite(buffer, fileName) {
  const { localDir, rcloneRemote } = getOffsiteConfig();
  const result = { local: false, rclone: false, localPath: null, errors: [] };

  if (!localDir) return result;

  try {
    fs.mkdirSync(localDir, { recursive: true });
    const dest = path.join(localDir, fileName);
    fs.writeFileSync(dest, buffer);
    result.local = true;
    result.localPath = dest;
  } catch (e) {
    result.errors.push(`local: ${e.message}`);
    return result;
  }

  if (rcloneRemote && result.localPath) {
    try {
      await execFileAsync(
        'rclone',
        ['copy', result.localPath, `${rcloneRemote}/`, '--timeout', '120s'],
        { timeout: 130_000 },
      );
      result.rclone = true;
    } catch (e) {
      result.errors.push(`rclone: ${e.message}`);
    }
  }

  return result;
}
