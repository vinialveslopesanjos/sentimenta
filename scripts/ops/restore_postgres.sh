#!/usr/bin/env bash
set -euo pipefail

if [ "${I_UNDERSTAND_RESTORE:-}" != "1" ]; then
  echo "Refusing to restore without I_UNDERSTAND_RESTORE=1"
  exit 1
fi

if [ "$#" -ne 1 ]; then
  echo "Usage: I_UNDERSTAND_RESTORE=1 $0 /path/to/backup.sql.gz"
  exit 1
fi

backup_file="$1"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-sentimenta_db}"
POSTGRES_USER="${POSTGRES_USER:-sentimenta}"

if [ ! -f "$backup_file" ]; then
  echo "Backup not found: $backup_file"
  exit 1
fi

echo "Restoring $backup_file into $POSTGRES_DB on $POSTGRES_HOST:$POSTGRES_PORT"
gzip -dc "$backup_file" | psql \
  --host "$POSTGRES_HOST" \
  --port "$POSTGRES_PORT" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=on
