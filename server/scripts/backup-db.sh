#!/bin/bash
# Nightly database backup, meant to run as a cPanel cron job:
#   0 2 * * *  /bin/bash /home/<cpanel-user>/aak-arbitration/server/scripts/backup-db.sh >> /home/<cpanel-user>/backup.log 2>&1
#
# Free-resource design: mysqldump and gzip ship with any cPanel host, so the
# local half of this needs no new account or install. Off-site copy uses
# rclone (free, open-source) - see the OFFSITE block below, disabled by
# default until you point it at a destination (Backblaze B2's free 10GB
# tier is a reasonable free choice: https://www.backblaze.com/b2).
#
# This is a backup script, not a restore drill - a backup that has never
# been restored isn't a backup yet. Test `gunzip -c <dump>.sql.gz | mysql
# <test-db>` periodically against a scratch database, not production.

set -euo pipefail

# ---- Configuration ---------------------------------------------------
# Values are read from the API's own .env so credentials live in exactly
# one place. Adjust ENV_FILE if this script is deployed somewhere else
# relative to the server/ directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
BACKUP_DIR="$SCRIPT_DIR/../../backups"
RETENTION_DAYS=14

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found - copy .env.example first." >&2
  exit 1
fi

# Pull DB_* values out of .env without sourcing the whole file (it may
# contain other shell-unsafe values).
DB_HOST=$(grep -E '^DB_HOST=' "$ENV_FILE" | cut -d '=' -f2-)
DB_PORT=$(grep -E '^DB_PORT=' "$ENV_FILE" | cut -d '=' -f2-)
DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | cut -d '=' -f2-)
DB_PASSWORD=$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | cut -d '=' -f2-)
DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d '=' -f2-)
DOCUMENT_STORAGE_PATH=$(grep -E '^DOCUMENT_STORAGE_PATH=' "$ENV_FILE" | cut -d '=' -f2-)

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"
DOCS_ARCHIVE="$BACKUP_DIR/documents_${TIMESTAMP}.tar.gz"

# ---- Dump --------------------------------------------------------------
# --single-transaction takes a consistent InnoDB snapshot without locking
# tables for the duration of the dump (safe to run during business hours).
# --routines/--triggers/--events capture anything beyond plain table data.
MYSQL_PWD="$DB_PASSWORD" mysqldump \
  --host="$DB_HOST" \
  --port="${DB_PORT:-3306}" \
  --user="$DB_USER" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" | gzip > "$DUMP_FILE"

echo "$(date -Iseconds) Backup written: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"

# ---- Uploaded documents --------------------------------------------------
# The DB dump alone doesn't cover files that live on disk outside it -
# case filings, awards, correspondence. Skipped gracefully if the folder
# doesn't exist yet (e.g. a fresh install with no uploads).
if [ -n "${DOCUMENT_STORAGE_PATH:-}" ] && [ -d "$DOCUMENT_STORAGE_PATH" ]; then
  tar -czf "$DOCS_ARCHIVE" -C "$(dirname "$DOCUMENT_STORAGE_PATH")" "$(basename "$DOCUMENT_STORAGE_PATH")"
  echo "$(date -Iseconds) Backup written: $DOCS_ARCHIVE ($(du -h "$DOCS_ARCHIVE" | cut -f1))"
else
  echo "$(date -Iseconds) Skipping document backup: $DOCUMENT_STORAGE_PATH not found"
fi

# ---- Local rotation ------------------------------------------------------
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -print -delete
find "$BACKUP_DIR" -name "documents_*.tar.gz" -mtime "+${RETENTION_DAYS}" -print -delete

# ---- Off-site copy (disabled until configured) --------------------------
# 1. Install rclone (free): curl https://rclone.org/install.sh | sudo bash
# 2. Configure a remote once, interactively: rclone config
# 3. Uncomment the line below and set OFFSITE_REMOTE to that remote's name.
#
# OFFSITE_REMOTE="b2-backups:aak-arbitration-backups"
# if [ -n "${OFFSITE_REMOTE:-}" ]; then
#   rclone copy "$DUMP_FILE" "$OFFSITE_REMOTE"
#   [ -f "$DOCS_ARCHIVE" ] && rclone copy "$DOCS_ARCHIVE" "$OFFSITE_REMOTE"
# fi
