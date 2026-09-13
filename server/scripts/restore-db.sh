#!/bin/bash
# Restore drill helper - run this periodically against a throwaway database,
# never against production. A backup that has never been restored isn't a
# verified backup.
#
# Usage: ./restore-db.sh <path-to-dump.sql.gz> <target-database-name>
# Example: ./restore-db.sh ../../backups/aak_arbitration_20260913_020000.sql.gz aak_restore_drill

set -euo pipefail

DUMP_FILE="${1:?Usage: $0 <dump.sql.gz> <target-database-name>}"
TARGET_DB="${2:?Usage: $0 <dump.sql.gz> <target-database-name>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

DB_HOST=$(grep -E '^DB_HOST=' "$ENV_FILE" | cut -d '=' -f2-)
DB_PORT=$(grep -E '^DB_PORT=' "$ENV_FILE" | cut -d '=' -f2-)
DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | cut -d '=' -f2-)
DB_PASSWORD=$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | cut -d '=' -f2-)

if [ "$TARGET_DB" = "$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d '=' -f2-)" ]; then
  echo "REFUSING: target database matches the live DB_NAME in .env. Use a separate drill database." >&2
  exit 1
fi

echo "Creating $TARGET_DB (if it doesn't already exist)..."
MYSQL_PWD="$DB_PASSWORD" mysql --host="$DB_HOST" --port="${DB_PORT:-3306}" --user="$DB_USER" \
  -e "CREATE DATABASE IF NOT EXISTS \`$TARGET_DB\`;"

echo "Restoring $DUMP_FILE into $TARGET_DB..."
gunzip -c "$DUMP_FILE" | MYSQL_PWD="$DB_PASSWORD" mysql --host="$DB_HOST" --port="${DB_PORT:-3306}" --user="$DB_USER" "$TARGET_DB"

ROW_COUNT=$(MYSQL_PWD="$DB_PASSWORD" mysql --host="$DB_HOST" --port="${DB_PORT:-3306}" --user="$DB_USER" -N -e \
  "SELECT COUNT(*) FROM \`$TARGET_DB\`.cases;")

echo "Restore complete. $TARGET_DB.cases has $ROW_COUNT rows - compare against the source dump's expected count."
echo "Remember to drop the drill database when done: DROP DATABASE \`$TARGET_DB\`;"
