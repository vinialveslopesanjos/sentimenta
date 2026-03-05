#!/bin/bash
# Daily PostgreSQL backup for sentimenta_db
# Retention: 7 days

BACKUP_DIR="/opt/sentimenta/backups"
DB_NAME="sentimenta_db"
DB_USER="sentimenta"
TIMESTAMP=$(date +%Y-%m-%d_%H%M)

export PGPASSWORD='Vini201297##'

pg_dump -U "$DB_USER" -h localhost "$DB_NAME" | gzip > "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Remove backups older than 7 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

unset PGPASSWORD
