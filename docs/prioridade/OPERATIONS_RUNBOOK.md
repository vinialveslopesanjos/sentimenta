# Sentimenta Operations Runbook

## Operating Model

Production should be deployed from a clean Git commit with CI green. Do not edit
production files directly except for secrets in `/opt/sentimenta/.env`.

Short-term target:

- Single VPS.
- Docker Compose for Sentimenta services.
- Host Nginx terminates HTTPS and proxies to `127.0.0.1:3000` and `127.0.0.1:8000`.
- Postgres and Redis stay private inside the Compose network unless a documented
  maintenance window requires access.

K3s/Kubernetes is deferred until there is more than one host, a clear autoscaling
need, or operational ownership for cluster upgrades and backups.

## Deployment

1. Confirm the branch is clean and reviewed:

   ```bash
   git status --short --branch
   ```

2. Confirm `.env` exists on the VPS and matches `.env.prod.example`.

3. Run:

   ```bash
   APP_DIR=/opt/sentimenta bash /opt/sentimenta/scripts/ops/deploy_compose.sh
   ```

4. Check:

   ```bash
   docker compose -f compose.prod.yml ps
   curl -fsS http://127.0.0.1:8000/health
   curl -fsS http://127.0.0.1:3000/health
   ```

## Rollback

1. Identify the previous commit/tag.
2. Check out that commit on the VPS.
3. Run `deploy_compose.sh` again.
4. If a migration changed data shape, restore the pre-deploy backup only after
   confirming the impact.

## Backups

Use `bash scripts/ops/backup_postgres.sh` from cron. Configure:

- `BACKUP_DIR=/opt/sentimenta/backups`
- `RETENTION_DAYS=14`
- `RCLONE_REMOTE=<remote>:sentimenta/postgres` for offsite copy

Monthly restore drill:

```bash
createdb sentimenta_restore_test
I_UNDERSTAND_RESTORE=1 POSTGRES_DB=sentimenta_restore_test bash scripts/ops/restore_postgres.sh /path/to/backup.sql.gz
psql -d sentimenta_restore_test -c "select count(*) from users;"
dropdb sentimenta_restore_test
```

## Monitoring Alerts

Create alerts for:

- API `/health` failing.
- `api`, `worker`, `beat`, `web`, `postgres`, or `redis` unhealthy.
- Disk usage above 80%.
- Swap usage above 70%.
- Missing Postgres backup in the last 26 hours.
- Any `PipelineRun` stuck in `running` for more than 6 hours.
- Any `PipelineRun` ending in `failed` or repeated `partial`.
- Sentry error spike in FastAPI or Celery.

## Security Baseline

- Sentimenta services must not run as host `root`.
- `.env` must be `600` and never committed.
- SSH should prefer port `2222` and/or Tailscale; close public `22` after access is confirmed.
- Public ports must be justified. Keep Postgres/Redis private.
- Production red-team checks are not allowed without an explicit maintenance window.

## Read-only Audit

Run this when reconciling production state:

```bash
APP_DIR=/opt/sentimenta bash scripts/ops/vps_readonly_audit.sh > sentimenta-vps-audit.txt
```

The audit masks `.env` values and does not restart services or edit files.
