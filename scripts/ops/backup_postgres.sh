#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/sentimenta/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_METHOD="${BACKUP_METHOD:-host}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yml}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-sentimenta_db}"
POSTGRES_USER="${POSTGRES_USER:-sentimenta}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +%Y-%m-%d_%H%M%S)"
outfile="$BACKUP_DIR/${POSTGRES_DB}_${timestamp}.sql.gz"

if [ "$BACKUP_METHOD" = "compose" ]; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc \
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format plain --no-owner --no-acl' \
    | gzip -9 > "$outfile"
else
  pg_dump \
    --host "$POSTGRES_HOST" \
    --port "$POSTGRES_PORT" \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --format plain \
    --no-owner \
    --no-acl \
    | gzip -9 > "$outfile"
fi

chmod 600 "$outfile"

find "$BACKUP_DIR" -type f -name "${POSTGRES_DB}_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

if [ -n "$RCLONE_REMOTE" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$outfile" "$RCLONE_REMOTE"
fi

echo "Backup created: $outfile"
