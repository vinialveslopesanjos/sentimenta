#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sentimenta}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yml}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-1}"
SENTIMENTA_IMAGE_TAG="${SENTIMENTA_IMAGE_TAG:-$(git -C "$APP_DIR" rev-parse --short HEAD)}"
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-/tmp/sentimenta-deploy.lock}"

export SENTIMENTA_IMAGE_TAG

exec 9>"$DEPLOY_LOCK_FILE"
if ! flock -n 9; then
  echo "Another Sentimenta deploy is already running. Lock: $DEPLOY_LOCK_FILE"
  exit 1
fi

cd "$APP_DIR"

if [ ! -f ".env" ]; then
  echo "Missing $APP_DIR/.env"
  exit 1
fi

if [ "$BACKUP_BEFORE_DEPLOY" = "1" ] && [ -f "$APP_DIR/scripts/ops/backup_postgres.sh" ]; then
  BACKUP_METHOD=compose COMPOSE_FILE="$COMPOSE_FILE" bash "$APP_DIR/scripts/ops/backup_postgres.sh"
fi

docker compose -f "$COMPOSE_FILE" build
docker compose -f "$COMPOSE_FILE" run --rm api alembic upgrade head
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose -f "$COMPOSE_FILE" ps

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempts="${3:-30}"

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null; then
      return 0
    fi
    sleep 2
  done

  echo "$name did not become ready: $url"
  return 1
}

wait_for_url "API" "http://127.0.0.1:${API_PORT:-8000}/health"
wait_for_url "Web" "http://127.0.0.1:${WEB_PORT:-3000}/blog"

echo "Deploy complete for tag $SENTIMENTA_IMAGE_TAG"
