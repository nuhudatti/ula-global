#!/usr/bin/env bash
# Optional: sync local off-site backup dir to cloud storage via rclone.
# Set in .env: BACKUP_OFFSITE_DIR=/var/backups/ula-offsite
#               BACKUP_RCLONE_REMOTE=gdrive:ibbul-ula-backups
set -euo pipefail
DIR="${BACKUP_OFFSITE_DIR:-/var/backups/ula-offsite}"
REMOTE="${BACKUP_RCLONE_REMOTE:-}"
if [[ -z "$REMOTE" ]]; then
  echo "BACKUP_RCLONE_REMOTE not set — local dir only: $DIR"
  exit 0
fi
rclone sync "$DIR" "$REMOTE/" --timeout 300s -v
