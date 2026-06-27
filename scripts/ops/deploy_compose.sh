#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sentimenta}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yml}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-1}"
SENTIMENTA_IMAGE_TAG="${SENTIMENTA_IMAGE_TAG:-$(git -C "$APP_DIR" rev-parse --short HEAD)}"

export SENTIMENTA_IMAGE_TAG

cd "$APP_DIR"

if [ ! -f ".env" ]; then
  echo "Missing $APP_DIR/.env"
  exit 1
fi

if [ "$BACKUP_BEFORE_DEPLOY" = "1" ] && [ -f "$APP_DIR/scripts/ops/backup_postgres.sh" ]; then
  bash "$APP_DIR/scripts/ops/backup_postgres.sh"
fi

docker compose -f "$COMPOSE_FILE" build
docker compose -f "$COMPOSE_FILE" run --rm api alembic upgrade head
docker compose -f "$COMPOSE_FILE" up -d
docker compose -f "$COMPOSE_FILE" ps

echo "Deploy complete for tag $SENTIMENTA_IMAGE_TAG"
